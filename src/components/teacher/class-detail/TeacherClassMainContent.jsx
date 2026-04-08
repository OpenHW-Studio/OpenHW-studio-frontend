import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FileQuestion,
  Loader2,
  Search,
  Trash2,
} from "lucide-react";
import StreamCard from "../../common/StreamCard.jsx";
import ClassroomAttachmentBlock from "../../common/ClassroomAttachmentBlock.jsx";
import {
  assignmentStatus,
  formatDateTime,
  getAvatarLetters,
} from "../../common/test.js";
import { pickAttachments } from "./helpers.js";

function TeacherStreamTab({
  noticeInput,
  onNoticeInputChange,
  onPostNotice,
  postingNotice,
  avatarInitials,
  streamItems,
  teacherName,
  classId,
  onDeleteNotice,
  deletingNoticeId,
  onAssignmentClick,
  onPreviewFile,
}) {
  return (
    <section className="teacher-list-block teacher-list-block--stream">
      <form
        className="teacher-announce-box teacher-announce-box--stream teacher-announce-box--flat"
        onSubmit={onPostNotice}
      >
        <div className="teacher-announce-box__avatar">{avatarInitials}</div>
        <input
          type="text"
          value={noticeInput}
          onChange={onNoticeInputChange}
          placeholder="Announce something to your class..."
        />
        <button
          type="submit"
          disabled={postingNotice}
          aria-label="Post to class stream"
        >
          <ChevronRight size={16} />
        </button>
      </form>

      <div className="teacher-notice-stream">
        {streamItems.length === 0 ? (
          <p className="teacher-inline-state">No posts or notices yet.</p>
        ) : (
          streamItems.map((item) => (
            <StreamCard
              key={`stream-${item.type}-${item.id}`}
              item={item}
              avatarInitials={avatarInitials}
              teacherName={teacherName}
              classId={classId}
              showCommentInput={true}
              enableComments={true}
              onDeleteNotice={onDeleteNotice}
              deletingNoticeId={deletingNoticeId}
              onAssignmentClick={onAssignmentClick}
              onPreviewFile={onPreviewFile}
            />
          ))
        )}
      </div>
    </section>
  );
}

function TeacherClassworkTab({
  assignments,
  assignmentMetrics,
  studentsCount,
  activeAssignmentId,
  onSelectAssignment,
  onDeleteAssignment,
  deletingAssignmentId,
  onPreviewFile,
}) {
  return (
    <section className="teacher-list-block teacher-list-block--classwork">
      <div className="teacher-classwork-shell">
        <header className="teacher-classwork-shell__header">
          <div className="teacher-classwork-shell__title">
            <p>Classwork</p>
          </div>

          <div className="teacher-classwork-shell__stats">
            <div className="teacher-classwork-shell__stat">
              <CalendarDays size={16} />
              <span>{assignments.length} items</span>
            </div>
            <div className="teacher-classwork-shell__stat">
              <ClipboardList size={16} />
              <span>{studentsCount} assigned</span>
            </div>
          </div>
        </header>

        <div className="teacher-classwork-shell__list">
          {assignments.length === 0 ? (
            <p className="teacher-inline-state">No assignments yet.</p>
          ) : (
            assignments.map((assignment) => {
              const stats = assignmentMetrics[assignment._id] || {
                submittedCount: 0,
                classStudentCount: studentsCount || 0,
              };
              const status = assignmentStatus(assignment);
              const attachments = pickAttachments(assignment);

              return (
                <article
                  key={assignment._id}
                  className={`teacher-classwork-card ${
                    activeAssignmentId === assignment._id
                      ? "is-active"
                      : ""
                  }`}
                >
                  <div
                    className="teacher-classwork-card__row"
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectAssignment(assignment._id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectAssignment(assignment._id);
                      }
                    }}
                  >
                    <div
                      className={`teacher-classwork-card__icon ${
                        assignment.dueDate
                          ? "teacher-classwork-card__icon--due"
                          : ""
                      }`}
                      aria-hidden="true"
                    >
                      {assignment.dueDate ? (
                        <ClipboardList size={22} />
                      ) : (
                        <FileQuestion size={22} />
                      )}
                    </div>

                    <div className="teacher-classwork-card__copy">
                      <div className="teacher-classwork-card__title-row">
                        <strong className="teacher-classwork-card__title">
                          {assignment.title}
                        </strong>
                        <span
                          className={`teacher-classwork-card__badge teacher-classwork-card__badge--${
                            status.key === "open"
                              ? "open"
                              : status.key === "closed"
                                ? "closed"
                                : "neutral"
                          }`}
                        >
                          {status.label}
                        </span>
                      </div>

                      <p className="teacher-classwork-card__meta">
                        {assignment.dueDate
                          ? `Due ${formatDateTime(assignment.dueDate)}`
                          : `Posted ${formatDateTime(assignment.createdAt)}`}
                      </p>

                      {attachments.length > 0 ? (
                        <div
                          className="teacher-classwork-card__files"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <ClassroomAttachmentBlock
                            source={assignment}
                            onPreviewFile={onPreviewFile}
                          />
                        </div>
                      ) : null}
                    </div>

                    <div className="teacher-classwork-card__metrics">
                      <div className="teacher-classwork-card__metric">
                        <strong>
                          {stats.submittedCount}
                        </strong>
                        <small>
                          Handed In
                        </small>
                      </div>
                      <div className="teacher-classwork-card__metric">
                        <strong>
                          {stats.classStudentCount}
                        </strong>
                        <small>
                          Assigned
                        </small>
                      </div>
                    </div>

                    <div className="teacher-classwork-card__actions">
                      <button
                        type="button"
                        className="teacher-classwork-card__delete"
                        disabled={deletingAssignmentId === assignment._id}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onDeleteAssignment(assignment._id);
                        }}
                        aria-label="Delete assignment"
                      >
                        {deletingAssignmentId === assignment._id ? (
                          <Loader2 size={14} className="teacher-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  </div>

                </article>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

function TeacherPeopleTab({
  classroom,
  user,
  students,
  removingStudentId,
  peopleSearch,
  onPeopleSearchChange,
  onRemoveStudent,
}) {
  const filteredStudents = students.filter((student) => {
    if (!peopleSearch.trim()) return true;
    const query = peopleSearch.toLowerCase();
    return (
      student.name?.toLowerCase().includes(query) ||
      student.email?.toLowerCase().includes(query)
    );
  });

  return (
    <section className="teacher-list-block teacher-list-block--people">
      <section className="teacher-people-section">
        <header className="teacher-people-section__header">
          <h3>Teachers</h3>
        </header>
        <div className="teacher-people-row teacher-people-row--teacher">
          <div className="teacher-people-row__main">
            <div className="teacher-people-row__avatar teacher-people-row__avatar--teacher">
              {classroom.teacher?.image ? (
                <img
                  src={classroom.teacher.image}
                  alt={classroom.teacher?.name || "Teacher"}
                  className="teacher-people-row__avatar-image"
                />
              ) : (
                getAvatarLetters(classroom.teacher?.name, "T")
              )}
            </div>
            <div>
              <strong>
                {classroom.teacher?.name || user?.name || "Class teacher"}
              </strong>
              <small>
                {classroom.teacher?.email || user?.email || "Teacher account"}
              </small>
            </div>
          </div>
        </div>
      </section>

      <section className="teacher-people-section">
        <header className="teacher-people-section__header teacher-people-section__header--students">
          <div className="teacher-people-section__title">
            <h3>Students</h3>
            <small>{students.length} students</small>
          </div>
        </header>

        <div className="teacher-people-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="text"
            placeholder="Search students..."
            value={peopleSearch}
            onChange={onPeopleSearchChange}
          />
        </div>

        <div className="teacher-people-list">
          {students.length === 0 ? (
            <p className="teacher-inline-state">
              No students in this class yet.
            </p>
          ) : (
            filteredStudents.map((student) => (
              <article key={student._id} className="teacher-people-row">
                <div className="teacher-people-row__main">
                  <div className="teacher-people-row__avatar">
                    {student?.image ? (
                      <img
                        src={student.image}
                        alt={student?.name || "Student"}
                        className="teacher-people-row__avatar-image"
                      />
                    ) : (
                      getAvatarLetters(student?.name, "S")
                    )}
                  </div>
                  <div>
                    <strong>{student.name}</strong>
                    <small>{student.email}</small>
                  </div>
                </div>

                <div className="teacher-people-row__meta">
                  <button
                    type="button"
                    className="teacher-people-row__remove"
                    disabled={removingStudentId === student._id}
                    onClick={() => onRemoveStudent(student._id)}
                    aria-label={`Remove ${student.name}`}
                    title="Remove student"
                  >
                    {removingStudentId === student._id ? (
                      <Loader2 size={14} className="teacher-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </section>
  );
}

function TeacherMarksTab({ markStats }) {
  return (
    <section className="teacher-list-block">
      <div className="teacher-list-block__heading">
        <h3>Marks Overview</h3>
        <small>Assignment status</small>
      </div>

      <div className="teacher-marks-grid">
        <article className="teacher-marks-card">
          <strong>{markStats.total}</strong>
          <span>Total assignments</span>
        </article>
        <article className="teacher-marks-card">
          <strong>{markStats.upcoming}</strong>
          <span>Open assignments</span>
        </article>
        <article className="teacher-marks-card">
          <strong>{markStats.closed}</strong>
          <span>Closed assignments</span>
        </article>
        <article className="teacher-marks-card">
          <strong>{markStats.noDueDate}</strong>
          <span>No due date</span>
        </article>
      </div>
    </section>
  );
}

export default function TeacherClassMainContent(props) {
  const { activeTab, error } = props;

  return (
    <section className="teacher-class-main">
      {error ? (
        <p className="teacher-inline-state teacher-inline-state--error">
          {error}
        </p>
      ) : null}

      {activeTab === "stream" ? <TeacherStreamTab {...props} /> : null}
      {activeTab === "classwork" ? <TeacherClassworkTab {...props} /> : null}
      {activeTab === "people" ? <TeacherPeopleTab {...props} /> : null}
      {activeTab === "marks" ? <TeacherMarksTab {...props} /> : null}
    </section>
  );
}
