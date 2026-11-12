import {
  normalizeBoardKind,
  createDefaultMainCode,
} from "./hardwareUtils";
import { getDefaultMainFileName } from "../projectUtils";

/**
 * Open-code-file domain, extracted verbatim from SimulatorPage.jsx.
 * (handleOpenCode: resolve board file by boardId/filename, fallback to
 *  first code file, create default main when missing, open tab + panel.)
 *
 * Plain function (no hooks). File creation preserves kind/boardId/
 * dirty:false shape verbatim. Verify via board open-code Playwright check.
 */
export function handleOpenCodeAction(args) {
  const {
    comp,
    projectFiles,
    setProjectFiles,
    openCodeTabs,
    setOpenCodeTabs,
    setActiveCodeFileId,
    setCodeTab,
    setIsPanelOpen,
    setShowCodeExplorer,
  } = args;
        console.log(
          "[handleOpenCode] Triggered for component:",
          comp.id,
          comp.type,
        );
        const boardKind = normalizeBoardKind(comp.type);
        const filename = getDefaultMainFileName(boardKind, comp.id, {
          rp2040Mode: comp.attrs?.env || "native",
        });

        // Try to find existing file by boardId or filename or just the first code file
        let targetFile = projectFiles.find(
          (f) => f.boardId === comp.id || f.id === filename || f.name === filename,
        );
        if (!targetFile) {
          // Fallback: if there's only one code file, just use it
          const codeFiles = projectFiles.filter(
            (f) => f.kind === "code" || /\.(ino|py|c|cpp)$/i.test(f.name),
          );
          if (codeFiles.length > 0) {
            targetFile = codeFiles[0];
            console.log(
              "[handleOpenCode] Fallback to first code file:",
              targetFile.id,
            );
          } else {
            console.log(
              "[handleOpenCode] File not found, creating new file:",
              filename,
            );
            // Create the file
            targetFile = {
              id: filename,
              path: filename,
              name: filename,
              kind: "code",
              boardId: comp.id,
              boardKind: boardKind,
              content: createDefaultMainCode(boardKind, comp.id, {
                rp2040Mode: comp.attrs?.env || "native",
              }),
              dirty: false,
            };
            setProjectFiles((prev) => [...prev, targetFile]);
          }
        } else {
          console.log("[handleOpenCode] Found existing file:", targetFile.id);
        }

        if (!openCodeTabs.includes(targetFile.id)) {
          setOpenCodeTabs((prev) => [...prev, targetFile.id]);
        }
        setActiveCodeFileId(targetFile.id);
        setCodeTab("code");
        setIsPanelOpen(true);
        setShowCodeExplorer(true);

}
