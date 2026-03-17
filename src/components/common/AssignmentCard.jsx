import { ChevronRight, ClipboardList } from 'lucide-react'
import { formatDateTime } from './test.js'

export default function AssignmentCard({ teacherName, title, dueDate, createdAt, onClick }) {
  const timeLabel = dueDate ? `Due ${formatDateTime(dueDate)}` : `Posted ${formatDateTime(createdAt)}`

  return (
    <button
      type="button"
      className="teacher-assignment-post"
      onClick={onClick}
      aria-label="Open assignment"
    >
      <span className="teacher-assignment-post__icon" aria-hidden="true">
        <ClipboardList size={16} />
      </span>
      <span className="teacher-assignment-post__copy">
        <span className="teacher-assignment-post__line">
          <span className="teacher-assignment-post__byline">
            {teacherName || 'Teacher'} posted:
          </span>
          <span className="teacher-assignment-post__title">{title}</span>
        </span>
        <span className="teacher-assignment-post__time">{timeLabel}</span>
      </span>
      <span className="teacher-assignment-post__chevron" aria-hidden="true">
        <ChevronRight size={18} />
      </span>
    </button>
  )
}
