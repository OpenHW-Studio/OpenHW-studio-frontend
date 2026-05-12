import { FileImage, FileText, Paperclip } from "lucide-react";
import {
  getAttachmentLabel,
  isImageAttachment,
  pickAttachments,
} from "../teacher/class-detail/helpers.js";

export default function ClassroomAttachmentBlock({
  source,
  wrapperClassName = "",
  onPreviewFile,
}) {
  const attachments = pickAttachments(source);

  if (!attachments.length) {
    return null;
  }

  const imageAttachments = attachments.filter((item) => isImageAttachment(item));
  const fileAttachments = attachments.filter((item) => !isImageAttachment(item));

  return (
    <div className={`classroom-files ${wrapperClassName}`.trim()}>
      {imageAttachments.length > 0 ? (
        <div className="classroom-files__grid">
          {imageAttachments.map((url, index) => (
            <button
              type="button"
              key={`classroom-image-${index}`}
              onClick={() =>
                onPreviewFile?.({
                  url,
                  name: getAttachmentLabel(url, index),
                })
              }
              className="classroom-files__image"
            >
              <img
                src={url}
                alt={getAttachmentLabel(url, index)}
                className="classroom-files__image-preview"
              />
              <div className="classroom-files__image-copy">
                <FileImage size={14} />
                <span>{getAttachmentLabel(url, index)}</span>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {fileAttachments.length > 0 ? (
        <div className="classroom-files__list">
          {fileAttachments.map((url, index) => (
            <button
              type="button"
              key={`classroom-file-${index}`}
              onClick={() =>
                onPreviewFile?.({
                  url,
                  name: getAttachmentLabel(url, imageAttachments.length + index),
                })
              }
              className="classroom-files__item"
            >
              <span className="classroom-files__item-main">
                <span className="classroom-files__item-icon">
                  <FileText size={16} />
                </span>
                <span className="classroom-files__item-copy">
                  <span className="classroom-files__item-title">
                    {getAttachmentLabel(url, imageAttachments.length + index)}
                  </span>
                  <span className="classroom-files__item-meta">
                    <Paperclip size={12} />
                    Open file
                  </span>
                </span>
              </span>
              <span className="classroom-files__item-badge">
                File
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
