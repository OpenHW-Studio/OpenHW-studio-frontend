import {
  ChevronRight,
  ClipboardList,
  FileQuestion,
  MoreVertical,
  Search,
  Trash2,
} from "lucide-react";
import StreamCard from "../../common/StreamCard.jsx";
import {
  assignmentStatus,
  formatDateTime,
  getAvatarLetters,
} from "../../common/test.js";
import {
  getAttachmentLabel,
  isImageAttachment,
  pickAttachments,
} from "./helpers.js";

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
  onAssignmentClick,
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
              onAssignmentClick={onAssignmentClick}
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
  submissionsState,
}) {
  return (
    <section className="teacher-list-block teacher-list-block--classwork">
      <div className="teacher-classwork-module">
        <header className="teacher-classwork-module__header">
          <div className="teacher-classwork-module__title">
            <h3>Classwork</h3>
            <small>{assignments.length} items</small>
          </div>
          <button
            type="button"
            className="teacher-classwork-module__menu"
            aria-label="Classwork menu"
          >
            <MoreVertical size={16} />
          </button>
        </header>

        <div className="teacher-classwork-list teacher-assignment-list--clickable">
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
              const imageAttachments = attachments
                .filter((url) => isImageAttachment(url))
                .slice(0, 2);

              return (
                <article
                  key={assignment._id}
                  className={`teacher-classwork-item${activeAssignmentId === assignment._id ? " is-active" : ""}`}
                >
                  <div
                    className="teacher-classwork-item__row"
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
                      className="teacher-classwork-item__icon"
                      aria-hidden="true"
                    >
                      {assignment.dueDate ? (
                        <ClipboardList size={16} />
                      ) : (
                        <FileQuestion size={16} />
                      )}
                    </div>

                    <div className="teacher-classwork-item__copy">
                      <div className="teacher-classwork-item__top">
                        <strong>{assignment.title}</strong>
                        <span
                          className={`teacher-classwork-item__badge teacher-classwork-item__badge--${status.key}`}
                        >
                          {status.label}
                        </span>
                      </div>
                      <small>
                        {assignment.dueDate
                          ? `Due ${formatDateTime(assignment.dueDate)}`
                          : `Posted ${formatDateTime(assignment.createdAt)}`}
                      </small>
                      {attachments.length > 0 ? (
                        <div className="teacher-classwork-item__attachments">
                          {imageAttachments.map((url, idx) => (
                            <img
                              key={`${assignment._id}-img-${idx}`}
                              src={url}
                              alt="Attachment preview"
                              className="teacher-classwork-item__attachment-thumb"
                            />
                          ))}
                          <div
                            className="teacher-classwork-item__links"
                            role="list"
                            aria-label="Assignment links"
                          >
                            {attachments.map((url, idx) => (
                              <a
                                key={`${assignment._id}-link-${idx}`}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                role="listitem"
                                className="teacher-classwork-item__link"
                                onClick={(event) => event.stopPropagation()}
                              >
                                {getAttachmentLabel(url, idx)}
                              </a>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="teacher-classwork-item__meta">
                      <div className="teacher-classwork-item__meta-block">
                        <strong>{stats.submittedCount}</strong>
                        <small>handed in</small>
                      </div>
                    </div>

                    <div className="teacher-classwork-item__actions">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteAssignment(assignment._id);
                        }}
                        aria-label="Delete assignment"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {activeAssignmentId === assignment._id ? (
                    <div className="teacher-classwork-item__submissions">
                      <header className="teacher-assignment-submissions__header">
                        <h4>Student solutions</h4>
                        {submissionsState.data?.stats ? (
                          <small>
                            {submissionsState.data.stats.submittedCount}/
                            {submissionsState.data.stats.classStudentCount}{" "}
                            submitted
                          </small>
                        ) : null}
                      </header>

                      {submissionsState.loading ? (
                        <p className="teacher-inline-state">
                          Loading submissions...
                        </p>
                      ) : null}
                      {submissionsState.error ? (
                        <p className="teacher-inline-state teacher-inline-state--error">
                          {submissionsState.error}
                        </p>
                      ) : null}

                      {!submissionsState.loading &&
                      !submissionsState.error &&
                      submissionsState.data ? (
                        <div className="teacher-submission-list">
                          {submissionsState.data.submissions.length === 0 ? (
                            <p className="teacher-inline-state">
                              No student solutions yet.
                            </p>
                          ) : (
                            submissionsState.data.submissions.map(
                              (submission) => (
                                <article
                                  key={submission._id}
                                  className="teacher-submission-item"
                                >
                                  <div className="teacher-submission-item__left">
                                    <div className="teacher-notice-card__avatar">
                                      {submission.studentId?.name
                                        ? submission.studentId.name
                                            .split(" ")
                                            .slice(0, 2)
                                            .map((part) => part[0])
                                            .join("")
                                            .toUpperCase()
                                        : "S"}
                                    </div>
                                    <div>
                                      <strong>
                                        {submission.studentId?.name ||
                                          "Student"}
                                      </strong>
                                      <small>
                                        {submission.studentId?.email ||
                                          "No email"}
                                      </small>
                                    </div>
                                  </div>
                                  <div className="teacher-submission-item__meta">
                                    <small>
                                      Updated{" "}
                                      {formatDateTime(submission.updatedAt)}
                                    </small>
                                    <small>
                                      Board:{" "}
                                      {submission.projectId?.board || "N/A"}
                                    </small>
                                  </div>
                                </article>
                              ),
                            )
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
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
                    onClick={() => onRemoveStudent(student._id)}
                    aria-label={`Remove ${student.name}`}
                    title="Remove student"
                  >
                    <Trash2 size={14} />
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
