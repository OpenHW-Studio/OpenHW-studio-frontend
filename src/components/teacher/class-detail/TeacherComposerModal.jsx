import {
  BookOpenCheck,
  CalendarDays,
  FilePlus2,
  Link2,
  Plus,
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
  assignmentLinkInput,
  onAssignmentLinkInputChange,
  onAddAssignmentLink,
  assignmentLinks,
  onRemoveAssignmentLink,
  postingAssignment,
  onCreateNotice,
  noticeForm,
  onNoticeInputChange,
  noticeFiles,
  onNoticeFilesChange,
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
            <h3>Add Assignment</h3>
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
            <div className="teacher-assignment-form__files-label">
              <span>Assignment Links</span>
              <div className="teacher-assignment-form__link-input-row">
                <input
                  type="url"
                  value={assignmentLinkInput}
                  onChange={onAssignmentLinkInputChange}
                  placeholder="Paste URL here (e.g., https://...)"
                />
                <button
                  type="button"
                  className="teacher-assignment-form__link-add-icon"
                  onClick={onAddAssignmentLink}
                  aria-label="Add attachment link"
                >
                  <Plus size={16} />
                </button>
              </div>

              {assignmentLinks.length > 0 ? (
                <div
                  className="teacher-assignment-form__link-list"
                  role="list"
                  aria-label="Added assignment links"
                >
                  {assignmentLinks.map((link, idx) => (
                    <div
                      key={`assignment-link-${idx}`}
                      className="teacher-assignment-form__link-pill"
                      role="listitem"
                    >
                      <span className="teacher-assignment-form__link-pill-copy">
                        <Link2 size={14} />
                        {getAttachmentLabel(link, idx)}
                      </span>
                      <button
                        type="button"
                        className="teacher-assignment-form__link-pill-remove"
                        onClick={() => onRemoveAssignmentLink(idx)}
                        aria-label={`Remove link ${idx + 1}`}
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
            <h3>Add Notice</h3>
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
            <label className="teacher-assignment-form__files-label">
              <span>Attachments (paste URLs, one per line)</span>
              <textarea
                value={noticeFiles}
                onChange={onNoticeFilesChange}
                placeholder="https://example.com/notes.pdf"
                rows={2}
              />
            </label>
            <button type="submit" disabled={postingNotice}>
              {postingNotice ? "Posting..." : "Post Notice"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
