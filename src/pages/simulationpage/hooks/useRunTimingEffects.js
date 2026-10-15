import { useEffect, useRef } from "react";

/**
 * Run-timing/status effects domain, extracted verbatim from
 * SimulatorPage.jsx.
 * (boot-start tracking, run-start backdate by boot duration, 250ms
 *  elapsed ticker, hardware-status -> console mirror w/ dedup.)
 *
 * Behavior contract: identical dep arrays, identical boot backdate math,
 * identical failed/lost -> error mapping. Verify via run-timer +
 * hardware-status Playwright checks.
 */
export function useRunTimingEffects({
  isBooting,
  isRunning,
  isCompiling,
  setRunStartedAtMs,
  setRunDurationSec,
  runStartedAtMs,
  hardwareStatus,
  lastHardwareStatusRef,
  appendConsoleEntry,
  simulationSpeed,
  setMeasuredSpeed,
}) {
    const bootStartedAtRef = useRef(null);

    // Track when boot starts
    useEffect(() => {
      if (isBooting && !isRunning) {
        if (!bootStartedAtRef.current) {
          bootStartedAtRef.current = Date.now();
        }
      }
    }, [isBooting, isRunning]);

    // Reset run start time when simulation actually starts running
    useEffect(() => {
      if (isRunning && !isCompiling && !isBooting) {
        let startTime = Date.now();
        if (bootStartedAtRef.current) {
          const bootDuration = Date.now() - bootStartedAtRef.current;
          startTime -= bootDuration;
        }
        setRunStartedAtMs(startTime);
      } else if (!isRunning) {
        bootStartedAtRef.current = null;
      }
    }, [isRunning, isCompiling, isBooting]);

    useEffect(() => {
      if (!isRunning || !runStartedAtMs || isCompiling || isBooting) return;

      const updateElapsed = () => {
        setRunDurationSec(Math.max(0, (Date.now() - runStartedAtMs) / 1000));
        // Measured pace per board (sim-rate ÷ speed setting), comma-joined
        // in run order — never averaged, so one stalled board can't hide
        // behind healthy ones. Null until samples land (pill falls back).
        try {
          const store = (typeof window !== 'undefined' && window.__simPaceByBoard) || {};
          const now = Date.now();
          const speed = Number(simulationSpeed) > 0 ? Number(simulationSpeed) : 1;
          const rows = [];
          for (const [bid, entry] of Object.entries(store)) {
            if (!entry || now - Number(entry.at || 0) > 3000) continue;
            const ema = Number(entry.ema);
            if (!Number.isFinite(ema) || ema < 0) continue;
            rows.push({ id: String(bid), pct: Math.max(0, Math.min(999, Math.round((ema / speed) * 100))) });
          }
          rows.sort((a, b) => (a.id < b.id ? -1 : 1));
          setMeasuredSpeed(
            rows.length > 0
              ? {
                  label: rows.slice(0, 6).map((r) => r.pct).join(', '),
                  title: rows.map((r) => `${r.id}: ${r.pct}%`).join('\n') + `\ntarget ${Math.round(speed * 100)}%`,
                }
              : null,
          );
        } catch {
          try { setMeasuredSpeed(null); } catch { /* ignore */ }
        }
      };

      updateElapsed();
      const timer = setInterval(updateElapsed, 250);
      return () => clearInterval(timer);
    }, [isRunning, runStartedAtMs, isCompiling, isBooting]);

    useEffect(() => {
      if (!hardwareStatus) return;
      if (lastHardwareStatusRef.current === hardwareStatus) return;
      lastHardwareStatusRef.current = hardwareStatus;

      const statusLower = String(hardwareStatus).toLowerCase();
      const level =
        statusLower.includes("failed") || statusLower.includes("lost")
          ? "error"
          : "info";
      appendConsoleEntry(level, hardwareStatus, "hardware");
    }, [hardwareStatus, appendConsoleEntry]);


  return { bootStartedAtRef };
}
