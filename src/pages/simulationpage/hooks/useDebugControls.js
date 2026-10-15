import { useCallback, useRef, useState } from "react";

/**
 * Debug control-plane domain (§10.7), extracted for DebugPanel.
 * Ring-first (command ring via cmdWriterRef) with postMessage fallback —
 * same pattern as useRunControls pause/resume.
 *
 * State: halted, snapshot {pc, sp, cycles, breakReason}, watchPins[],
 * recordLog[] (command log for record/replay), lastDigest.
 * Worker replies arrive as DEBUG_STATE / DEBUG_SNAPSHOT postMessages;
 * feed them via handleDebugMessage(msg) from the worker onmessage path.
 */
export function useDebugControls({ workerRef, cmdWriterRef, isRunning }) {
  const [halted, setHalted] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [watchPins, setWatchPins] = useState([]);
  const [recordLog, setRecordLog] = useState([]);
  const [replayDigest, setReplayDigest] = useState(null);
  const [memView, setMemView] = useState(null);
  const [stepCycles, setStepCycles] = useState(16000);
  const recordingRef = useRef(false);
  const isRecordingState = useRef(false);

  const debugHalt = useCallback(() => {
    let viaRing = false;
    try {
      const w = cmdWriterRef?.current
        || (typeof window !== "undefined" ? window.__sabCmdWriter : null);
      if (w && typeof w.enqueueHalt === "function") {
        viaRing = !!w.enqueueHalt(Date.now());
      }
    } catch { viaRing = false; }
    if (recordingRef.current) {
      setRecordLog((prev) => [...prev, { op: "HALT", t: Date.now(), viaRing }]);
    }
    if (workerRef.current && isRunning) {
      workerRef.current.postMessage({ type: "DEBUG_HALT", viaRing });
    }
    setHalted(true);
  }, [workerRef, cmdWriterRef, isRunning]);

  const debugResume = useCallback(() => {
    let viaRing = false;
    try {
      const w = cmdWriterRef?.current
        || (typeof window !== "undefined" ? window.__sabCmdWriter : null);
      if (w && typeof w.enqueueResume === "function") {
        viaRing = !!w.enqueueResume(Date.now());
      }
    } catch { viaRing = false; }
    if (recordingRef.current) {
      setRecordLog((prev) => [...prev, { op: "RESUME", t: Date.now(), viaRing }]);
    }
    if (workerRef.current && isRunning) {
      workerRef.current.postMessage({ type: "DEBUG_RESUME", viaRing });
    }
    setHalted(false);
  }, [workerRef, cmdWriterRef, isRunning]);

  const debugStep = useCallback((cycles = 16000) => {
    const n = Math.max(1, Number(cycles) || 16000);
    let viaRing = false;
    try {
      const w = cmdWriterRef?.current
        || (typeof window !== "undefined" ? window.__sabCmdWriter : null);
      if (w && typeof w.enqueueStep === "function") {
        viaRing = !!w.enqueueStep(n, Date.now());
      }
    } catch { viaRing = false; }
    if (recordingRef.current) {
      setRecordLog((prev) => [...prev, { op: "STEP", cycles: n, t: Date.now(), viaRing }]);
    }
    if (workerRef.current && isRunning) {
      workerRef.current.postMessage({ type: "DEBUG_STEP", cycles: n, viaRing });
    }
    // Refresh snapshot after a step so pc/cycles stay current.
    if (workerRef.current && isRunning) {
      workerRef.current.postMessage({ type: "DEBUG_SNAPSHOT" });
    }
  }, [workerRef, cmdWriterRef, isRunning]);

  const debugWatchPin = useCallback((pin, expectHigh = true) => {
    const name = String(pin || "").trim();
    if (!name) return;
    let viaRing = false;
    try {
      const w = cmdWriterRef?.current
        || (typeof window !== "undefined" ? window.__sabCmdWriter : null);
      if (w && typeof w.enqueueWatchPin === "function") {
        viaRing = !!w.enqueueWatchPin(name, !!expectHigh, Date.now());
      }
    } catch { viaRing = false; }
    if (recordingRef.current) {
      setRecordLog((prev) => [...prev, { op: "WATCH", pin: name, expectHigh: !!expectHigh, t: Date.now(), viaRing }]);
    }
    if (workerRef.current && isRunning) {
      workerRef.current.postMessage({ type: "DEBUG_WATCH", pin: name, expectHigh: !!expectHigh, viaRing });
    }
    setWatchPins((prev) => (prev.some((p) => p.pin === name) ? prev : [...prev, { pin: name, expectHigh: !!expectHigh }]));
  }, [workerRef, cmdWriterRef, isRunning]);

  const debugUnwatchPin = useCallback((pin) => {
    const name = String(pin || "").trim();
    setWatchPins((prev) => prev.filter((p) => p.pin !== name));
    if (workerRef.current && isRunning) {
      workerRef.current.postMessage({ type: "DEBUG_UNWATCH", pin: name });
    }
  }, [workerRef, isRunning]);

  const requestSnapshot = useCallback(() => {
    if (workerRef.current && isRunning) {
      workerRef.current.postMessage({ type: "DEBUG_SNAPSHOT" });
    }
  }, [workerRef, isRunning]);

  const debugReadMem = useCallback((addr, len = 16) => {
    const a = Number(addr) >>> 0;
    const n = Math.max(1, Math.min(256, Number(len) || 16));
    if (recordingRef.current) {
      setRecordLog((prev) => [...prev, { op: "READ_MEM", addr: a, len: n, t: Date.now() }]);
    }
    if (workerRef.current && isRunning) {
      workerRef.current.postMessage({ type: "DEBUG_READ_MEM", addr: a, len: n });
    }
  }, [workerRef, isRunning]);

  // Record/replay: command log with cycle stamps; digest via worker
  // DebugService.replayDigest() surfaced through DEBUG_SNAPSHOT when available,
  // else a local FNV-1a over the recorded ops (deterministic for same input).
  const startRecording = useCallback(() => {
    recordingRef.current = true;
    isRecordingState.current = true;
    setRecordLog([]);
    setReplayDigest(null);
  }, []);

  const stopRecording = useCallback(() => {
    recordingRef.current = false;
    isRecordingState.current = false;
    if (workerRef.current && isRunning) {
      workerRef.current.postMessage({ type: "DEBUG_SNAPSHOT" });
    }
  }, [workerRef, isRunning]);

  const clearRecording = useCallback(() => {
    setRecordLog([]);
    setReplayDigest(null);
  }, []);

  const replayRecording = useCallback(() => {
    if (!workerRef.current || !isRunning || recordLog.length === 0) return;
    for (const entry of recordLog) {
      if (entry.op === "HALT") workerRef.current.postMessage({ type: "DEBUG_HALT", replay: true });
      else if (entry.op === "RESUME") workerRef.current.postMessage({ type: "DEBUG_RESUME", replay: true });
      else if (entry.op === "STEP") workerRef.current.postMessage({ type: "DEBUG_STEP", cycles: entry.cycles || 16000, replay: true });
      else if (entry.op === "WATCH") workerRef.current.postMessage({ type: "DEBUG_WATCH", pin: entry.pin, expectHigh: entry.expectHigh, replay: true });
    }
  }, [workerRef, isRunning, recordLog]);

  // Feed worker DEBUG_STATE / DEBUG_SNAPSHOT / DEBUG_MEM replies.
  // Returns true if consumed.
  const handleDebugMessage = useCallback((msg) => {
    if (!msg || typeof msg !== "object") return false;
    if (msg.type === "DEBUG_STATE") {
      setHalted(!!msg.halted);
      if (Array.isArray(msg.watches)) {
        setWatchPins(msg.watches.map((w) => ({
          pin: String(w?.pin ?? ""),
          expectHigh: w?.expectHigh !== false,
        })).filter((w) => w.pin));
      }
      return true;
    }
    if (msg.type === "DEBUG_MEM") {
      setMemView({
        addr: Number(msg.addr) >>> 0,
        len: Number(msg.len) || 0,
        mem: Array.isArray(msg.mem) ? msg.mem : [],
      });
      return true;
    }
    if (msg.type === "DEBUG_SNAPSHOT") {
      if (msg.snapshot) setSnapshot(msg.snapshot);
      if (msg.digest) setReplayDigest(msg.digest);
      else if (recordingRef.current && recordLog.length > 0) {
        // Local deterministic digest over recorded ops.
        let h1 = 0x811c9dc5;
        const mix = (s) => {
          for (let i = 0; i < s.length; i++) {
            h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619);
          }
        };
        for (const e of recordLog) mix(`${e.op}:${e.cycles || 0}:${e.pin || ""}`);
        setReplayDigest(`local-${(h1 >>> 0).toString(16).padStart(8, "0")}`);
      }
      return true;
    }
    return false;
  }, [recordLog]);

  return {
    halted,
    snapshot,
    watchPins,
    recordLog,
    replayDigest,
    memView,
    stepCycles,
    setStepCycles,
    isRecording: isRecordingState.current,
    debugHalt,
    debugResume,
    debugStep,
    debugWatchPin,
    debugUnwatchPin,
    debugReadMem,
    requestSnapshot,
    startRecording,
    stopRecording,
    clearRecording,
    replayRecording,
    handleDebugMessage,
  };
}
