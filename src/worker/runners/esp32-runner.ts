import { BaseComponent } from '@openhw/emulator';
import { 
    BoardRunner, 
    ConnectedComponentPin, 
    LOGIC_REGISTRY,
    COMPONENT_PINS,
    getInternalBridgesForComponent,
    getUnifiedComponentSyncState,
    decodeBase64ToBytes,
    getComponentStateSyncPolicy,
    collectComponentTelemetry
} from '../registries/component-registry.ts';
import { ESP32, SimulationClock } from './esp32-engine.js';

export class ESP32Runner implements BoardRunner {
    cpu: ESP32 | null = null;
    clock: SimulationClock | null = null;
    running: boolean = false;
    pinStates: Record<string, boolean> = {};
    currentWires: any[] = [];
    instances: Map<string, BaseComponent> = new Map();
    lastTime: number = 0;
    statusInterval: any;
    pinsChanged: boolean = true;
    speed: number = 1.0;
    boardId: string;
    solverMode: 'logic' = 'logic';
    private pinToNet = new Map<string, number>();
    private serialBaudRate: number = 115200;
    private serialByteBudget: number = 0;
    private serialBuffer: number[] = [];
    private readonly onStateUpdate: (state: any) => void;
    private readonly onByteTransmitCb?: (payload: { boardId: string; value: number; char: string; source?: string }) => void;
    private componentSyncMeta = new Map<string, { lastSentAt: number; lastWeight: number }>();
    private circuitDirty: boolean = true;
    private lastPhysicsSolveAt: number = 0;
    private repropagateAllVoltages: (() => void) | null = null;
    private activeListeners: (() => void)[] = [];
    private statusIntervalEmitCount: number = 0;

    constructor(
        hexData: string,
        componentsDef: any[],
        wiresDef: any[],
        onStateUpdate: (state: any) => void,
        options: any = {}
    ) {
        this.pinToNet = new Map();
        this.instances = new Map();
        this.pinStates = {};
        this.activeListeners = [];
        this.componentSyncMeta = new Map();
        this.serialBuffer = [];
        this.cpu = null;
        this.clock = null;
        this.running = false;
        this.lastTime = 0;
        this.pinsChanged = true;
        this.circuitDirty = true;
        this.lastPhysicsSolveAt = 0;
        this.repropagateAllVoltages = null;
        this.statusIntervalEmitCount = 0;

        this.currentWires = wiresDef || [];
        this.onStateUpdate = onStateUpdate;
        this.onByteTransmitCb = options.onByteTransmit;
        this.speed = options.speed ?? 1.0;
        this.solverMode = 'logic';
        this.circuitDirty = true;
        
        const fallbackBoard = (componentsDef || []).find((c: any) => /(arduino|esp32|stm32|rp2040|pico)/i.test(String(c.type || '')));
        this.boardId = options.boardId || fallbackBoard?.id || 'openhw-esp32_0';
        this.setSerialBaudRate(options.serialBaudRate ?? 115200);

        (this as any).boardTelemetryEnabled = options.telemetryEnabled ?? false;
        (this as any).boardTelemetryMode = options.telemetryMode ?? 'detail';
        (this as any).boardTelemetryWatchedParams = options.telemetryWatchedParams ?? ['all'];
        (this as any).boardDeepSiliconEnabled = options.deepSiliconEnabled ?? false;

        // Decode the flat binary flash from base64
        const binaryBytes = decodeBase64ToBytes(hexData);
        console.warn(`[ESP32Runner] Flashing binary of size: ${binaryBytes.length} bytes`);
        console.warn(`[ESP32Runner] Magic byte at 0x1000: 0x${binaryBytes[0x1000]?.toString(16)} (Expected: 0xe9)`);
        console.warn(`[ESP32Runner] Magic byte at 0x0000: 0x${binaryBytes[0]?.toString(16)}`);
        
        // Instantiate the simulated clock and ESP32 dual-core Xtensa CPU
        this.clock = new SimulationClock();
        this.cpu = new ESP32({ flashSizeMB: 4, clock: this.clock });
        
        // Flash the merged binary image directly into physical flash memory
        this.cpu.flash.set(binaryBytes);
        
        // Load physical BootROM if provided
        if (options.esp32Rom) {
            let rom = options.esp32Rom;
            if (rom.length > 393216) {
                console.warn(`[ESP32Runner] Truncating overly large bootrom from ${rom.length} bytes to 393216 bytes`);
                rom = rom.slice(0, 393216);
            }
            this.cpu.loadROM(rom);
        }
        
        // Reset CPU to initialize MMU registers, dual cores, and peripherals
        this.cpu.reset();
        
        // CRITICAL: Force strapping pins for SPI Flash Boot!
        // Wokwi's GPIO inputs might default to false (LOW) if not externally driven,
        // which forces the BootROM into UART Download Mode. We must manually apply the default pull-up/pull-down states.
        if (this.cpu.gpio && this.cpu.gpio.pins) {
            if (this.cpu.gpio.pins[0]) this.cpu.gpio.pins[0].inputValue = true;   // GPIO0: HIGH (Boot from SPI)
            if (this.cpu.gpio.pins[2]) this.cpu.gpio.pins[2].inputValue = false;  // GPIO2: LOW (Must be low for boot)
            if (this.cpu.gpio.pins[12]) this.cpu.gpio.pins[12].inputValue = false; // GPIO12: LOW (Select 3.3V flash)
            if (this.cpu.gpio.pins[15]) this.cpu.gpio.pins[15].inputValue = true;  // GPIO15: HIGH (Disable JTAG, normal boot)
        }
        
        this.cpu.stopped = false; // Force CPU to not be halted
        if (this.cpu.cores?.[0] && typeof this.cpu.cores[0].PC !== 'undefined') {
            // Optional: log initial PC
            console.log('[ESP32Runner] Initial Core0 PC after reset: 0x' + this.cpu.cores[0].PC.toString(16));
        }
        
        // Setup serial UART0 output bridge
        if (this.cpu.uart && this.cpu.uart[0]) {
            this.cpu.uart[0].onTX = (byte: number) => {
                const char = String.fromCharCode(byte);
                if (this.onByteTransmitCb) {
                    this.onByteTransmitCb({ boardId: this.boardId, value: byte, char, source: 'uart0' });
                } else {
                    this.onStateUpdate({ type: 'serial', data: char, value: byte, boardId: this.boardId, source: 'uart0' });
                }
            };
        }

        // Instantiate workspace components
        (componentsDef || []).forEach(cDef => {
            const LogicClass = LOGIC_REGISTRY[cDef.type];
            if (LogicClass) {
                const pins = COMPONENT_PINS[cDef.type] || [{ id: 'A' }, { id: 'K' }, { id: 'GND' }, { id: 'VSS' }];
                const manifest = { type: cDef.type, attrs: cDef.attrs || {}, pins };
                const inst = new LogicClass(cDef.id, manifest);
                if (cDef.attrs) inst.state = { ...inst.state, ...cDef.attrs };
                inst.onTelemetryFinding = (finding: any) => {
                    this.onStateUpdate({
                        type: 'telemetry_finding',
                        boardId: this.boardId,
                        componentId: inst.id,
                        ...finding
                    });
                };
                this.instances.set(cDef.id, inst);
            }
        });

        this.buildNetlist();
        this.setupHooks();
        
        this.running = true;
        this.lastTime = performance.now();
        this.runLoop();
    }

    private buildNetlist() {
        const adj = new Map<string, string[]>();

        const addEdge = (a: string, b: string) => {
            if (!adj.has(a)) adj.set(a, []);
            if (!adj.has(b)) adj.set(b, []);
            adj.get(a)!.push(b);
            adj.get(b)!.push(a);
        };

        // Add wires to adjacency list
        for (const wire of this.currentWires) {
            addEdge(wire.from, wire.to);
        }

        // Add internal bridges (resistors, breadboards)
        for (const [id, inst] of this.instances) {
            const bridges = getInternalBridgesForComponent(id, inst.type);
            for (const bridge of bridges) {
                addEdge(bridge[0], bridge[1]);
            }
        }

        const visited = new Set<string>();
        let currentNet = 0;

        for (const startNode of adj.keys()) {
            if (!visited.has(startNode)) {
                const queue = [startNode];
                visited.add(startNode);
                while (queue.length > 0) {
                    const node = queue.shift()!;
                    this.pinToNet.set(node, currentNet);

                    const parts = node.split(':');
                    if (parts.length === 2) {
                        const compId = parts[0];
                        const pinId = parts[1];
                        const upperPin = pinId.toUpperCase();
                        
                        // Handle generic ESP32 pin aliases
                        if (!pinId.startsWith('D') && !pinId.startsWith('A') && /^\d+$/.test(pinId)) {
                            this.pinToNet.set(`${compId}:GPIO${pinId}`, currentNet);
                            this.pinToNet.set(`${compId}:D${pinId}`, currentNet);
                        } else if (pinId.startsWith('GPIO')) {
                            const num = pinId.substring(4);
                            this.pinToNet.set(`${compId}:${num}`, currentNet);
                            this.pinToNet.set(`${compId}:D${num}`, currentNet);
                        } else if (pinId.startsWith('D')) {
                            const num = pinId.substring(1);
                            this.pinToNet.set(`${compId}:${num}`, currentNet);
                            this.pinToNet.set(`${compId}:GPIO${num}`, currentNet);
                        }

                        // Normalize common board power aliases
                        if (upperPin === 'GND' || /^GND[._]?\d+$/.test(upperPin)) {
                            this.pinToNet.set(`${compId}:GND`, currentNet);
                            this.pinToNet.set(`${compId}:gnd_1`, currentNet);
                            this.pinToNet.set(`${compId}:gnd_2`, currentNet);
                            this.pinToNet.set(`${compId}:GND.1`, currentNet);
                            this.pinToNet.set(`${compId}:GND.2`, currentNet);
                            this.pinToNet.set(`${compId}:GND.3`, currentNet);
                        }
                        if (upperPin === '5V' || upperPin === 'VCC' || upperPin === '5V.1') {
                            this.pinToNet.set(`${compId}:5V`, currentNet);
                            this.pinToNet.set(`${compId}:VCC`, currentNet);
                        }
                        if (upperPin === '3V3' || upperPin === '3.3V') {
                            this.pinToNet.set(`${compId}:3V3`, currentNet);
                        }
                    }
                    
                    for (const neighbor of adj.get(node) || []) {
                        if (!visited.has(neighbor)) {
                            visited.add(neighbor);
                            queue.push(neighbor);
                        }
                    }
                }
                currentNet++;
            }
        }
    }

    private setupHooks() {
        if (!this.cpu) return;

        let lowImpRails = new Map<string, number>();

        const getLowImpedanceRails = (): Map<string, number> => {
            const rails = new Map<string, number>();
            const visited = new Set<string>();

            const normalizePin = (pinStr: string): string => {
                const parts = pinStr.split(':');
                if (parts.length >= 2) {
                    const compId = parts[0];
                    const pinId = parts.slice(1).join(':');
                    const upper = pinId.toUpperCase();
                    if (upper === 'GND' || /^GND[._:]?\d+$/.test(upper)) {
                        return `${compId}:GND`;
                    }
                    if (upper === '5V' || upper === 'VCC' || upper === '5V.1') {
                        return `${compId}:5V`;
                    }
                    if (upper === '3V3' || upper === '3V3_EN') {
                        return `${compId}:3V3`;
                    }
                    if (compId === this.boardId) {
                        if (upper.startsWith('GPIO') && /^\d+$/.test(upper.substring(4))) {
                            return `${compId}:${upper.substring(4)}`;
                        }
                        if (upper.startsWith('D') && /^\d+$/.test(upper.substring(1))) {
                            return `${compId}:${upper.substring(1)}`;
                        }
                    }
                }
                return pinStr;
            };

            const visit = (rawNode: string, v: number) => {
                const node = normalizePin(rawNode);
                if (visited.has(node)) return;
                visited.add(node);
                rails.set(node, v);

                // Traverse wires
                for (const wire of this.currentWires) {
                    const normFrom = normalizePin(wire.from);
                    const normTo = normalizePin(wire.to);
                    if (normFrom === node) {
                        visit(wire.to, v);
                    } else if (normTo === node) {
                        visit(wire.from, v);
                    }
                }

                // Traverse breadboard/vias bridges
                const [compId, compPin] = node.split(':');
                const inst = this.instances.get(compId);
                if (inst && (inst.type.includes('breadboard') || inst.type.includes('via') || inst.type.includes('wire'))) {
                    const bridges = getInternalBridgesForComponent(compId, inst.type);
                    for (const bridge of bridges) {
                        if (bridge[0] === `${compId}:${compPin}`) {
                            visit(bridge[1], v);
                        } else if (bridge[1] === `${compId}:${compPin}`) {
                            visit(bridge[0], v);
                        }
                    }
                }
            };

            // Start BFS from GND
            ['GND', 'GND.1', 'GND.2', 'GND.3'].forEach(pin => {
                visit(`${this.boardId}:${pin}`, 0.0);
            });
            // Start BFS from 5V/VIN
            ['5V', '5V.1', 'VIN'].forEach(pin => {
                visit(`${this.boardId}:${pin}`, 5.0);
            });
            // Start BFS from 3V3
            ['3V3'].forEach(pin => {
                visit(`${this.boardId}:${pin}`, 3.3);
            });

            // Start BFS from battery/power supply components
            this.instances.forEach((inst, compId) => {
                if (compId === this.boardId) return;
                if (inst.type.includes('power-supply') || inst.type.includes('battery')) {
                    Object.keys(inst.pins).forEach(pin => {
                        const v = inst.pins[pin]?.voltage ?? 0.0;
                        visit(`${compId}:${pin}`, v);
                    });
                }
            });

            return rails;
        };

        const updateOopPin = (boardPinStr: string, isHighOrVoltage: boolean | number, customCompId?: string) => {
            const voltage = typeof isHighOrVoltage === 'number' ? isHighOrVoltage : (isHighOrVoltage ? 3.3 : 0.0);
            const visitedEdges = new Set<string>();
            const visitedNodes = new Set<string>();

            const normalizePin = (pinStr: string): string => {
                const parts = pinStr.split(':');
                if (parts.length >= 2) {
                    const compId = parts[0];
                    const pinId = parts.slice(1).join(':');
                    const upper = pinId.toUpperCase();
                    if (upper === 'GND' || /^GND[._:]?\d+$/.test(upper)) {
                        return `${compId}:GND`;
                    }
                    if (upper === '5V' || upper === 'VCC' || upper === '5V.1') {
                        return `${compId}:5V`;
                    }
                    if (upper === '3V3' || upper === '3V3_EN') {
                        return `${compId}:3V3`;
                    }
                    if (compId === this.boardId) {
                        if (upper.startsWith('GPIO') && /^\d+$/.test(upper.substring(4))) {
                            return `${compId}:${upper.substring(4)}`;
                        }
                        if (upper.startsWith('D') && /^\d+$/.test(upper.substring(1))) {
                            return `${compId}:${upper.substring(1)}`;
                        }
                    }
                }
                return pinStr;
            };

            const visitNode = (rawNode: string, v: number) => {
                const node = normalizePin(rawNode);
                if (visitedNodes.has(node)) return;

                const [compId, compPin] = node.split(':');

                if (compId === this.boardId && rawNode !== `${this.boardId}:${boardPinStr}`) {
                    const upper = compPin.toUpperCase();
                    if (upper === 'GND' || /^GND[._:]?\d+$/.test(upper) || upper === '5V' || upper === '3V3' || upper === 'VIN') {
                        return;
                    }
                }

                const isCpuPinProp = !['GND', 'GND.1', 'GND.2', 'GND.3', '5V', '5V.1', 'VIN', '3V3'].includes(boardPinStr);
                if (isCpuPinProp && lowImpRails.has(node)) {
                    const railVoltage = lowImpRails.get(node)!;
                    const inst = this.instances.get(compId);
                    if (inst) {
                        if (!inst.pins[compPin]) inst.pins[compPin] = { voltage: 0, mode: 'INPUT' };
                        inst.setPinVoltage(compPin, railVoltage);
                    }
                    return;
                }

                visitedNodes.add(node);

                for (const wire of this.currentWires) {
                    const normFrom = normalizePin(wire.from);
                    const normTo = normalizePin(wire.to);
                    const edgeKey = `${normFrom}|${normTo}`;
                    if (visitedEdges.has(edgeKey)) continue;
                    if (normFrom === node || normTo === node) {
                        visitedEdges.add(edgeKey);
                        const nextNode = normFrom === node ? wire.to : wire.from;
                        visitNode(nextNode, v);
                    }
                }

                const inst = this.instances.get(compId);
                if (inst) {
                    if (!inst.pins[compPin]) inst.pins[compPin] = { voltage: 0, mode: 'INPUT' };
                    inst.setPinVoltage(compPin, v);
                    this.circuitDirty = true;
                    if (this.cpu) {
                        inst.onPinStateChange(compPin, v > 1.8, this.cpu.cycles);
                    }

                    // Propagate external voltage back to simulated ESP32 CPU pin
                    if (compId === this.boardId) {
                        const isHigh = v > 1.8;
                        this.pinStates[compPin] = isHigh;
                        const pinNum = parseInt(compPin.replace(/\D/g, ''), 10);
                        if (!isNaN(pinNum) && pinNum >= 0 && pinNum < 40) {
                            const pinObj = this.cpu!.gpio.pins[pinNum];
                            if (pinObj && pinObj.inputValue !== isHigh) {
                                pinObj.inputValue = isHigh;
                            }
                        }
                    }

                    this.traversePassive(inst, compId, compPin, v, (forwardNode, nextV) => {
                        visitNode(forwardNode, nextV);
                    });
                }
            };

            const startCompId = customCompId || this.boardId;
            visitNode(`${startCompId}:${boardPinStr}`, voltage);
        };

        this.repropagateAllVoltages = () => {
            lowImpRails = getLowImpedanceRails();
            
            // Set output pins from ESP32 CPU state
            if (this.cpu) {
                for (let i = 0; i < 40; i++) {
                    const pin = this.cpu.gpio.pins[i];
                    if (pin) {
                        if (pin.state === 0) {
                            updateOopPin(String(i), false);
                        } else if (pin.state === 1) {
                            updateOopPin(String(i), true);
                        } else if (pin.state === 3) {
                            updateOopPin(String(i), true); // Weak pull-up
                        } else if (pin.state === 4) {
                            updateOopPin(String(i), false); // Weak pull-down
                        }
                        // State 2 is High-Z, so we do NOT drive the bus to 0V.
                        // This allows internal pull-ups like GPIO0 to keep their value and boot properly.
                    }
                }
            }

            // Power pins
            ['GND', 'GND.1', 'GND.2', 'GND.3'].forEach(pin => {
                updateOopPin(pin, 0.0);
            });
            ['5V', '5V.1', 'VIN'].forEach(pin => {
                updateOopPin(pin, 5.0);
            });
            ['3V3'].forEach(pin => {
                updateOopPin(pin, 3.3);
            });

            // Battery / external power
            this.instances.forEach((inst, compId) => {
                if (compId === this.boardId) return;
                if (inst.type.includes('power-supply') || inst.type.includes('battery')) {
                    if (inst.pins['GND']) updateOopPin('GND', 0.0, compId);
                    if (inst.pins['5V']) updateOopPin('5V', inst.pins['5V'].voltage, compId);
                    if (inst.pins['VCC']) updateOopPin('VCC', inst.pins['VCC'].voltage, compId);
                    if (inst.pins['3V3']) updateOopPin('3V3', inst.pins['3V3'].voltage, compId);
                }
            });
        };

        // Hook all ESP32 GPIO pin state changes
        for (let i = 0; i < 40; i++) {
            const pin = this.cpu.gpio.pins[i];
            if (pin) {
                const unsubscribe = pin.addListener((newState) => {
                    const pinName = String(i);
                    const isHigh = newState === 1 || newState === 3;
                    if (this.pinStates[pinName] !== isHigh) {
                        this.pinStates[pinName] = isHigh;
                        this.pinsChanged = true;
                        this.circuitDirty = true;
                        
                        const boardInst = this.instances.get(this.boardId);
                        if (boardInst) {
                            boardInst.onPinStateChange(pinName, isHigh, this.cpu!.cycles);
                        }
                        updateOopPin(pinName, isHigh);
                    }
                });
                this.activeListeners.push(unsubscribe);
            }
        }
    }

    private traversePassive(inst: BaseComponent, compId: string, pinId: string, voltage: number, visit: (target: string, nextVoltage: number) => void) {
        if (inst.type === 'openhw-resistor' || inst.type === 'wokwi-resistor') {
            const otherPin = pinId === 'p1' ? 'p2' : pinId === 'p2' ? 'p1' : null;
            if (!otherPin) return;
            const resistance = Number.parseFloat(String((inst as any).state?.value || (inst as any).state?.resistance || 1000));
            const safeResistance = Number.isFinite(resistance) && resistance > 0 ? resistance : 1000;
            const drop = Math.min(voltage * 0.2, Math.max(0.01, safeResistance / 5000));
            const nextVoltage = Math.max(0, voltage - drop);
            inst.setPinVoltage(otherPin, nextVoltage);
            visit(`${compId}:${otherPin}`, nextVoltage);
        } else if (inst.type === 'openhw-led' || inst.type === 'wokwi-led') {
            if (pinId === 'A') {
                const nextV = Math.max(0, voltage - 1.8);
                inst.setPinVoltage('K', nextV);
                visit(`${compId}:K`, nextV);
            }
        } else if (inst.type === 'openhw-pushbutton' || inst.type === 'wokwi-pushbutton') {
            if (pinId === '1l' || pinId === '1') {
                inst.setPinVoltage('1r', voltage);
                visit(`${compId}:1r`, voltage);
                inst.setPinVoltage('1', voltage);
                visit(`${compId}:1`, voltage);
                inst.setPinVoltage('1l', voltage);
                visit(`${compId}:1l`, voltage);
            } else if (pinId === '1r') {
                inst.setPinVoltage('1l', voltage);
                visit(`${compId}:1l`, voltage);
                inst.setPinVoltage('1', voltage);
                visit(`${compId}:1`, voltage);
            } else if (pinId === '2l' || pinId === '2') {
                inst.setPinVoltage('2r', voltage);
                visit(`${compId}:2r`, voltage);
                inst.setPinVoltage('2', voltage);
                visit(`${compId}:2`, voltage);
                inst.setPinVoltage('2l', voltage);
                visit(`${compId}:2l`, voltage);
            } else if (pinId === '2r') {
                inst.setPinVoltage('2l', voltage);
                visit(`${compId}:2l`, voltage);
                inst.setPinVoltage('2', voltage);
                visit(`${compId}:2`, voltage);
            }

            if (inst.state?.pressed) {
                if (pinId.startsWith('1')) {
                    inst.setPinVoltage('2l', voltage);
                    visit(`${compId}:2l`, voltage);
                    inst.setPinVoltage('2r', voltage);
                    visit(`${compId}:2r`, voltage);
                    inst.setPinVoltage('2', voltage);
                    visit(`${compId}:2`, voltage);
                } else if (pinId.startsWith('2')) {
                    inst.setPinVoltage('1l', voltage);
                    visit(`${compId}:1l`, voltage);
                    inst.setPinVoltage('1r', voltage);
                    visit(`${compId}:1r`, voltage);
                    inst.setPinVoltage('1', voltage);
                    visit(`${compId}:1`, voltage);
                }
            }
        } else if (inst.type.includes('breadboard') || inst.type.includes('via') || inst.type.includes('wire')) {
            const bridges = getInternalBridgesForComponent(compId, inst.type);
            for (const bridge of bridges) {
                if (bridge[0] === `${compId}:${pinId}`) visit(bridge[1], voltage);
                else if (bridge[1] === `${compId}:${pinId}`) visit(bridge[0], voltage);
            }
        }
    }

    private runLoop = () => {
        if (!this.running || !this.cpu) return;

        const loopStart = performance.now();
        const now = performance.now();
        const deltaTime = now - this.lastTime;
        
        const loopCount = (this as any)._runLoopCount || 0;
        (this as any)._runLoopCount = loopCount + 1;

        if (deltaTime > 0) {
            const F_CPU = 125_000_000;
            const cyclesPerMs = (F_CPU / 1000) * this.speed;
            const cyclesToRun = deltaTime * cyclesPerMs;
            
            // Limit the cycles per frame to protect execution thread (cap at max 80,000 steps to prevent blocking)
            const CYCLES_PER_FRAME = Math.floor(Math.min(cyclesToRun, 80000 * Math.max(1, this.speed)));

            let cyclesDone = 0;
            const componentUpdateThreshold = 25000; // ~200us simulated time step
            
            const instArray = Array.from(this.instances.values());
            const physicsInterval = this.speed > 1.0 ? 8 : 12; // ~80-120Hz
            const shouldSolvePhysics = this.circuitDirty || (now - this.lastPhysicsSolveAt) >= physicsInterval;

            // Periodic diagnostic log for CPU cycles execution
            const cyclesBefore = this.cpu.cycles;
            if (((this as any)._runLoopCount || 0) % 50 === 0) {
                const core0 = this.cpu.cores?.[0];
                let pcVal = 0;
                if (core0) {
                    pcVal = core0.PC ?? core0.pc ?? (typeof core0.getPC === 'function' ? core0.getPC() : 0);
                }
                const pcHex = pcVal.toString(16);
                console.log(`[ESP32Runner Worker runLoop] PC: 0x${pcHex} | Cycles: ${this.cpu.cycles} | Stopped: ${this.cpu.stopped}`);
                if (!pcVal && core0) {
                    console.log(`[ESP32Runner Worker] core0 keys: ${Object.keys(core0).join(',')} | prototype keys: ${Object.getOwnPropertyNames(Object.getPrototypeOf(core0)).join(',')}`);
                }
            }

            while (cyclesDone < CYCLES_PER_FRAME && this.running && this.cpu) {
                const chunkTarget = Math.min(CYCLES_PER_FRAME, cyclesDone + componentUpdateThreshold);
                
                while (cyclesDone < chunkTarget && this.running) {
                    this.cpu.step();
                    cyclesDone++;
                }

                // Component updates for smooth animation
                let anyStateChanged = false;
                instArray.forEach(inst => {
                    inst.update(this.cpu!.cycles, this.currentWires, instArray);
                    if (inst.stateChanged) {
                        anyStateChanged = true;
                        (inst as any).pendingVisualStateEmit = true;
                        inst.stateChanged = false;
                    }
                });
                if (anyStateChanged && typeof this.repropagateAllVoltages === 'function') {
                    this.repropagateAllVoltages();
                }
            }



            this.lastTime = now;
            if (shouldSolvePhysics) {
                if (typeof this.repropagateAllVoltages === 'function') {
                    this.repropagateAllVoltages();
                }
                this.lastPhysicsSolveAt = now;
                this.circuitDirty = false;
            }

            // Pace Serial RX (bytes per millisecond = baudRate / 10000)
            const bytesPerMs = this.serialBaudRate / 10000;
            this.serialByteBudget += deltaTime * bytesPerMs;

            if (this.serialBuffer.length > 0 && this.cpu.uart && this.cpu.uart[0] && this.serialByteBudget >= 1) {
                const maxBytes = Math.floor(this.serialByteBudget);
                const toSend = Math.min(maxBytes, this.serialBuffer.length);
                for (let i = 0; i < toSend; i++) {
                    const val = this.serialBuffer.shift()!;
                    this.cpu.uart[0].feedByte(val);
                }
                this.serialByteBudget -= toSend;
            }
        }

        setTimeout(this.runLoop, 1);
    };

    serialRx(data: string) {
        for (let i = 0; i < data.length; i++) {
            this.serialBuffer.push(data.charCodeAt(i) & 0xff);
        }
    }

    serialRxByte(value: number) {
        this.serialBuffer.push(value & 0xff);
    }

    setSerialBaudRate(baud: number) {
        this.serialBaudRate = baud;
    }

    getSerialBaudRate() {
        return this.serialBaudRate;
    }

    setSpeed(speed: number) {
        this.speed = speed;
    }

    setSolverMode(mode: 'logic') {
        this.solverMode = mode;
    }

    setTelemetryEnabled(enabled: boolean, mode?: string, watchedParamsMap?: Record<string, string[]>, deepSilicon?: boolean) {
        for (const inst of this.instances.values()) {
            inst.telemetryEnabled = !!enabled;
            inst.telemetryMode = mode || 'detail';
            inst.telemetryWatchedParams = watchedParamsMap?.[inst.id] || ['all'];
            inst.deepSiliconEnabled = !!deepSilicon;
        }
    }

    getRichTelemetrySnapshot(options: { mode?: 'standard' | 'deep' | 'delta' } = {}) {
        const components: any[] = [];
        const mode = options.mode || 'deep';

        for (const inst of this.instances.values()) {
            if (mode === 'standard') {
                const data = (inst as any).getTelemetryData?.() || getUnifiedComponentSyncState(inst);
                components.push({
                    id: inst.id,
                    ...data
                });
            } else if (mode === 'delta') {
                components.push(inst.getDeltaMetrics());
            } else {
                components.push(inst.getRawMetrics());
            }
        }
        return {
            boardId: this.boardId,
            components,
            capturedAt: new Date().toISOString(),
            mode,
            isDelta: mode === 'delta'
        };
    }

    getSimulatedTimeMs() {
        if (!this.cpu) return 0;
        return Math.floor((this.cpu.cycles / 125_000_000) * 1000);
    }

    private shouldEmitComponentState(componentId: string, state: any, nowMs: number): boolean {
        const policy = getComponentStateSyncPolicy(state);
        const prev = this.componentSyncMeta.get(componentId);
        if (policy.minIntervalMs > 0 && prev && (nowMs - prev.lastSentAt) < policy.minIntervalMs) {
            return false;
        }
        this.componentSyncMeta.set(componentId, { lastSentAt: nowMs, lastWeight: policy.weight });
        return true;
    }



    public forceEmitState() {
        if (!this.cpu) return;
        const now = performance.now();
        const msg: any = { type: 'state', boardId: this.boardId };
        msg.pins = this.pinStates;
        this.pinsChanged = false;

        const compStates: Array<{ id: string; state: any }> = [];
        for (const inst of this.instances.values()) {
            const pendingEmit = (inst as any).pendingVisualStateEmit;
            if (!inst.stateChanged && !pendingEmit && !inst.telemetryEnabled) continue;

            const syncState = getUnifiedComponentSyncState(inst);
            if (!this.shouldEmitComponentState(inst.id, syncState, now)) continue;

            inst.stateChanged = false;
            (inst as any).pendingVisualStateEmit = false;

            compStates.push({
                id: inst.id,
                type: inst.type,
                state: syncState,
                ...collectComponentTelemetry(inst, undefined, this.cpu),
            });
        }

        // Also emit telemetry for the ESP32 CPU / Board
        const boardSyncState = { pins: this.pinStates };
        if (this.shouldEmitComponentState(this.boardId, boardSyncState, now)) {
            // Mock a component for the ESP32 CPU to collect its telemetry
            const cpuInst = {
                id: this.boardId,
                type: 'board-esp32',
                telemetryEnabled: (this as any).boardTelemetryEnabled || false,
                telemetryMode: (this as any).boardTelemetryMode || 'detail',
                telemetryWatchedParams: (this as any).boardTelemetryWatchedParams || ['all'],
                deepSiliconEnabled: (this as any).boardDeepSiliconEnabled || false,
            };
            if (cpuInst.telemetryEnabled) {
                compStates.push({
                    id: this.boardId,
                    type: 'board-esp32',
                    state: boardSyncState,
                    ...collectComponentTelemetry(cpuInst, undefined, this.cpu)
                });
            }
        }

        msg.components = compStates;

        this.statusIntervalEmitCount++;
        msg._emitSeq = this.statusIntervalEmitCount;
        msg._emitTime = now;
        msg.simTimeMs = this.getSimulatedTimeMs();

        this.onStateUpdate(msg);
    }

    stop() {
        this.running = false;
        this.activeListeners.forEach(unsubscribe => unsubscribe());
        this.activeListeners = [];
    }
}
