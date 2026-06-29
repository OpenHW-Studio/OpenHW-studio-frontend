import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import ClassroomSidebar from "../../components/common/ClassroomSidebar.jsx";
import { getMyProjectBank, getSharedProjectBank, deleteProjectBankEntry } from "../../services/projectBankService";
import { sidebarLinks as teacherSidebarLinks } from "../../components/teacher/class-detail/helpers.js";
import { getDifficultyDisplay, normalizeDifficulty } from "../../services/gamification/ProjectsConfig.js";

const BOARD_HINTS = ["arduino", "arduino-uno", "arduino-nano", "arduino-mega", "pico-w", "pico", "raspberry-pi-pico-w", "raspberry-pi-pico", "esp32-s3", "esp32-c3", "esp32", "stm32"];

const normalizeBoardValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^openhw-/, "")
    .replace(/^wokwi-/, "")
    .replace(/^board-/, "")
    .replace(/[_\s]+/g, "-");

const isBoardLike = (value) => {
  const normalized = normalizeBoardValue(value);
  return Boolean(normalized) && BOARD_HINTS.some((hint) => normalized.includes(hint) || hint.includes(normalized));
};

function getProjectBoards(project) {
  const storedBoards = Array.isArray(project?.boards) ? project.boards : [];
  const fromField = project?.board ? [project.board] : [];
  const fromRewards = Array.isArray(project?.rewardComponents)
    ? project.rewardComponents.flatMap((item) => [item?.board, item?.type, item?.id, item?.name])
    : [];
  const fromComponents = Array.isArray(project?.components)
    ? project.components.flatMap((item) => [item?.board, item?.type, item?.id, item?.name, item?.label])
    : [];

  const boards = [...storedBoards, ...fromField, ...fromRewards, ...fromComponents]
    .map(normalizeBoardValue)
    .filter(isBoardLike);

  return [...new Set(boards)];
}

function getProjectSearchBlob(project) {
  const rewards = Array.isArray(project?.rewardComponents)
    ? project.rewardComponents.flatMap((item) => [item?.id, item?.type, item?.name, item?.description])
    : [];
  const components = Array.isArray(project?.components)
    ? project.components.flatMap((item) => [item?.id, item?.type, item?.label])
    : [];

  return [
    project?.title,
    project?.slug,
    project?.description,
    project?.difficulty,
    project?.estimatedTime,
    project?.board,
    ...(project?.boards || []),
    ...(project?.tags || []),
    ...rewards,
    ...components,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function TeacherProjectBankPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [view, setView] = useState("my");
  const [myProjects, setMyProjects] = useState([]);
  const [sharedProjects, setSharedProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [boardFilter, setBoardFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      if (view === "my") {
        const data = await getMyProjectBank();
        setMyProjects(data?.projects || data || []);
      } else {
        const data = await getSharedProjectBank();
        setSharedProjects(data?.projects || data || []);
      }
    } catch (e) {
      setError(e?.message || "Failed to load project bank");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [view]);

  const current = view === "my" ? myProjects : sharedProjects;

  const boards = useMemo(() => {
    const s = new Set();
    current.forEach((p) => {
      getProjectBoards(p).forEach((b) => s.add(b));
    });
    return Array.from(s).sort();
  }, [current]);

  const filtered = useMemo(() => {
    let list = current;
    if (boardFilter !== "all") {
      const boardQuery = normalizeBoardValue(boardFilter);
      list = list.filter((p) => getProjectBoards(p).some((board) => normalizeBoardValue(board) === boardQuery));
    }
    if (difficultyFilter !== "all") {
      list = list.filter((p) => normalizeDifficulty(p.difficulty) === difficultyFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((p) => getProjectSearchBlob(p).includes(q));
    }
    return list;
  }, [current, boardFilter, difficultyFilter, searchQuery]);

  const handleDelete = async (project) => {
    if (!window.confirm(`Delete "${project.title || project.slug}"?`)) return;
    try {
      await deleteProjectBankEntry(project._id || project.slug);
      setMyProjects((prev) => prev.filter((p) => (p._id || p.slug) !== (project._id || project.slug)));
    } catch (e) {
      setError(e?.message || "Failed to delete project");
    }
  };

  const handleOpenEditor = (project) => {
    navigate(`/teacher/project-bank/${project.slug}/edit`);
  };

  const handleCreateNew = () => {
    const visibility = view === "shared" ? "published" : "personal";
    navigate(`/teacher/project-bank/new?visibility=${encodeURIComponent(visibility)}`);
  };

  return (
    <div className="teacher-dashboard-page">
      <ClassroomSidebar
        links={teacherSidebarLinks.map((item) => ({
          ...item,
          isActive: item.key === "classes",
          onClick: () => {
            if (item.route) navigate(item.route);
          },
        }))}
        user={user}
        onLogout={() => {
          logout();
          navigate("/login");
        }}
        onProfileClick={() => navigate("/teacher/profile")}
      />
      <main className="teacher-dashboard-main teacher-dashboard-main--with-fixed-sidebar">
        <section className="teacher-class-page teacher-class-page--shell">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 18,
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "var(--text)" }}>Project Bank</h1>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text2)" }}>
                Browse, manage, and share project templates.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={handleCreateNew}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--accent)",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 13,
                  transition: "all 0.15s ease",
                }}
              >
                + New Project
              </button>
              {["my", "shared"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setView(t)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: view === t ? "var(--accent)" : "transparent",
                    color: view === t ? "#fff" : "var(--text2)",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 13,
                    transition: "all 0.15s ease",
                  }}
                >
                  {t === "my" ? "My Projects" : "Shared Projects"}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div
              style={{
                color: "#f87171",
                padding: "10px 14px",
                background: "rgba(239,68,68,.12)",
                borderRadius: 10,
                marginBottom: 14,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <select
              value={boardFilter}
              onChange={(e) => setBoardFilter(e.target.value)}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg2)",
                color: "var(--text)",
                fontSize: 13,
              }}
            >
              <option value="all">All Boards</option>
              {boards.map((b) => (
                <option key={b} value={b}>
                  {b.toUpperCase()}
                </option>
              ))}
            </select>
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg2)",
                color: "var(--text)",
                fontSize: 13,
              }}
            >
              <option value="all">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="intermediate">Intermediate</option>
              <option value="hard">Hard</option>
            </select>
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                minWidth: 180,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg2)",
                color: "var(--text)",
                fontSize: 13,
              }}
            />
          </div>

          {loading ? (
            <p style={{ color: "var(--text2)" }}>Loading...</p>
          ) : filtered.length === 0 ? (
            <p style={{ color: "var(--text2)" }}>No projects found.</p>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 14,
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              }}
            >
              {filtered.map((project) => {
                const projectBoards = getProjectBoards(project);
                return (
                  <div
                    key={project._id || project.slug}
                    draggable="true"
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/json", JSON.stringify(project));
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      padding: 18,
                      background: "var(--card)",
                      cursor: "grab",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--accent)";
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border)";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <strong style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
                        {project.title || project.slug}
                      </strong>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {projectBoards.length > 0 ? projectBoards.map((board) => (
                          <span
                            key={board}
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              padding: "3px 7px",
                              borderRadius: 5,
                              background: "rgba(56,189,248,0.15)",
                              color: "var(--accent)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {board}
                          </span>
                        )) : (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              padding: "3px 7px",
                              borderRadius: 5,
                              background: "rgba(148,163,184,0.15)",
                              color: "var(--text2)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            unknown
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: "capitalize",
                            padding: "3px 7px",
                            borderRadius: 5,
                            background: `${getDifficultyDisplay(project.difficulty).bg}`,
                            color: getDifficultyDisplay(project.difficulty).color,
                            border: `1px solid ${getDifficultyDisplay(project.difficulty).color}40`,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {getDifficultyDisplay(project.difficulty).label}
                        </span>
                      </div>
                    </div>
                    <p
                      style={{
                        fontSize: 13,
                        color: "var(--text2)",
                        margin: "0 0 12px",
                        lineHeight: 1.5,
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {project.description || "No description"}
                    </p>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => handleOpenEditor(project)}
                        style={{
                          padding: "7px 12px",
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                          background: "transparent",
                          color: "var(--text)",
                          fontWeight: 700,
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        Open
                      </button>
                      {view === "my" && (
                        <button
                          type="button"
                          onClick={() => handleDelete(project)}
                          style={{
                            padding: "7px 12px",
                            borderRadius: 8,
                            border: "1px solid rgba(239,68,68,0.3)",
                            background: "rgba(239,68,68,0.08)",
                            color: "#f87171",
                            fontWeight: 700,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
