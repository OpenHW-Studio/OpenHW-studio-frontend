import { useCallback } from "react";

/**
 * Run-stop domain, extracted verbatim from SimulatorPage.jsx (handleStop).
 * (guard reset, ESP32 session stop, RP2040/log ref clears, runtime
 *  verification summaries, neopixel off-state sweep, worker + render
 *  worker teardown w/ display release event, serial/plotter reset,
 *  console close line.)
 *
 * Behavior contract: identical [] deps (all-ref/setter body), identical
 * top-10/top-12 summaries, identical DISPLAY_CLEAR_ALL + null-worker
 * event, identical neopixel blackout shape. Verify via run-then-stop
 * Playwright check.
 */
export function useRunStop({
  isRunningRef,
  runStartGuardRef,
  stopEsp32Session,
  rp2040GdbLastLogRef,
  rp2040WirelessLastLogRef,
  rp2040UartMicroPythonBoardsRef,
  rp2040UartSilentWarnedBoardsRef,
  runLagTelemetryLastStateRef,
  runLagTelemetryLastLogRef,
  runFpsTelemetryLastLogRef,
  runComponentUpdateCountsRef,
  runPinTransitionCountsRef,
  runLastBoardPinsRef,
  renderPinsByBoardRef,
  renderAnalogByBoardRef,
  renderComponentsByBoardRef,
  renderNeopixelsByBoardRef,
  componentsRef,
  workerRef,
  renderWorkerRef,
  setRenderWorker,
  setIsRunning,
  setIsCompiling,
  setIsBooting,
  setIsPaused,
  setRunStartedAtMs,
  setRunDurationSec,
  livePinStatesRef,
  clearLiveNeopixelData,
  applyLiveNeopixelData,
  liveOopStatesRef,
  notifyLiveOopStateListeners,
  setSerialHistory,
  plotDataRef,
  plotBoundsRef,
  setSerialPaused,
  setPlotterPaused,
  serialPlotBufferRef,
  serialPlotLabelsRef,
  latestParsedSerialRef,
  serialIngressArbitrationRef,
  serialPausedQueueRef,
  pendingSerialLogsRef,
  serialOverflowRef,
  appendConsoleEntry,
}) {
    const handleStop = useCallback(() => {
      const wasRunning = isRunningRef.current;
      runStartGuardRef.current = false;
      stopEsp32Session();
      rp2040GdbLastLogRef.current.clear();
      rp2040WirelessLastLogRef.current.clear();
      rp2040UartMicroPythonBoardsRef.current.clear();
      rp2040UartSilentWarnedBoardsRef.current.clear();
      runLagTelemetryLastStateRef.current.clear();
      runLagTelemetryLastLogRef.current.clear();
      runFpsTelemetryLastLogRef.current.clear();

      if (wasRunning) {
        const componentSummary = Object.entries(
          runComponentUpdateCountsRef.current,
        )
          .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
          .slice(0, 10)
          .map(([id, count]) => `${id}:${count}`);
        const pinSummary = Object.entries(runPinTransitionCountsRef.current)
          .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
          .slice(0, 12)
          .map(([id, count]) => `${id}:${count}`);

        if (componentSummary.length > 0) {
          appendConsoleEntry(
            "info",
            `Runtime verification (component updates): ${componentSummary.join(", ")}`,
            "simulator",
          );
        }
        if (pinSummary.length > 0) {
          appendConsoleEntry(
            "info",
            `Runtime verification (pin transitions): ${pinSummary.join(", ")}`,
            "simulator",
          );
        }
        if (componentSummary.length === 0 && pinSummary.length === 0) {
          appendConsoleEntry(
            "warn",
            "Runtime verification: no component updates or pin transitions detected.",
            "simulator",
          );
        }
      }

      runComponentUpdateCountsRef.current = {};
      runPinTransitionCountsRef.current = {};
      runLastBoardPinsRef.current = new Map();
      renderPinsByBoardRef.current = {};
      renderAnalogByBoardRef.current = {};
      renderComponentsByBoardRef.current = {};
      renderNeopixelsByBoardRef.current = {};

      const neopixelOffStates = {};
      const neopixelOffPixels = {};
      componentsRef.current.forEach((comp) => {
        if (!/(neopixel|ws2812|ws2821)/i.test(String(comp?.type || ""))) return;

        const rows = Math.max(
          1,
          Number.parseInt(String(comp?.attrs?.rows ?? "8"), 10) || 1,
        );
        const cols = Math.max(
          1,
          Number.parseInt(String(comp?.attrs?.cols ?? "8"), 10) || 1,
        );
        const pixelCount = rows * cols;
        const attrsState =
          comp?.attrs && typeof comp.attrs === "object" ? comp.attrs : {};

        neopixelOffStates[comp.id] = {
          ...attrsState,
          rows: String(rows),
          cols: String(cols),
          pixels: new Array(pixelCount).fill(0),
        };

        const pixelTriples = [];
        for (let index = 0; index < pixelCount; index++) {
          pixelTriples.push([
            Math.floor(index / cols),
            index % cols,
            { r: 0, g: 0, b: 0 },
          ]);
        }
        neopixelOffPixels[comp.id] = pixelTriples;
      });

      if (workerRef.current) {
        workerRef.current.postMessage({ type: "STOP" });
        workerRef.current.terminate();
        workerRef.current = null;
      }
      // Terminate the Render Worker and tell it to release all canvas resources.
      if (renderWorkerRef.current) {
        renderWorkerRef.current.postMessage({ type: "DISPLAY_CLEAR_ALL" });
        renderWorkerRef.current.terminate();
        renderWorkerRef.current = null;
        setRenderWorker(null); // Clear Provider so display UIs see null worker
        if (typeof window !== "undefined") {
          window.__displayRenderWorker = null;
          window.dispatchEvent(
            new CustomEvent("display-render-worker-changed", { detail: null }),
          );
        }
      }
      setIsRunning(false);
      setIsCompiling(false);
      setIsBooting(false); // TODO: Reset booting state on stop
      setIsPaused(false);
      setRunStartedAtMs(null);
      setRunDurationSec(0);
      livePinStatesRef.current = {};
      clearLiveNeopixelData();
      applyLiveNeopixelData(neopixelOffPixels);
      liveOopStatesRef.current = neopixelOffStates;
      Object.keys(neopixelOffStates).forEach(notifyLiveOopStateListeners);
      setSerialHistory([]);
      plotDataRef.current = [];
      // Perf: reset sticky plot bounds + drain serial ingress queues so a new
      // run starts clean (bounds only expand at ingest; stale backlog would
      // replay into the fresh run).
      if (plotBoundsRef) plotBoundsRef.current.clear();
      if (pendingSerialLogsRef) pendingSerialLogsRef.current = [];
      if (serialOverflowRef) serialOverflowRef.current = 0;
      setSerialPaused(false);
      setPlotterPaused(false);
      serialPlotBufferRef.current = "";
      serialPlotLabelsRef.current = [];
      latestParsedSerialRef.current = [];
      serialIngressArbitrationRef.current.clear();
      serialPausedQueueRef.current = [];
      appendConsoleEntry("info", "Simulation stopped.", "simulator");
      },
      // stopEsp32Session/appendConsoleEntry stable (useCallback); components read via functional updates where needed.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    );

  return { handleStop };
}
