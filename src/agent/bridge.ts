/**
 * AgentBridge — WS client (R2). Dials the localhost relay, executes
 * tools/call via AgentBackend, emits tools/progress during runs.
 *
 * Enabled only when `?agent=1` or localStorage openhw.agentBridge=1
 * (dev-only flag; prod default OFF). Auto-reconnect with backoff.
 * Exposes window.OpenHWAgent for the in-browser panel (direct calls, no WS).
 */
import { AGENT_TOOLS_VERSION } from './tools.schema.ts';

const DEFAULT_URL = 'ws://127.0.0.1:8765/agent?room=dev1';

export function isAgentBridgeEnabled() {
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get('agent') === '1') return true;
    if (window.localStorage.getItem('openhw.agentBridge') === '1') return true;
  } catch { /* ignore */ }
  return false;
}

export function createAgentBridge({ backend, relayUrl, room }) {
  const url = relayUrl
    || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AGENT_RELAY_URL)
    || DEFAULT_URL;
  const state = {
    ws: null,
    connected: false,
    helloAcked: false,
    room: room || 'dev1',
    url,
    retryMs: 1000,
    closed: false,
  };

  const send = (obj) => {
    try { state.ws?.send(JSON.stringify(obj)); } catch { /* ignore */ }
  };

  const connect = () => {
    if (state.closed) return;
    let ws;
    try {
      const u = state.url.includes('room=') ? state.url : `${state.url}${state.url.includes('?') ? '&' : '?'}room=${state.room}`;
      ws = new WebSocket(u);
    } catch {
      scheduleReconnect();
      return;
    }
    state.ws = ws;
    ws.onopen = () => {
      state.connected = true;
      state.retryMs = 1000;
      send({ v: 1, id: `hello-${Date.now()}`, type: 'bridge/hello', room: state.room, toolsVersion: AGENT_TOOLS_VERSION });
    };
    ws.onmessage = async (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg?.type === 'ping') { send({ v: 1, type: 'pong' }); return; }
      if (msg?.type === 'hello/ack') { state.helloAcked = true; return; }
      if (msg?.type !== 'tools/call') return;
      const { id, tool, args } = msg;
      try {
        if (tool === 'agent.run') {
          send({ v: 1, type: 'tools/progress', id, pct: 10, note: 'run started' });
        }
        const result = await backend.call(tool, args || {});
        send({ v: 1, id, type: 'tools/result', ok: !!result.ok, result: result.ok ? result : undefined, error: result.ok ? undefined : result.error });
      } catch (err) {
        send({ v: 1, id, type: 'tools/result', ok: false, error: String(err?.message || err) });
      }
    };
    ws.onclose = () => {
      state.connected = false;
      state.helloAcked = false;
      scheduleReconnect();
    };
    ws.onerror = () => {
      try { ws.close(); } catch { /* ignore */ }
    };
  };

  const scheduleReconnect = () => {
    if (state.closed) return;
    setTimeout(() => connect(), state.retryMs);
    state.retryMs = Math.min(15000, state.retryMs * 2);
  };

  const start = () => {
    // window handle for the in-browser panel (same backend, no WS).
    try {
      window.OpenHWAgent = {
        call: (tool, args) => backend.call(tool, args || {}),
        toolsVersion: AGENT_TOOLS_VERSION,
        bridgeState: state,
      };
    } catch { /* ignore */ }
    connect();
  };

  const stop = () => {
    state.closed = true;
    try { state.ws?.close(); } catch { /* ignore */ }
  };

  return { state, start, stop };
}
