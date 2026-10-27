import {
  Plus,
  Compass,
  Play,
  Edit3,
  Layers,
  Sparkles,
  Globe,
  Lock,
  Unlink,
  Trash2,
  Loader2,
} from "lucide-react";

export default function TeacherAdventureTab({
  classId,
  classroom,
  classroomMaps = [],
  loadingClassroomMaps = false,
  onOpenCreateMap,
  onOpenAssignModal,
  onEditMap,
  onDeleteMap,
  onUnassignMap,
  studentAdventureProgress,
}) {
  return (
    <section className="teacher-list-block">
      {/* Top Header */}
      <div
        className="teacher-list-block__heading"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 20
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--text, #0f172a)" }}>
            Class Adventure Journeys
          </h3>
          <small style={{ color: "var(--text2, #64748b)", fontSize: "13px" }}>
            Create exclusive learning maps for this classroom or assign existing public journeys
          </small>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onOpenAssignModal}
            className="btn"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 16px",
              borderRadius: 10,
              border: "1px solid var(--border, #cbd5e1)",
              backgroundColor: "var(--card, #ffffff)",
              color: "var(--text, #0f172a)",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
            }}
          >
            <Globe size={16} style={{ color: "#6366f1" }} />
            Assign Public Map
          </button>

          <button
            type="button"
            onClick={onOpenCreateMap}
            className="btn btn-primary"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 18px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg, #4f46e5, #6366f1)",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)"
            }}
          >
            <Plus size={16} />
            Create Map for this Class
          </button>
        </div>
      </div>

      {/* Classroom Maps Grid */}
      {loadingClassroomMaps ? (
        <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text2, #64748b)" }}>
          <Loader2 size={32} style={{ animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
          <p style={{ margin: 0, fontSize: 14 }}>Loading classroom adventure maps...</p>
        </div>
      ) : classroomMaps.length === 0 ? (
        <div
          style={{
            padding: "48px 24px",
            borderRadius: 16,
            border: "1.5px dashed var(--border, #cbd5e1)",
            backgroundColor: "var(--bg2, rgba(255,255,255,0.02))",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12
          }}
        >
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: "50%",
              backgroundColor: "rgba(99, 102, 241, 0.1)",
              color: "#6366f1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Compass size={28} />
          </div>
          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text, #0f172a)" }}>
            No Adventure Maps in this Classroom Yet
          </h4>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text2, #64748b)", maxWidth: 460, lineHeight: 1.5 }}>
            Students in this class will not see any adventure maps until you create a dedicated class journey or assign an existing public adventure map.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <button
              type="button"
              onClick={onOpenCreateMap}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 16px",
                borderRadius: 8,
                background: "#4f46e5",
                color: "#fff",
                fontWeight: 600,
                fontSize: 13,
                border: "none",
                cursor: "pointer"
              }}
            >
              <Plus size={15} /> Create Class Map
            </button>
            <button
              type="button"
              onClick={onOpenAssignModal}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 16px",
                borderRadius: 8,
                background: "var(--card, #fff)",
                color: "var(--text, #0f172a)",
                fontWeight: 600,
                fontSize: 13,
                border: "1px solid var(--border, #cbd5e1)",
                cursor: "pointer"
              }}
            >
              <Globe size={15} style={{ color: "#6366f1" }} /> Browse & Assign Public Map
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {classroomMaps.map((map) => {
            const isExclusive = Boolean(map.classroomId && String(map.classroomId) === String(classId));
            const totalWorlds = map.worlds?.length || 1;
            const totalIslands = map.worlds?.reduce((acc, w) => acc + (w.islands?.length || 0), 0) || 1;
            const totalXP = map.worlds?.reduce((acc, w) => acc + (w.islands?.reduce((iAcc, isl) => iAcc + (isl.xpReward || 0), 0) || 0), 0) || 0;
            const boardName = map.boardArchitecture?.board || map.board || "Hardware";
            const badgeColor = map.boardArchitecture?.badgeColor || map.badgeColor || "#10b981";

            return (
              <div
                key={map._id}
                style={{
                  borderRadius: 16,
                  border: isExclusive ? "1.5px solid rgba(79, 70, 229, 0.4)" : "1px solid var(--border, #e2e8f0)",
                  backgroundColor: "var(--card, #ffffff)",
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 16,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
                  transition: "all 0.2s ease"
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        padding: "3px 8px",
                        borderRadius: 6,
                        backgroundColor: badgeColor,
                        color: "#ffffff"
                      }}
                    >
                      {boardName}
                    </span>
                    {isExclusive ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#4f46e5",
                          backgroundColor: "rgba(79, 70, 229, 0.1)",
                          padding: "2px 8px",
                          borderRadius: 6,
                          display: "flex",
                          alignItems: "center",
                          gap: 4
                        }}
                      >
                        <Lock size={11} /> Class Exclusive
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#0284c7",
                          backgroundColor: "rgba(2, 132, 199, 0.1)",
                          padding: "2px 8px",
                          borderRadius: 6,
                          display: "flex",
                          alignItems: "center",
                          gap: 4
                        }}
                      >
                        <Globe size={11} /> Public Assigned
                      </span>
                    )}
                  </div>

                  <h4 style={{ margin: "0 0 6px 0", fontSize: 16, fontWeight: 700, color: "var(--text, #0f172a)" }}>
                    {map.title}
                  </h4>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: "var(--text2, #64748b)",
                      lineHeight: 1.4,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden"
                    }}
                  >
                    {map.tagline || map.description || "An interactive learning journey."}
                  </p>

                  <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--text2, #64748b)", marginTop: 12, fontWeight: 600 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Layers size={13} style={{ color: "#6366f1" }} />
                      {totalWorlds} Worlds • {totalIslands} Missions
                    </span>
                    {totalXP > 0 && (
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Sparkles size={13} style={{ color: "#eab308" }} />
                        {totalXP} XP
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 12, borderTop: "1px solid var(--border, #f1f5f9)" }}>
                  <a
                    href={`/adventure?mapId=${map._id}&returnUrl=${encodeURIComponent(`/teacher/classes/${classId}`)}`}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: "8px 14px",
                      borderRadius: 8,
                      backgroundColor: "var(--primary, #4f46e5)",
                      color: "#ffffff",
                      fontSize: 12,
                      fontWeight: 700,
                      textDecoration: "none"
                    }}
                  >
                    <Play size={13} /> Enter World
                  </a>

                  {isExclusive ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onEditMap(map)}
                        title="Edit Adventure Map"
                        style={{
                          padding: "8px",
                          borderRadius: 8,
                          border: "1px solid var(--border, #cbd5e1)",
                          backgroundColor: "var(--card, #fff)",
                          color: "var(--text2, #475569)",
                          cursor: "pointer",
                          display: "flex"
                        }}
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteMap(map)}
                        title="Delete Exclusive Map"
                        style={{
                          padding: "8px",
                          borderRadius: 8,
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          backgroundColor: "rgba(239, 68, 68, 0.05)",
                          color: "#ef4444",
                          cursor: "pointer",
                          display: "flex"
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onUnassignMap(map)}
                      title="Unassign from this classroom"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1px solid var(--border, #cbd5e1)",
                        backgroundColor: "var(--card, #fff)",
                        color: "#ef4444",
                        cursor: "pointer",
                        fontSize: 11,
                        fontWeight: 600
                      }}
                    >
                      <Unlink size={13} /> Unassign
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Student Progress Overview */}
      <div style={{ marginTop: 32 }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--text, #0f172a)", marginBottom: 12 }}>
          Student Adventure Activity
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
                      <span style={{ color: "var(--green, #10b981)", fontWeight: 700 }}>{row.progress.completedProjectsCount}</span> projects
                    </span>
                    <span style={{ fontSize: 13, color: "var(--text2)", display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: "var(--accent, #6366f1)", fontWeight: 700 }}>{row.progress.xp.toLocaleString()}</span> XP
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text3, #94a3b8)" }}>
                      {row.progress.lastActivityAt ? new Date(row.progress.lastActivityAt).toLocaleString() : "No activity yet"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="teacher-inline-state" style={{ textAlign: "center", padding: "24px", color: "var(--text3)" }}>
            No student progress recorded for this class yet.
          </p>
        )}
      </div>
    </section>
  );
}
