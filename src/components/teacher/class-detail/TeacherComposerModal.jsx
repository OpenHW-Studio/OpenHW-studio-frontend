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
      <section className="teacher-composer-modal__content">
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
            <label className="teacher-assignment-form__field">
              <span>Assignment Title</span>
              <input
                type="text"
                name="title"
                value={assignmentForm.title}
                onChange={onAssignmentInputChange}
                placeholder="Problem Set 1: Limits"
                required
              />
            </label>
            <label className="teacher-assignment-form__field">
              <span>Description</span>
              <textarea
                name="description"
                value={assignmentForm.description}
                onChange={onAssignmentInputChange}
                placeholder="What students need to complete"
                rows={3}
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
            <label className="teacher-assignment-form__field">
              <span>Add Template</span>
              <input
                type="url"
                name="templateUrl"
                value={assignmentForm.templateUrl || ""}
                onChange={onAssignmentInputChange}
                placeholder="Paste simulator share link"
              />
            </label>
            <div className="teacher-assignment-form__files-label">
              <div className="teacher-assignment-form__files-copy">
                <span>Reference Links</span>
                <small>Add one or more URLs for students.</small>
              </div>
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
            <div className="teacher-assignment-form__files-label">
              <div className="teacher-assignment-form__files-copy">
                <span>Assignment Attachments</span>
                <small>Upload PDFs, images, or reference handouts.</small>
              </div>

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
