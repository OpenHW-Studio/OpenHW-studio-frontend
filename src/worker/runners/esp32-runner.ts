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
    collectComponentTelemetry,
    collectConnectedComponentPins
} from '../registries/component-registry.ts';
import { ESP32, SimulationClock } from './esp32-engine.js';


// Fully reverse-engineered Wokwi AP & Gateway Logic
export enum WifiState {
    Disconnected = 0,
    Connecting = 1,
    Connected = 2,
    AccessPointNotFound = 3,
    GatewayError = 4
}

export class WifiStatus {
    public state: WifiState = WifiState.Disconnected;
    public errorMessage: string = '';
    public rxFrames = 0;
    public rxBytes = 0;
    public txFrames = 0;
    public txBytes = 0;
    public probeRequestCount = 0;
    public privateGateway = false;

    constructor(private boardId: string, private onStateUpdate: (msg: any) => void) {}

    reset() {
        this.state = WifiState.Disconnected;
        this.errorMessage = '';
        this.rxFrames = 0;
        this.rxBytes = 0;
        this.txFrames = 0;
        this.txBytes = 0;
        this.probeRequestCount = 0;
        this.emitStats();
    }

    onFrame(type: number, subtype: number, length: number) {
        if (this.state === WifiState.Disconnected) this.state = WifiState.Connecting;
        if (type === 0 && subtype === 4) { // Probe Request
            this.probeRequestCount++;
        } else if (type === 0 && subtype === 5) { // Probe Response
            this.probeRequestCount = 0;
        } else if (type === 2) { // Data
            this.txFrames++;
            this.txBytes += length;
            this.emitStats();
        }
    }

    onConnected() {
        this.state = WifiState.Connected;
        this.errorMessage = '';
    }
    
    public emitStats() {
        this.onStateUpdate({
            type: 'state',
            boardId: this.boardId,
            wifi: {
                status: {
                    state: this.state,
                    errorMessage: this.errorMessage,
                    txBytes: this.txBytes,
                    rxBytes: this.rxBytes,
                    privateGateway: this.privateGateway,
                    gatewayType: this.privateGateway ? 'vscode' : 'public'
                }
            }
        });
    }
}

export class WokwiInternetAP {
    public bssid: Uint8Array;
    public ssid: string;
    public password?: string;
    public channel: number;
    private seq = 0;
    private clock: any;
    public status: WifiStatus;
    private socket: WebSocket | null = null;
    private packetBuffer: Uint8Array[] = [];
    private pcapBuffer: { timeUs: number, data: Uint8Array }[] = [];
    private onRxCb: ((event: { data: Uint8Array }) => void) | null = null;
    public connectedClients = 0;
    private gatewayUrl: string;
    private boardId: string;
    private onStateUpdate: (msg: any) => void;

    constructor(clock: any, gatewayUrl: string, boardId: string, options: any, onStateUpdate: (msg: any) => void) {
        this.clock = clock;
        this.onStateUpdate = onStateUpdate;
        this.status = new WifiStatus(boardId, onStateUpdate);
        
        let url = gatewayUrl;
        if (options.sessionId) {
            url += `?sessionId=${options.sessionId}`;
        }
        this.gatewayUrl = url;
        
        this.ssid = options.ssid || 'Wokwi-GUEST';
        this.password = options.password;
        this.channel = options.channel || 6;
        this.status.privateGateway = options.privateGateway === 'true' || options.privateGateway === true;
        
        if (options.bssid) {
            const parts = options.bssid.split(':');
            this.bssid = new Uint8Array(6);
            for (let i = 0; i < 6; i++) this.bssid[i] = parseInt(parts[i], 16) || 0;
        } else {
            this.bssid = new Uint8Array([0x42, 0x13, 0x37, 0x55, 0xaa, 0x01]);
        }

        // Start broadcasting Beacons every 102.4ms
        setInterval(() => {
            if (this.onRxCb) {
                this.onRxCb({ data: this.buildBeacon() });
            }
        }, 102);
    }

    private buildBeacon(): Uint8Array {
        const header = new Uint8Array(24);
        header[0] = 0x80; // Beacon frame subtype
        header.set([0xff, 0xff, 0xff, 0xff, 0xff, 0xff], 4); // Destination (Broadcast)
        header.set(this.bssid, 10); // Source
        header.set(this.bssid, 16); // BSSID
        const seq = this.nextSeq();
        header[22] = seq & 0xff;
        header[23] = (seq >> 8) & 0xff;

        const fixed = new Uint8Array(12);
        
        // Bytes 0-7: Timestamp (64-bit microseconds)
        const nowUs = Math.floor(performance.now() * 1000);
        let temp = nowUs;
        for (let i = 0; i < 8; i++) {
            fixed[i] = temp & 0xff;
            temp = Math.floor(temp / 256);
        }

        fixed[8] = 0x64; fixed[9] = 0x00; // Beacon Interval (100 TU)
        fixed[10] = 0x01; // Capabilities (ESS=1)
        fixed[11] = 0x04;

        const ssidBytes = new TextEncoder().encode(this.ssid);
        const ssidIE = new Uint8Array(2 + ssidBytes.length);
        ssidIE[0] = 0; 
        ssidIE[1] = ssidBytes.length;
        ssidIE.set(ssidBytes, 2);

        const ratesIE = new Uint8Array([1, 8, 0x82, 0x84, 0x8b, 0x96, 0x0c, 0x12, 0x18, 0x24]);
        const dsIE = new Uint8Array([3, 1, this.channel]);
        const timIE = new Uint8Array([5, 4, 0, 1, 0, 0]);

        const out = new Uint8Array(24 + 12 + ssidIE.length + ratesIE.length + dsIE.length + timIE.length);
        out.set(header, 0);
        out.set(fixed, 24);
        out.set(ssidIE, 36);
        out.set(ratesIE, 36 + ssidIE.length);
        out.set(dsIE, 36 + ssidIE.length + ratesIE.length);
        out.set(timIE, 36 + ssidIE.length + ratesIE.length + dsIE.length);

        return out;
    }

    private nextSeq(): number {
        this.seq = (this.seq + 1) % 4096;
        return this.seq << 4;
    }

    public connectGateway() {
        if (this.socket) return;
        this.socket = new WebSocket(this.gatewayUrl);
        this.socket.binaryType = 'arraybuffer';
        this.socket.onopen = () => {
            console.log('[WokwiInternetAP] Gateway Connected');
            while (this.packetBuffer.length > 0) {
                this.socket!.send(this.packetBuffer.shift()!);
            }
        };
        this.socket.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                this.status.onConnected();
                const eth = new Uint8Array(event.data);
                this.pcapBuffer.push({ timeUs: performance.now() * 1000, data: eth });
                this.status.rxFrames++;
                this.status.rxBytes += eth.length;
                this.status.emitStats();
                this.onEthernetRx(eth);
            }
        };
        this.socket.onerror = () => {
            this.status.state = WifiState.GatewayError;
            this.status.errorMessage = 'Gateway connection failed';
        };
    }

    public onEthernetRx(eth: Uint8Array) {
        if (eth.length < 14 || !this.onRxCb) return;
        const da = eth.slice(0, 6);
        const sa = eth.slice(6, 12);
        const etherType = eth.slice(12, 14);
        const payload = eth.slice(14);

        const wifi = new Uint8Array(32 + payload.length);
        wifi[0] = 0x08; // Data
        wifi[1] = 0x02; // FromDS=1, ToDS=0
        wifi.set(da, 4);
        wifi.set(this.bssid, 10);
        wifi.set(sa, 16);
        
        const seq = this.nextSeq();
        wifi[22] = seq & 0xff;
        wifi[23] = (seq >> 8) & 0xff;
        
        // LLC SNAP header
        wifi[24] = 0xaa; wifi[25] = 0xaa; wifi[26] = 0x03;
        wifi[27] = 0x00; wifi[28] = 0x00; wifi[29] = 0x00;
        wifi[30] = etherType[0]; wifi[31] = etherType[1];
        
        wifi.set(payload, 32);
        this.onRxCb({ data: wifi });
    }

    private sendEthernet(eth: Uint8Array) {
        this.pcapBuffer.push({ timeUs: performance.now() * 1000, data: eth });
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(eth);
        } else {
            this.packetBuffer.push(eth);
        }
    }

    private buildAck(targetMac: Uint8Array): Uint8Array {
        const header = new Uint8Array(10);
        header[0] = 0xd4; // ACK
        header[1] = 0x00;
        header.set(targetMac, 4);
        return header;
    }

    public handleWifiFrame(frame: Uint8Array, channel?: number) {
        if (channel && channel !== this.channel) return; // Ignore frames on wrong channel
        if (frame.length < 24) return;
        const fc1 = frame[0];
        const type = (fc1 >> 2) & 3;
        const subtype = (fc1 >> 4) & 15;

        const da = frame.slice(4, 10);
        const sa = frame.slice(10, 16);

        this.status.onFrame(type, subtype, frame.length);

        let isBroadcast = true;
        for (let i = 0; i < 6; i++) {
            if (da[i] !== 0xff) isBroadcast = false;
        }

        // Send hardware-level ACK immediately
        if (!isBroadcast && this.onRxCb) {
            this.onRxCb({ data: this.buildAck(sa) });
        }

        if (type === 0) { // Management
            const scheduleResponse = (response: Uint8Array) => {
                if (this.onRxCb) this.onRxCb({ data: response });
            };

            if (subtype === 4) { // Probe Request
                scheduleResponse(this.buildProbeResponse(sa));
            } else if (subtype === 11) { // Auth Request
                scheduleResponse(this.buildAuthResponse(sa));
            } else if (subtype === 0) { // Assoc Request
                this.connectedClients++;
                this.connectGateway(); // Wokwi triggers gateway connection on Assoc!
                scheduleResponse(this.buildAssocResponse(sa));
            }
        } else if (type === 2) { // Data or QoS Data
            const isQos = (subtype === 8);
            const macHeaderLen = isQos ? 26 : 24;
            
            if (frame.length !== 368) {
                // Ignore length debug
            }

            if (frame.length > (macHeaderLen + 8) && frame[macHeaderLen] === 0xaa && frame[macHeaderLen + 1] === 0xaa) {
                const payload = frame.slice(macHeaderLen + 8);
                const ethLen = Math.max(60, 14 + payload.length); // Pad to minimum 60 bytes
                const eth = new Uint8Array(ethLen);
                
                // Ethernet Header: DA (6), SA (6), EtherType (2)
                // In 802.11 Data frame to AP: Address 1 is BSSID (AP), Address 2 is SA (Station), Address 3 is DA (Destination)
                // Wait! For sending to the gateway, we need the original DA.
                // In ToDS=1, FromDS=0: Addr1=BSSID, Addr2=SA, Addr3=DA.
                const realDa = frame.slice(16, 22); // Address 3
                const realSa = frame.slice(10, 16); // Address 2
                
                eth.set(realDa, 0);
                eth.set(realSa, 6);
                
                const ethTypeHigh = frame[macHeaderLen + 6];
                const ethTypeLow = frame[macHeaderLen + 7];
                eth[12] = ethTypeHigh;
                eth[13] = ethTypeLow;
                
                // Copy payload
                eth.set(payload, 14);
                
                // --- HOTFIX: ESP32 LwIP sends ARP with Sender MAC 00:00:00:00:00:00 ---
                // If it's an ARP packet (0x0806), patch the Sender MAC in the ARP payload.
                if (ethTypeHigh === 0x08 && ethTypeLow === 0x06 && ethLen >= 42) {
                    // In ARP: HardwareType(2), ProtocolType(2), HwLen(1), ProtoLen(1), Opcode(2), SenderMAC(6)
                    // Sender MAC is at offset 8 within the ARP payload, which is offset 14+8 = 22 in Ethernet frame.
                    eth.set(realSa, 22);
                }
                
                this.sendEthernet(eth);
            }
        }
    }

    private buildProbeResponse(clientMac: Uint8Array): Uint8Array {
        const header = new Uint8Array(24);
        header[0] = 0x50; // Probe Response
        header.set(clientMac, 4);
        header.set(this.bssid, 10);
        header.set(this.bssid, 16);
        const seq = this.nextSeq();
        header[22] = seq & 0xff;
        header[23] = (seq >> 8) & 0xff;

        const fixed = new Uint8Array(12);
        fixed[8] = 0x64; fixed[9] = 0x00; // Beacon Interval
        fixed[10] = 0x01; // Capabilities
        fixed[11] = 0x04;

        const ssidBytes = new TextEncoder().encode(this.ssid);
        const ssidIE = new Uint8Array(2 + ssidBytes.length);
        ssidIE[0] = 0; 
        ssidIE[1] = ssidBytes.length;
        ssidIE.set(ssidBytes, 2);

        const ratesIE = new Uint8Array([1, 8, 0x82, 0x84, 0x8b, 0x96, 0x0c, 0x12, 0x18, 0x24]);
        const dsIE = new Uint8Array([3, 1, this.channel]);

        const out = new Uint8Array(header.length + fixed.length + ssidIE.length + ratesIE.length + dsIE.length);
        let offset = 0;
        out.set(header, offset); offset += header.length;
        out.set(fixed, offset); offset += fixed.length;
        out.set(ssidIE, offset); offset += ssidIE.length;
        out.set(ratesIE, offset); offset += ratesIE.length;
        out.set(dsIE, offset);
        return out;
    }

    private buildAuthResponse(clientMac: Uint8Array): Uint8Array {
        const header = new Uint8Array(24);
        header[0] = 0xb0; // Auth
        header.set(clientMac, 4);
        header.set(this.bssid, 10);
        header.set(this.bssid, 16);
        const seq = this.nextSeq();
        header[22] = seq & 0xff;
        header[23] = (seq >> 8) & 0xff;

        const fixed = new Uint8Array([0, 0, 2, 0, 0, 0]); // Success
        const out = new Uint8Array(header.length + fixed.length);
        out.set(header, 0);
        out.set(fixed, header.length);
        return out;
    }

    private buildAssocResponse(clientMac: Uint8Array): Uint8Array {
        const header = new Uint8Array(24);
        header[0] = 0x10; // Assoc Response
        header.set(clientMac, 4);
        header.set(this.bssid, 10);
        header.set(this.bssid, 16);
        const seq = this.nextSeq();
        header[22] = seq & 0xff;
        header[23] = (seq >> 8) & 0xff;

        const fixed = new Uint8Array(4);
        fixed[0] = 0x11; fixed[1] = 0x04;
        fixed[2] = 0; fixed[3] = 0;
        const aid = new Uint8Array([1, 192]);

        const ratesIE = new Uint8Array([1, 8, 0x82, 0x84, 0x8b, 0x96, 0x0c, 0x12, 0x18, 0x24]);

        const out = new Uint8Array(header.length + fixed.length + aid.length + ratesIE.length);
        out.set(header, 0);
        out.set(fixed, header.length);
        out.set(aid, header.length + fixed.length);
        out.set(ratesIE, header.length + fixed.length + aid.length);
        return out;
    }

    public setRxCb(cb: (event: { data: Uint8Array }) => void) {
        this.onRxCb = cb;
    }

    public downloadPcap() {
        let totalLen = 24; // PCAP Global Header
        for (const pkt of this.pcapBuffer) {
            totalLen += 16 + pkt.data.length;
        }

        const buffer = new ArrayBuffer(totalLen);
        const view = new DataView(buffer);
        const u8 = new Uint8Array(buffer);
        
        // Global Header (Big-Endian format)
        view.setUint32(0, 0xa1b2c3d4, false); // Magic 
        view.setUint16(4, 2, false); // Major
        view.setUint16(6, 4, false); // Minor
        view.setInt32(8, 0, false); // Thiszone
        view.setUint32(12, 0, false); // Sigfigs
        view.setUint32(16, 65535, false); // Snaplen
        view.setUint32(20, 1, false); // Network (Ethernet)

        let offset = 24;
        for (const pkt of this.pcapBuffer) {
            const sec = Math.floor(pkt.timeUs / 1000000);
            const usec = Math.floor(pkt.timeUs % 1000000);
            view.setUint32(offset, sec, false);
            view.setUint32(offset + 4, usec, false);
            view.setUint32(offset + 8, pkt.data.length, false);
            view.setUint32(offset + 12, pkt.data.length, false);
            u8.set(pkt.data, offset + 16);
            offset += 16 + pkt.data.length;
        }

        this.onStateUpdate({
            type: 'wifi_pcap',
            boardId: this.boardId,
            data: buffer
        });
    }

    public disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
}

class WokwiWifiMedium {
    public ap: WokwiInternetAP;
    constructor(ap: WokwiInternetAP) {
        this.ap = ap;
    }
    public transmit(event: { channel: number; data: Uint8Array }) {
        this.ap.handleWifiFrame(event.data, event.channel);
    }
    public listen(cb: (event: { data: Uint8Array }) => void) {
        this.ap.setRxCb(cb);
    }
}

export class NativeWiFiBridge {
    public medium: WokwiWifiMedium;
    public ap: WokwiInternetAP;
    public clock: any;
    public boardId: string;

    constructor(pcapMode: string, clock: any, boardId: string, options: any, onStateUpdate: (msg: any) => void) {
        this.clock = clock;
        this.boardId = boardId;
        const isPrivate = options.privateGateway === 'true' || options.privateGateway === true;
        
        // Always connect to the /api/network-gateway endpoint.
        // WokwiInternetAP will automatically append ?sessionId=... if provided.
        const url = isPrivate ? 'ws://localhost:5099/api/network-gateway' : ((import.meta.env?.VITE_PUBLIC_GATEWAY_URL || 'wss://api.openhw-studio.com:5099') + '/api/network-gateway');
        
        this.ap = new WokwiInternetAP(clock, url, boardId, {
            ...options,
            privateGateway: isPrivate
        }, onStateUpdate);
        this.medium = new WokwiWifiMedium(this.ap);
    }

    public disconnect() {
        this.ap.disconnect();
    }
    
    downloadPcap() {
        if (this.ap) {
            this.ap.downloadPcap();
        }
    }
}

export class ESP32Runner implements BoardRunner {
    wifiManager: NativeWiFiBridge | null = null;
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
    private _updateOopPin: ((boardPinStr: string, isHighOrVoltage: boolean | number, customCompId?: string) => void) | null = null;
    private pendingCycles: number = 0;
    private channel = new MessageChannel();

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
        if (this.wifiManager) {
            try { this.wifiManager.disconnect(); } catch (e) {}
        }
        this.lastTime = performance.now();
        this.pinsChanged = true;
        this.circuitDirty = true;
        this.pendingCycles = 0;
        this.channel.port1.onmessage = this.runLoop;
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
        console.log(`\n\n[ESP32Runner] ==========================================`);
        console.log(`[ESP32Runner] RUNNER VERSION: v14 (SIMULATORBRIDGE PROTOCOL + STATE EMIT)`);
        console.log(`[ESP32Runner] ==========================================\n\n`);
        const binaryBytes = decodeBase64ToBytes(hexData);
        console.warn(`[ESP32Runner] Flashing binary of size: ${binaryBytes.length} bytes`);
        console.warn(`[ESP32Runner] Magic byte at 0x1000: 0x${binaryBytes[0x1000]?.toString(16)} (Expected: 0xe9)`);
        console.warn(`[ESP32Runner] Magic byte at 0x0000: 0x${binaryBytes[0]?.toString(16)}`);
        
        // CRITICAL: Do NOT pass an external SimulationClock to the ESP32 constructor!
        // When you do, clock.cpu points to a null/different object, so all clock events
        // (like eFuse cmdDone after 634,400 cycles) NEVER fire, causing the BootROM to
        // spin forever waiting for eFuse operations to complete.
        // Let ESP32 create its own internal clock, then grab the reference from it.
                this.cpu = new ESP32({ flashSizeMB: 4, flash: binaryBytes });
        this.clock = this.cpu.clock; // Use the clock that is correctly linked to this CPU
        
        try {
            const boardComp = componentsDef.find(c => c.id === this.boardId);
            const wifiAttrs = boardComp?.attrs || {};
            this.wifiManager = new NativeWiFiBridge(
                '', 
                this.clock, 
                this.boardId, 
                {
                    ssid: wifiAttrs.ssid,
                    password: wifiAttrs.password,
                    bssid: wifiAttrs.bssid,
                    channel: wifiAttrs.channel ? parseInt(wifiAttrs.channel) : 6,
                    privateGateway: wifiAttrs.privateGateway,
                    sessionId: options.sessionId
                },
                this.onStateUpdate.bind(this)
            );
            if (this.cpu.wifi) {
                let macSeed = Math.floor(Math.random() * 255); // Randomize to prevent collisions across tabs
                for (let i = 0; i < this.boardId.length; i++) macSeed += this.boardId.charCodeAt(i);
                macSeed += Math.floor(Math.random() * 10000);
                const mac = new Uint8Array([0x24, 0x0a, 0xc4, (macSeed >> 16) & 0xff, (macSeed >> 8) & 0xff, macSeed & 0xff]);
                this.cpu.wifi.setMacAddress(mac);
                
                // Program MAC address into eFuse BLK0 (EFUSE_BLK0_RDATA1_REG and EFUSE_BLK0_RDATA2_REG)
                try {
                    const macReg1 = ((mac[2] << 24) | (mac[3] << 16) | (mac[4] << 8) | mac[5]) >>> 0;
                    const macReg2 = ((mac[0] << 8) | mac[1]) >>> 0;
                    this.cpu.cores[0].writeUint32(0x3ff5a004, macReg1);
                    this.cpu.cores[0].writeUint32(0x3ff5a008, macReg2);
                } catch(e) {}
                
                this.cpu.wifi.onTX = (frame: Uint8Array) => {
                    const channel = this.cpu.wifi.channel || 6;
                    if (frame.length >= 16) {
                        frame.set(mac, 10);
                    }
                    this.wifiManager!.medium.transmit({ channel, data: frame });
                };
                this.wifiManager.medium.listen((event: any) => {
                    if (event.data) {
                        try {
                            this.cpu.wifi.sendFrame(event.data, 0);
                        } catch (e: any) {
                            console.error(`[ESP32-WIFI-RX] CRITICAL ERROR IN sendFrame for length=${event.data.length}:`, e);
                        }
                    }
                });
            }
        } catch (wifiErr) {
            console.error('[ESP32Runner] Failed to initialize WiFi:', wifiErr);
        } // Use the clock that is correctly linked to this CPU
        
        // Also manually set flash to be absolutely sure the binary is loaded
        if (this.cpu.flash) {
            this.cpu.flash.set(binaryBytes);
        }
        
        // Load physical BootROM if provided
        if (options.esp32Rom) {
            const rom = options.esp32Rom;
            // Note: esp32-v3-rom.bin is 455722 bytes (384KB code + 61KB data).
            // DO NOT truncate it! The Data ROM is required for BootROM stability.
            this.cpu.loadROM(rom);
        }
        
        // CRITICAL: Force strapping pins for SPI Flash Boot BEFORE reset!
        if (this.cpu.gpio && this.cpu.gpio.pins) {
            if (this.cpu.gpio.pins[0]) this.cpu.gpio.pins[0].inputValue = true;   // GPIO0: HIGH
            if (this.cpu.gpio.pins[2]) this.cpu.gpio.pins[2].inputValue = false;  // GPIO2: LOW
            if (this.cpu.gpio.pins[12]) this.cpu.gpio.pins[12].inputValue = false; // GPIO12: LOW
            if (this.cpu.gpio.pins[15]) this.cpu.gpio.pins[15].inputValue = false; // GPIO15: LOW (Verbose BootROM UART!)
        }

        // Reset CPU to initialize MMU registers, dual cores, and peripherals. 
        this.cpu.reset();
        
        // Flash the merged binary image directly into physical flash memory AFTER reset!
        // (Just in case the reset() method clears the internal flash buffer)
        this.cpu.flash.set(binaryBytes);
        console.warn(`[ESP32Runner] Magic byte at 0x1000 AFTER flash set: 0x${this.cpu.flash[0x1000]?.toString(16)}`);
        
        // CRITICAL: Wokwi maintains an internal `strapValue` property that overrides pin states.
        if (this.cpu.gpio) {
            (this.cpu.gpio as any).strapValue = 0x13; // default: GPIO5=1,GPIO15=1,GPIO0=1 = SPI Flash + Verbose
        }
        
        // CRITICAL FIX: Wokwi MMU starts with ALL entries = 256 (INVALID bit set).
        // The BootROM reads flash through the MMU-cached virtual address window (0x3f400000 / 0x40200000).
        // Without valid MMU entries, every flash read returns -1 (invalidMem), causing the boot loop.
        // Flash page size = 64KB (shift=16). For 4MB flash = 64 pages (indices 0-63).
        // We pre-populate mmuTablePro with a 1:1 identity mapping for all flash pages.
        if ((this.cpu as any).mmuTablePro) {
            const mmuPro = (this.cpu as any).mmuTablePro as Uint32Array;
            const mmuApp = (this.cpu as any).mmuTableApp as Uint32Array;
            const FLASH_PAGES = 64; // 64 pages × 64KB = 4MB
            for (let page = 0; page < FLASH_PAGES; page++) {
                mmuPro[page] = page;  // 1:1 identity mapping, no invalid bit
                mmuApp[page] = page;
            }
            console.log(`[ESP32Runner] Pre-seeded MMU with ${FLASH_PAGES} identity-mapped flash pages`);
        }
        
        // CRITICAL FIX #2: The BootROM polls 0x3ff5a104 (EFUSE_STATUS_REG) waiting for 0x5aa5.
        // Wokwi's Efuse controller initializes this to 0x1 (busy), so the BootROM spins forever.
        // We pre-write 0x5aa5 to indicate "eFuse ready" so the BootROM can proceed.
        try {
            this.cpu.cores[0].writeUint32(0x3ff5a104, 0x5aa5);
            console.log('[ESP32Runner] Pre-initialized EFUSE_STATUS_REG to 0x5aa5 (ready)');
        } catch(e) {}
        
        this.cpu.stopped = false; // Force CPU to not be halted
        if (this.cpu.cores?.[0] && typeof this.cpu.cores[0].PC !== 'undefined') {
            // Optional: log initial PC
            console.log('[ESP32Runner] Initial Core0 PC after reset: 0x' + this.cpu.cores[0].PC.toString(16));
            try {
                // Read GPIO_STRAP_REG (0x3FF44038)
                const strap = this.cpu.cores[0].readUint32(0x3FF44038);
                console.warn(`[ESP32Runner] GPIO_STRAP_REG after reset: 0x${strap.toString(16)} (Binary: ${strap.toString(2)})`);
            } catch (e) {}
        }
        
        // Setup serial UART0 output bridge + SimulatorBridge protocol parser
        if (this.cpu.uart && this.cpu.uart[0]) {
            let uartBuffer = '';
            let protocolFrame = ''; // accumulates chars between > and <
            let inFrame = false;

            const parseProtocolFrame = (frame: string) => {
                // >GPIO:13:1< → digitalWrite(13, HIGH)
                const gpioMatch = frame.match(/^GPIO:(\d+):(\d+)$/);
                if (gpioMatch) {
                    const pin = parseInt(gpioMatch[1], 10);
                    const val = parseInt(gpioMatch[2], 10) !== 0;
                    // Update component netlist voltage (drives LED)
                    if (this._updateOopPin) {
                        this._updateOopPin(String(pin), val ? 3.3 : 0);
                    }
                    // Also update pinStates so repropagateAllVoltages picks it up
                    this.pinStates[String(pin)] = val;
                    this.circuitDirty = true;
                    this.pinsChanged = true;
                    // Emit pin state to frontend
                    const pinsPayload: Record<string, boolean> = {};
                    for (const [k, v] of Object.entries(this.pinStates)) {
                        pinsPayload[k] = !!v;
                    }
                    this.onStateUpdate({ type: 'state', boardId: this.boardId, pins: pinsPayload });
                    return;
                }
                // >TONE:5:262:200< → Piezo Buzzer tone
                const toneMatch = frame.match(/^TONE:(\d+):(\d+):(\d+)$/);
                if (toneMatch) {
                    const pin = toneMatch[1];
                    const freq = parseInt(toneMatch[2], 10);
                    const dur = parseInt(toneMatch[3], 10);
                    this.syncTone(pin, freq, dur);
                    return;
                }

                // >PWM:pin:duty< → PWM output (e.g., servo, fading LED)
                const pwmMatch = frame.match(/^PWM:(\d+):(\d+)$/);
                if (pwmMatch) {
                    const pin = parseInt(pwmMatch[1], 10);
                    const val = parseInt(pwmMatch[2], 10);
                    const duty_pct = Math.max(0, Math.min(1.0, val / 255.0));
                    this.syncPwm(pin, duty_pct);
                    return;
                }

                // >I2C:3c:00aed5...< → I2C write (forward to protocol analyzer and internal components)
                const i2cMatch = frame.match(/^I2C:([0-9a-fA-F]+):(.*)$/);
                if (i2cMatch) {
                    const addr = parseInt(i2cMatch[1], 16);
                    const hex = i2cMatch[2];
                    
                    // Route I2C payload to simulated components (like OLED/LCD)
                    this.instances.forEach(inst => {
                        const anyInst = inst as any;
                        let updated = false;
                        if (typeof anyInst.onI2CStart === 'function') {
                            anyInst.onI2CStart(addr, false);
                            updated = true;
                        }
                        if (typeof anyInst.onI2CByte === 'function') {
                            for (let i = 0; i < hex.length; i += 2) {
                                const byte = parseInt(hex.substring(i, i + 2), 16);
                                if (!isNaN(byte)) anyInst.onI2CByte(addr, byte);
                            }
                            updated = true;
                        }
                        if (typeof anyInst.onI2CStop === 'function') anyInst.onI2CStop();
                        
                        if (updated) {
                            inst.stateChanged = true;
                        }
                    });

                    // Truncate the hex string for the frontend logger to prevent freezing the UI with massive OLED display buffers
                    const displayHex = hex.length > 64 ? hex.substring(0, 64) + '...(truncated)' : hex;
                    this.onStateUpdate({ type: 'protocol:i2c', boardId: this.boardId, address: addr, hex: displayHex, direction: 'write' });
                    return;
                }
                
                // >SPI:<hexbyte>< or >SPIBUF:<hexdata>< → SPI write
                const spiMatch = frame.match(/^SPI:([0-9a-fA-F]{2})$/);
                const spiBufMatch = frame.match(/^SPIBUF:([0-9a-fA-F]+)$/);
                if (spiMatch || spiBufMatch) {
                    const hex = spiMatch ? spiMatch[1] : spiBufMatch![1];
                    this.syncSpiBatch(hex);
                    return;
                }

                // >DAC:pin:val< → 8-bit DAC output (ESP32 pins 25, 26)
                const dacMatch = frame.match(/^DAC:(\d+):(\d+)$/);
                if (dacMatch) {
                    const pin = parseInt(dacMatch[1], 10);
                    const val = parseInt(dacMatch[2], 10); // 0-255
                    this.syncDac(pin, val);
                    return;
                }
            };

            this.cpu.uart[0].onTX = (byte: number) => {
                const char = String.fromCharCode(byte);

                // Parse SimulatorBridge protocol frames (>FRAME<)
                if (char === '>') {
                    inFrame = true;
                    protocolFrame = '';
                } else if (char === '<' && inFrame) {
                    inFrame = false;
                    if (protocolFrame.length > 0) {
                        parseProtocolFrame(protocolFrame);
                    }
                    protocolFrame = '';
                } else if (inFrame) {
                    protocolFrame += char;
                }

                // Line-buffer for console logging
                if (char === '\n' || char === '\r') {
                    if (uartBuffer.length > 0) {
                        // Suppress massive internal protocol frames from the browser console
                        if (!uartBuffer.startsWith('>I2C') && !uartBuffer.startsWith('>SPI') && !uartBuffer.startsWith('>ADC') && !uartBuffer.startsWith('>DAC') && !uartBuffer.startsWith('>SIM')) {
                            console.log(`[ESP32 UART0] ${uartBuffer}`);
                        }
                        uartBuffer = '';
                    }
                } else {
                    uartBuffer += char;
                }

                if (this.onByteTransmitCb) {
                    this.onByteTransmitCb({ boardId: this.boardId, value: byte, char, source: 'uart0' });
                }

                // Line-buffer for serial monitor: emit complete lines as SERIAL_OUTPUT
                // This matches the behavior of qemuRunner.js on the backend
                if (!inFrame) {
                    if (char === '\n') {
                        if (this.uartLineBuffer.length > 0) {
                            this.onStateUpdate({ type: 'SERIAL_OUTPUT', text: this.uartLineBuffer, boardId: this.boardId, source: 'wasm' });
                        }
                        this.uartLineBuffer = '';
                    } else if (char !== '\r') {
                        this.uartLineBuffer += char;
                    }
                }
            };
            
            // CRITICAL FIX #3: The UART TX state machine needs txComplete() to be called
            // after each byte to advance to the next one. Normally this is driven by a
            // baud-rate clock event in Wokwi's framework, but we don't have that.
            // Without this, the BootROM busy-waits on TXFIFO_CNT forever.
            // Fix: patch txUpdated() to immediately call txComplete() to drain the FIFO.
            const uart = this.cpu.uart[0] as any;
            const origTxUpdated = uart.txUpdated.bind(uart);
            uart.txUpdated = function(this: any) {
                origTxUpdated();
                if (this.txState !== 0) { // not TX_IDLE
                    this.txComplete();
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

        // Store updateOopPin as a class field so the UART protocol parser can call it
        this._updateOopPin = updateOopPin;
        
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
    getSimulatedTimeMs() {
        if (!this.cpu) return 0;
        return Math.floor((this.cpu.cycles - this.cpuCyclesAtStart) / ((this.cpu as any).clock?.frequency / 1000 || 160_000));
    }

    readDirectMemory(address: number, length: number): Uint8Array | null {
        if (!this.cpu || !this.cpu.cores || !this.cpu.cores[0]) return null;
        const core = this.cpu.cores[0];
        
        if (typeof core.readUint8 === 'function') {
            const buf = new Uint8Array(length);
            for (let i = 0; i < length; i++) {
                try {
                    buf[i] = core.readUint8(address + i);
                } catch (e) {
                    // Memory read error, just return what we have
                    break;
                }
            }
            return buf;
        }
        return null;
    }

    writeDirectMemory(address: number, data: Uint8Array) {
        if (!this.cpu || !this.cpu.cores || !this.cpu.cores[0]) return;
        const core = this.cpu.cores[0];

        if (typeof core.writeUint8 === 'function') {
            for (let i = 0; i < data.length; i++) {
                try {
                    core.writeUint8(address + i, data[i]);
                } catch (e) {
                    break;
                }
            }
        }
    }

    private runLoop = () => {
        if (!this.running || !this.cpu) return;

        const now = performance.now();
        const deltaTime = now - this.lastTime;
        this.lastTime = now;
        
        const loopCount = (this as any)._runLoopCount || 0;
        (this as any)._runLoopCount = loopCount + 1;

        if (deltaTime > 0) {
            const F_CPU = (this.cpu as any).clock?.frequency ?? 160_000_000;
            const cyclesPerMs = (F_CPU / 1000) * this.speed;
            
            // Limit deltaTime to max 100ms to prevent death spirals if browser tab sleeps
            const cappedDelta = Math.min(deltaTime, 100);
            this.pendingCycles += cappedDelta * cyclesPerMs;

            const executionStartTime = performance.now();
            
            const instArray = Array.from(this.instances.values());
            const physicsInterval = this.speed > 1.0 ? 8 : 12;
            const shouldSolvePhysics = this.circuitDirty || (now - this.lastPhysicsSolveAt) >= physicsInterval;

            // Log PC every 500 runLoop ticks
            if (((this as any)._runLoopCount || 0) % 500 === 0) {
                const core0 = this.cpu.cores?.[0];
                let pcVal = 0;
                if (core0) {
                    pcVal = core0.PC ?? core0.pc ?? (typeof core0.getPC === 'function' ? core0.getPC() : 0);
                }

            }

            // Execute instructions strictly 1-for-1 to guarantee PWM/SPI/I2C peripheral timing.
            // Run as many as physically possible in a 16ms window to maintain 60fps UI.
            while (this.pendingCycles > 0 && this.running && this.cpu) {
                if (performance.now() - executionStartTime > 16) {
                    // Yield to browser to keep UI responsive, save remaining cycles for next tick
                    break;
                }

                const chunkTarget = Math.min(this.pendingCycles, 100000);
                const startCycles = this.cpu.cycles;
                const F_CPU = (this.cpu as any).clock?.frequency || 160_000_000;
                const targetCycles = startCycles + chunkTarget;
                const targetNanos = (targetCycles / F_CPU) * 1e9;

                while (this.cpu.cycles < targetCycles && this.running) {
                    // Wokwi Idle Skipping: Instantly jump simulated time if CPU is waiting
                    if ((this.cpu as any).coresIdle && (this.cpu as any).clock) {
                        (this.cpu as any).clock.skipToNextEvent(targetNanos);
                    }
                    this.cpu.step();
                }
                
                const cyclesDone = this.cpu.cycles - startCycles;
                this.pendingCycles -= cyclesDone;
            }

            // --- Component updates for smooth animation ---
            // MOVED OUTSIDE THE LOOP! This runs just ONCE per 16ms frame (60fps) instead of 
            // 6,400 times per simulated second. This entirely eliminates the 9000ms time drift.
            if (this.running && this.cpu) {
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

                // Emit component states to frontend only for those that changed
                if (anyStateChanged && instArray.length > 0) {
                    const compStates = instArray
                        .filter(inst => (inst as any).pendingVisualStateEmit)
                        .map(inst => {
                            (inst as any).pendingVisualStateEmit = false;
                            return {
                                id: inst.id,
                                type: inst.type,
                                state: (typeof (inst as any).getState === 'function'
                                    ? (inst as any).getState()
                                    : inst.state) || {},
                            };
                        });
                    if (compStates.length > 0) {
                        this.onStateUpdate({ type: 'state', boardId: this.boardId, components: compStates });
                    }
                }
            }



            if (shouldSolvePhysics) {
                if (typeof this.repropagateAllVoltages === 'function') {
                    this.repropagateAllVoltages();
                }
                this.lastPhysicsSolveAt = now;
                this.circuitDirty = false;
            }

            // Pace Serial RX (bytes per millisecond = baudRate / 10000)
            const bytesPerMs = this.serialBaudRate / 10000;
            this.serialByteBudget += cappedDelta * bytesPerMs;

            if (this.serialBuffer.length > 0 && this.cpu.uart && this.cpu.uart[0] && this.serialByteBudget >= 1) {
                const maxBytes = Math.floor(this.serialByteBudget);
                const toSend = Math.min(maxBytes, this.serialBuffer.length);
                for (let i = 0; i < toSend; i++) {
                    const val = this.serialBuffer.shift()!;
                    this.cpu.uart[0].feedByte(val);
                }
                this.serialByteBudget -= toSend;
            }

            // Emit pin states every frame so frontend stays in sync
            // (SimulatorBridge protocol parser updates this.pinStates directly;
            //  this emit delivers them to renderPinsByBoardRef in SimulatorPage)
            if (this.pinsChanged) {
                this.pinsChanged = false;
                const pinsPayload: Record<string, boolean> = {};
                for (const [k, v] of Object.entries(this.pinStates)) {
                    pinsPayload[k] = !!v;
                }
                this.onStateUpdate({ type: 'state', boardId: this.boardId, pins: pinsPayload });
            }
        }

        // Use MessageChannel for 0ms delay yield (significantly faster than setTimeout(..., 1))
        this.channel.port2.postMessage(null);
    };

    serialRx(data: string) {
        for (let i = 0; i < data.length; i++) {
            this.serialBuffer.push(data.charCodeAt(i) & 0xff);
        }
    }

    serialRxByte(value: number) {
        this.serialBuffer.push(value & 0xff);
    }

    syncTone(pin: string, frequency: number, duration: number) {
        const aliases = [pin];
        if (/^\d+$/.test(pin)) aliases.push(`D${pin}`, `GPIO${pin}`);
        else if (/^(D|GPIO)(\d+)$/i.test(pin)) {
            const num = pin.replace(/\D/g, '');
            aliases.push(num, `D${num}`, `GPIO${num}`);
        }

        const endpoints = collectConnectedComponentPins(this.boardId, aliases, this.currentWires, this.instances);
        const isSilent = frequency === 0;

        // Removed fallback logic for verification

        for (const endpoint of endpoints) {
            const comp = endpoint.inst;
            if (isSilent) {
                if (typeof (comp as any).setState === 'function') {
                    (comp as any).setState({ isBuzzing: false, frequency: 0, voltageDrop: 0, current: 0 });
                }
            } else {
                (comp as any)._isToneBypassed = true;
                if (typeof (comp as any).setState === 'function') {
                    (comp as any).setState({ isBuzzing: true, frequency, voltageDrop: 3.3, current: 0.015 });
                }
            }
        }
    }

    syncPwm(channel: number, duty_pct: number) {
        const pin = String(channel);
        const aliases = [pin];
        if (/^\d+$/.test(pin)) aliases.push(`D${pin}`, `GPIO${pin}`);
        else if (/^(D|GPIO)(\d+)$/i.test(pin)) {
            const num = pin.replace(/\D/g, '');
            aliases.push(num, `D${num}`, `GPIO${num}`);
        }

        const endpoints = collectConnectedComponentPins(this.boardId, aliases, this.currentWires, this.instances);
        // Removed fallback logic for verification

        for (const endpoint of endpoints) {
            const targetInst = endpoint.inst;
            if (typeof (targetInst as any).onPWMSignal === 'function') {
                 (targetInst as any).onPWMSignal(endpoint.pinId, 1000, duty_pct, duty_pct * 1000);
            } else if (typeof (targetInst as any).onPWM === 'function') {
                 (targetInst as any).onPWM(endpoint.pinId, { dutyCycle: duty_pct });
            }
        }
    }

    syncSpiBatch(hex: string) {
        const bytes: number[] = [];
        for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.substring(i, i + 2), 16));
        
        // For verification, we should theoretically use the adjacency map here too.
        // But SPI is a bus (MOSI, MISO, SCK) and UART frames don't include the pin.
        // For strict verification, if you want SPI wire tracing, we'd need to trace the SPI pins.
        // For now, leaving the broadcast for SPI since SPI is generally bus-wide and the user asked about buzzer/PWM.
        const spiDevices = Array.from(this.instances.values()).filter(inst => 
            typeof (inst as any).onSPIByte === 'function'
        );
        for (const dev of spiDevices) {
            for (const byte of bytes) (dev as any).onSPIByte(byte);
            dev.stateChanged = true;
        }
    }

    syncAdc(channel: number, val: number) {
        // ESP32 SimulatorBridge expects <ADC:pin:val>\n on UART0 for analog injection
        const cmd = `<ADC:${channel}:${val}>\n`;
        this.serialRx(cmd);
    }

    syncAnalog(pin: number, val: number) {
        this.syncAdc(pin, val);
    }

    syncDac(pin: number, val: number) {
        // Route DAC voltage to any component connected on that pin via wire adjacency map
        const pinStr = String(pin);
        const aliases = [pinStr, `D${pinStr}`, `GPIO${pinStr}`];
        const voltage = (val / 255.0) * 3.3;
        const endpoints = collectConnectedComponentPins(this.boardId, aliases, this.currentWires, this.instances);
        for (const endpoint of endpoints) {
            const inst = endpoint.inst;
            if (typeof (inst as any).onAnalogVoltage === 'function') {
                (inst as any).onAnalogVoltage(endpoint.pinId, voltage);
            } else if (typeof (inst as any).setState === 'function') {
                (inst as any).setState({ voltage, analog: val });
            }
        }
        // Also emit to frontend for oscilloscope/plotter components
        this.onStateUpdate({ type: 'esp32:dac:sync', boardId: this.boardId, pin, val, voltage });
    }

    syncSerial(text: string) {
        this.onStateUpdate({ type: 'serial', data: text, boardId: this.boardId, source: 'wasm' });
    }

    syncNeopixel(channel: number, pixels: any[]) {
        // Route WS2812/NeoPixel pixels to any component wired to that channel pin
        const pinStr = String(channel);
        const aliases = [pinStr, `D${pinStr}`, `GPIO${pinStr}`];
        const endpoints = collectConnectedComponentPins(this.boardId, aliases, this.currentWires, this.instances);
        for (const endpoint of endpoints) {
            const comp = endpoint.inst;
            if (typeof (comp as any).updatePixels === 'function') {
                (comp as any).updatePixels(pixels);
            } else if (typeof (comp as any).onWS2812BByte === 'function') {
                for (const p of pixels) {
                    (comp as any).onWS2812BByte(p.g);
                    (comp as any).onWS2812BByte(p.r);
                    (comp as any).onWS2812BByte(p.b);
                }
            } else {
                (comp as any).pixels = pixels;
            }
        }
    }
    // ── GPIO Routing map (LEDC/RMT channel → GPIO pin) ─────────────────────
    private gpioRoutingMap: Map<number, string> = new Map();
    // ── LEDC channel → pin map (set by sim_ledcAttachPin) ──────────────────
    private ledcChannelMap: Map<number, number> = new Map();
    // ── UART TX line buffer for serial monitor ──────────────────────────────
    private uartLineBuffer: string = '';

    syncGpioRouting(gpio: number, signal_id: string) {
        this.gpioRoutingMap.set(gpio, signal_id);
        // If this maps a WS2812 channel to a pin, NeoPixel routing now resolves correctly
    }

    clearGpioRouting(gpio: number) {
        this.gpioRoutingMap.delete(gpio);
    }

    syncLedc(channel: number, duty_pct: number) {
        // Resolve LEDC channel → physical pin via ledcChannelMap, then reuse syncPwm
        const pin = this.ledcChannelMap.get(channel);
        if (pin !== undefined) {
            this.syncPwm(pin, duty_pct);
        } else {
            // Fallback: treat channel as pin number (compatible with analogWrite behavior)
            this.syncPwm(channel, duty_pct);
        }
    }

    ledcAttachPin(pin: number, channel: number) {
        this.ledcChannelMap.set(channel, pin);
    }

    syncSerialRx(channel: number, data: string) {
        // Inject data from an external component into UART RX (simulates a connected serial device)
        const pinStr = String(channel);
        const aliases = [pinStr, `D${pinStr}`, `GPIO${pinStr}`, `RX${channel}`, `U${channel}RXD`];
        const endpoints = collectConnectedComponentPins(this.boardId, aliases, this.currentWires, this.instances);
        // Also inject the raw bytes into UART0 for firmware Serial.read()
        this.serialRx(data);
        // Notify any component that has a data sink callback
        for (const endpoint of endpoints) {
            if (typeof (endpoint.inst as any).onSerialData === 'function') {
                (endpoint.inst as any).onSerialData(data);
            }
        }
    }

    syncPcnt(unit: number, count: number) {
        // Inject a pulse count into the firmware via UART0 command
        const cmd = `<PCNT:${unit}:${count}>\n`;
        this.serialRx(cmd);
    }

    syncTwai(id: number, dlc: number, data: number[]) {
        // Route a received CAN frame to any component wired to TWAI TX/RX pins (pins 4/5 default)
        const hexData = data.map(b => b.toString(16).padStart(2, '0')).join('');
        const aliases = ['4', 'D4', 'GPIO4', '5', 'D5', 'GPIO5', 'CANH', 'CANL'];
        const endpoints = collectConnectedComponentPins(this.boardId, aliases, this.currentWires, this.instances);
        for (const endpoint of endpoints) {
            if (typeof (endpoint.inst as any).onCanFrame === 'function') {
                (endpoint.inst as any).onCanFrame(id, dlc, data);
            }
        }
        // Inject into firmware for can.receive() if needed
        const cmd = `<TWAI:${id.toString(16).padStart(8, '0')}:${dlc.toString(16).padStart(2, '0')}:${hexData}>\n`;
        this.serialRx(cmd);
    }

    syncRmt(channel: number, pulses: Array<{ level: number; duration: number }>) {
        // Route RMT pulses (IR) to a component wired to the RMT output pin
        const gpio = this.gpioRoutingMap.get(channel) ?? String(channel);
        const aliases = [gpio, `D${gpio}`, `GPIO${gpio}`];
        const endpoints = collectConnectedComponentPins(this.boardId, aliases, this.currentWires, this.instances);
        for (const endpoint of endpoints) {
            if (typeof (endpoint.inst as any).onRmtPulse === 'function') {
                (endpoint.inst as any).onRmtPulse(pulses);
            } else if (typeof (endpoint.inst as any).onInfraredSignal === 'function') {
                (endpoint.inst as any).onInfraredSignal(pulses);
            }
        }
    }

    syncSleep(duration_us: number) {
        this.running = false;
        this.onStateUpdate({ type: 'sim:sleep', boardId: this.boardId, duration_us });
        if (duration_us > 0) {
            setTimeout(() => {
                this.running = true;
                this.onStateUpdate({ type: 'sim:wake', boardId: this.boardId });
            }, Math.min(duration_us / 1000, 30000)); // cap at 30s for sim purposes
        }
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
        if (this.wifiManager) {
            msg.wifi = {
                txBytes: this.wifiManager.txBytes || 0,
                rxBytes: this.wifiManager.rxBytes || 0
            };
        }

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
    
    downloadPcap() {
        if (this.wifiManager) {
            this.wifiManager.downloadPcap();
        }
    }
}
