import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  Cpu,
  Activity,
  Signal,
  Bell,
  Plus,
  Folder,
  Terminal,
  Layers,
  FileText,
  X,
  Sliders,
  Eye,
  Smartphone,
  Wifi,
  Target,
  BarChart3,
  Microchip,
  Megaphone,
  Palette,
  Thermometer,
  ToggleLeft,
  Sun,
  Moon,
  Monitor,
  Hash,
  Droplet,
  Bluetooth,
  Tv,
  Trash2,
  Lock,
  ChevronDown,
  ChevronRight,
  Zap
} from "lucide-react";
import PROJECT_DATA from "../../services/guidedProjects.json";
import { listProjects, deleteProject, formatProjectDate } from "../../services/projectStore.js";

const EXAMPLES_BASE_URL =
  import.meta.env.VITE_EXAMPLES_BASE_URL || '/api/examples';

const LEVEL_ICONS = { BEGINNER: Terminal, INTERMEDIATE: BarChart3, ADVANCED: Target };
const CATEGORY_ICONS = { Zap, Sliders, Eye, Smartphone, Layers, Cpu, Wifi, Terminal, BarChart3, Target, Microchip };

const TrafficLightIcon = (props) => (
  <svg
    width={props.size || 14}
    height={props.size || 14}
    viewBox="0 0 24 24"
    fill="none"
    stroke={props.color || "currentColor"}
    strokeWidth={props.strokeWidth || 2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={props.className}
    style={props.style}
  >
    <rect x="8" y="2" width="8" height="20" rx="4" ry="4" />
    <circle cx="12" cy="7" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="17" r="2" />
  </svg>
);

function getProjectIcon(slug, title) {
  const s = slug ? slug.toLowerCase() : "";
  const t = title ? title.toLowerCase() : "";

  if (t.includes("rgb led")) return Palette;
  if (t.includes("led") || s.includes("led")) return Microchip;
  if (t.includes("buzzer") || t.includes("alarm") || t.includes("sound")) return Megaphone;
  if (t.includes("traffic light") || s.includes("traffic")) return TrafficLightIcon;
  if (t.includes("temperature") || t.includes("thermometer") || s.includes("temp") || t.includes("dht")) return Thermometer;
  if (t.includes("button") || t.includes("switch")) return ToggleLeft;
  if (t.includes("potentiometer") || t.includes("brightness")) return Sliders;
  if (t.includes("light") || t.includes("ldr") || t.includes("dark")) return Sun;
  if (t.includes("lcd") || t.includes("display") || t.includes("screen")) return Monitor;
  if (t.includes("counter")) return Hash;
  if (t.includes("water") || t.includes("level") || t.includes("liquid")) return Droplet;
  if (t.includes("bluetooth")) return Bluetooth;
  if (t.includes("wifi") || t.includes("esp32") || t.includes("esp8266")) return Wifi;
  if (t.includes("remote") || t.includes("ir") || t.includes("rf")) return Tv;
  if (t.includes("robot") || t.includes("avoid") || t.includes("follow")) return Cpu;
  if (t.includes("dustbin") || t.includes("trash")) return Trash2;

  return Microchip;
}

function findLevelColor(projectSlug) {
  for (const level of Object.values(PROJECT_DATA)) {
    for (const cat of Object.values(level.categories)) {
      if (cat.projects.some((p) => p.slug === projectSlug)) return level.color;
    }
  }
  return "#22c55e";
}

function buildDefaultCategoryState() {
  const state = {};
  Object.entries(PROJECT_DATA).forEach(([levelKey, level]) => {
    Object.keys(level.categories).forEach((catKey) => {
      state[`${levelKey}-${catKey}`] = `${levelKey}-${catKey}` === "BEGINNER-Basic Output";
    });
  });
  return state;
}

function getBoardLabel(type) {
  const map = {
    arduino_uno: "Arduino Uno",
    "esp-32": "ESP32",
    pico: "Raspberry Pi Pico",
  };
  return map[type] || type || "Board";
}

export default function UserDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("guided-projects");
  const [guidedDifficulty, setGuidedDifficulty] = useState("BEGINNER");
  const [guidedExpandedCategories, setGuidedExpandedCategories] = useState(buildDefaultCategoryState);
  const [imageErrors, setImageErrors] = useState({});

  const [userProjects, setUserProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const fetchUserProjects = async () => {
    setLoadingProjects(true);
    try {
      const owner = user?.email || "guest";
      const projectsList = await listProjects(owner);
      setUserProjects(projectsList || []);
    } catch (err) {
      console.error("Failed to fetch user projects:", err);
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    if (activeTab === "modules") {
      fetchUserProjects();
    }
  }, [activeTab, user]);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="student-db-layout">
      {/* Top Header Bar */}
      <header className="student-db-header">
        <div className="student-db-header__left">
          <Link to="/" className="student-db-header__brand">
            <img
              src="/logo-cropped.png"
              alt="OpenHW Studio"
              style={{ height: "65px", width: "130px", objectFit: "contain" }}
            />
          </Link>
        </div>

        <div className="student-db-header__right">
          <div
            onClick={() => navigate("/user/profile")}
            className="student-db-header__avatar"
            title="User Profile"
            style={{ cursor: "pointer" }}
          >
            {user?.image ? (
              <img src={user.image} alt={user?.name || "Profile"} />
            ) : (
              <span>{user?.name ? user.name.slice(0, 2).toUpperCase() : "KV"}</span>
            )}
          </div>
        </div>
      </header>

      {/* Main Workstation Body */}
      <div className="student-db-main-container">
        {/* Left Sidebar */}
        <aside className="student-db-sidebar">
          <div className="student-db-sidebar__top">
            {/* Workstation Profile Card */}
            <div className="student-db-profile-card">
              <div className="student-db-profile-card__monogram">
                {user?.image ? (
                  <img
                    src={user.image}
                    alt={user?.name || "Profile"}
                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
                  />
                ) : (
                  user?.name ? user.name.slice(0, 2).toUpperCase() : "KV"
                )}
              </div>
              <div className="student-db-profile-card__info">
                <span className="student-db-profile-card__title">
                  {user?.name || "User Node"}
                </span>
                <span className="student-db-profile-card__sub">
                  JWT: Authenticated
                </span>
              </div>
            </div>

            <button
              onClick={() => navigate("/simulator")}
              className="student-db-sidebar__sim-btn"
            >
              <Plus className="w-4 h-4" />
              New Simulation
            </button>

            <nav className="student-db-sidebar__nav">
              <button
                onClick={() => setActiveTab("guided-projects")}
                className={`student-db-sidebar__link ${activeTab === "guided-projects" ? "is-active" : ""}`}
              >
                <Folder className="w-4 h-4" />
                Guided Project
              </button>

              <button
                onClick={() => setActiveTab("modules")}
                className={`student-db-sidebar__link ${activeTab === "modules" ? "is-active" : ""}`}
              >
                <Layers className="w-4 h-4" />
                Modules
              </button>
            </nav>
          </div>

          <div className="student-db-sidebar__bottom">
            <nav className="student-db-sidebar__nav">
              <a
                href="https://openhw-studio.fossee.in/docs/"
                target="_blank"
                rel="noreferrer"
                className="student-db-sidebar__link"
              >
                <FileText className="w-4 h-4" />
                Docs
              </a>

              <button
                onClick={handleLogout}
                className="student-db-sidebar__link"
              >
                Sign Out
              </button>
            </nav>
          </div>
        </aside>

        {/* Content Column Switch */}
        {activeTab === "guided-projects" && (
          <main className="student-db-content">
            <section className="student-db-rosters">
              <header className="student-db-rosters__header">
                <div className="student-db-rosters__title-area">
                  <h2>Guided Projects Workspace</h2>
                  <p>Access pre-configured hardware simulator modules, schematics, and exercises.</p>
                </div>
              </header>

              <div className="guided-projects-workspace">
                {/* Difficulty Segmented Controls */}
                <div className="guided-difficulty-container">
                  {Object.entries(PROJECT_DATA).map(([levelKey, level]) => {
                    const LevelIcon = LEVEL_ICONS[levelKey] || Terminal;
                    const isActive = guidedDifficulty === levelKey;
                    let btnClass = "guided-difficulty-btn";
                    if (levelKey === "BEGINNER") btnClass += " guided-difficulty-btn--beginner";
                    if (levelKey === "INTERMEDIATE") btnClass += " guided-difficulty-btn--intermediate";
                    if (levelKey === "ADVANCED") btnClass += " guided-difficulty-btn--advanced";

                    return (
                      <button
                        key={levelKey}
                        className={`${btnClass} ${isActive ? "is-active" : ""}`}
                        onClick={() => setGuidedDifficulty(levelKey)}
                      >
                        <LevelIcon size={14} style={{ flexShrink: 0 }} />
                        <span>{level.label.replace(" LEVEL", "")}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Categories and Accordions */}
                <div className="guided-categories-list">
                  {Object.entries(PROJECT_DATA[guidedDifficulty]?.categories || {}).map(([catKey, category]) => {
                    const catId = `${guidedDifficulty}-${catKey}`;
                    const isExpanded = !!guidedExpandedCategories[catId];
                    const CatIcon = CATEGORY_ICONS[category.icon] || Microchip;

                    return (
                      <div
                        key={catKey}
                        className={`guided-category-accordion ${isExpanded ? "is-expanded" : ""}`}
                      >
                        {/* Accordion Header */}
                        <button
                          className="guided-category-header"
                          onClick={() => {
                            setGuidedExpandedCategories(prev => ({
                              ...prev,
                              [catId]: !prev[catId]
                            }));
                          }}
                        >
                          <div className="guided-category-header__left">
                            <div className="guided-category-header__icon-wrapper">
                              <CatIcon size={16} strokeWidth={2.5} />
                            </div>
                            <span className="guided-category-header__title">{catKey}</span>
                          </div>
                          <div className="guided-category-header__right">
                            <span className="guided-category-header__badge">
                              {category.projects?.length || 0} Projects
                            </span>
                            <ChevronDown
                              size={16}
                              className="guided-category-header__chevron"
                            />
                          </div>
                        </button>

                        {/* Accordion Expanded Content */}
                        {isExpanded && (
                          <div className="guided-category-content">
                            <div className="guided-project-grid">
                              {category.projects.map((project) => {
                                const ProjectIcon = getProjectIcon(project.slug, project.title);
                                const hasImageError = !!imageErrors[project.slug];
                                const imageUrl = project.slug === "buzzer"
                                  ? `${EXAMPLES_BASE_URL}/Turn_on_Buzzer/Turn_on_Buzzer.png`
                                  : `${EXAMPLES_BASE_URL}/${project.slug}/circuit.png`;

                                return (
                                  <div
                                    key={project.slug}
                                    className="guided-project-card"
                                    onClick={() => {
                                      const levelColor = findLevelColor(project.slug);
                                      navigate(`/${project.slug}/demo`, {
                                        state: { guidedProject: project, levelColor }
                                      });
                                    }}
                                  >
                                    {/* Image Preview Container */}
                                    <div className="guided-project-card__img-container">
                                      {!hasImageError ? (
                                        <img
                                          src={imageUrl}
                                          alt={project.title}
                                          className="guided-project-card__img"
                                          onError={() => {
                                            setImageErrors(prev => ({
                                              ...prev,
                                              [project.slug]: true
                                            }));
                                          }}
                                        />
                                      ) : (
                                        <div className="guided-project-card__fallback">
                                          <ProjectIcon
                                            className="guided-project-card__fallback-icon"
                                            size={28}
                                          />
                                          <span className="guided-project-card__fallback-text">
                                            {project.slug}
                                          </span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Card Body */}
                                    <div className="guided-project-card__body">
                                      <h4 className="guided-project-card__title">
                                        {project.title}
                                      </h4>
                                      <p className="guided-project-card__desc">
                                        {project.description}
                                      </p>

                                      {/* Tags */}
                                      <div className="guided-project-card__tags">
                                        {project.board && (
                                          <span className="guided-project-card__tag guided-project-card__tag--board">
                                            {project.board}
                                          </span>
                                        )}
                                        {project.components?.slice(0, 2).map((comp, cIdx) => (
                                          <span key={cIdx} className="guided-project-card__tag">
                                            {comp}
                                          </span>
                                        ))}
                                        {project.components?.length > 2 && (
                                          <span className="guided-project-card__tag">
                                            +{project.components.length - 2}
                                          </span>
                                        )}
                                      </div>

                                      {/* Action Button */}
                                      <button className="guided-project-card__action">
                                        LAUNCH WORKBENCH // [RUN]
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </main>
        )}

        {activeTab === "modules" && (
          <main className="student-db-content">
            <section className="student-db-rosters">
              <header className="student-db-rosters__header">
                <div className="student-db-rosters__title-area">
                  <h2>My Projects Directory</h2>
                  <p>Access, manage, and launch your custom simulation layouts and designs.</p>
                </div>
                <button
                  onClick={() => navigate("/simulator")}
                  className="student-db-rosters__join-btn"
                >
                  <Plus className="w-3.5 h-3.5" />
                  CREATE NEW SIMULATION
                </button>
              </header>

              <div className="user-projects-workspace">
                {loadingProjects ? (
                  <div
                    style={{
                      background: "var(--bg2)",
                      border: "1px solid var(--border)",
                      borderRadius: "16px",
                      padding: "48px",
                      textAlign: "center",
                      color: "var(--text2)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "12px"
                    }}
                  >
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span style={{ fontSize: "12px", fontWeight: "700", fontFamily: "monospace", letterSpacing: "0.05em" }}>
                      FETCHING PERSONAL REGISTRY...
                    </span>
                  </div>
                ) : userProjects.length === 0 ? (
                  <div className="user-project-empty-state">
                    <div className="user-project-empty-state__icon-wrap">
                      <Folder className="w-8 h-8" />
                    </div>
                    <h4 className="user-project-empty-state__title">
                      No Saved Circuits Found
                    </h4>
                    <p className="user-project-empty-state__desc">
                      Create custom designs in the simulator, save them, and they will appear in your directory here.
                    </p>
                    <button
                      onClick={() => navigate("/simulator")}
                      className="student-db-sidebar__sim-btn"
                      style={{ display: "inline-flex", margin: "0 auto" }}
                    >
                      [ Launch Simulator Workbench ]
                    </button>
                  </div>
                ) : (
                  <div className="user-project-grid">
                    {userProjects.map((proj) => {
                      const projBoard = getBoardLabel(proj.board);
                      const partsCount = proj.components?.length || 0;
                      const dateStr = proj.savedAt ? formatProjectDate(proj.savedAt) : "N/A";

                      return (
                        <div key={proj.id} className="user-project-card">
                          <div className="user-project-card__thumbnail-wrap">
                            {proj.thumbnail ? (
                              <img
                                src={proj.thumbnail}
                                alt={proj.name || "Untitled"}
                                className="user-project-card__thumbnail"
                              />
                            ) : (
                              <div className="user-project-card__placeholder">
                                <Cpu className="user-project-card__placeholder-icon w-8 h-8" />
                                <span className="user-project-card__placeholder-text">
                                  {projBoard.toUpperCase()} LAYOUT
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="user-project-card__body">
                            <h4 className="user-project-card__title" title={proj.name || "Untitled"}>
                              {proj.name || "Untitled"}
                            </h4>

                            <div className="user-project-card__meta">
                              <span className="user-project-card__board">{projBoard}</span>
                              <span className="user-project-card__count">{partsCount} parts</span>
                            </div>

                            <span className="user-project-card__date">
                              SAVED: {dateStr.toUpperCase()}
                            </span>

                            <div className="user-project-card__footer">
                              <button
                                type="button"
                                className="user-project-card__btn-delete"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (
                                    window.confirm(
                                      `Are you sure you want to delete "${proj.name || "Untitled"}"?`
                                    )
                                  ) {
                                    try {
                                      await deleteProject(proj.id, user?.email || "guest");
                                      setUserProjects((prev) => prev.filter((p) => p.id !== proj.id));
                                    } catch (err) {
                                      console.error("Failed to delete project:", err);
                                    }
                                  }
                                }}
                                title="Delete Project"
                              >
                                <Trash2 size={16} />
                              </button>

                              <button
                                type="button"
                                className="user-project-card__btn-open"
                                onClick={() => navigate("/simulator", { state: { loadProjectId: proj.id } })}
                              >
                                OPEN WORKBENCH // [EDIT]
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </main>
        )}
      </div>
    </div>
  );
}
