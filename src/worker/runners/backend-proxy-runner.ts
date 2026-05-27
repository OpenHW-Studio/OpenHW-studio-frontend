import { BaseComponent } from '@openhw/emulator';
import {
    getComponentStateSyncPolicy,
    collectComponentTelemetry,
    getUnifiedComponentSyncState,
    collectNeopixelShutdownStates,
    invokeOptional,
    LOGIC_REGISTRY,
    COMPONENT_PINS,
    collectConnectedComponentPins,
} from '../registries/component-registry.ts';
import type { BoardRunner } from '../registries/component-registry.ts';

export class BackendProxyRunner implements BoardRunner {
    cpu: any = null;
    serialBaudRate: number = 115200;
    running: boolean = false;
    currentWires: any[] = [];
    instances: Map<string, BaseComponent> = new Map();
    lastTime: number = 0;
    statusInterval: any;
    pinsChanged: boolean = true;
    boardId: string;
    solverMode: 'logic' = 'logic';

    private readonly onStateUpdate: (state: any) => void;
    private netToNode = new Map<number, number>();
    private pinToNet = new Map<string, number>();

    serialRx(data: string) {
        // Proxy board handles serial connection via backend WebSocket.
    }

    serialRxByte(value: number) {
        // No-op
    }

    setSerialBaudRate(baud: number) {
        this.serialBaudRate = baud;
    }

    getSerialBaudRate(): number {
        return this.serialBaudRate;
    }

    setSpeed(speed: number) {
        // No-op
    }

    setSolverMode(mode: 'logic') {
        this.solverMode = mode;
    }
    
    // Maintain proxy state
    private proxyPinStates = new Map<string, boolean>();
    private proxyPinReadStates = new Map<string, boolean>();
    private proxySimulatedCycles: number = 0;
    private runLoopTimer: any = null;
    private lastStateEmitTime: number = 0;
    private lastPinToggleTime = new Map<string, number>();

    constructor(
        hexData: string,
        componentsDef: any[],
        wiresDef: any[],
        onStateUpdate: (state: any) => void,
        options: any = {}
    ) {
        this.onStateUpdate = onStateUpdate;
        this.currentWires = wiresDef || [];
        this.boardId = componentsDef?.find(c => /(esp32|stm32)/i.test(c?.type || ''))?.id || 'proxy_board';

        // Initialize components
        for (const compDef of componentsDef) {
            const RegistryClass = LOGIC_REGISTRY[compDef.type];
            const pins = COMPONENT_PINS[compDef.type] || [{ id: 'A' }, { id: 'K' }, { id: 'GND' }, { id: 'VSS' }];
            const manifest = { type: compDef.type, attrs: compDef.attrs || {}, pins };

            if (RegistryClass) {
                try {
                    // TODO: Clean up or adjust this component instantiation logic in future if needed
                    const inst = new RegistryClass(compDef.id, manifest);
                    if (compDef.attrs) inst.state = { ...inst.state, ...compDef.attrs };
                    this.instances.set(compDef.id, inst);
                } catch (err) {
                    console.error(`Failed to init ${compDef.type}:`, err);
                }
            } else if (/(esp32|stm32)/i.test(compDef.type)) {
                try {
                    // TODO: Clean up generic board instantiation if necessary
                    const inst = new BaseComponent(compDef.id, manifest) as any;
                    if (compDef.attrs) inst.state = { ...inst.state, ...compDef.attrs };
                    this.instances.set(compDef.id, inst);
                } catch (err) {
                    console.error(`Failed to init board ${compDef.type}:`, err);
                }
            }
        }

        this.buildNetIndex();
    }

    private buildNetIndex() {
        this.pinToNet.clear();
        this.netToNode.clear();
        let currentNet = 1;
        for (const wire of this.currentWires) {
            const { from, to } = wire;
            const net1 = this.pinToNet.get(from);
            const net2 = this.pinToNet.get(to);

            if (net1 === undefined && net2 === undefined) {
                this.pinToNet.set(from, currentNet);
                this.pinToNet.set(to, currentNet);
                currentNet++;
            } else if (net1 !== undefined && net2 === undefined) {
                this.pinToNet.set(to, net1);
            } else if (net1 === undefined && net2 !== undefined) {
                this.pinToNet.set(from, net2);
            } else if (net1 !== undefined && net2 !== undefined && net1 !== net2) {
                for (const [key, val] of this.pinToNet) {
                    if (val === net2) {
                        this.pinToNet.set(key, net1);
                    }
                }
            }
        }
    }

    public execute() {
        this.setupHooks();
        this.running = true;
        this.lastTime = performance.now();
        this.runLoop();
    }

    public stop() {
        this.running = false;
        if (this.statusInterval) clearInterval(this.statusInterval);
        if (this.runLoopTimer) clearTimeout(this.runLoopTimer);
    }

    // Public method to be called by worker.onmessage when backend sends GPIO sync
    public syncGpio(pin: string, isHigh: boolean) {
        console.log(`[BackendProxyRunner] syncGpio pin=${pin} isHigh=${isHigh}`);
        this.proxyPinStates.set(String(pin), isHigh);
        this.pinsChanged = true;

        const boardInst = this.instances.get(this.boardId);
        if (boardInst) {
            const valNum = isHigh ? 1 : 0;
            const pinNum = parseInt(pin, 10);

            // 1. Digital Pin state & toggles inside BaseComponent
            if (!boardInst.pins[pin]) {
                boardInst.pins[pin] = { voltage: 0, mode: 'INPUT' };
            }
            const prevVoltage = boardInst.pins[pin].voltage;
            const currentVoltage = isHigh ? 3.3 : 0.0;
            boardInst.pins[pin].voltage = currentVoltage;

            const runtime = (boardInst as any).telemetryRuntime;
            if (runtime) {
                if (!runtime.pinLogicLevels) runtime.pinLogicLevels = {};
                if (!runtime.pinToggles) runtime.pinToggles = {};
                if (!runtime.io) runtime.io = {
                    i2cTransactions: 0,
                    i2cBytes: 0,
                    spiTransactions: 0,
                    spiBytes: 0,
                    uartBytes: 0,
                    pwmCount: 0,
                    oneWireCount: 0,
                    pioCount: 0,
                    i2sCount: 0,
                    recentI2c: [],
                    recentSpi: [],
                };

                runtime.pinLogicLevels[pin] = isHigh;

                const prevLevel = prevVoltage > 1.8;
                if (prevLevel !== isHigh) {
                    runtime.pinToggles[pin] = (runtime.pinToggles[pin] || 0) + 1;
                }

                // 2. Custom backendDataReceived dashboard state
                if (!boardInst.state) boardInst.state = {};
                if (!boardInst.state.backendDataReceived) {
                    boardInst.state.backendDataReceived = {
                        digital: { totalToggles: 0, lastActivePin: 'none', lastActiveValue: 0 },
                        analog: { lastActivePin: 'none', lastActiveVoltage: 0.0 },
                        i2c: { sdaToggles: 0, sclToggles: 0, estimatedBytes: 0 },
                        spi: { mosiToggles: 0, sckToggles: 0, estimatedBytes: 0 },
                        pwm: { totalToggles: 0, detectedPwmPins: [] },
                        i2s: { bckToggles: 0, wsToggles: 0, estimatedFrames: 0 }
                    };
                }
                const bdr = boardInst.state.backendDataReceived;

                if (prevLevel !== isHigh) {
                    bdr.digital.totalToggles++;
                    bdr.digital.lastActivePin = `GPIO ${pin}`;
                    bdr.digital.lastActiveValue = valNum;
                }

                // High speed toggling -> PWM detection
                const now = performance.now();
                const lastToggle = this.lastPinToggleTime.get(pin) || 0;
                const timeDiff = now - lastToggle;
                this.lastPinToggleTime.set(pin, now);

                if (prevLevel !== isHigh && lastToggle > 0 && timeDiff < 80) {
                    bdr.pwm.totalToggles++;
                    runtime.io.pwmCount = (runtime.io.pwmCount || 0) + 1;
                    if (!bdr.pwm.detectedPwmPins.includes(pin)) {
                        bdr.pwm.detectedPwmPins.push(pin);
                    }
                }

                // SDA (21) or SCL (22) -> I2C
                if (pinNum === 21 || pinNum === 22) {
                    if (prevLevel !== isHigh) {
                        if (pinNum === 21) bdr.i2c.sdaToggles++;
                        if (pinNum === 22) bdr.i2c.sclToggles++;
                        bdr.i2c.estimatedBytes = Math.floor((bdr.i2c.sdaToggles + bdr.i2c.sclToggles) / 9);
                        runtime.io.i2cBytes = bdr.i2c.estimatedBytes;
                        runtime.io.i2cTransactions = Math.floor(bdr.i2c.estimatedBytes / 4) + 1;

                        if (runtime.io.recentI2c.length < 16) {
                            runtime.io.recentI2c.push(isHigh ? 0x01 : 0x00);
                        } else {
                            runtime.io.recentI2c.shift();
                            runtime.io.recentI2c.push(isHigh ? 0x01 : 0x00);
                        }
                        runtime.lastIoAtMs = Date.now();
                    }
                }

                // MOSI (23), MISO (19), SCK (18), CS (5) -> SPI
                if (pinNum === 23 || pinNum === 19 || pinNum === 18 || pinNum === 5) {
                    if (prevLevel !== isHigh) {
                        if (pinNum === 23) bdr.spi.mosiToggles++;
                        if (pinNum === 18) bdr.spi.sckToggles++;
                        bdr.spi.estimatedBytes = Math.floor((bdr.spi.mosiToggles + bdr.spi.sckToggles) / 16);
                        runtime.io.spiBytes = bdr.spi.estimatedBytes;
                        runtime.io.spiTransactions = Math.floor(bdr.spi.estimatedBytes / 2) + 1;

                        if (runtime.io.recentSpi.length < 16) {
                            runtime.io.recentSpi.push(isHigh ? 0xFF : 0x00);
                        } else {
                            runtime.io.recentSpi.shift();
                            runtime.io.recentSpi.push(isHigh ? 0xFF : 0x00);
                        }
                        runtime.lastIoAtMs = Date.now();
                    }
                }

                // WS (25), BCK (26) -> I2S
                if (pinNum === 25 || pinNum === 26) {
                    if (prevLevel !== isHigh) {
                        if (pinNum === 25) bdr.i2s.wsToggles++;
                        if (pinNum === 26) bdr.i2s.bckToggles++;
                        bdr.i2s.estimatedFrames = Math.floor(bdr.i2s.wsToggles / 2);
                        runtime.io.i2sCount = bdr.i2s.estimatedFrames;
                        runtime.lastIoAtMs = Date.now();
                    }
                }

                // ADC Pins (32-36, 39) -> Analog
                if ([32, 33, 34, 35, 36, 39].includes(pinNum)) {
                    bdr.analog.lastActivePin = `GPIO ${pin}`;
                    bdr.analog.lastActiveVoltage = currentVoltage;
                }
            }
        }
    }
    
    public syncSerial(char: string) {
        this.onStateUpdate({ type: 'serial', data: char, boardId: this.boardId, source: 'backend' });

        const boardInst = this.instances.get(this.boardId);
        if (boardInst) {
            const runtime = (boardInst as any).telemetryRuntime;
            if (runtime) {
                if (!runtime.io) runtime.io = {
                    i2cTransactions: 0,
                    i2cBytes: 0,
                    spiTransactions: 0,
                    spiBytes: 0,
                    uartBytes: 0,
                    pwmCount: 0,
                    oneWireCount: 0,
                    pioCount: 0,
                    i2sCount: 0,
                    recentI2c: [],
                    recentSpi: [],
                };
                runtime.io.uartBytes = (runtime.io.uartBytes || 0) + 1;
                runtime.lastIoAtMs = Date.now();
            }
        }
    }

    public syncI2cTransaction(addr: number, data: number[]) {
        console.log(`[BackendProxyRunner] Routing I2C transaction for addr 0x${addr.toString(16)} with ${data.length} bytes`);
        const i2cDevices = Array.from(this.instances.values()).filter(inst => 
            (inst as any).onI2CStart || (inst as any).onI2CByte
        );
        for (const dev of i2cDevices) {
            if (typeof (dev as any).onI2CStart === 'function') {
                (dev as any).onI2CStart(addr, false);
            }
            if (typeof (dev as any).onI2CByte === 'function') {
                for (const byte of data) {
                    (dev as any).onI2CByte(-1, byte);
                }
            }
            if (typeof (dev as any).onI2CStop === 'function') {
                (dev as any).onI2CStop();
            }
        }
    }

    public syncPwm(channel: number, duty_pct: number) {
        // Find connected components mapped to this PWM channel (duty is 0.0 to 1.0)
        // Usually, PWM duty comes in as 0-100 or 0.0-1.0. Assuming 0.0-1.0
        const pwmDuty = Math.max(0, Math.min(1.0, duty_pct));
        for (const conn of this.connections) {
            if (conn.fromComponent === this.boardId) {
                // Determine if this pin maps to the PWM channel (requires pin mapping logic or broadcasting)
                // For proxy simplicity, we broadcast PWM to devices that implement onPWM
                const targetId = conn.toComponent;
                const targetInst = this.instances.get(targetId);
                if (targetInst && typeof (targetInst as any).onPWM === 'function') {
                    // Normalize to whatever scale the component expects (e.g. 0-255 or 0-1.0)
                    // If component expects 0-255:
                    (targetInst as any).onPWM(pwmDuty * 255);
                }
            }
        }
    }

    public syncTone(pin: string, frequency: number, duration: number) {
        console.log(`[BackendProxyRunner] Routing Tone for pin ${pin}, freq ${frequency}, dur ${duration}`);

        const aliases = [pin];
        if (/^\d+$/.test(pin)) {
            aliases.push(`D${pin}`, `GPIO${pin}`);
        } else if (/^(D|GPIO)(\d+)$/i.test(pin)) {
            const num = pin.replace(/\D/g, '');
            aliases.push(num, `D${num}`, `GPIO${num}`);
        }

        const endpoints = collectConnectedComponentPins(
            this.boardId,
            aliases,
            this.currentWires,
            this.instances
        );

        if (endpoints.length === 0) {
            // Fallback: if not wired/routed via net but a buzzer exists, control it directly
            const buzzers = Array.from(this.instances.values()).filter(inst => 
                inst.type === 'openhw-buzzer' || inst.type === 'wokwi-buzzer'
            );
            if (buzzers.length === 1) {
                endpoints.push({ inst: buzzers[0], pinId: '1' });
            }
        }

        const isSilent = (frequency === 0);
        const pulseUs = !isSilent ? (1000000 / frequency) / 2 : 0;
        const periodUs = !isSilent ? (1000000 / frequency) : 0;

        const meta = {
            protocol: 'pwm',
            boardPin: pin,
            isHigh: !isSilent,
            frequencyHz: frequency,
            dutyCycle: !isSilent ? 0.5 : 0,
            pulseUs,
            periodUs,
            source: 'gpio',
            cycles: this.proxySimulatedCycles,
        };

        for (const endpoint of endpoints) {
            const inst = endpoint.inst;
            if (isSilent) {
                inst.setState({
                    isBuzzing: false,
                    frequency: 0,
                    current: 0,
                    voltageDrop: 0
                });
                (inst as any)._isToneBypassed = false;
            } else {
                (inst as any)._isToneBypassed = true;
                
                // Route through the component's protocol handler hooks where available,
                // matching how AVR and RP2040 runners trigger buzzer updates.
                if (typeof (inst as any).onPWMSignal === 'function') {
                    (inst as any).onPWMSignal(endpoint.pinId, frequency, 0.5, pulseUs);
                } else if (typeof (inst as any).onPWM === 'function') {
                    (inst as any).onPWM(endpoint.pinId, meta);
                } else {
                    inst.setState({
                        isBuzzing: true,
                        frequency: frequency,
                        voltageDrop: 3.3,
                        current: 0.015
                    });
                }
            }

            if (typeof (inst as any).onCustomTelemetry === 'function') {
                (inst as any).onCustomTelemetry();
            }
            this.pinsChanged = true;
        }
    }

    public syncSpiBatch(b64: string) {
        try {
            this.updatePhysicsInternal();
            const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
            const spiDevices = Array.from(this.instances.values()).filter(inst => 
                typeof (inst as any).onSPIByte === 'function'
            );
            for (const dev of spiDevices) {
                for (let i = 0; i < bytes.length; i++) {
                    (dev as any).onSPIByte(bytes[i]);
                }
            }
        } catch (e) {
            console.warn('Failed to parse SPI batch in BackendProxyRunner', e);
        }
    }

    public syncNeopixel(channel: number, pixels: any[]) {
        const neopixelComps = Array.from(this.instances.values()).filter(inst => 
            inst.type.toLowerCase().includes('neopixel') || inst.type.toLowerCase().includes('ws2812')
        );
        for (const comp of neopixelComps) {
            if (typeof (comp as any).updatePixels === 'function') {
                (comp as any).updatePixels(pixels);
            } else if (typeof (comp as any).onWS2812BByte === 'function') {
                // fallback to byte emulation if updatePixels isn't available
                for (const p of pixels) {
                    (comp as any).onWS2812BByte(p.g);
                    (comp as any).onWS2812BByte(p.r);
                    (comp as any).onWS2812BByte(p.b);
                }
            } else {
                // Direct state injection for basic neopixel components
                (comp as any).pixels = pixels;
            }
        }
    }

    public syncAdc(channel: number, val: number) {
        // ADC values from backend are often injected directly to the pin
        // But if needed we can broadcast
    }

    private runLoop = () => {
        if (!this.running) return;

        const now = performance.now();
        const dt = Math.min(now - this.lastTime, 50); // Cap dt
        this.lastTime = now;
        
        // Approximate cycles (Assume 1MHz proxy clock just for ticking Wokwi components)
        const dtCycles = Math.floor(dt * 1000);
        this.proxySimulatedCycles += dtCycles;

        // Always run physics propagation to support button presses and slider inputs instantly.
        // TODO: Optimize if necessary, but is very fast for small proxy board layouts.
        this.updatePhysicsInternal();

        // Tick and update all components (e.g. LEDs, LCDs, etc.)
        const instArray = Array.from(this.instances.values());
        for (const inst of instArray) {
            if (typeof (inst as any).tick === 'function') {
                (inst as any).tick();
            }
            // TODO: Ensure components update their internal states with the simulated cycles, wires, and other instances
            inst.update(this.proxySimulatedCycles, this.currentWires, instArray);
        }

        // Emit telemetry state back to React
        if (now - this.lastStateEmitTime > 32) {
            const compStates: any[] = [];
            for (const inst of this.instances.values()) {
                const syncState = getUnifiedComponentSyncState(inst);
                if (syncState) {
                    compStates.push({
                        id: inst.id,
                        type: inst.type,
                        state: syncState,
                        ...collectComponentTelemetry(inst, undefined, null)
                    });
                }
            }
            if (compStates.length > 0) {
                this.onStateUpdate({ type: 'state', boardId: this.boardId, components: compStates });
            }
            this.lastStateEmitTime = now;
        }

        this.runLoopTimer = setTimeout(this.runLoop, 16); // 60fps loop
    };

    private setupHooks() {
        // We can wire up any I2C/SPI hooks here if needed in the future,
        // but for now, simple GPIO routing relies on physics update.
    }

    private updatePhysicsInternal() {
        // Reset all voltages
        for (const inst of this.instances.values()) {
            for (const pinId of Object.keys((inst as any).pins || {})) {
                (inst as any).setPinVoltage?.(pinId, 0);
            }
        }

        // Apply ground and VCC to components natively
        for (const inst of this.instances.values()) {
            Object.keys((inst as any).pins || {}).forEach((pinKey) => {
                const upper = pinKey.toUpperCase();
                if (upper === 'GND' || upper === 'AGND' || upper === 'VSS' || upper.startsWith('GND_') || upper === 'K') {
                    (inst as any).setPinVoltage?.(pinKey, 0.0);
                }
                if (upper === '3V3' || upper === 'VCC' || upper.startsWith('3V3.')) {
                    (inst as any).setPinVoltage?.(pinKey, 3.3);
                }
            });
        }

        // Propagate Proxy Board Pins
        for (const [pinStr, isHigh] of this.proxyPinStates.entries()) {
            // Check common pin names (just pin number, or D{pin}, or GPIO{pin})
            const pinVariants = [pinStr, `D${pinStr}`, `GPIO${pinStr}`];
            let compPinId = pinVariants[0];
            
            // Find which variant is physically wired
            for (const pv of pinVariants) {
                if (this.pinToNet.has(`${this.boardId}:${pv}`)) {
                    compPinId = pv;
                    break;
                }
            }

            const voltage = isHigh ? 3.3 : 0.0;
            const boardInst = this.instances.get(this.boardId);
            if (boardInst) {
                (boardInst as any).setPinVoltage?.(compPinId, voltage);
                // Directly propagate from the board pin to all connected endpoints in the net list
                this.visitNode(`${this.boardId}:${compPinId}`, voltage);
            }
        }

        // Read back incoming states
        const boardInst = this.instances.get(this.boardId);
        if (boardInst) {
            for (const pinId of Object.keys((boardInst as any).pins || {})) {
                if (/^(D?\d+|GPIO\d+)$/.test(pinId)) {
                    const pinNum = pinId.replace(/\D/g, '');
                    const currentVoltage = (boardInst as any).pins[pinId]?.voltage || 0;
                    const isHigh = currentVoltage > 1.8;
                    const lastRead = this.proxyPinReadStates.get(pinNum);
                    
                    // Don't echo back what we are driving OUT, unless it differs from our driven state
                    const drivenState = this.proxyPinStates.get(pinNum);
                    const isEcho = drivenState !== undefined && drivenState === isHigh;
                    
                    if (lastRead !== isHigh && !isEcho) {
                        this.proxyPinReadStates.set(pinNum, isHigh);
                        this.onStateUpdate({ type: 'backendGpioSync', boardId: this.boardId, pin: pinNum, value: isHigh });
                    } else if (lastRead !== isHigh) {
                        // Update cache even for echo, to prevent continuous resending if state flips later
                        this.proxyPinReadStates.set(pinNum, isHigh);
                    }
                }
            }
        }
    }

    private visitNode(nodeKey: string, voltage: number, visited: Set<string> = new Set()) {
        if (visited.has(nodeKey)) return;
        visited.add(nodeKey);

        const netId = this.pinToNet.get(nodeKey);
        if (netId !== undefined) {
            for (const [p, n] of this.pinToNet) {
                if (n === netId) {
                    const [cId, pId] = p.split(':');
                    const inst = this.instances.get(cId);
                    if (inst) {
                        (inst as any).setPinVoltage?.(pId, voltage);
                        (inst as any).onPinStateChange?.(pId, voltage > 1.8, this.proxySimulatedCycles);
                        
                        this.traversePassive(inst, cId, pId, voltage, (forwardNode) => {
                            if (forwardNode !== nodeKey && forwardNode !== p) {
                                // TODO: Pass visited Set down to prevent call stack overflow / circular reference loops
                                this.visitNode(forwardNode, voltage, visited);
                            }
                        });
                    }
                }
            }
        }
    }

    private traversePassive(inst: BaseComponent, compId: string, pinId: string, voltage: number, visit: (target: string) => void) {
        if (inst.type === 'openhw-resistor' || inst.type === 'wokwi-resistor') {
            const otherPin = pinId === 'p1' ? 'p2' : pinId === 'p2' ? 'p1' : (pinId === '1' ? '2' : pinId === '2' ? '1' : null);
            if (!otherPin) return;
            (inst as any).setPinVoltage?.(otherPin, voltage);
            visit(`${compId}:${otherPin}`);
        } else if (inst.type === 'via') {
             const otherPin = pinId === '1' ? '2' : pinId === '2' ? '1' : null;
             if (otherPin) {
                 (inst as any).setPinVoltage?.(otherPin, voltage);
                 visit(`${compId}:${otherPin}`);
             }
        } else if (inst.type === 'openhw-diode' || inst.type === 'wokwi-diode') {
             if (pinId === 'A') {
                 (inst as any).setPinVoltage?.('K', Math.max(0, voltage - 0.7)); // Diode drop
                 visit(`${compId}:K`);
             }
        } else if (inst.type === 'openhw-pushbutton' || inst.type === 'wokwi-pushbutton') {
            // Internal short-circuit connections
            if (pinId === '1l' || pinId === '1') {
                (inst as any).setPinVoltage?.('1r', voltage); visit(`${compId}:1r`);
                (inst as any).setPinVoltage?.('1', voltage); visit(`${compId}:1`);
                (inst as any).setPinVoltage?.('1l', voltage); visit(`${compId}:1l`);
            } else if (pinId === '1r') {
                (inst as any).setPinVoltage?.('1l', voltage); visit(`${compId}:1l`);
                (inst as any).setPinVoltage?.('1', voltage); visit(`${compId}:1`);
            } else if (pinId === '2l' || pinId === '2') {
                (inst as any).setPinVoltage?.('2r', voltage); visit(`${compId}:2r`);
                (inst as any).setPinVoltage?.('2', voltage); visit(`${compId}:2`);
                (inst as any).setPinVoltage?.('2l', voltage); visit(`${compId}:2l`);
            } else if (pinId === '2r') {
                (inst as any).setPinVoltage?.('2l', voltage); visit(`${compId}:2l`);
                (inst as any).setPinVoltage?.('2', voltage); visit(`${compId}:2`);
            }

            // Tactile switch crossing
            if ((inst as any).state?.pressed) {
                if (pinId.startsWith('1')) {
                    (inst as any).setPinVoltage?.('2l', voltage); visit(`${compId}:2l`);
                    (inst as any).setPinVoltage?.('2r', voltage); visit(`${compId}:2r`);
                    (inst as any).setPinVoltage?.('2', voltage); visit(`${compId}:2`);
                } else if (pinId.startsWith('2')) {
                    (inst as any).setPinVoltage?.('1l', voltage); visit(`${compId}:1l`);
                    (inst as any).setPinVoltage?.('1r', voltage); visit(`${compId}:1r`);
                    (inst as any).setPinVoltage?.('1', voltage); visit(`${compId}:1`);
                }
            }
        } else if (inst.type.includes('breadboard')) {
            // Wokwi Breadboard routing
            const rowMatch = pinId.match(/^(\d+)([a-j])$/);
            if (rowMatch) {
                const row = rowMatch[1];
                const col = rowMatch[2];
                const isTopHalf = 'abcde'.includes(col);
                const group = isTopHalf ? ['a','b','c','d','e'] : ['f','g','h','i','j'];
                group.forEach(c => {
                    if (c !== col) {
                        (inst as any).setPinVoltage?.(`${row}${c}`, voltage);
                        visit(`${compId}:${row}${c}`);
                    }
                });
            } else if (pinId.match(/^[tb][bpn][+-]$/)) {
                // E.g., t1+, b2- power rails. For simplicity in proxy, skip complex rail bridging unless requested.
            }
        }
    }

    getSimulatedTimeMs() { return Math.floor(this.proxySimulatedCycles / 1000); }
    setTelemetryEnabled(enabled: boolean, mode?: string, watchedParamsMap?: Record<string, string[]>, deepSilicon?: boolean) {
        // TODO: Propagate telemetry configuration to instances to support logging and heuristics
        for (const inst of this.instances.values()) {
            inst.telemetryEnabled = !!enabled;
            (inst as any).telemetryMode = mode || 'detail';
            (inst as any).telemetryWatchedParams = watchedParamsMap?.[inst.id] || ['all'];
            inst.deepSiliconEnabled = !!deepSilicon;
        }
    }
    getRichTelemetrySnapshot() { return { boardId: this.boardId, components: [], capturedAt: new Date().toISOString(), mode: 'deep', isDelta: false }; }
    writeDirectMemory() {}
    readDirectMemory() { return null; }
}
