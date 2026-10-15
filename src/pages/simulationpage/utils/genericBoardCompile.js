import { boardCompToDisplayName } from "./hardwareUtils";
import { getCachedHex, setCachedHex } from "../../../services/offlineCache.js";
import {
  compileCode,
  startEsp32Compile,
  getEsp32CompileStatus,
} from "../../../services/simulatorService.js";

/**
 * Generic per-board compile domain, extracted verbatim from SimulatorPage.jsx
 * handleRun > per-board loop tail (non-RP2040 boards: AVR/ESP32/STM32).
 * (library.txt read, shared-cache key incl. esp32SimulationMode, cached or
 *  ESP32-frontend job-poll (500ms x180) or compileCode, cache write,
 *  boardHexMap + first-firmware-wins result.)
 *
 * Pure function of (args, ctx); returns { result }. Mutations flow through
 * ctx.boardHexMap. Poll cadence (500ms), timeout (90s/180 polls), and the
 * progress-line replay are preserved verbatim.
 * Verify via AVR + ESP32-frontend + ESP32-backend run checks.
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
    esp32SimulationMode,
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
              kind === 'esp32' ? esp32SimulationMode : '',
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
                if (kind === 'esp32' && esp32SimulationMode === 'frontend') {
                  const startRes = await startEsp32Compile({
                    code: compileSource,
                    libraries_txt: librariesTxt,
                    targetEngine: 'frontend'
                  });

                  if (!startRes || (!startRes.jobId && !startRes.buildId)) {
                    throw new Error('Failed to start ESP32 compilation.');
                  }

                  if (startRes.cache === 'hit') {
                    logSerial(`Using server-cached compilation for ${boardComp.id}...`);
                  }

                  const jobId = startRes.jobId || startRes.buildId;
                  let pollCount = 0;
                  let lastPrintedProgressLen = 0;

                  while (true) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    const statusRes = await getEsp32CompileStatus(jobId);

                    if (!statusRes) continue;

                    const progressLines = statusRes.progress || [];
                    if (progressLines.length > lastPrintedProgressLen) {
                      for (let i = lastPrintedProgressLen; i < progressLines.length; i++) {
                        logSerial(progressLines[i]);
                      }
                      lastPrintedProgressLen = progressLines.length;
                    }

                    if (statusRes.status === 'success') {
                      if (!statusRes.binary_content) {
                        throw new Error('Compilation succeeded but no binary content was returned.');
                      }
                      compiled = {
                        hex: statusRes.binary_content,
                        stdout: statusRes.stdout || '',
                        stderr: statusRes.stderr || ''
                      };
                      break;
                    } else if (statusRes.status === 'failed') {
                      const errMsg = statusRes.error || 'ESP32 compilation failed.';
                      throw new Error(errMsg);
                    }

                    pollCount++;
                    if (pollCount > 180) {
                      throw new Error('ESP32 compilation timed out after 90 seconds.');
                    }
                  }
                } else {
                  compiled = await compileCode({
                    code: compileSource,
                    files: compileUnit.files,
                    sketchName: compileUnit.sketchName,
                    fqbn: targetFqbn,
                    target: kind,
                    libraries_txt: librariesTxt,
                  });
                }
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
