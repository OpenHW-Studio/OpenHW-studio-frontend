import { CPU, timer0Config, timer1Config, timer2Config, AVRTimer, avrInstruction, AVRADC, adcConfig, AVRUSART, usart0Config, AVRTWI, twiConfig, AVRSPI, spiConfig, AVRIOPort, portAConfig, portBConfig, portCConfig, portDConfig, portEConfig, portFConfig, portGConfig, portHConfig, portJConfig, portKConfig, portLConfig, PinState } from 'avr8js';
import { megaTimer0Config, megaTimer1Config, megaTimer2Config, megaTimer3Config, megaTimer4Config, megaTimer5Config, megaUsart0Config, megaAdcConfig, megaTwiConfig, megaSpiConfig } from './mega-timers.ts';
import { BaseComponent } from '@openhw/emulator';
import { UNO_DIGITAL_PINS, UNO_ANALOG_PINS } from '../board-profiles.ts';
import { parse } from '../fs/fs-builders.ts';
import { SabStateWriter, SabCommandReader, SabEventWriter, SabPinWriter, SabDebugWriter, SabSerialRing, SabDisplayWriter, SabProtocolWriter, sabKindForType } from '../sab/layout.ts';
import { DebugService } from '../debug/service.ts';
import { SabTransport } from '../hal/transport.ts';
import type { SimTransport } from '../hal/types.ts';
import { encodeProtocolRecord, PROTO_BUS_SPI, i2cRecord } from '../hal/protocol-frames.ts';
import { matchBoardFamily } from '../boards-registry.ts';
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
import {
    normalizeEndpointPin,
    buildNetGraph,
    traversePassive as traversePassiveShared,
} from '../signal/electrical.ts';
import type { PassiveInstance } from '../signal/electrical.ts';

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
    // SAB state river (§12.2): assigned from options at construction.
    // AVR previously ignored sab entirely — now stored like RP2040/proxy.
    private sab: SharedArrayBuffer | null = null;
    private sabOffsets: Record<string, number> = {};
    private sabWriter: SabStateWriter | null = null;
    private sabPinWriter: SabPinWriter | null = null;
    private sabDebugWriter: SabDebugWriter | null = null;
    private sabSerialTx: SabSerialRing | null = null;
    private sabSerialRx: SabSerialRing | null = null;
    private sabDisplayWriter: SabDisplayWriter | null = null;
    private sabPinIndex: Map<string, number> = new Map();
    // Transport facade (plan §5.4): publish paths migrate here; physics
    // (netlist, repropagate, peripheral adapters) stays AVR-owned.
    private transport: SimTransport | null = null;
    // Protocol-lane writer (plan §11.1): I2C/SPI transaction summaries.
    // Null when the region is absent (pre-v3 buffers); every push guarded.
    private sabProtoWriter: SabProtocolWriter | null = null;
    // Board type for registry lookups (capabilities/limits/HAL surface).
    private boardType = '';
    // Command/event rings + debug service (§10.4/§10.7). All optional:
    // absent buffers → postMessage control path unchanged (fallback).
    private cmdReader: SabCommandReader | null = null;
    private evtWriter: SabEventWriter | null = null;
    /** Worker-owned debug service (public for DEBUG_STEP fallback queueing). */
    public debugService: DebugService | null = null;

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
        const fallbackBoard = (componentsDef || []).find((c: any) => /(arduino|rp2040|pico)/i.test(String(c.type || '')));
        this.boardId = options.boardId || fallbackBoard?.id || 'openhw-arduino-uno_0';
        this.boardType = String((options as any)?.boardType || (componentsDef || []).find((c: any) => String(c?.id) === String(this.boardId))?.type || '');
        this.setSerialBaudRate(options.serialBaudRate ?? 9600);

        const isMega = this.boardId.toLowerCase().includes('mega');

        // Setup memory and CPU
        const program = isMega ? new Uint16Array(131072) : new Uint16Array(32768);
        const { data } = parse(hexData);
        const u8 = new Uint8Array(program.buffer);
        u8.set(data);
        const preview = Array.from(data.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`AVRRunner: Flashed ${data.length} bytes. Start: [${preview}]`);

        this.cpu = new CPU(program, 0x2200);
        this.cpuCyclesAtStart = this.cpu.cycles;

        if (isMega) {
            console.log(`AVRRunner: Initializing MEGA peripherals. Usart config:`, megaUsart0Config);
            this.timers = [
                new AVRTimer(this.cpu, megaTimer0Config),
                new AVRTimer(this.cpu, megaTimer1Config),
                new AVRTimer(this.cpu, megaTimer2Config),
                new AVRTimer(this.cpu, megaTimer3Config),
                new AVRTimer(this.cpu, megaTimer4Config),
                new AVRTimer(this.cpu, megaTimer5Config),
            ];
            this.adc = new AVRADC(this.cpu, megaAdcConfig);
            this.usart = new AVRUSART(this.cpu, megaUsart0Config, 16e6);
            this.twi = new AVRTWI(this.cpu, megaTwiConfig, 16e6);
            this.spi = new AVRSPI(this.cpu, megaSpiConfig, 16e6);
        } else {
            this.timers = [
                new AVRTimer(this.cpu, timer0Config),
                new AVRTimer(this.cpu, timer1Config),
                new AVRTimer(this.cpu, timer2Config),
            ];
            this.adc = new AVRADC(this.cpu, adcConfig);
            this.usart = new AVRUSART(this.cpu, usart0Config, 16e6);
            this.twi = new AVRTWI(this.cpu, twiConfig, 16e6);
            this.spi = new AVRSPI(this.cpu, spiConfig, 16e6);
        }

        this.usart.onByteTransmit = (value) => {
            const char = String.fromCharCode(value);
            this.pulseBoardLed('1');
            // Serial TX via transport (SAB ring when bound; postMessage path
            // below stays authoritative on overflow/strings).
            try { (this.transport as SimTransport | null)?.publishSerial(this.boardId, [value & 0xff], 'uart0'); } catch { /* ignore */ }
            if (this.onByteTransmitCb) {
                this.onByteTransmitCb({ boardId: this.boardId, value, char, source: 'uart0' });
            } else {
                this.onStateUpdate({ type: 'serial', data: char, value, boardId: this.boardId, source: 'uart0' });
            }
        };

        // SAB river attach (§12.2): store shared buffer + per-component slots.
        // Accepts both new layout (sabOffsets = slot indexes) and legacy
        // byte-offset maps (converted via /64 stride) for compat.
        this.sab = (options as any).sab || null;
        const rawOffsets = (options as any).sabOffsets || {};
        this.sabOffsets = {};
        for (const key of Object.keys(rawOffsets)) {
            const v = Number(rawOffsets[key]);
            this.sabOffsets[key] = Number.isFinite(v) && v >= 64 ? Math.floor(v / 64) : (Number.isFinite(v) ? v : 0);
        }
        if (this.sab) {
            try {
                this.sabWriter = new SabStateWriter(this.sab as SharedArrayBuffer);
            } catch { this.sabWriter = null; }
            // Full-map writers (§10.4): pin bitfield + debug region.
            // Geometry comes from the START alloc (options.sabGeometry /
            // options.sabDebugOffset); absent = legacy alloc, writers null.
            try {
                const sabBuf2 = (this as any).sab as SharedArrayBuffer | null;
                if (sabBuf2) {
                    const pinWriter = new SabPinWriter(sabBuf2);
                    const geo = (options as any)?.sabGeometry as any;
                    if (geo && Number(geo.pinBitWords) > 0) {
                        pinWriter.bindGeometry(Number(geo.pinBitWords), Number(geo.analogBase));
                        (this as any).sabPinWriter = pinWriter;
                    }
                    const dbgOff = Number((options as any)?.sabDebugOffset);
                    if (Number.isFinite(dbgOff) && dbgOff > 0) {
                        (this as any).sabDebugWriter = new SabDebugWriter(sabBuf2, dbgOff);
                    }
                    // Serial TX/RX byte rings (§10.4): bound when the START
                    // alloc laid them out; absent = postMessage serial path.
                    try {
                        const rxOff = Number((options as any)?.sabSerialRxOffset);
                        const txOff = Number((options as any)?.sabSerialTxOffset);
                        if (Number.isFinite(rxOff) && rxOff > 0) {
                            (this as any).sabSerialRx = new SabSerialRing(sabBuf2, rxOff);
                        }
                        if (Number.isFinite(txOff) && txOff > 0) {
                            (this as any).sabSerialTx = new SabSerialRing(sabBuf2, txOff);
                        }
                    } catch { /* serial rings stay null */ }
                    // Display descriptors (§10.4, slot-oriented, never pixels).
                    try {
                        const ddOff = Number((options as any)?.sabDisplayDescOffset);
                        if (Number.isFinite(ddOff) && ddOff > 0) {
                            (this as any).sabDisplayWriter = new SabDisplayWriter(sabBuf2, ddOff);
                        }
                    } catch { /* display writer stays null */ }
                    // Pin index: board pin order fixed at START (boardPinMaps).
                    try {
                        const maps = (options as any)?.boardPinMaps;
                        const myMap = Array.isArray(maps)
                            ? maps.find((m: any) => String(m?.boardId) === String((this as any).boardId))
                              || maps[0]
                            : null;
                        const pins = myMap && Array.isArray(myMap.pins) ? myMap.pins : [];
                        const idx = new Map<string, number>();
                        pins.forEach((p: any, i: number) => { idx.set(String(p), i); });
                        (this as any).sabPinIndex = idx;
                    } catch { /* pin index stays empty */ }
                }
            } catch { /* writers stay null */ }
        }
        // Command/event ring attach (§10.4): buffers shared from START alloc.
        // DebugService owns HALT/STEP/WATCH state; runners apply movement cmds.
        try {
            const cmdBuf = (options as any).cmdBuffer as SharedArrayBuffer | undefined;
            const evtBuf = (options as any).evtBuffer as SharedArrayBuffer | undefined;
            if (cmdBuf) this.cmdReader = new SabCommandReader(cmdBuf);
            if (evtBuf) this.evtWriter = new SabEventWriter(evtBuf);
            if (this.sab && (this.cmdReader || this.evtWriter)) {
                this.debugService = new DebugService(this.sab as SharedArrayBuffer, { ...this.sabOffsets }, this.evtWriter);
            }
            // Transport facade + protocol writer (plan §5.4/§11.1). Built
            // AFTER all rings attach so it binds the final handles; same
            // writers, same order — behavior identical to direct calls.
            try {
                if (this.sab) {
                    (this as any).sabProtoWriter = new SabProtocolWriter(this.sab as SharedArrayBuffer);
                    (this as any).transport = new SabTransport({
                        buffer: this.sab as SharedArrayBuffer,
                        pinIndex: (this as any).sabPinIndex,
                        pinWriter: (this as any).sabPinWriter || undefined,
                        stateWriter: (this as any).sabWriter || undefined,
                        serialTx: (this as any).sabSerialTx || undefined,
                        evtWriter: this.evtWriter || undefined,
                        cmdReader: this.cmdReader || undefined,
                        railVoltage: 5.0,
                        clock: () => performance.now(),
                    });
                }
            } catch { (this as any).transport = null; (this as any).sabProtoWriter = null; }
        } catch { this.cmdReader = null; this.evtWriter = null; this.debugService = null; }

        // Instantiate components
        (componentsDef || []).forEach(cDef => {
            const LogicClass = LOGIC_REGISTRY[cDef.type];
            if (LogicClass) {
                // Pins: manifest-of-record is the emulator manifest.json; the
                // COMPONENT_PINS table is a stale fallback only (drift audit:
                // 25/67 openhw types differ — manifests win, see §6).
                const logicProbe = LOGIC_REGISTRY[cDef.type];
                const manifestPins = (logicProbe as any)?.manifest?.pins
                    || (cDef as any)?.pins
                    || COMPONENT_PINS[cDef.type]
                    || [{ id: 'A' }, { id: 'K' }, { id: 'GND' }, { id: 'VSS' }];
                const pins = manifestPins;
                const manifest = { type: cDef.type, attrs: cDef.attrs || {}, pins };
                const inst = new LogicClass(cDef.id, manifest);
                // Slot assignment: declared upfront on BaseComponent (shape-stable).
                const slot = this.sabOffsets[cDef.id];
                inst.sabSlot = Number.isFinite(Number(slot)) ? Number(slot) : -1;
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
                // WASM components (§12.4): lazy async core load, never in tick.
                // Falls back to JS reference on failure — fire-and-forget.
                try {
                    const maybeWasm = (inst as any)?.ensureWasmLoaded;
                    if (typeof maybeWasm === 'function') {
                        Promise.resolve(maybeWasm.call(inst)).catch(() => { /* JS fallback */ });
                    }
                } catch { /* JS fallback */ }
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
        // Protocol-lane writer handle (null when region absent; every push
        // below is guarded so pre-v3 buffers behave exactly as before).
        const runnerProtoWriter = (this as any).sabProtoWriter as SabProtocolWriter | null;

        // Setup I2C Hooks bridging AVRTWI events to BaseComponents
        class TWIAdapter {
            // Track the addressed slave across the read transaction
            private activeSlave: BaseComponent | null = null;
            private currentBuffer: number[] = [];

            constructor(private twi: AVRTWI, private instances: Map<string, BaseComponent>, private simCycles: () => number) { }

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
                    // Protocol-lane record (plan §11.1): same transaction as
                    // a fixed 32 B summary; silent no-op when region absent.
                    try {
                        runnerProtoWriter?.push(i2cRecord(
                            address, data.length, !isWrite,
                            this.activeSlave !== null, this.simCycles(),
                        ));
                    } catch { /* never break sim */ }
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

        this.twi.eventHandler = new TWIAdapter(this.twi, this.instances, () => this.cpu?.cycles ?? 0);

        let spiTransactionBytes: number[] = [];
        let lastSpiTime = 0;

        // Setup SPI Hooks bridging AVRSPI to BaseComponents
        this.spi.onByte = (value: number) => {
            const nowMs = this.getSimulatedTimeMs();
            if (nowMs - lastSpiTime > 2.0 && spiTransactionBytes.length > 0) {
                const frame = [...spiTransactionBytes];
                this.onStateUpdate({
                    type: 'protocol:spi',
                    boardId: this.boardId,
                    data: frame,
                    timestamp: lastSpiTime
                });
                // Protocol-lane record (plan §11.1): command/first byte,
                // length, last byte; guarded no-op when region absent.
                try {
                    runnerProtoWriter?.push(encodeProtocolRecord({
                        bus: PROTO_BUS_SPI, flags: 0,
                        address: frame[0] ?? 0, v0: frame.length,
                        v1: frame.length ? frame[frame.length - 1] : 0,
                        cycles: this.cpu?.cycles ?? 0, wallMs: Date.now(),
                    }));
                } catch { /* never break sim */ }
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

        // Initialize _simCpu / _simUpdatePhysics on all component instances BEFORE the first
        // CPU chunk runs, so that components (e.g. HC-SR04) can use addClockEvent immediately.
        if (this.cpu && typeof (this.cpu as any).addClockEvent !== 'function') {
            (this.cpu as any).addClockEvent = (cb: () => void, delayCycles: number) => {
                this.clockEvents.push({ targetCycle: this.cpu!.cycles + delayCycles, callback: cb });
            };
        }
        this.instances.forEach((inst, compId) => {
            if (!(inst as any)._simCpu) {
                (inst as any)._simCpu = this.cpu;
                (inst as any)._simUpdatePhysics = this.repropagateAllVoltages;
            }
            if (this.cpu) {
                (this.cpu as any)._avrRunner = this;
            }
            // Inject _setAvrPinDirect for components (like DHT22) that need
            // to directly drive an AVR input pin during bit-banged protocols.
            // IMPORTANT: do NOT update this.pinStates here. pinStates must only
            // reflect what the Arduino CPU last drove. If we update it here (on
            // behalf of the DHT), the attachPort listener will see no change when
            // the Arduino later pulls the same pin LOW, and will skip calling
            // updateOopPin — so the DHT never receives the LOW wake signal.
            if (!(inst as any)._setAvrPinDirect) {
                (inst as any)._setAvrPinDirect = (boardPin: string, isHigh: boolean) => {
                    const cleanPin = boardPin.replace(/^D/i, '');
                    const num = parseInt(cleanPin, 10);
                    if (!isNaN(num)) {
                        if (num >= 8 && num <= 13) {
                            this.portB?.setPin(num - 8, isHigh);
                        } else if (num >= 0 && num <= 7) {
                            this.portD?.setPin(num, isHigh);
                        }
                    } else if (cleanPin.startsWith('A')) {
                        const bit = parseInt(cleanPin.slice(1), 10);
                        if (!isNaN(bit)) this.portC?.setPin(bit, isHigh);
                    }
                };
            }
            // Runner-agnostic board-drive service (plan §5.3): same effect
            // as the closure above, routed through the public driveInput
            // path so components stop depending on AVR-only handles.
            // Runner-agnostic bus services (plan §5.3); legacy handles above
            // remain as fallback.
            this.provideBusServices(inst, compId);
            // Expose runner ref so DHT22 can resolve board pin from netlist
            if ((inst as any)._simCpu && !(inst as any)._simCpu._avrRunner) {
                (inst as any)._simCpu._avrRunner = this;
            }
        });

        this.running = true;
        this.lastTime = performance.now();
        this.lastStateEmitTime = this.lastTime;
        this.runLoop();
    }

    getSimulatedTimeMs() {
        if (!this.cpu) return 0;
        return Math.floor(((this.cpu.cycles - this.cpuCyclesAtStart) / 16_000_000) * 1000);
    }

    // ── Board HAL surface (plan §5.1) ──────────────────────────────────
    // Read-only capability + sampling surface over existing AVR state.
    // driveInput reuses the component input path (port set + repropagate),
    // the same mechanism DHT22/OneWire already use via _setAvrPinDirect.
    // Callers must check sampleOutput().driving first and never drive a
    // firmware-driven pin (output wins — same rule as every other runner).
    railVoltage(): number {
        return 5.0;
    }

    boardPins(): string[] {
        return [...UNO_DIGITAL_PINS, ...UNO_ANALOG_PINS];
    }

    pinAliases(pin: string): string[] {
        const raw = String(pin || '');
        const out = new Set<string>([raw]);
        if (/^D\d+$/i.test(raw)) out.add(raw.substring(1));
        else if (/^\d+$/.test(raw)) out.add(`D${raw}`);
        return Array.from(out);
    }

    boardCapabilities(): string[] {
        return matchBoardFamily(this.boardType || this.boardId).capabilities;
    }

    boardLimits(): Array<{ code: string; detail: string }> {
        return matchBoardFamily(this.boardType || this.boardId).limits;
    }

    sampleOutput(pin: string): { level: number; driving: boolean } | null {
        const clean = String(pin || '').replace(/^D/i, '');
        let port: AVRIOPort | null = null;
        let bit = -1;
        const num = parseInt(clean, 10);
        if (!isNaN(num)) {
            if (num >= 8 && num <= 13) { port = this.portB; bit = num - 8; }
            else if (num >= 0 && num <= 7) { port = this.portD; bit = num; }
        } else if (clean.startsWith('A')) {
            const parsed = parseInt(clean.slice(1), 10);
            if (!isNaN(parsed)) { port = this.portC; bit = parsed; }
        }
        if (!port || bit < 0 || !this.cpu) return null;
        let state: PinState;
        try { state = port.pinState(bit); } catch { return null; }
        const driving = state === PinState.High || state === PinState.Low;
        const level = driving
            ? (state === PinState.High ? 1 : 0)
            : (state === PinState.InputPullUp ? 1 : 0);
        return { level, driving };
    }

    driveInput(pin: string, high: boolean): void {
        const cleanPin = String(pin || '').replace(/^D/i, '');
        const num = parseInt(cleanPin, 10);
        try {
            if (!isNaN(num)) {
                if (num >= 8 && num <= 13) this.portB?.setPin(num - 8, high);
                else if (num >= 0 && num <= 7) this.portD?.setPin(num, high);
            } else if (cleanPin.startsWith('A')) {
                const bit = parseInt(cleanPin.slice(1), 10);
                if (!isNaN(bit)) this.portC?.setPin(bit, high);
            }
            if (typeof this.repropagateAllVoltages === 'function') this.repropagateAllVoltages();
        } catch { /* input inject never breaks sim */ }
    }

    setTelemetryEnabled(enabled: boolean, mode?: string, watchedParamsMap?: Record<string, string[]>, deepSilicon?: boolean) {
        for (const inst of this.instances.values()) {
            (inst as any).telemetryEnabled = !!enabled;
            (inst as any).telemetryMode = mode || 'detail';
            (inst as any).telemetryWatchedParams = watchedParamsMap?.[inst.id] || ['all'];
            (inst as any).deepSiliconEnabled = !!deepSilicon;
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

    /** Provide runner-agnostic bus services to one instance (plan §5.3).
     * Fills only missing handles; legacy AVR handles stay installed by the
     * surrounding code as fallback. Safe to call every tick (idempotent). */
    private provideBusServices(inst: BaseComponent, compId: string): void {
        try {
            if (!(inst as any)._driveBoardPin) {
                (inst as any)._driveBoardPin = (boardPin: string, isHigh: boolean) => {
                    try { this.driveInput(boardPin, isHigh); } catch { /* ignore */ }
                };
            }
            if (!(inst as any)._scheduleBoardCycles) {
                (inst as any)._scheduleBoardCycles = (cb: () => void, delayCycles: number) => {
                    try { (this.cpu as any)?.addClockEvent?.(cb, delayCycles); } catch { /* ignore */ }
                };
            }
            if (!(inst as any)._boardCyclesNow) {
                (inst as any)._boardCyclesNow = () => this.cpu?.cycles ?? 0;
            }
            if (!(inst as any)._boardNetOf) {
                (inst as any)._boardNetOf = (componentPin: string): string | null => {
                    try {
                        const net = this.pinToNet.get(`${compId}:${componentPin}`);
                        if (net === undefined) return null;
                        for (const [node, netId] of this.pinToNet) {
                            if (netId !== net) continue;
                            const [bId, bPin] = node.split(':');
                            if (bId !== this.boardId || !bPin) continue;
                            return /^D\d+$/i.test(bPin) ? bPin.substring(1) : bPin;
                        }
                        return null;
                    } catch { return null; }
                };
            }
        } catch { /* provider install never breaks sim */ }
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
        try { (this.transport as SimTransport | null)?.publishSerial(this.boardId, [byte], 'softserial'); } catch { /* ignore */ }
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
        // Shared implementation (plan §5.3): identical semantics, parity-
        // tested in tests/unit/worker/signal-electrical.test.mjs. AVR keeps
        // its own orchestration (rails, pullups, port gating) in
        // updateOopPin/repropagateAllVoltages below.
        traversePassiveShared(inst, compId, pinId, voltage, visit, (id, type) => getInternalBridgesForComponent(id, type));
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

            const normalizePin = normalizeEndpointPin; // shared (plan §5.3)

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
            const visitedEdges = new Set<string>();
            const visitedNodes = new Set<string>();

            const normalizePin = normalizeEndpointPin; // shared (plan §5.3)

            const visitNode = (rawNode: string, v: number) => {
                const node = normalizePin(rawNode);
                if (visitedNodes.has(node)) return;

                const [compId, compPin] = node.split(':');
                const isMainBoard = compId === this.boardId || compId === 'arduino' || compId === 'uno' || compId === 'board';

                // Do not allow passive back-propagation to overwrite constant board power reference pins (GND, 5V, 3V3, VIN)
                if (isMainBoard && rawNode !== `${compId}:${arduinoPinStr}`) {
                    const upper = compPin.toUpperCase();
                    if (upper === 'GND' || /^GND[._:]?\d+$/.test(upper) || upper === '5V' || upper === '3V3' || upper === 'VIN') {
                        return;
                    }
                }

                // When propagating from a board power rail, do NOT propagate back into board digital/analog pins
                // if they are actively driven as OUTPUTs. If they are in INPUT or INPUT_PULLUP mode (e.g. connected
                // to a switch or pushbutton to GND), allow the power rail voltage to drive the pin state!
                const isPowerRailSrc = ['gnd_1', 'gnd_2', 'gnd_3', 'GND', '5V', 'vin', 'VIN', '3v3', '3V3'].includes(arduinoPinStr);
                if (isPowerRailSrc && isMainBoard && rawNode !== `${compId}:${arduinoPinStr}`) {
                    let port: AVRIOPort | null = null;
                    let bit = 0;
                    if (compPin.startsWith('A')) {
                        port = this.portC;
                        const parsed = parseInt(compPin.slice(1), 10);
                        if (!isNaN(parsed)) bit = parsed;
                    } else {
                        const num = parseInt(compPin, 10);
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
                    const state = port ? port.pinState(bit) : null;
                    const isOutput = state === PinState.High || state === PinState.Low;
                    if (isOutput) {
                        return;
                    }
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

                let inst = this.instances.get(compId);
                if (!inst && isMainBoard) {
                    inst = this.instances.get(this.boardId);
                }
                if (inst) {
                    if (!inst.pins[compPin]) inst.pins[compPin] = { voltage: 0, mode: 'INPUT' };
                    inst.setPinVoltage(compPin, v);
                    this.circuitDirty = true;
                    if (this.cpu && compId !== customCompId) {
                        inst.onPinStateChange(compPin, v > 1.8, this.cpu.cycles);
                    }
                    this.tickI2S(inst, compId, compPin, v > 1.8);

                    // Propagate external voltage back to simulated AVR CPU ports.
                    // IMPORTANT: only update pinStates when propagation comes FROM the board
                    // (no customCompId) or from a board-originated source.
                    // If customCompId is an external component (e.g. DHT22), do NOT touch
                    // pinStates — doing so poisons the attachPort change-detection, causing
                    // the Arduino's own LOW wake signal to be silently skipped.
                    if (isMainBoard) {
                        const isHigh = v > 1.8;
                        const originIsExternal = customCompId && customCompId !== this.boardId;
                        if (!originIsExternal) {
                            this.pinStates[compPin] = isHigh;
                        }
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
                if (state === PinState.High || state === PinState.InputPullUp || state === 2) {
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
                let bit = num;
                if (num >= 8 && num <= 13) { port = this.portB; bit = num - 8; }
                else if (num >= 0 && num <= 7) { port = this.portD; bit = num; }
                else return false;
                if (!port) return false;
                const pinState = port.pinState(bit);
                return pinState !== PinState.High && pinState !== PinState.Low;
            });
            const outputPins = allBoardPins.filter(p => {
                const state = getAvrPinModeState(p);
                if (!state.isDriven) return false;
                const num = parseInt(p, 10);
                if (isNaN(num)) return false;
                let port: AVRIOPort | null = null;
                let bit = num;
                if (num >= 8 && num <= 13) { port = this.portB; bit = num - 8; }
                else if (num >= 0 && num <= 7) { port = this.portD; bit = num; }
                else return false;
                if (!port) return false;
                const pinState = port.pinState(bit);
                return pinState === PinState.High || pinState === PinState.Low;
            });
            const analogPins = allBoardPins.filter(p => p.startsWith('A'));
            // INPUT pins: Separate INPUT_PULLUP from floating INPUT.
            // INPUT_PULLUP pins MUST propagate their pull-up voltage outward so that
            // connected components (pushbuttons, switches) can form a proper voltage divider.
            // Without this, a button connected between an INPUT_PULLUP pin and GND would
            // never pull the pin LOW because the pull-up voltage never reaches the button.
            // Floating INPUT pins should NOT propagate, as external components own the line.
            inputPins.forEach(pin => {
                // Check if any connected component on this net is actively driving LOW or HIGH
                let isDrivenLow = false;
                let isDrivenHigh = false;
                this.instances.forEach((inst, cId) => {
                    if (cId === this.boardId) return;
                    const lastV = (inst as any)._lastDrivenVoltage !== undefined
                        ? (inst as any)._lastDrivenVoltage
                        : ((inst as any).echoOutputVoltage !== undefined
                            ? (inst as any).echoOutputVoltage
                            : (inst.pins['OUT']?.voltage ?? inst.pins['SIG']?.voltage ?? inst.pins['DATA']?.voltage ?? inst.pins['SDA']?.voltage));
                    if ((inst as any)._drivingBus && lastV !== undefined) {
                        const rawBoardPin = (inst as any).getConnectedBoardPin
                            ? (inst as any).getConnectedBoardPin()
                            : ((inst as any).getBoardPin ? (inst as any).getBoardPin() : null);
                        if (rawBoardPin) {
                            const bPinClean = String(rawBoardPin).replace(/^D/i, '');
                            const pinClean = String(pin).replace(/^D/i, '');
                            if (bPinClean === pinClean) {
                                if (lastV < 1.8) {
                                    isDrivenLow = true;
                                } else {
                                    isDrivenHigh = true;
                                }
                            }
                        }
                    }
                });

                let port: AVRIOPort | null = null;
                let bit = 0;
                const num = parseInt(pin, 10);
                if (!isNaN(num)) {
                    if (num >= 8 && num <= 13) {
                        port = this.portB;
                        bit = num - 8;
                    } else if (num >= 0 && num <= 7) {
                        port = this.portD;
                        bit = num;
                    }
                } else if (pin.startsWith('A')) {
                    port = this.portC;
                    const parsed = parseInt(pin.slice(1), 10);
                    if (!isNaN(parsed)) bit = parsed;
                }

                if (isDrivenLow) {
                    this.pinStates[pin] = false;
                    if (port) port.setPin(bit, false);
                } else if (isDrivenHigh) {
                    this.pinStates[pin] = true;
                    if (port) port.setPin(bit, true);
                } else {
                    const { isDriven, isHigh } = getAvrPinModeState(pin);
                    if (isDriven) {
                        this.pinStates[pin] = isHigh;

                        const isPullUp = port ? (port.pinState(bit) === PinState.InputPullUp || port.pinState(bit) === 2) : false;
                        if (isPullUp) {
                            updateOopPin(pin, true);
                        }
                    }
                }
            });
            analogPins.forEach(pin => {
                const bit = parseInt(pin.slice(1), 10);
                const port = this.portC;
                const pinState = port ? port.pinState(bit) : null;
                const isDigitalOutput = pinState === PinState.High || pinState === PinState.Low;
                if (isDigitalOutput) {
                    const { isDriven, isHigh } = getAvrPinModeState(pin);
                    if (isDriven) {
                        this.pinStates[pin] = isHigh;
                        updateOopPin(pin, isHigh);
                    }
                }
            });
            outputPins.forEach(pin => {
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
                } else if (inst.type === 'openhw-dht22' || inst.type === 'wokwi-dht22' || inst.type.includes('dht')) {
                    const dataV = (inst as any)._lastDrivenVoltage !== undefined
                        ? (inst as any)._lastDrivenVoltage
                        : (inst.pins['DATA']?.voltage ?? inst.pins['SDA']?.voltage ?? 5.0);
                    const pinName = inst.pins['DATA'] ? 'DATA' : (inst.pins['SDA'] ? 'SDA' : 'DATA');
                    updateOopPin(pinName, dataV, compId);
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
                    const allInsts: any = this.instances; // Map: O(1) findInstance (BaseComponent accepts Map|Array)
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
                } else if (inst.type.includes('hc-sr04')) {
                    if (inst.pins['ECHO']) {
                        updateOopPin('ECHO', inst.pins['ECHO'].voltage, compId);
                    }
                } else if (inst.type.includes('pir')) {
                    if (inst.pins['OUT']) {
                        updateOopPin('OUT', inst.pins['OUT'].voltage, compId);
                    }
                } else if (inst.type.includes('dht')) {
                    ['SDA', 'DATA'].forEach(pin => {
                        if (inst.pins[pin]) {
                            const dhtVoltage = inst.pins[pin].voltage;
                            updateOopPin(pin, dhtVoltage, compId);

                        }
                    });
                } else if (inst.type.includes('ds18b20') || inst.type.includes('onewire')) {
                    // 1-Wire devices (DS18B20 etc.) drive DQ line for presence pulse and data bits.
                    // Propagate DQ voltage back to the AVR so the Arduino firmware can read pin state.
                    ['DQ', 'dq', 'DATA', 'data'].forEach(pin => {
                        if (inst.pins[pin]) {
                            updateOopPin(pin, inst.pins[pin].voltage, compId);
                        }
                    });
                } else if (inst.type.includes('gas-sensor') || inst.type.includes('mq')) {
                    ['DO', 'AO'].forEach(pin => {
                        if (inst.pins[pin]) updateOopPin(pin, inst.pins[pin].voltage, compId);
                    });
                } else if (inst.type.includes('soil-moisture-sensor') || inst.type.includes('soil')) {
                    if (inst.pins['SIG']) updateOopPin('SIG', inst.pins['SIG'].voltage, compId);
                } else if (inst.type.includes('raindrop')) {
                    ['DO', 'AO'].forEach(pin => {
                        if (inst.pins[pin]) updateOopPin(pin, inst.pins[pin].voltage, compId);
                    });
                } else if (inst.type.includes('ldr')) {
                    inst.update(this.cpu?.cycles ?? 0, this.currentWires, this.instances as any);
                    ['DO', 'AO'].forEach(pin => {
                        if (inst.pins[pin]) updateOopPin(pin, inst.pins[pin].voltage, compId);
                    });
                } else if (inst.type.includes('rotary-encoder')) {
                    ['CLK', 'DT', 'SW'].forEach(pin => {
                        if (inst.pins[pin]) updateOopPin(pin, inst.pins[pin].voltage, compId);
                    });
                } else if (inst.type.includes('potentiometer') || inst.type.includes('pot')) {
                    if (inst.pins['SIG']) updateOopPin('SIG', inst.pins['SIG'].voltage, compId);
                } else if (inst.type.includes('ntc')) {
                    inst.update(this.cpu?.cycles ?? 0, this.currentWires, this.instances as any);
                    ['OUT', 'A0', 'D0'].forEach(pin => {
                        if (inst.pins[pin]) updateOopPin(pin, inst.pins[pin].voltage, compId);
                    });
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
                    const allInsts: any = this.instances; // Map: O(1) findInstance (BaseComponent accepts Map|Array)
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
                    // Allow OUTPUT, InputPullUp, and Input (high-impedance release for open-drain buses like 1-Wire/I2C)
                    const state = port.pinState(i);
                    const isOutputOrPullUpOrInput = state === PinState.Low || state === PinState.High || state === PinState.InputPullUp || state === PinState.Input || state === 2;
                    if (!isOutputOrPullUpOrInput) {
                        return;
                    }

                    // For open-drain buses (like 1-Wire / I2C), switching to high-impedance Input releases the wire HIGH.
                    const isHigh = state === PinState.InputPullUp || state === 2 || state === PinState.High || state === PinState.Input || ((state === PinState.Low || state === PinState.High) && (value & (1 << i)) !== 0);
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
    private clockEvents: Array<{ targetCycle: number; callback: () => void }> = [];

    private pollADCChannels = () => {
        if (!this.adc || !this.cpu) return;
        for (let i = 0; i < UNO_ANALOG_PINS.length; i++) {
            const arduinoPin = UNO_ANALOG_PINS[i];
            let voltage = 0;

            const targetNet = this.pinToNet.get(`${this.boardId}:${arduinoPin}`)
                ?? this.pinToNet.get(`${this.boardId}:A${i}`);

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
                for (const w of this.currentWires) {
                    const [fromComp, fromPin] = w.from.split(':');
                    const [toComp, toPin] = w.to.split(':');

                    let isConnectedToPin = false;
                    let otherCompId = '';
                    let otherCompPin = '';

                    const isMainBoardFrom = fromComp === this.boardId || fromComp === 'arduino' || fromComp === 'uno' || fromComp === 'board';
                    const isMainBoardTo = toComp === this.boardId || toComp === 'arduino' || toComp === 'uno' || toComp === 'board';
                    if (isMainBoardFrom && (fromPin === arduinoPin || fromPin === `A${i}`)) {
                        isConnectedToPin = true;
                        otherCompId = toComp;
                        otherCompPin = toPin;
                    } else if (isMainBoardTo && (toPin === arduinoPin || toPin === `A${i}`)) {
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
    };

    private runLoop = () => {
        if (!this.running || !this.cpu) return;

        // Command ring drain (§10.6 step 1): ≤16 commands per tick, then
        // HALT freezes the tick (takeStepBudget returns 0) until RESUME/STEP.
        // postMessage INTERACT/SERIAL/RESET/SPEED/TELEMETRY handlers stay as
        // fallback for clients without ring buffers.
        try {
            if (this.cmdReader && this.debugService) {
                const changed = this.debugService.drainCommands(this.cmdReader, Number(this.cpu.cycles) || 0);
                if (changed) this.applyRingMovementCommands();
                // Serial RX ring (§10.4): bytes the UI pushed ride the ring;
                // drain into the UART buffer (postMessage SERIAL_INPUT stays
                // as fallback/overflow path).
                try {
                    const rx = (this as any).sabSerialRx;
                    if (rx && typeof rx.drain === "function") {
                        const bytes = rx.drain(256);
                        for (const b of bytes) this.serialRxByte(b & 0xff);
                    }
                } catch { /* RX drain never breaks the tick */ }
                if (this.debugService.isHalted()) {
                    const budget = this.debugService.takeStepBudget(0);
                    if (budget <= 0) {
                        // Frozen: still emit state so UI shows paused frame, then wait.
                        this.lastTime = performance.now();
                        setTimeout(this.runLoop, 8);
                        return;
                    }
                }
            }
        } catch { /* ring drain never breaks the tick */ }

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

            const instArray = Array.from(this.instances.entries());
            const componentUpdateThreshold = 32000; // Update components every 2ms of simulated time

            while (this.cpu.cycles < targetObj && this.running) {
                const nextChunkTarget = Math.min(targetObj, this.cpu.cycles + componentUpdateThreshold);
                // PC breakpoint check (§10.7): chunk boundary only — never
                // per-instruction. HALT freezes via the service; the loop
                // below observes isHalted() through the normal drain path.
                try {
                    const svc = this.debugService as any;
                    if (svc && typeof svc.checkPcBreakpoint === 'function') {
                        const pc = Number((this.cpu as any)?.pc) >>> 0;
                        if (svc.checkPcBreakpoint(pc, Number(this.cpu.cycles) || 0)) {
                            this.forceEmitState();
                            this.lastTime = performance.now();
                            setTimeout(this.runLoop, 8);
                            return;
                        }
                    }
                } catch { /* breakpoint check never breaks the tick */ }
                
                while (this.cpu.cycles < nextChunkTarget && this.running) {
                    avrInstruction(this.cpu);
                    this.cpu.tick();
                    if (this.clockEvents.length > 0) {
                        for (let i = this.clockEvents.length - 1; i >= 0; i--) {
                            if (this.cpu.cycles >= this.clockEvents[i].targetCycle) {
                                const cb = this.clockEvents[i].callback;
                                this.clockEvents.splice(i, 1);
                                cb();
                            }
                        }
                    }
                }

                // Component updates for smooth animation
                const componentStart = performance.now();
                let anyStateChanged = false;
                for (const [compId, inst] of instArray) {
                    if (!(inst as any)._simCpu) {
                        (inst as any)._simCpu = this.cpu;
                        (inst as any)._simUpdatePhysics = this.repropagateAllVoltages;
                        if (this.cpu && typeof (this.cpu as any).addClockEvent !== 'function') {
                            (this.cpu as any).addClockEvent = (cb: () => void, delayCycles: number) => {
                                this.clockEvents.push({ targetCycle: this.cpu!.cycles + delayCycles, callback: cb });
                            };
                        }
                    }
                    if (this.cpu) {
                        (this.cpu as any)._avrRunner = this;
                    }
                    if (!(inst as any)._setAvrPinDirect) {
                        (inst as any)._setAvrPinDirect = (boardPin: string, isHigh: boolean) => {
                            let cleanPin = boardPin.replace(/^D/i, '');
                            this.pinStates[cleanPin] = isHigh;
                            this.pinStates[`D${cleanPin}`] = isHigh;
                            const num = parseInt(cleanPin, 10);
                            if (!isNaN(num)) {
                                if (num >= 8 && num <= 13) {
                                    this.portB?.setPin(num - 8, isHigh);
                                } else if (num >= 0 && num <= 7) {
                                    this.portD?.setPin(num, isHigh);
                                }
                            } else if (cleanPin.startsWith('A')) {
                                const bit = parseInt(cleanPin.slice(1), 10);
                                if (!isNaN(bit)) this.portC?.setPin(bit, isHigh);
                            }
                        };
                    }
                    if ((inst as any)._simCpu && !(inst as any)._simCpu._avrRunner) {
                        (inst as any)._simCpu._avrRunner = this;
                    }
                    // Runner-agnostic bus services (plan §5.3); legacy handles
                    // above remain as fallback.
                    this.provideBusServices(inst, compId);
                    inst.update(this.cpu!.cycles, this.currentWires, this.instances as any);
                    if (inst.stateChanged) {
                        anyStateChanged = true;
                        (inst as any).pendingVisualStateEmit = true;
                        inst.stateChanged = false;
                    }
                }
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
                this.lastPhysicsSolveAt = now;
                this.circuitDirty = false;
            }

            this.pollADCChannels();
            // Host/UART receive pacing: bytes per second = baud / 10 (8N1 frame)
            // bytes per ms = baud / 10000. We accumulate fractional budget over time.
            const bytesPerMs = this.serialBaudRate / 10000;
            this.serialByteBudget += deltaTime * bytesPerMs;

            if (this.serialBuffer.length > 0 && this.usart && this.serialByteBudget >= 1) {
                const maxBytes = Math.floor(this.serialByteBudget);
                const toSend = Math.min(maxBytes, this.serialBuffer.length);
                let sent = 0;
                for (let i = 0; i < toSend; i++) {
                    const byte = this.serialBuffer[0];
                    if (this.usart.writeByte(byte)) {
                        this.serialBuffer.shift();
                        sent++;
                    } else {
                        break;
                    }
                }
                this.serialByteBudget -= sent;
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

        // v2 tick (§10.6): cycles owed derive from sim-time budget (cyclesToRun /
        // CYCLES_PER_FRAME above), not wall catch-up — the setTimeout here is
        // pacing only, and every command/event carries cpuCycles stamps.
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
        const dirtySlots: number[] = [];
        // T3: telemetry ring write — one compact record per telemetry-enabled
        // component per flush (overwrites oldest when full; lossy by design).
        // Grading/teacher-key paths keep full-fidelity postMessage snapshots.
        const cyclesNow = Number(this.cpu.cycles) || 0;
        let anyTelemetry = false;
        for (const inst of this.instances.values()) {
            const pendingEmit = (inst as any).pendingVisualStateEmit;
            if (!inst.stateChanged && !pendingEmit && !inst.telemetryEnabled) continue;

            const syncState = getUnifiedComponentSyncState(inst);

            // Respect the component's sync policy to avoid overloading the UI
            if (!this.shouldEmitComponentState(inst.id, syncState, now)) continue;

            // SAB publish (§12.3 T5) via transport: numeric slot writes, zero
            // postMessage bytes. Same values/order as the direct calls.
            const slotFrames: Array<{ id: string; slot: number; version: number; kind: number; f: number[]; i: number[] }> = [];
            const teleRecords: Array<{ slot: number; code: number; v0: number; v1: number; cycles: number }> = [];
            if ((this.transport as SimTransport | null) && inst.sabSlot >= 0) {
                try {
                    const ui = typeof (inst as any).uiState === 'function' ? (inst as any).uiState() : null;
                    const f = ui?.f ? Object.values(ui.f).map(Number) : [];
                    const i = ui?.i ? Object.values(ui.i).map(Number) : [];
                    slotFrames.push({
                        id: inst.id, slot: inst.sabSlot,
                        version: (inst as any).stateVersion || 0,
                        kind: sabKindForType(inst.type), f, i,
                    });
                    dirtySlots.push(inst.sabSlot);
                    if ((inst as any).telemetryEnabled && (f.length > 0 || i.length > 0)) {
                        teleRecords.push({
                            slot: inst.sabSlot, code: sabKindForType(inst.type),
                            v0: Number(f[0] || 0), v1: Number(i[0] || 0), cycles: cyclesNow,
                        });
                        anyTelemetry = true;
                    } else if ((inst as any).telemetryEnabled) {
                        anyTelemetry = true;
                    }
                } catch { /* SAB write never breaks sim */ }
            } else if ((inst as any).telemetryEnabled) {
                anyTelemetry = true;
            }
            try {
                (this.transport as SimTransport | null)?.publishComponentSlots(slotFrames);
                (this.transport as SimTransport | null)?.publishTelemetryRecords(teleRecords);
            } catch { /* SAB write never breaks sim */ }

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
        if (dirtySlots.length) msg.dirtySlots = dirtySlots;
        // T5: mark SAB fast-path eligibility — postRunnerState shrinks to the
        // wakeup when this is set (slow-mirror still flows when recording).
        if (this.sabWriter) msg.sabFastPath = true;

        this.statusIntervalEmitCount++;
        msg._emitSeq = this.statusIntervalEmitCount;
        msg._emitTime = now;
        msg.simTimeMs = this.getSimulatedTimeMs();
        try { (this.transport as SimTransport | null)?.publishFrame(msg.simTimeMs, anyTelemetry); } catch { /* never break sim */ }

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
        // Pin bitfield publish via transport (§10.4): board pin order fixed
        // at START. Aliases (D13/13) share one index when the map lists
        // either form.
        try {
            (this.transport as SimTransport | null)?.publishPins(this.boardId, { [pinId]: !!isHigh });
        } catch { /* pin publish never breaks propagation */ }

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

    /** Apply movement-class commands drained from the ring (§10.6 step 1).
     * INTERACT/SERIAL are applied inline (same semantics as the postMessage
     * handlers); RESET/SPEED/TELEMETRY delegate to existing methods.
     * Called only when drainCommands reports a halt-relevant change OR every
     * tick when pending commands exist — cheap (≤16 records). */
    private pendingRingLog: Array<{ op: number; target: number; str: string; cycles: number }> = [];

    private applyRingMovementCommands(): void {
        try {
            const log = this.debugService?.getCommandLog() || [];
            const fresh = log.slice(this.pendingRingLog.length);
            for (const c of fresh) {
                this.pendingRingLog.push({ op: c.op, target: c.target, str: c.str, cycles: c.cycles });
                if (c.op === 3) { // RESET
                    this.reset();
                } else if (c.op === 4) { // SET_SPEED (arg0 = speed*1000)
                    this.setSpeed(Number(c.arg0) / 1000);
                } else if (c.op === 5) { // SET_TELEMETRY (arg0 = enabled)
                    this.setTelemetryEnabled(!!c.arg0);
                } else if (c.op === 1) { // INTERACT (str = event, target = slot)
                    const inst = this.slotToInstance(c.target);
                    if (inst && c.event) {
                        try { (inst as any).onEvent(c.event); } catch { /* never break tick */ }
                    }
                } else if (c.op === 2) { // SERIAL (str = bytes)
                    if (c.str) this.serialRx(c.str);
                }
            }
            if (this.pendingRingLog.length > 512) {
                this.pendingRingLog.splice(0, this.pendingRingLog.length - 512);
            }
        } catch { /* ring apply never breaks the tick */ }
    }

    private slotToInstance(slot: number): BaseComponent | null {
        for (const inst of this.instances.values()) {
            if ((inst as any).sabSlot === slot) return inst;
        }
        return null;
    }

    /** Live HALT/STEP/pause controls for worker postMessage handlers. */
    pause(): void {
        try {
            (this.debugService as any)?.halt?.();
        } catch { /* ignore */ }
        this.running = false;
    }

    resume(): void {
        try {
            (this.debugService as any)?.resume?.();
        } catch { /* ignore */ }
        if (!this.running) {
            this.running = true;
            this.lastTime = performance.now();
            this.runLoop();
        }
    }

    /** Single-step N cpu cycles while halted (debug service budget).
     * Enqueues STEP into the budget AND executes it synchronously so a
     * halted loop advances immediately (no need to wait for the 8ms refreeze
     * tick). No-ops when running free (takeStepBudget passes through). */
    stepCycles(n: number): number {
        try {
            const budget = (this.debugService as any)?.takeStepBudget?.(n) ?? 0;
            if (budget > 0 && this.cpu && !(this as any).running) {
                // Synchronous burst: bounded (≤1M cycles) so UI can't hang.
                const target = Number(this.cpu.cycles) + Math.min(budget, 1000000);
                let guard = 0;
                while (Number(this.cpu.cycles) < target && guard++ < 1000000) {
                    avrInstruction(this.cpu);
                    this.cpu.tick();
                }
                this.forceEmitState();
            }
            return budget;
        } catch { return 0; }
    }

    getDebugSnapshot(): any {
        try {
            const snap = (this.debugService as any)?.snapshot?.() ?? { halted: false, cycles: 0 };
            // Enrich with live CPU state (service only tracks what it drains).
            // avr8js: cpu.pc (word addr), cpu.SP (byte addr into data[]).
            try {
                if (this.cpu) {
                    (snap as any).cycles = Number(this.cpu.cycles) || (snap as any).cycles;
                    const pc = Number((this.cpu as any)?.pc);
                    if (Number.isFinite(pc)) (snap as any).pc = pc >>> 0;
                    const sp = Number((this.cpu as any)?.SP);
                    if (Number.isFinite(sp)) (snap as any).sp = sp >>> 0;
                }
            } catch { /* enrichment never breaks snapshot */ }
            // Mirror into the SAB debug region (§10.7 DEBUG REGION) so the UI
            // can poll without a postMessage round-trip. No-op when absent.
            try { (this as any).sabDebugWriter?.write(snap); } catch { /* ignore */ }
            return snap;
        } catch { return { halted: false, cycles: 0 }; }
    }

    /** Live RAM/SRAM view for DEBUG_READ_MEM (valid while halted). */
    readMem(addr: number, len: number): Uint8Array | null {
        try {
            const mem = (this.cpu as any)?.data;
            if (!mem) return null;
            const n = Math.max(1, Math.min(256, len));
            const out = new Uint8Array(n);
            for (let i = 0; i < n; i++) out[i] = mem[(addr + i) & 0xffff] & 0xff;
            return out;
        } catch { return null; }
    }

    /** Direct pin-watch registration (DEBUG_WATCH fallback path). */
    addPinWatch(pinName: string, expectHigh = true): void {
        try { (this.debugService as any)?.addPinWatch?.(pinName, expectHigh); } catch { /* ignore */ }
    }

    removePinWatch(pinName: string): void {
        try { (this.debugService as any)?.removePinWatch?.(pinName); } catch { /* ignore */ }
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
        this.clockEvents = [];
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
        if (frequencyHz > 0 && frequencyHz < 5) return;

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
        // Debug pin watchpoints (§10.7): edge check on every board-pin edge.
        // checkPinWatch is baseline-then-edge (first call seeds, no false hit)
        // and emits WATCH_HIT into the event ring on match. Never breaks tick.
        try {
            (this.debugService as any)?.checkPinWatch?.(String(pinId), !!isHigh, Number(cycles) || 0);
        } catch { /* ignore */ }
    }

    private netHasResistor = new Set<number>();

    private buildNetlist() {
        // Shared netlist service (plan §5.3): identical graph semantics
        // (wires + internal bridges, D/Dn aliases, power-rail variants,
        // resistor-net marking). AVR keeps its own orchestration
        // (rails, pullups, port gating) in updateOopPin/repropagate below.
        this.protocolEndpointsCache.clear();
        const graph = buildNetGraph(
            this.currentWires,
            this.instances as unknown as Map<string, PassiveInstance>,
            (id, type) => getInternalBridgesForComponent(id, type),
        );
        this.pinToNet = graph.pinToNet;
        this.netHasResistor = graph.netHasResistor;
        (this as any).topologyDirty = true;
    }


    private arePinsConnected(pinA: string, pinB: string): boolean {
        const netA = this.pinToNet.get(pinA);
        const netB = this.pinToNet.get(pinB);
        return netA !== undefined && netA === netB;
    }
}
