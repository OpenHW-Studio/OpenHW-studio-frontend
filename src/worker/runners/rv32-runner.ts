import { BaseComponent } from '@openhw/emulator';
import { BoardRunner, AVRRunnerOptions, LOGIC_REGISTRY, COMPONENT_PINS, getUnifiedComponentSyncState } from '../registries/component-registry.js';
import init, { WasmEmulator } from '../../wasm/esp-emu/esp_emu.js';
import wasmUrl from '../../wasm/esp-emu/esp_emu_bg.wasm?url';

export class RV32Runner implements BoardRunner {
    cpu: any = null;
    running: boolean = false;
    boardId: string;
    speed: number = 1.0;
    solverMode: 'logic' = 'logic';
    
    instances: Map<string, BaseComponent> = new Map();
    currentWires: any[] = [];
    pinStates: Record<string, boolean> = {};
    pinToNet: Map<string, number> = new Map();

    private emulator: WasmEmulator | null = null;
    private readonly firmwareHex: string;
    private readonly onStateUpdate: (state: any) => void;
    private readonly onByteTransmitCb?: (payload: { boardId: string; value: number; char: string; source?: string }) => void;
    private readonly onWifiTx?: (frame: ArrayBuffer) => void;
    private lastEmitAt: number = 0;
    private statusInterval: any;
    private readonly chipType: string;
    private readonly wifiSsid: string;
    private readonly wifiPassword: string;
    private readonly isPrivateGateway: boolean;

    private bleSocket: WebSocket | null = null;
    private threadSocket: WebSocket | null = null;
    private wifiSocket: WebSocket | null = null;
    private readonly sessionId: string;
    private wifiPacketBuffer: Uint8Array[] = [];
    private readonly elfBase64?: string;

    constructor(
        firmwareHex: string,
        components: any[],
        wires: any[],
        onStateUpdate: (state: any) => void,
        options: AVRRunnerOptions & { onWifiTx?: (frame: ArrayBuffer) => void; elf?: string } = {}
    ) {
        this.boardId = options.boardId || 'default';
        this.firmwareHex = firmwareHex || '';
        this.onStateUpdate = onStateUpdate;
        this.onByteTransmitCb = options.onByteTransmit;
        this.onWifiTx = options.onWifiTx;
        this.elfBase64 = options.elf;

        let chip = 'esp32c3';
        const board = components.find(c => c.type && /(esp32)/i.test(c.type));
        if (board?.type) {
            const type = board.type.toLowerCase().replace(/-/g, '');
            if (type.includes('esp32c6')) chip = 'esp32c6';
            else if (type.includes('esp32p4')) chip = 'esp32p4';
            else if (type.includes('esp32s31')) chip = 'esp32s31';
            else if (type.includes('esp32c3')) chip = 'esp32c3';
        }
        this.chipType = chip;

        // Parse WiFi config if AP exists
        const wifiAp = components.find(c => c.type === 'openhw-wifi-ap' || c.type === 'wokwi-wifi-ap');
        this.wifiSsid = wifiAp?.attrs?.ssid || 'Wokwi-GUEST';
        this.wifiPassword = wifiAp?.attrs?.password || '';
        this.isPrivateGateway = !!wifiAp?.attrs?.privateGateway;
        this.sessionId = options.sessionId || 'default';

        // Instantiate components
        (components || []).forEach(cDef => {
            const LogicClass = LOGIC_REGISTRY[cDef.type];
            if (LogicClass) {
                const pins = COMPONENT_PINS[cDef.type] || [];
                const manifest = { type: cDef.type, attrs: cDef.attrs || {}, pins };
                const inst = new LogicClass(cDef.id, manifest);
                if (cDef.attrs) inst.state = { ...inst.state, ...cDef.attrs };
                this.instances.set(cDef.id, inst);
            }
        });
        this.currentWires = wires || [];
        this.buildNetlist();
    }

    private buildNetlist() {
        const adj = new Map<string, string[]>();
        for (const wire of this.currentWires || []) {
            if (!adj.has(wire.from)) adj.set(wire.from, []);
            if (!adj.has(wire.to)) adj.set(wire.to, []);
            adj.get(wire.from)!.push(wire.to);
            adj.get(wire.to)!.push(wire.from);
        }

        const visited = new Set<string>();
        this.pinToNet.clear();
        let currentNet = 0;

        for (const startNode of adj.keys()) {
            if (visited.has(startNode)) continue;
            const queue = [startNode];
            visited.add(startNode);
            while (queue.length > 0) {
                const node = queue.shift()!;
                this.pinToNet.set(node, currentNet);
                
                // Add aliases for digital pins without prefix
                const [compId, pinId] = node.split(':');
                if (compId && pinId) {
                    if (/^\d+$/.test(pinId)) this.pinToNet.set(`${compId}:D${pinId}`, currentNet);
                    if (/^D\d+$/i.test(pinId)) this.pinToNet.set(`${compId}:${pinId.substring(1)}`, currentNet);
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

    async init() {
        console.log(`[RV32Runner] Initializing WASM engine for ${this.chipType}`);
        await init(wasmUrl);
        
        this.emulator = new WasmEmulator(this.chipType);
        this.cpu = this.emulator; // Reference for component-registry if needed

        // Attempt to load the default ROM for this chip if it has one embedded
        if (this.emulator.has_default_rom()) {
            try {
                this.emulator.load_default_rom();
                console.log(`[RV32Runner] Loaded default embedded ROM for ${this.chipType}`);
            } catch (e) {
                console.error(`[RV32Runner] Failed to load default ROM:`, e);
            }
        } else {
            console.warn(`[RV32Runner] No embedded ROM available for ${this.chipType}`);
        }

        // Apply WiFi configuration
        this.emulator.set_wifi_config(this.wifiSsid, this.wifiPassword);
        console.log(`[RV32Runner] WiFi config configured. SSID="${this.wifiSsid}"`);
        
        // Connect BLE and Thread WebSockets
        this.initWebSockets();
        
        if (this.firmwareHex) {
            let firmwareData: Uint8Array;
            try {
                const binString = atob(this.firmwareHex.trim());
                firmwareData = new Uint8Array(binString.length);
                for (let i = 0; i < binString.length; i++) {
                    firmwareData[i] = binString.charCodeAt(i);
                }
                this.emulator.load_firmware(firmwareData);
                console.log(`[RV32Runner] Firmware loaded (${firmwareData.length} bytes)`);
            } catch (e) {
                console.error(`[RV32Runner] Failed to decode firmware:`, e);
            }
        }
        
        if (this.elfBase64 && this.emulator) {
            try {
                const binString = atob(this.elfBase64.trim());
                const elfData = new Uint8Array(binString.length);
                for (let i = 0; i < binString.length; i++) {
                    elfData[i] = binString.charCodeAt(i);
                }
                this.emulator.load_app_elf(elfData);
                console.log(`[RV32Runner] Application ELF loaded successfully (${elfData.length} bytes)`);
            } catch (e) {
                console.error(`[RV32Runner] Failed to load application ELF:`, e);
            }
        }
        
        this.running = true;
        this.runLoop();

        this.statusInterval = setInterval(() => {
            if (this.running && Date.now() - this.lastEmitAt > 200) {
                this.notifyComponentStateChange();
            }
        }, 200);
    }

    stop() {
        this.running = false;
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
            this.statusInterval = null;
        }
        if (this.bleSocket) {
            this.bleSocket.close();
            this.bleSocket = null;
        }
        if (this.threadSocket) {
            this.threadSocket.close();
            this.threadSocket = null;
        }
        if (this.emulator) {
            this.emulator.free();
            this.emulator = null;
        }
        console.log(`[RV32Runner] Stopped`);
    }

    getSimulatedTimeMs(): number {
        if (!this.emulator) return 0;
        const cycles = Number(this.emulator.cycles());
        // ESP32 default clock 160MHz
        return cycles / 160000; 
    }

    getRichTelemetrySnapshot(): any[] {
        return [];
    }

    setSolverMode(mode: 'logic') {
        this.solverMode = mode;
    }

    updateSpeed(speed: number) {
        this.speed = speed;
    }

    injectComponentFault(componentId: string, faultType: string, active: boolean) {
        console.warn(`[RV32Runner] injectComponentFault not implemented for RV32 yet`);
    }

    setTelemetryEnabled(enabled: boolean, mode?: string) {
        for (const inst of this.instances.values()) {
            inst.telemetryEnabled = !!enabled;
            inst.telemetryMode = mode || 'detail';
        }
    }

    getSerialBaudRate() {
        return 115200;
    }

    setSerialBaudRate(baud: number) {
        // no-op for now
    }

    serialRxByte(value: number) {
        if (this.emulator) {
            this.emulator.uart_input(new Uint8Array([value & 0xff]));
        }
    }

    serialRx(data: string) {
        if (this.emulator) {
            const bytes = new Uint8Array(data.length);
            for (let i = 0; i < data.length; i++) {
                bytes[i] = data.charCodeAt(i) & 0xff;
            }
            this.emulator.uart_input(bytes);
        }
    }

    injectWifiFrame(frame: Uint8Array) {
        if (this.emulator) {
            this.emulator.wifi_rx_push(frame);
        }
    }

    notifyComponentStateChange() {
        if (!this.running) return;
        this.lastEmitAt = Date.now();

        const components: any[] = [];
        for (const inst of this.instances.values()) {
            components.push({
                id: inst.id,
                type: inst.type,
                state: getUnifiedComponentSyncState(inst)
            });
        }

        this.onStateUpdate({
            type: 'state',
            time: this.getSimulatedTimeMs(),
            cpu: { pc: this.emulator ? this.emulator.pc() : 0 },
            pins: this.pinStates,
            components,
            boardId: this.boardId
        });
    }

    private parseUartLine(line: string) {
        if (!line.startsWith('$')) return;
        const parts = line.split(':');
        const proto = parts[0].substring(1); // remove $

        switch (proto) {
            case 'GPIO': {
                const [, pin, level] = parts;
                const isHigh = level.trim() === '1';
                this.pinStates[pin] = isHigh;
                
                const net = this.pinToNet.get(`${this.boardId}:${pin}`);
                if (net !== undefined) {
                    for (const [id, inst] of this.instances) {
                        for (const pDef of inst.manifest?.pins || []) {
                            if (this.pinToNet.get(`${id}:${pDef.id}`) === net) {
                                inst.onPinStateChange?.(pDef.id, isHigh, Number(this.emulator?.cycles() || 0));
                            }
                        }
                    }
                }
                break;
            }
            case 'I2C': {
                const addr = parseInt(parts[1], 16);
                const dataHex = parts[2] || '';
                const data: number[] = [];
                for (let i = 0; i < dataHex.length; i += 2) {
                    data.push(parseInt(dataHex.substring(i, i + 2), 16));
                }
                for (const inst of this.instances.values()) {
                    if (inst.onI2CStart?.(addr, false)) {
                        for (const b of data) {
                            inst.onI2CByte?.(-1, b);
                        }
                        inst.onI2CStop?.();
                        inst.recordI2cTransaction?.([...data]);
                    }
                }
                break;
            }
            case 'SPI': {
                const cs = parseInt(parts[1], 10);
                const dataHex = parts[2] || '';
                for (let i = 0; i < dataHex.length; i += 2) {
                    const b = parseInt(dataHex.substring(i, i + 2), 16);
                    for (const inst of this.instances.values()) {
                        inst.onSPIByte?.(b);
                    }
                }
                break;
            }
            case 'CAN': {
                const canId = parseInt(parts[1], 16);
                const dlc = parseInt(parts[2], 10);
                const dataHex = parts[3] || '';
                const data: number[] = [];
                for (let i = 0; i < dataHex.length; i += 2) {
                    data.push(parseInt(dataHex.substring(i, i + 2), 16));
                }
                this.onStateUpdate({
                    type: 'protocol:can',
                    boardId: this.boardId,
                    id: canId,
                    dlc,
                    data,
                    timestamp: this.getSimulatedTimeMs()
                });
                break;
            }
            case 'BLE': {
                const subtype = parts[1];
                const payload = parts[2] || '';
                
                if (subtype === 'TX' && this.bleSocket && this.bleSocket.readyState === WebSocket.OPEN) {
                    try {
                        const binary = atob(payload);
                        const bytes = new Uint8Array(binary.length);
                        for (let i = 0; i < binary.length; i++) {
                            bytes[i] = binary.charCodeAt(i);
                        }
                        console.log(`[RV32Runner] BLE TX: sent ${bytes.length} bytes to Bumble gateway`);
                        this.bleSocket.send(bytes.buffer);
                    } catch (e) {
                        console.error('[RV32Runner] Failed to send BLE HCI command:', e);
                    }
                } else if (subtype === 'TX') {
                    console.log(`[RV32Runner] BLE TX Dropped: bleSocket is null or not open`);
                }

                this.onStateUpdate({
                    type: 'protocol:ble',
                    boardId: this.boardId,
                    subtype,
                    payload,
                    timestamp: this.getSimulatedTimeMs()
                });
                break;
            }
            case 'THREAD': {
                const direction = parts[1];
                const channel = parseInt(parts[2], 10);
                const frame = parts[3] || '';
                
                if (direction === 'TX' && this.threadSocket && this.threadSocket.readyState === WebSocket.OPEN) {
                    try {
                        const binary = atob(frame);
                        const bytes = new Uint8Array(binary.length);
                        for (let i = 0; i < binary.length; i++) {
                            bytes[i] = binary.charCodeAt(i);
                        }
                        this.threadSocket.send(bytes.buffer);
                    } catch (e) {
                        console.error('[RV32Runner] Failed to send Thread frame:', e);
                    }
                }

                this.onStateUpdate({
                    type: 'protocol:thread',
                    boardId: this.boardId,
                    direction,
                    channel,
                    frame,
                    timestamp: this.getSimulatedTimeMs()
                });
                break;
            }
            case 'WIFI': {
                const subtype = parts[1];
                const payload = parts[2] || '';
                this.onStateUpdate({
                    type: 'protocol:wifi',
                    boardId: this.boardId,
                    subtype,
                    payload,
                    timestamp: this.getSimulatedTimeMs()
                });
                break;
            }
            case 'SYS': {
                if (parts[1] === 'RESTART') {
                    console.log(`[RV32Runner] CPU restart triggered by firmware`);
                    this.emulator?.restart();
                }
                break;
            }
        }
    }

    private runLoop = () => {
        if (!this.running || !this.emulator) return;

        const startMs = performance.now();
        const budgetMs = 8; 
        let batchesRun = 0;
        
        try {
            while (performance.now() - startMs < budgetMs) {
                const batchSize = Math.floor(50000 * this.speed);
                const uartOutput = this.emulator.run_batch(batchSize);
                batchesRun++;
                
                if (uartOutput && uartOutput.length > 0) {
                    const lines = uartOutput.split('\n');
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (trimmed.startsWith('$')) {
                            // DEBUG: log all protocol lines so we can verify BLE data is flowing
                            if (trimmed.startsWith('$BLE:')) {
                                console.log(`[RV32Runner] [DEBUG] UART $-protocol BLE line: ${trimmed.substring(0, 80)}...`);
                            } else if (trimmed.startsWith('$GPIO:') || trimmed.startsWith('$PWM:') || trimmed.startsWith('$SYS:')) {
                                // Only log non-GPIO/PWM protocol lines to avoid spam — GPIO is very frequent
                            } else {
                                console.log(`[RV32Runner] [DEBUG] UART $-protocol line: ${trimmed.substring(0, 80)}`);
                            }
                            this.parseUartLine(trimmed);
                        } else if (trimmed.length > 0) {
                            if (this.onByteTransmitCb) {
                                for (let i = 0; i < trimmed.length; i++) {
                                    this.onByteTransmitCb({
                                        boardId: this.boardId,
                                        value: trimmed.charCodeAt(i),
                                        char: trimmed[i],
                                        source: 'uart0'
                                    });
                                }
                                this.onByteTransmitCb({
                                    boardId: this.boardId,
                                    value: 10,
                                    char: '\n',
                                    source: 'uart0'
                                });
                            } else {
                                console.log(`[RV32Runner UART] ${trimmed}`);
                            }
                        }
                    }
                }


                // Drain WiFi TX frames and forward to network worker
                const wifiBuf = this.emulator.wifi_tx_drain();
                if (wifiBuf && wifiBuf.length > 0) {
                    console.log(`[RV32Runner] Raw wifiBuf length: ${wifiBuf.length}, head:`, Array.from(wifiBuf.subarray(0, Math.min(wifiBuf.length, 16))).map(x => x.toString(16).padStart(2, '0')).join(' '));
                    let offset = 0;
                    while (offset + 4 <= wifiBuf.length) {
                        const len = wifiBuf[offset] | (wifiBuf[offset + 1] << 8) | (wifiBuf[offset + 2] << 16) | (wifiBuf[offset + 3] << 24);
                        const origOffset = offset;
                        offset += 4;
                        if (offset + len > wifiBuf.length) break;
                        
                        // Extract view and create a standalone copy
                        const view = wifiBuf.subarray(offset, offset + len);
                        const eth = new Uint8Array(view);
                        const frameBuffer = eth.buffer;
                        
                        console.log(`[RV32Runner] DEBUG: origOffset=${origOffset}, newOffset=${offset}, len=${len}, view.length=${view.length}, eth.length=${eth.length}, wifiBuf.length=${wifiBuf.length}`);
                        
                        // HOTFIX: ESP32 LwIP sometimes sends ARP with Sender MAC 00:00:00:00:00:00
                        if (eth.length >= 42 && eth[12] === 0x08 && eth[13] === 0x06) {
                            console.log(`[RV32Runner] ARP packet before patch:`, Array.from(eth.subarray(0, 42)).map(x => x.toString(16).padStart(2, '0')).join(' '));
                            // Copy the Source MAC (bytes 6-11) into the ARP Sender MAC field (bytes 22-27)
                            eth.set(eth.subarray(6, 12), 22);
                            console.log(`[RV32Runner] ARP packet after patch:`, Array.from(eth.subarray(0, 42)).map(x => x.toString(16).padStart(2, '0')).join(' '));
                        }

                        if (eth.length >= 14) {
                            console.log(`[RV32Runner] WiFi TX: ${eth.length} bytes, Type: 0x${eth[12].toString(16).padStart(2, '0')}${eth[13].toString(16).padStart(2, '0')}`);
                        } else {
                            console.log(`[RV32Runner] WiFi TX: ${eth.length} bytes (malformed)`);
                        }
                        
                        // Send a copy to the local WebSocket (if active) before onWifiTx detaches the original buffer
                        if (this.wifiSocket && this.wifiSocket.readyState === WebSocket.OPEN) {
                            this.wifiSocket.send(eth.buffer.slice(0));
                        } else if (this.wifiSocket) {
                            this.wifiPacketBuffer.push(new Uint8Array(eth.buffer.slice(0)));
                        }
                        // We intentionally DO NOT call this.onWifiTx(frameBuffer) here.
                        // Calling it would route packets to the legacy WokwiInternetAP in network.worker.ts,
                        // which would hijack the DHCP process and assign 192.168.4.2 instead of the Gateway's subnet.
                        offset += len;
                    }
                }

                // Update component cycles and state logic
                const cycles = Number(this.emulator.cycles());
                for (const inst of this.instances.values()) {
                    inst.update?.(cycles, this.currentWires, [...this.instances.values()]);
                }
            }
        } catch (e) {
            console.error(`[RV32Runner] Emulation error:`, e);
            this.running = false;
        }

        if (this.running) {
            setTimeout(this.runLoop, 0);
        }
    }

    private initWebSockets() {
        const isLocalhost = typeof self !== 'undefined' && self.location && (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1');

        if (this.isPrivateGateway || isLocalhost) {
            console.log(`[RV32Runner] Connecting to BLE gateway at ws://127.0.0.1:5099/api/ble-gateway`);
            this.bleSocket = new WebSocket('ws://127.0.0.1:5099/api/ble-gateway');
            this.bleSocket.binaryType = 'arraybuffer';
            
            this.bleSocket.onopen = () => {
                console.log(`[RV32Runner] BLE Gateway Connected`);
            };
            
            this.bleSocket.onmessage = (event) => {
                if (event.data instanceof ArrayBuffer && this.emulator) {
                    const bytes = new Uint8Array(event.data);
                    console.log(`[RV32Runner] BLE RX: received ${bytes.length} bytes from Bumble gateway`);
                    let binary = '';
                    for (let i = 0; i < bytes.byteLength; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    const b64 = btoa(binary);
                    const cmd = `<BLE:RX:${b64}>\n`;
                    const cmdBytes = new Uint8Array(cmd.length);
                    for (let i = 0; i < cmd.length; i++) {
                        cmdBytes[i] = cmd.charCodeAt(i) & 0xff;
                    }
                    this.emulator.uart_input(cmdBytes);
                }
            };

            this.bleSocket.onerror = (e) => {
                console.warn(`[RV32Runner] BLE Gateway connection error (ensure Go gateway is running on 5099 and Bumble on 9544)`);
            };

            this.bleSocket.onclose = () => {
                console.log(`[RV32Runner] BLE Gateway connection closed`);
            };
        }

        let wifiPublicUrl = 'wss://openhw-studio.fossee.in/api/network-gateway';
        if (!isLocalhost && typeof self !== 'undefined' && self.location) {
            const protocol = self.location.protocol === 'https:' ? 'wss:' : 'ws:';
            wifiPublicUrl = `${protocol}//${self.location.host}/api/network-gateway`;
        }
        
        // If we're on localhost, default to the local gateway on 5099 unless otherwise specified
        const wifiUrl = (this.isPrivateGateway || isLocalhost)
            ? `ws://127.0.0.1:5099/api/network-gateway?sessionId=${this.sessionId}`
            : `${wifiPublicUrl}?sessionId=${this.sessionId}`;

        console.log(`[RV32Runner] Connecting to WiFi gateway at ${wifiUrl}`);
        this.wifiSocket = new WebSocket(wifiUrl);
        this.wifiSocket.binaryType = 'arraybuffer';

        this.wifiSocket.onopen = () => {
            console.log(`[RV32Runner] WiFi Gateway Connected`);
            while (this.wifiPacketBuffer.length > 0) {
                this.wifiSocket!.send(this.wifiPacketBuffer.shift()!);
            }
        };

        this.wifiSocket.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer && this.emulator) {
                const rawEth = new Uint8Array(event.data);
                
                // Ethernet frames must be at least 60 bytes (without FCS).
                // If the Gateway sends smaller frames (like 42-byte ARP requests),
                // the LwIP network interface inside the emulator might drop them as "runt" frames!
                let rxEth = rawEth;
                if (rawEth.length < 60) {
                    rxEth = new Uint8Array(60);
                    rxEth.set(rawEth, 0); // pad with zeros
                }
                if (rxEth.length >= 62 && rxEth[12] === 0x08 && rxEth[13] === 0x00 && rxEth[23] === 17) { // IPv4 & UDP
                    const isDHCP = rxEth.length >= 342; // typical DHCP packet length
                    if (isDHCP) {
                        const assignedIP = `${rxEth[58]}.${rxEth[59]}.${rxEth[60]}.${rxEth[61]}`;
                        console.log(`[RV32Runner] Gateway DHCP Response! Assigned IP: ${assignedIP}`);
                    }
                }
                this.emulator.wifi_rx_push(rxEth);
            } else if (typeof event.data === 'string') {
                console.log(`[RV32Runner] WiFi Gateway MSG:`, event.data);
            }
        };

        this.wifiSocket.onerror = (e) => {
            console.warn(`[RV32Runner] WiFi Gateway error:`, e);
        };

        if (this.chipType === 'esp32c6') {
            const isLocalhost = typeof self !== 'undefined' && self.location && (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1');
            let publicUrl = 'wss://openhw-studio.fossee.in/api/thread-gateway';
            if (!isLocalhost && typeof self !== 'undefined' && self.location) {
                const protocol = self.location.protocol === 'https:' ? 'wss:' : 'ws:';
                publicUrl = `${protocol}//${self.location.host}/api/thread-gateway`;
            }
            const threadUrl = (this.isPrivateGateway || isLocalhost)
                ? `ws://127.0.0.1:5099/api/thread-gateway?sessionId=${this.sessionId}`
                : `${publicUrl}?sessionId=${this.sessionId}`;

            console.log(`[RV32Runner] Connecting to Thread gateway at ${threadUrl}`);
            this.threadSocket = new WebSocket(threadUrl);
            this.threadSocket.binaryType = 'arraybuffer';

            this.threadSocket.onmessage = (event) => {
                if (event.data instanceof ArrayBuffer && this.emulator) {
                    const bytes = new Uint8Array(event.data);
                    let binary = '';
                    for (let i = 0; i < bytes.byteLength; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    const b64 = btoa(binary);
                    const cmd = `<THREAD:RX:11:${b64}>\n`;
                    const cmdBytes = new Uint8Array(cmd.length);
                    for (let i = 0; i < cmd.length; i++) {
                        cmdBytes[i] = cmd.charCodeAt(i) & 0xff;
                    }
                    this.emulator.uart_input(cmdBytes);
                }
            };

            this.threadSocket.onerror = (e) => {
                console.warn(`[RV32Runner] Thread Gateway error:`, e);
            };

            this.threadSocket.onclose = () => {
                console.log(`[RV32Runner] Thread Gateway connection closed`);
            };
        }
    }
}

