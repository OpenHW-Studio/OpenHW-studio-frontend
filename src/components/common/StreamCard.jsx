import { Loader2, Trash2 } from 'lucide-react'
import { formatDateTime, getAvatarLetters } from './test.js'
import AssignmentCard from './AssignmentCard.jsx'
import CommentInput from './CommentInput.jsx'
import ClassroomAttachmentBlock from './ClassroomAttachmentBlock.jsx'

export default function StreamCard({
  item,
  avatarInitials,
  teacherName,
  classId,
  showCommentInput = true,
  enableComments = false,
  onDeleteNotice,
  deletingNoticeId,
  onAssignmentClick,
  onPreviewFile
}) {
  const authorName = item.type === 'notice' ? (item.createdBy?.name || 'Teacher') : 'Assignment'
  const authorLetters = item.type === 'notice' ? getAvatarLetters(item.createdBy?.name, avatarInitials) : 'A'
  const subtitle = item.type === 'assignment'
    ? (item.dueDate ? `Due ${formatDateTime(item.dueDate)}` : `Posted ${formatDateTime(item.createdAt)}`)
    : formatDateTime(item.createdAt)

  return (
    <article
      className={`teacher-stream-card${item.type === 'assignment' ? ' teacher-stream-card--assignment' : ''}`}
    >
      <header className="teacher-stream-card__header">
        <div className="teacher-stream-card__author">
          <div className="teacher-stream-card__avatar" aria-hidden="true">{authorLetters}</div>
          <div className="teacher-stream-card__meta">
            <h4>{authorName}</h4>
            <small>{subtitle}</small>
          </div>
        </div>

        {item.type !== 'assignment' && onDeleteNotice && (
          <div className="teacher-stream-card__actions">
            <button
              type="button"
              className="teacher-stream-card__action teacher-stream-card__action--danger"
              disabled={deletingNoticeId === item.id}
              onClick={() => onDeleteNotice(item.id)}
              aria-label="Delete notice"
            >
              {deletingNoticeId === item.id ? (
                <Loader2 size={14} className="teacher-spin" />
              ) : (
                <Trash2 size={14} />
              )}
            </button>
          </div>
        )}
      </header>

      <div className="teacher-stream-card__body">
        {item.type === 'assignment' ? (
          <AssignmentCard
            teacherName={teacherName}
            title={item.title}
            dueDate={item.dueDate}
            createdAt={item.createdAt}
            attachments={item.raw?.attachments || item.raw?.files || []}
            onPreviewFile={onPreviewFile}
            onClick={onAssignmentClick ? () => onAssignmentClick(item.id) : undefined}
          />
        ) : (
          <div className="teacher-notice-panel">
            <div className="teacher-notice-panel__copy">
              <h5 className="teacher-notice-panel__title">
                {item.title || 'Notice'}
              </h5>
              <p className="teacher-notice-panel__body">{item.body}</p>
            </div>
            <ClassroomAttachmentBlock source={item.raw} onPreviewFile={onPreviewFile} />
          </div>
        )}
      </div>

      {showCommentInput && (
        <footer className="teacher-stream-card__footer">
          <CommentInput
            avatarText={avatarInitials}
            classId={classId}
            postId={item.id}
            postType={item.type}
            disabled={!enableComments}
          />
        </footer>
      )}
    </article>
  )
}
