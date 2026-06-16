const fs = require('fs');
let code = fs.readFileSync('src/worker/runners/esp32-runner.ts', 'utf8');

const classes = `
class VirtualAP {
    public bssid = new Uint8Array([0x5a, 0x94, 0xef, 0xe4, 0x0c, 0xdd]);
    private seq = 0;
    private clock: any;

    constructor(
        private onEthernetTx: (eth: Uint8Array) => void,
        private onWifiRx: (wifi: Uint8Array) => void,
        clock: any
    ) {
        this.clock = clock;
    }

    private nextSeq(): number {
        this.seq = (this.seq + 1) % 4096;
        return this.seq << 4;
    }

    private buildAck(targetMac: Uint8Array): Uint8Array {
        const header = new Uint8Array(10);
        header[0] = 0xd4; // ACK (Subtype 13, Type 1)
        header[1] = 0x00;
        header.set(targetMac, 4);
        return header;
    }

    public handleWifiFrameFromStation(frame: Uint8Array) {
        if (frame.length < 24) return;
        const fc1 = frame[0];
        const type = (fc1 >> 2) & 3;
        const subtype = (fc1 >> 4) & 15;

        const da = frame.slice(4, 10);
        const sa = frame.slice(10, 16);

        // Only send MAC-level ACK for Unicast frames (Probe Requests are broadcast!)
        let isBroadcast = true;
        for (let i = 0; i < 6; i++) {
            if (da[i] !== 0xff) isBroadcast = false;
        }
        if (!isBroadcast) {
            // ACK is sent immediately (hardware MAC level)
            this.onWifiRx(this.buildAck(sa));
        }

        // Management Frame
        if (type === 0) {
            console.log(\`[VirtualAP] Rx Management Frame: subtype=\${subtype}, mac=\${Array.from(sa).map(b => b.toString(16).padStart(2, '0')).join(':')}\`);
            
            // Schedule software responses 50,000 CPU cycles later (~300us) so the hardware buffer has time to clear the ACK!
            const scheduleResponse = (response: Uint8Array) => {
                if (this.clock) {
                    this.clock.schedule(() => {
                        this.onWifiRx(response);
                    }, this.clock.ticks + 50000);
                } else {
                    this.onWifiRx(response);
                }
            };

            if (subtype === 4) { // Probe Request
                scheduleResponse(this.buildProbeResponse(sa));
            } else if (subtype === 11) { // Auth Request
                scheduleResponse(this.buildAuthResponse(sa));
            } else if (subtype === 0) { // Assoc Request
                scheduleResponse(this.buildAssocResponse(sa));
            }
        } 
        // Data Frame
        else if (type === 2 && subtype === 0) {
            // LLC/SNAP header check
            if (frame.length > 32 && frame[24] === 0xaa && frame[25] === 0xaa) {
                // Strip 802.11 header (24 bytes) and LLC/SNAP header (8 bytes) = 32 bytes total
                const payload = frame.slice(32);
                const eth = new Uint8Array(14 + payload.length);
                eth.set(da, 0);
                eth.set(sa, 6);
                // Extract EtherType from SNAP header
                eth[12] = frame[30];
                eth[13] = frame[31];
                eth.set(payload, 14);
                this.onEthernetTx(eth);
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
        fixed[10] = 0x01; // Capabilities
        fixed[11] = 0x04;

        const ssid = new TextEncoder().encode('Wokwi-GUEST');
        const ssidIE = new Uint8Array(2 + ssid.length);
        ssidIE[0] = 0; // SSID IE
        ssidIE[1] = ssid.length;
        ssidIE.set(ssid, 2);

        const ratesIE = new Uint8Array([1, 8, 0x82, 0x84, 0x8b, 0x96, 0x0c, 0x12, 0x18, 0x24]);
        const dsIE = new Uint8Array([3, 1, 6]); // Channel 6

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

        const fixed = new Uint8Array([0, 0, 2, 0, 0, 0]); // Auth Seq 2, Success
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
        fixed[0] = 0x11; // Capabilities
        fixed[1] = 0x04;
        fixed[2] = 0; // Status code: 0 (Success)
        fixed[3] = 0;
        const aid = new Uint8Array([1, 192]); // AID 1

        const out = new Uint8Array(header.length + fixed.length + aid.length);
        out.set(header, 0);
        out.set(fixed, header.length);
        out.set(aid, header.length + fixed.length);
        return out;
    }
}

class NativeWiFiBridge {
    private socket: WebSocket | null = null;
    private packetBuffer: Uint8Array[] = [];
    private onRxCb: ((event: { data: Uint8Array }) => void) | null = null;
    public txBytes = 0;
    public rxBytes = 0;
    private virtualAp: VirtualAP;

    public medium = {
        transmit: (event: { channel: number; data: Uint8Array }) => {
            this.txBytes += event.data.length;
            this.virtualAp.handleWifiFrameFromStation(event.data);
        },
        listen: (cb: (event: { data: Uint8Array }) => void) => {
            this.onRxCb = cb;
        },
        downloadPcap: () => {
            console.warn(\`[NativeWiFiBridge] PCAP download on frontend is delegated to backend or requires PcapWriter.\`);
        }
    };

    constructor(gatewayUrl: string, clock: any) {
        this.virtualAp = new VirtualAP(
            (eth) => {
                if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                    this.socket.send(eth);
                } else {
                    this.packetBuffer.push(eth);
                }
            },
            (wifi) => {
                if (this.onRxCb) this.onRxCb({ data: wifi });
            },
            clock
        );

        this.socket = new WebSocket(gatewayUrl);
        this.socket.binaryType = 'arraybuffer';
        this.socket.onopen = () => {
            console.log(\`[NativeWiFiBridge] Connected to Gateway! Pure Ethernet mode.\`);
            while (this.packetBuffer.length > 0) {
                const packet = this.packetBuffer.shift();
                if (packet) this.socket!.send(packet);
            }
        };
        this.socket.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                const eth = new Uint8Array(event.data);
                if (eth.length < 14) return;
                
                const da = eth.slice(0, 6);
                const sa = eth.slice(6, 12);
                const etherType = eth.slice(12, 14);
                const payload = eth.slice(14);

                const wifi = new Uint8Array(32 + payload.length);
                wifi[0] = 0x08; // Data
                wifi[1] = 0x02; // FromDS=1, ToDS=0 => Addr1=DA, Addr2=BSSID, Addr3=SA
                wifi.set(da, 4);
                wifi.set(this.virtualAp.bssid, 10);
                wifi.set(sa, 16);
                
                // SNAP header
                wifi[24] = 0xaa; wifi[25] = 0xaa; wifi[26] = 0x03;
                wifi[27] = 0x00; wifi[28] = 0x00; wifi[29] = 0x00;
                wifi[30] = etherType[0]; wifi[31] = etherType[1];
                
                wifi.set(payload, 32);
                this.rxBytes += wifi.length;

                // Send frame to ESP32
                if (this.onRxCb) this.onRxCb({ data: wifi });
            }
        };
    }
    public disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
}
`;

code = code.replace('export class ESP32Runner implements BoardRunner {', classes + '\n\nexport class ESP32Runner implements BoardRunner {\n    wifiManager: NativeWiFiBridge | null = null;');

const initBlock = `        this.cpu = new ESP32({ flashSizeMB: 4, flash: binaryBytes });
        this.clock = this.cpu.clock; // Use the clock that is correctly linked to this CPU
        
        try {
            const boardComp = componentsDef.find(c => c.id === this.boardId);
            let gatewayUrl = '';
            if (boardComp && boardComp.attrs && boardComp.attrs.privateGateway === 'true') {
                gatewayUrl = 'ws://localhost:5099/api/network-gateway';
            } else {
                gatewayUrl = (globalThis as any).VITE_PUBLIC_GATEWAY_URL || 'wss://api.openhw-studio.com:5099/api/network-gateway';
            }
            
            this.wifiManager = new NativeWiFiBridge(gatewayUrl, this.clock);
            if (this.cpu.wifi) {
                let macSeed = 0;
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
                    console.log(\`[ESP32-WIFI-TX] Sending Frame: length=\${frame.length} channel=\${channel}\`);
                    if (frame.length >= 16) {
                        frame.set(mac, 10);
                    }
                    this.clock.schedule(() => {
                        this.wifiManager!.medium.transmit({ channel, data: frame });
                    }, this.clock.ticks + 100000);
                };
                this.wifiManager.medium.listen((event: any) => {
                    if (event.data) {
                        console.log(\`[ESP32-WIFI-RX] Received Frame from Gateway: length=\${event.data.length}\`);
                        try {
                            const success = this.cpu.wifi.sendFrame(event.data, 0);
                            console.log(\`[ESP32-WIFI-RX] sendFrame returned for length=\${event.data.length}: \${success}\`);
                        } catch (e: any) {
                            console.error(\`[ESP32-WIFI-RX] CRITICAL ERROR IN sendFrame for length=\${event.data.length}:\`, e);
                        }
                    }
                });
            }
        } catch (wifiErr) {
            console.error('[ESP32Runner] Failed to initialize WiFi:', wifiErr);
        }`;

code = code.replace(/this\.cpu = new ESP32\(\{[\s\S]*?\}\);\s+this\.clock = this\.cpu\.clock;/, initBlock);

// Replace wifiManager stop
code = code.replace('this.running = false;', 'this.running = false;\n        if (this.wifiManager) {\n            try { this.wifiManager.disconnect(); } catch (e) {}\n        }');

// Add wifi status emit
code = code.replace('msg.components = compStates;', 'msg.components = compStates;\n        if (this.wifiManager) {\n            msg.wifi = {\n                txBytes: this.wifiManager.txBytes || 0,\n                rxBytes: this.wifiManager.rxBytes || 0\n            };\n        }');

fs.writeFileSync('src/worker/runners/esp32-runner.ts', code);
console.log('Successfully patched esp32-runner.ts');
