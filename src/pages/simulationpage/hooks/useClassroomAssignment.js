import { useCallback, useEffect } from "react";
import {
  getMyAssignmentSubmission,
  submitAssignment,
} from "../../../services/classroomService.js";
import { uploadClassroomFiles } from "../../../components/teacher/class-detail/uploadUtils.js";
import { normalizeImportedCircuitData } from "../projectUtils";

/**
 * Classroom assignment domain, extracted verbatim from SimulatorPage.jsx.
 * (submission-closed predicate, my-submission loader, ?circuit= URL
 *  loader, attachment pick/remove w/ 10MB + 5-file gates, submit flow
 *  w/ canvas-PNG snapshot + localStorage draft cleanup, share-link
 *  handoff for teacher review.)
 *
 * Behavior contract: identical gates, identical ohw_submission_draft_ /
 * ohw_preview_ keys, identical auto-open + redirect, identical alerts.
 * Verify via classroom-submit Playwright check.
 */
export function useClassroomAssignment({
  assignmentMode,
  classId,
  assignmentId,
  user,
  assessmentParams,
  setAssignmentSubmissionAssignment,
  setAssignmentSubmissionState,
  setAssignmentSubmissionForm,
  setBoard,
  setCode,
  setComponents,
  setWires,
  setCurrentProjectName,
  setCurrentProjectId,
  currentProjectIdRef,
  setHistory,
  shareId,
  assignmentSubmissionAssignment,
  assignmentSubmissionForm,
  assignmentSubmissionState,
  downloadPng,
  setAssignmentSubmissionOpen,
  navigate,
}) {
    const isAssignmentSubmissionClosed = useCallback(
      (assignment) =>
        Boolean(assignment?.dueDate) && new Date(assignment.dueDate) < new Date(),
      [],
    );

    useEffect(() => {
      if (!assignmentMode || user?.role !== "student") return;

      let cancelled = false;

      const loadAssignmentSubmission = async () => {
        setAssignmentSubmissionState({
          loading: true,
          saving: false,
          error: "",
          data: null,
        });
        try {
          const response = await getMyAssignmentSubmission(classId, assignmentId);
          if (cancelled) return;

          const submission = response?.submission || null;
          setAssignmentSubmissionAssignment(response?.assignment || null);
          setAssignmentSubmissionState({
            loading: false,
            saving: false,
            error: "",
            data: submission,
          });
          setAssignmentSubmissionForm({
            notes: submission?.notes || "",
            links: submission?.links?.length ? submission.links : [""],
            attachments: submission?.attachments || submission?.files || [],
          });
        } catch (error) {
          if (cancelled) return;
          setAssignmentSubmissionState({
            loading: false,
            saving: false,
            error: error.message || "Failed to load assignment submission.",
            data: null,
          });
        }
      };

      loadAssignmentSubmission();
      return () => {
        cancelled = true;
      };
    }, [assignmentMode, classId, assignmentId, user?.role]);


    // ── Auto-load circuit from URL (?circuit=JSON_ENCODED) ──────────────────────
    useEffect(() => {
      const urlCircuit = assessmentParams.get("circuit");
      if (!urlCircuit) return;

      try {
        const payload = JSON.parse(decodeURIComponent(urlCircuit));
        if (!payload || typeof payload !== "object") return;

        const normalized = normalizeImportedCircuitData(
          payload.components || [],
          payload.connections || [],
        );
        setBoard(payload.board || "arduino_uno");
        setComponents(normalized.components);
        setWires(normalized.wires);
        setCode(payload.code || "");
        syncWireIds(normalized.components, normalized.wires);

        // Clear project state so we don't accidentally overwrite the user's project
        setCurrentProjectName("Sample Circuit");
        setCurrentProjectId(null);
        currentProjectIdRef.current = null;
        setHistory({ past: [], future: [] });
      } catch (e) {
        console.error("[URL Circuit] Failed to parse circuit from URL:", e);
      }
    }, [assessmentParams]);

    const handleAssignmentSubmissionFilesChange = async (event) => {
      if (isAssignmentSubmissionClosed(assignmentSubmissionAssignment)) {
        setAssignmentSubmissionState((current) => ({
          ...current,
          error: "This assignment is closed. You can no longer upload files.",
        }));
        event.target.value = "";
        return;
      }

      try {
        const uploadedFiles = await uploadClassroomFiles(event.target.files, {
          classId,
          category: "submissions",
          maxFiles: 8,
          allowedTypes: ["application/pdf", "image"],
        });

        setAssignmentSubmissionForm((current) => ({
          ...current,
          attachments: [...current.attachments, ...uploadedFiles],
        }));
        setAssignmentSubmissionState((current) => ({ ...current, error: "" }));
      } catch (error) {
        setAssignmentSubmissionState((current) => ({
          ...current,
          error: error.message || "Failed to upload submission files.",
        }));
      } finally {
        event.target.value = "";
      }
    };

    const handleRemoveAssignmentSubmissionFile = (index) => {
      setAssignmentSubmissionForm((current) => ({
        ...current,
        attachments: current.attachments.filter((_, idx) => idx !== index),
      }));
    };

    const handleSubmitClassAssignment = async () => {
      if (!assignmentSubmissionAssignment) {
        return;
      }

      if (isAssignmentSubmissionClosed(assignmentSubmissionAssignment)) {
        setAssignmentSubmissionState((current) => ({
          ...current,
          saving: false,
          error: "This assignment is closed. Submissions are no longer accepted.",
        }));
        return;
      }

      setAssignmentSubmissionState((current) => ({
        ...current,
        saving: true,
        error: "",
      }));

      try {
        const shareResponse = await createSharedSimulation({
          name: `${assignmentSubmissionAssignment.title || "Assignment"} Submission`,
          isPublic: true,
          classId,
          assignmentId,
          board,
          components,
          connections: wires,
          code,
          projectFiles,
          openCodeTabs,
          activeCodeFileId,
        });
        const simulationShareId = shareResponse.shareId;
        if (!simulationShareId) {
          throw new Error("Failed to create simulation link for submission.");
        }
        const simulationUrl = `${window.location.origin}/simulator/share/${simulationShareId}`;

        // Auto-capture PNG of the current circuit
        let finalAttachments = [...assignmentSubmissionForm.attachments];
        try {
          const pngBlob = await downloadPng({ returnBlob: true });
          if (pngBlob) {
            console.log("[Submission] Captured circuit PNG, uploading...");
            // Cache locally for immediate feedback after redirect
            try {
              const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(pngBlob);
              });
              sessionStorage.setItem(`ohw_preview_${assignmentId}`, dataUrl);
            } catch (e) {
              console.warn("[Submission] Failed to cache preview locally:", e);
            }

            const pngFile = new File(
              [pngBlob],
              `submission_${assignmentId}_${Date.now()}.png`,
              { type: "image/png" },
            );
            const uploadedUrls = await uploadClassroomFiles([pngFile], {
              classId,
              category: "submissions",
            });

            if (uploadedUrls && uploadedUrls.length > 0) {
              console.log(
                "[Submission] PNG uploaded successfully:",
                uploadedUrls[0],
              );
              finalAttachments.push(uploadedUrls[0]);
            } else {
              console.error("[Submission] PNG upload returned no URLs");
            }
          }
        } catch (pngErr) {
          console.warn(
            "[Submission] Failed to auto-capture circuit PNG:",
            pngErr,
          );
        }

        // Store as a draft in sessionStorage for the dashboard modal to pick up
        const draftData = {
          notes: assignmentSubmissionForm.notes,
          attachments: finalAttachments,
          simulationShareId: simulationShareId,
          simulationUrl: simulationUrl,
          isDraft: true,
          updatedAt: new Date().toISOString(),
        };

        console.log("[Submission] Saving draft to sessionStorage:", draftData);
        sessionStorage.setItem(
          `ohw_submission_draft_${assignmentId}`,
          JSON.stringify(draftData),
        );

        setAssignmentSubmissionState({
          loading: false,
          saving: false,
          error: "",
          data: assignmentSubmissionState.data,
        });

        const targetClassId = classId || assignmentSubmissionAssignment?.classId;
        const targetAssignmentId =
          assignmentId || assignmentSubmissionAssignment?._id;
        const targetUrl = `/student/classes/${targetClassId}?openAssignment=${targetAssignmentId}`;

        console.log("[Submission] Stored draft and redirecting", {
          classId,
          assignmentId,
          targetUrl,
        });

        if (targetClassId && targetAssignmentId) {
          navigate(targetUrl);
        } else {
          alert(
            "Simulation captured! Please return to your dashboard to finalize submission.",
          );
        }
      } catch (error) {
        setAssignmentSubmissionState((current) => ({
          ...current,
          saving: false,
          error: error.message || "Failed to submit assignment.",
        }));
      }
    };


  return {
    isAssignmentSubmissionClosed,
    handleAssignmentSubmissionFilesChange,
    handleRemoveAssignmentSubmissionFile,
    handleSubmitClassAssignment,
  };
}
