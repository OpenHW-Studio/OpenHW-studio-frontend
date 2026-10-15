import {
  normalizeBoardKind,
  boardCompToDisplayName,
  resolveBoardFqbnForComponent,
  resolveComponentAttrString,
} from "./hardwareUtils";
import {
  UF2_PAYLOAD_PREFIX,
  BOARD_DEFAULT_BAUD,
} from "../constants/simulatorConstants";
import {
  fileExt,
  isFileDisabled,
} from "../../../utils/projectCompilerUtils";

/**
 * Per-board loop prologue domain, extracted verbatim from SimulatorPage.jsx
 * handleRun > per-board loop head.
 * (fqbn + baud map, uploaded-firmware shortcut incl. UF2/HEX label +
 *  first-firmware-wins, active-file/python-source/compile-unit resolution,
 *  non-RP2040 no-sketch guard.)
 *
 * Returns { disposition, kind, targetFqbn, firmwareAssets, activeFileExt,
 * activeBoardFile, activeFileTargetsBoard, boardEnabledFiles, pythonSource,
 * hasPythonSource, activePrefersIno, activePrefersPy, compileUnit,
 * compileSource, result } — disposition is "continue" when the board is
 * fully handled (caller must `continue`), else "fallthrough".
 * `result` passthrough preserves first-firmware-wins. The baud write and
 * the no-sketch push flow through ctx maps. Verify via uploaded-firmware
 * + missing-sketch + python-source run checks.
 */
export function resolveBoardLoopPrologue(args, ctx) {
  const {
    boardComp,
    selectedRunBaud,
    singleProgrammableBoardId,
    activeCodeFile,
    code,
    projectFiles,
    useBlocklyCode,
    blocklyGeneratedCode,
  } = args;
  const {
    boardBaudMap,
    boardBaudRates,
    boardHexMap,
    boardsWithoutCompilableSketch,
    getBoardCompileFiles,
    getBoardMainCode,
    getBoardFirmwareAssets,
    normalizeFirmwareFileName,
    appendConsoleEntry,
  } = ctx;
  let { result } = ctx;
            const useUploaded = !!boardComp?.attrs?.useUploadedFirmware;
            const uploadedFirmware = useUploaded
              ? String(
                resolveComponentAttrString(
                  boardComp?.attrs,
                  "firmwareHex",
                  "",
                ) || resolveComponentAttrString(boardComp?.attrs, "hex", ""),
              ).trim()
              : "";

            if (useUploaded && uploadedFirmware) {
              boardHexMap[boardComp.id] = uploadedFirmware;
              const uploadKind = uploadedFirmware.startsWith(UF2_PAYLOAD_PREFIX)
                ? "UF2"
                : "HEX";
              appendConsoleEntry(
                "info",
                `Using uploaded ${uploadKind} firmware for ${boardCompToDisplayName(boardComp, kind)}.`,
                "simulator",
              );
              if (!result) {
                result = {
                  hex: uploadedFirmware,
                  artifactName: normalizeFirmwareFileName(
                    "",
                    boardComp.id,
                    uploadedFirmware,
                  ),
                };
              }
              return { disposition: "continue", result };
            } else if (useUploaded && !uploadedFirmware) {
              appendConsoleEntry(
                "warn",
                `Board ${boardComp.id} is set to use uploaded firmware, but none is assigned. Falling back to code editor.`,
                "simulator",
              );
            }

            const firmwareAssets = getBoardFirmwareAssets(boardComp.id);
            const activeFilePath = String(activeCodeFile?.path || "");
            const activeFileExt = fileExt(activeFilePath);
            const activeFileContent = String(code || "");
            const activeBoardFile = activeFilePath.startsWith(
              `project/${boardComp.id}/`,
            )
              ? activeCodeFile
              : null;
            const activeFileTargetsBoard =
              !!activeBoardFile || singleProgrammableBoardId === boardComp.id;
            const activeBoardExt = activeBoardFile
              ? fileExt(activeBoardFile.path)
              : "";
            const activePythonSource =
              activeFileExt === ".py" &&
                activeFileTargetsBoard &&
                !isFileDisabled(activeFilePath)
                ? activeBoardFile
                  ? String(activeBoardFile.content || "")
                  : activeFileContent
                : "";
            const boardEnabledFiles = projectFiles
              .filter((f) => f.path.startsWith(`project/${boardComp.id}/`))
              .filter((f) => !isFileDisabled(f.path));
            const boardEnabledPyFiles = boardEnabledFiles.filter(
              (f) => fileExt(f.path) === ".py",
            );
            const pythonSource =
              activePythonSource || String(firmwareAssets.mainPy?.content || "");
            const hasPythonSource =
              boardEnabledPyFiles.some((f) => String(f.content || "").trim()) ||
              !!pythonSource.trim();
            const activePrefersIno =
              activeFileExt === ".ino" && activeFileTargetsBoard;
            const activePrefersPy =
              activeFileExt === ".py" && activeFileTargetsBoard;
            const preferredMainPath =
              activeBoardExt === ".ino" &&
                activeBoardFile &&
                !isFileDisabled(activeBoardFile.path)
                ? activeBoardFile.path
                : "";
            const compileUnit = getBoardCompileFiles(
              boardComp.id,
              preferredMainPath,
            );
            const compileSource = useBlocklyCode
              ? blocklyGeneratedCode
              : activeFileExt === ".py" && activeFileTargetsBoard
                ? String(activeCodeFile?.content || "") || String(code || "")
                : compileUnit.mainCode ||
                getBoardMainCode(boardComp.id) ||
                String(code || "");

            if (kind !== "rp2040" && !compileUnit.hasMainFile) {
              boardsWithoutCompilableSketch.push(boardComp.id);
              return { disposition: "continue", result };
            }

  return {
    disposition: "fallthrough",
    kind,
    targetFqbn,
    firmwareAssets,
    activeFileExt,
    activeBoardFile,
    activeFileTargetsBoard,
    boardEnabledFiles,
    pythonSource,
    hasPythonSource,
    activePrefersIno,
    activePrefersPy,
    compileUnit,
    compileSource,
    result,
  };
}
