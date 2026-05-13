import React, { useState, useEffect } from "react";
import { ExternalLink, Link2, Loader2, Upload, X, Terminal } from "lucide-react";
import StudentGradingPanel from "./StudentGradingPanel.jsx";
import ClassroomAttachmentBlock from "../../common/ClassroomAttachmentBlock.jsx";
import { formatDateTime } from "../../common/test.js";
import { getAttachmentLabel, pickAttachments, pickLinks, getShareIdFromUrl } from "./helpers.js";
import { useNavigate, useParams } from "react-router-dom";

export default function StudentAssignmentModal({
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
  const navigate = useNavigate();
  const { classId } = useParams();
  const [viewMode, setViewMode] = useState('submission'); // 'submission' or 'grading'

  // Diagnostic log for every render when modal is open
  console.log('[StudentAssignmentModal] Rendering. Mode:', viewMode, 'Assignment ID:', assignment?._id, 'Autograde Props:', {
    isAutogradingEnabled: assignment?.isAutogradingEnabled,
    autogradingKeyLength: assignment?.autogradingKey?.length || 0,
    hasKey: !!assignment?.autogradingKey
  });

  if (!assignment) return null;

  const attachments = pickAttachments(assignment);
  const referenceLinks = pickLinks(assignment);
  const submission = submissionState.data;

  const handleFinalSubmit = async () => {
    // Robust detection: Check for enabled flag OR the presence of a reference key
    const hasEnabledFlag = !!assignment.isAutogradingEnabled;
    const hasReferenceKey = !!assignment.autogradingKey && assignment.autogradingKey.length > 20;
    const isAutograding = hasEnabledFlag || hasReferenceKey;
    
    console.log('[Submission] Starting Final Submit. Autograde Detection:', {
      hasEnabledFlag,
      hasReferenceKey,
      isAutograding,
      viewMode
    });
    
    if (isAutograding) {
      console.log('[Submission] Switching to GRADING view mode.');
      setViewMode('grading');
    }

    try {
      console.log('[Submission] Calling backend onSubmit...');
      await onSubmit();
      console.log('[Submission] Backend onSubmit successful.');
      
      if (!isAutograding) {
        console.log('[Submission] Standard assignment, closing modal.');
        onClose();
      } else {
        console.log('[Submission] Autograded assignment, keeping modal open for audit results.');
      }
    } catch (e) {
      console.error('[Submission] CRITICAL: Submission failed', e);
      if (isAutograding) {
        console.log('[Submission] Reverting to submission view due to error.');
        setViewMode('submission');
      }
    }
  };

  const getLatestPng = () => {
    // 1. Check local session cache first (for immediate feedback after redirect)
    const cached = sessionStorage.getItem(`ohw_preview_${assignment._id}`);
    if (cached) return cached;

    // 2. Fallback to server/form data
    const serverFiles = submission?.attachments || submission?.files || [];
    const localFiles = submissionForm?.attachments || [];
    const allFiles = serverFiles.length > 0 ? serverFiles : localFiles;
    return [...allFiles].reverse().find(a => typeof a === 'string' && a.toLowerCase().includes('.png'));
  };
  const latestPngUrl = getLatestPng();

  return (
    <div className="teacher-modal" role="dialog" aria-modal="true" aria-label="Assignment submission">
      <div className="teacher-modal__backdrop" onClick={onClose} />
      <section 
        className={`teacher-modal__content teacher-assignment-modal ${viewMode === 'grading' ? 'teacher-assignment-modal--audit-view' : 'teacher-assignment-modal--student'}`} 
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="teacher-assignment-modal__close" onClick={onClose} aria-label="Close modal">
          <X size={16} />
        </button>

        {viewMode === 'grading' ? (
          <div className="student-grading-view-container">
            <header className="student-grading-view-header">
              <div className="flex items-center gap-3">
                <Terminal size={24} className="text-accent" />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold">{assignment.title}</h2>
                    {(assignment.isAutogradingEnabled || assignment.autogradingKey) && (
                      <span className="teacher-classwork-card__badge teacher-classwork-card__badge--autograde">Autograde</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400">Behavioral Audit in Progress</p>
                </div>
              </div>
            </header>
            
            <div className="student-grading-view-content">
              <StudentGradingPanel 
                submissionPngUrl={latestPngUrl}
                referenceKeyBase64={assignment.autogradingKey}
              />
            </div>

            <div className="flex justify-center mt-8">
              <button 
                type="button" 
                className="teacher-button teacher-button--primary"
                onClick={onClose}
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        ) : (
          <div className="teacher-assignment-modal__grid">
            <div className="teacher-assignment-modal__panel teacher-assignment-modal__panel--overview">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="teacher-assignment-modal__hero-title mb-0">{assignment.title}</h2>
                {(assignment.isAutogradingEnabled || assignment.autogradingKey) && (
                  <span className="teacher-classwork-card__badge teacher-classwork-card__badge--autograde">Autograde</span>
                )}
              </div>

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
                      rows={1}
                      placeholder="No notes added for this submission..."
                    />
                  </label>

                  <div className="teacher-assignment-form__files-label">
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-sm font-bold text-slate-600">Submission Files</span>
                      <label className="student-assignment-submit__drop-icon" title="Upload files">
                        <Upload size={14} />
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          multiple
                          onChange={onFilesChange}
                          disabled={isClosed}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div className="teacher-upload-dropzone student-assignment-submit__dropzone student-assignment-submit__dropzone--reference">
                      {submissionForm.attachments.length === 0 ? (
                        <span className="teacher-upload-dropzone__empty text-xs font-semibold text-slate-400">
                          {isClosed ? "Submission closed" : "No files attached"}
                        </span>
                      ) : (
                        <div className="student-assignment-submit__file-list-compact" onClick={(e) => e.stopPropagation()}>
                          {submissionForm.attachments.map((file, idx) => {
                            const isAutoPng = typeof file === 'string' && file.toLowerCase().includes('.png') && file.includes('submission_');
                            if (isAutoPng) return null;
                            
                            return (
                              <div key={`submission-file-${idx}`} className="teacher-assignment-form__link-pill" style={{ margin: '4px 0' }}>
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
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="teacher-assignment-modal__section teacher-assignment-modal__section--compact">
                    <h4>Simulation Preview</h4>
                    <div 
                      className="student-assignment-submit__png-preview"
                      onClick={() => {
                        const shareId = getShareIdFromUrl(assignment.templateUrl);
                        const submissionShareId = submission?.simulationShareId;
                        const targetShareId = submissionShareId || shareId;
                        
                        if (targetShareId) {
                          navigate(`/simulator/share/${targetShareId}/assignment/${classId}/${assignment._id}`);
                        } else {
                          navigate(`/simulator/assignment/${classId}/${assignment._id}`);
                        }
                      }}
                    >
                      {latestPngUrl ? (
                        <img src={latestPngUrl} alt="Simulation Preview" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <Terminal size={32} />
                          <span className="text-xs font-semibold">No simulation preview available</span>
                        </div>
                      )}
                      <div className="student-assignment-submit__png-overlay">
                        <span className="student-assignment-submit__png-icon">Open Simulator</span>
                      </div>
                    </div>
                  </div>

                  <div className="student-assignment-submit__actions">
                    <button
                      type="button"
                      className="teacher-button teacher-button--primary student-assignment-submit__submit"
                      onClick={handleFinalSubmit}
                      disabled={submissionState.saving || isClosed}
                    >
                      {submissionState.saving ? (
                        <>
                          <Loader2 size={16} className="teacher-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <span>{isClosed ? "Submission Closed" : (submission ? "Update Submission" : "Submit")}</span>
                      )}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
