import { ExternalLink, Link2, Loader2, Upload, X } from "lucide-react";
import ClassroomAttachmentBlock from "../../common/ClassroomAttachmentBlock.jsx";
import { formatDateTime } from "../../common/test.js";
import { getAttachmentLabel, pickAttachments, pickLinks } from "./helpers.js";

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
  if (!assignment) return null;

  const attachments = pickAttachments(assignment);
  const referenceLinks = pickLinks(assignment);
  const submission = submissionState.data;

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
