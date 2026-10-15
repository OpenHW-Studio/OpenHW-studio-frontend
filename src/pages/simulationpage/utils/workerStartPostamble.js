/**
 * Worker START-postamble domain, extracted verbatim from SimulatorPage.jsx
 * handleRun tail.
 * (neopixel wiring stub, custom-logic harvest, structured-clone snapshot,
 *  per-component SAB layout + 4KB-aligned SharedArrayBuffer, teacher-key
 *  capture ids + project JSON, START postMessage with all board maps.)
 *
 * Returns the posted START payload (also posted to worker). SAB lands in
 * ctx.stateSabRef.current — same identity the render loop reads.
 * Buffer math (8B/component, 4B/px, 4KB align, 4096 floor) and the 7900ms
 * teacher-key duration are preserved verbatim.
 * Verify via run-start + teacher-key + neopixel-matrix checks.
 */
import { allocateStateSab, SabCommandWriter, SabEventReader } from "../../../worker/sab/layout.ts";

export function postWorkerStartMessage(worker, args, ctx) {
  const {
    components,
    wires,
    result,
    selectedRunBaud,
    options,
    buildSimulationJsonPayload,
    boardHexMap,
    boardPythonMap,
    boardPythonFilesMap,
    boardRuntimeEnvMap,
    boardBaudMap,
    rp2040DebugTelemetryEnabled,
    simulationSpeed,
    componentTelemetryEnabled,
    isBooting,
    isCompiling,
    telemetryMode,
    logSerial,
    telemetryWatchedParamsMap,
    deepSiliconDebuggingEnabled,
  } = args;
  const { COMPONENT_REGISTRY, stateSabRef, sabOffsetsRef, sabCursorRef, sabPollStatsRef, cmdBufferRef, evtBufferRef, cmdWriterRef, evtReaderRef } = ctx;
        logSerial("Simulator started in Web Worker.");

        const neopixelWiring = components
          .filter(
            (c) =>
              c.type === "wokwi-neopixel-matrix" ||
              c.type === "openhw-neopixel-matrix",
          )
          .map((c) => {
            return null; // Handle Neopixels later
          })
          .filter((n) => n);

        const customLogics = [];
        components.forEach((c) => {
          if (COMPONENT_REGISTRY[c.type]?.logicCode) {
            customLogics.push({
              type: c.type,
              code: COMPONENT_REGISTRY[c.type].logicCode,
              pins: COMPONENT_REGISTRY[c.type].manifest.pins,
            });
          }
        });

        let cleanComponents = components;
        let cleanWires = wires;
        try {
          cleanComponents = JSON.parse(JSON.stringify(components));
          cleanWires = JSON.parse(JSON.stringify(wires));
        } catch (e) {
          console.warn('Failed to stringify components/wires for worker', e);
        }

        console.warn(`[SimulatorPage] Sending hex payload to worker. Base64 Length: ${result.hex ? result.hex.length : 0} characters`);

        // SAB layout v1 (§12.2): fixed 64 B slots via shared sab/layout.ts.
        // Neopixel pixel data stays OUT (VRAM path); slots carry numerics only.
        // Falls back to legacy byte math only if the layout module is unavailable
        // (e.g. unit-test context without worker bundling).
        // Synchronous alloc (layout.ts is a bundled static import — no await,
        // so the START postamble keeps its fire-and-forget call contract).
        const alloc = allocateStateSab(components.map((c) => c.id));
        stateSabRef.current = alloc.buffer;
        const componentSabOffsets = alloc.offsets;
        // Command/event rings (§10.4): shared with the worker at START.
        // Stored on dedicated refs when provided; mirrored on window for
        // debug tooling + Playwright verification.
        const cmdBuffer = alloc.cmdBuffer || null;
        const evtBuffer = alloc.evtBuffer || null;

        // Expose to window for Web Components
        const isTeacherKeyCapture = !!options?.isTeacherKeyCapture;
        let teacherKeyBoardId = null;
        let teacherKeyComponentId = null;
        let teacherKeyProjectJson = null;

        if (isTeacherKeyCapture) {
          const boardComp = components.find((c) => c.id.toLowerCase().includes("uno") || c.id.toLowerCase().includes("pico"));
          const peripheralComp = components.find((c) => c.id !== boardComp?.id);
          teacherKeyBoardId = boardComp ? boardComp.type.split("-").pop() : "board";
          teacherKeyComponentId = peripheralComp ? peripheralComp.type.split("_").pop() : "circuit";
          const payload = buildSimulationJsonPayload();
          teacherKeyProjectJson = JSON.stringify(payload, null, 2);
        }

        const startPayload = {
          type: "START",
          isTeacherKeyCapture,
          teacherKeyBoardId,
          teacherKeyComponentId,
          teacherKeyProjectJson,
          teacherKeyDurationMs: 7900,
          sab: stateSabRef.current,
          sabOffsets: componentSabOffsets,
          cmdBuffer,
          evtBuffer,
          networkRoomCode: localStorage.getItem("NETWORK_ROOM_CODE") || "",
          hex: result.hex,
          neopixels: neopixelWiring,
          wires: cleanWires,
          components: cleanComponents,
          customLogics: customLogics,
          boardHexMap:
            Object.keys(boardHexMap).length > 0 ? boardHexMap : undefined,
          boardPythonMap:
            Object.keys(boardPythonMap).length > 0 ? boardPythonMap : undefined,
          boardPythonFilesMap:
            Object.keys(boardPythonFilesMap).length > 0
              ? boardPythonFilesMap
              : undefined,
          boardRuntimeEnvMap:
            Object.keys(boardRuntimeEnvMap).length > 0
              ? boardRuntimeEnvMap
              : undefined,
          boardBaudMap:
            Object.keys(boardBaudMap).length > 0 ? boardBaudMap : undefined,
          baudRate: selectedRunBaud,
          debugRp2040: rp2040DebugTelemetryEnabled,
          debugSyncHeartbeat: rp2040DebugTelemetryEnabled,
          speed: simulationSpeed,
          telemetryEnabled:
            componentTelemetryEnabled && !isBooting && !isCompiling,
          telemetryMode: telemetryMode,
          watchedParamsMap: telemetryWatchedParamsMap,
          deepSilicon: deepSiliconDebuggingEnabled,
        };
  // SAB reader wiring (§12.5 step 3): publish offsets + reset poll cursor so
  // the rAF reader in SimulatorPage starts clean on every run.
  // Bind ring handles (§10.4): writer on main, reader for worker events.
  // postMessage DEBUG_*/SERIAL_INPUT stay as fallback when rings are absent.
  let cmdWriter = null;
  let evtReader = null;
  try {
    if (cmdBuffer) cmdWriter = new SabCommandWriter(cmdBuffer);
    if (evtBuffer) evtReader = new SabEventReader(evtBuffer);
  } catch { cmdWriter = null; evtReader = null; }
  try {
    if (sabOffsetsRef) sabOffsetsRef.current = componentSabOffsets;
    if (sabCursorRef) sabCursorRef.current = null;
    if (sabPollStatsRef) sabPollStatsRef.current = { polls: 0, frames: 0, slots: 0, lastSeq: -1 };
    if (cmdBufferRef) cmdBufferRef.current = cmdBuffer;
    if (evtBufferRef) evtBufferRef.current = evtBuffer;
    if (cmdWriterRef) cmdWriterRef.current = cmdWriter;
    if (evtReaderRef) evtReaderRef.current = evtReader;
    if (typeof window !== "undefined") {
      window.__sabOffsets = componentSabOffsets;
      window.__sabPollStats = { polls: 0, frames: 0, slots: 0, lastSeq: -1 };
      window.__sabBuffer = stateSabRef.current;
      window.__sabCmdBuffer = cmdBuffer;
      window.__sabEvtBuffer = evtBuffer;
      window.__sabCmdWriter = cmdWriter;
      window.__sabEvtReader = evtReader;
      window.__sabTelemetryLatest = null;
    }
  } catch { /* SAB wiring must never break START */ }
  worker.postMessage(startPayload);
  return startPayload;
}
