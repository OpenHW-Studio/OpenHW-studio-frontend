import { ImagePlus, Upload, X } from "lucide-react";

export default function TeacherEditClassModal({
  editForm,
  onEditInputChange,
  onImageUpload,
  onRemoveImage,
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
      <section className="teacher-modal__content teacher-modal__content--class-editor">
        <header className="teacher-modal__header">
          <div>
            <p className="teacher-modal__eyebrow">Classroom Settings</p>
            <h3>Edit Class Details</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close modal">
            <X size={16} />
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

          <div className="teacher-upload-field">
            <div className="teacher-upload-field__copy">
              <span>Header Image</span>
              <small>Upload a banner image for the classroom card and header.</small>
            </div>

            <label className="teacher-upload-dropzone teacher-upload-dropzone--image">
              <input
                type="file"
                accept="image/*"
                onChange={onImageUpload}
              />
              {editForm.image ? (
                <>
                  <img
                    src={editForm.image}
                    alt="Class header preview"
                    className="teacher-upload-dropzone__preview"
                  />
                  <span className="teacher-upload-dropzone__overlay">
                    <ImagePlus size={16} />
                    Replace image
                  </span>
                  <button
                    type="button"
                    className="teacher-upload-dropzone__remove"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onRemoveImage();
                    }}
                    aria-label="Remove image"
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <span className="teacher-upload-dropzone__empty">
                  <Upload size={18} />
                  Upload image
                </span>
              )}
            </label>
          </div>

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
