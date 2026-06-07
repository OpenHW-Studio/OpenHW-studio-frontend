import net from 'net';
import tls from 'tls';

/**
 * NetworkProxy
 * ─────────────────────────────────────────────────────────────────────────────
 * Node.js daemon that sits tightly coupled with a QEMU ESP32 instance.
 * It listens on a dynamic local TCP port. QEMU's UART1 pipeline connects to
 * this port.
 * 
 * It interprets the binary \x01 framing protocol and spawns real TCP/TLS 
 * internet sockets on behalf of the simulated ESP32.
 */
export default class NetworkProxy {
    constructor(buildId, onReady) {
        this.buildId = buildId;
        this.onReadyCallback = onReady;
        
        // The master server that accepts QEMU's UART1 connection
        this.uartServer = null;
        this.qemuSocket = null;
        
        // Active outbound/inbound sockets mapped by CONN_ID (1-8)
        this.activeSockets = new Map();
        
        // Active inbound listeners mapped by port requested by SimulatorWiFiServer
        this.activeServers = new Map();
        
        this.proxyPort = 0;
        this.buffer = '';
    }

    /**
     * Starts the listener. When it binds successfully, it calls onReady(port)
     * so the caller knows which port to pass to qemu-system-xtensa.
     */
    start() {
        this.uartServer = net.createServer((socket) => {
            console.log(`[${this.buildId}] 🌐 QEMU UART1 Connected to proxy`);
            this.qemuSocket = socket;
            
            socket.on('data', (data) => this._handleUartData(data));
            socket.on('close', () => this._cleanup());
            socket.on('error', (err) => console.error(`[${this.buildId}] UART1 Error:`, err.message));
        });

        this.uartServer.listen(0, '127.0.0.1', () => {
            this.proxyPort = this.uartServer.address().port;
            console.log(`[${this.buildId}] 🌐 NetworkProxy listening for QEMU on port ${this.proxyPort}`);
            if (this.onReadyCallback) this.onReadyCallback(this.proxyPort);
        });
    }

    // ─── UART Parsing ────────────────────────────────────────────────────────
    
    _handleUartData(data) {
        this.buffer += data.toString('utf8');
        
        while (true) {
            const startStr = String.fromCharCode(0x01);
            const endStr = String.fromCharCode(0x02);
            
            const startIdx = this.buffer.indexOf(startStr);
            if (startIdx === -1) {
                this.buffer = ''; // Flush junk
                break;
            }
            
            const endIdx = this.buffer.indexOf(endStr, startIdx);
            if (endIdx === -1) break; // Incomplete frame
            
            const frame = this.buffer.substring(startIdx + 1, endIdx);
            this.buffer = this.buffer.substring(endIdx + 1);
            
            this._processFrame(frame);
        }
    }

    _processFrame(frame) {
        // frame = CONN_ID:COMMAND:PAYLOAD
        const colon1 = frame.indexOf(':');
        if (colon1 < 0) return;
        const connId = parseInt(frame.substring(0, colon1), 10);
        
        const colon2 = frame.indexOf(':', colon1 + 1);
        const command = colon2 < 0 ? frame.substring(colon1 + 1) : frame.substring(colon1 + 1, colon2);
        const payload = colon2 < 0 ? "" : frame.substring(colon2 + 1);
        
        if (connId === 0) {
            this._handleGlobalCommand(command, payload);
        } else {
            this._handleSocketCommand(connId, command, payload);
        }
    }

    // ─── Command Handlers ────────────────────────────────────────────────────
    
    _handleGlobalCommand(cmd, payload) {
        if (cmd === 'WIFI_READY') {
            console.log(`[${this.buildId}] 📡 ESP32 SimulatorWiFi stack initialized.`);
        } else if (cmd === 'SERVER_LISTEN') {
            const port = parseInt(payload, 10);
            this._startInboundServer(port);
        } else if (cmd === 'SERVER_CLOSE') {
            const port = parseInt(payload, 10);
            const srv = this.activeServers.get(port);
            if (srv) {
                srv.close();
                this.activeServers.delete(port);
                console.log(`[${this.buildId}] 🛑 Closed inbound proxy server on port ${port}`);
            }
        }
    }

    _handleSocketCommand(connId, cmd, payload) {
        if (cmd === 'CONNECT' || cmd === 'TLS_CONNECT') {
            const parts = payload.split(':');
            if (parts.length < 2) return;
            const host = parts[0];
            const port = parseInt(parts[1], 10);
            const isTls = cmd === 'TLS_CONNECT';
            
            console.log(`[${this.buildId}] 🔗 Spawning ${isTls ? 'TLS ' : ''}Socket to ${host}:${port} [ID:${connId}]`);
            
            let realSocket;
            if (isTls) {
                // Reject unauthorized disabled so self-signed test chains, Adafruit headers pass
                realSocket = tls.connect({ host, port, rejectUnauthorized: false }, () => {
                    this._sendToUart(connId, 'CONN_OK', '');
                });
            } else {
                realSocket = net.connect({ host, port }, () => {
                    this._sendToUart(connId, 'CONN_OK', '');
                });
            }
            
            realSocket.on('data', (buf) => {
                // Hex encode buffer to protect UART framing symbols
                const hex = buf.toString('hex').toUpperCase();
                this._sendToUart(connId, `DATA:${hex}`, '');
            });
            
            realSocket.on('close', () => {
                 this._sendToUart(connId, 'EOF', '');
                 this.activeSockets.delete(connId);
            });
            
            realSocket.on('error', (err) => {
                 console.log(`[${this.buildId}] Socket [ID:${connId}] Error: ${err.message}`);
                 this._sendToUart(connId, 'CONN_FAIL', '');
            });
            
            this.activeSockets.set(connId, realSocket);
            
        } else if (cmd === 'WRITE') {
            const hex = payload;
            const buf = Buffer.from(hex, 'hex');
            const sock = this.activeSockets.get(connId);
            if (sock && !sock.destroyed) {
                sock.write(buf);
            }
            
        } else if (cmd === 'CLOSE') {
            const sock = this.activeSockets.get(connId);
            if (sock) {
                sock.end();
                this.activeSockets.delete(connId);
            }
        }
    }

    _startInboundServer(internalPort) {
        if (this.activeServers.has(internalPort)) return;
        
        const srv = net.createServer((incomingSocket) => {
            // Find a free connection ID (1-8)
            let newId = -1;
            for (let i = 1; i <= 8; i++) {
                if (!this.activeSockets.has(i)) {
                    newId = i; break;
                }
            }
            
            if (newId === -1) {
                // Out of IDs, reject connection
                incomingSocket.end();
                return;
            }
            
            console.log(`[${this.buildId}] 📥 Incoming connection mapped to ID:${newId} for port ${internalPort}`);
            this.activeSockets.set(newId, incomingSocket);
            
            incomingSocket.on('data', (buf) => {
                const hex = buf.toString('hex').toUpperCase();
                this._sendToUart(newId, `DATA:${hex}`, '');
            });
            
            incomingSocket.on('close', () => {
                 this._sendToUart(newId, 'EOF', '');
                 this.activeSockets.delete(newId);
            });
            
            incomingSocket.on('error', () => {
                 this._sendToUart(newId, 'EOF', '');
            });
            
            // Notify ESP32 over UART
            this._sendToUart(0, `INCOMING_CLIENT:${newId}`, '');
        });
        
        // Listen on the requested port globally on localhost or public IF depending on deployment 
        // For CHIL simulator, listening on localhost + dynamic mapping via a reverse proxy is typical,
        // but for now we bind to 0.0.0.0
        srv.listen(internalPort, '0.0.0.0', () => {
            console.log(`[${this.buildId}] 👂 Inbound server open on 0.0.0.0:${internalPort}`);
        });
        
        srv.on('error', (err) => {
            console.error(`[${this.buildId}] Inbound server error on port ${internalPort}: ${err.message}`);
        });
        
        this.activeServers.set(internalPort, srv);
    }

    // ─── UART Serialization ──────────────────────────────────────────────────
    
    _sendToUart(connId, command, payload) {
        if (!this.qemuSocket || this.qemuSocket.destroyed) return;
        // Inbound framing \x03ID:COMMAND:PAYLOAD\x04\n
        // Payload might be empty if command is full string, e.g. "DATA:1122AA"
        const msg = (payload && payload.length > 0) ? `${command}:${payload}` : command;
        const out = String.fromCharCode(0x03) + `${connId}:${msg}` + String.fromCharCode(0x04) + "\n";
        this.qemuSocket.write(out);
    }

    stop() {
        this._cleanup();
    }

    _cleanup() {
        if (this.uartServer) {
            this.uartServer.close();
            this.uartServer = null;
        }
        if (this.qemuSocket) {
            this.qemuSocket.end();
            this.qemuSocket = null;
        }
        // Cleanup all active mapped sockets
        for (const sock of this.activeSockets.values()) {
            if (!sock.destroyed) sock.destroy();
        }
        this.activeSockets.clear();
        
        // Cleanup active servers
        for (const srv of this.activeServers.values()) {
            srv.close();
        }
        this.activeServers.clear();
    }
}
