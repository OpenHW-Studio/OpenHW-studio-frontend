import { normalizeBoardKind, boardCompToDisplayName } from "./hardwareUtils";
import { getCachedHex, setCachedHex } from "../../../services/offlineCache.js";
import { compileCode } from "../../../services/simulatorService.js";

/**
 * No-board fallback compile domain, extracted verbatim from SimulatorPage.jsx
 * handleRun (canvas has no programmable boards: compile the editor buffer
 * for the selected `board` with the offline-cache read/write wrapper).
 *
 * Pure function of (args, ctx); returns { result }. Caller assigns.
 * `result` passthrough preserves "only compile when nothing produced yet"
 * semantics. Verify via bare-canvas run check.
 */
export async function compileFallbackBoard(args, ctx) {
  const {
    useBlocklyCode,
    blocklyGeneratedCode,
    code,
    board,
    projectFiles,
    activeCodeFileId,
  } = args;
  const {
    BOARD_FQBN,
    appendConsoleEntry,
    logSerial,
    logCompileSummary,
    registerGdbArtifact,
  } = ctx;
  let { result } = ctx;
        if (!result) {
          const finalCode = useBlocklyCode ? blocklyGeneratedCode : code;
          const fallbackKind = normalizeBoardKind(board);
          const engine = fallbackKind === 'rp2040' ? 'arduino-pico' : 'arduino-cli';

          const libFile = (projectFiles || []).find(f => f.path.endsWith('/library.txt') || f.name === 'library.txt');
          const librariesTxt = libFile
            ? (libFile.id === activeCodeFileId ? code : (libFile.content || ''))
            : '';

          const cacheStr = [finalCode, engine, librariesTxt].join('\n/*__SPLIT__*/\n');
          appendConsoleEntry('info', `Compiling for ${boardKindToDisplayName(fallbackKind)}...`, 'simulator');

          const cached = await getCachedHex(cacheStr, board);
          if (cached) {
            logSerial("Using locally cached compilation (offline cache)...");
            result = cached;
          } else {
            logSerial("Compiling...");
            result = await compileCode({
              code: finalCode,
              fqbn: BOARD_FQBN[fallbackKind] || BOARD_FQBN.arduino_uno,
              target: fallbackKind,
              libraries_txt: librariesTxt,
              ...(fallbackKind === 'rp2040' ? { builder: 'arduino-pico' } : {}),
            });
            setCachedHex(cacheStr, board, result);
            registerGdbArtifact(board || "default", fallbackKind, result);
          }
          logCompileSummary(result, null, fallbackKind);
        }

  return { result };
}
