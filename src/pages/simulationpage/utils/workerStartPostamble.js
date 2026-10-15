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
import { allocateStateSab, SabCommandWriter, SabEventReader, SabSerialRing } from "../../../worker/sab/layout.ts";

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

        // SAB layout v1 (§12.2/§10.4 full map): fixed 64 B slots + board
        // table + pin bitfield + serial rings + debug region + display
        // descriptors, via shared sab/layout.ts. Neopixel pixel data stays
        // OUT (VRAM path); slots carry numerics only.
        // Board pin order is fixed here at START (per-board pin lists from
        // COMPONENT_REGISTRY manifests); the worker partitions the pin
        // region from the same boardPinMaps. Synchronous alloc (layout.ts is
        // a bundled static import — no await, so the START postamble keeps
        // its fire-and-forget call contract).
        const boardComps = components.filter((c) =>
          /(arduino|rp2040|pico)/i.test(String(c?.type || "")),
        );
        const boardList = boardComps.length > 0 ? boardComps : [];
        const boardPinMaps = boardList.map((b, bi) => {
          const manifestPins = COMPONENT_REGISTRY[b.type]?.manifest?.pins || [];
          const pins = manifestPins.map((p) => String(p?.id ?? p));
          return { boardId: String(b.id), boardIdx: bi, pins };
        });
        const alloc = allocateStateSab(
          components.map((c) => c.id),
          undefined,
          boardPinMaps,
        );
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
          // Full-map geometry (§10.4): lets runners bind SabPinWriter /
          // SabDebugWriter without recomputing layout. Readers (sabReader)
          // derive the same from the header + board table.
          sabGeometry: {
            boardTableOffset: alloc.boardTableOffset,
            pinBitWords: alloc.pinBitWords,
            analogBase: alloc.analogBase,
          },
          sabDebugOffset: alloc.debugOffset,
          sabSerialRxOffset: alloc.serialRxOffset,
          sabSerialTxOffset: alloc.serialTxOffset,
          sabDisplayDescOffset: alloc.displayDescOffset,
          boardPinMaps,
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
  // Serial rings (§10.4): same state SAB, offsets from the START alloc.
  // TX = worker→main (polled for monitor bytes), RX = main→worker (UI input).
  let serialTxRing = null;
  let serialRxRing = null;
  try {
    if (cmdBuffer) cmdWriter = new SabCommandWriter(cmdBuffer);
    if (evtBuffer) evtReader = new SabEventReader(evtBuffer);
    const sab = stateSabRef.current;
    if (sab && alloc.serialTxOffset > 0) serialTxRing = new SabSerialRing(sab, alloc.serialTxOffset);
    if (sab && alloc.serialRxOffset > 0) serialRxRing = new SabSerialRing(sab, alloc.serialRxOffset);
  } catch { cmdWriter = null; evtReader = null; serialTxRing = null; serialRxRing = null; }
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
      // Full-map handles (§10.4): geometry, serial rings, display/debug
      // offsets, board pin order — readers derive the same from the header.
      window.__sabGeometry = {
        boardTableOffset: alloc.boardTableOffset,
        pinBitWords: alloc.pinBitWords,
        analogBase: alloc.analogBase,
      };
      window.__sabSerialTxRing = serialTxRing;
      window.__sabSerialRxRing = serialRxRing;
      window.__sabSerialRxOffset = alloc.serialRxOffset;
      window.__sabSerialTxOffset = alloc.serialTxOffset;
      window.__sabDebugOffset = alloc.debugOffset;
      window.__sabDisplayDescOffset = alloc.displayDescOffset;
      window.__sabBoardPinMaps = boardPinMaps;
      try {
        window.__sabSerialRxPush = (text) => {
          if (!serialRxRing) return false;
          const s = String(text ?? "");
          if (!s) return false;
          for (let i = 0; i < s.length; i++) serialRxRing.pushByte(s.charCodeAt(i) & 0xff);
          return true;
        };
      } catch { /* helper never breaks START */ }
    }
  } catch { /* SAB wiring must never break START */ }
  worker.postMessage(startPayload);
  return startPayload;
}
