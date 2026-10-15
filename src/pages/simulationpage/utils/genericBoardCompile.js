import { boardCompToDisplayName } from "./hardwareUtils";
import { getCachedHex, setCachedHex } from "../../../services/offlineCache.js";
import { compileCode } from "../../../services/simulatorService.js";

/**
 * Generic per-board compile domain: arduino sketches for every board family.
 * (library.txt read, shared-cache key, compileCode, cache write,
 *  boardHexMap + first-firmware-wins result.)
 *
 * Artifact + firmware-payload contract per board family:
 *   uno/nano  → artifacts ['hex','elf'], boardHexMap = compiled.hex (Intel HEX text)
 *   rp2040    → artifacts ['uf2','elf'], boardHexMap = compiled.hex (UF2BASE64:…)
 *   esp32     → artifacts ['bin','elf'], boardHexMap = base64 .bin (raw, no prefix)
 *   stm32f1/4 → artifacts ['bin','elf'], boardHexMap = base64 .bin (raw, no prefix)
 * Runners auto-detect (ELF magic / ':' HEX / raw bin) so payload shape drifts
 * don't break boot. MicroPython boards skip compile: the runner boots the
 * bundled MP image + injects main.py over the REPL (see runners + gap docs).
 *
 * Pure function of (args, ctx); returns { result }. Mutations flow through
 * ctx.boardHexMap.
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
              // Per-family artifacts: the backend registry decides supported
              // names; arduino-cli emits them from the installed core.
              const artifacts =
                kind === 'rp2040' ? ['uf2', 'elf'] :
                kind === 'esp32' ? ['bin', 'elf'] :
                (kind === 'stm32f1' || kind === 'stm32f4') ? ['bin', 'elf'] :
                ['hex', 'elf'];
              try {
                compiled = await compileCode({
                  code: compileSource,
                  files: compileUnit.files,
                  sketchName: compileUnit.sketchName,
                  fqbn: targetFqbn,
                  target: kind,
                  libraries_txt: librariesTxt,
                  artifacts,
                });
                setCachedHex(cacheSource, cacheKeyBoard, compiled);
              } catch (compileErr) {
                throw compileErr;
              }
            }

            boardHexMap[boardComp.id] = compiled.hex;
            logCompileSummary(compiled, boardComp, kind);
            if (!result) result = compiled;

  return { result };
}
