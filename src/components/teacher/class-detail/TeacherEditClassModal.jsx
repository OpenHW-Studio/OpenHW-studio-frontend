export default function TeacherEditClassModal({
  editForm,
  onEditInputChange,
  onClose,
  onSubmit,
  editError,
  updatingClass,
}) {
  return (
    <div
      className="teacher-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Edit class details"
    >
      <div className="teacher-modal__backdrop" onClick={onClose} />
      <section className="teacher-modal__content">
        <header className="teacher-modal__header">
          <h3>Edit Class Details</h3>
          <button type="button" onClick={onClose} aria-label="Close modal">
            x
          </button>
        </header>

        <form className="teacher-modal__form" onSubmit={onSubmit}>
          <label>
            <span>Class Name</span>
            <input
              type="text"
              name="name"
              value={editForm.name}
              onChange={onEditInputChange}
              required
            />
          </label>

          <label>
            <span>Class Bio</span>
            <textarea
              name="bio"
              value={editForm.bio}
              onChange={onEditInputChange}
              rows={3}
              placeholder="Short class summary"
            />
          </label>

          <label>
            <span>Header Image URL</span>
            <input
              type="url"
              name="image"
              value={editForm.image}
              onChange={onEditInputChange}
              placeholder="https://..."
            />
          </label>

          {editError ? (
            <p className="teacher-inline-state teacher-inline-state--error">
              {editError}
            </p>
          ) : null}

          <div className="teacher-modal__actions">
            <button
              type="button"
              className="teacher-button teacher-button--ghost"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="teacher-button teacher-button--primary"
              disabled={updatingClass}
            >
              {updatingClass ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
