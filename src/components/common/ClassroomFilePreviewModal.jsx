import { ExternalLink, FileText, X } from "lucide-react";

const isPdfFile = (url = "") => /\.pdf(\?.*)?$/i.test(url);
const isImageFile = (url = "") => /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url);

export default function ClassroomFilePreviewModal({ file, onClose }) {
  if (!file?.url) {
    return null;
  }

  const showImage = isImageFile(file.url);
  const showPdf = isPdfFile(file.url);

  return (
    <div className="classroom-preview-modal">
      <button
        type="button"
        className="classroom-preview-modal__backdrop"
        aria-label="Close preview"
        onClick={onClose}
      />

      <section className="classroom-preview-modal__content">
        <header className="classroom-preview-modal__header">
          <div className="classroom-preview-modal__copy">
            <p>
              Classroom File
            </p>
            
          </div>

          <div className="classroom-preview-modal__actions">
            <a
              href={file.url}
              target="_blank"
              rel="noreferrer"
              className="classroom-preview-modal__open"
            >
              <ExternalLink size={14} />
              Open in new tab
            </a>
            <button
              type="button"
              onClick={onClose}
              className="classroom-preview-modal__close"
              aria-label="Close preview"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="classroom-preview-modal__body">
          {showImage ? (
            <div className="classroom-preview-modal__frame classroom-preview-modal__frame--image">
              <img
                src={file.url}
                alt={file.name || "Preview"}
                className="classroom-preview-modal__image"
              />
            </div>
          ) : null}

          {showPdf ? (
            <div className="classroom-preview-modal__frame">
              <iframe
                src={file.url}
                title={file.name || "PDF preview"}
                className="classroom-preview-modal__iframe"
              />
            </div>
          ) : null}

          {!showImage && !showPdf ? (
            <div className="classroom-preview-modal__empty">
              <span className="classroom-preview-modal__empty-icon">
                <FileText size={26} />
              </span>
              <h4>
                Preview not available
              </h4>
              <p>
                This file type does not support embedded preview here. Open it in
                a new tab to view or download it.
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
