import {
  Link2,
  BookOpenCheck,
  CalendarDays,
  FileImage,
  Plus,
  FilePlus2,
  FileText,
  Upload,
  X,
} from "lucide-react";
import { getAttachmentLabel } from "./helpers.js";

export default function TeacherComposerModal({
  composerMode,
  onComposerModeChange,
  onClose,
  onCreateAssignment,
  assignmentForm,
  onAssignmentInputChange,
  onAssignmentLinkChange,
  onAddAssignmentLink,
  onRemoveAssignmentLink,
  assignmentFiles,
  onAssignmentFilesChange,
  onRemoveAssignmentFile,
  postingAssignment,
  onCreateNotice,
  noticeForm,
  onNoticeInputChange,
  noticeFiles,
  onNoticeFilesChange,
  onRemoveNoticeFile,
  postingNotice,
}) {
  return (
    <div
      className="teacher-composer-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Create class content"
    >
      <div className="teacher-composer-modal__backdrop" onClick={onClose} />
      <section className={`teacher-composer-modal__content${composerMode === "assignment" ? " teacher-composer-modal__content--assignment" : ""}`}>
        <header className="teacher-composer-modal__header">
          <div>
            <p className="teacher-modal__eyebrow">Classroom Composer</p>
            <h3>
              {composerMode === "assignment" ? "Create Assignment" : "Post Notice"}
            </h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </header>

        <div className="teacher-fab__switches">
          <button
            type="button"
            className={composerMode === "assignment" ? "is-active" : ""}
            onClick={() => onComposerModeChange("assignment")}
          >
            <FilePlus2 size={14} />
            <span>Assignment</span>
          </button>
          <button
            type="button"
            className={composerMode === "notice" ? "is-active" : ""}
            onClick={() => onComposerModeChange("notice")}
          >
            <BookOpenCheck size={14} />
            <span>Notice</span>
          </button>
        </div>

        {composerMode === "assignment" ? (
          <form className="teacher-assignment-form" onSubmit={onCreateAssignment}>
            <section className="teacher-assignment-section">
              <div className="teacher-assignment-section__header">
                <div className="teacher-assignment-section__icon">
                  <FilePlus2 size={16} />
                </div>
                <div className="teacher-assignment-section__copy">
                  <strong>Assignment Details</strong>
                  <small>Set the title, brief, and due date students should follow.</small>
                </div>
              </div>
              <div className="teacher-assignment-section__body teacher-assignment-section__body--grid">
                <label className="teacher-assignment-form__field">
                  <span>Assignment Title</span>
                  <input
                    type="text"
                    name="title"
                    value={assignmentForm.title}
                    onChange={onAssignmentInputChange}
                    placeholder="Traffic Light With Push Button"
                    required
                  />
                </label>
                <label className="teacher-assignment-form__field teacher-assignment-form__field--full">
                  <span>Description</span>
                  <textarea
                    name="description"
                    value={assignmentForm.description}
                    onChange={onAssignmentInputChange}
                    placeholder="Describe the circuit behavior, requirements, and what students need to submit."
                    rows={4}
                  />
                </label>
                <label className="teacher-assignment-form__field">
                  <span>
                    <CalendarDays size={14} /> Due Date
                  </span>
                  <input
                    type="datetime-local"
                    name="dueDate"
                    value={assignmentForm.dueDate}
                    onChange={onAssignmentInputChange}
                  />
                </label>
              </div>
            </section>

            <section className="teacher-assignment-section teacher-assignment-section--template">
              <div className="teacher-assignment-section__header">
                <div className="teacher-assignment-section__icon">
                  <Link2 size={16} />
                </div>
                <div className="teacher-assignment-section__copy">
                  <strong>Simulation Template</strong>
                  <small>Paste the share link students should open when they start this assignment.</small>
                </div>
              </div>
              <div className="teacher-assignment-section__body">
                <label className="teacher-assignment-form__field teacher-assignment-template-field">
                  <span>Add Template</span>
                  <div className="teacher-assignment-template-field__box">
                    <Link2 size={18} />
                    <input
                      type="url"
                      name="templateUrl"
                      value={assignmentForm.templateUrl || ""}
                      onChange={onAssignmentInputChange}
                      placeholder="Paste simulator share link"
                    />
                  </div>
                  <div className="teacher-assignment-template-field__hint" role="note" aria-label="How to add a simulator template">
                    <div className="teacher-assignment-template-field__hint-icon">
                      <BookOpenCheck size={15} />
                    </div>
                    <div className="teacher-assignment-template-field__hint-copy">
                      <strong>How to add the simulator template</strong>
                      <small>Open the simulator, click Share, copy the generated link, and paste it here.</small>
                    </div>
                  </div>
                </label>
              </div>
            </section>

            <section className="teacher-assignment-section">
              <div className="teacher-assignment-section__header">
                <div className="teacher-assignment-section__icon">
                  <Link2 size={16} />
                </div>
                <div className="teacher-assignment-section__copy">
                  <strong>Reference Links</strong>
                  <small>Add videos, docs, or readings students can open alongside the assignment.</small>
                </div>
              </div>
              <div className="teacher-assignment-section__body">
                <div className="teacher-link-input-list">
                  {(assignmentForm.links || []).map((link, idx) => (
                    <div key={`assignment-link-input-${idx}`} className="teacher-link-input-row">
                      <div className="teacher-link-input-wrap">
                        <Link2 size={14} />
                        <input
                          type="url"
                          value={link}
                          onChange={(event) => onAssignmentLinkChange(idx, event.target.value)}
                          placeholder="https://example.com/resource"
                        />
                      </div>
                      {(assignmentForm.links || []).length > 1 ? (
                        <button
                          type="button"
                          className="teacher-assignment-form__link-pill-remove"
                          onClick={() => onRemoveAssignmentLink(idx)}
                          aria-label={`Remove link ${idx + 1}`}
                        >
                          <X size={14} />
                        </button>
                      ) : null}
                    </div>
                  ))}
                  <button type="button" className="teacher-link-add-btn" onClick={onAddAssignmentLink}>
                    <Plus size={14} />
                    <span>Add link</span>
                  </button>
                </div>
              </div>
            </section>

            <section className="teacher-assignment-section">
              <div className="teacher-assignment-section__header">
                <div className="teacher-assignment-section__icon">
                  <Upload size={16} />
                </div>
                <div className="teacher-assignment-section__copy">
                  <strong>Attachments</strong>
                  <small>Upload PDFs, images, or handouts students can keep open while working.</small>
                </div>
              </div>
              <div className="teacher-assignment-section__body">
                <label className="teacher-upload-dropzone">
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    multiple
                    onChange={onAssignmentFilesChange}
                  />
                  <span className="teacher-upload-dropzone__empty">
                    <Upload size={18} />
                    Upload files
                  </span>
                </label>

                {assignmentFiles.length > 0 ? (
                  <div
                    className="teacher-assignment-form__link-list"
                    role="list"
                    aria-label="Uploaded assignment files"
                  >
                    {assignmentFiles.map((file, idx) => (
                      <div
                        key={`assignment-link-${idx}`}
                        className="teacher-assignment-form__link-pill"
                        role="listitem"
                      >
                        <span className="teacher-assignment-form__link-pill-copy">
                          {file.startsWith("data:image/") ? (
                            <FileImage size={14} />
                          ) : (
                            <FileText size={14} />
                          )}
                          {getAttachmentLabel(file, idx)}
                        </span>
                        <button
                          type="button"
                          className="teacher-assignment-form__link-pill-remove"
                          onClick={() => onRemoveAssignmentFile(idx)}
                          aria-label={`Remove file ${idx + 1}`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
            <button type="submit" disabled={postingAssignment}>
              {postingAssignment ? "Creating..." : "Add Assignment"}
            </button>
          </form>
        ) : (
          <form
            className="teacher-assignment-form teacher-assignment-form--notice"
            onSubmit={onCreateNotice}
          >
            <label className="teacher-assignment-form__field">
              <span>Notice Title</span>
              <input
                type="text"
                name="title"
                value={noticeForm.title}
                onChange={onNoticeInputChange}
                placeholder="Class Update"
              />
            </label>
            <label className="teacher-assignment-form__field">
              <span>Notice Message</span>
              <textarea
                name="message"
                value={noticeForm.message}
                onChange={onNoticeInputChange}
                placeholder="Type your announcement for students"
                rows={3}
                required
              />
            </label>
            <div className="teacher-assignment-form__files-label">
              <div className="teacher-assignment-form__files-copy">
                <span>Notice Attachments</span>
                <small>Upload class notes, posters, PDFs, or screenshots.</small>
              </div>

              <label className="teacher-upload-dropzone">
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  multiple
                  onChange={onNoticeFilesChange}
                />
                <span className="teacher-upload-dropzone__empty">
                  <Upload size={18} />
                  Upload files
                </span>
              </label>

              {noticeFiles.length > 0 ? (
                <div
                  className="teacher-assignment-form__link-list"
                  role="list"
                  aria-label="Uploaded notice files"
                >
                  {noticeFiles.map((file, idx) => (
                    <div
                      key={`notice-file-${idx}`}
                      className="teacher-assignment-form__link-pill"
                      role="listitem"
                    >
                      <span className="teacher-assignment-form__link-pill-copy">
                        {file.startsWith("data:image/") ? (
                          <FileImage size={14} />
                        ) : (
                          <FileText size={14} />
                        )}
                        {getAttachmentLabel(file, idx)}
                      </span>
                      <button
                        type="button"
                        className="teacher-assignment-form__link-pill-remove"
                        onClick={() => onRemoveNoticeFile(idx)}
                        aria-label={`Remove file ${idx + 1}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <button type="submit" disabled={postingNotice}>
              {postingNotice ? "Posting..." : "Post Notice"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
