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
    telemetryWatchedParamsMap,
    deepSiliconDebuggingEnabled,
    esp32SimulationMode,
  } = args;
  const { COMPONENT_REGISTRY, stateSabRef } = ctx;
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

        const componentSabOffsets = {};
        let currentSabOffset = 0;
        components.forEach((c) => {
          componentSabOffsets[c.id] = currentSabOffset;
          if (c.type === "openhw-neopixel-matrix" || c.type === "wokwi-neopixel-matrix") {
            const rows = parseInt(c.attrs?.rows || "8", 10);
            const cols = parseInt(c.attrs?.cols || "8", 10);
            currentSabOffset += (rows * cols * 4); // 4 bytes per pixel (RGBA)
          } else {
            currentSabOffset += 8; // Default 8 bytes per component (e.g. 1 Float64 or 2 Float32s)
          }
        });

        // Align buffer to nearest 4KB block
        const bufferSize = Math.max(4096, Math.ceil(currentSabOffset / 4096) * 4096);
        stateSabRef.current = new SharedArrayBuffer(bufferSize);

        // Expose to window for Web Components
        const isTeacherKeyCapture = !!options?.isTeacherKeyCapture;
        let teacherKeyBoardId = null;
        let teacherKeyComponentId = null;
        let teacherKeyProjectJson = null;

        if (isTeacherKeyCapture) {
          const boardComp = components.find((c) => c.id.toLowerCase().includes("uno") || c.id.toLowerCase().includes("pico") || c.id.toLowerCase().includes("esp32"));
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
          esp32SimulationMode: esp32SimulationMode,
        };
  worker.postMessage(startPayload);
  return startPayload;
}
