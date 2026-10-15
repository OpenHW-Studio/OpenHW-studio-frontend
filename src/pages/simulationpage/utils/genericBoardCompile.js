import { boardCompToDisplayName } from "./hardwareUtils";
import { getCachedHex, setCachedHex } from "../../../services/offlineCache.js";
import { compileCode } from "../../../services/simulatorService.js";

/**
 * Generic per-board compile domain, extracted verbatim from SimulatorPage.jsx
 * handleRun > per-board loop tail (non-RP2040 boards: AVR only now that
 * ESP32/STM32 workers were removed).
 * (library.txt read, shared-cache key, compileCode, cache write,
 *  boardHexMap + first-firmware-wins result.)
 *
 * Pure function of (args, ctx); returns { result }. Mutations flow through
 * ctx.boardHexMap.
 * Verify via AVR run checks.
 */
export async function compileGenericBoard(args, ctx) {
  const {
    boardComp,
    kind,
    targetFqbn,
    compileUnit,
    compileSource,
    projectFiles,
    activeCodeFileId,
    code,
  } = args;
  const {
    boardHexMap,
    appendConsoleEntry,
    logSerial,
    logCompileSummary,
    registerGdbArtifact,
  } = ctx;
  let { result } = ctx;
            const libFile = (projectFiles || []).find(f => f.path === `project/${boardComp.id}/library.txt`);
            const librariesTxt = libFile
              ? (libFile.id === activeCodeFileId ? code : (libFile.content || ''))
              : '';

            const cacheKeyBoard = `${kind}:${boardComp.id}`;
            const cacheSource = [
              compileSource,
              targetFqbn,
              ...compileUnit.files.map((f) => `${f.name}\n${f.content || ''}`),
              librariesTxt,
            ].join('\n/*__SPLIT__*/\n');

            appendConsoleEntry(
              "info",
              `Compiling for ${boardCompToDisplayName(boardComp, kind)}...`,
              "simulator",
            );
            let compiled = await getCachedHex(cacheSource, cacheKeyBoard);
            if (compiled) {
              logSerial(`Using cached compilation for ${boardComp.id}...`);
            } else {
              logSerial(`Compiling ${boardComp.id}...`);
              try {
                compiled = await compileCode({
                  code: compileSource,
                  files: compileUnit.files,
                  sketchName: compileUnit.sketchName,
                  fqbn: targetFqbn,
                  target: kind,
                  libraries_txt: librariesTxt,
                  // Uno simulator runs the .hex, GDB needs the .elf.
                  artifacts: ['hex', 'elf'],
                });
                setCachedHex(cacheSource, cacheKeyBoard, compiled);
              } catch (compileErr) {
                throw compileErr;
              }
            }

            boardHexMap[boardComp.id] = compiled.hex;
            logCompileSummary(compiled, boardComp, kind);
            registerGdbArtifact(boardComp.id, kind, compiled);
            if (!result) result = compiled;

  return { result };
}
