import { normalizeBoardKind } from "./hardwareUtils";
void normalizeBoardKind;

/**
 * Run preflight domain, extracted verbatim from SimulatorPage.jsx handleRun
 * head (re-entry guard, BLOCKING validation gate, telemetry/log ref reset,
 * baud resolution, per-board maps, programmable-board scan).
 *
 * Returns null when the run must abort (guard/validation), else the
 * preflight bag. Early `return`s become `{ aborted: true }` so handleRun
 * keeps its exact console/guard semantics. Verify via double-run +
 * validation-blocked Playwright checks.
 */
export async function runPreflight(args, ctx) {
  const {
    isRunning,
    isCompiling,
    components,
    serialBaudRate,
    serialBoardFilter,
  } = args;
  const {
    runStartGuardRef,
    runCircuitValidation,
    appendConsoleEntry,
    setIsCompiling,
    setRunStartedAtMs,
    setRunDurationSec,
    serialIngressArbitrationRef,
    serialPausedQueueRef,
    runComponentUpdateCountsRef,
    runPinTransitionCountsRef,
    runLagTelemetryLastStateRef,
    runLagTelemetryLastLogRef,
    runFpsTelemetryLastLogRef,
    runLastBoardPinsRef,
    BOARD_DEFAULT_BAUD,
    selectedSerialBoardKind,
    serialBoardMap,
  } = ctx;
        if (runStartGuardRef.current || isRunning || isCompiling) {
          appendConsoleEntry("info", "Run is already in progress.", "simulator");
          return { aborted: true };
        }

        runStartGuardRef.current = true;

        // 1. Unified Validation Gate (BLOCKING)
        appendConsoleEntry(
          "info",
          "🔍 Validating circuit health...",
          "simulator",
        );
        if (!runCircuitValidation()) {
          appendConsoleEntry(
            "error",
            "❌ Run blocked: The circuit has electrical or safety violations.",
            "simulator",
          );
          runStartGuardRef.current = false;
          return { aborted: true };
        }
        appendConsoleEntry(
          "info",
          "✅ Circuit validated. Initializing simulation...",
          "simulator",
        );

        appendConsoleEntry("info", "Run requested.", "simulator");
        serialIngressArbitrationRef.current.clear();
        serialPausedQueueRef.current = [];
        runComponentUpdateCountsRef.current = {};
        runPinTransitionCountsRef.current = {};
        runLagTelemetryLastStateRef.current.clear();
        runLagTelemetryLastLogRef.current.clear();
        runFpsTelemetryLastLogRef.current.clear();
        runLastBoardPinsRef.current = new Map();

        setIsCompiling(true);
        setRunStartedAtMs(Date.now());
        setRunDurationSec(0);
        const parsedRunBaud = Number(serialBaudRate);
        const selectedRunBaud = Number.isFinite(parsedRunBaud)
          ? parsedRunBaud
          : Number(
            BOARD_DEFAULT_BAUD[selectedSerialBoardKind] ||
            BOARD_DEFAULT_BAUD.arduino_uno,
          );
        const selectedRunBoardId =
          serialBoardFilter !== "all" && serialBoardMap.has(serialBoardFilter)
            ? serialBoardFilter
            : "";
        const boardHexMap = {};
        const boardPythonMap = {};
        const boardPythonFilesMap = {};
        const boardRuntimeEnvMap = {};
        const boardBaudMap = {};
        const programmableBoards = components.filter(c => /(arduino|rp2040|pico)/i.test(c.type));

        const isBackendProxy = false;
        const singleProgrammableBoardId =
          programmableBoards.length === 1 ? programmableBoards[0]?.id : "";
        const boardsWithoutCompilableSketch = [];
        let result = null;

  return {
    aborted: false,
    selectedRunBaud,
    selectedRunBoardId,
    boardHexMap,
    boardPythonMap,
    boardPythonFilesMap,
    boardRuntimeEnvMap,
    boardBaudMap,
    programmableBoards,
    isBackendProxy,
    singleProgrammableBoardId,
    boardsWithoutCompilableSketch,
    result,
  };
}
