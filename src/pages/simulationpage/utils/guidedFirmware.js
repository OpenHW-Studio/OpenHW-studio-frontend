import { normalizeBoardKind } from "./hardwareUtils";

/**
 * Guided-project firmware shortcut domain, extracted verbatim from
 * SimulatorPage.jsx handleRun preflight.
 * (precompiledBinaries.js static hex, then guidedProjectHexes.js cached
 *  hex; both fan out boardHexMap/boardBaudMap per programmable board.)
 *
 * Pure function of (args, ctx): dynamic imports kept inline so chunks
 * split identically. Returns { result, handled } — handled is always true
 * (block is conditional by caller). First-firmware-wins via `result`.
 * Verify via guided-project read-only run checks.
 */
export async function resolveGuidedFirmware(args, ctx) {
  const { canvasOnly, readOnly, projectName, programmableBoards } = args;
  const {
    boardHexMap,
    boardBaudMap,
    boardBaudRates,
    BOARD_DEFAULT_BAUD,
    appendConsoleEntry,
  } = ctx;
  let { result } = ctx;
        if (!result && canvasOnly && readOnly && projectName) {
          // 1. Check precompiledBinaries.js (statically imported hex data)
          const { getPrecompiledBinary } = await import("../../../services/precompiledBinaries.js");
          const precompiled = getPrecompiledBinary(projectName);
          if (precompiled?.hex) {
            appendConsoleEntry("info", `Using pre-compiled firmware for ${projectName}.`, "simulator");
            result = { hex: precompiled.hex };
            for (const boardComp of programmableBoards) {
              const kind = normalizeBoardKind(boardComp.type);
              boardHexMap[boardComp.id] = precompiled.hex;
              boardBaudMap[boardComp.id] = Number(
                boardBaudRates[boardComp.id] || BOARD_DEFAULT_BAUD[kind] || 115200,
              );
            }
          }

          // 2. Fall back to localStorage cache (compiled on a prior visit)
          if (!result) {
            const { getGuidedHex } = await import("../../../services/guidedProjectHexes.js");
            const cachedHex = getGuidedHex(projectName);
            if (cachedHex) {
              appendConsoleEntry("info", `Using cached firmware for ${projectName}.`, "simulator");
              result = { hex: cachedHex };
              for (const boardComp of programmableBoards) {
                const kind = normalizeBoardKind(boardComp.type);
                boardHexMap[boardComp.id] = cachedHex;
                boardBaudMap[boardComp.id] = Number(
                  boardBaudRates[boardComp.id] || BOARD_DEFAULT_BAUD[kind] || 115200,
                );
              }
            }
          }
        }

  return { result };
}
