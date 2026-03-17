import { Trash2 } from 'lucide-react'
import { formatDateTime, getAvatarLetters } from './test.js'
import AssignmentCard from './AssignmentCard.jsx'
import CommentInput from './CommentInput.jsx'

export default function StreamCard({
  item,
  avatarInitials,
  teacherName,
  classId,
  showCommentInput = true,
  enableComments = false,
  onDeleteNotice,
  onAssignmentClick
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
              onClick={() => onDeleteNotice(item.id)}
              aria-label="Delete notice"
            >
              <Trash2 size={14} />
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
            onClick={onAssignmentClick ? () => onAssignmentClick(item.id) : undefined}
          />
        ) : (
          <p>{item.body}</p>
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
