/**
 * AgentRecorder — worker-side watch-scoped, cycle-stamped recorder (§11 R2).
 *
 * Lives in the sim worker. Pre-v2 taps runner onStateUpdate + serial paths
 * directly; post-v2 (§10 rings) it can re-point at the SAB telemetry ring
 * without changing the schema. Schema (stable, versioned):
 *   { seq, cycles, simTimeMs, kind, PinChange{boardId,pin,state} |
 *     SerialOutput{boardId,data,source} | ComponentState{id,key,value} |
 *     RunEvent{code,message?} }
 *
 * Rules: watch-scoped (unwatched = zero cost), sim-time stamped, lossy ring
 * (overwrite-oldest, dropped counter), capped (default 500 events).
 * getTrace pages by seq; snapshot stays a full-fidelity postMessage path
 * owned by the caller (grading), never this ring.
 */
export const AGENT_TRACE_CAP = 500;

export class AgentRecorder {
  constructor(cap = AGENT_TRACE_CAP) {
    this.cap = Math.max(16, Number(cap) || AGENT_TRACE_CAP);
    this.events = [];
    this.seq = 0;
    this.dropped = 0;
    this.watch = { pins: [], serial: false, components: [] };
    this.active = false;
    this.cycles = 0;
    this.simTimeMs = 0;
  }

  startCapture(watch) {
    this.watch = {
      pins: Array.isArray(watch?.pins) ? watch.pins.map(String) : [],
      serial: watch?.serial === true,
      components: Array.isArray(watch?.components)
        ? watch.components.map((c) => ({ id: String(c?.id || ''), keys: Array.isArray(c?.keys) ? c.keys.map(String) : [] }))
        : [],
    };
    this.events = [];
    this.seq = 0;
    this.dropped = 0;
    this.active = true;
  }

  stopCapture() {
    this.active = false;
  }

  push(kind, payload, cycles, simTimeMs) {
    if (!this.active) return;
    if (cycles !== undefined) this.cycles = Number(cycles) || this.cycles;
    if (simTimeMs !== undefined) this.simTimeMs = Number(simTimeMs) || this.simTimeMs;
    const evt = {
      seq: this.seq++,
      cycles: this.cycles,
      simTimeMs: this.simTimeMs,
      kind,
      ...payload,
    };
    if (this.events.length >= this.cap) {
      this.events.shift();
      this.dropped += 1;
    }
    this.events.push(evt);
  }

  pushPinChange(boardId, pin, state, cycles, simTimeMs) {
    if (!this.active) return;
    if (this.watch.pins.length > 0 && !this.watch.pins.includes(String(pin))) return;
    this.push('PinChange', { boardId: String(boardId || 'default'), pin: String(pin), state: !!state }, cycles, simTimeMs);
  }

  pushSerial(boardId, data, source, cycles, simTimeMs) {
    if (!this.active || !this.watch.serial) return;
    this.push('SerialOutput', { boardId: String(boardId || 'default'), data: String(data ?? ''), source: String(source || 'uart') }, cycles, simTimeMs);
  }

  pushComponentState(id, key, value, cycles, simTimeMs) {
    if (!this.active) return;
    const rule = this.watch.components.find((c) => c.id === String(id));
    if (!rule) return;
    if (rule.keys.length > 0 && !rule.keys.includes(String(key))) return;
    let v = value;
    try {
      if (typeof v === 'object') v = JSON.parse(JSON.stringify(v));
    } catch { /* keep raw */ }
    this.push('ComponentState', { id: String(id), key: String(key), value: v }, cycles, simTimeMs);
  }

  pushRunEvent(code, message, cycles, simTimeMs) {
    if (!this.active) return;
    this.push('RunEvent', { code: String(code), message: message ? String(message) : undefined }, cycles, simTimeMs);
  }

  getTrace(sinceSeq = 0, limit = 500) {
    const since = Math.max(0, Number(sinceSeq) || 0);
    const n = Math.max(1, Math.min(500, Number(limit) || 500));
    const events = this.events.filter((e) => e.seq >= since).slice(0, n);
    return {
      events,
      dropped: this.dropped,
      simTimeMs: this.simTimeMs,
      cycles: this.cycles,
      nextSeq: this.seq,
    };
  }
}

/**
 * Local assert evaluator (runs in the bridge, not in the LLM).
 * assertions: [{ id, when:{pin,state}?, expect:{PinChange|SerialOutput|
 *   ComponentState|RunEvent}, withinMs }]
 * Returns [{ id, pass, actual, atSimTimeMs, detail }].
 */
export function evaluateAssertions(assertions, trace) {
  const events = Array.isArray(trace?.events) ? trace.events : [];
  const out = [];
  for (const a of assertions || []) {
    const id = String(a?.id || 'assert');
    const withinMs = Number(a?.withinMs ?? 5000);
    const expect = a?.expect || {};
    const when = a?.when || null;
    // Gate: optional `when` pin precondition — find its sim-time first.
    let t0 = 0;
    if (when && when.pin !== undefined) {
      const hit = events.find(
        (e) => e.kind === 'PinChange' && String(e.pin) === String(when.pin)
          && (when.state === undefined || !!e.state === !!when.state),
      );
      if (!hit) {
        out.push({ id, pass: false, actual: null, atSimTimeMs: null, detail: `precondition pin ${when.pin} not observed` });
        continue;
      }
      t0 = Number(hit.simTimeMs) || 0;
    }
    const match = findExpectation(expect, events, t0, withinMs);
    out.push({ id, ...match });
  }
  return out;
}

function findExpectation(expect, events, t0, withinMs) {
  // SerialOutput { contains }
  if (expect.SerialOutput) {
    const needle = String(expect.SerialOutput.contains ?? expect.SerialOutput.data ?? '');
    const hit = events.find(
      (e) => e.kind === 'SerialOutput'
        && (Number(e.simTimeMs) || 0) >= t0
        && (Number(e.simTimeMs) || 0) <= t0 + withinMs
        && String(e.data || '').includes(needle),
    );
    if (hit) return { pass: true, actual: hit.data, atSimTimeMs: hit.simTimeMs, detail: `serial contains '${needle}'` };
    return { pass: false, actual: null, atSimTimeMs: null, detail: `serial missing '${needle}' within ${withinMs}ms` };
  }
  // ComponentState { id, key, value }
  if (expect.ComponentState) {
    const want = expect.ComponentState;
    const hit = events.find(
      (e) => e.kind === 'ComponentState'
        && String(e.id) === String(want.id ?? '')
        && (want.key === undefined || String(e.key) === String(want.key))
        && (want.value === undefined || e.value === want.value)
        && (Number(e.simTimeMs) || 0) >= t0
        && (Number(e.simTimeMs) || 0) <= t0 + withinMs,
    );
    if (hit) return { pass: true, actual: { [hit.key]: hit.value }, atSimTimeMs: hit.simTimeMs, detail: `${hit.id}.${hit.key} matched` };
    return { pass: false, actual: null, atSimTimeMs: null, detail: `ComponentState ${want.id}.${want.key ?? '*'} not observed within ${withinMs}ms` };
  }
  // PinChange { pin/boardId, state }
  if (expect.PinChange) {
    const want = expect.PinChange;
    const hit = events.find(
      (e) => e.kind === 'PinChange'
        && (want.pin === undefined || String(e.pin) === String(want.pin))
        && (want.state === undefined || !!e.state === !!want.state)
        && (Number(e.simTimeMs) || 0) >= t0
        && (Number(e.simTimeMs) || 0) <= t0 + withinMs,
    );
    if (hit) return { pass: true, actual: { pin: hit.pin, state: hit.state }, atSimTimeMs: hit.simTimeMs, detail: `pin ${hit.pin}=${hit.state}` };
    return { pass: false, actual: null, atSimTimeMs: null, detail: `PinChange ${want.pin ?? '*'} not observed within ${withinMs}ms` };
  }
  // RunEvent { code }
  if (expect.RunEvent) {
    const want = expect.RunEvent;
    const hit = events.find(
      (e) => e.kind === 'RunEvent'
        && (want.code === undefined || String(e.code) === String(want.code))
        && (Number(e.simTimeMs) || 0) >= t0
        && (Number(e.simTimeMs) || 0) <= t0 + withinMs,
    );
    if (hit) return { pass: true, actual: { code: hit.code }, atSimTimeMs: hit.simTimeMs, detail: `run event ${hit.code}` };
    return { pass: false, actual: null, atSimTimeMs: null, detail: `RunEvent ${want.code ?? '*'} not observed within ${withinMs}ms` };
  }
  return { pass: false, actual: null, atSimTimeMs: null, detail: 'empty expectation' };
}
