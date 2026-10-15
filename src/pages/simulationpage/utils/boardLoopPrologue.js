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
 *  first-firmware-wins, active-file/compile-unit resolution, no-sketch
 *  guard.)
 *
 * Returns { disposition, kind, targetFqbn, activeFileExt,
 * activeBoardFile, activeFileTargetsBoard, boardEnabledFiles, compileUnit,
 * compileSource, result } — disposition is "continue" when the board is
 * fully handled (caller must `continue`), else "fallthrough".
 * `result` passthrough preserves first-firmware-wins. The baud write and
 * the no-sketch push flow through ctx maps. Verify via uploaded-firmware
 * + missing-sketch run checks.
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
    normalizeFirmwareFileName,
    appendConsoleEntry,
  } = ctx;
  let { result } = ctx;
  const kind = normalizeBoardKind(boardComp.type);
  const targetFqbn = resolveBoardFqbnForComponent(boardComp, kind);
  const defaultBaud = Number(
    BOARD_DEFAULT_BAUD[kind] || BOARD_DEFAULT_BAUD.arduino_uno,
  );
  boardBaudMap[boardComp.id] = Number(
    boardBaudRates[boardComp.id] || selectedRunBaud,
  );
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

            const activeFilePath = String(activeCodeFile?.path || "");
            const activeFileExt = fileExt(activeFilePath);
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
            const boardEnabledFiles = projectFiles
              .filter((f) => f.path.startsWith(`project/${boardComp.id}/`))
              .filter((f) => !isFileDisabled(f.path));
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
            // MicroPython path: a board whose env attr is micropython (or
            // whose sketch is a main.py) skips arduino compile entirely. The
            // runner boots the bundled MP image and injects the script over
            // the REPL. boardHexMap carries a sentinel the runner detects.
            const boardEnv = String(
              resolveComponentAttrString(boardComp?.attrs, 'env', 'arduino'),
            ).toLowerCase();
            const hasMainPy = boardEnabledFiles.some(
              (f) => fileExt(f.path) === '.py' && String(f.content || '').trim(),
            );
            const mainPyFile = boardEnabledFiles.find(
              (f) => /(^|\/)main\.py$/i.test(f.path) && String(f.content || '').trim(),
            ) || boardEnabledFiles.find(
              (f) => fileExt(f.path) === '.py' && String(f.content || '').trim(),
            );
            const wantsMicroPython = boardEnv.includes('micropython') || boardEnv === 'py' || (!!mainPyFile && !compileUnit.hasMainFile);
            if (wantsMicroPython && mainPyFile) {
              const pyScript = String(mainPyFile.content || '');
              boardHexMap[boardComp.id] = `PYSCRIPT:${pyScript}`;
              appendConsoleEntry(
                'info',
                `Using MicroPython script (${mainPyFile.name || 'main.py'}) for ${boardCompToDisplayName(boardComp, kind)} — no compile needed.`,
                'simulator',
              );
              if (!result) {
                result = { hex: boardHexMap[boardComp.id], artifactName: mainPyFile.name || 'main.py', micropython: true };
              }
              return { disposition: 'continue', result };
            }

            const compileSource = useBlocklyCode
              ? blocklyGeneratedCode
              : compileUnit.mainCode ||
                getBoardMainCode(boardComp.id) ||
                String(code || "");

            if (!compileUnit.hasMainFile) {
              boardsWithoutCompilableSketch.push(boardComp.id);
              return { disposition: "continue", result };
            }

  return {
    disposition: "fallthrough",
    kind,
    targetFqbn,
    activeFileExt,
    activeBoardFile,
    activeFileTargetsBoard,
    boardEnabledFiles,
    compileUnit,
    compileSource,
    result,
  };
}
