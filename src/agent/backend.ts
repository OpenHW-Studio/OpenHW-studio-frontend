import { validateToolCall, AGENT_TOOLS_VERSION } from './tools.schema.ts';
import { AgentRecorder, evaluateAssertions } from './recorder.js';

/**
 * AgentBackend — executes every BROWSER_TOOLS entry against live state (R2).
 *
 * Constructed once per SimulatorPage mount with live refs; the bridge (WS)
 * and the in-browser panel (window.OpenHWAgent) both call into it.
 * Canvas tools mutate the canonical components[]/wires[] model consumed by
 * START and return model + runUnifiedValidation summary. Run tools talk to
 * the sim worker. Verify tools talk to the AgentRecorder.
 *
 * Nothing here imports ComponentEditorPage or TelemetryManager (§11.7).
 */
/**
 * Pending AGENT_TRACE waiters, keyed by reqId. SimulatorPage's worker
 * onmessage resolves them (see AGENT_TRACE note in the START postamble).
 */
const traceWaiters = new Map();
let traceReqSeq = 0;

export function resolveAgentTrace(msg) {
  try {
    const waiter = traceWaiters.get(msg?.reqId);
    if (!waiter) return false;
    traceWaiters.delete(msg.reqId);
    clearTimeout(waiter.timer);
    waiter.resolve(msg);
    return true;
  } catch {
    return false;
  }
}

function requestWorkerTrace(workerRef, { sinceSeq = 0, limit = 500, timeoutMs = 5000 } = {}) {
  const worker = workerRef?.current;
  // No worker yet (never ran, or stopped and torn down): empty trace, not an error.
  if (!worker) {
    return Promise.resolve({ ok: true, events: [], dropped: 0, simTimeMs: 0, cycles: 0, nextSeq: 0 });
  }
  const reqId = `tr-${Date.now()}-${(traceReqSeq += 1)}`;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      traceWaiters.delete(reqId);
      resolve({ ok: false, error: 'trace timeout: worker did not answer AGENT_GET_TRACE' });
    }, timeoutMs);
    traceWaiters.set(reqId, { resolve, timer });
    try {
      worker.postMessage({ type: 'AGENT_GET_TRACE', sinceSeq, limit, reqId });
    } catch (err) {
      traceWaiters.delete(reqId);
      clearTimeout(timer);
      resolve({ ok: false, error: String(err?.message || err) });
    }
  });
}

export function createAgentBackend(ctx) {
  const {
    componentsRef,
    wiresRef,
    setComponents,
    setWires,
    setCodeTab,
    runUnifiedValidation,
    ensureEmulatorRegistry,
    workerRef,
    isRunningRef,
    codeRef,
    recorder,
    // NEW (full-telemetry loop): same refs SimulatorPage already owns.
    handleRunRef,
    handleStopRef,
    serialHistoryRef,
    liveOopStatesRef,
    renderPinsByBoardRef,
    setSelectedTelemetryComponentIds,
    setComponentTelemetryEnabled,
    setTelemetryMode,
  } = ctx;

  const rec = recorder || new AgentRecorder();

  const getProject = () => ({
    components: (componentsRef.current || []).map((c) => ({
      id: c.id, type: c.type, attrs: c.attrs || {}, x: c.x, y: c.y,
    })),
    wires: (wiresRef.current || []).map((w) => ({ from: w.from, to: w.to })),
    boards: (componentsRef.current || [])
      .filter((c) => /arduino|pico|esp32|nano|mega|attiny|stm32/i.test(String(c.type || '')))
      .map((c) => ({ id: c.id, type: c.type })),
    firmwareRefs: [],
  });

  const validate = () => {
    try {
      const r = runUnifiedValidation({
        components: componentsRef.current || [],
        wires: wiresRef.current || [],
      });
      return {
        safe: !!(r?.safe ?? r?.physicsSafe ?? true),
        errors: r?.errors || [],
        healthScore: r?.healthScore ?? null,
      };
    } catch (err) {
      return { safe: false, errors: [{ message: String(err?.message || err) }], healthScore: null };
    }
  };

  const tools = {
    'agent.getProject': async () => getProject(),

    'agent.place': async (args) => {
      const { COMPONENT_REGISTRY } = await import('../pages/simulationpage/utils/componentRegistry.js');
      const item = COMPONENT_REGISTRY[args.type];
      if (!item) return { ok: false, error: `unknown type: ${args.type}` };
      const usedIds = new Set((componentsRef.current || []).map((c) => String(c.id || '')));
      let n = 1;
      while (usedIds.has(`${args.type}-${n}`)) n += 1;
      const id = `${args.type}-${n}`;
      const comp = {
        id,
        type: args.type,
        label: item.label || args.type,
        x: Number(args.x) || 100,
        y: Number(args.y) || 100,
        w: item.w || 60,
        h: item.h || 60,
        attrs: { ...(args.attrs || {}) },
      };
      setComponents((prev) => [...prev, comp]);
      return { ok: true, id, warnings: [], project: getProject(), validation: validate() };
    },

    'agent.move': async (args) => {
      setComponents((prev) => prev.map((c) => (
        c.id === args.id ? { ...c, x: Number(args.x), y: Number(args.y) } : c
      )));
      return { ok: true, project: getProject() };
    },

    'agent.delete': async (args) => {
      const removed = [];
      setComponents((prev) => prev.filter((c) => {
        if (c.id === args.id) { removed.push(c.id); return false; }
        return true;
      }));
      setWires((prev) => prev.filter((w) => {
        const s = `${w.from} ${w.to}`;
        if (s.includes(args.id)) { removed.push(`wire:${w.from}->${w.to}`); return false; }
        return true;
      }));
      return { ok: true, removed, project: getProject() };
    },

    'agent.setAttr': async (args) => {
      setComponents((prev) => prev.map((c) => (
        c.id === args.id ? { ...c, attrs: { ...(c.attrs || {}), [args.key]: args.value } } : c
      )));
      return { ok: true, project: getProject() };
    },

    'agent.wire': async (args) => {
      const [fromId, fromPin] = String(args.from || '').split(':');
      const [toId, toPin] = String(args.to || '').split(':');
      const comps = componentsRef.current || [];
      if (!comps.some((c) => c.id === fromId)) return { ok: false, error: `unknown component: ${fromId}` };
      if (!comps.some((c) => c.id === toId)) return { ok: false, error: `unknown component: ${toId}` };
      if (!fromPin || !toPin) return { ok: false, error: 'wire endpoints must be id:pin' };
      const wire = { id: `w-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, from: args.from, to: args.to };
      setWires((prev) => [...prev, wire]);
      return { ok: true, wire, project: getProject(), validation: validate() };
    },

    'agent.unwire': async (args) => {
      setWires((prev) => prev.filter((w) => !(w.from === args.from && w.to === args.to)));
      return { ok: true, project: getProject() };
    },

    'agent.validateCircuit': async () => validate(),

    'agent.readComponent': async (args) => {
      try {
        const ns = await ensureEmulatorRegistry();
        const entry = Object.values(ns).find((e) => e?.manifest?.type === args.type);
        if (!entry) return { ok: false, error: `unknown type: ${args.type}` };
        return {
          ok: true,
          manifest: entry.manifest || null,
          hasLogic: !!entry.LogicClass,
          hasValidation: !!(entry.validation?.rules?.length),
          pins: (entry.manifest?.pins || []).map((p) => (typeof p === 'string' ? p : p?.id)),
        };
      } catch (err) {
        return { ok: false, error: String(err?.message || err) };
      }
    },

    'agent.reloadComponents': async (args) => {
      try {
        const { validateComponentManifest } = await import(
          '@openhw/emulator/src/components/component-schema.js'
        );
        const ns = await ensureEmulatorRegistry();
        const out = [];
        for (const type of args.types || []) {
          const entry = Object.values(ns).find((e) => e?.manifest?.type === type);
          if (!entry) { out.push({ type, manifestOk: false, errors: ['not in registry'] }); continue; }
          const r = validateComponentManifest(entry.manifest || {});
          out.push({
            type,
            manifestOk: !!r.valid,
            logicOk: !!entry.LogicClass,
            pins: (entry.manifest?.pins || []).map((p) => (typeof p === 'string' ? p : p?.id)),
            errors: r.errors || [],
          });
        }
        return { ok: true, results: out };
      } catch (err) {
        return { ok: false, error: String(err?.message || err) };
      }
    },

    'agent.setFirmware': async (args) => {
      // Firmware is consumed at START from the editor store; record the
      // intent so agent.run picks it up. Hex blobs travel by reference
      // through the existing START path, never as giant relay args.
      if (codeRef && args.hex !== undefined) {
        try { codeRef.current = String(args.hex); } catch { /* ignore */ }
      }
      return { ok: true, boardId: args.boardId };
    },

    // Full-telemetry run loop (relay AGENT_LOOP.md §1): setup is done by the
    // caller (place/wire/setFirmware or the OpenHWE2E harness); here we arm
    // the worker recorder + main-thread telemetry, run the REAL handleRun,
    // wait, then return worker trace + main-thread telemetry + pins + serial.
    'agent.run': async (args) => {
      const budgetMs = Math.max(500, Math.min(30000, Number(args?.capture?.budgetMs) || Number(args?.forMs) || 3000));
      const watch = args?.capture?.watch || {};
      const selectIds = Array.isArray(args?.selectTelemetry)
        ? args.selectTelemetry
        : Array.isArray(watch.components)
          ? watch.components.map((c) => String(c?.id || c)).filter(Boolean)
          : [];
      const serialNeedle = args?.serialNeedle ?? null;
      const mode = args?.telemetryMode || 'detail';
      // Live mirror first (refreshed every render by SimulatorPage), then
      // the injected ref, then fail. Never cache the fn — handleRun is a
      // plain per-render const and a stale copy compiles empty firmware.
      const liveRun = (typeof window !== 'undefined' && window.__openhwRunRef?.current) || null;
      const runFn = (typeof liveRun === 'function' && liveRun)
        || handleRunRef?.current
        || null;
      if (typeof runFn !== 'function') {
        return { ok: false, error: 'run unavailable: handleRun not ready' };
      }
      // Arm worker recorder (watch-scoped) + main-thread telemetry selection.
      try {
        workerRef?.current?.postMessage({ type: 'AGENT_START_CAPTURE', watch });
      } catch { /* worker may not exist yet — handleRun creates it */ }
      try {
        if (selectIds.length && typeof setSelectedTelemetryComponentIds === 'function') {
          setSelectedTelemetryComponentIds(selectIds);
        }
        if (typeof setComponentTelemetryEnabled === 'function') setComponentTelemetryEnabled(true);
        if (mode && typeof setTelemetryMode === 'function') setTelemetryMode(mode);
      } catch { /* telemetry arming never blocks the run */ }
      // Stop any previous run first (same reason as OpenHWE2E.run: the
      // serial history is append-only, so a stale mark would leak).
      try {
        const stopFn = handleStopRef?.current;
        if (typeof stopFn === 'function') stopFn();
      } catch { /* ignore */ }
      await new Promise((r) => setTimeout(r, 1500));
      const serialMark = serialHistoryRef?.current?.length || 0;
      const t0 = Date.now();
      try {
        await runFn({});
      } catch (err) {
        return { ok: false, error: `handleRun threw: ${err?.message || err}` };
      }
      await new Promise((r) => setTimeout(r, budgetMs));
      const traceRes = await requestWorkerTrace(workerRef, { sinceSeq: 0, limit: 500 });
      const serialNew = (serialHistoryRef?.current || [])
        .slice(serialMark)
        .map((e) => String(e?.text ?? e ?? ''));
      const serialText = serialNew.join('');
      const pins = JSON.parse(JSON.stringify(renderPinsByBoardRef?.current || {}));
      let telemetry = [];
      try {
        telemetry = (typeof window !== 'undefined' && window.OpenHWTelemetry?.getLatestTelemetry?.()) || [];
      } catch { telemetry = []; }
      let pass = true;
      const reasons = [];
      if (serialNeedle && !serialText.includes(String(serialNeedle))) {
        pass = false;
        reasons.push(`serial missing needle: ${serialNeedle}`);
      }
      if (!serialText.trim()) {
        pass = false;
        reasons.push('no serial output captured');
      }
      return {
        ok: true,
        pass,
        reasons,
        wallMs: Date.now() - t0,
        running: !!isRunningRef?.current,
        serial: serialText.slice(0, 4000),
        serialLines: serialNew.length,
        pins,
        telemetry: Array.isArray(telemetry) ? telemetry.slice(0, 50) : telemetry,
        telemetryCount: Array.isArray(telemetry) ? telemetry.length : 0,
        trace: traceRes?.ok === false ? null : traceRes,
        traceError: traceRes?.ok === false ? traceRes.error : null,
        runId: `run-${t0}`,
        budgetMs,
      };
    },

    'agent.stop': async () => {
      rec.pushRunEvent('STOPPED', 'agent.stop');
      rec.stopCapture();
      try {
        workerRef?.current?.postMessage({ type: 'AGENT_STOP_CAPTURE' });
      } catch { /* ignore */ }
      const stopFn = handleStopRef?.current;
      if (typeof stopFn === 'function') {
        try { stopFn(); } catch { /* ignore */ }
      } else if (workerRef?.current && isRunningRef?.current) {
        workerRef.current.postMessage({ type: 'STOP' });
      }
      return { ok: true, running: !!isRunningRef?.current };
    },

    'agent.interact': async (args) => {
      if (workerRef?.current && isRunningRef?.current) {
        workerRef.current.postMessage({ type: 'INTERACT', compId: args.compId, event: args.event });
      }
      rec.pushRunEvent('INTERACT', `${args.compId}:${args.event}`);
      return { ok: true };
    },

    'agent.serialInput': async (args) => {
      if (workerRef?.current && isRunningRef?.current) {
        workerRef.current.postMessage({
          type: 'SERIAL_INPUT', data: args.bytes, targetBoardId: args.boardId,
        });
      }
      return { ok: true };
    },

    'agent.startCapture': async (args) => {
      rec.startCapture(args.watch || {});
      try {
        workerRef?.current?.postMessage({ type: 'AGENT_START_CAPTURE', watch: args.watch || {} });
      } catch { /* worker may not exist yet */ }
      return { ok: true };
    },

    // Worker trace is authoritative (pins/serial/components with cycle
    // stamps). Main-thread rec is the fallback when the worker is gone.
    'agent.getTrace': async (args) => {
      const t = await requestWorkerTrace(workerRef, {
        sinceSeq: Number(args?.sinceSeq) || 0,
        limit: Number(args?.limit) || 500,
      });
      if (t?.ok === false && t?.events === undefined) {
        const local = rec.getTrace(Number(args?.sinceSeq) || 0, Number(args?.limit) || 500);
        return { ok: true, ...local, source: 'main-fallback', traceError: t.error };
      }
      return { ok: true, ...t, source: 'worker' };
    },

    'agent.assert': async (args) => {
      // Assert against the WORKER trace (authoritative, cycle-stamped).
      const t = await requestWorkerTrace(workerRef, { sinceSeq: 0, limit: 500 });
      const trace = t?.events !== undefined ? t : rec.getTrace(0, 500);
      const verdicts = evaluateAssertions(args.assertions || [], trace);
      return { ok: true, verdicts, dropped: trace.dropped, source: t?.events !== undefined ? 'worker' : 'main-fallback' };
    },

    // Full-telemetry snapshot: canvas model + serial + pins + component
    // telemetry (formatted {id,type,summary,details,status} per selected
    // component — the debugging signal) + live OOP states + worker trace.
    'agent.snapshot': async () => {
      const t = await requestWorkerTrace(workerRef, { sinceSeq: 0, limit: 50 });
      const trace = t?.events !== undefined ? t : rec.getTrace(0, 50);
      let telemetry = [];
      try {
        telemetry = (typeof window !== 'undefined' && window.OpenHWTelemetry?.getLatestTelemetry?.()) || [];
      } catch { telemetry = []; }
      return {
        ok: true,
        project: getProject(),
        running: !!isRunningRef?.current,
        serialLines: (serialHistoryRef?.current || []).length,
        serialTail: (serialHistoryRef?.current || []).slice(-20).map((e) => String(e?.text ?? e ?? '')),
        pins: JSON.parse(JSON.stringify(renderPinsByBoardRef?.current || {})),
        liveOop: JSON.parse(JSON.stringify(liveOopStatesRef?.current || {})),
        telemetry: Array.isArray(telemetry) ? telemetry.slice(0, 50) : telemetry,
        telemetryCount: Array.isArray(telemetry) ? telemetry.length : 0,
        traceHead: (trace.events || []).slice(0, 50),
        dropped: trace.dropped,
        traceSource: t?.events !== undefined ? 'worker' : 'main-fallback',
      };
    },

    'agent.bridgeStatus': async () => ({
      ok: true, bridge: true, toolsVersion: AGENT_TOOLS_VERSION,
    }),
  };

  const call = async (tool, args) => {
    const v = validateToolCall(tool, args || {});
    if (!v.ok) return { ok: false, error: v.error };
    try {
      const r = await tools[tool](args || {});
      return r && typeof r.ok === 'boolean' ? r : { ok: true, result: r };
    } catch (err) {
      return { ok: false, error: String(err?.message || err) };
    }
  };

  return { call, tools, recorder: rec, getProject, validateCircuit: validate };
}
