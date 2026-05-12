import { Copy, MoreVertical, Share2, Video } from "lucide-react";
import { formatDateTime } from "../../common/test.js";

export default function TeacherClassSidebar({
  codeMenuRef,
  showCodeMenu,
  onToggleCodeMenu,
  onCopyClassCode,
  onShareClass,
  onOpenLiveMeeting,
  classroom,
  assignments,
}) {
  const upcomingAssignments = assignments.filter((item) => item.dueDate);

  return (
    <aside className="teacher-class-right">
      <section className="teacher-detail-card teacher-detail-card--live">
        <div className="teacher-detail-card__live-head">
          <h3>Live Meeting</h3>
          <Video size={16} />
        </div>
        <p>Start an instant live class with your students.</p>
        <button
          type="button"
          className="teacher-button teacher-button--primary"
          onClick={onOpenLiveMeeting}
        >
          Start Live Meeting
        </button>
      </section>

      <section
        className="teacher-detail-card teacher-detail-card--class-code"
        ref={codeMenuRef}
      >
        <div className="teacher-detail-card__live-head">
          <h3>Class code</h3>
          <button
            type="button"
            className="teacher-detail-card__icon-action"
            onClick={onToggleCodeMenu}
            aria-label="Open class code actions"
            aria-expanded={showCodeMenu}
          >
            <MoreVertical size={14} />
          </button>

          {showCodeMenu && (
            <div className="teacher-detail-card__menu">
              <button type="button" onClick={onCopyClassCode}>
                <Copy size={14} />
                <span>Copy code</span>
              </button>
              <button type="button" onClick={onShareClass}>
                <Share2 size={14} />
                <span>Share link</span>
              </button>
            </div>
          )}
        </div>
        <div className="teacher-detail-card__code-row">
          <p className="teacher-detail-card__code">{classroom.joinCode}</p>
          <button
            type="button"
            className="teacher-detail-card__icon-action"
            onClick={onCopyClassCode}
            aria-label="Copy class code"
          >
            <Copy size={14} />
          </button>
        </div>
      </section>

      <section className="teacher-detail-card">
        <h3>Upcoming assignments</h3>
        <div className="teacher-detail-list">
          {upcomingAssignments.length === 0 ? (
            <p className="teacher-inline-state">No upcoming assignments.</p>
          ) : (
            upcomingAssignments.slice(0, 4).map((assignment) => (
              <article
                key={assignment._id}
                className="teacher-detail-list__item"
              >
                <small>Due {formatDateTime(assignment.dueDate)}</small>
                <strong>{assignment.title}</strong>
              </article>
            ))
          )}
        </div>
      </section>
    </aside>
  );
}
