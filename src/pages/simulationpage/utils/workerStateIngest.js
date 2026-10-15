import { normalizeBoardKind } from "./hardwareUtils";

// Perf: shared frozen empty serialVars — avoids allocating one {} per state
// message when no serial channel is subscribed (the common case).
const EMPTY_SERIAL_VARS = Object.freeze({});

/**
 * Worker state-ingestion domain, extracted verbatim from SimulatorPage.jsx
 * handleRun > worker.onmessage.
 * (state.pins -> pin-transition counts + render mirrors + live pins +
 *  plotter history; state.neopixels; state.components -> update counts +
 *  buzzer-latency trace + live OOP + telemetry; generic state -> wifi
 *  dispatch + LAG telemetry; debug_telemetry.)
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
    plotBoundsRef,
    subscribedSerialKeysRef,
    isPlotterVisible,
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
    appendConsoleEntry,
    sabTelemetryHydrateRef,
    sabOffsetsRef,
    stateSabRef,
    requestTelemetryHydrate,
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
            // Perf: sample plot points (~30Hz max) — the worker can emit state
            // messages far faster than the plotter can draw, and every point
            // costs a retained object + a future canvas scan.
            const nowPt = Date.now();
            const lastPt = plotDataRef.current.length > 0
              ? plotDataRef.current[plotDataRef.current.length - 1]
              : null;
            const plotDue = !lastPt || nowPt - lastPt.time >= 33;
            if (!plotterPaused && plotDue) {
              // Perf: only materialize serialVars when the plotter is actually
              // visible AND a serial channel is subscribed. Otherwise this
              // allocates a fresh object per state message for nobody.
              let serialVars = EMPTY_SERIAL_VARS;
              const subs = subscribedSerialKeysRef?.current;
              if (isPlotterVisible && subs && subs.size > 0) {
                serialVars = {};
                const parsed = latestParsedSerialRef.current;
                const labels = serialPlotLabelsRef.current;
                for (let idx = 0; idx < parsed.length; idx++) {
                  const lbl = labels[idx] || `SVar${idx}`;
                  if (subs.has(lbl)) serialVars[lbl] = parsed[idx];
                }
              }
              const newPt = {
                time: nowPt,
                pins: msg.pins,
                analog: msg.analog || [],
                serialVars,
                boardId: msg.boardId || "default",
              };

              // Perf: incremental sticky plot bounds (boardId:label -> min/max)
              // updated O(channels) per point at ingest. PlotterCanvas used to
              // re-scan the FULL 1000-pt buffer per serial channel per frame
              // (60fps x channels x 1000 pts) — the single hottest plotter loop.
              const boundsMap = plotBoundsRef?.current;
              if (boundsMap && serialVars !== EMPTY_SERIAL_VARS) {
                const bId = newPt.boardId;
                for (const lbl in serialVars) {
                  const v = serialVars[lbl];
                  if (typeof v !== "number" || Number.isNaN(v)) continue;
                  const key = `${bId}:${lbl}`;
                  let b = boundsMap.get(key);
                  if (!b) {
                    b = { min: Infinity, max: -Infinity };
                    boundsMap.set(key, b);
                  }
                  if (v < b.min) b.min = v;
                  if (v > b.max) b.max = v;
                }
              }

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
          // T5: SAB wakeup fast path — slots already polled into the live-OOP
          // mirror by the rAF reader (sabReader.js). Skip the clone-heavy
          // components fan-out; telemetry still flows via the ring/ingest.
          // Telemetry hydrate: the FIRST wakeup after START (seq 0/1) carries
          // no components array, so seed the mirror + telemetry cache from
          // the SAB slots directly (else getLatestTelemetry stays empty
          // forever on the fast path — the SAB reader only writes raw slot
          // numerics, never formatted telemetry entries).
          if (msg.type === "state" && msg.sabWakeup) {
            try {
              if (ctx.sabTelemetryHydrateRef && !ctx.sabTelemetryHydrateRef.current) {
                ctx.sabTelemetryHydrateRef.current = true;
                if (typeof ctx.requestTelemetryHydrate === "function") {
                  ctx.requestTelemetryHydrate();
                }
              }
            } catch { /* hydrate trigger never breaks ingest */ }
            const boardIdKey = String(msg.boardId || "default");
            if (Array.isArray(msg.dirtySlots)) {
              const counts = runComponentUpdateCountsRef.current;
              // Attribute updates by slot via the offsets map when available.
              const offsets = ctx.sabOffsetsRef?.current || window.__sabOffsets || null;
              if (offsets && typeof offsets === "object") {
                for (const id of Object.keys(offsets)) {
                  if (msg.dirtySlots.includes(offsets[id])) {
                    counts[id] = (counts[id] || 0) + 1;
                  }
                }
              }
            }
            // Buzzer latency trace still works: read buzzing flag from mirror.
            // (Buzzer state arrives via SAB slot i0; mirror updated by reader.)
            runLagTelemetryLastStateRef.current.set(boardIdKey, { ts: Date.now() });
          }
          if (msg.type === "state" && msg.components) {
            // NOTE: components ride along even on sabWakeup posts now (rich
            // on-demand detail for selected telemetry components, §11.4).
            // Wakeups without components behave exactly as before.
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
            // Measured-pace tracking (sim ms per wall ms, EMA per board).
            // Powers the runtime pill's actual-vs-setting readout so the
            // panel can never claim 100% while the engine runs slower.
            try {
              const simMs = Number(msg.simTimeMs);
              if (Number.isFinite(simMs) && typeof window !== 'undefined') {
                const store = (window.__simPaceByBoard = window.__simPaceByBoard || {});
                const prev = store[boardIdKey] || null;
                if (prev && Number.isFinite(prev.simMs) && Number.isFinite(prev.wallMs) && nowMs > prev.wallMs) {
                  const inst = (simMs - prev.simMs) / (nowMs - prev.wallMs);
                  if (inst >= 0 && inst < 10) {
                    // Slow EMA: engine pace arrives in bursts (WFI
                    // fast-forwards, host GC) — converge on the truth
                    // without whiplash. Same fixed point, less jump.
                    const ema = prev.ema === undefined ? inst : prev.ema * 0.85 + inst * 0.15;
                    store[boardIdKey] = { wallMs: nowMs, simMs, ema, at: nowMs };
                  } else {
                    store[boardIdKey] = { ...(prev || {}), at: nowMs };
                  }
                } else {
                  store[boardIdKey] = { wallMs: nowMs, simMs, ema: prev && prev.ema, at: nowMs };
                }
              }
            } catch { /* pace tracking never breaks ingest */ }
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
          if (msg.type === "debug_telemetry") {
            appendConsoleEntry("info", msg.message, "simulator");
          }

}
