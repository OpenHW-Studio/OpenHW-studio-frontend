import { CPU, timer0Config, timer1Config, timer2Config, AVRTimer, avrInstruction, AVRADC, adcConfig, AVRUSART, usart0Config, AVRTWI, twiConfig, AVRSPI, spiConfig, AVRIOPort, portAConfig, portBConfig, portCConfig, portDConfig, portEConfig, portFConfig, portGConfig, portHConfig, portJConfig, portKConfig, portLConfig, PinState } from 'avr8js';
import { BaseComponent } from '@openhw/emulator';
import { UNO_DIGITAL_PINS, UNO_ANALOG_PINS } from '../board-profiles.ts';
import { parse } from '../fs/fs-builders.ts';
import { 
    BoardRunner, 
    AVRRunnerOptions, 
    ConnectedComponentPin, 
    isLikelyActiveSignal, 
    getComponentStateSyncPolicy, 
    fallbackTelemetryByInstance, 
    readComponentStateForTelemetry, 
    safeJsonStringify, 
    readPinLevelMap, 
    collectConnectedComponentPins,
    LOGIC_REGISTRY,
    COMPONENT_PINS,
    getInternalBridgesForComponent,
    getUnifiedComponentSyncState,
    collectComponentTelemetry,
    collectNeopixelShutdownStates,
    invokeOptional
} from '../registries/component-registry.ts';

export class AVRRunner {
    cpu: CPU | null = null;
    adc: AVRADC | null = null;
    usart: AVRUSART | null = null;
    twi: AVRTWI | null = null;
    spi: AVRSPI | null = null;
    portA: AVRIOPort | null = null;
    portB: AVRIOPort | null = null;
    portC: AVRIOPort | null = null;
    portD: AVRIOPort | null = null;
    portE: AVRIOPort | null = null;
    portF: AVRIOPort | null = null;
    portG: AVRIOPort | null = null;
    portH: AVRIOPort | null = null;
    portJ: AVRIOPort | null = null;
    portK: AVRIOPort | null = null;
    portL: AVRIOPort | null = null;
    updatePhysics: (() => void) | null = null;
    repropagateAllVoltages: (() => void) | null = null;
    timers: AVRTimer[] = [];
    running: boolean = false;
    pinStates: Record<string, boolean> = {};
    currentWires: any[] = [];
    instances: Map<string, BaseComponent> = new Map();
    lastTime: number = 0;
    statusInterval: any;
    pinsChanged: boolean = true;
    speed: number = 1.0;
    boardId: string;
    solverMode: 'logic';
    private serialBaudRate: number = 9600;
    private softSerialBaudRate: number = 9600;
    private serialByteBudget: number = 0;
    private readonly onStateUpdate: (state: any) => void;
    private readonly onByteTransmitCb?: (payload: { boardId: string; value: number; char: string; source?: string }) => void;
    private readonly softSerialRxPin = '11';
    private readonly softSerialTxPin = '10';
    private softSerialRxLineLow = false;
    private softSerialNextInjectCycle = 0;
    private softSerialDecodeState = {
        receiving: false,
        sampleCycle: 0,
        sampleIndex: 0,
        currentByte: 0,
        lastLevel: true,
    };
    private i2sState = new Map<string, { bclkLast: boolean; wsLast: boolean; shiftBuf: number; bitCount: number }>();
    private pwmState = new Map<string, { lastRiseCycle: number; lastFallCycle: number; lastPeriodCycles: number }>();
    private oneWireState = new Map<string, { lowStartCycle: number | null; highStartCycle: number | null }>();
    private protocolEndpointsCache = new Map<string, ConnectedComponentPin[]>();
    private componentSyncMeta = new Map<string, { lastSentAt: number; lastWeight: number }>();
    private circuitDirty: boolean = true;
    private topologyDirty: boolean = true;
    private lastPhysicsSolveAt: number = 0;
    private lastStateEmitCycle: number = 0;
    private lastStateEmitTime: number = 0;
    private statusIntervalEmitCount: number = 0;
    private lastRunLoopMs: number = 0;
    private lastPhysicsMs: number = 0;
    private lastComponentUpdateMs: number = 0;
    private netToNode = new Map<number, number>();
    private pinToNet: Map<string, number> = new Map();
    private physicsWorker: Worker | null = null;
    private physicsWorkerBusy: boolean = false;
    private cpuCyclesAtStart: number = 0;

    constructor(
        hexData: string,
        componentsDef: any[],
        wiresDef: any[],
        onStateUpdate: (state: any) => void,
        options: AVRRunnerOptions = {}
    ) {
        this.currentWires = wiresDef || [];
        this.onStateUpdate = onStateUpdate;
        this.onByteTransmitCb = options.onByteTransmit;
        this.speed = options.speed ?? 1.0;
        this.solverMode = 'logic';
        this.circuitDirty = true;
        const fallbackBoard = (componentsDef || []).find((c: any) => /(arduino|esp32|stm32|rp2040|pico)/i.test(String(c.type || '')));
        this.boardId = options.boardId || fallbackBoard?.id || 'openhw-arduino-uno_0';
        this.setSerialBaudRate(options.serialBaudRate ?? 9600);

        // Setup memory and CPU
        const program = new Uint16Array(32768);
        const { data } = parse(hexData);
        const u8 = new Uint8Array(program.buffer);
        u8.set(data);
        const preview = Array.from(data.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`AVRRunner: Flashed ${data.length} bytes. Start: [${preview}]`);

        this.cpu = new CPU(program, 0x2200);
        this.cpuCyclesAtStart = this.cpu.cycles;

        this.timers = [
            new AVRTimer(this.cpu, timer0Config),
            new AVRTimer(this.cpu, timer1Config),
            new AVRTimer(this.cpu, timer2Config),
        ];

        this.adc = new AVRADC(this.cpu, adcConfig);

        this.usart = new AVRUSART(this.cpu, usart0Config, 16e6);
        this.usart.onByteTransmit = (value) => {
            const char = String.fromCharCode(value);
            this.pulseBoardLed('1');
            if (this.onByteTransmitCb) {
                this.onByteTransmitCb({ boardId: this.boardId, value, char, source: 'uart0' });
            } else {
                this.onStateUpdate({ type: 'serial', data: char, value, boardId: this.boardId, source: 'uart0' });
            }
        };

        this.twi = new AVRTWI(this.cpu, twiConfig, 16e6);
        this.spi = new AVRSPI(this.cpu, spiConfig, 16e6);

        // Instantiate components
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

        this.portB = new AVRIOPort(this.cpu, portBConfig);
        this.portC = new AVRIOPort(this.cpu, portCConfig);
        this.portD = new AVRIOPort(this.cpu, portDConfig);
        
        if (this.boardId.toLowerCase().includes('mega')) {
            this.portA = new AVRIOPort(this.cpu, portAConfig);
            this.portE = new AVRIOPort(this.cpu, portEConfig);
            this.portF = new AVRIOPort(this.cpu, portFConfig);
            this.portG = new AVRIOPort(this.cpu, portGConfig);
            this.portH = new AVRIOPort(this.cpu, portHConfig);
            this.portJ = new AVRIOPort(this.cpu, portJConfig);
            this.portK = new AVRIOPort(this.cpu, portKConfig);
            this.portL = new AVRIOPort(this.cpu, portLConfig);
        }


        const runnerOnStateUpdate = this.onStateUpdate.bind(this);
        const runnerBoardId = this.boardId;
        const runnerGetSimulatedTimeMs = this.getSimulatedTimeMs.bind(this);

        // Setup I2C Hooks bridging AVRTWI events to BaseComponents
        class TWIAdapter {
            // Track the addressed slave across the read transaction
            private activeSlave: BaseComponent | null = null;
            private currentBuffer: number[] = [];

            constructor(private twi: AVRTWI, private instances: Map<string, BaseComponent>) { }

            start(repeated: boolean) {
                this.currentBuffer = [];
                this.twi.completeStart();
            }

            stop() {
                const instArray = Array.from(this.instances.values());
                for (const inst of instArray) {
                    if (inst.onI2CStop) {
                        inst.onI2CStop();
                    }
                    if (this.currentBuffer.length > 0 && inst.onI2CStart && this.activeSlave === inst) {
                        inst.recordI2cTransaction([...this.currentBuffer]);
                    }
                }

                if (this.currentBuffer.length > 0) {
                    const address = (this.currentBuffer[0] >> 1) & 0x7f;
                    const isWrite = (this.currentBuffer[0] & 1) === 0;
                    const data = this.currentBuffer.slice(1);
                    runnerOnStateUpdate({
                        type: 'protocol:i2c',
                        boardId: runnerBoardId,
                        address,
                        data,
                        isWrite,
                        timestamp: runnerGetSimulatedTimeMs()
                    });
                }

                this.activeSlave = null;
                this.currentBuffer = [];
                this.twi.completeStop();
            }

            connectToSlave(addr: number, write: boolean) {
                const instArray = Array.from(this.instances.values());
                let ack = false;
                this.activeSlave = null;
                for (const inst of instArray) {
                    if (inst.onI2CStart) {
                        if (inst.onI2CStart(addr, !write)) { 
                            ack = true;
                            if (!this.activeSlave) this.activeSlave = inst;
                        }
                    }
                }
                this.currentBuffer = [addr | (write ? 0 : 1)];
                this.twi.completeConnect(ack);
            }

            writeByte(value: number) {
                const instArray = Array.from(this.instances.values());
                let handled = false;
                for (const inst of instArray) {
                    if (inst.onI2CByte) {
                        if (inst.onI2CByte(-1, value)) {
                            handled = true;
                        }
                    }
                }
                this.currentBuffer.push(value);
                this.twi.completeWrite(handled);
            }

            readByte(ack: boolean) {
                let byte = 0xFF;
                if (this.activeSlave) {
                    const slave = this.activeSlave as any;
                    if (typeof slave.onI2CReadByte === 'function') {
                        byte = slave.onI2CReadByte() & 0xFF;
                    } else if (typeof slave.readByte === 'function') {
                        byte = slave.readByte() & 0xFF;
                    }
                }
                this.currentBuffer.push(byte);
                this.twi.completeRead(byte);
            }
        }

        this.twi.eventHandler = new TWIAdapter(this.twi, this.instances);

        let spiTransactionBytes: number[] = [];
        let lastSpiTime = 0;

        // Setup SPI Hooks bridging AVRSPI to BaseComponents
        this.spi.onByte = (value: number) => {
            const nowMs = this.getSimulatedTimeMs();
            if (nowMs - lastSpiTime > 2.0 && spiTransactionBytes.length > 0) {
                this.onStateUpdate({
                    type: 'protocol:spi',
                    boardId: this.boardId,
                    data: [...spiTransactionBytes],
                    timestamp: lastSpiTime
                });
                spiTransactionBytes = [];
            }
            lastSpiTime = nowMs;
            spiTransactionBytes.push(value & 0xff);

            const instArray = Array.from(this.instances.values());
            let returnByte = 0xFF; // Default MISO if nothing responds

            const unoId = this.boardId;

            if (unoId) {
                const misoNet = this.pinToNet.get(`${unoId}:12`);
                if (misoNet !== undefined) {
                    // 1. Direct Loopback (MISO connected to MOSI)
                    if (misoNet === this.pinToNet.get(`${unoId}:11`)) {
                        returnByte = value;
                    }
                    // 2. MISO connected to SCK (Clock pulses)
                    else if (misoNet === this.pinToNet.get(`${unoId}:13`)) {
                        returnByte = 0xAA; // Arbitrary pattern to show clock signal picked up
                    }
                    // 3. MISO connected to any other driven Pin (like 10/SS)
                    else {
                        // Check if the net is currently driven HIGH by another pin
                        let drivenHigh = false;
                        for (const [p, net] of this.pinToNet) {
                            if (net === misoNet && !p.endsWith(':12')) {
                                const [compId, pinId] = p.split(':');
                                if (compId === unoId && this.pinStates[pinId]) {
                                    drivenHigh = true;
                                    break;
                                }
                            }
                        }
                        returnByte = drivenHigh ? 0xFF : 0x00;
                    }
                }
            }

            for (const inst of instArray) {
                if (inst.onSPIByte && this.isSPISelected(inst)) {
                    const res = inst.onSPIByte(value);
                    if (res !== undefined) {
                        returnByte = res;
                    }
                }
            }

            // The SPI peripheral needs to be told when the transfer is physically complete 
            // based on the clock divider speed.
            this.cpu!.addClockEvent(() => {
                this.spi!.completeTransfer(returnByte);
            }, this.spi!.transferCycles);
        };

        // Setup IO Hooks
        this.setupHooks();
        this.setSoftSerialRxLevel(true);

        this.running = true;
        this.lastTime = performance.now();
        this.lastStateEmitTime = this.lastTime;
        this.runLoop();
    }

    getSimulatedTimeMs() {
        if (!this.cpu) return 0;
        return Math.floor(((this.cpu.cycles - this.cpuCyclesAtStart) / 16_000_000) * 1000);
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
                // 'deep' mode provides the FULL diagnostic report
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

    private isBoardArduinoPin(wireCoord: string, targetPin: string): boolean {
        const [compId, compPin] = wireCoord.split(':');
        if (compId !== this.boardId) return false;
        const inst = this.instances.get(compId);
        if (!inst || !inst.type.includes('arduino')) return false;
        return compPin === targetPin || compPin === `D${targetPin}` || compPin === `A${targetPin}`;
    }

    private pulseBoardLed(pinId: '0' | '1') {
        const boardInst = this.instances.get(this.boardId);
        if (!boardInst || !this.cpu) return;
        boardInst.onPinStateChange(pinId, true, this.cpu.cycles);
    }

    private getSoftSerialBitCycles(): number {
        const baud = Math.max(300, this.softSerialBaudRate | 0);
        return Math.max(1, Math.floor(16_000_000 / baud));
    }

    private setSoftSerialRxLevel(isHigh: boolean) {
        this.softSerialRxLineLow = !isHigh;
        // UNO pin 11 is PB3 (index 3 in PORTB mapping [8..13]).
        this.portB?.setPin(3, isHigh);
    }

    private emitSoftSerialByte(value: number) {
        const byte = value & 0xff;
        const char = String.fromCharCode(byte);
        this.pulseBoardLed('1');
        if (this.onByteTransmitCb) {
            this.onByteTransmitCb({ boardId: this.boardId, value: byte, char, source: 'softserial' });
        } else {
            this.onStateUpdate({ type: 'serial', data: char, value: byte, boardId: this.boardId, source: 'softserial' });
        }
    }

    private processSoftSerialDecode(cycles: number) {
        const state = this.softSerialDecodeState;
        if (!state.receiving) return;
        const bitCycles = this.getSoftSerialBitCycles();

        while (state.receiving && state.sampleCycle <= cycles) {
            if (state.sampleIndex < 8) {
                if (state.lastLevel) {
                    state.currentByte |= (1 << state.sampleIndex);
                }
                state.sampleIndex += 1;
                state.sampleCycle += bitCycles;
                continue;
            }

            // Stop bit: valid frame when line is HIGH.
            if (state.lastLevel) {
                this.emitSoftSerialByte(state.currentByte);
            }
            state.receiving = false;
            state.sampleIndex = 0;
            state.currentByte = 0;
        }
    }

    private observeSoftSerialTx(pinId: string, isHigh: boolean, cycles: number) {
        if (pinId !== this.softSerialTxPin) return;
        const state = this.softSerialDecodeState;

        this.processSoftSerialDecode(cycles);

        const prev = state.lastLevel;
        state.lastLevel = isHigh;

        // Falling edge while idle => start bit.
        if (!state.receiving && prev && !isHigh) {
            const bitCycles = this.getSoftSerialBitCycles();
            state.receiving = true;
            state.currentByte = 0;
            state.sampleIndex = 0;
            state.sampleCycle = cycles + (bitCycles * 1.5);
        }
    }

    private scheduleSoftSerialRxFrame(value: number) {
        if (!this.cpu) return;
        const cpu = this.cpu;
        const bitCycles = this.getSoftSerialBitCycles();
        const frameStart = Math.max(cpu.cycles + 1, this.softSerialNextInjectCycle || (cpu.cycles + 1));
        const byte = value & 0xff;
        const levels: number[] = [0];
        for (let i = 0; i < 8; i++) {
            levels.push((byte >> i) & 1);
        }
        levels.push(1); // stop bit

        levels.forEach((level, index) => {
            const cycleAt = frameStart + (index * bitCycles);
            cpu.addClockEvent(() => {
                if (!this.running) return;
                this.setSoftSerialRxLevel(level === 1);
            }, cycleAt - cpu.cycles);
        });

        this.softSerialNextInjectCycle = frameStart + (levels.length * bitCycles);
    }

    private hasPendingCpuWork(): boolean {
        if (!this.cpu) return false;
        const cpuAny = this.cpu as any;
        const pendingClock = !!cpuAny?.nextClockEvent && cpuAny.nextClockEvent.cycles <= this.cpu.cycles;
        const pendingInterrupt = !!cpuAny?.interruptsEnabled && Number(cpuAny?.nextInterrupt ?? -1) >= 0;
        return pendingClock || pendingInterrupt;
    }

    private drainPendingCpuWork(maxTicks = 8) {
        if (!this.cpu) return;
        let guard = 0;
        while (this.running && this.hasPendingCpuWork() && guard < maxTicks) {
            this.cpu.tick();
            guard += 1;
        }
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
        } else if (inst.type === 'openhw-led' || inst.type === 'openhw-led') {
            // Forward bias: Anode to Cathode
            if (pinId === 'A') {
                const nextV = Math.max(0, voltage - 1.8);
                inst.setPinVoltage('K', nextV);
                visit(`${compId}:K`, nextV);
            }
        } else if (inst.type === 'openhw-pushbutton' || inst.type === 'wokwi-pushbutton') {
            // Internal short-circuit connections
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

            // Tactile switch crossing
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
        } else if (inst.type === 'openhw-membrane-keypad' || inst.type === 'wokwi-membrane-keypad') {
            if (inst.state?.connectedPair) {
                const [p1, p2] = inst.state.connectedPair;
                if (pinId === p1) {
                    inst.setPinVoltage(p2, voltage);
                    visit(`${compId}:${p2}`, voltage);
                } else if (pinId === p2) {
                    inst.setPinVoltage(p1, voltage);
                    visit(`${compId}:${p1}`, voltage);
                }
            }
        } else if (inst.type === 'openhw-slide-switch' || inst.type === 'wokwi-slide-switch') {
            const isRight = inst.state?.value === "1" || inst.state?.value === 1 || inst.state?.value === true;
            if (isRight) {
                if (pinId === '3') {
                    inst.setPinVoltage('2', voltage);
                    visit(`${compId}:2`, voltage);
                } else if (pinId === '2') {
                    inst.setPinVoltage('3', voltage);
                    visit(`${compId}:3`, voltage);
                }
            } else {
                if (pinId === '1') {
                    inst.setPinVoltage('2', voltage);
                    visit(`${compId}:2`, voltage);
                } else if (pinId === '2') {
                    inst.setPinVoltage('1', voltage);
                    visit(`${compId}:1`, voltage);
                }
            }
        } else if (inst.type === 'openhw-breadboard' || inst.type === 'openhw-breadboard-half' || inst.type === 'openhw-breadboard-mini' || inst.type === 'wokwi-breadboard' || inst.type === 'wokwi-breadboard-half' || inst.type === 'wokwi-breadboard-mini' || inst.type === 'via' || inst.type === 'openhw-via' || inst.type === 'wokwi-via' || inst.type === 'openhw-wire' || inst.type === 'wokwi-wire') {
            const bridges = getInternalBridgesForComponent(compId, inst.type);
            for (const bridge of bridges) {
                if (bridge[0] === `${compId}:${pinId}`) visit(bridge[1], voltage);
                else if (bridge[1] === `${compId}:${pinId}`) visit(bridge[0], voltage);
            }
        } else if (inst.type === 'openhw-analog-joystick' || inst.type === 'wokwi-analog-joystick') {
            // Joystick is two internal potentiometers (VCC→VRX, VCC→VRY) plus a button (SW→GND).
            // normalizePin maps VCC→5V, so we must accept both names.
            const isVccPin = pinId === 'VCC' || pinId === '5V';
            const isGndPin = pinId === 'GND';
            const xVal = inst.state?.x ?? 0.5;
            const yVal = inst.state?.y ?? 0.5;
            const gndV = inst.getPinVoltage('GND') || 0;
            if (isVccPin) {
                const vrxV = gndV + xVal * (voltage - gndV);
                const vryV = gndV + yVal * (voltage - gndV);
                inst.setPinVoltage('VRX', vrxV);
                visit(`${compId}:VRX`, vrxV);
                inst.setPinVoltage('VRY', vryV);
                visit(`${compId}:VRY`, vryV);
            } else if (isGndPin) {
                // Get VCC voltage from whichever pin name is registered
                const vccV = inst.getPinVoltage('VCC') || inst.getPinVoltage('5V') || 5.0;
                const vrxV = voltage + xVal * (vccV - voltage);
                const vryV = voltage + yVal * (vccV - voltage);
                inst.setPinVoltage('VRX', vrxV);
                visit(`${compId}:VRX`, vrxV);
                inst.setPinVoltage('VRY', vryV);
                visit(`${compId}:VRY`, vryV);
            }
            // SW button: connects SW to GND when pressed
            if (inst.state?.pressed) {
                if (pinId === 'SW') {
                    inst.setPinVoltage('GND', voltage);
                    visit(`${compId}:GND`, voltage);
                } else if (isGndPin) {
                    inst.setPinVoltage('SW', voltage);
                    visit(`${compId}:SW`, voltage);
                }
            }
        } else if (inst.type === 'openhw-potentiometer' || inst.type === 'wokwi-potentiometer') {
            // Rotary potentiometer: voltage divider between pin 2 (VCC) and pin 1 (GND)
            const potVal = Number(inst.state?.value) ?? 50;
            const ratio = Math.max(0, Math.min(1, potVal / 100));
            if (pinId === '2') {
                const gndV = inst.getPinVoltage('1') || 0;
                const sigV = gndV + (voltage - gndV) * ratio;
                inst.setPinVoltage('SIG', sigV);
                visit(`${compId}:SIG`, sigV);
            } else if (pinId === '1') {
                const vccV = inst.getPinVoltage('2') || 5.0;
                const sigV = voltage + (vccV - voltage) * ratio;
                inst.setPinVoltage('SIG', sigV);
                visit(`${compId}:SIG`, sigV);
            }
        } else if (inst.type === 'openhw-slide-potentiometer') {
            // Slide potentiometer: voltage divider between VCC and GND
            const potVal = Number(inst.state?.value) ?? 50;
            const ratio = Math.max(0, Math.min(1, potVal / 100));
            if (pinId === 'VCC') {
                const gndV = inst.getPinVoltage('GND') || 0;
                const sigV = gndV + (voltage - gndV) * ratio;
                inst.setPinVoltage('SIG', sigV);
                visit(`${compId}:SIG`, sigV);
            } else if (pinId === 'GND') {
                const vccV = inst.getPinVoltage('VCC') || 5.0;
                const sigV = voltage + (vccV - voltage) * ratio;
                inst.setPinVoltage('SIG', sigV);
                visit(`${compId}:SIG`, sigV);
            }
        } else if (inst.type === 'openhw-hc-sr04' || inst.type === 'wokwi-hc-sr04') {
            // HC-SR04: VCC is power input, GND is ground, TRIG is input (ignore), ECHO is output
            if (pinId === 'VCC') {
                const gndV = inst.getPinVoltage('GND') || 0;
                const echoV = (inst as any).echoOutputVoltage !== undefined
                    ? (inst as any).echoOutputVoltage
                    : inst.getPinVoltage('ECHO') || 0;
                inst.setPinVoltage('ECHO', echoV);
                visit(`${compId}:ECHO`, echoV);
            } else if (pinId === 'GND') {
                const echoV = (inst as any).echoOutputVoltage !== undefined
                    ? (inst as any).echoOutputVoltage
                    : inst.getPinVoltage('ECHO') || 0;
                inst.setPinVoltage('ECHO', echoV);
                visit(`${compId}:ECHO`, echoV);
            }
        } else if (inst.type === 'openhw-ks2e-m-dc5') {
            // DPDT Relay: internal switch contacts + coil
            const energised = inst.state?.energised;
            if (pinId === 'COIL1') {
                const v2 = inst.getPinVoltage('COIL2');
                const coilV = Math.min(voltage, 5.0);
                const drop = coilV * 0.01;
                const nextV = Math.max(0, coilV - drop);
                inst.setPinVoltage('COIL2', nextV);
                visit(`${compId}:COIL2`, nextV);
            } else if (pinId === 'COIL2') {
                const coilV = Math.min(voltage, 5.0);
                const drop = coilV * 0.01;
                const nextV = Math.max(0, coilV - drop);
                inst.setPinVoltage('COIL1', nextV);
                visit(`${compId}:COIL1`, nextV);
            } else if (energised) {
                // Energised: P1←→NO1, P2←→NO2
                if (pinId === 'P1') {
                    inst.setPinVoltage('NO1', voltage);
                    visit(`${compId}:NO1`, voltage);
                } else if (pinId === 'NO1') {
                    inst.setPinVoltage('P1', voltage);
                    visit(`${compId}:P1`, voltage);
                } else if (pinId === 'P2') {
                    inst.setPinVoltage('NO2', voltage);
                    visit(`${compId}:NO2`, voltage);
                } else if (pinId === 'NO2') {
                    inst.setPinVoltage('P2', voltage);
                    visit(`${compId}:P2`, voltage);
                }
            } else {
                // De-energised: P1←→NC1, P2←→NC2
                if (pinId === 'P1') {
                    inst.setPinVoltage('NC1', voltage);
                    visit(`${compId}:NC1`, voltage);
                } else if (pinId === 'NC1') {
                    inst.setPinVoltage('P1', voltage);
                    visit(`${compId}:P1`, voltage);
                } else if (pinId === 'P2') {
                    inst.setPinVoltage('NC2', voltage);
                    visit(`${compId}:NC2`, voltage);
                } else if (pinId === 'NC2') {
                    inst.setPinVoltage('P2', voltage);
                    visit(`${compId}:P2`, voltage);
                }
            }
        }
    }

    private setupHooks() {
        if (!this.cpu) return;

        let lowImpRails = new Map<string, number>();

        const getLowImpedanceRails = (): Map<string, number> => {
            const rails = new Map<string, number>();
            const visited = new Set<string>();

            // Board digital/analog pins should remain drivable by external components,
            // not locked to power rail voltage even if the breadboard power row is shared.
            const boardPinNodes = new Set<string>();
            [...UNO_DIGITAL_PINS, ...UNO_ANALOG_PINS].forEach(p => boardPinNodes.add(`${this.boardId}:${p}`));

            const normalizePin = (pinStr: string): string => {
                const parts = pinStr.split(':');
                if (parts.length >= 2) {
                    const compId = parts[0];
                    const pinId = parts.slice(1).join(':');
                    const upper = pinId.toUpperCase();
                    if (upper === 'GND' || /^GND[._:]?\d+$/.test(upper)) {
                        return `${compId}:GND`;
                    }
                    if (upper === '5V' || upper === 'VCC') {
                        return `${compId}:5V`;
                    }
                    if (upper === '3V3' || upper === '3V3_EN') {
                        return `${compId}:3V3`;
                    }
                }
                return pinStr;
            };

            const visit = (rawNode: string, v: number) => {
                const node = normalizePin(rawNode);
                if (visited.has(node)) return;
                visited.add(node);
                const isBoardPin = boardPinNodes.has(node);
                // Don't add board digital/analog pins to the rail map —
                // they should be driven by their connected external components, not locked by the power rail.
                if (!isBoardPin) {
                    rails.set(node, v);
                }

                // Traverse wires — skip if this is a board digital/analog pin (boundary between power rail and signal pins)
                if (!isBoardPin) {
                    for (const wire of this.currentWires) {
                        const normFrom = normalizePin(wire.from);
                        const normTo = normalizePin(wire.to);
                        if (normFrom === node) {
                            visit(wire.to, v);
                        } else if (normTo === node) {
                            visit(wire.from, v);
                        }
                    }
                }

                // Traverse breadboard/vias bridges
                const [compId, compPin] = node.split(':');
                const inst = this.instances.get(compId);
                if (inst && (inst.type === 'openhw-breadboard' || inst.type === 'openhw-breadboard-half' || inst.type === 'openhw-breadboard-mini' || inst.type === 'wokwi-breadboard' || inst.type === 'wokwi-breadboard-half' || inst.type === 'wokwi-breadboard-mini' || inst.type === 'via' || inst.type === 'openhw-via' || inst.type === 'wokwi-via' || inst.type === 'openhw-wire' || inst.type === 'wokwi-wire')) {
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
            ['gnd_1', 'gnd_2', 'gnd_3', 'GND'].forEach(pin => {
                visit(`${this.boardId}:${pin}`, 0.0);
            });
            // Start BFS from 5V/VIN
            ['5V', 'vin', 'VIN'].forEach(pin => {
                visit(`${this.boardId}:${pin}`, 5.0);
            });
            // Start BFS from 3V3
            ['3v3', '3V3'].forEach(pin => {
                visit(`${this.boardId}:${pin}`, 3.3);
            });

            // Start BFS from non-board power supplies and batteries
            this.instances.forEach((inst, compId) => {
                if (compId === this.boardId) return;
                const isPowerSupply = inst.type.includes('power-supply');
                const isBattery = inst.type.includes('battery');
                if (isPowerSupply || isBattery) {
                    Object.keys(inst.pins).forEach(pin => {
                        const v = inst.pins[pin]?.voltage ?? 0.0;
                        visit(`${compId}:${pin}`, v);
                    });
                }
            });

            return rails;
        };        const updateOopPin = (arduinoPinStr: string, isHighOrVoltage: boolean | number, customCompId?: string) => {
            const voltage = typeof isHighOrVoltage === 'number' ? isHighOrVoltage : (isHighOrVoltage ? 5.0 : 0.0);
            if (arduinoPinStr === '5') {
                console.log(`[Worker updateOopPin] Pin 5, isHighOrVoltage: ${isHighOrVoltage}, voltage: ${voltage}V`);
            }
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
                    if (upper === '5V' || upper === 'VCC') {
                        return `${compId}:5V`;
                    }
                    if (upper === '3V3' || upper === '3V3_EN') {
                        return `${compId}:3V3`;
                    }
                }
                return pinStr;
            };

            const visitNode = (rawNode: string, v: number) => {
                const node = normalizePin(rawNode);
                if (arduinoPinStr === '5' || rawNode.includes('btn7') || rawNode.includes('uno1:5')) {
                    console.log(`[Worker visitNode] Pin 5 path, rawNode: ${rawNode}, node: ${node}, voltage: ${v}V`);
                }
                if (visitedNodes.has(node)) return;

                const [compId, compPin] = node.split(':');

                // Do not allow passive back-propagation to overwrite constant board power reference pins (GND, 5V, 3V3, VIN)
                if (compId === this.boardId && rawNode !== `${this.boardId}:${arduinoPinStr}`) {
                    const upper = compPin.toUpperCase();
                    if (upper === 'GND' || /^GND[._:]?\d+$/.test(upper) || upper === '5V' || upper === '3V3' || upper === 'VIN') {
                        return;
                    }
                }

                // When propagating from a board power rail, do NOT propagate back into board digital/analog pins.
                // They should be driven by external components, not locked by the power rail.
                const isPowerRailSrc = ['gnd_1', 'gnd_2', 'gnd_3', 'GND', '5V', 'vin', 'VIN', '3v3', '3V3'].includes(arduinoPinStr);
                if (isPowerRailSrc && compId === this.boardId && rawNode !== `${this.boardId}:${arduinoPinStr}`) {
                    return;
                }

                // If this is a passive propagation from a CPU pin, and we encounter a node that has a low-impedance
                // connection to a board supply rail, do not allow passive propagation to overwrite its fixed reference voltage!
                // Exception: when a component drives its own output (customCompId matches), it should override the rail.
                // Exception 2: passive components (resistors, vias, breadboards, wires) must not be locked —
                // they need to pass through voltages from active component outputs (e.g., MUX driving LOW through a resistor).
                const isCpuPinProp = !['gnd_1', 'gnd_2', 'gnd_3', 'GND', '5V', 'vin', 'VIN', '3v3', '3V3'].includes(arduinoPinStr);
                if (isCpuPinProp && lowImpRails.has(node) && compId !== customCompId) {
                    const railInst = this.instances.get(compId);
                    const isPassive = railInst && (railInst.type === 'openhw-breadboard' || railInst.type === 'openhw-breadboard-half' || railInst.type === 'openhw-breadboard-mini' || railInst.type === 'wokwi-breadboard' || railInst.type === 'wokwi-breadboard-half' || railInst.type === 'wokwi-breadboard-mini' || railInst.type === 'via' || railInst.type === 'openhw-via' || railInst.type === 'wokwi-via' || railInst.type === 'openhw-wire' || railInst.type === 'wokwi-wire' || railInst.type === 'openhw-resistor' || railInst.type === 'wokwi-resistor');
                    if (!isPassive) {
                        const railVoltage = lowImpRails.get(node)!;
                        if (railInst) {
                            if (!railInst.pins[compPin]) railInst.pins[compPin] = { voltage: 0, mode: 'INPUT' };
                            railInst.setPinVoltage(compPin, railVoltage);
                        }
                        return;
                    }
                }

                visitedNodes.add(node);

                // Junction support: visit all wires on this same pin
                for (const wire of this.currentWires) {
                    const normFrom = normalizePin(wire.from);
                    const normTo = normalizePin(wire.to);
                    const edgeKey = `${normFrom}|${normTo}`;
                    if (visitedEdges.has(edgeKey)) continue;
                    if (normFrom === node || normTo === node) {
                        visitedEdges.add(edgeKey);
                        visitNode(normFrom === node ? wire.to : wire.from, v);
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
                    this.tickI2S(inst, compId, compPin, v > 1.8);

                    // Propagate external voltage back to simulated AVR CPU ports
                    if (compId === this.boardId) {
                        const isHigh = v > 1.8;
                        this.pinStates[compPin] = isHigh;
                        if (compPin.startsWith('A')) {
                            const bit = parseInt(compPin.slice(1), 10);
                            if (!isNaN(bit)) this.portC?.setPin(bit, isHigh);
                        } else {
                            const num = parseInt(compPin, 10);
                            if (!isNaN(num)) {
                                if (num >= 8 && num <= 13) {
                                    this.portB?.setPin(num - 8, isHigh);
                                } else if (num >= 0 && num <= 7) {
                                    this.portD?.setPin(num, isHigh);
                                }
                            }
                        }
                    }

                    this.traversePassive(inst, compId, compPin, v, (forwardNode, nextV) => {
                        visitNode(forwardNode, nextV);
                    });
                }
            };

            const startCompId = customCompId || this.boardId;
            visitNode(`${startCompId}:${arduinoPinStr}`, voltage);
        };

        this.updatePhysics = () => {};

        this.repropagateAllVoltages = () => {
            lowImpRails = getLowImpedanceRails();
            const getAvrPinModeState = (pinStr: string) => {
                let port: AVRIOPort | null = null;
                let bit = 0;
                if (pinStr.startsWith('A')) {
                    port = this.portC;
                    const parsed = parseInt(pinStr.slice(1), 10);
                    if (!isNaN(parsed)) bit = parsed;
                } else {
                    const num = parseInt(pinStr, 10);
                    if (!isNaN(num)) {
                        if (num >= 8 && num <= 13) {
                            port = this.portB;
                            bit = num - 8;
                        } else if (num >= 0 && num <= 7) {
                            port = this.portD;
                            bit = num;
                        }
                    }
                }
                if (!port) return { isDriven: true, isHigh: !!this.pinStates[pinStr] };
                const state = port.pinState(bit);
                if (pinStr === '5') {
                    console.log(`[Worker getAvrPinModeState] Pin 5, port: ${port ? 'portD' : 'null'}, bit: ${bit}, avrState: ${state}, PinState.InputPullUp: ${PinState.InputPullUp}`);
                }
                if (state === PinState.High || state === PinState.InputPullUp) {
                    return { isDriven: true, isHigh: true };
                }
                if (state === PinState.Low) {
                    return { isDriven: true, isHigh: false };
                }
                // Input mode (floating/high impedance)
                // Wokwi pulls floating input pins to HIGH by default. Emulate this behavior:
                return { isDriven: true, isHigh: true };
            };

            // First, re-propagate all digital / analog board pins driven by the CPU or pullups.
            // Process INPUT/INPUT_PULLUP pins BEFORE OUTPUT pins so that strong OUTPUT signals
            // can override the weak pull-up voltage when a CPU output pin and a pull-up share
            // the same breadboard row (e.g. MUX:D1=0V from pin 3 must beat 5V from pin 5's pull-up).
            const allBoardPins = [...UNO_DIGITAL_PINS, ...UNO_ANALOG_PINS];
            const inputPins = allBoardPins.filter(p => {
                const state = getAvrPinModeState(p);
                if (!state.isDriven) return false;
                const num = parseInt(p, 10);
                if (isNaN(num)) return false;
                let port: AVRIOPort | null = null;
                if (num >= 8 && num <= 13) port = this.portB;
                else if (num >= 0 && num <= 7) port = this.portD;
                else return false;
                if (!port) return false;
                const pinState = port.pinState(num);
                return pinState !== PinState.High && pinState !== PinState.Low;
            });
            const outputPins = allBoardPins.filter(p => {
                const state = getAvrPinModeState(p);
                if (!state.isDriven) return false;
                const num = parseInt(p, 10);
                if (isNaN(num)) return false;
                let port: AVRIOPort | null = null;
                if (num >= 8 && num <= 13) port = this.portB;
                else if (num >= 0 && num <= 7) port = this.portD;
                else return false;
                if (!port) return false;
                const pinState = port.pinState(num);
                return pinState === PinState.High || pinState === PinState.Low;
            });
            const analogPins = allBoardPins.filter(p => p.startsWith('A'));
            [...inputPins, ...analogPins, ...outputPins].forEach(pin => {
                const { isDriven, isHigh } = getAvrPinModeState(pin);
                if (isDriven) {
                    this.pinStates[pin] = isHigh;
                    updateOopPin(pin, isHigh);
                }
            });

            // Re-propagate active driver outputs from non-board helper components (e.g. A4988 motor drivers, logic gates)
            this.instances.forEach((inst, compId) => {
                if (compId === this.boardId) return;
                if (inst.type === 'openhw-hc-sr04' || inst.type === 'wokwi-hc-sr04') {
                    const echoV = (inst as any).echoOutputVoltage !== undefined
                        ? (inst as any).echoOutputVoltage
                        : inst.pins['ECHO']?.voltage ?? 0;
                    if (inst.pins['ECHO']) {
                        updateOopPin('ECHO', echoV, compId);
                    }
                } else if (inst.type === 'openhw-dht22' || inst.type === 'wokwi-dht22') {
                    const sdaV = (inst as any).sdaOutputVoltage !== undefined
                        ? (inst as any).sdaOutputVoltage
                        : inst.pins['SDA']?.voltage ?? 5.0;
                    if (inst.pins['SDA']) {
                        updateOopPin('SDA', sdaV, compId);
                    }
                } else if (inst.type.includes('a4988')) {
                    ['1A', '1B', '2A', '2B'].forEach(pin => {
                        if (inst.pins[pin]) {
                            updateOopPin(pin, inst.pins[pin].voltage, compId);
                        }
                    });
                } else if (inst.type.includes('motor-driver') || inst.type.includes('l293d')) {
                    ['OUT1', 'OUT2', 'OUT3', 'OUT4'].forEach(pin => {
                        if (inst.pins[pin]) {
                            updateOopPin(pin, inst.pins[pin].voltage, compId);
                        }
                    });
                } else if (inst.type.startsWith('logic-') || inst.type.includes('timer') || inst.type.includes('opamp')) {
                    const allInsts = Array.from(this.instances.values());
                    if (compId.includes('nd_gate')) {
                        const gateWires = this.currentWires.filter((w: any) =>
                            w.from?.startsWith(compId) || w.to?.startsWith(compId)
                        );
                        console.log(`[repropagate] Wires for ${compId}:`, JSON.stringify(gateWires));
                    }
                    const in1 = inst.getPinVoltage('IN1');
                    const in2 = inst.getPinVoltage('IN2');
                    const d0 = inst.getPinVoltage('D0');
                    const d1 = inst.getPinVoltage('D1');
                    const sel = inst.getPinVoltage('SEL');
                    inst.update(this.cpu?.cycles ?? 0, this.currentWires, allInsts);
                    const outV = inst.pins['OUT']?.voltage ?? -1;
                    if (compId.includes('nd_gate')) {
                        console.log(`[repropagate] IN1=${in1} IN2=${in2} OUT=${outV} pins keys=${Object.keys(inst.pins).join(',')}`);
                    }
                    Object.keys(inst.pins).forEach(pin => {
                        // Propagate all known output pins. The IC 74xx uses non-standard names
                        // (p1-p14), so we check if the pin mode is OUTPUT or if update() changed it.
                        const isOutput = pin.startsWith('OUT') || pin.startsWith('out') || pin === 'Q' || pin === 'Q#';
                        if (isOutput || inst.type === 'logic-ic-74xx') {
                            updateOopPin(pin, inst.pins[pin].voltage, compId);
                        }
                    });
                    // Log AFTER updateOopPin so PIND reflects the newly propagated value
                    if (compId.includes('mux')) {
                        const pindVal = this.cpu ? this.cpu.data[0x29] : -1;
                        const p2 = (pindVal >> 2) & 1;
                        const p3 = (pindVal >> 3) & 1;
                        const p4 = (pindVal >> 4) & 1;
                        const p5 = (pindVal >> 5) & 1;
                        console.log(`[repropagate MUX] D0=${d0} D1=${d1} SEL=${sel} OUT=${outV} d0High=${inst.getPinVoltage('D0')>=2.5} d1High=${inst.getPinVoltage('D1')>=2.5} selHigh=${inst.getPinVoltage('SEL')>=2.5} stateOut=${inst.state?.outputHigh} PIND2=${p2} PIND3=${p3} PIND4=${p4} PIND5=${p5} pins=${Object.keys(inst.pins).join(',')}`);
                    }
                }
            });

            // Re-propagate non-board power supplies and batteries
            this.instances.forEach((inst, compId) => {
                if (compId === this.boardId) return;
                const isPowerSupply = inst.type.includes('power-supply');
                const isBattery = inst.type.includes('battery');
                if (isPowerSupply || isBattery) {
                    Object.keys(inst.pins).forEach(pin => {
                        if (inst.pins[pin]) {
                            updateOopPin(pin, inst.pins[pin].voltage, compId);
                        }
                    });
                }
            });

            // Then, re-propagate GND and power rails LAST so they dominate and pull pins down/up
            ['gnd_1', 'gnd_2', 'gnd_3', 'GND'].forEach(pin => {
                updateOopPin(pin, 0.0);
            });
            ['5V', 'vin', 'VIN'].forEach(pin => {
                updateOopPin(pin, 5.0);
            });
            ['3v3', '3V3'].forEach(pin => {
                updateOopPin(pin, 3.3);
            });

            // Re-propagate NPN transistor outputs AFTER power rails so transistor switching
            // overrides the passive voltage drop through the load (e.g. 5V→LED→Collector path)
            this.instances.forEach((inst, compId) => {
                if (compId === this.boardId) return;
                if (inst.type === 'openhw-npn-transistor') {
                    const allInsts = Array.from(this.instances.values());
                    inst.update(this.cpu?.cycles ?? 0, this.currentWires, allInsts);
                    if (inst.pins['C']) {
                        updateOopPin('C', inst.pins['C'].voltage, compId);
                    }
                    if (inst.pins['E']) {
                        updateOopPin('E', inst.pins['E'].voltage, compId);
                    }
                }
            });

            // Re-propagate standalone power supply rails LAST so they dominate external power nets
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

        const attachPort = (port: AVRIOPort, pinNames: string[]) => {
            port.addListener((value) => {
                pinNames.forEach((pin, i) => {
                    if (!pin) return;
                    // Only propagate port register changes to the external circuit if the pin is configured as an OUTPUT!
                    const state = port.pinState(i);
                    const isOutput = state === PinState.Low || state === PinState.High;
                    if (!isOutput) {
                        return;
                    }

                    const isHigh = (value & (1 << i)) !== 0;
                    if (this.pinStates[pin] !== isHigh) {
                        this.pinStates[pin] = isHigh;
                        this.pinsChanged = true;
                        this.circuitDirty = true;

                        const boardInst = this.instances.get(this.boardId);
                        if (boardInst) {
                            boardInst.onPinStateChange(pin, isHigh, this.cpu!.cycles);
                        }

                        updateOopPin(pin, isHigh);
                        this.dispatchOptionalProtocols(pin, isHigh, this.cpu!.cycles);
                        this.observeSoftSerialTx(pin, isHigh, this.cpu!.cycles);
                    }
                });
            });
        };

        const isMega = this.boardId.toLowerCase().includes('mega');

        if (isMega) {
            const MEGA_PORTA_PINS = ['22', '23', '24', '25', '26', '27', '28', '29'];
            const MEGA_PORTB_PINS = ['53', '52', '51', '50', '10', '11', '12', '13'];
            const MEGA_PORTC_PINS = ['37', '36', '35', '34', '33', '32', '31', '30'];
            const MEGA_PORTD_PINS = ['21', '20', '19', '18', '', '', '', '38'];
            const MEGA_PORTE_PINS = ['0', '1', '', '5', '2', '3', '', ''];
            const MEGA_PORTF_PINS = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'];
            const MEGA_PORTG_PINS = ['41', '40', '39', '', '', '4', '', ''];
            const MEGA_PORTH_PINS = ['17', '16', '', '6', '7', '8', '9', ''];
            const MEGA_PORTJ_PINS = ['15', '14', '', '', '', '', '', ''];
            const MEGA_PORTK_PINS = ['A8', 'A9', 'A10', 'A11', 'A12', 'A13', 'A14', 'A15'];
            const MEGA_PORTL_PINS = ['49', '48', '47', '46', '45', '44', '43', '42'];

            if (this.portA) attachPort(this.portA, MEGA_PORTA_PINS);
            if (this.portB) attachPort(this.portB, MEGA_PORTB_PINS);
            if (this.portC) attachPort(this.portC, MEGA_PORTC_PINS);
            if (this.portD) attachPort(this.portD, MEGA_PORTD_PINS);
            if (this.portE) attachPort(this.portE, MEGA_PORTE_PINS);
            if (this.portF) attachPort(this.portF, MEGA_PORTF_PINS);
            if (this.portG) attachPort(this.portG, MEGA_PORTG_PINS);
            if (this.portH) attachPort(this.portH, MEGA_PORTH_PINS);
            if (this.portJ) attachPort(this.portJ, MEGA_PORTJ_PINS);
            if (this.portK) attachPort(this.portK, MEGA_PORTK_PINS);
            if (this.portL) attachPort(this.portL, MEGA_PORTL_PINS);
        } else {
            if (this.portB) attachPort(this.portB, UNO_DIGITAL_PINS.slice(8, 14)); // PORTB
            if (this.portD) attachPort(this.portD, UNO_DIGITAL_PINS.slice(0, 8)); // PORTD
            if (this.portC) attachPort(this.portC, UNO_ANALOG_PINS); // PORTC
        }

        // Initialize all hooked pins to LOW on startup so LED components aren't stuck waiting for a toggle
        [...UNO_DIGITAL_PINS, ...UNO_ANALOG_PINS].forEach(pin => {
            this.pinStates[pin] = false;
            this.circuitDirty = true;
            updateOopPin(pin, false);
        });

        // Initialize power and ground rail pins on startup to propagate reference levels to passives
        ['gnd_1', 'gnd_2', 'gnd_3', 'GND'].forEach(pin => {
            updateOopPin(pin, 0.0);
        });
        ['5V', 'vin', 'VIN'].forEach(pin => {
            updateOopPin(pin, 5.0);
        });
        ['3v3', '3V3'].forEach(pin => {
            updateOopPin(pin, 3.3);
        });
    }

    private _dbgFrameCount = 0;
    private runLoop = () => {
        if (!this.running || !this.cpu) return;

        const loopStart = performance.now();
        const now = performance.now();
        const deltaTime = now - this.lastTime;
        let physicsMs = 0;

        if (deltaTime > 0) {
            const cyclesPerMs = 16000 * this.speed;
            const cyclesToRun = deltaTime * cyclesPerMs;
            const targetObj = this.cpu.cycles + Math.min(cyclesToRun, 1600000 * Math.max(1, this.speed));

            const physicsInterval = this.speed > 1.0 ? 8 : 12; // ~80-120Hz
            const shouldSolvePhysics = this.circuitDirty || (now - this.lastPhysicsSolveAt) >= physicsInterval;

            const instArray = Array.from(this.instances.values());
            const componentUpdateThreshold = 32000; // Update components every 2ms of simulated time

            while (this.cpu.cycles < targetObj && this.running) {
                const nextChunkTarget = Math.min(targetObj, this.cpu.cycles + componentUpdateThreshold);
                
                while (this.cpu.cycles < nextChunkTarget && this.running) {
                    avrInstruction(this.cpu);
                    this.cpu.tick();
                }

                // Component updates for smooth animation
                const componentStart = performance.now();
                let anyStateChanged = false;
                instArray.forEach(inst => {
                    if (!(inst as any)._simCpu) {
                        (inst as any)._simCpu = this.cpu;
                        (inst as any)._simUpdatePhysics = this.repropagateAllVoltages;
                    }
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
                this.lastComponentUpdateMs = performance.now() - componentStart;
            }

            physicsMs = performance.now() - loopStart;
            this.drainPendingCpuWork(16);
            this.processSoftSerialDecode(this.cpu.cycles);
            this.lastTime = now;
            if (shouldSolvePhysics) {
                if (typeof this.repropagateAllVoltages === 'function') {
                    this.repropagateAllVoltages();
                }
                if (this.cpu) {
                    const pind = this.cpu.data[0x29];
                    console.log(`[PhysicsSolve] PIND2=${(pind>>2)&1} PIND3=${(pind>>3)&1} PIND4=${(pind>>4)&1} PIND5=${(pind>>5)&1} DDRD=${this.cpu.data[0x2A]} PORTD=${this.cpu.data[0x2B]}`);
                }
                this.lastPhysicsSolveAt = now;
                this.circuitDirty = false;
            }

            // ── ADC Channel Polling ─────────────────────────────────────────
            // Poll analog voltages from components connected to Arduino A0–A5
            // and feed them into the AVR ADC so that analogRead() returns real values.
            // This was present in execute_old.ts but missing from the new runner.
            if (this.adc && this.cpu) {
                for (let i = 0; i < UNO_ANALOG_PINS.length; i++) {
                    const arduinoPin = UNO_ANALOG_PINS[i];
                    let voltage = 0;

                    const targetNet = this.pinToNet.get(`${this.boardId}:${arduinoPin}`) ?? 
                                      this.pinToNet.get(`${this.boardId}:A${i}`);

                    if (targetNet !== undefined) {
                        for (const [p, n] of this.pinToNet.entries()) {
                            if (n === targetNet && !p.startsWith(`${this.boardId}:`)) {
                                const [compId, pinId] = p.split(':');
                                const inst = this.instances.get(compId);
                                if (inst && typeof inst.getPinVoltage === 'function') {
                                    voltage = Math.max(voltage, inst.getPinVoltage(pinId) || 0);
                                }
                            }
                        }
                    } else {
                        // Fallback for single wires if netlist is missing
                        for (const w of this.currentWires) {
                            const [fromComp, fromPin] = w.from.split(':');
                            const [toComp, toPin] = w.to.split(':');

                            let isConnectedToPin = false;
                            let otherCompId = '';
                            let otherCompPin = '';

                            if (fromComp === this.boardId && (fromPin === arduinoPin || fromPin === `A${i}`)) {
                                isConnectedToPin = true;
                                otherCompId = toComp;
                                otherCompPin = toPin;
                            } else if (toComp === this.boardId && (toPin === arduinoPin || toPin === `A${i}`)) {
                                isConnectedToPin = true;
                                otherCompId = fromComp;
                                otherCompPin = fromPin;
                            }

                            if (isConnectedToPin) {
                                const inst = this.instances.get(otherCompId);
                                if (inst && typeof inst.getPinVoltage === 'function') {
                                    voltage = Math.max(voltage, inst.getPinVoltage(otherCompPin) || 0);
                                }
                            }
                        }
                    }
                    
                    if (i === 0 && this._dbgFrameCount % 60 === 0) {
                        console.log(`[ADC DBG] A0 targetNet=${targetNet} voltage=${voltage} pinToNet.size=${this.pinToNet.size}`);
                    }

                    this.adc.channelValues[i] = voltage;
                }
            }
            // Host/UART receive pacing: bytes per second = baud / 10 (8N1 frame)
            // bytes per ms = baud / 10000. We accumulate fractional budget over time.
            const bytesPerMs = this.serialBaudRate / 10000;
            this.serialByteBudget += deltaTime * bytesPerMs;

            if (this.serialBuffer.length > 0 && this.usart && this.serialByteBudget >= 1) {
                const maxBytes = Math.floor(this.serialByteBudget);
                const toSend = Math.min(maxBytes, this.serialBuffer.length);
                for (let i = 0; i < toSend; i++) {
                    this.usart.writeByte(this.serialBuffer.shift()!);
                }
                this.serialByteBudget -= toSend;
            }

            this.lastPhysicsMs = physicsMs;
            this.lastRunLoopMs = performance.now() - loopStart;

            // Cycle-Locked State Emission. Tuned to ~60Hz for lower stateGap.
            // this.emitStateIfDue(now); // Disabled. Handled by FLUSH_VISUALS from UI thread.
        }

        this._dbgFrameCount++;
        if (this._dbgFrameCount % 300 === 0) {
            const instArr = Array.from(this.instances.values());
            console.log(`[AVRRunner DBG] frame=${this._dbgFrameCount} instances=${instArr.length} running=${this.running} cycles=${this.cpu?.cycles}`);
            instArr.forEach(inst => {
                console.log(`  inst id=${inst.id} type=${inst.type} stateChanged=${inst.stateChanged} pendingEmit=${(inst as any).pendingVisualStateEmit} telemetryEnabled=${inst.telemetryEnabled} state=`, JSON.stringify(inst.state));
            });
            console.log(`  pinStates=`, JSON.stringify(this.pinStates));
        }

        setTimeout(this.runLoop, 1);
    }

    private emitStateIfDue(nowMs?: number) {
        if (!this.cpu) return;
        const now = nowMs || performance.now();
        const cycleDelta = this.cpu.cycles - this.lastStateEmitCycle;
        const timeDelta = now - this.lastStateEmitTime;

        // Emit if 16.6ms of simulated time passed (60Hz @ 16MHz)
        // OR if 16.6ms of real time passed (to keep UI smooth if simulation is slow)
        if (cycleDelta >= 266666 || timeDelta >= 16) {
            const msg: any = { type: 'state', boardId: this.boardId };
            msg.pins = this.pinStates;
            this.pinsChanged = false;
            
            if (this.adc) {
                msg.analog = Array.from(this.adc.channelValues);
            }

            const now = performance.now();
            const compStates: Array<{ id: string; state: any }> = [];
            for (const inst of this.instances.values()) {
                const pendingEmit = (inst as any).pendingVisualStateEmit;
                if (!inst.stateChanged && !pendingEmit && !inst.telemetryEnabled) continue;
                const syncState = getUnifiedComponentSyncState(inst);
                
                // Respect the component's sync policy to avoid overloading the UI
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
            msg.components = compStates;

            this.statusIntervalEmitCount++;
            msg._emitSeq = this.statusIntervalEmitCount;
            msg._emitTime = now;
            msg.simTimeMs = this.getSimulatedTimeMs();
            
            this.lastStateEmitCycle = this.cpu.cycles;
            this.lastStateEmitTime = now;
            this.onStateUpdate(msg);
        }
    }

    forceEmitState() {
        if (!this.cpu) return;
        const now = performance.now();
        const msg: any = { type: 'state', boardId: this.boardId };
        msg.pins = this.pinStates;
        this.pinsChanged = false;
        
        if (this.adc) {
            msg.analog = Array.from(this.adc.channelValues);
        }

        const compStates: Array<{ id: string; state: any }> = [];
        for (const inst of this.instances.values()) {
            const pendingEmit = (inst as any).pendingVisualStateEmit;
            if (!inst.stateChanged && !pendingEmit && !inst.telemetryEnabled) continue;
            
            const syncState = getUnifiedComponentSyncState(inst);
            
            // Respect the component's sync policy to avoid overloading the UI
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
        msg.components = compStates;

        this.statusIntervalEmitCount++;
        msg._emitSeq = this.statusIntervalEmitCount;
        msg._emitTime = now;
        msg.simTimeMs = this.getSimulatedTimeMs();
        
        this.lastStateEmitCycle = this.cpu.cycles;
        this.lastStateEmitTime = now;
        this.onStateUpdate(msg);
    }

    private serialBuffer: number[] = [];

    serialRx(data: string) {
        for (let i = 0; i < data.length; i++) {
            this.serialBuffer.push(data.charCodeAt(i));
            this.pulseBoardLed('0');
        }
    }

    serialRxByte(value: number) {
        this.serialBuffer.push(value & 0xff);
        this.pulseBoardLed('0');
    }

    softSerialRxByte(value: number) {
        this.scheduleSoftSerialRxFrame(value & 0xff);
        this.pulseBoardLed('0');
    }

    setSerialBaudRate(baud: number) {
        const parsed = Number(baud);
        if (!Number.isFinite(parsed)) return;
        const clamped = Math.max(300, Math.min(2000000, Math.floor(parsed)));
        this.serialBaudRate = clamped;
    }

    getSerialBaudRate(): number {
        return this.serialBaudRate;
    }

    private initPhysicsWorker() {}

    private requestPhysicsSolve() {}

    private updateTopologyForWorker() {}

    setSolverMode(mode: 'logic') {
        this.solverMode = mode;
        for (const key of Object.keys(this.pinStates)) {
            this.pinStates[key] = false;
        }
        for (const inst of this.instances.values()) {
            for (const pinId of Object.keys(inst.pins || {})) {
                inst.setPinVoltage(pinId, 0);
            }
        }
        this.pinsChanged = true;
        this.circuitDirty = true;
        this.topologyDirty = true;
    }

    private propagateBoardPin(pinId: string, isHigh: boolean) {
        const voltage = isHigh ? 5.0 : 0.0;
        const endpoints = this.getProtocolEndpointsForArduinoPin(pinId);

        const boardInst = this.instances.get(this.boardId);
        if (boardInst) {
            boardInst.onPinStateChange(pinId, isHigh, this.cpu!.cycles);
        }

        for (const endpoint of endpoints) {
            endpoint.inst.setPinVoltage(endpoint.pinId, voltage);
            if (endpoint.inst.pins?.[endpoint.pinId]) {
                endpoint.inst.pins[endpoint.pinId].isHigh = !!isHigh;
                endpoint.inst.pins[endpoint.pinId].voltage = voltage;
            }
            endpoint.inst.onPinStateChange(endpoint.pinId, isHigh, this.cpu!.cycles);
        }
    }

    setSpeed(speed: number) {
        const s = Number(speed);
        if (Number.isFinite(s) && s > 0) {
            this.speed = s;
        }
    }

    stop() {
        const neopixelStates = collectNeopixelShutdownStates(this.instances);
        if (neopixelStates.length > 0) {
            this.onStateUpdate({ type: 'state', boardId: this.boardId, components: neopixelStates });
        }
        this.running = false;
        clearInterval(this.statusInterval);
    }

    reset() {
        if (this.cpu) this.cpu.reset();
        this.softSerialNextInjectCycle = 0;
        this.softSerialDecodeState = {
            receiving: false,
            sampleCycle: 0,
            sampleIndex: 0,
            currentByte: 0,
            lastLevel: true,
        };
        this.setSoftSerialRxLevel(true);
        this.protocolEndpointsCache.clear();
        this.pwmState.clear();
        this.oneWireState.clear();
        this.componentSyncMeta.clear();
    }

    // ——— SPI: chip-select awareness ———————————————————————————————————
    /**
     * Returns true if the component should receive the current SPI byte.
     * A component is selected when:
     *   • It has no CS/SS pin  (single-slave wiring → always selected), OR
     *   • Its CS/SS pin voltage is < 0.5 V  (active-LOW chip select)
     */
    private isSPISelected(inst: BaseComponent): boolean {
        const csNames = ['cs', 'ce', 'ss', 'ssel', 'nss', 'csn', 'cs_n', 'nce'];
        for (const name of csNames) {
            if (inst.pins[name])             return inst.getPinVoltage(name) < 0.5;
            if (inst.pins[name.toUpperCase()]) return inst.getPinVoltage(name.toUpperCase()) < 0.5;
        }
        return true; // no CS pin → always selected
    }

    // ——— I2S: bit-bang frame assembler ————————————————————————————————
    /**
     * Called from the pin-change traversal whenever any component has a pin
     * voltage updated.  If the changed pin is the component's BCLK or WS line
     * (matched by common I2S naming conventions), the assembler clocks one bit
     * into a shift buffer.  Once bitsPerFrame bits have been collected for one
     * channel, onI2SFrame() is called.
     *
     * Left-justified format (no WS-delay):
     *   WS=LOW  → left  channel (channel 0)
     *   WS=HIGH → right channel (channel 1)
     * Data is sampled on the BCLK **rising** edge, MSB first.
     */
    private tickI2S(inst: BaseComponent, compId: string, changedPin: string, isHigh: boolean): void {
        if (!inst.onI2SFrame) return;

        const pin    = changedPin.toLowerCase();
        const isBclk = pin === 'bclk' || pin === 'sck' || pin === 'bit_clk' || pin === 'blck';
        const isWs   = pin === 'ws'   || pin === 'lrck' || pin === 'wsel'   || pin === 'lrc';

        if (!isBclk && !isWs) return;

        if (!this.i2sState.has(compId)) {
            this.i2sState.set(compId, { bclkLast: false, wsLast: false, shiftBuf: 0, bitCount: 0 });
        }
        const state = this.i2sState.get(compId)!;

        if (isWs) {
            if (state.wsLast !== isHigh) {
                // WS edge → end of the current-channel frame
                const bpf = (inst.state?.i2sBitsPerFrame as number | undefined) ?? 16;
                if (state.bitCount >= bpf) {
                    const channel = state.wsLast ? 1 : 0;
                    const sample  = (state.shiftBuf << (32 - bpf)) | 0; // sign-extend
                    inst.onI2SFrame(channel, sample, bpf);
                }
                state.wsLast   = isHigh;
                state.shiftBuf = 0;
                state.bitCount = 0;
            }
            return;
        }

        // BCLK edge
        const rising = isHigh && !state.bclkLast;
        state.bclkLast = isHigh;

        if (rising) {
            // Sample SDATA (accept several common pin names)
            const sdPin = this.findI2SPinName(inst, ['sdata', 'sdin', 'din', 'sd', 'dout', 'data']);
            const bit   = sdPin !== null ? (inst.getPinVoltage(sdPin) > 0.5 ? 1 : 0) : 0;

            const bpf = (inst.state?.i2sBitsPerFrame as number | undefined) ?? 16;
            state.shiftBuf = ((state.shiftBuf << 1) | bit) >>> 0;
            state.bitCount++;

            if (state.bitCount >= bpf) {
                const channel = state.wsLast ? 1 : 0;
                const sample  = (state.shiftBuf << (32 - bpf)) | 0;
                inst.onI2SFrame(channel, sample, bpf);
                state.shiftBuf = 0;
                state.bitCount = 0;
            }
        }
    }

    /** Finds the first existing pin on `inst` from a list of candidate names
     *  (case-insensitive, lower then UPPER checked). */
    private findI2SPinName(inst: BaseComponent, candidates: string[]): string | null {
        for (const name of candidates) {
            if (inst.pins[name])               return name;
            if (inst.pins[name.toUpperCase()]) return name.toUpperCase();
        }
        return null;
    }

    private getArduinoPinAliases(pinId: string): string[] {
        const raw = String(pinId || '').toUpperCase();
        const out = new Set<string>([raw]);
        if (/^D\d+$/.test(raw)) {
            out.add(raw.slice(1));
        } else if (/^\d+$/.test(raw)) {
            out.add(`D${raw}`);
        }
        return Array.from(out);
    }

    private getProtocolEndpointsForArduinoPin(pinId: string): ConnectedComponentPin[] {
        const key = String(pinId || '').toUpperCase();
        const cached = this.protocolEndpointsCache.get(key);
        if (cached) return cached;

        const endpoints = collectConnectedComponentPins(
            this.boardId,
            this.getArduinoPinAliases(key),
            this.currentWires,
            this.instances
        );
        this.protocolEndpointsCache.set(key, endpoints);
        return endpoints;
    }

    private dispatchOptionalPwm(pinId: string, isHigh: boolean, cycles: number) {
        const key = String(pinId || '').toUpperCase();
        let state = this.pwmState.get(key);
        if (!state) {
            state = { lastRiseCycle: -1, lastFallCycle: -1, lastPeriodCycles: -1 };
            this.pwmState.set(key, state);
        }

        let frequencyHz = 0;
        let dutyCycle = 0;
        let pulseUs = 0;
        let periodUs = 0;

        if (isHigh) {
            if (state.lastRiseCycle >= 0 && state.lastFallCycle > state.lastRiseCycle) {
                const periodCycles = Math.max(1, cycles - state.lastRiseCycle);
                const highCycles = Math.max(0, state.lastFallCycle - state.lastRiseCycle);
                state.lastPeriodCycles = periodCycles;
                frequencyHz = 16_000_000 / periodCycles;
                dutyCycle = Math.max(0, Math.min(1, highCycles / periodCycles));
                periodUs = periodCycles / 16;
                pulseUs = highCycles / 16;
            }
            state.lastRiseCycle = cycles;
        } else {
            state.lastFallCycle = cycles;
            if (state.lastRiseCycle >= 0) {
                const highCycles = Math.max(0, cycles - state.lastRiseCycle);
                pulseUs = highCycles / 16;
                if (state.lastPeriodCycles > 0) {
                    frequencyHz = 16_000_000 / state.lastPeriodCycles;
                    dutyCycle = Math.max(0, Math.min(1, highCycles / state.lastPeriodCycles));
                    periodUs = state.lastPeriodCycles / 16;
                }
            }
        }

        if (frequencyHz <= 0 && dutyCycle <= 0 && pulseUs <= 0) return;

        const meta = {
            protocol: 'pwm',
            boardPin: key,
            isHigh,
            frequencyHz,
            dutyCycle,
            pulseUs,
            periodUs,
            source: 'gpio',
            cycles,
        };

        for (const endpoint of this.getProtocolEndpointsForArduinoPin(key)) {
            invokeOptional(endpoint.inst as any, ['onPWM', 'onPwm', 'onPWMSignal'], [endpoint.pinId, meta]);
        }
    }

    private dispatchOptionalOneWire(pinId: string, isHigh: boolean, cycles: number) {
        const key = String(pinId || '').toUpperCase();
        let state = this.oneWireState.get(key);
        if (!state) {
            state = { lowStartCycle: null, highStartCycle: null };
            this.oneWireState.set(key, state);
        }

        const endpoints = this.getProtocolEndpointsForArduinoPin(key);
        if (!endpoints.length) {
            if (isHigh) {
                state.lowStartCycle = null;
                state.highStartCycle = cycles;
            } else {
                state.highStartCycle = null;
                state.lowStartCycle = cycles;
            }
            return;
        }

        if (!isHigh) {
            if (state.highStartCycle != null) {
                const highCycles = Math.max(0, cycles - state.highStartCycle);
                const highUs = highCycles / 16;
                if (highUs > 0) {
                    const pulseMeta = {
                        protocol: 'pulse',
                        boardPin: key,
                        pulseUs: highUs,
                        highUs,
                        edge: 'falling',
                        cycles,
                    };
                    for (const endpoint of endpoints) {
                        invokeOptional(endpoint.inst as any, ['onPulseHigh', 'onDigitalPulseHigh', 'onOneWirePulseHigh'], [endpoint.pinId, pulseMeta]);
                    }
                }
            }

            state.highStartCycle = null;
            state.lowStartCycle = cycles;
            return;
        }

        if (state.lowStartCycle == null) return;

        const lowCycles = Math.max(0, cycles - state.lowStartCycle);
        state.lowStartCycle = null;
        state.highStartCycle = cycles;
        const lowUs = lowCycles / 16;

        if (lowUs > 0) {
            const pulseMeta = {
                protocol: 'pulse',
                boardPin: key,
                pulseUs: lowUs,
                lowUs,
                edge: 'rising',
                cycles,
            };
            for (const endpoint of endpoints) {
                invokeOptional(endpoint.inst as any, ['onPulseLow', 'onDigitalPulseLow', 'onOneWirePulseLow'], [endpoint.pinId, pulseMeta]);
            }
        }

        if (lowUs >= 360) {
            const meta = {
                protocol: 'onewire',
                boardPin: key,
                pulseUs: lowUs,
                kind: 'reset',
                cycles,
            };
            for (const endpoint of endpoints) {
                invokeOptional(endpoint.inst as any, ['onOneWireReset', 'onOnewireReset'], [endpoint.pinId, meta]);
            }
            return;
        }

        if (lowUs >= 1 && lowUs <= 120) {
            const bit = lowUs < 20 ? 1 : 0;
            const meta = {
                protocol: 'onewire',
                boardPin: key,
                pulseUs: lowUs,
                kind: 'slot',
                bit,
                cycles,
            };
            for (const endpoint of endpoints) {
                invokeOptional(endpoint.inst as any, ['onOneWireWriteBit', 'onOnewireWriteBit'], [endpoint.pinId, bit, meta]);
                invokeOptional(endpoint.inst as any, ['onOneWireSlot', 'onOnewireSlot'], [endpoint.pinId, meta]);
            }
        }
    }

    private dispatchOptionalProtocols(pinId: string, isHigh: boolean, cycles: number) {
        this.dispatchOptionalPwm(pinId, isHigh, cycles);
        this.dispatchOptionalOneWire(pinId, isHigh, cycles);
    }

    private netHasResistor = new Set<number>();

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

                    // Also set aliases (D11, 11 etc)
                    const parts = node.split(':');
                    if (parts.length === 2) {
                        const compId = parts[0];
                        const pinId = parts[1];
                        const upperPin = pinId.toUpperCase();
                        if (!pinId.startsWith('D') && !pinId.startsWith('A') && /^\d+$/.test(pinId)) {
                            this.pinToNet.set(`${compId}:D${pinId}`, currentNet);
                        } else if (pinId.startsWith('D')) {
                            this.pinToNet.set(`${compId}:${pinId.substring(1)}`, currentNet);
                        }

                        // Normalize common board power aliases to the same electrical net.
                        if (upperPin === 'GND' || /^GND[._]?\d+$/.test(upperPin)) {
                            this.pinToNet.set(`${compId}:GND`, currentNet);
                            this.pinToNet.set(`${compId}:gnd_1`, currentNet);
                            this.pinToNet.set(`${compId}:gnd_2`, currentNet);
                            this.pinToNet.set(`${compId}:gnd_3`, currentNet);
                            this.pinToNet.set(`${compId}:GND.1`, currentNet);
                            this.pinToNet.set(`${compId}:GND.2`, currentNet);
                        }
                        if (upperPin === '5V' || upperPin === 'VCC') {
                            this.pinToNet.set(`${compId}:5V`, currentNet);
                            this.pinToNet.set(`${compId}:VCC`, currentNet);
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

        // Identify nets that contain a resistor pin
        this.netHasResistor.clear();
        for (const [id, inst] of this.instances) {
            if (inst.type === 'openhw-resistor' || inst.type === 'openhw-resistor') {
                const n1 = this.pinToNet.get(`${id}:p1`);
                const n2 = this.pinToNet.get(`${id}:p2`);
                if (n1 !== undefined) this.netHasResistor.add(n1);
                if (n2 !== undefined) this.netHasResistor.add(n2);
            }
        }
        (this as any).topologyDirty = true;
    }


    private arePinsConnected(pinA: string, pinB: string): boolean {
        const netA = this.pinToNet.get(pinA);
        const netB = this.pinToNet.get(pinB);
        return netA !== undefined && netA === netB;
    }
}
