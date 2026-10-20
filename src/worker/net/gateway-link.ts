// gateway-link.ts — worker-side WebSocket link to openhw-unified-gateway.
//
// One link per board runner. Binary frames go both ways as raw Ethernet
// (dst[0:6] src[6:12] ethertype-BE[12:14]); text frames are gateway
// control (BOARD_IP:<ip> etc.). Engine-specific framing (uplink enable,
// TX pop / RX push) stays in the runner — this class only owns the
// socket, pre-open buffering, and status dispatch.
//
// Matches the owner CLI reference (rp2350/Pico-emu web/cli.js):
// uplink asserted before first step, ≤16 TX pops per pump, RX malloc +
// push, frames queued in the runner while the socket opens.

// Default gateway endpoint. Overridable at build time with
// VITE_GATEWAY_URL (e.g. ws://127.0.0.1:5031/api/network-gateway) so a
// second gateway instance — a patched build under test, or a per-lane
// gateway — can be used without editing code. Board attrs / runner
// options still win over this default.
export const GATEWAY_DEFAULT_URL = (
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GATEWAY_URL)
    || 'ws://127.0.0.1:5030/api/network-gateway'
).trim();

export interface GatewayLinkStatus {
    up: boolean;
    ip: string;
    room: string;
}

export interface GatewayLinkCallbacks {
    onFrame: (frame: Uint8Array) => void;
    onStatus: (s: GatewayLinkStatus) => void;
}

/** Pre-open TX backlog cap (frames); oldest dropped past it. */
const TX_BACKLOG_CAP = 256;

export class GatewayLink {
    readonly room: string;
    readonly url: string;
    ip = '';
    private ws: WebSocket | null = null;
    private queue: Uint8Array[] = [];
    private closed = false;
    private cb: GatewayLinkCallbacks;

    constructor(baseUrl: string, room: string, cb: GatewayLinkCallbacks) {
        this.room = (room || '').trim() || 'default';
        const base = (baseUrl || '').trim() || GATEWAY_DEFAULT_URL;
        this.url = base + '?sessionId=' + encodeURIComponent(this.room);
        this.cb = cb;
    }

    get isOpen(): boolean {
        try { return !!this.ws && this.ws.readyState === 1; } catch { return false; }
    }

    open(): void {
        if (this.ws || this.closed) return;
        let ws: WebSocket;
        try {
            ws = new WebSocket(this.url);
        } catch {
            this.emit({ up: false, ip: this.ip, room: this.room });
            return;
        }
        this.ws = ws;
        try { ws.binaryType = 'arraybuffer'; } catch { /* ignore */ }
        ws.onopen = () => {
            try {
                while (this.queue.length > 0 && this.isOpen) {
                    const f = this.queue.shift();
                    if (f) (this.ws as WebSocket).send(f as any);
                }
            } catch { /* flush never breaks the link */ }
            this.emit({ up: true, ip: this.ip, room: this.room });
        };
        ws.onmessage = (ev: MessageEvent) => {
            try {
                const data = (ev as any).data;
                if (data instanceof ArrayBuffer) {
                    const frame = new Uint8Array(data);
                    // Owner parity (cli.js): 14..1522 byte Ethernet frames.
                    if (frame.length < 14 || frame.length > 1522) return;
                    this.cb.onFrame(frame);
                } else if (typeof data === 'string') {
                    if (data.startsWith('BOARD_IP:')) {
                        this.ip = data.substring(9).trim();
                        this.emit({ up: true, ip: this.ip, room: this.room });
                    }
                }
            } catch { /* ingress never breaks the link */ }
        };
        const down = () => this.emit({ up: false, ip: this.ip, room: this.room });
        ws.onerror = down;
        ws.onclose = () => { if (this.ws === ws) this.ws = null; down(); };
    }

    send(frame: Uint8Array): void {
        if (this.closed || !frame || frame.length === 0) return;
        try {
            if (this.isOpen && this.ws) {
                try { this.ws.send(frame as any); return; }
                catch { /* fall through to backlog */ }
            }
            this.queue.push(frame);
            while (this.queue.length > TX_BACKLOG_CAP) this.queue.shift();
        } catch { /* send never breaks the sim */ }
    }

    close(): void {
        this.closed = true;
        this.queue = [];
        try { this.ws?.close(); } catch { /* ignore */ }
        this.ws = null;
    }

    private emit(s: GatewayLinkStatus): void {
        try { this.cb.onStatus(s); } catch { /* status never breaks the sim */ }
    }
}
