import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Plus, Settings, Bell, GraduationCap, Layers, FileText, HelpCircle,
  FolderKanban, ArrowLeft, Search, Trash2, ExternalLink, Cpu,
  BookOpen, Share2, Filter,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  getMyProjectBank,
  getSharedProjectBank,
  deleteProjectBankEntry,
} from "../../services/projectBankService";
import { getDifficultyDisplay } from "../../services/gamification/ProjectsConfig.js";

/* ─── Helpers ─────────────────────────────────────────────────── */
function getProjectBoardType(project) {
  const components = project.components || [];
  const boardTypes = ["arduino-uno", "arduino-nano", "arduino-mega", "pico", "pico-w"];
  for (const comp of components) {
    const t = String(comp.type || comp.id || "").replace(/^openhw-/, "").replace(/^wokwi-/, "");
    for (const bt of boardTypes) {
      if (t.includes(bt)) return bt;
    }
  }
  return "unknown";
}

const BOARD_COLORS = {
  "arduino-uno": { bg: "rgba(0, 128, 0, 0.1)", color: "#16a34a" },
  "arduino-nano": { bg: "rgba(0, 128, 0, 0.1)", color: "#16a34a" },
  "arduino-mega": { bg: "rgba(37, 99, 235, 0.1)", color: "#2563eb" },
  "pico": { bg: "rgba(124, 58, 237, 0.1)", color: "#7c3aed" },
  "pico-w": { bg: "rgba(124, 58, 237, 0.1)", color: "#7c3aed" },
  "unknown": { bg: "rgba(100, 116, 139, 0.1)", color: "#64748b" },
};

/* ─── Component ───────────────────────────────────────────────── */
export default function TeacherProjectBankPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [view, setView] = useState("my");
  const [myProjects, setMyProjects] = useState([]);
  const [sharedProjects, setSharedProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [boardFilter, setBoardFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const initials = user?.name ? user.name.slice(0, 2).toUpperCase() : "TC";

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

  useEffect(() => { load(); }, [view]);

  const current = view === "my" ? myProjects : sharedProjects;

  const boards = useMemo(() => {
    const s = new Set();
    current.forEach((p) => {
      const b = getProjectBoardType(p);
      if (b && b !== "unknown") s.add(b);
    });
    return Array.from(s).sort();
  }, [current]);

  const filtered = useMemo(() => {
    let list = current;
    if (boardFilter !== "all") list = list.filter((p) => getProjectBoardType(p) === boardFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) => (p.title || "").toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [current, boardFilter, searchQuery]);

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

  /* ── Render ── */
  return (
    <div className="student-db-layout">

      {/* ── Top Header ── */}
      <header className="student-db-header">
        <div className="student-db-header__left">
          <Link to="/" className="student-db-header__brand">
            <img src="/logo-cropped.png" alt="OpenHW Studio" style={{ height: "65px", width: "130px", objectFit: "contain" }} />
          </Link>
        </div>


        <div className="student-db-header__right">
          <button className="student-db-header__icon-btn" title="Notifications"><Bell size={16} /></button>
          <button onClick={handleCreateNew} className="student-db-header__deploy-btn">
            + New Project
          </button>
          <div
            onClick={() => navigate("/teacher/profile")}
            className="student-db-header__avatar"
            title="Teacher Profile"
          >
            {user?.image ? <img src={user.image} alt={user?.name} /> : <span>{initials}</span>}
          </div>
        </div>
      </header>

      {/* ── Main Body ── */}
      <div className="student-db-main-container">

        {/* ── Left Sidebar ── */}
        <aside className="student-db-sidebar">
          <div className="student-db-sidebar__top">
            <div className="student-db-profile-card">
              <div className="student-db-profile-card__monogram">{initials}</div>
              <div className="student-db-profile-card__info">
                <span className="student-db-profile-card__title">{user?.name || "Teacher"}</span>
                <span className="student-db-profile-card__sub">TEACHER · Authenticated</span>
              </div>
            </div>

            <button
              onClick={handleCreateNew}
              className="student-db-sidebar__sim-btn"
            >
              <Plus size={16} />
              New Project
            </button>

            <nav className="student-db-sidebar__nav">
              <button
                onClick={() => navigate("/teacher/dashboard")}
                className="student-db-sidebar__link"
              >
                <ArrowLeft size={16} /> Back to Dashboard
              </button>
              <button
                onClick={() => setView("my")}
                className={`student-db-sidebar__link ${view === "my" ? "is-active" : ""}`}
              >
                <FolderKanban size={16} /> My Projects
              </button>
              <button
                onClick={() => setView("shared")}
                className={`student-db-sidebar__link ${view === "shared" ? "is-active" : ""}`}
              >
                <Share2 size={16} /> Shared Projects
              </button>
              <button onClick={() => navigate("/simulator")} className="student-db-sidebar__link">
                <Layers size={16} /> Simulator
              </button>
            </nav>
          </div>

          <div className="student-db-sidebar__bottom">
            <nav className="student-db-sidebar__nav">
              <a href="https://openhw-studio.fossee.in/docs/" target="_blank" rel="noreferrer" className="student-db-sidebar__link">
                <FileText size={16} /> Docs
              </a>

              <button
                onClick={async () => { await logout(); navigate("/"); }}
                className="student-db-sidebar__link"
                style={{ color: "#ef4444" }}
              >
                Sign Out
              </button>
            </nav>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="student-db-content">
          <section className="student-db-rosters">

            {/* Header */}
            <header className="student-db-rosters__header">
              <div className="student-db-rosters__title-area">
                <h2>{view === "my" ? "My Project Bank" : "Shared Projects"}</h2>
                <p>
                  {view === "my"
                    ? "Your personal collection of saved project templates."
                    : "Publicly shared project templates from the community."}
                </p>
              </div>
              <button onClick={handleCreateNew} className="student-db-rosters__join-btn">
                <Plus size={14} />
                NEW PROJECT
              </button>
            </header>

            {/* Error */}
            {error && (
              <div style={{
                color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: "10px", padding: "12px 16px", fontSize: "13px",
              }}>
                {error}
              </div>
            )}

            {/* Filters row */}
            <div className="project-bank-filters">
              <div className="project-bank-filters__search">
                <Search size={14} className="project-bank-filters__search-icon" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="project-bank-filters__input"
                />
              </div>

              <div className="project-bank-filters__board">
                <Filter size={14} style={{ color: "#64748b", flexShrink: 0 }} />
                <select
                  value={boardFilter}
                  onChange={(e) => setBoardFilter(e.target.value)}
                  className="project-bank-filters__select"
                >
                  <option value="all">All Boards</option>
                  {boards.map((b) => (
                    <option key={b} value={b}>{b.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              {/* View toggle */}
              <div className="project-bank-filters__toggle">
                {["my", "shared"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setView(t)}
                    className={`project-bank-tab-btn ${view === t ? "is-active" : ""}`}
                  >
                    {t === "my" ? "My Projects" : "Shared"}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            {loading ? (
              <div className="project-bank-loading">
                <div className="project-bank-loading__spinner" />
                <span>LOADING PROJECT REGISTRY...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="user-project-empty-state">
                <div className="user-project-empty-state__icon-wrap">
                  <FolderKanban size={32} />
                </div>
                <h4 className="user-project-empty-state__title">No Projects Found</h4>
                <p className="user-project-empty-state__desc">
                  {view === "my"
                    ? "Create your first project template to get started."
                    : "No shared projects match your search."}
                </p>
                {view === "my" && (
                  <button onClick={handleCreateNew} className="student-db-sidebar__sim-btn" style={{ display: "inline-flex", margin: "0 auto" }}>
                    + Create New Project
                  </button>
                )}
              </div>
            ) : (
              <div className="project-bank-grid">
                {filtered.map((project) => {
                  const board = getProjectBoardType(project);
                  const boardStyle = BOARD_COLORS[board] || BOARD_COLORS["unknown"];
                  return (
                    <div
                      key={project._id || project.slug}
                      draggable="true"
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify(project));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      className="project-bank-card"
                    >
                      {/* Card header stripe */}
                      <div className="project-bank-card__stripe" />

                      {/* Title + board badge */}
                      <div className="project-bank-card__head">
                        <div className="project-bank-card__icon-wrap">
                          <Cpu size={18} />
                        </div>
                        <span
                          className="project-bank-card__board-badge"
                          style={{ background: boardStyle.bg, color: boardStyle.color }}
                        >
                          {board === "unknown" ? "BOARD" : board.toUpperCase()}
                        </span>
                      </div>

                      <div className="project-bank-card__body">
                        <h4 className="project-bank-card__title">
                          {project.title || project.slug}
                        </h4>
                        <p className="project-bank-card__desc">
                          {project.description || "No description provided."}
                        </p>

                        {/* Meta tags */}
                        <div className="project-bank-card__tags">
                          {project.nodes?.length > 0 && (
                            <span className="project-bank-card__tag">
                              <BookOpen size={11} /> {project.nodes.length} Nodes
                            </span>
                          )}
                          {project.xpReward && (
                            <span className="project-bank-card__tag project-bank-card__tag--xp">
                              {project.xpReward} XP
                            </span>
                          )}
                          {project.difficulty && (
                            <span
                              className="project-bank-card__tag"
                              style={{
                                background: getDifficultyDisplay(project.difficulty).bg,
                                color: getDifficultyDisplay(project.difficulty).color,
                                border: `1px solid ${getDifficultyDisplay(project.difficulty).color}40`,
                              }}
                            >
                              {getDifficultyDisplay(project.difficulty).label}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="project-bank-card__footer">
                        <button
                          type="button"
                          onClick={() => handleOpenEditor(project)}
                          className="project-bank-card__btn-open"
                        >
                          <ExternalLink size={13} />
                          Open Editor
                        </button>
                        {view === "my" && (
                          <button
                            type="button"
                            onClick={() => handleDelete(project)}
                            className="project-bank-card__btn-delete"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Create new dotted card */}
                {view === "my" && (
                  <div onClick={handleCreateNew} className="project-bank-card project-bank-card--new">
                    <div className="roster-card--join__circle">
                      <Plus size={22} />
                    </div>
                    <h4 className="roster-card--join__title">New Project Template</h4>
                    <p className="roster-card--join__desc">
                      Create a reusable project template for your adventure map.
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
