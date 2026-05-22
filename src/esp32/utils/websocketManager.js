import { WebSocketServer } from 'ws';

class WebSocketManager {
    constructor() {
        if (!WebSocketManager.instance) {
            this.wss = null;
            // Map<buildId, ws>  — maps a live session to its owning client socket
            this.sessions = new Map();
            // Map<ws, buildId>  — reverse lookup for cleanup on disconnect
            this.wsToSession = new Map();
            // Map<buildId, Array> — pre-registration buffer.
            // Created synchronously when a compile request arrives so no early
            // QEMU output is lost before the browser WebSocket opens.
            this.pendingBuffers = new Map();
            // Queue for listeners added before init() is called
            this.connectionListeners = [];
            WebSocketManager.instance = this;
        }
        return WebSocketManager.instance;
    }

    init(server) {
        this.wss = new WebSocketServer({ server });

        this.wss.on('connection', (ws) => {
            console.log('📡 WebSocket Client Connected');

            ws.on('close', () => {
                console.log('📡 WebSocket Client Disconnected');
                const buildId = this.wsToSession.get(ws);
                if (buildId) {
                    this.sessions.delete(buildId);
                    this.wsToSession.delete(ws);
                    console.log(`🧹 Session ${buildId} unregistered from WS map`);
                }
            });

            // Fire any late-attached or queued connection listeners
            this.connectionListeners.forEach(callback => {
                try { callback(ws); } catch (e) { console.error('Error in WS connection listener:', e); }
            });
        });

        console.log('🚀 WebSocket server initialized');
    }

    // ─── Call this the moment a compile request is received, before any disk I/O.
    // Creates a buffer so QEMU output produced before client registration is never lost.
    createPendingSession(buildId) {
        this.pendingBuffers.set(buildId, []);
        console.log(`📦 Pending buffer created for session ${buildId}`);
    }

    // ─── Called when the client sends { type: 'REGISTER_SESSION', buildId }.
    // Assigns the live WebSocket and immediately flushes all buffered messages.
    registerSession(ws, buildId) {
        const prevWs = this.sessions.get(buildId);
        if (prevWs && prevWs !== ws) {
            this.wsToSession.delete(prevWs);
        }
        this.sessions.set(buildId, ws);
        this.wsToSession.set(ws, buildId);
        console.log(`🔗 Session ${buildId} registered to WS client`);

        // Flush buffered messages in order
        const buffer = this.pendingBuffers.get(buildId);
        if (buffer && buffer.length > 0) {
            console.log(`📤 Flushing ${buffer.length} buffered messages for session ${buildId}`);
            buffer.forEach(payload => {
                try { ws.send(JSON.stringify(payload)); } catch { /* client closed between flush items */ }
            });
        }
        this.pendingBuffers.delete(buildId);
    }

    // ─── Call when QEMU exits or session is explicitly stopped.
    // If the browser already has an open WS (sessions map populated), we can
    // clean everything up immediately.  But if the buffer still has unsent
    // messages, we leave it alone — the grace-period setTimeout in
    // compileController will call us again after the browser has had a chance
    // to register and flush those messages.
    unregisterSession(buildId) {
        const ws = this.sessions.get(buildId);
        if (ws) {
            this.wsToSession.delete(ws);
        }
        this.sessions.delete(buildId);

        // Only delete the pending buffer if it's already been flushed (empty)
        // or if there is no buffer at all.  If messages are still sitting in the
        // buffer the grace-period timer will call us again and by then the buffer
        // will have been flushed via registerSession.
        const buffer = this.pendingBuffers.get(buildId);
        if (!buffer || buffer.length === 0) {
            this.pendingBuffers.delete(buildId);
        }
    }

    // ─── Primary send method used by QemuRunner.
    // If the client hasn't registered yet, buffers the message instead of dropping it.
    sendToSession(buildId, payload) {
        const ws = this.sessions.get(buildId);
        if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify(payload));
            return;
        }
        // Client not yet connected — buffer the message
        const buffer = this.pendingBuffers.get(buildId);
        if (buffer) {
            buffer.push(payload);
        }
        // (If neither ws nor buffer exists, the session was already cleaned up — discard silently.)
    }

    // ─── Returns true if a pending buffer exists for this buildId.
    // Used by compileController to check if the session was properly initialised.
    hasPendingSession(buildId) {
        return this.pendingBuffers.has(buildId);
    }

    // ─── Used to listen for individual connection events.
    onClientConnection(callback) {
        if (this.wss) {
            this.wss.on('connection', callback);
        } else {
            // Buffer the listener for when init() is called
            this.connectionListeners.push(callback);
        }
    }

    // ─── Broadcast to ALL connected clients (kept for non-session system messages).
    broadcast(payload) {
        if (this.wss) {
            const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
            this.wss.clients.forEach(client => {
                if (client.readyState === 1) client.send(data);
            });
        }
    }
}

const instance = new WebSocketManager();
export default instance;
