import { useEffect } from "react";
import {
  normalizeBoardKind,
  createDefaultMainCode,
  isProgrammableBoardType,
  isBreadboardType,
  isResistorType,
} from "../utils/hardwareUtils";
import { getDefaultMainFileName, mergeCodeSnippet } from "../projectUtils";
import { COMPONENT_REGISTRY } from "../utils/componentRegistry";

/**
 * Auto-code domain, extracted verbatim from SimulatorPage.jsx.
 * (handleAutoCode: board-trace, autowiring-worker snippet, library.txt
 *  merge, file resolve/create + snippet inject; plus the 250ms auto-effect
 *  that codes up to 3 newly-wired components when autoCodingEnabled.)
 *
 * handleAutoCode is a plain async closure (stable per render, same as the
 * original const) — CanvasSceneLayer receives it as onAutoCode. The effect
 * keeps its exact dep array. Worker URL kept verbatim (hook lives in
 * hooks/, so ../../workers/... resolves identically).
 * Verify via autocode + auto-coding-effect Playwright checks.
 */
export function useAutoCode({
  components,
  wires,
  setProjectFiles,
  activeCodeFileId,
  code,
  currentCodeRef,
  setCode,
  setOpenCodeTabs,
  setActiveCodeFileId,
  setCodeTab,
  setIsPanelOpen,
  setShowCodeExplorer,
  autoCodingEnabled,
  isRunning,
  liveEditingDisabled,
  projectFilesRef,
}) {
    const handleAutoCode = async (compId, options = {}) => {
      const { silent = false, openEditor = true } = options;
      console.log("[handleAutoCode] Triggered for component:", compId);
      const comp = components.find((c) => c.id === compId);
      if (!comp) {
        console.error("[handleAutoCode] Component not found in state:", compId);
        return;
      }

      // Find the board it is connected to (Recursive Tracing)
      const findConnectedBoardId = (currentId, visited = new Set()) => {
        if (visited.has(currentId)) return null;
        visited.add(currentId);

        // Check if current is a board
        const comp = components.find((c) => c.id === currentId);
        if (comp && isProgrammableBoardType(comp.type)) return comp.id;

        // Find all neighbors via wires
        for (const w of wires) {
          const fromParts = w.from.split(":");
          const toParts = w.to.split(":");

          let neighborId = null;
          if (fromParts[0] === currentId) neighborId = toParts[0];
          else if (toParts[0] === currentId) neighborId = fromParts[0];

          if (neighborId) {
            const boardId = findConnectedBoardId(neighborId, visited);
            if (boardId) return boardId;
          }
        }
        return null;
      };

      let targetBoardId = findConnectedBoardId(compId);

      if (!targetBoardId) {
        console.warn(
          "[handleAutoCode] No target board found for component:",
          compId,
        );
        if (!silent) alert("Component must be wired to a board first to generate code.");
        return;
      }

      console.log("[handleAutoCode] Target board found:", targetBoardId);
      const manifest = COMPONENT_REGISTRY[comp.type]?.manifest || {};

      // Call the worker
      console.log("[handleAutoCode] Sending request to worker...");
      const worker = new Worker(
        new URL("../../../workers/autowiring.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.postMessage({
        type: "GENERATE_CODE_SNIPPET",
        payload: { compId, wires, manifest, components },
      });

      worker.onmessage = async (e) => {
        const { type, payload } = e.data;
        if (type === "AUTONOMOUS_RESULT") {
          const snippet = payload.code_snippet;
          console.log("[handleAutoCode] Worker returned snippet:", snippet);
          if (snippet) {
            const boardComp = components.find((c) => c.id === targetBoardId);
            const boardKind = normalizeBoardKind(boardComp.type);
            const filename = getDefaultMainFileName(boardKind, targetBoardId, {
              rp2040Mode: boardComp.attrs?.env || "native",
            });

            // Inject libraries if any
            if (payload.libraries && payload.libraries.length > 0) {
              console.log('[handleAutoCode] Libraries required:', payload.libraries);
              const libPath = `project/${targetBoardId}/library.txt`;
              setProjectFiles(prev => {
                const fileObj = prev.find(f => f.id === libPath);
                let currentContent = '';
                if (fileObj) {
                  currentContent = activeCodeFileId === libPath ? code : (fileObj.content || '');
                } else {
                  currentContent = `# Add your libraries here (one per line, e.g. ArduinoJson@6.21.3)\n`;
                }
                const lines = currentContent.split('\n').map(l => l.trim());
                const existingSet = new Set(
                  lines
                    .filter(l => l && !l.startsWith('#'))
                    .map(l => l.split('@')[0].trim().toLowerCase())
                );
                const linesToAdd = [];
                payload.libraries.forEach(lib => {
                  const cleanLib = String(lib).trim();
                  const libNameOnly = cleanLib.split('@')[0].trim().toLowerCase();
                  if (!existingSet.has(libNameOnly)) {
                    linesToAdd.push(cleanLib);
                  }
                });
                if (linesToAdd.length > 0) {
                  const newLines = [...currentContent.split('\n')];
                  linesToAdd.forEach(lib => {
                    if (newLines.length > 0 && newLines[newLines.length - 1].trim() !== '') {
                      newLines.push(lib);
                    } else if (newLines.length > 0 && newLines[newLines.length - 1].trim() === '') {
                      newLines[newLines.length - 1] = lib;
                    } else {
                      newLines.push(lib);
                    }
                  });
                  const nextContent = newLines.join('\n');
                  if (activeCodeFileId === libPath) {
                    setCode(nextContent);
                  }
                  if (fileObj) {
                    return prev.map(f => f.id === libPath ? { ...f, content: nextContent } : f);
                  } else {
                    return [...prev, {
                      id: libPath,
                      path: libPath,
                      name: 'library.txt',
                      kind: 'code',
                      boardId: targetBoardId,
                      boardKind: boardKind,
                      content: nextContent,
                      dirty: true
                    }];
                  }
                }
                return prev;
              });
            }

            let resolvedTargetFileId = filename;
            setProjectFiles((prev) => {
              let nextFiles = prev;
              let targetFile = nextFiles.find(
                (f) =>
                  f.boardId === targetBoardId ||
                  f.id === filename ||
                  f.name === filename,
              );
              if (!targetFile) {
                const codeFiles = nextFiles.filter(
                  (f) => f.kind === "code" || /\.(ino|py|c|cpp)$/i.test(f.name),
                );
                if (codeFiles.length > 0) {
                  targetFile = codeFiles[0];
                } else {
                  console.log(
                    "[handleAutoCode] Creating new file for injection:",
                    filename,
                  );
                  targetFile = {
                    id: filename,
                    path: filename,
                    name: filename,
                    kind: "code",
                    boardId: targetBoardId,
                    boardKind: boardKind,
                    content: createDefaultMainCode(boardKind, targetBoardId, {
                      rp2040Mode: boardComp.attrs?.env || "native",
                    }),
                    dirty: false,
                  };
                  nextFiles = [...nextFiles, targetFile];
                }
              }
              resolvedTargetFileId = targetFile.id;

              console.log(
                "[handleAutoCode] Injecting code into file:",
                targetFile.id,
              );
              return nextFiles.map((f) => {
                if (f.id === targetFile.id) {
                  const currentContent =
                    activeCodeFileId === f.id || activeCodeFileId === f.name
                      ? currentCodeRef.current
                      : f.content;
                  const newContent = mergeCodeSnippet(
                    currentContent,
                    snippet,
                    compId,
                  );
                  // Also update live code if it's the active file
                  if (activeCodeFileId === targetFile.id) {
                    setCode(newContent);
                  }
                  return { ...f, content: newContent, dirty: true };
                }
                return f;
              });
            });

            if (openEditor) {
              setOpenCodeTabs((prevTabs) =>
                prevTabs.includes(resolvedTargetFileId)
                  ? prevTabs
                  : [...prevTabs, resolvedTargetFileId],
              );
              setActiveCodeFileId(resolvedTargetFileId);
              setCodeTab("code");
              setIsPanelOpen(true);
              setShowCodeExplorer(true);
            }
          } else {
            console.warn("[handleAutoCode] Worker returned empty snippet.");
          }
        }
        worker.terminate();
      };
    };
    useEffect(() => {
      if (!autoCodingEnabled || isRunning || liveEditingDisabled) return;

      const hasAutocodeSnippet = (compId) =>
        projectFilesRef.current.some((file) =>
          String(file.content || "").includes(`autocoding for ${compId} start`),
        );

      const touchesBoard = (compId) => {
        const visited = new Set();
        const stack = [compId];
        while (stack.length > 0) {
          const current = stack.pop();
          if (!current || visited.has(current)) continue;
          visited.add(current);
          const comp = components.find((c) => c.id === current);
          if (comp && isProgrammableBoardType(comp.type)) return true;
          for (const wire of wires) {
            const [fromComp] = String(wire.from || "").split(":");
            const [toComp] = String(wire.to || "").split(":");
            if (fromComp === current && !visited.has(toComp)) stack.push(toComp);
            if (toComp === current && !visited.has(fromComp)) stack.push(fromComp);
          }
        }
        return false;
      };

      const timer = window.setTimeout(() => {
        components
          .filter((comp) =>
            !isProgrammableBoardType(comp.type) &&
            !isBreadboardType(comp.type) &&
            !isResistorType(comp.type) &&
            !hasAutocodeSnippet(comp.id) &&
            touchesBoard(comp.id),
          )
          .slice(0, 3)
          .forEach((comp) => {
            handleAutoCode(comp.id, { silent: true, openEditor: false });
          });
      }, 250);

      return () => window.clearTimeout(timer);
    }, [autoCodingEnabled, components, wires, isRunning, liveEditingDisabled]);


  return { handleAutoCode };
}
