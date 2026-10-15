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
