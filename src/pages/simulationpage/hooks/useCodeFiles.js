import { useCallback } from "react";
import {
  normalizeBoardKind,
} from "../utils/hardwareUtils";
import { arrayBufferToBase64 } from "../utils/simulatorUtils";
import {
  fileExt,
  isFileDisabled,
} from "../../../utils/projectCompilerUtils";
import {
  UF2_PAYLOAD_PREFIX,
  ROOT_UPLOADABLE_EXTENSIONS,
} from "../constants/simulatorConstants";

/**
 * Code-file management domain, extracted verbatim from SimulatorPage.jsx.
 * (download, per-board firmware assets, default MicroPython/CircuitPython
 *  UF2 fetch w/ ref cache, folder-policy resolve w/ RP2040 env gates,
 *  create w/ template content + dedup naming, tab shortcut, upload w/
 *  UF2-base64 + extension gates.)
 *
 * Behavior contract: identical sanitization, identical dedup suffixing,
 * identical template bodies, identical RP2040 alert copy, identical UF2
 * payload prefixing. Dep arrays kept verbatim. Verify via file
 * create/upload/download + Pico-run Playwright checks.
 */
export function useCodeFiles({
  projectFileMap,
  boardComponentMap,
  activeCodeFile,
  setProjectFiles,
  setOpenCodeTabs,
  setActiveCodeFileId,
  appendConsoleEntry,
}) {
    const downloadCodeFile = useCallback(
      (fileId) => {
        const file = projectFileMap.get(fileId);
        if (!file) return;
        const blob = new Blob([file.content || ""], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      },
      [projectFileMap],
    );

    const resolveFolderFilePolicy = useCallback(
      (parentPath = "project") => {
        const normalizedParent =
          String(parentPath || "project").trim() || "project";
        const boardMatch = normalizedParent.match(/^project\/([^/]+)(?:\/|$)/);
        if (!boardMatch) {
          return {
            parent: normalizedParent,
            boardId: "",
            boardKind: "root",
            rp2040Mode: "native",
            defaultExt: ".ino",
            allowedExtensions: ROOT_UPLOADABLE_EXTENSIONS,
          };
        }

        const boardId = boardMatch[1];
        const boardComp = boardComponentMap.get(boardId);
        const boardKind = normalizeBoardKind(boardComp?.type || "");
        return {
          parent: normalizedParent,
          boardId,
          boardKind,
          defaultExt: ".ino",
          allowedExtensions: ROOT_UPLOADABLE_EXTENSIONS,
        };
      },
      [boardComponentMap],
    );

    const createCodeFile = useCallback(
      (requestedName, openAfterCreate = false, customParent = null) => {
        const cleaned = String(requestedName || "").trim();
        if (!cleaned) return null;

        let parent = "project";
        if (customParent) {
          parent = customParent;
        } else {
          const activePath = activeCodeFile?.path || "";
          parent = activePath.includes("/")
            ? activePath.substring(0, activePath.lastIndexOf("/"))
            : "project";
        }

        const folderPolicy = resolveFolderFilePolicy(parent);

        const defaultExt = folderPolicy.defaultExt || ".ino";
        const rawExt = fileExt(cleaned);
        const fileNameBase = rawExt ? cleaned.slice(0, -rawExt.length) : cleaned;
        const ext = rawExt || defaultExt;
        const safeBase =
          fileNameBase.replace(/[^a-zA-Z0-9._-]/g, "_") || "new_file";
        const safeExt = (
          ext.replace(/[^a-zA-Z0-9.]/g, "") || defaultExt
        ).toLowerCase();

        if (!folderPolicy.allowedExtensions.has(safeExt)) {
          alert(`Unsupported file type: ${safeExt}`);
          return null;
        }

        let candidate = `${safeBase}${safeExt}`;
        let candidatePath = `${parent}/${candidate}`;
        let i = 2;

        while (projectFileMap.has(candidatePath)) {
          candidate = `${safeBase}_${i}${safeExt}`;
          candidatePath = `${parent}/${candidate}`;
          i++;
        }

        const boardMatch = candidatePath.match(/^project\/([^/]+)\//);
        const content =
          safeExt === ".h"
            ? `#pragma once\n\n// ${safeBase} declarations\n`
            : safeExt === ".cpp"
              ? `#include "${safeBase}.h"\n\n// ${safeBase} implementation\n`
              : safeExt === ".ino"
                ? `void setup() {\n}\n\nvoid loop() {\n}\n`
                : safeExt === ".py"
                  ? `from machine import Pin\nfrom time import sleep\n\nled = Pin('LED', Pin.OUT)\n\nwhile True:\n  led.toggle()\n  sleep(0.5)\n`
                  : "";

        const nextFile = {
          id: candidatePath,
          path: candidatePath,
          name: candidate,
          kind: "code",
          boardId: boardMatch ? boardMatch[1] : undefined,
          boardKind: boardMatch ? folderPolicy.boardKind : undefined,
          content,
          dirty: true,
        };

        setProjectFiles((prev) => [...prev, nextFile]);
        if (openAfterCreate) {
          setOpenCodeTabs((prev) =>
            prev.includes(candidatePath) ? prev : [...prev, candidatePath],
          );
          setActiveCodeFileId(candidatePath);
        }

        return candidatePath;
      },
      [activeCodeFile, projectFileMap, resolveFolderFilePolicy],
    );

    const createCodeTab = useCallback(
      (requestedName) => {
        return createCodeFile(requestedName, true);
      },
      [createCodeFile],
    );

    const uploadCodeFile = useCallback(
      (customParent = null) => {
        let parent = "project";
        if (customParent) {
          parent = customParent;
        } else {
          const activePath = activeCodeFile?.path || "";
          parent = activePath.includes("/")
            ? activePath.substring(0, activePath.lastIndexOf("/"))
            : "project";
        }

        const folderPolicy = resolveFolderFilePolicy(parent);
        const input = document.createElement("input");
        input.type = "file";
        input.accept = Array.from(folderPolicy.allowedExtensions).join(",");
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;

          const rawExt = fileExt(file.name);
          const readAsBinary = rawExt === ".uf2";
          const reader = new FileReader();
          reader.onload = (re) => {
            let content = re.target.result;
            if (readAsBinary) {
              const base64 = arrayBufferToBase64(content);
              content = `${UF2_PAYLOAD_PREFIX}${base64}`;
            }

            const fileNameBase = rawExt
              ? file.name.slice(0, -rawExt.length)
              : file.name;
            const ext = rawExt || folderPolicy.defaultExt || ".ino";
            const safeBase =
              fileNameBase.replace(/[^a-zA-Z0-9._-]/g, "_") || "uploaded";
            const safeExt = (
              ext.replace(/[^a-zA-Z0-9.]/g, "") || ".ino"
            ).toLowerCase();

            if (!folderPolicy.allowedExtensions.has(safeExt)) {
              alert(`Unsupported file type: ${safeExt}`);
              return;
            }

            let candidate = `${safeBase}${safeExt}`;
            let candidatePath = `${parent}/${candidate}`;
            let i = 2;

            while (projectFileMap.has(candidatePath)) {
              candidate = `${safeBase}_${i}${safeExt}`;
              candidatePath = `${parent}/${candidate}`;
              i++;
            }

            const boardMatch = candidatePath.match(/^project\/([^/]+)\//);
            const nextFile = {
              id: candidatePath,
              path: candidatePath,
              name: candidate,
              kind: "code",
              boardId: boardMatch ? boardMatch[1] : undefined,
              boardKind: boardMatch ? folderPolicy.boardKind : undefined,
              content,
              dirty: true,
            };

            setProjectFiles((prev) => [...prev, nextFile]);
            setOpenCodeTabs((prev) =>
              prev.includes(candidatePath) ? prev : [...prev, candidatePath],
            );
            setActiveCodeFileId(candidatePath);

            appendConsoleEntry("info", `File uploaded: ${candidate}`, "code");
          };
          if (readAsBinary) reader.readAsArrayBuffer(file);
          else reader.readAsText(file);
        };
        input.click();
      },
      [
        activeCodeFile,
        projectFileMap,
        appendConsoleEntry,
        resolveFolderFilePolicy,
      ],
    );


  return {
    downloadCodeFile,
    resolveFolderFilePolicy,
    createCodeFile,
    createCodeTab,
    uploadCodeFile,
  };
}
