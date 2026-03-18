import { Hash, Trash2 } from 'lucide-react'

const toneCycle = ['indigo', 'emerald', 'amber', 'violet']

export default function ClassCard({ classroom, index, role, userName, avatarInitials, onClick, onDelete }) {
  const tone = toneCycle[index % toneCycle.length]

  return (
    <article className={`teacher-class-card tone-${tone}`}>
      {role === 'teacher' ? (
        <div
          className="teacher-class-card__surface"
          onClick={onClick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
          role="button"
          tabIndex={0}
        >
          <div className="teacher-class-card__banner" style={classroom.image ? { backgroundImage: `url(${classroom.image})` } : undefined}>
            {onDelete && (
              <button
                type="button"
                className="teacher-class-card__menu"
                onClick={(e) => { e.stopPropagation(); onDelete(e, classroom._id) }}
                aria-label="Delete class"
              >
                <Trash2 size={14} />
              </button>
            )}
            <div>
              <h4>{classroom.name}</h4>
              <p>{classroom.bio || 'OpenHW classroom'}</p>
            </div>
          </div>
          <div className="teacher-class-card__body">
            <div>
              <p className="teacher-class-card__teacher">{userName}</p>
              <p className="teacher-class-card__students">{classroom.students?.length || 0} students</p>
            </div>
            <div className="teacher-class-card__avatar" aria-hidden="true">{avatarInitials}</div>
          </div>
        </div>
      ) : (
        <button type="button" className="teacher-class-card__surface" onClick={onClick}>
          <div className="teacher-class-card__banner" style={classroom.image ? { backgroundImage: `url(${classroom.image})` } : undefined}>
            <h4>{classroom.name}</h4>
            <p>{classroom.bio || 'OpenHW classroom'}</p>
          </div>
          <div className="teacher-class-card__body">
            <div>
              <p className="teacher-class-card__teacher">{classroom.teacher?.name || 'Teacher'}</p>
              <p className="teacher-class-card__students">{classroom.students?.length || 0} students</p>
              <p className="student-class-code">
                <Hash size={12} />
                <span>{classroom.joinCode}</span>
              </p>
            </div>
            <div className="teacher-class-card__avatar" aria-hidden="true">
              {(classroom.name || 'C').charAt(0).toUpperCase()}
            </div>
          </div>
        </button>
      )}
    </article>
  )
}
