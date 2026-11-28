import { useCallback, useRef } from "react";
import {
  normalizeProjectFiles,
  extractProjectMetaFromPng,
} from "../../../utils/projectCompilerUtils";
import {
  normalizeImportedCircuitData,
  getDefaultMainFileName,
  normalizeOpenCodeTabs,
} from "../projectUtils";
import {
  normalizeBoardKind,
  createDefaultMainCode,
  resolveComponentAttrString,
} from "../utils/hardwareUtils";
import { syncWireIds } from "../utils/powerRails";

/**
 * Project-import domain, extracted verbatim from SimulatorPage.jsx.
 *
 * Owns: applyImportedProjectMeta (PNG/JSON/demo/guided entry) + importPng
 * (file-reader dispatch). Behavior contract: confirm-gate on non-empty
 * canvas, saveHistory() checkpoint BEFORE replace, board/files/code sync,
 * captureThumbnail scheduling left to callers (unchanged).
 *
 * @param {object} args - all state values + setters used by the import flow
 *   (plus appendConsoleEntry for the confirmation line).
 */
export function useProjectImport({
  components,
  wires,
  isRunning,
  isCompiling,
  saveHistory,
  setBoard,
  setCode,
  setBlocklyXml,
  setBlocklyGeneratedCode,
  setUseBlocklyCode,
  setComponents,
  setWires,
  setProjectFiles,
  setOpenCodeTabs,
  setActiveCodeFileId,
  openCodeFile,
  setCurrentProjectId,
  currentProjectIdRef,
  setCurrentProjectName,
  setHistory,
  setShowProjectsSidebar,
  setSelected,
  setWireStart,
  wireStartRef,
  captureThumbnailRef,
  lastCompiledRef,
  canvasOnly,
  appendConsoleEntry,
}) {
  const importFileRef = useRef(null);

  const applyImportedProjectMeta = useCallback(
    (meta, sourceLabel = "Import") => {
      const importedComponents = Array.isArray(meta?.components) ? meta.components : [];
      const importedConnections = Array.isArray(meta?.connections)
        ? meta.connections
        : Array.isArray(meta?.wires)
          ? meta.wires
          : [];
      const { components: normalizedComponents, wires: normalizedConnections } =
        normalizeImportedCircuitData(importedComponents, importedConnections);

      const hasExisting = components.length > 0 || wires.length > 0;
      if (
        hasExisting &&
        !window.confirm(
          `Import will replace your current circuit (${components.length} components, ${wires.length} wires). Continue?`,
        )
      ) {
        return;
      }

      saveHistory();
      if (meta?.board) setBoard(meta.board);
      if (Object.prototype.hasOwnProperty.call(meta || {}, "code"))
        setCode(String(meta.code || ""));
      if (Object.prototype.hasOwnProperty.call(meta || {}, "blocklyXml"))
        setBlocklyXml(String(meta.blocklyXml || ""));
      if (Object.prototype.hasOwnProperty.call(meta || {}, "blocklyGeneratedCode"))
        setBlocklyGeneratedCode(String(meta.blocklyGeneratedCode || ""));
      if (Object.prototype.hasOwnProperty.call(meta || {}, "useBlocklyCode"))
        setUseBlocklyCode(!!meta.useBlocklyCode);

      setComponents(normalizedComponents);
      setWires(normalizedConnections);

      const importedBoards = normalizedComponents.filter((c) =>
        /(arduino|rp2040|pico|esp32|stm32|8086|8088|8085|8051|mcs-51|6502|z80|rv32|risc|retro)/i.test(c.type),
      );
      let normalizedFiles = normalizeProjectFiles(
        Array.isArray(meta?.projectFiles) ? meta.projectFiles : [],
      );

      // Backward compatibility: older exports stored only top-level `code`.
      if (normalizedFiles.length === 0 && typeof meta?.code === "string" && meta.code.trim()) {
        if (importedBoards.length > 0) {
          normalizedFiles = importedBoards.map((bc, idx) => {
            const boardKind = normalizeBoardKind(bc.type);
            const fileName = getDefaultMainFileName(boardKind, bc.id, {});
            const path = `project/${bc.id}/${fileName}`;
            return {
              id: path,
              path,
              name: fileName,
              kind: "code",
              boardId: bc.id,
              boardKind,
              content:
                idx === 0
                  ? meta.code
                  : createDefaultMainCode(boardKind, bc.id, {}),
              dirty: false,
            };
          });
        }
      }

      if (
        normalizedFiles.length > 0 &&
        typeof meta?.code === "string" &&
        meta.code.trim()
      ) {
        const codeFileIdx = normalizedFiles.findIndex(
          (f) =>
            f.kind === "code" ||
            /\.(ino|h|hpp|c|cpp|py)$/i.test(f.name || f.path || ""),
        );
        const hasCodeContent = normalizedFiles.some((f) => {
          if (
            !(
              f.kind === "code" ||
              /\.(ino|h|hpp|c|cpp|py)$/i.test(f.name || f.path || "")
            )
          )
            return false;
          return String(f.content || "").trim().length > 0;
        });
        if (!hasCodeContent && codeFileIdx >= 0) {
          const target = normalizedFiles[codeFileIdx];
          normalizedFiles[codeFileIdx] = { ...target, content: meta.code };
        }
      }

      normalizedFiles = normalizeProjectFiles(normalizedFiles);
      const normalizedTabs = normalizeOpenCodeTabs(
        Array.isArray(meta?.openCodeTabs) ? meta.openCodeTabs : [],
        normalizedFiles,
      );
      const preferredActive =
        typeof meta?.activeCodeFileId === "string"
          ? meta.activeCodeFileId.trim()
          : "";
      const activeId = normalizedFiles.some((f) => f.id === preferredActive && f.id !== "project/diagram.json")
        ? preferredActive
        : normalizedTabs.find((t) => t !== "project/diagram.json") ||
          normalizedFiles.find((f) => f.id !== "project/diagram.json")?.id ||
          "";
      setProjectFiles(normalizedFiles);
      setOpenCodeTabs(normalizedTabs);
      setActiveCodeFileId(activeId);

      if (meta?.id) {
        currentProjectIdRef.current = meta.id;
        setCurrentProjectId(meta.id);
      }
      if (meta?.name) setCurrentProjectName(meta.name);
      syncWireIds(normalizedComponents, normalizedConnections);
      setSelected(null);
      if (wireStartRef) wireStartRef.current = null;
      setWireStart(null);
      setHistory({ past: [], future: [] });
      if (lastCompiledRef) lastCompiledRef.current = null;
      setShowProjectsSidebar(false);
      if (canvasOnly && typeof window !== "undefined") {
        window.parent?.postMessage({ type: "circuit-ready" }, "*");
      }
      appendConsoleEntry(
        "info",
        `${sourceLabel} imported: ${normalizedComponents.length} components, ${normalizedConnections.length} connections.`,
        "simulator",
      );
      setTimeout(() => captureThumbnailRef.current?.(), 1500);
    },
    [
      components,
      wires,
      saveHistory,
      setBoard,
      setCode,
      setBlocklyXml,
      setBlocklyGeneratedCode,
      setUseBlocklyCode,
      setComponents,
      setWires,
      setProjectFiles,
      setOpenCodeTabs,
      setActiveCodeFileId,
      openCodeFile,
      setCurrentProjectId,
      currentProjectIdRef,
      setCurrentProjectName,
      setHistory,
      setShowProjectsSidebar,
      setSelected,
      setWireStart,
      wireStartRef,
      captureThumbnailRef,
      lastCompiledRef,
      canvasOnly,
    ],
  );

  const importPng = useCallback(
    (file) => {
      if (!file) return;
      if (isRunning || isCompiling) {
        alert("Stop the current simulation before importing a project file.");
        if (importFileRef.current) importFileRef.current.value = "";
        return;
      }

      const fileName = String(file.name || "").toLowerCase();
      const isPng = fileName.endsWith(".png");
      const isJson = fileName.endsWith(".json");

      if (!isPng && !isJson) {
        alert("Please select an OpenHW-Studio PNG or JSON file.");
        if (importFileRef.current) importFileRef.current.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          let meta = null;
          if (isPng) {
            const buf = ev.target.result;
            meta = extractProjectMetaFromPng(buf);
          } else {
            meta = JSON.parse(ev.target.result);
          }
          if (!meta) throw new Error("No project data found in file.");
          applyImportedProjectMeta(meta, isPng ? "PNG project" : "JSON project");
        } catch (err) {
          const sourceLabel = isPng ? "PNG" : "JSON";
          console.error(`[${sourceLabel} Import] Parse error:`, err);
          alert(`Failed to parse circuit data from ${sourceLabel}: ${err.message}`);
        } finally {
          if (importFileRef.current) importFileRef.current.value = "";
        }
      };

      if (isPng) reader.readAsArrayBuffer(file);
      else reader.readAsText(file);
    },
    [isRunning, isCompiling, applyImportedProjectMeta],
  );

  return { importFileRef, applyImportedProjectMeta, importPng };
}
