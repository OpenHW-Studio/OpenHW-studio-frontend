import { useCallback, useEffect, useRef } from "react";

/**
 * Teacher-key capture domain, extracted verbatim from SimulatorPage.jsx.
 * (runFnRef mirror + RUN_SIMULATION message bridge, canvas-only serial
 *  relay @5Hz, serial-panel drag loop, teacher-key dispatch/generate w/
 *  7900ms capture.)
 *
 * Behavior contract: identical [] / [canvasOnly] deps, identical 200ms
 * relay cadence, identical START_KEY_CAPTURE shape, identical queued-capture
 * effect. Verify via teacher-key + embed-relay Playwright checks.
 */
export function useTeacherKeyCapture({
  handleRun,
  canvasOnly,
  serialRelayActiveRef,
  lastRelayedLengthRef,
  serialHistoryRef,
  serialPanelDragging,
  serialPanelDragOffset,
  setSerialPanelPos,
  setSerialPanelGrabbing,
  components,
  buildSimulationJsonPayload,
  workerRef,
  isRunning,
  isQueuedForTeacherKey,
  setIsQueuedForTeacherKey,
  appendConsoleEntry,
}) {
    const runFnRef = useRef(null)
    runFnRef.current = handleRun
    useEffect(() => {
      const handler = (e) => {
        if (e.data?.type === 'RUN_SIMULATION') {
          runFnRef.current?.()
        }
        if (e.data?.type === 'serial-toggle' && canvasOnly) {
          serialRelayActiveRef.current = !serialRelayActiveRef.current;
          lastRelayedLengthRef.current = 0;
        }
      }
      window.addEventListener('message', handler)
      return () => window.removeEventListener('message', handler)
    }, [canvasOnly])

    useEffect(() => {
      if (!canvasOnly) return
      const timer = setInterval(() => {
        if (!serialRelayActiveRef.current) return
        const history = serialHistoryRef.current
        if (history.length > lastRelayedLengthRef.current) {
          const newEntries = history.slice(lastRelayedLengthRef.current)
          lastRelayedLengthRef.current = history.length
          window.parent?.postMessage({ type: 'serial-entry', entries: newEntries }, '*')
        }
      }, 200)
      return () => clearInterval(timer)
    }, [canvasOnly])

    useEffect(() => {
      const handleMouseMove = (e) => {
        if (!serialPanelDragging.current) return
        setSerialPanelPos({
          x: Math.max(0, e.clientX - serialPanelDragOffset.current.x),
          y: Math.max(0, e.clientY - serialPanelDragOffset.current.y),
        })
      }
      const handleMouseUp = () => {
        serialPanelDragging.current = false
        setSerialPanelGrabbing(false)
      }
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }, [])

    const dispatchTeacherKeyCapture = useCallback(() => {
      if (!workerRef.current) {
        alert("Worker failed to start. Cannot capture key.");
        return;
      }

      const boardComp = components.find((c) => c.id.toLowerCase().includes("uno") || c.id.toLowerCase().includes("pico") || c.id.toLowerCase().includes("arduino"));
      const peripheralComp = components.find((c) => c.id !== boardComp?.id);
      const boardName = boardComp ? boardComp.type.split("-").pop() : "board";
      const peripheralName = peripheralComp ? peripheralComp.type.split("_").pop() : "circuit";

      const payload = buildSimulationJsonPayload();
      const projectJson = JSON.stringify(payload, null, 2);

      workerRef.current.postMessage({
        type: "START_KEY_CAPTURE",
        durationMs: 7900,
        projectJson: projectJson,
        board: boardName,
        component: peripheralName
      });
    }, [components, buildSimulationJsonPayload]);

    useEffect(() => {
      if (isRunning && isQueuedForTeacherKey) {
        setIsQueuedForTeacherKey(false);
        appendConsoleEntry("info", "Simulation running! Visual telemetry recording started for 8 seconds...", "simulator");
      }
    }, [isRunning, isQueuedForTeacherKey, appendConsoleEntry]);

    const generateTeacherKey = useCallback(async () => {
      if (!isRunning) {
        appendConsoleEntry("info", "Compiling and starting simulation to capture teacher key...", "simulator");
        setIsQueuedForTeacherKey(true);
        await handleRun({ isTeacherKeyCapture: true });
      } else {
        appendConsoleEntry("info", "Starting visual telemetry recording for 8 seconds...", "simulator");
        dispatchTeacherKeyCapture();
      }
    }, [isRunning, handleRun, dispatchTeacherKeyCapture, appendConsoleEntry]);

    // Stable identity: wasRunning read via ref so TopToolbox props stay stable.

  return { runFnRef, dispatchTeacherKeyCapture, generateTeacherKey };
}
