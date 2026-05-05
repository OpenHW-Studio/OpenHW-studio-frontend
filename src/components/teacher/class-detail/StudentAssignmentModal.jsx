import { useState } from "react";
import { 
  AlertTriangle, 
  BookOpen, 
  CheckCircle, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink, 
  Lightbulb, 
  Link2, 
  Loader2, 
  RefreshCw, 
  Star, 
  Upload, 
  X 
} from "lucide-react";
import ClassroomAttachmentBlock from "../../common/ClassroomAttachmentBlock.jsx";
import { formatDateTime } from "../../common/test.js";
import { getAttachmentLabel, pickAttachments, pickLinks } from "./helpers.js";
import { triggerAutoGrade } from "../../../services/classroomService.js";

// ─── STUDENT AUTO-GRADE PANEL ────────────────────────────────────────────────
function StudentAutoGradePanel({ submission, classId, assignmentId }) {
  const [open, setOpen] = useState(false);
  const [regrading, setRegrading] = useState(false);
  const [regradeError, setRegradeError] = useState("");
  const [localGrade, setLocalGrade] = useState(submission?.autoGrade || null);
  
  const hasGrade = localGrade && (localGrade.score != null || localGrade.summary);

  const handleRegrade = async (e) => {
    e.stopPropagation(); 
    setRegrading(true);
    setRegradeError("");
    try {
      // Fallback to extraction if classId wasn't explicitly passed down
      const resolvedClassId = classId || submission?.classId || assignmentId; 
      const result = await triggerAutoGrade(resolvedClassId, assignmentId, submission._id);
      setLocalGrade(result.autoGrade);
      setOpen(true);
    } catch (err) {
      setRegradeError(err.message || "Re-grading failed.");
    } finally {
      setRegrading(false);
    }
  };

  return (
    <div 
      className="auto-grade-panel" 
      style={{ marginBottom: "24px" }} 
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="auto-grade-panel__header" 
        style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f9fafb", padding: "12px 16px", borderRadius: "8px", border: "1px solid #e5e7eb" }} 
        onClick={() => setOpen(!open)}
      >
        <span className="auto-grade-panel__title" style={{ fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px", color: "#111827", fontSize: "14px" }}>
          <Star size={16} color="#f59e0b" fill="#f59e0b" /> AI Feedback & Score
        </span>
        <div className="auto-grade-panel__header-right" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {hasGrade ? (
            <span style={{ background: "#ecfdf5", color: "#047857", padding: "4px 10px", borderRadius: "12px", fontSize: "13px", fontWeight: "bold" }}>
              {localGrade.score ?? "—"}/100
            </span>
          ) : (
            <span style={{ color: "#6b7280", fontSize: "13px" }}>Pending</span>
          )}
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {open && (
        <div className="auto-grade-panel__body" style={{ marginTop: "16px", fontSize: "14px", lineHeight: "1.6", color: "#374151",maxHeight: "400px", overflowY: "auto" }}>
          {/* Show Regrade Button inside the body if they have an image attached/screenshot */}
          {(submission?.screenshotUrl || submission?.attachments?.length > 0) && (
            <button 
              type="button" 
              onClick={handleRegrade} 
              disabled={regrading} 
              style={{ 
                marginBottom: "16px", display: "inline-flex", alignItems: "center", gap: "6px", 
                padding: "8px 14px", fontSize: "13px", fontWeight: "500", background: "#ffffff", 
                color: "#374151", border: "1px solid #d1d5db", borderRadius: "6px", cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
              }}
            >
              {regrading ? (
                <><Loader2 size={14} className="teacher-spin" /> Grading…</>
              ) : (
                <><RefreshCw size={14} /> Request Re-grade</>
              )}
            </button>
          )}

          {regradeError && <div style={{ color: "red", fontSize: "13px", marginBottom: "16px" }}>{regradeError}</div>}

          {!hasGrade ? (
            <p style={{ color: "#6b7280", background: "#f9fafb", padding: "12px", borderRadius: "6px", border: "1px solid #e5e7eb" }}>
              Your circuit hasn't been auto-graded yet. Submit directly from the emulator, or attach an image file of your circuit to trigger grading.
            </p>
          ) : (
            <>
              {localGrade.summary && (
                <p style={{ marginBottom: "16px", fontSize: "14px", background: "#f3f4f6", padding: "12px", borderRadius: "6px" }}>
                  {localGrade.summary}
                </p>
              )}

              {localGrade.errors?.length > 0 ? (
                <div style={{ marginBottom: "16px", background: "#fef2f2", padding: "12px", borderRadius: "6px", border: "1px solid #fecaca" }}>
                  <h5 style={{ color: "#dc2626", display: "flex", alignItems: "center", gap: "6px", margin: "0 0 8px 0", fontSize: "14px" }}>
                    <AlertTriangle size={16} /> Issues to fix
                  </h5>
                  <ul style={{ paddingLeft: "24px", color: "#b91c1c", margin: 0 }}>
                    {localGrade.errors.map((err, i) => (
                      <li key={i} style={{ marginBottom: "4px" }}>
                        <strong>{err.component}:</strong> {err.description}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : hasGrade ? (
                <p style={{ color: "#059669", display: "flex", alignItems: "center", gap: "6px", marginTop: "16px", background: "#ecfdf5", padding: "12px", borderRadius: "6px", border: "1px solid #a7f3d0", fontWeight: "500" }}>
                  <CheckCircle size={16} /> No issues found — great work!
                </p>
              ) : null}

              {localGrade.suggestions?.length > 0 && (
                <div style={{ marginTop: "16px", background: "#fffbeb", padding: "12px", borderRadius: "6px", border: "1px solid #fde68a" }}>
                  <h5 style={{ color: "#d97706", display: "flex", alignItems: "center", gap: "6px", margin: "0 0 8px 0", fontSize: "14px" }}>
                    <Lightbulb size={16} /> Tips for improvement
                  </h5>
                  <ul style={{ paddingLeft: "24px", color: "#b45309", margin: 0 }}>
                    {localGrade.suggestions.map((s, i) => (
                      <li key={i} style={{ marginBottom: "4px" }}>
                        <strong>{s.area}:</strong> {s.tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {localGrade.gradedAt && (
                <p style={{ marginTop: "16px", fontSize: "12px", color: "#9ca3af", borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}>
                  Graded {new Date(localGrade.gradedAt).toLocaleString()}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MAIN MODAL COMPONENT ────────────────────────────────────────────────────
export default function StudentAssignmentModal({
  classId, // Accepting classId explicitly
  assignment,
  submissionState,
  submissionForm,
  onClose,
  onNotesChange,
  onLinkChange,
  onAddLink,
  onRemoveLink,
  onFilesChange,
  onRemoveFile,
  onSubmit,
  onPreviewFile,
  isClosed,
}) {
  if (!assignment) return null;

  const attachments = pickAttachments(assignment);
  const referenceLinks = pickLinks(assignment);
  const submission = submissionState.data;

  // Fallback classId extraction just in case it isn't passed down from the parent
  const resolvedClassId = classId || assignment.classId;

  return (
    <div className="teacher-modal" role="dialog" aria-modal="true" aria-label="Assignment submission">
      <div className="teacher-modal__backdrop" onClick={onClose} />
      <section className="teacher-modal__content teacher-assignment-modal teacher-assignment-modal--student" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="teacher-assignment-modal__close" onClick={onClose} aria-label="Close modal">
          <X size={16} />
        </button>

        <div className="teacher-assignment-modal__grid">
          <div className="teacher-assignment-modal__panel teacher-assignment-modal__panel--overview">
            <h2 className="teacher-assignment-modal__hero-title">{assignment.title}</h2>

            <div className="teacher-assignment-modal__hero-meta">
              <span className="teacher-assignment-modal__hero-pill teacher-assignment-modal__hero-pill--due">
                {assignment.dueDate ? `Due ${formatDateTime(assignment.dueDate)}` : `Posted ${formatDateTime(assignment.createdAt)}`}
              </span>
              <span className="teacher-assignment-modal__hero-pill">
                {submission?.updatedAt ? `Updated ${formatDateTime(submission.updatedAt)}` : "No submission yet"}
              </span>
            </div>

            <div className="teacher-assignment-modal__section teacher-assignment-modal__section--spaced">
              <h4>Assignment Description</h4>
              <p className="teacher-assignment-modal__description">
                {assignment.description || "No description provided for this assignment."}
              </p>
            </div>

            <div className="teacher-assignment-modal__section teacher-assignment-modal__section--spaced">
              <h4>Reference Materials</h4>
              {referenceLinks.length > 0 ? (
                <div className="teacher-assignment-modal__resource-pills">
                  {referenceLinks.map((link, idx) => (
                    <a key={`assignment-ref-link-${idx}`} href={link} target="_blank" rel="noreferrer" className="teacher-assignment-modal__resource-pill">
                      <Link2 size={14} />
                      <span>{link}</span>
                      <ExternalLink size={14} />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="teacher-inline-state teacher-inline-state--plain">No reference links added.</p>
              )}
            </div>

            <div className="teacher-assignment-modal__section">
              <h4>Provided Files</h4>
              {attachments.length > 0 ? (
                <ClassroomAttachmentBlock source={assignment} onPreviewFile={onPreviewFile} />
              ) : (
                <p className="teacher-inline-state teacher-inline-state--plain">No assignment files attached.</p>
              )}
            </div>
          </div>

          <div className="teacher-assignment-modal__panel teacher-assignment-modal__panel--submission">
            <div className="teacher-assignment-modal__submission-head">
              <h3>Submission</h3>
            </div>

            {/* ✅ AI FEEDBACK PANEL MOVED TO THE VERY TOP */}
            {submission ? (
              <StudentAutoGradePanel 
                submission={submission} 
                classId={resolvedClassId} 
                assignmentId={assignment._id} 
              />
            ) : null}

            {isClosed ? (
              <div className="teacher-assignment-modal__alert">
                This assignment is closed. Submissions are no longer accepted.
              </div>
            ) : null}

            {submissionState.loading ? <p className="teacher-inline-state">Loading submission...</p> : null}
            {submissionState.error ? <p className="teacher-inline-state teacher-inline-state--error">{submissionState.error}</p> : null}

            {!submissionState.loading ? (
              <div className="student-assignment-submit student-assignment-submit--modal">
                <label className="teacher-assignment-form__field">
                  <span>Submission Notes</span>
                  <textarea
                    value={submissionForm.notes}
                    onChange={(event) => onNotesChange(event.target.value)}
                    rows={5}
                    placeholder="No notes added for this submission..."
                  />
                </label>

                <div className="teacher-assignment-form__files-label">
                  <div className="teacher-assignment-form__files-copy">
                    <span>Submission Files</span>
                  </div>

                  <label className="teacher-upload-dropzone student-assignment-submit__dropzone student-assignment-submit__dropzone--reference">
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      multiple
                      onChange={onFilesChange}
                      disabled={isClosed}
                    />
                    <span className="teacher-upload-dropzone__empty">
                      <span className="student-assignment-submit__drop-icon">
                        <Upload size={20} />
                      </span>
                      {isClosed ? "Submission closed" : "Drag and drop files here"}
                      <small>Support PDF, PNG, JPG</small>
                    </span>
                  </label>

                  {submissionForm.attachments.length > 0 ? (
                    <div className="teacher-assignment-form__link-list">
                      {submissionForm.attachments.map((file, idx) => (
                        <div key={`submission-file-${idx}`} className="teacher-assignment-form__link-pill">
                          <button
                            type="button"
                            className="teacher-assignment-form__link-pill-copy student-assignment-submit__file"
                            onClick={() => onPreviewFile({ url: file, name: getAttachmentLabel(file, idx) })}
                          >
                            <span>{getAttachmentLabel(file, idx)}</span>
                          </button>
                          <button
                            type="button"
                            className="teacher-assignment-form__link-pill-remove"
                            onClick={() => onRemoveFile(idx)}
                            aria-label={`Remove file ${idx + 1}`}
                            disabled={isClosed}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="student-assignment-submit__actions">
                  <button
                    type="button"
                    className="teacher-button teacher-button--primary student-assignment-submit__submit"
                    onClick={onSubmit}
                    disabled={submissionState.saving || isClosed}
                  >
                    {submissionState.saving ? (
                      <>
                        <Loader2 size={16} className="teacher-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>{isClosed ? "Submission Closed" : submission ? "Update Submission" : "Submit Assignment"}</span>
                    )}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}