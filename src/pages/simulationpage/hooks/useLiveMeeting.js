import { useCallback, useEffect } from "react";
import { normalizeProjectFiles } from "../../../utils/projectCompilerUtils";
import {
  normalizeImportedCircuitData,
  normalizeOpenCodeTabs,
} from "../projectUtils";
import { syncWireIds } from "../utils/powerRails";

/**
 * Live-meeting collaboration domain, extracted verbatim from
 * SimulatorPage.jsx.
 * (build/apply meeting snapshots w/ diagram.json-safe active-file pickup,
 *  liveCanEdit/liveEditingDisabled derivation + ref mirrors,
 *  teacher/student edit-access handshake trio.)
 *
 * Behavior contract: identical 60ms remote-apply window, identical
 * student:/teacher: message shapes, identical readOnly OR-composition.
 * applyLiveMeetingSnapshot keeps its [] deps (all-setter body) verbatim.
 * Verify via live-session sync Playwright check.
 */
export function useLiveMeeting({
  currentProjectName,
  board,
  components,
  wires,
  code,
  projectFiles,
  openCodeTabs,
  activeCodeFileId,
  renameCodeFile,
  setBoard,
  setCode,
  setComponents,
  setWires,
  setProjectFiles,
  setOpenCodeTabs,
  setActiveCodeFileId,
  setCurrentProjectName,
  setCurrentProjectId,
  currentProjectIdRef,
  setHistory,
  lastCompiledRef,
  lastLiveSyncPayloadRef,
  liveApplyingRemoteRef,
  liveSyncTimerRef,
  liveMeetingMode,
  isLiveTeacher,
  liveGrantedEditorIds,
  currentLiveUserId,
  readOnly,
  liveSocketRef,
  setLiveEditRequestPending,
  setLiveMeetingStatus,
  isRunningRef,
  liveEditingDisabledRef,
  isRunning,
}) {
    const buildLiveMeetingSnapshot = useCallback(
      () => ({
        name: currentProjectName || "Live Simulation",
        board,
        components,
        connections: wires,
        code,
        projectFiles,
        openCodeTabs,
        activeCodeFileId,
      }),
      [
        activeCodeFileId,
        board,
        code,
        components,
        currentProjectName,
        openCodeTabs,
        projectFiles,
        wires,
      ],
    );
    const replaceFilePath = useCallback(
      (oldPath, newPath) => {
        const nextName = String(newPath || "")
          .split("/")
          .pop();
        if (nextName) renameCodeFile(oldPath, nextName);
      },
      [renameCodeFile],
    );

    const applyLiveMeetingSnapshot = useCallback((snapshot) => {
      const normalizedSnapshot =
        snapshot && typeof snapshot === "object" ? snapshot : {};
      lastLiveSyncPayloadRef.current = JSON.stringify(normalizedSnapshot);
      const normalizedCircuit = normalizeImportedCircuitData(
        Array.isArray(normalizedSnapshot.components)
          ? normalizedSnapshot.components
          : [],
        Array.isArray(normalizedSnapshot.connections)
          ? normalizedSnapshot.connections
          : [],
      );
      const normalizedFiles = normalizeProjectFiles(
        Array.isArray(normalizedSnapshot.projectFiles)
          ? normalizedSnapshot.projectFiles
          : [],
      );
      const normalizedTabs = normalizeOpenCodeTabs(
        Array.isArray(normalizedSnapshot.openCodeTabs)
          ? normalizedSnapshot.openCodeTabs
          : [],
        normalizedFiles,
      );
      const preferredActive = String(
        normalizedSnapshot.activeCodeFileId || "",
      ).trim();
      const activeId = normalizedFiles.some((file) => file.id === preferredActive && file.id !== "project/diagram.json")
        ? preferredActive
        : normalizedTabs.find((t) => t !== "project/diagram.json") || normalizedFiles.find((f) => f.id !== "project/diagram.json")?.id || "";
      liveApplyingRemoteRef.current = true;
      setBoard(normalizedSnapshot.board || "arduino_uno");
      setCode(normalizedSnapshot.code || "");
      setComponents(normalizedCircuit.components);
      setWires(normalizedCircuit.wires);
      setProjectFiles(normalizedFiles);
      setOpenCodeTabs(normalizedTabs);
      setActiveCodeFileId(activeId);
      setCurrentProjectName(normalizedSnapshot.name || "Live Simulation");
      currentProjectIdRef.current = null;
      setCurrentProjectId(null);
      setHistory({ past: [], future: [] });
      lastCompiledRef.current = null;
      syncWireIds(normalizedCircuit.components, normalizedCircuit.wires);
      window.clearTimeout(liveSyncTimerRef.current);
      liveSyncTimerRef.current = window.setTimeout(() => {
        liveApplyingRemoteRef.current = false;
      }, 60);
    }, []);
    const liveCanEdit =
      !liveMeetingMode ||
      isLiveTeacher ||
      liveGrantedEditorIds.includes(currentLiveUserId);
    const liveEditingDisabled = (liveMeetingMode && !liveCanEdit) || readOnly;
    // Keep stable-callback mirrors current (refs declared near top to avoid TDZ).
    useEffect(() => {
      isRunningRef.current = isRunning;
    }, [isRunning]);
    useEffect(() => {
      liveEditingDisabledRef.current = liveEditingDisabled;
    }, [liveEditingDisabled]);
    const handleRequestLiveEditAccess = useCallback(() => {
      if (!liveMeetingMode || isLiveTeacher || liveCanEdit) return;
      if (
        !liveSocketRef.current ||
        liveSocketRef.current.readyState !== WebSocket.OPEN
      )
        return;
      liveSocketRef.current.send(
        JSON.stringify({ type: "student:request-edit" }),
      );
      setLiveEditRequestPending(true);
      setLiveMeetingStatus("Edit request sent");
    }, [isLiveTeacher, liveCanEdit, liveMeetingMode]);

    const handleRespondToLiveEditRequest = useCallback(
      (requestUserId, decision) => {
        if (!isLiveTeacher) return;
        if (
          !liveSocketRef.current ||
          liveSocketRef.current.readyState !== WebSocket.OPEN
        )
          return;
        liveSocketRef.current.send(
          JSON.stringify({
            type: "teacher:set-student-edit-access",
            userId: requestUserId,
            decision,
          }),
        );
      },
      [isLiveTeacher],
    );

    const handleEndLiveEditAccess = useCallback(() => {
      if (!liveCanEdit || isLiveTeacher) return;
      if (
        !liveSocketRef.current ||
        liveSocketRef.current.readyState !== WebSocket.OPEN
      )
        return;
      liveSocketRef.current.send(
        JSON.stringify({ type: "student:end-edit-access" }),
      );
      setLiveMeetingStatus("Edit access ended");
    }, [isLiveTeacher, liveCanEdit]);


  return {
    buildLiveMeetingSnapshot,
    replaceFilePath,
    applyLiveMeetingSnapshot,
    liveCanEdit,
    liveEditingDisabled,
    handleRequestLiveEditAccess,
    handleRespondToLiveEditRequest,
    handleEndLiveEditAccess,
  };
}
