import { normalizeBoardKind } from "./hardwareUtils";

/**
 * Run preflight domain, extracted verbatim from SimulatorPage.jsx handleRun
 * head (re-entry guard, BLOCKING validation gate, telemetry/log ref reset,
 * baud resolution, per-board maps, programmable-board scan, ESP32 session).
 *
 * NOTE on selectedRunBoardId: computed verbatim but never consumed
 * downstream (dead value in the original) — still computed + returned so
 * future readers see the same shape. singleProgrammableBoardId feeds the
 * per-board loop's active-file targeting.
 *
 * Returns null when the run must abort (guard/validation), else the
 * preflight bag. Early `return`s become `{ aborted: true }` so handleRun
 * keeps its exact console/guard semantics. Verify via double-run +
 * validation-blocked + ESP32-mode Playwright checks.
 */
export async function runPreflight(args, ctx) {
  const {
    isRunning,
    isCompiling,
    components,
    serialBaudRate,
    serialBoardFilter,
    esp32SimulationMode,
  } = args;
  const {
    runStartGuardRef,
    runCircuitValidation,
    appendConsoleEntry,
    setIsCompiling,
    setRunStartedAtMs,
    setRunDurationSec,
    rp2040GdbLastLogRef,
    rp2040WirelessLastLogRef,
    rp2040UartMicroPythonBoardsRef,
    rp2040UartSilentWarnedBoardsRef,
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
    startEsp32Session,
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
        rp2040GdbLastLogRef.current.clear();
        rp2040WirelessLastLogRef.current.clear();
        rp2040UartMicroPythonBoardsRef.current.clear();
        rp2040UartSilentWarnedBoardsRef.current.clear();
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
        const programmableBoards = components.filter(c => /(arduino|esp32|stm32|rp2040|pico)/i.test(c.type));
        const hasEsp32 = programmableBoards.some(c => normalizeBoardKind(c.type) === 'esp32');
        if (hasEsp32) {
          const engineText = esp32SimulationMode === 'frontend' ? 'Frontend Engine' : 'Backend QEMU';
          console.log(`[SimulatorPage] Selected ESP32 Emulation Engine: ${engineText}`);
          appendConsoleEntry('info', `Selected ESP32 Emulation Engine: ${engineText}`, 'simulator');
        }

        const isBackendProxy = await startEsp32Session(programmableBoards);
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
