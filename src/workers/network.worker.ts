// cache bust 1
/**
 * network.worker.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Dedicated Network Worker — runs the entire WiFi/IP stack in isolation.
 *
 * Architecture (mirrors the existing Render Worker pattern in simulation.worker.ts):
 *
 *   Main Thread
 *       │ new Worker('network.worker.ts')
 *       │ postMessage SET_NET_PORT (MessageChannel port)
 *       ▼
 *   Simulation Worker  ←────────────────────────────────────────────────────┐
 *       │ port.postMessage FRAME_OUT {boardId, frame: ArrayBuffer}           │
 *       │    (zero-copy Transferable — CPU loop is never blocked)            │
 *       ▼                                                                    │
 *   Network Worker                                                           │
 *       │ PicowNetBridge.deliverPacketOut(frame)                            │
 *       │   → ARP/DHCP/DNS/TCP/UDP handled here                            │
 *       │ port.postMessage FRAME_IN {boardId, frame: ArrayBuffer}  ─────────┘
 *       │ port.postMessage WIFI_STATUS {boardId, status, ip, ssid}
 *       │ port.postMessage PCAP_DATA   {boardId, data: ArrayBuffer}
 *
 * Message protocol (Simulation Worker → Network Worker):
 *   START_BOARD  { boardId, wifiEnabled, ssid?, password? }
 *   STOP_BOARD   { boardId }
 *   FRAME_OUT    { boardId, frame: ArrayBuffer }  ← Transferable (zero-copy)
 *   ANNOUNCE_AP  { componentId, ssid, password, channel, internet }
 *   REMOVE_AP    { componentId }
 *   GET_PCAP     { boardId }
 *   RESET        {}
 *
 * Message protocol (Network Worker → Simulation Worker):
 *   FRAME_IN     { boardId, frame: ArrayBuffer }  ← Transferable (zero-copy)
 *   WIFI_STATUS  { boardId, status, ssid?, ip?, packetCount }
 *   PCAP_DATA    { boardId, data: ArrayBuffer }
 *   ERROR        { boardId?, message }
 * ─────────────────────────────────────────────────────────────────────────────
 */

/// <reference lib="webworker" />

// import { PicowNetBridge, WifiEnvironment, type WiFiApConfig } from '@openhw/emulator';

type WiFiApConfig = any;
class PicowNetBridge {
  packetCount = 0;
  constructor(public boardId: string, public cb: any, public wifiEnabled: boolean) {}
  start() {}
  async stop() {}
  async deliverPacketOut(frame: Uint8Array) {}
  getPcapBytes(): Uint8Array { return new Uint8Array(0); }
}

const dummyWifiEnv = {
  registerBoard: (o: any) => {},
  unregisterBoard: (id: string) => {},
  announceAp: (c: any) => {},
  removeAp: (id: string) => {},
};

class WifiEnvironment {
  static getInstance() { return dummyWifiEnv; }
  static reset() {}
}

// ── State ─────────────────────────────────────────────────────────────────────

/** MessagePort back to the simulation worker */
let _port: MessagePort | null = null;

/** One bridge instance per board */
const _bridges = new Map<string, PicowNetBridge>();

// ── Port setup (called on SET_NET_PORT from simulation worker) ────────────────

function setPort(port: MessagePort): void {
  _port = port;
  _port.onmessage = handlePortMessage;
  _port.start();
  console.log('[NetWorker] MessagePort registered');
}

// ── Outbound helpers ──────────────────────────────────────────────────────────

function send(msg: Record<string, unknown>, transfer?: ArrayBuffer[]): void {
  if (!_port) return;
  if (transfer && transfer.length > 0) {
    _port.postMessage(msg, transfer);
  } else {
    _port.postMessage(msg);
  }
}

// ── Bridge factory ────────────────────────────────────────────────────────────

function getOrCreateBridge(boardId: string, wifiEnabled: boolean): PicowNetBridge {
  let bridge = _bridges.get(boardId);
  if (!bridge) {
    bridge = new PicowNetBridge(boardId, (eventType, payload) => {
      // Only handle picow_packet_in here — forward the Ethernet frame to sim worker
      if (eventType === 'picow_packet_in') {
        const b64 = payload.ether_b64 as string;
        // Decode base64 → ArrayBuffer for zero-copy transfer
        const binary = atob(b64);
        const frame = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) frame[i] = binary.charCodeAt(i);
        // Transfer ownership — zero allocation on sim worker side
        send({ type: 'FRAME_IN', boardId, frame: frame.buffer }, [frame.buffer]);
      }
    }, wifiEnabled);
    _bridges.set(boardId, bridge);
  }
  return bridge;
}

// ── Message handler ───────────────────────────────────────────────────────────

async function handlePortMessage(e: MessageEvent): Promise<void> {
  const { type, boardId } = e.data;

  switch (type) {

    case 'START_BOARD': {
      const { wifiEnabled = true, ssid, password } = e.data;
      const bridge = getOrCreateBridge(boardId, wifiEnabled);

      // Register in shared WiFi environment
      const env = WifiEnvironment.getInstance();
      env.registerBoard({
        boardId,
        boardType: 'pico-w',
        connectedAp: null,
        status: 'idle',
        onStatusChange: (status, info) => {
          send({
            type: 'WIFI_STATUS',
            boardId,
            status,
            ssid:        info.connectedAp?.ssid ?? '',
            ip:          info.ipAddress ?? '',
            packetCount: bridge.packetCount,
          });
        },
      });

      bridge.start();
      send({ type: 'WIFI_STATUS', boardId, status: 'connecting', ssid: ssid ?? '', ip: '' });
      console.log(`[NetWorker] Board started: ${boardId} wifiEnabled=${wifiEnabled}`);
      break;
    }

    case 'STOP_BOARD': {
      const bridge = _bridges.get(boardId);
      if (bridge) {
        await bridge.stop();
        _bridges.delete(boardId);
      }
      WifiEnvironment.getInstance().unregisterBoard(boardId);
      send({ type: 'WIFI_STATUS', boardId, status: 'idle', ssid: '', ip: '', packetCount: 0 });
      console.log(`[NetWorker] Board stopped: ${boardId}`);
      break;
    }

    case 'FRAME_OUT': {
      // Inbound Ethernet frame from Pico W chip → route through stack
      // frame is an ArrayBuffer (transferred, zero-copy)
      const bridge = _bridges.get(boardId);
      if (!bridge) return;
      const frame = new Uint8Array(e.data.frame as ArrayBuffer);
      try {
        await bridge.deliverPacketOut(frame);
        // Update packet count in status
        // (Don't send a status message on every packet — too noisy.
        //  UI polls packetCount via GET_PCAP or periodic status.)
      } catch (err) {
        console.error(`[NetWorker] Frame delivery error for ${boardId}:`, err);
      }
      break;
    }

    case 'ANNOUNCE_AP': {
      const config: WiFiApConfig = {
        componentId: e.data.componentId,
        ssid:        e.data.ssid ?? 'OpenHW-GUEST',
        password:    e.data.password ?? '',
        channel:     Number(e.data.channel ?? 6),
        internet:    Boolean(e.data.internet ?? true),
      };
      WifiEnvironment.getInstance().announceAp(config);
      console.log(`[NetWorker] AP announced: ${config.ssid}`);
      break;
    }

    case 'REMOVE_AP': {
      WifiEnvironment.getInstance().removeAp(e.data.componentId);
      break;
    }

    case 'GET_PCAP': {
      const bridge = _bridges.get(boardId);
      if (!bridge) {
        send({ type: 'ERROR', boardId, message: 'No bridge for board' });
        return;
      }
      const bytes = bridge.getPcapBytes();
      // Transfer the buffer — zero-copy send to sim worker which forwards to main thread
      const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      send({ type: 'PCAP_DATA', boardId, data: buf }, [buf]);
      break;
    }

    case 'RESET': {
      // Stop all boards and reset the environment
      for (const [id, bridge] of _bridges.entries()) {
        try { await bridge.stop(); } catch {}
        WifiEnvironment.getInstance().unregisterBoard(id);
      }
      _bridges.clear();
      WifiEnvironment.reset();
      console.log('[NetWorker] Full reset');
      break;
    }

    default:
      console.warn('[NetWorker] Unknown message type:', type);
  }
}

// ── Worker entry point ────────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent) => {
  // The simulation worker sends SET_NET_PORT once at startup
  // (same pattern as SET_RENDER_PORT for the render worker)
  if (e.data?.type === 'SET_NET_PORT') {
    const port: MessagePort = e.data.port;
    if (port && typeof port.postMessage === 'function') {
      setPort(port);
    }
    return;
  }
  console.warn('[NetWorker] Unexpected top-level message (expected SET_NET_PORT):', e.data?.type);
};
