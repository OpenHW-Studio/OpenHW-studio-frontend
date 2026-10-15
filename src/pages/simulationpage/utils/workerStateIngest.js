import { normalizeBoardKind } from "./hardwareUtils";

/**
 * Worker state-ingestion domain, extracted verbatim from SimulatorPage.jsx
 * handleRun > worker.onmessage.
 * (state.pins -> pin-transition counts + render mirrors + live pins +
 *  plotter history; state.neopixels; state.components -> update counts +
 *  buzzer-latency trace + live OOP + telemetry; generic state -> wifi
 *  dispatch + LAG telemetry; backendGpioSync -> ESP32 socket; debug_telemetry.)
 *
 * Pure function of (msg, msgArrivalMs, ctx); all live state flows through
 * ctx refs + setters. 1000-pt plot cap, 200-entry protocol caps, and the
 * commented-out EMIT/LAG appends are preserved verbatim.
 * Verify via run + plotter + telemetry Playwright checks.
 */
export function handleWorkerStateMessage(msg, msgArrivalMs, ctx) {
  const {
    runLastBoardPinsRef,
    runPinTransitionCountsRef,
    renderPinsByBoardRef,
    renderAnalogByBoardRef,
    livePinStatesRef,
    plotterPaused,
    latestParsedSerialRef,
    serialPlotLabelsRef,
    plotDataRef,
    renderNeopixelsByBoardRef,
    applyLiveNeopixelData,
    runComponentUpdateCountsRef,
    renderComponentsByBoardRef,
    buttonInteractStartTimeRef,
    updateLiveOopStates,
    handleTelemetryStateMessageRef,
    components,
    boardComponents,
    runLagTelemetryLastStateRef,
    runLagTelemetryLastLogRef,
    solverMode,
    esp32Socket,
    appendConsoleEntry,
  } = ctx;
          if (msg.type === "state" && msg.pins) {
            const boardIdKey = String(msg.boardId || "default");
            const prevPins = runLastBoardPinsRef.current.get(boardIdKey) || {};
            Object.keys(msg.pins).forEach((pinId) => {
              const prevValue = !!prevPins[pinId];
              const nextValue = !!msg.pins[pinId];
              if (prevValue !== nextValue) {
                const key = `${boardIdKey}:${pinId}`;
                runPinTransitionCountsRef.current[key] =
                  (runPinTransitionCountsRef.current[key] || 0) + 1;
              }
            });
            runLastBoardPinsRef.current.set(boardIdKey, { ...msg.pins });
            renderPinsByBoardRef.current[boardIdKey] = { ...msg.pins };
            if (Object.prototype.hasOwnProperty.call(msg, "analog")) {
              renderAnalogByBoardRef.current[boardIdKey] = Array.isArray(
                msg.analog,
              )
                ? [...msg.analog]
                : msg.analog;
            }

            livePinStatesRef.current = msg.pins;
            if (!plotterPaused) {
              // Record plot history when simulation state arrives
              const serialVars = {};
              latestParsedSerialRef.current.forEach((val, idx) => {
                const lbl = serialPlotLabelsRef.current[idx] || `SVar${idx}`;
                serialVars[lbl] = val;
              });
              const newPt = {
                time: Date.now(),
                pins: msg.pins,
                analog: msg.analog || [],
                serialVars,
                boardId: msg.boardId || "default",
              };

              plotDataRef.current.push(newPt);
              if (plotDataRef.current.length > 1000) {
                plotDataRef.current.shift();
              }
            }
          }
          if (msg.type === "state" && msg.neopixels) {
            const boardIdKey = String(msg.boardId || "default");
            renderNeopixelsByBoardRef.current[boardIdKey] = msg.neopixels;
            applyLiveNeopixelData(msg.neopixels);
          }
          if (msg.type === "state" && msg.components) {
            const boardIdKey = String(msg.boardId || "default");
            const boardComponentState = {
              ...(renderComponentsByBoardRef.current[boardIdKey] || {}),
            };

            msg.components.forEach((c) => {
              const compId = String(c?.id || "").trim();
              if (!compId) return;
              runComponentUpdateCountsRef.current[compId] =
                (runComponentUpdateCountsRef.current[compId] || 0) + 1;
              boardComponentState[compId] = c.state;

              // Trace latency when buzzer starts buzzing
              if (
                c.id === "buzzer" &&
                c.state?.isBuzzing &&
                buttonInteractStartTimeRef.current
              ) {
                const latency =
                  performance.now() - buttonInteractStartTimeRef.current.time;
                const sourceBtnId = buttonInteractStartTimeRef.current.compId;
                console.log(
                  `%c[Latency Trace] [SUCCESS] Keypress round-trip took: ${latency.toFixed(1)}ms (Button: ${sourceBtnId} -> Buzzer Sound)`,
                  "color: #22c55e; font-weight: bold; font-size: 11px;",
                );
                if (latency > 80) {
                  console.warn(
                    `[Latency Trace] High round-trip latency detected (${latency.toFixed(1)}ms)! Thread contention or frame drops may be causing audible lag.`,
                  );
                }
                buttonInteractStartTimeRef.current = null; // Reset tracking
              }
            });

            renderComponentsByBoardRef.current[boardIdKey] = boardComponentState;

            updateLiveOopStates(msg.components);
            handleTelemetryStateMessageRef.current(msg);
          }
          if (msg.type === "state") {
            if (msg.wifi && typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("OPENHW_WIFI_STATS", {
                  detail: { boardId: msg.boardId, ...msg.wifi },
                })
              );
            }
            const boardIdKey = String(msg.boardId || "default");
            const boardComp =
              components.find((c) => c.id === boardIdKey) ||
              boardComponents.find((b) => b.id === boardIdKey);
            const boardKind = normalizeBoardKind(boardComp?.type || "");
            const nowMs = Date.now();
            const prevState =
              runLagTelemetryLastStateRef.current.get(boardIdKey) || null;
            const prevLag =
              runLagTelemetryLastLogRef.current.get(boardIdKey) || null;
            const stateGapMs = prevState ? nowMs - prevState.ts : null;
            runLagTelemetryLastStateRef.current.set(boardIdKey, { ts: nowMs });
            const perf =
              msg.perf && typeof msg.perf === "object" ? msg.perf : null;
            const telemetryLogIntervalMs = 1500;
            const telemetryLogEligible =
              !prevLag ||
              nowMs - prevLag.ts >= telemetryLogIntervalMs ||
              (Number.isFinite(Number(perf?.lastRunLoopMs)) &&
                Number(perf.lastRunLoopMs) > 20) ||
              (Number.isFinite(Number(perf?.lastPhysicsMs)) &&
                Number(perf.lastPhysicsMs) > 12) ||
              (Number.isFinite(Number(perf?.lastComponentUpdateMs)) &&
                Number(perf.lastComponentUpdateMs) > 12);

            // Emit sequence tracking
            const emitSeq = Number(msg._emitSeq || -1);
            const emitTimeMs = Number(msg._emitTime || 0);
            if (emitSeq >= 0 && emitTimeMs > 0 && telemetryLogEligible) {
              const msgAgeMs = performance.now() - msgArrivalMs + emitTimeMs;
              /*
                          appendConsoleEntry('info', `EMIT_TRACE ${boardIdKey} | seq=${emitSeq} | workerEmitTime=${emitTimeMs.toFixed(0)}ms | age=${msgAgeMs.toFixed(1)}ms`, 'debug');
              */
            }
            const perfRunMs = Number(perf?.lastRunLoopMs);
            const perfPhysicsMs = Number(perf?.lastPhysicsMs);
            const perfComponentMs = Number(perf?.lastComponentUpdateMs);
            const perfPresent =
              Number.isFinite(perfRunMs) ||
              Number.isFinite(perfPhysicsMs) ||
              Number.isFinite(perfComponentMs);
            const pinsCount =
              msg.pins && typeof msg.pins === "object"
                ? Object.keys(msg.pins).length
                : 0;
            const componentsCount = Array.isArray(msg.components)
              ? msg.components.length
              : 0;
            const slowStateGap = stateGapMs !== null && stateGapMs > 60;
            const slowWorker =
              (Number.isFinite(perfRunMs) && perfRunMs > 12) ||
              (Number.isFinite(perfPhysicsMs) && perfPhysicsMs > 8) ||
              (Number.isFinite(perfComponentMs) && perfComponentMs > 8);
            const msgHandleTimeMs = performance.now() - msgArrivalMs;
            if (
              telemetryLogEligible &&
              (slowStateGap || slowWorker || !prevLag)
            ) {
              const line = [
                `LAG ${boardIdKey}`,
                `board=${boardKind || "unknown"}`,
                `solver=${solverMode}`,
                `stateGap=${stateGapMs === null ? "n/a" : `${stateGapMs.toFixed(1)}ms`}`,
                `handleMs=${msgHandleTimeMs.toFixed(1)}`,
                `workerRun=${perfPresent ? `${Number.isFinite(perfRunMs) ? perfRunMs.toFixed(2) : "n/a"}ms` : "n/a"}`,
                `workerPhysics=${perfPresent ? `${Number.isFinite(perfPhysicsMs) ? perfPhysicsMs.toFixed(2) : "n/a"}ms` : "n/a"}`,
                `workerComponent=${perfPresent ? `${Number.isFinite(perfComponentMs) ? perfComponentMs.toFixed(2) : "n/a"}ms` : "n/a"}`,
                `pins=${pinsCount}`,
                `components=${componentsCount}`,
              ];

              /*
                          appendConsoleEntry(slowStateGap || slowWorker ? 'warn' : 'info', line.join(' | '), 'debug');
              */
              runLagTelemetryLastLogRef.current.set(boardIdKey, { ts: nowMs });
            }
          }
          if (msg.type === "backendGpioSync") {
            if (esp32Socket && typeof esp32Socket.sendGpio === "function") {
              esp32Socket.sendGpio(msg.pin, msg.value ? 1 : 0);
            }
          }
          if (msg.type === "debug_telemetry") {
            appendConsoleEntry("info", msg.message, "simulator");
          }

}
