import { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FileQuestion,
  Loader2,
  Search,
  Trash2,
  ChevronDown,
  ChevronUp,
  Star
} from "lucide-react";
import StreamCard from "../../common/StreamCard.jsx";
import ClassroomAttachmentBlock from "../../common/ClassroomAttachmentBlock.jsx";
import {
  assignmentStatus,
  formatDateTime,
  getAvatarLetters,
} from "../../common/test.js";
import { pickAttachments } from "./helpers.js";
import { getAssignmentSubmissions, triggerAutoGrade } from "../../../services/classroomService.js";

// ─── AI Auto-Grade Panel (New) ───────────────────────────────────────────────
function AutoGradePanel({ submission, classId, assignmentId, onRegradeSuccess }) {
  const [open, setOpen] = useState(false);
  const [regrading, setRegrading] = useState(false);
  
  const grade = submission.autoGrade;
  const hasGrade = grade && (grade.score != null || grade.summary);

  const handleRegrade = async () => {
    setRegrading(true);
    try {
      const res = await triggerAutoGrade(classId, assignmentId, submission._id);
      onRegradeSuccess(submission._id, res.submission);
    } catch (e) {
      alert("Failed to regrade: " + e.message);
    } finally {
      setRegrading(false);
    }
  };

  return (
    <div className="auto-grade-panel" style={{ marginTop: "16px", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
      <div 
        className="auto-grade-panel__header" 
        onClick={() => setOpen(!open)}
        style={{ padding: "12px 16px", background: "#f9fafb", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
      >
        <span className="auto-grade-panel__title" style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "600", color: "#111827" }}>
          <Star size={14} color="#f59e0b" /> AI Auto-Grade
        </span>
        <div className="auto-grade-panel__header-right" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {hasGrade ? (
            <span className="auto-grade-panel__score-badge" style={{ background: "#ecfdf5", color: "#047857", padding: "4px 10px", borderRadius: "9999px", fontSize: "13px", fontWeight: "700" }}>
              {grade.score}/100
            </span>
          ) : (
            <span className="auto-grade-panel__pending" style={{ color: "#6b7280", fontSize: "13px" }}>Pending</span>
          )}
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>
      
      {open && (
        <div className="auto-grade-panel__body" style={{ padding: "16px", fontSize: "14px", lineHeight: "1.5", color: "#374151" }}>
          {submission.screenshotUrl && (
            <button 
              className="teacher-button teacher-button--small" 
              onClick={handleRegrade} 
              disabled={regrading} 
              style={{ marginBottom: "12px", display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", fontSize: "12px", background: "#f3f4f6", border: "none", borderRadius: "4px", cursor: "pointer" }}
            >
              {regrading ? <Loader2 size={12} className="teacher-spin" /> : null}
              {regrading ? "Grading..." : "Request Re-grade"}
            </button>
          )}
          
          {!hasGrade ? (
            <p>No AI grading completed yet. Ensure the assignment has a reference image and the student has uploaded a screenshot.</p>
          ) : (
            <>
              {grade.summary && <p style={{ marginBottom: "12px" }}>{grade.summary}</p>}
              
              {grade.errors?.length > 0 && (
                <div style={{ marginBottom: "12px" }}>
                  <strong style={{ color: "#dc2626" }}>Errors to fix ({grade.errors.length}):</strong>
                  <ul style={{ margin: "4px 0 0 20px", color: "#dc2626" }}>
                    {grade.errors.map((e, i) => <li key={i}><strong>{e.component}:</strong> {e.description}</li>)}
                  </ul>
                </div>
              )}
              
              {grade.suggestions?.length > 0 && (
                <div style={{ marginBottom: "12px" }}>
                  <strong style={{ color: "#d97706" }}>Suggestions for improvement:</strong>
                  <ul style={{ margin: "4px 0 0 20px", color: "#d97706" }}>
                    {grade.suggestions.map((s, i) => <li key={i}><strong>{s.area}:</strong> {s.tip}</li>)}
                  </ul>
                </div>
              )}
              
              <small style={{ display: "block", marginTop: "12px", color: "#9ca3af", fontSize: "12px" }}>
                Graded at: {new Date(grade.gradedAt).toLocaleString()}
              </small>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Submissions Panel (New) ───────────────────────────────────────────────
function SubmissionsPanel({ classId, assignmentId }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getAssignmentSubmissions(classId, assignmentId)
      .then(res => setSubmissions(res.submissions || []))
      .catch(err => setError(err.message || "Failed to load submissions."))
      .finally(() => setLoading(false));
  }, [classId, assignmentId]);

  const handleUpdateSubmission = (subId, updatedSubmission) => {
    setSubmissions(prev => prev.map(s => s._id === subId ? updatedSubmission : s));
  };

  if (loading) {
    return <div style={{ padding: "24px 16px", color: "#6b7280", display: "flex", alignItems: "center", gap: "8px" }}><Loader2 size={16} className="teacher-spin" /> Loading submissions...</div>;
  }
  
  if (error) {
    return <div style={{ padding: "24px 16px", color: "#dc2626" }}>{error}</div>;
  }

  if (!submissions.length) {
    return <div style={{ padding: "24px 16px", color: "#6b7280" }}>No students have submitted this assignment yet.</div>;
  }

  return (
    <div className="teacher-submissions-panel" style={{ padding: "16px", borderTop: "1px solid #e5e7eb", background: "#f8fafc" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#111827" }}>Student Submissions</h4>
        <span style={{ fontSize: "12px", background: "#e2e8f0", color: "#475569", padding: "2px 8px", borderRadius: "12px", fontWeight: "bold" }}>
          {submissions.length} Handed In
        </span>
      </header>
      
      <div className="teacher-submissions-list" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {submissions.map(sub => (
          <div key={sub._id} className="teacher-submission-item" style={{ background: "#fff", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#e0e7ff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", color: "#4338ca", overflow: "hidden" }}>
                {sub.studentId?.image ? (
                  <img src={sub.studentId.image} alt={sub.studentId.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  getAvatarLetters(sub.studentId?.name, "S")
                )}
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ display: "block", fontSize: "14px", color: "#111827" }}>{sub.studentId?.name || "Student"}</strong>
                <small style={{ color: "#6b7280", fontSize: "12px" }}>Submitted: {new Date(sub.updatedAt).toLocaleString()}</small>
              </div>
            </div>
            
            {sub.notes && (
              <div style={{ marginBottom: "16px", fontSize: "14px", color: "#374151", background: "#f9fafb", padding: "12px", borderRadius: "6px", borderLeft: "3px solid #cbd5e1" }}>
                <strong style={{ display: "block", fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Student Notes:</strong>
                {sub.notes}
              </div>
            )}
            
            {sub.screenshotUrl && (
              <div style={{ marginBottom: "16px" }}>
                <strong style={{ display: "block", fontSize: "12px", color: "#6b7280", marginBottom: "8px" }}>Circuit Snapshot:</strong>
                <a href={sub.screenshotUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block" }}>
                  <img src={sub.screenshotUrl} alt="Circuit Submission" style={{ maxWidth: "100%", maxHeight: "250px", borderRadius: "6px", border: "1px solid #e5e7eb", objectFit: "contain", background: "#f8fafc" }} />
                </a>
              </div>
            )}
            
            <AutoGradePanel 
              submission={sub} 
              classId={classId} 
              assignmentId={assignmentId} 
              onRegradeSuccess={handleUpdateSubmission} 
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Original Components (Untouched) ─────────────────────────────────────────

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
  classId // ✅ Added classId to props for SubmissionsPanel
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
              const isActive = activeAssignmentId === assignment._id; // ✅ Track active state

              return (
                <article
                  key={assignment._id}
                  className={`teacher-classwork-card ${
                    isActive ? "is-active" : ""
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
                  
                  {/* ✅ Show SubmissionsPanel when assignment is clicked/expanded */}
                  {isActive && (
                    <SubmissionsPanel classId={classId} assignmentId={assignment._id} />
                  )}

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