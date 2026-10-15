import {
  normalizeRp2040Env,
  resolveRp2040SourceMode,
  getRp2040PythonEntryFileName,
  looksLikeMicroPythonSource,
  arduinoBlinkToMicroPython,
  arduinoSerialToMicroPython,
  prepareRp2040SketchForSimulation,
  createDefaultMainCode,
  applyRp2040MicroPythonCompat,
  resolveComponentAttrString,
  boardCompToDisplayName,
} from "./hardwareUtils";
import { fileExt } from "../../../utils/projectCompilerUtils";
import { toBoardRelativePath } from "../projectUtils";
import { getCachedHex, setCachedHex } from "../../../services/offlineCache.js";
import { compileCode } from "../../../services/simulatorService.js";

/**
 * RP2040 per-board compile domain, extracted verbatim from SimulatorPage.jsx
 * handleRun > per-board loop > `if (kind === "rp2040")` branch.
 * (env/mode resolution, python-path UF2 + flash files, native compile w/
 *  arduino-pico core-missing gate, shared-cache read/write.)
 *
 * Returns { disposition: "continue", result } — the branch ALWAYS continues
 * the board loop, so the caller must `continue` after applying mutations.
 * Mutations flow through ctx maps (boardHexMap/.../boardsWithout...).
 * `result` passthrough preserves first-firmware-wins semantics.
 * Verify via Pico native + MicroPython + CircuitPython run checks.
 */
export async function compileRp2040Board(args, ctx) {
  const {
    boardComp,
    kind,
    targetFqbn,
    compileUnit,
    compileSource,
    activePrefersIno,
    activePrefersPy,
    hasPythonSource,
    pythonSource,
    firmwareAssets,
    boardEnabledFiles,
    projectFiles,
    activeCodeFileId,
    code,
  } = args;
  const {
    boardHexMap,
    boardPythonMap,
    boardPythonFilesMap,
    boardRuntimeEnvMap,
    boardsWithoutCompilableSketch,
    appendConsoleEntry,
    logSerial,
    logCompileSummary,
    registerGdbArtifact,
    fetchDefaultCircuitPythonUf2Payload,
    fetchDefaultMicroPythonUf2Payload,
  } = ctx;
  let { result } = ctx;
            if (kind === "rp2040") {
              const configuredEnv = normalizeRp2040Env(
                resolveComponentAttrString(boardComp?.attrs, "env", "native"),
              );
              boardRuntimeEnvMap[boardComp.id] = configuredEnv;

              const configuredMode =
                configuredEnv === "native" ? "ino" : configuredEnv;
              const configuredBuilder =
                resolveComponentAttrString(
                  boardComp?.attrs,
                  "builder",
                  "arduino-pico",
                ) || "arduino-pico";
              const hasNativeSketch =
                compileUnit.hasMainFile ||
                (activePrefersIno && !!compileSource.trim());
              const hasExplicitPython = activePrefersPy || hasPythonSource;
              const prefersNativeFromSyntax =
                /\bvoid\s+setup\s*\(|\bvoid\s+loop\s*\(|#include\s*</.test(
                  String(compileSource || ""),
                );
              const selectedSourceMode = resolveRp2040SourceMode({
                configuredMode,
                activePrefersIno,
                activePrefersPy,
                hasNativeSketch,
                hasPythonSource: hasExplicitPython,
                prefersNativeFromSyntax,
              });
              const useMicroPythonPath = selectedSourceMode === "py";
              const useCircuitPythonPath = selectedSourceMode === "cp";
              const usePythonPath = useMicroPythonPath || useCircuitPythonPath;

              if (selectedSourceMode === "ino" && !hasNativeSketch) {
                const msg = `RP2040 source mode is set to .ino for ${boardComp.id}, but no enabled .ino sketch was found.`;
                appendConsoleEntry("warn", msg, "simulator");
                logSerial(msg, "var(--orange)");
                boardsWithoutCompilableSketch.push(boardComp.id);
                return { disposition: "continue", result };
              }

              if (usePythonPath) {
                const runtimeEnv = useCircuitPythonPath
                  ? "circuitpython"
                  : "micropython";
                const entryFileName = getRp2040PythonEntryFileName(runtimeEnv);
                const firmwareEntryPy =
                  runtimeEnv === "circuitpython"
                    ? (firmwareAssets.pythonFiles || []).find(
                      (f) => String(f.name || "").toLowerCase() === "code.py",
                    )
                    : firmwareAssets.mainPy;

                let pyToRun =
                  String(firmwareEntryPy?.content || "").trim() ||
                  pythonSource.trim();
                if (!pyToRun && looksLikeMicroPythonSource(compileSource)) {
                  pyToRun = compileSource;
                }
                if (!pyToRun && runtimeEnv === "micropython") {
                  pyToRun = arduinoSerialToMicroPython(
                    compileSource,
                    boardComp.id,
                  );
                }
                if (!pyToRun && runtimeEnv === "micropython") {
                  pyToRun = arduinoBlinkToMicroPython(
                    compileSource,
                    boardComp.id,
                  );
                }
                if (!pyToRun) {
                  pyToRun = createDefaultMainCode("rp2040", boardComp.id, {
                    rp2040Mode: runtimeEnv,
                  });
                }

                if (runtimeEnv === "micropython") {
                  pyToRun = applyRp2040MicroPythonCompat(pyToRun);
                }

                const runtimeFiles = {};
                boardEnabledFiles.forEach((fileObj) => {
                  const ext = fileExt(fileObj.path);
                  if (!ext) return;
                  if (ext === ".uf2") return;
                  if (ARDUINO_CODE_EXTENSIONS.has(ext)) return;

                  const relPath = toBoardRelativePath(boardComp.id, fileObj.path);
                  if (!relPath) return;

                  const fileContent =
                    fileObj.id === activeCodeFileId
                      ? String(code || "")
                      : String(fileObj.content || "");
                  runtimeFiles[relPath] = fileContent;
                });

                if (!String(runtimeFiles[entryFileName] || "").trim()) {
                  runtimeFiles[entryFileName] = pyToRun;
                }

                const rp2040Firmware =
                  firmwareAssets.uf2Payload ||
                  (runtimeEnv === "circuitpython"
                    ? await fetchDefaultCircuitPythonUf2Payload()
                    : await fetchDefaultMicroPythonUf2Payload());
                boardHexMap[boardComp.id] = rp2040Firmware;
                boardPythonMap[boardComp.id] = pyToRun;
                boardPythonFilesMap[boardComp.id] = runtimeFiles;

                const runtimeLabel =
                  runtimeEnv === "circuitpython"
                    ? "CircuitPython"
                    : "MicroPython";
                appendConsoleEntry(
                  "info",
                  `RP2040 running via rp2040js + ${runtimeLabel} flash filesystem on ${boardComp.id} (env: ${configuredEnv}).`,
                  "simulator",
                );
                if (!result) result = { hex: rp2040Firmware || "" };
                return { disposition: "continue", result };
              }

              const nativeCompileSource =
                prepareRp2040SketchForSimulation(compileSource);
              if (nativeCompileSource !== compileSource) {
                appendConsoleEntry(
                  "info",
                  `RP2040: routed Serial output to UART0 monitor for ${boardComp.id}.`,
                  "simulator",
                );
              }

              const libFile = (projectFiles || []).find(f => f.path === `project/${boardComp.id}/library.txt`);
              const librariesTxt = libFile
                ? (libFile.id === activeCodeFileId ? code : (libFile.content || ''))
                : '';

              const cacheKeyBoard = `${kind}:${boardComp.id}`;
              const builder = configuredBuilder;
              const cacheSource = [
                RP2040_SIM_PROTOCOL_VERSION,
                builder,
                configuredMode,
                targetFqbn,
                nativeCompileSource,
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
                    code: nativeCompileSource,
                    files: compileUnit.files,
                    sketchName: compileUnit.sketchName,
                    fqbn: targetFqbn,
                    target: kind,
                    builder,
                    libraries_txt: librariesTxt,
                  });
                  setCachedHex(cacheSource, cacheKeyBoard, compiled);
                } catch (compileErr) {
                  const errStr = String(
                    compileErr?.message || compileErr || "",
                  ).toLowerCase();
                  const isRpCoreMissing =
                    errStr.includes("platform 'rp2040:rp2040' not found") ||
                    errStr.includes("platform rp2040:rp2040 is not found") ||
                    errStr.includes("platform not installed");
                  if (isRpCoreMissing) {
                    appendConsoleEntry(
                      "error",
                      `RP2040 core is not installed for ${boardComp.id}. Native .ino mode cannot run without Arduino-Pico core.`,
                      "simulator",
                    );
                  }
                  throw compileErr;
                }
              }

              boardHexMap[boardComp.id] = compiled.hex;
              logCompileSummary(compiled, boardComp, kind);
              registerGdbArtifact(boardComp.id, kind, compiled);
              appendConsoleEntry(
                "info",
                `RP2040 native firmware compiled and running on ${boardComp.id}.`,
                "simulator",
              );
              if (!result) result = compiled;
              return { disposition: "continue", result };
            }

  return { disposition: "continue", result };
}
