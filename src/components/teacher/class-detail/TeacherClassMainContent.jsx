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
import { PROJECTS } from "../../../services/gamification/ProjectsConfig.js";

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

function TeacherAdventureTab({
  adventureContent,
  studentAdventureProgress,
  onAdventureContentChange,
  onAddWorld,
  onMoveWorld,
  onDeleteWorld,
  onAddProject,
  onMoveProject,
  onDeleteProject,
  onSaveAdventureConfig,
  savingAdventureConfig,
  onOpenClassAdventure,
  onOpenProjectEditor,
}) {
  const worlds = (adventureContent?.worlds || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const projects = (adventureContent?.projects || []);

  const updateWorld = (worldId, field, value) => {
    onAdventureContentChange({
      ...adventureContent,
      worlds: worlds.map((world) => (world.id === worldId ? { ...world, [field]: value } : world)),
    });
  };
  const updateProject = (projectId, field, value) => {
    onAdventureContentChange({
      ...adventureContent,
      projects: projects.map((project) => (project.id === projectId ? { ...project, [field]: value } : project)),
    });
  };
  const updateProjectArrayField = (projectId, field, value) => updateProject(projectId, field, value);

  return (
    <section className="teacher-list-block">
      <div className="teacher-list-block__heading">
        <h3>Class Adventure</h3>
        <small>Worlds, projects, nodes, theory, quiz, rewards</small>
      </div>

       <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onAddWorld}
              className="btn btn-primary"
              style={{
                padding: "10px 18px",
                borderRadius: 12,
                border: "none",
                background: "var(--accent)",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 13,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "var(--glow)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              + Add World
            </button>
          </div>
         {worlds.map((world, worldIndex) => (
           <article
             key={world.id}
             className="teacher-classwork-card"
             style={{
               border: "1px solid var(--border)",
               borderRadius: 16,
               background: "var(--card)",
               overflow: "hidden",
               transition: "all 0.2s ease",
               boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
             }}
           >
             <div style={{ display: "grid", gap: 10, padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <strong style={{ fontSize: 18, color: "var(--text)", fontWeight: 700 }}>
                    {world.title || `World ${worldIndex + 1}`}
                  </strong>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => onMoveWorld(world.id, -1)}
                      disabled={worldIndex === 0}
                      className="btn btn-ghost"
                      style={{
                        padding: "8px 14px",
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        background: "transparent",
                        color: worldIndex === 0 ? "var(--text3)" : "var(--accent)",
                        fontWeight: 700,
                        cursor: worldIndex === 0 ? "not-allowed" : "pointer",
                        fontSize: 13,
                        opacity: worldIndex === 0 ? 0.5 : 1,
                        transition: "all 0.15s ease",
                      }}
                      title="Move world up"
                    >
                      ↑ Up
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveWorld(world.id, 1)}
                      disabled={worldIndex === worlds.length - 1}
                      className="btn btn-ghost"
                      style={{
                        padding: "8px 14px",
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        background: "transparent",
                        color: worldIndex === worlds.length - 1 ? "var(--text3)" : "var(--accent)",
                        fontWeight: 700,
                        cursor: worldIndex === worlds.length - 1 ? "not-allowed" : "pointer",
                        fontSize: 13,
                        opacity: worldIndex === worlds.length - 1 ? 0.5 : 1,
                        transition: "all 0.15s ease",
                      }}
                      title="Move world down"
                    >
                      ↓ Down
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteWorld(world.id)}
                      className="btn btn-ghost"
                      style={{
                        padding: "8px 14px",
                        borderRadius: 10,
                        border: "1px solid rgba(239,68,68,0.3)",
                        background: "rgba(239,68,68,0.08)",
                        color: "#f87171",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontSize: 13,
                        transition: "all 0.15s ease",
                      }}
                      title="Delete world"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(239,68,68,0.14)";
                        e.currentTarget.style.borderColor = "rgba(239,68,68,0.5)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(239,68,68,0.08)";
                        e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)";
                      }}
                    >
                      🗑 Delete
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => onAddProject(world.id)}
                    style={{
                      padding: "8px 14px",
                      fontSize: 13,
                      fontWeight: 700,
                      background: "var(--card2)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      cursor: "pointer",
                      color: "var(--text2)",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--bg3)";
                      e.currentTarget.style.borderColor = "var(--accent)";
                      e.currentTarget.style.color = "var(--accent)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "var(--card2)";
                      e.currentTarget.style.borderColor = "var(--border)";
                      e.currentTarget.style.color = "var(--text2)";
                    }}
                  >
                    + Add Project
                  </button>
                </div>
               <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                 <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                   <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Title</label>
                   <input
                     type="text"
                     value={world.title || ""}
                     onChange={(event) => updateWorld(world.id, "title", event.target.value)}
                     style={{
                       width: "100%",
                       padding: "10px 14px",
                       borderRadius: 10,
                       border: "1px solid var(--border)",
                       background: "var(--bg2)",
                       color: "var(--text)",
                       fontSize: 14,
                       fontWeight: 500,
                       cursor: "pointer",
                       transition: "all 0.15s ease",
                       outline: "none",
                     }}
                     onFocus={(e) => {
                       e.currentTarget.style.borderColor = "var(--accent)";
                       e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,212,255,0.1)";
                     }}
                     onBlur={(e) => {
                       e.currentTarget.style.borderColor = "var(--border)";
                       e.currentTarget.style.boxShadow = "none";
                     }}
                   />
                 </div>
                 <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                   <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Theme</label>
                   <input
                     type="text"
                     value={world.theme || ""}
                     onChange={(event) => updateWorld(world.id, "theme", event.target.value)}
                     style={{
                       width: "100%",
                       padding: "10px 14px",
                       borderRadius: 10,
                       border: "1px solid var(--border)",
                       background: "var(--bg2)",
                       color: "var(--text)",
                       fontSize: 14,
                       fontWeight: 500,
                       cursor: "pointer",
                       transition: "all 0.15s ease",
                       outline: "none",
                     }}
                     onFocus={(e) => {
                       e.currentTarget.style.borderColor = "var(--accent)";
                       e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,212,255,0.1)";
                     }}
                     onBlur={(e) => {
                       e.currentTarget.style.borderColor = "var(--border)";
                       e.currentTarget.style.boxShadow = "none";
                     }}
                   />
                 </div>
                 <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                   <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Color</label>
                   <input
                     type="color"
                     value={world.color || "#3b82f6"}
                     onChange={(event) => updateWorld(world.id, "color", event.target.value)}
                     style={{
                       width: "100%",
                       height: 40,
                       padding: 2,
                       borderRadius: 10,
                       border: "1px solid var(--border)",
                       background: "var(--bg2)",
                       cursor: "pointer",
                       transition: "all 0.15s ease",
                     }}
                   />
                 </div>
               </div>
                <div style={{ display: "grid", gap: 12, marginTop: 4 }}>
                  {projects.filter((project) => project.worldId === world.id).sort((a, b) => (a.order || 0) - (b.order || 0)).map((project, projectIndex, arr) => {
                    // Use world's accent color for theming projects in this world
                    const worldAccentColor = world.color || "#3b82f6";
                    const worldAccentAlpha = (color) => `${color}33`; // 20% opacity
                    const worldAccentAlphaHover = (color) => `${color}55`; // 33% opacity

                    return (
                    <div
                      key={project.id}
                      style={{
                        border: `1px solid ${worldAccentAlpha(worldAccentColor)}`,
                        borderRadius: 14,
                        padding: 18,
                        display: "grid",
                        gap: 12,
                        background: "var(--card2)",
                        transition: "all 0.2s ease",
                        boxShadow: `0 2px 8px ${worldAccentAlpha(worldAccentColor)}`,
                        position: "relative",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = worldAccentAlphaHover(worldAccentColor);
                        e.currentTarget.style.boxShadow = `0 6px 20px ${worldAccentAlphaHover(worldAccentColor)}`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = worldAccentAlpha(worldAccentColor);
                        e.currentTarget.style.boxShadow = `0 2px 8px ${worldAccentAlpha(worldAccentColor)}`;
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <strong style={{ fontSize: 16, color: worldAccentColor, fontWeight: 700 }}>
                          {project.title || project.slug}
                        </strong>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => onMoveProject(project.id, -1)}
                            disabled={projectIndex === 0}
                            style={{
                              padding: "7px 12px",
                              borderRadius: 8,
                              border: "1px solid var(--border)",
                              background: "transparent",
                              color: projectIndex === 0 ? "var(--text3)" : worldAccentColor,
                              fontWeight: 700,
                              cursor: projectIndex === 0 ? "not-allowed" : "pointer",
                              fontSize: 12,
                              opacity: projectIndex === 0 ? 0.5 : 1,
                              transition: "all 0.15s ease",
                            }}
                            title="Move project up"
                          >
                            ↑ Up
                          </button>
                          <button
                            type="button"
                            onClick={() => onMoveProject(project.id, 1)}
                            disabled={projectIndex === arr.length - 1}
                            style={{
                              padding: "7px 12px",
                              borderRadius: 8,
                              border: "1px solid var(--border)",
                              background: "transparent",
                              color: projectIndex === arr.length - 1 ? "var(--text3)" : worldAccentColor,
                              fontWeight: 700,
                              cursor: projectIndex === arr.length - 1 ? "not-allowed" : "pointer",
                              fontSize: 12,
                              opacity: projectIndex === arr.length - 1 ? 0.5 : 1,
                              transition: "all 0.15s ease",
                            }}
                            title="Move project down"
                          >
                            ↓ Down
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteProject(project.id)}
                            style={{
                              background: "rgba(239,68,68,.12)",
                              border: "1px solid rgba(239,68,68,0.3)",
                              borderRadius: 8,
                              color: "#f87171",
                              cursor: "pointer",
                              padding: "7px 12px",
                              fontSize: 12,
                              fontWeight: 700,
                              transition: "all 0.15s ease",
                            }}
                            title="Delete project"
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "rgba(239,68,68,.18)";
                              e.currentTarget.style.borderColor = "rgba(239,68,68,0.5)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "rgba(239,68,68,.12)";
                              e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)";
                            }}
                          >
                            🗑 Delete
                          </button>
                        </div>
                      </div>
                      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Title</label>
                          <input
                            type="text"
                            value={project.title || ""}
                            onChange={(event) => updateProject(project.id, "title", event.target.value)}
                            style={{
                              width: "100%",
                              padding: "10px 14px",
                              borderRadius: 10,
                              border: `1px solid ${worldAccentAlpha(worldAccentColor)}`,
                              background: "var(--bg2)",
                              color: "var(--text)",
                              fontSize: 14,
                              fontWeight: 500,
                              transition: "all 0.15s ease",
                              outline: "none",
                            }}
                            onFocus={(e) => {
                              e.currentTarget.style.borderColor = worldAccentColor;
                              e.currentTarget.style.boxShadow = `0 0 0 3px ${worldAccentAlpha(worldAccentColor)}`;
                            }}
                            onBlur={(e) => {
                              e.currentTarget.style.borderColor = worldAccentAlpha(worldAccentColor);
                              e.currentTarget.style.boxShadow = "none";
                            }}
                          />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>XP Reward</label>
                          <input
                            type="number"
                            min="0"
                            value={project.xpReward || 0}
                            onChange={(event) => updateProject(project.id, "xpReward", Number(event.target.value || 0))}
                            style={{
                              width: "100%",
                              padding: "10px 14px",
                              borderRadius: 10,
                              border: `1px solid ${worldAccentAlpha(worldAccentColor)}`,
                              background: "var(--bg2)",
                              color: "var(--text)",
                              fontSize: 14,
                              fontWeight: 500,
                              fontFamily: "'JetBrains Mono', monospace",
                              transition: "all 0.15s ease",
                              outline: "none",
                            }}
                            onFocus={(e) => {
                              e.currentTarget.style.borderColor = worldAccentColor;
                              e.currentTarget.style.boxShadow = `0 0 0 3px ${worldAccentAlpha(worldAccentColor)}`;
                            }}
                            onBlur={(e) => {
                              e.currentTarget.style.borderColor = worldAccentAlpha(worldAccentColor);
                              e.currentTarget.style.boxShadow = "none";
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            onOpenProjectEditor(project.id, project.slug);
                          }}
                          style={{
                            padding: "10px 16px",
                            borderRadius: 10,
                            border: "none",
                            background: worldAccentColor,
                            color: "#fff",
                            fontWeight: 700,
                            cursor: "pointer",
                            fontSize: 13,
                            transition: "all 0.2s ease",
                            boxShadow: `0 4px 12px ${worldAccentAlpha(worldAccentColor)}`,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-1px)";
                            e.currentTarget.style.boxShadow = `0 8px 20px ${worldAccentAlphaHover(worldAccentColor)}`;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = `0 4px 12px ${worldAccentAlpha(worldAccentColor)}`;
                          }}
                        >
                          ✎ Edit Content
                        </button>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                        {(project.nodes || [])
                          .sort((a, b) => (a.order || 0) - (b.order || 0))
                          .map((node) => (
                            <span
                              key={node.id}
                              style={{
                                padding: "6px 12px",
                                borderRadius: 8,
                                background: "var(--card)",
                                border: `1px solid ${worldAccentAlpha(worldAccentColor)}`,
                                fontSize: 12,
                                fontWeight: 600,
                                color: worldAccentColor,
                                transition: "all 0.15s ease",
                              }}
                            >
                              {node.title || `Node ${node.order}`}
                            </span>
                          ))}
                       </div>
                     </div>
                    );})}
                  </div>
                </div>
              </article>
           ))}
        </div>

      <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 20 }}>
        <button
          type="button"
          onClick={onSaveAdventureConfig}
          disabled={savingAdventureConfig}
          style={{
            padding: "12px 24px",
            borderRadius: 12,
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontWeight: 700,
            cursor: savingAdventureConfig ? "not-allowed" : "pointer",
            fontSize: 14,
            transition: "all 0.2s ease",
            boxShadow: savingAdventureConfig ? "none" : "0 6px 20px rgba(0,212,255,0.25)",
            opacity: savingAdventureConfig ? 0.6 : 1,
          }}
          onMouseEnter={(e) => {
            if (!savingAdventureConfig) {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 8px 28px rgba(0,212,255,0.35)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = savingAdventureConfig ? "none" : "0 6px 20px rgba(0,212,255,0.25)";
          }}
        >
          {savingAdventureConfig ? "⏳ Saving..." : "✓ Save Adventure Config"}
        </button>
        <button
          type="button"
          onClick={onOpenClassAdventure}
          style={{
            padding: "12px 24px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--card)",
            color: "var(--text)",
            fontWeight: 700,
            cursor: "pointer",
            fontSize: 14,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)";
            e.currentTarget.style.background = "var(--bg3)";
            e.currentTarget.style.color = "var(--accent)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.background = "var(--card)";
            e.currentTarget.style.color = "var(--text)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          🌍 Open Class Adventure View
        </button>
      </div>

      <div style={{ marginTop: 20 }}>
        <h4 style={{ marginBottom: 12, fontSize: 16, fontWeight: 700, color: "var(--text)", borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
          Student Progress
        </h4>
        {studentAdventureProgress?.students?.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {studentAdventureProgress.students.map((row) => (
              <div
                key={row.student._id}
                className="teacher-classwork-card"
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "14px 16px",
                  background: "var(--card)",
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <strong style={{ fontSize: 14, color: "var(--text)", fontWeight: 700 }}>{row.student.name}</strong>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "var(--text2)", display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: "var(--green)", fontWeight: 700 }}>{row.progress.completedProjectsCount}</span> projects
                    </span>
                    <span style={{ fontSize: 13, color: "var(--text2)", display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: "var(--accent)", fontWeight: 700 }}>{row.progress.xp.toLocaleString()}</span> XP
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text3)" }}>
                      {row.progress.lastActivityAt ? new Date(row.progress.lastActivityAt).toLocaleString() : "No activity yet"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="teacher-inline-state" style={{ textAlign: "center", padding: "24px", color: "var(--text3)" }}>
            No student progress yet for this class.
          </p>
        )}
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
      {activeTab === "adventure" ? <TeacherAdventureTab {...props} /> : null}
      {activeTab === "people" ? <TeacherPeopleTab {...props} /> : null}
      {activeTab === "marks" ? <TeacherMarksTab {...props} /> : null}
    </section>
  );
}
