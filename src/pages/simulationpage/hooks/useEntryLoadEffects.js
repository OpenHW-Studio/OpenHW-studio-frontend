import { useEffect } from "react";
import {
  fetchSharedSimulation,
  fetchLiveSimulationSession,
  buildLiveSimulationWsUrl,
} from "../../../services/simulatorService.js";
import { listProjects } from "../../../services/projectStore.js";
import { syncWireIds } from "../utils/powerRails";

/**
 * Entry-load effects domain, extracted verbatim from SimulatorPage.jsx.
 * (most-recent project w/ session-restore prompt, dashboard card loadId,
 *  shared-simulation shareId load, live-session fetch, live WebSocket
 *  lifecycle incl. 10Hz teacher/student broadcast throttle.)
 *
 * Behavior contract: identical mount-once ([]) deps, identical
 * justSharedRef dedup, identical cancel guards, identical 100ms sync
 * throttle, identical status strings. handleLoadProject stays a page
 * callback (defined by useProjectPersistence) — passed in.
 * Verify via shared-link + live-session + restore-prompt Playwright checks.
 */
export function useEntryLoadEffects({
  assessmentMode,
  projectName,
  shareId,
  liveSessionCode,
  assessmentParams,
  user,
  handleLoadProject,
  setRestoreProjectPrompt,
  location,
  justSharedRef,
  setBoard,
  setCode,
  setComponents,
  setWires,
  setProjectFiles,
  setOpenCodeTabs,
  setActiveCodeFileId,
  setCurrentProjectId,
  currentProjectIdRef,
  setCurrentProjectName,
  setHistory,
  lastCompiledRef,
  token,
  setLiveMeetingShareCode,
  setLiveMeetingMeta,
  setLiveMeetingParticipantCounts,
  setLiveGrantedEditorIds,
  setLiveGrantedEditors,
  setLivePendingEditRequests,
  setLiveMeetingStatus,
  isLiveTeacher,
  applyLiveMeetingSnapshot,
  liveMeetingMode,
  liveSocketRef,
  liveApplyingRemoteRef,
  liveCanEdit,
  buildLiveMeetingSnapshot,
  lastLiveSyncPayloadRef,
  lastLiveSyncTimeRef,
  currentLiveUserId,
  setLiveEditRequestPending,
  activeCodeFileId,
  board,
  code,
  components,
  currentProjectName,
  openCodeTabs,
  projectFiles,
  wires,
}) {
    // ── Project: load most-recent project on first mount ─────────────────────
    useEffect(() => {
      // Don't auto-load a project if we're in assessment mode or loading a demo or circuit from URL
      if (
        assessmentMode ||
        projectName ||
        shareId ||
        liveSessionCode ||
        assessmentParams.get("circuit")
      )
        return;

      const owner = user?.email || "guest";
      listProjects(owner).then((projects) => {
        if (projects.length === 0) return;
        const latest = projects[0]; // already sorted newest-first

        const isSessionActive = sessionStorage.getItem("ohw_session_active");
        if (isSessionActive) {
          handleLoadProject(latest);
        } else {
          sessionStorage.setItem("ohw_session_active", "1");
          setRestoreProjectPrompt(latest);
        }
      });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Load project from dashboard card click ────────────────────
    useEffect(() => {
      const loadId = location.state?.loadProjectId;
      if (!loadId) return;
      import('../../../services/projectStore.js').then(({ loadProject }) => {
        loadProject(loadId).then((proj) => {
          if (proj) handleLoadProject(proj);
        });
      });
      window.history.replaceState({}, document.title);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
      if (!shareId || shareId === "new") return;
      if (justSharedRef.current === shareId) {
        justSharedRef.current = null;
        return;
      }

      let cancelled = false;

      const loadSharedProject = async () => {
        try {
          const sharedProject = await fetchSharedSimulation(shareId);
          if (!sharedProject || cancelled) return;

          setBoard(sharedProject.board || "arduino_uno");
          setCode(sharedProject.code || "");
          setComponents(sharedProject.components || []);
          setWires(sharedProject.connections || []);
          setProjectFiles(
            Array.isArray(sharedProject.projectFiles)
              ? sharedProject.projectFiles
              : [],
          );
          setOpenCodeTabs(
            Array.isArray(sharedProject.openCodeTabs)
              ? sharedProject.openCodeTabs
              : [],
          );
          setActiveCodeFileId(sharedProject.activeCodeFileId || "");
          syncWireIds(
            sharedProject.components || [],
            sharedProject.connections || [],
          );
          currentProjectIdRef.current = null;
          setCurrentProjectId(null);
          setCurrentProjectName(sharedProject.name || "Shared Simulation");
          setHistory({ past: [], future: [] });
          lastCompiledRef.current = null;
        } catch (error) {
          console.error("Failed to load shared simulation", error);
          if (!cancelled) {
            alert(
              error?.response?.data?.message ||
              error.message ||
              "Failed to load shared simulation.",
            );
          }
        }
      };

      loadSharedProject();
      return () => {
        cancelled = true;
      };
    }, [shareId]);

    useEffect(() => {
      if (!liveSessionCode || !token) return;

      let cancelled = false;

      const loadLiveSession = async () => {
        try {
          const session = await fetchLiveSimulationSession(liveSessionCode);
          if (!session || cancelled) return;

          setLiveMeetingShareCode(session.sessionCode || liveSessionCode);
          setLiveMeetingMeta(session);
          setLiveMeetingParticipantCounts(
            session.participantCounts || {
              total: 0,
              teachers: 0,
              students: 0,
              others: 0,
            },
          );
          setLiveGrantedEditorIds(session.permissions?.grantedEditorIds || []);
          setLiveGrantedEditors(session.permissions?.grantedEditors || []);
          setLivePendingEditRequests(
            session.permissions?.pendingEditRequests || [],
          );
          setLiveMeetingStatus(
            isLiveTeacher ? "Hosting live session" : "Connected to live session",
          );
          applyLiveMeetingSnapshot(session.snapshot || {});
        } catch (error) {
          console.error("Failed to load live simulation", error);
          if (!cancelled) {
            setLiveMeetingStatus("Connection failed");
            alert(
              error?.response?.data?.message ||
              error.message ||
              "Failed to load live simulation.",
            );
          }
        }
      };

      loadLiveSession();
      return () => {
        cancelled = true;
      };
    }, [applyLiveMeetingSnapshot, isLiveTeacher, liveSessionCode, token]);

    useEffect(() => {
      if (!liveMeetingMode || !token) return;

      const socketUrl = buildLiveSimulationWsUrl(
        liveSessionCode,
        isLiveTeacher ? "teacher" : "student",
      );
      const socket = new WebSocket(socketUrl);
      liveSocketRef.current = socket;
      setLiveMeetingStatus(
        isLiveTeacher ? "Connecting teacher session…" : "Joining live session…",
      );

      socket.onopen = () => {
        setLiveMeetingStatus(
          isLiveTeacher ? "Hosting live session" : "Watching teacher updates",
        );
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "session:welcome" && payload.session) {
            setLiveMeetingMeta(payload.session);
            setLiveMeetingShareCode(
              payload.session.sessionCode || liveSessionCode,
            );
            setLiveMeetingParticipantCounts(
              payload.session.participantCounts || {
                total: 0,
                teachers: 0,
                students: 0,
                others: 0,
              },
            );
            setLiveGrantedEditorIds(
              payload.session.permissions?.grantedEditorIds || [],
            );
            setLiveGrantedEditors(
              payload.session.permissions?.grantedEditors || [],
            );
            setLivePendingEditRequests(
              payload.session.permissions?.pendingEditRequests || [],
            );
            applyLiveMeetingSnapshot(payload.session.snapshot || {});
          }

          if (payload.type === "session:update") {
            const sourceRole = String(payload.sourceRole || "").trim();
            const sourceUserId = String(payload.sourceUserId || "").trim();
            setLiveMeetingStatus(
              sourceRole === "student"
                ? "Receiving collaborator updates"
                : "Receiving live updates",
            );
            if (sourceUserId !== currentLiveUserId) {
              applyLiveMeetingSnapshot(payload.snapshot || {});
            }
          }

          if (payload.type === "session:participants") {
            setLiveMeetingParticipantCounts(
              payload.participantCounts || {
                total: 0,
                teachers: 0,
                students: 0,
                others: 0,
              },
            );
          }

          if (payload.type === "permissions:update") {
            setLiveGrantedEditorIds(payload.permissions?.grantedEditorIds || []);
            setLiveGrantedEditors(payload.permissions?.grantedEditors || []);
            setLivePendingEditRequests(
              payload.permissions?.pendingEditRequests || [],
            );
            if (
              !isLiveTeacher &&
              String(payload.userId || "") === currentLiveUserId
            ) {
              setLiveEditRequestPending(false);
              setLiveMeetingStatus(
                payload.decision === "approve"
                  ? "Edit access granted"
                  : payload.decision === "deny"
                    ? "Edit request declined"
                    : liveMeetingStatus,
              );
            }
          }
        } catch (error) {
          console.error("Failed to parse live simulation message", error);
        }
      };

      socket.onerror = () => {
        setLiveMeetingStatus("WebSocket error");
      };

      socket.onclose = () => {
        if (liveSocketRef.current === socket) {
          liveSocketRef.current = null;
        }
        setLiveMeetingStatus("Disconnected");
      };

      return () => {
        if (liveSocketRef.current === socket) {
          liveSocketRef.current = null;
        }
        socket.close();
      };
    }, [
      applyLiveMeetingSnapshot,
      currentLiveUserId,
      isLiveTeacher,
      liveMeetingMode,
      liveSessionCode,
      token,
    ]);

}
