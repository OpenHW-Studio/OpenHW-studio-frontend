import React, { useState } from "react";

/**
 * DebugPanel (§10.7 UI): HALT/RESUME/STEP + snapshot registers +
 * pin watchpoints + memory inspect + record/replay.
 *
 * Props come from useDebugControls + run state. Rendered ONLY when a debug
 * tab is active (parent gates on codeTab === 'debug'); returns null when
 * the sim is not running.
 */
function fmtHex(n, pad = 8) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return `0x${(v >>> 0).toString(16).toUpperCase().padStart(pad, "0")}`;
}

function DebugPanelBase({
  isRunning,
  halted,
  snapshot,
  watchPins,
  recordLog,
  replayDigest,
  memView,
  stepCycles,
  setStepCycles,
  isRecording,
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
}) {
  const [pinInput, setPinInput] = useState("");
  const [pinLevel, setPinLevel] = useState("high");
  const [memAddr, setMemAddr] = useState("0x20000000");

  if (!isRunning) return null;

  const snap = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
    ? snapshot
    : null;
  // Multi-board snapshots arrive keyed by boardId; show first board.
  const boardSnap = snap && ("pc" in snap || "cycles" in snap || "halted" in snap)
    ? snap
    : snap
      ? snap[Object.keys(snap)[0]]
      : null;

  const submitWatch = () => {
    const name = pinInput.trim();
    if (!name) return;
    debugWatchPin(name, pinLevel === "high");
    setPinInput("");
  };

  const submitReadMem = () => {
    const t = memAddr.trim();
    const addr = /^0x/i.test(t) ? parseInt(t, 16) : parseInt(t, 10);
    if (!Number.isFinite(addr)) return;
    debugReadMem(addr >>> 0, 16);
  };

  const row = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  };
  const btn = (active) => ({
    padding: "4px 10px",
    borderRadius: "6px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    border: "1px solid var(--border)",
    background: active ? "var(--accent)" : "transparent",
    color: active ? "#000" : "var(--text)",
  });
  const mono = {
    fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
    fontSize: 11,
  };

  return (
    <div data-tour-id="debug-panel" style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "10px 2px" }}>
      {/* Transport controls */}
      <div style={row}>
        {!halted ? (
          <button data-tour-id="debug-halt-btn" style={btn(false)} onClick={debugHalt}>Halt</button>
        ) : (
          <button data-tour-id="debug-resume-btn" style={btn(true)} onClick={debugResume}>Resume</button>
        )}
        <button data-tour-id="debug-step-btn" style={btn(false)} onClick={() => debugStep(stepCycles)} disabled={!halted}>
          Step
        </button>
        <input
          data-tour-id="debug-step-cycles"
          type="number"
          min={1}
          max={1000000}
          value={stepCycles}
          onChange={(e) => setStepCycles(Math.max(1, Number(e.target.value) || 16000))}
          style={{ width: "90px", ...mono, padding: "3px 6px", borderRadius: "6px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)" }}
        />
        <span style={{ ...mono, color: "var(--text3)" }}>cycles</span>
        <button data-tour-id="debug-snapshot-btn" style={btn(false)} onClick={requestSnapshot}>Snapshot</button>
        <span data-tour-id="debug-halted-badge" style={{ ...mono, color: halted ? "var(--orange)" : "var(--text3)" }}>
          {halted ? "HALTED" : "RUNNING"}
        </span>
      </div>

      {/* Registers */}
      <div data-tour-id="debug-registers" style={{ ...mono, color: "var(--text2)" }}>
        pc {fmtHex(boardSnap?.pc)} · sp {fmtHex(boardSnap?.sp)} · cycles {Number(boardSnap?.cycles ?? NaN).toLocaleString?.() ?? "—"} · break {boardSnap?.breakReason ?? "—"}
      </div>

      {/* Watchpoints */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={row}>
          <input
            data-tour-id="debug-watch-input"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitWatch(); }}
            placeholder="Pin (e.g. 13, D13, GP25)"
            style={{ flex: 1, minWidth: "120px", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", fontSize: 12 }}
          />
          <select
            data-tour-id="debug-watch-level"
            value={pinLevel}
            onChange={(e) => setPinLevel(e.target.value)}
            style={{ padding: "4px 6px", borderRadius: "6px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", fontSize: 12 }}
          >
            <option value="high">HIGH</option>
            <option value="low">LOW</option>
          </select>
          <button data-tour-id="debug-watch-add" style={btn(false)} onClick={submitWatch}>Watch</button>
        </div>
        {watchPins.length > 0 && (
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {watchPins.map((w) => (
              <span key={w.pin} data-tour-id={`debug-watch-chip-${w.pin}`} style={{ ...mono, display: "inline-flex", alignItems: "center", gap: "6px", padding: "2px 6px", borderRadius: "12px", border: "1px solid var(--border)", color: "var(--text2)" }}>
                {w.pin}={w.expectHigh ? "H" : "L"}
                <button onClick={() => debugUnwatchPin(w.pin)} style={{ border: "none", background: "transparent", color: "var(--text3)", cursor: "pointer", fontSize: 12 }}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Memory inspect */}
      <div style={row}>
        <input
          data-tour-id="debug-mem-addr"
          value={memAddr}
          onChange={(e) => setMemAddr(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submitReadMem(); }}
          placeholder="0x20000000"
          style={{ width: "120px", ...mono, padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)" }}
        />
        <button data-tour-id="debug-mem-read" style={btn(false)} onClick={submitReadMem}>Read 16B</button>
        {memView && (
          <span data-tour-id="debug-mem-view" style={{ ...mono, color: "var(--text2)", wordBreak: "break-all" }}>
            {fmtHex(memView.addr)}: {(memView.mem || []).map((b) => Number(b).toString(16).padStart(2, "0")).join(" ")}
          </span>
        )}
      </div>

      {/* Record / replay */}
      <div style={row}>
        {!isRecording ? (
          <button data-tour-id="debug-record-btn" style={btn(false)} onClick={startRecording}>Record</button>
        ) : (
          <button data-tour-id="debug-stop-btn" style={btn(true)} onClick={stopRecording}>Stop ({recordLog.length})</button>
        )}
        <button data-tour-id="debug-replay-btn" style={btn(false)} onClick={replayRecording} disabled={recordLog.length === 0}>Replay</button>
        <button data-tour-id="debug-clear-btn" style={btn(false)} onClick={clearRecording} disabled={recordLog.length === 0}>Clear</button>
        {replayDigest && (
          <span data-tour-id="debug-digest" style={{ ...mono, color: "var(--text3)" }} title="Deterministic digest over the command log">
            {String(replayDigest).slice(0, 24)}{String(replayDigest).length > 24 ? "…" : ""}
          </span>
        )}
      </div>
    </div>
  );
}

export const DebugPanel = React.memo(DebugPanelBase);
