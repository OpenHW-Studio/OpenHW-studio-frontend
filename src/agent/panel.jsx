import React, { useState } from 'react';

/**
 * Agent panel (R2, dev-only): room/URL inputs, connection dot (green = WS
 * open + hello acked), tools log, trace/assert viewer rendering exactly
 * what MCP sees (same getTrace/assert JSON). NOT an editor.
 *
 * Mounted by SimulatorPage only when the agent bridge is enabled
 * (?agent=1 or localStorage openhw.agentBridge=1). Calls window.OpenHWAgent
 * directly (no WS hop) — the relay path serves the external opencode agent.
 */
export function AgentPanel() {
  const [room, setRoom] = useState('dev1');
  const [log, setLog] = useState([]);
  const [trace, setTrace] = useState(null);
  const [verdicts, setVerdicts] = useState(null);

  const agent = typeof window !== 'undefined' ? window.OpenHWAgent : null;
  const connected = !!(agent?.bridgeState?.connected && agent?.bridgeState?.helloAcked);

  const pushLog = (tool, out) => {
    setLog((prev) => [...prev.slice(-49), { t: new Date().toISOString(), tool, ok: !!out?.ok, out }]);
  };

  const call = async (tool, args) => {
    if (!agent) return;
    const out = await agent.call(tool, args || {});
    pushLog(tool, out);
    return out;
  };

  const runDemo = async () => {
    const g = await call('agent.getProject', {});
    const v = await call('agent.validateCircuit', {});
    const s = await call('agent.startCapture', { watch: { pins: [], serial: true, components: [] } });
    const t = await call('agent.getTrace', { sinceSeq: 0, limit: 50 });
    setTrace(t);
    const a = await call('agent.assert', { assertions: [] });
    setVerdicts(a?.verdicts || null);
    void g; void v; void s;
  };

  if (!agent) return null;

  return (
    <div data-tour-id="agent-panel" style={{ padding: '10px 2px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          data-tour-id="agent-conn-dot"
          title={connected ? 'bridge connected' : 'bridge offline'}
          style={{
            width: 10, height: 10, borderRadius: '50%',
            background: connected ? '#22c55e' : '#ef4444',
            display: 'inline-block',
          }}
        />
        <input
          data-tour-id="agent-room"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder="room"
          style={{ width: 90, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 12 }}
        />
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>tools v{agent.toolsVersion}</span>
        <button data-tour-id="agent-demo" onClick={runDemo} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          Demo loop
        </button>
      </div>
      {trace && (
        <pre data-tour-id="agent-trace" style={{ fontSize: 11, maxHeight: 160, overflow: 'auto', background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: 8, margin: 0 }}>
          {JSON.stringify(trace, null, 1).slice(0, 2000)}
        </pre>
      )}
      {verdicts && (
        <pre data-tour-id="agent-verdicts" style={{ fontSize: 11, maxHeight: 120, overflow: 'auto', background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: 8, margin: 0 }}>
          {JSON.stringify(verdicts, null, 1).slice(0, 1500)}
        </pre>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflow: 'auto' }}>
        {log.slice().reverse().map((e, i) => (
          <div key={i} style={{ fontSize: 11, color: e.ok ? 'var(--text2)' : 'var(--red)' }}>
            {e.t.slice(11, 19)} {e.tool} → {e.ok ? 'ok' : 'FAIL'}
          </div>
        ))}
      </div>
    </div>
  );
}
