import { useCallback } from "react";
import JSZip from "jszip";
import {
  saveProject,
  deleteProject,
  renameProject,
  generateProjectId,
} from "../../../services/projectStore.js";
import { normalizeProjectFiles } from "../../../utils/projectCompilerUtils";
import {
  buildProjectPayload,
  normalizeImportedCircuitData,
  normalizeOpenCodeTabs,
} from "../projectUtils";
import { syncWireIds } from "../utils/powerRails";
import { importWokwiProjectZip } from "../wokwiImportUtils";

/**
 * Project persistence domain, extracted verbatim from SimulatorPage.jsx.
 * (save dialog open/commit, new/load/delete, inline rename, favourites,
 *  copy, workflow backup/restore zip, Wokwi zip import.)
 *
 * Behavior contract: identical confirm gates, identical diagram.json
 * stripping, identical active-file fallback (never diagram.json),
 * identical 1500ms thumbnail scheduling, identical wire-id sync.
 * Verify via save/load + backup/restore + Wokwi-import Playwright checks.
 */
export function useProjectPersistence({
  saveDialogName,
  setSaveDialogName,
  setShowSaveDialog,
  currentProjectNameRef,
  currentProjectIdRef,
  setCurrentProjectId,
  autoSaveTimerRef,
  getOwner,
  board,
  components,
  wires,
  code,
  blocklyXml,
  blocklyGeneratedCode,
  useBlocklyCode,
  projectFiles,
  openCodeTabs,
  activeCodeFileId,
  setCurrentProjectName,
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
  setHistory,
  lastCompiledRef,
  isRunning,
  componentsRef,
  wiresRef,
  renameValue,
  setRenameValue,
  setRenamingProjectId,
  setFavouriteProjectIds,
  setShowProjectsSidebar,
  currentProjectName,
  captureThumbnailRef,
  refreshProjectList,
}) {
    /** Open the save dialog. Pre-fills with the current project name. */
    // Stable identity: passed to memoized TopToolbox + shortcuts hook.
    const handleSave = useCallback(() => {
      setSaveDialogName(currentProjectNameRef.current || "Untitled");
      setShowSaveDialog(true);
    }, []);

    /** Commit the save from the dialog. */
    const handleConfirmSave = async () => {
      const name = saveDialogName.trim() || "Untitled";
      const owner = getOwner();
      let id = currentProjectIdRef.current;
      if (!id) {
        id = generateProjectId();
        currentProjectIdRef.current = id;
        setCurrentProjectId(id);
      }
      clearTimeout(autoSaveTimerRef.current);
      const finalName = await saveProject({
        id,
        name,
        board,
        components,
        connections: wires,
        code,
        blocklyXml,
        blocklyGeneratedCode,
        useBlocklyCode,
        projectFiles,
        openCodeTabs,
        activeCodeFileId,
        owner,
      });
      setCurrentProjectName(finalName || name);
      setShowSaveDialog(false);
      setTimeout(() => captureThumbnailRef.current?.(), 1500);
    };

    /** Create a brand-new blank project. Stable identity for TopToolbox. */
    const handleNewProject = useCallback(() => {
      if (componentsRef.current.length > 0 || wiresRef.current.length > 0) {
        if (
          !window.confirm(
            "Start a new project? Unsaved changes will be auto-saved first.",
          )
        )
          return;
      }
      const id = generateProjectId();
      currentProjectIdRef.current = id;
      setCurrentProjectId(id);
      setCurrentProjectName("Untitled");
      setBoard("arduino_uno");
      setCode(
        "void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(15000);\n  digitalWrite(13, LOW);\n  delay(15000);\n}\n",
      );
      setComponents([]);
      setWires([]);
      setBlocklyXml("");
      setProjectFiles([]);
      setOpenCodeTabs([]);
      setActiveCodeFileId("");
      setHistory({ past: [], future: [] });
      lastCompiledRef.current = null;
      },
      [],
    );

    /** Load a project from the My Projects modal. */
    const handleLoadProject = (proj) => {
      if (isRunning) return;
      const normalizedCircuit = normalizeImportedCircuitData(
        proj.components,
        proj.connections,
      );
      const normalizedFiles = normalizeProjectFiles(proj.projectFiles);
      const normalizedTabs = normalizeOpenCodeTabs(
        proj.openCodeTabs,
        normalizedFiles,
      );
      const preferredActive = String(proj.activeCodeFileId || "").trim();
      const activeId = normalizedFiles.some((f) => f.id === preferredActive && f.id !== "project/diagram.json")
        ? preferredActive
        : normalizedTabs.find((t) => t !== "project/diagram.json") || normalizedFiles.find((f) => f.id !== "project/diagram.json")?.id || "";
      setBoard(proj.board || "arduino_uno");
      setCode(proj.code || "");
      setBlocklyXml(proj.blocklyXml || "");
      setBlocklyGeneratedCode(proj.blocklyGeneratedCode || "");
      setUseBlocklyCode(!!proj.useBlocklyCode);
      setComponents(normalizedCircuit.components);
      setWires(normalizedCircuit.wires);
      setProjectFiles(normalizedFiles);
      setOpenCodeTabs(normalizedTabs);
      setActiveCodeFileId(activeId);
      if (activeId) openCodeFile(activeId);
      syncWireIds(normalizedCircuit.components, normalizedCircuit.wires);
      setCurrentProjectId(proj.id);
      currentProjectIdRef.current = proj.id;
      setCurrentProjectName(proj.name || "Untitled");
      setHistory({ past: [], future: [] });
      lastCompiledRef.current = null;
      setShowProjectsSidebar(false);
      setTimeout(() => captureThumbnailRef.current?.(), 1500);
    };

    /** Delete a project from the My Projects modal. */
    const handleDeleteProject = async (id) => {
      if (!window.confirm("Delete this project? This cannot be undone.")) return;
      await deleteProject(id, getOwner());
      if (currentProjectIdRef.current === id) {
        currentProjectIdRef.current = null;
        setCurrentProjectId(null);
        setCurrentProjectName("Untitled");
      }
      await refreshProjectList();
    };

    // ─── Inline Rename ─────────────────────────────────────────────────────────
    const handleStartRename = (proj, e) => {
      e.stopPropagation();
      setRenamingProjectId(proj.id);
      setRenameValue(proj.name || "Untitled");
    };
    const handleConfirmRename = async (id) => {
      if (!id) {
        setRenamingProjectId(null);
        return;
      }
      const newName = renameValue.trim() || "Untitled";
      const finalName = await renameProject(id, newName, getOwner());
      if (currentProjectIdRef.current === id)
        setCurrentProjectName(finalName || newName);
      setRenamingProjectId(null);
      await refreshProjectList();
    };

    const toggleFavourite = (id) => {
      setFavouriteProjectIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      );
    };

    const handleCopyProject = async (proj) => {
      const newId = generateProjectId();
      const newName = (proj.name || "Untitled") + " Copy";
      const projectData = {
        ...proj,
        id: newId,
        name: newName,
        savedAt: Date.now(),
      };
      await saveProject(projectData);
      await refreshProjectList();
    };

    // ─── Backup / Restore ──────────────────────────────────────────────────────
    const handleBackupWorkflow = async () => {
      const zip = new JSZip();

      // 1. Generate full project payload (workflow.json)
      const data = buildProjectPayload({
        name: currentProjectName,
        board,
        components,
        wires,
        code,
        blocklyXml,
        blocklyGeneratedCode,
        useBlocklyCode,
        projectFiles,
        openCodeTabs,
        activeCodeFileId,
        exportedAt: new Date().toISOString(),
      });
      zip.file("workflow.json", JSON.stringify(data, null, 2));

      // 2. Generate diagram.json (stripped version of payload)
      const diagramJsonPayload = { ...data };
      delete diagramJsonPayload.schemaVersion;
      delete diagramJsonPayload.projectFiles;
      delete diagramJsonPayload.openCodeTabs;
      delete diagramJsonPayload.activeCodeFileId;
      delete diagramJsonPayload.exportedAt;
      if (diagramJsonPayload.board === "arduino_uno")
        delete diagramJsonPayload.board;
      if (
        !diagramJsonPayload.components ||
        diagramJsonPayload.components.length === 0
      )
        delete diagramJsonPayload.components;
      if (
        !diagramJsonPayload.connections ||
        diagramJsonPayload.connections.length === 0
      )
        delete diagramJsonPayload.connections;
      if (!diagramJsonPayload.blocklyXml) delete diagramJsonPayload.blocklyXml;
      delete diagramJsonPayload.blocklyGeneratedCode;
      if (!diagramJsonPayload.useBlocklyCode)
        delete diagramJsonPayload.useBlocklyCode;
      zip.file("diagram.json", JSON.stringify(diagramJsonPayload, null, 2));

      // 4. Organize files into board-specific folders
      (projectFiles || []).forEach((file) => {
        // file.id is typically "project/<boardId>/<filename>"
        const parts = file.id.split("/");
        if (parts[0] === "project" && parts.length >= 3) {
          const boardId = parts[1];
          const fileName = parts.slice(2).join("/");
          zip.folder(boardId).file(fileName, file.content || "");
        } else if (parts[0] === "project" && parts.length === 2) {
          // Root files that aren't the special ones we just handled
          const fileName = parts[1];
          const reservedNames = ["workflow.json", "diagram.json"];
          if (!reservedNames.includes(fileName)) {
            zip.file(fileName, file.content || "");
          }
        }
      });

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentProjectName || "workflow"}-backup.zip`;
      a.click();
      URL.revokeObjectURL(url);
    };
    const handleRestoreWorkflow = async (file) => {
      if (!file) return;
      try {
        const zip = await JSZip.loadAsync(file);
        const wf = zip.file("workflow.json");
        if (!wf) {
          alert("Invalid backup: workflow.json not found.");
          return;
        }
        const json = JSON.parse(await wf.async("string"));
        if (
          (components.length > 0 || wires.length > 0) &&
          !window.confirm(
            "Restore backup? Current unsaved changes will be replaced.",
          )
        )
          return;
        const normalizedCircuit = normalizeImportedCircuitData(
          json.components,
          Array.isArray(json.connections) ? json.connections : json.wires,
        );
        const normalizedFiles = normalizeProjectFiles(
          Array.isArray(json.projectFiles) ? json.projectFiles : [],
        );
        const normalizedTabs = normalizeOpenCodeTabs(
          Array.isArray(json.openCodeTabs) ? json.openCodeTabs : [],
          normalizedFiles,
        );
        const preferredActive = String(json.activeCodeFileId || "").trim();
        const activeId = normalizedFiles.some((f) => f.id === preferredActive && f.id !== "project/diagram.json")
          ? preferredActive
          : normalizedTabs.find((t) => t !== "project/diagram.json") || normalizedFiles.find((f) => f.id !== "project/diagram.json")?.id || "";
        setBoard(json.board || "arduino_uno");
        setCode(json.code || "");
        setBlocklyXml(json.blocklyXml || "");
        setBlocklyGeneratedCode(json.blocklyGeneratedCode || "");
        setUseBlocklyCode(!!json.useBlocklyCode);
        setComponents(normalizedCircuit.components);
        setWires(normalizedCircuit.wires);
        setProjectFiles(normalizedFiles);
        setOpenCodeTabs(normalizedTabs);
        setActiveCodeFileId(activeId);
        if (activeId) openCodeFile(activeId);
        syncWireIds(normalizedCircuit.components, normalizedCircuit.wires);
        setCurrentProjectName(json.name || "Untitled");
        setHistory({ past: [], future: [] });
        lastCompiledRef.current = null;
      } catch (e) {
        alert("Failed to restore backup: " + e.message);
      }
    };

    const handleImportWokwiZip = async (file) => {
      if (!file) return;
      try {
        const result = await importWokwiProjectZip(file, components, wires);
        if (!result) return;

        const newId = generateProjectId();
        currentProjectIdRef.current = newId;
        setCurrentProjectId(newId);
        setCurrentProjectName(result.projectName);
        setBoard(result.board);
        setComponents(result.components);
        setWires(result.wires);
        setProjectFiles(result.projectFiles);
        setOpenCodeTabs(result.openCodeTabs);
        setActiveCodeFileId(result.activeCodeFileId);
        syncWireIds(result.components, result.wires);
        setHistory({ past: [], future: [] });
        lastCompiledRef.current = null;

        const owner = getOwner();
        const finalName = await saveProject({
          id: newId,
          name: result.projectName,
          board: result.board,
          components: result.components,
          connections: result.wires,
          code: result.code || "",
          blocklyXml: "",
          blocklyGeneratedCode: "",
          useBlocklyCode: false,
          projectFiles: result.projectFiles,
          openCodeTabs: result.openCodeTabs,
          activeCodeFileId: result.activeCodeFileId,
          owner,
        });
        setCurrentProjectName(finalName || result.projectName);
        await refreshProjectList();
      } catch (e) {
        alert(e.message);
      }
    };


  return {
    handleSave,
    handleConfirmSave,
    handleNewProject,
    handleLoadProject,
    handleDeleteProject,
    handleStartRename,
    handleConfirmRename,
    toggleFavourite,
    handleCopyProject,
    handleBackupWorkflow,
    handleRestoreWorkflow,
    handleImportWokwiZip,
  };
}
