import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useGamification } from "../../context/GamificationContext.jsx";
import { PROJECTS } from "../../services/gamification/ProjectsConfig.js";
import {
  getClassAssignments,
  getClassroomNotices,
  getMyClassrooms,
  joinClassroomByCode
} from "../../services/classroomService.js";
import { normalizeJoinCode } from "../../components/common/test.js";
import {
  Cpu,
  Activity,
  Signal,
  Users,
  Settings,
  Bell,
  Plus,
  BookOpen,
  ClipboardList,
  Folder,
  Terminal,
  Layers,
  FileText,
  HelpCircle,
  X,
  TrendingUp,
  SlidersHorizontal,
  GraduationCap,
  ChevronDown,
  ChevronRight,
  Zap,
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
  Trash2
} from "lucide-react";
import PROJECT_DATA from "../../services/guidedProjects.json";
import { listProjects, deleteProject, formatProjectDate } from "../../services/projectStore.js";

const EXAMPLES_BASE_URL =
  import.meta.env.VITE_EXAMPLES_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:5000/examples" : "/examples");

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

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    currentLevel,
    currentLevelData,
    xpProgress,
    xp,
    completedProjects = []
  } = useGamification();

  const completedCount = completedProjects.length;
  const totalProjects = PROJECTS.length;

  const [classrooms, setClassrooms] = useState([]);
  const [assignmentsByClass, setAssignmentsByClass] = useState({});
  const [noticesByClass, setNoticesByClass] = useState({});
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [info, setInfo] = useState("");
  const [showGuidedProjects, setShowGuidedProjects] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState("classroom"); // "classroom" | "guided-projects" | "modules" | "adventure-map"
  const [isAdventureExpanded, setIsAdventureExpanded] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Guided Projects inline workspace states
  const [guidedDifficulty, setGuidedDifficulty] = useState("BEGINNER");
  const [guidedExpandedCategories, setGuidedExpandedCategories] = useState(buildDefaultCategoryState);
  const [imageErrors, setImageErrors] = useState({});

  // My Custom Projects directory states
  const [userProjects, setUserProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const loadDashboardData = async () => {
    setLoadingDashboard(true);
    setDashboardError("");

    try {
      const classroomList = await getMyClassrooms();
      setClassrooms(classroomList);

      if (classroomList.length === 0) {
        setAssignmentsByClass({});
        setNoticesByClass({});
        return;
      }

      const details = await Promise.all(
        classroomList.map(async (classroom) => {
          try {
            const [assignments, notices] = await Promise.all([
              getClassAssignments(classroom._id),
              getClassroomNotices(classroom._id)
            ]);

            return [classroom._id, { assignments, notices }];
          } catch (e) {
            return [classroom._id, { assignments: [], notices: [] }];
          }
        })
      );

      const assignmentMap = {};
      const noticeMap = {};

      details.forEach(([classId, payload]) => {
        assignmentMap[classId] = payload.assignments || [];
        noticeMap[classId] = payload.notices || [];
      });

      setAssignmentsByClass(assignmentMap);
      setNoticesByClass(noticeMap);
    } catch (loadError) {
      setDashboardError(loadError.message || "Failed to load student dashboard");
    } finally {
      setLoadingDashboard(false);
    }
  };

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
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (activeTab === "modules") {
      fetchUserProjects();
    }
  }, [activeTab, user]);

  useEffect(() => {
    if (!info) return undefined;
    const timeoutId = setTimeout(() => setInfo(""), 3200);
    return () => clearTimeout(timeoutId);
  }, [info]);

  // Combined upcoming assignments
  const upcomingTasks = useMemo(() => {
    const apiTasks = classrooms.flatMap((classroom) =>
      (assignmentsByClass[classroom._id] || []).map((assignment) => ({
        id: assignment._id,
        classId: classroom._id,
        className: classroom.name,
        title: assignment.title || "Assignment",
        description: assignment.description || "Complete assignment task.",
        dueDate: assignment.dueDate,
        tag: "UPCOMING",
        tagStyle: "task-tag--nextweek",
        cardStyle: "task-card--nextweek"
      }))
    );

    // Adapt API tasks tags based on timeline
    const formattedApiTasks = apiTasks.map((t) => {
      const now = new Date();
      const due = new Date(t.dueDate);
      const diffTime = due - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 1) {
        t.tag = "DUE TOMORROW";
        t.tagStyle = "task-tag--tomorrow";
        t.cardStyle = "task-card--tomorrow";
      } else if (diffDays <= 3) {
        t.tag = "DUE FRIDAY";
        t.tagStyle = "task-tag--friday";
        t.cardStyle = "task-card--friday";
      } else {
        t.tag = "NEXT WEEK";
        t.tagStyle = "task-tag--nextweek";
        t.cardStyle = "task-card--nextweek";
      }
      return t;
    });

    return formattedApiTasks;
  }, [assignmentsByClass, classrooms]);

  // Combined notifications list
  const notifications = useMemo(() => {
    const list = [];
    classrooms.forEach((classroom) => {
      // 1. Notices
      const notices = noticesByClass[classroom._id] || [];
      notices.forEach((notice) => {
        list.push({
          id: `notice-${notice._id}`,
          type: "announcement",
          classroomName: classroom.name,
          title: notice.title || "Class notice",
          body: notice.message,
          date: new Date(notice.createdAt),
          link: `/student/classes/${classroom._id}`
        });
      });

      // 2. Assignments
      const assignments = assignmentsByClass[classroom._id] || [];
      assignments.forEach((assignment) => {
        list.push({
          id: `assignment-${assignment._id}`,
          type: "assignment",
          classroomName: classroom.name,
          title: assignment.title || "Assignment",
          body: assignment.description || "New assignment available.",
          date: new Date(assignment.createdAt || assignment.dueDate),
          link: `/student/classes/${classroom._id}`
        });
      });
    });

    // Sort by date newest first
    return list.sort((a, b) => b.date - a.date);
  }, [classrooms, noticesByClass, assignmentsByClass]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleOpenJoinModal = () => {
    setJoinError("");
    setJoinCode("");
    setIsJoinModalOpen(true);
  };

  const handlePasteCode = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      setJoinCode(normalizeJoinCode(clipText));
    } catch (e) {
      setJoinError("Clipboard access blocked. Paste the code manually.");
    }
  };

  const handleJoinClass = async (event) => {
    event.preventDefault();

    const normalizedCode = normalizeJoinCode(joinCode);
    if (!normalizedCode) {
      setJoinError("Please enter a valid class code");
      return;
    }

    setJoinLoading(true);
    setJoinError("");

    try {
      await joinClassroomByCode(normalizedCode);
      setIsJoinModalOpen(false);
      setInfo("Joined class successfully.");
      await loadDashboardData();
    } catch (joinClassError) {
      setJoinError(joinClassError.message || "Failed to join class");
    } finally {
      setJoinLoading(false);
    }
  };

  const renderedClassrooms = useMemo(() => {
    return classrooms.map((cls, idx) => ({
      ...cls,
      bannerType: idx % 2 === 0 ? "blue" : "dark",
      footerIcons: idx % 2 === 0 ? ["folder", "terminal", "chart"] : ["folder", "terminal"]
    }));
  }, [classrooms]);

  return (
    <div className="student-db-layout">
      {/* Top Header Bar */}
      <header className="student-db-header">
        <div className="student-db-header__left">
          <Link to="/" className="student-db-header__brand">
            <img
              src="/logo-Photoroom.png"
              alt="OpenHW Studio"
              style={{ height: "50px", objectFit: "contain" }}
            />
          </Link>
        </div>

        <nav className="student-db-header__nav">
          <button className="student-db-header__nav-link is-active">
            Workbench
          </button>
          <button
            onClick={() => navigate("/simulator")}
            className="student-db-header__nav-link"
          >
            Simulation
          </button>
          <button className="student-db-header__nav-link">Telemetry</button>
          <button className="student-db-header__nav-link">Hardware</button>
        </nav>

        <div className="student-db-header__right" style={{ position: "relative" }}>
          <button className="student-db-header__icon-btn" title="Settings">
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="student-db-header__icon-btn"
            title="Notifications"
            style={{ position: "relative" }}
          >
            <Bell className="w-4 h-4" />
            {notifications.length > 0 && (
              <span style={{
                position: "absolute",
                top: "-2px",
                right: "-2px",
                background: "#ef4444",
                color: "#ffffff",
                fontSize: "9px",
                fontWeight: "900",
                borderRadius: "50%",
                width: "14px",
                height: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                {notifications.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <>
              <div
                onClick={() => setShowNotifications(false)}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 9998,
                  background: "transparent"
                }}
              />
              <div style={{
                position: "absolute",
                top: "48px",
                right: "60px",
                width: "360px",
                maxHeight: "480px",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "12px",
                boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                zIndex: 9999,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden"
              }}>
                <div style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#f8fafc"
                }}>
                  <span style={{ fontWeight: 800, fontSize: "14px", color: "#0f172a" }}>Notifications</span>
                  <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700 }}>{notifications.length} new</span>
                </div>
                
                <div style={{ overflowY: "auto", flex: 1 }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: "32px 16px", textAlign: "center", color: "#64748b" }}>
                      <Bell className="w-8 h-8" style={{ margin: "0 auto 8px auto", opacity: 0.4 }} />
                      <span style={{ fontSize: "13px" }}>No new notifications.</span>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          navigate(n.link);
                          setShowNotifications(false);
                        }}
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid #f1f5f9",
                          cursor: "pointer",
                          display: "flex",
                          gap: "12px",
                          transition: "background 0.2s"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                      >
                        <div style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          background: n.type === "announcement" ? "#eff6ff" : "#fef2f2",
                          color: n.type === "announcement" ? "#2563eb" : "#ef4444",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0
                        }}>
                          {n.type === "announcement" ? <Megaphone className="w-4 h-4" /> : <ClipboardList className="w-4 h-4" />}
                        </div>
                        
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", textAlign: "left" }}>
                          <span style={{ fontSize: "10px", fontWeight: 800, color: "#64748b", letterSpacing: "0.02em" }}>
                            {n.classroomName.toUpperCase()} · {n.type.toUpperCase()}
                          </span>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                            {n.title}
                          </span>
                          <p style={{
                            margin: 0,
                            fontSize: "12px",
                            color: "#475569",
                            lineHeight: "1.4",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden"
                          }}>
                            {n.body}
                          </p>
                          <span style={{ fontSize: "10px", color: "#94a3b8", marginTop: "4px" }}>
                            {new Date(n.date).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          <button
            onClick={() => navigate("/simulator")}
            className="student-db-header__deploy-btn"
          >
            Deploy
          </button>
          <div
            onClick={() => navigate("/student/profile")}
            className="student-db-header__avatar"
            title="User Profile"
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
                  {user?.name || "Kernel v4.2"}
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
                onClick={() => {
                  setActiveTab("classroom");
                }}
                className={`student-db-sidebar__link ${
                  activeTab === "classroom" ? "is-active" : ""
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                Classroom
              </button>

              <button
                onClick={() => {
                  setActiveTab("guided-projects");
                }}
                className={`student-db-sidebar__link ${
                  activeTab === "guided-projects" ? "is-active" : ""
                }`}
              >
                <Folder className="w-4 h-4" />
                Guided Project
              </button>

              <button
                onClick={() => {
                  setActiveTab("modules");
                }}
                className={`student-db-sidebar__link ${
                  activeTab === "modules" ? "is-active" : ""
                }`}
              >
                <Layers className="w-4 h-4" />
                Modules
              </button>

              <div className="student-db-sidebar__accordion" style={{ width: '100%' }}>
                <button
                  onClick={() => {
                    setIsAdventureExpanded(!isAdventureExpanded);
                    setActiveTab("adventure-map");
                  }}
                  className={`student-db-sidebar__link ${
                    activeTab === "adventure-map" ? "is-active" : ""
                  }`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Activity className="w-4 h-4" />
                    <span>Adventure map</span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isAdventureExpanded ? 'rotate-180' : ''}`} style={{ transition: 'transform 0.2s' }} />
                </button>
                
                {isAdventureExpanded && (
                  <div className="student-db-sidebar__submenu" style={{ paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                    <Link
                      to="/adventure?journey=arduino"
                      className="student-db-sidebar__submenu-link"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 12px',
                        borderRadius: 8,
                        fontSize: 13,
                        color: 'var(--text-color, #475569)',
                        textDecoration: 'none',
                        transition: 'all 0.15s',
                        fontWeight: 600
                      }}
                      onMouseEnter={(e) => e.target.style.background = 'rgba(0,0,0,0.04)'}
                      onMouseLeave={(e) => e.target.style.background = 'transparent'}
                    >
                      🔵 Arduino Uno
                    </Link>
                    <Link
                      to="/adventure?journey=esp32"
                      className="student-db-sidebar__submenu-link"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 12px',
                        borderRadius: 8,
                        fontSize: 13,
                        color: 'var(--text-color, #475569)',
                        textDecoration: 'none',
                        transition: 'all 0.15s',
                        fontWeight: 600
                      }}
                      onMouseEnter={(e) => e.target.style.background = 'rgba(0,0,0,0.04)'}
                      onMouseLeave={(e) => e.target.style.background = 'transparent'}
                    >
                      📡 ESP32
                    </Link>
                  </div>
                )}
              </div>
            </nav>
          </div>

          <div className="student-db-sidebar__bottom">
            <nav className="student-db-sidebar__nav">
              <a
                href="https://openhwgroup.org"
                target="_blank"
                rel="noreferrer"
                className="student-db-sidebar__link"
              >
                <FileText className="w-4 h-4" />
                Docs
              </a>
              <button
                onClick={() =>
                  setInfo("Support module loading... Node ping stable.")
                }
                className="student-db-sidebar__link"
              >
                <HelpCircle className="w-4 h-4" />
                Support
              </button>
              <button
                onClick={handleLogout}
                className="student-db-sidebar__link text-red-600 hover:bg-red-50"
              >
                Sign Out
              </button>
            </nav>
          </div>
        </aside>

        {/* Content Column Switch */}
        {activeTab === "classroom" && (
          <>
            {/* Middle Column: Upcoming Tasks */}
            <div className="student-db-upcoming">
              <div className="student-db-upcoming__header">
                <span className="student-db-upcoming__title">
                  Upcoming Tasks
                </span>
                <button
                  className="student-db-upcoming__filter-btn"
                  title="Filter Tasks"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>
              </div>

              <div className="student-db-upcoming__list">
                {upcomingTasks.length === 0 ? (
                  <div className="upcoming-empty-state">
                    <ClipboardList className="upcoming-empty-state__icon w-8 h-8" />
                    <h4 className="upcoming-empty-state__title">No Upcoming Tasks</h4>
                    <p className="upcoming-empty-state__desc">
                      All caught up! Real assignments will appear here once assigned by your instructor.
                    </p>
                  </div>
                ) : (
                  upcomingTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`task-card ${task.cardStyle}`}
                    >
                      <span className={`task-tag ${task.tagStyle}`}>
                        {task.tag}
                      </span>
                      <h4 className="task-card__title">{task.title}</h4>
                      {task.description && (
                        <p className="task-card__desc">{task.description}</p>
                      )}
                      <div className="task-card__meta">
                        <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                        <span>{task.className}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Column: Active Rosters */}
            <main className="student-db-content">
              <section className="student-db-rosters">
                <header className="student-db-rosters__header">
                  <div className="student-db-rosters__title-area">
                    <h2>Active Rosters</h2>
                    <p>
                      Manage your enrolled courses and simulation instances.
                    </p>
                  </div>
                  <button
                    onClick={handleOpenJoinModal}
                    className="student-db-rosters__join-btn"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    JOIN NEW CLASS
                  </button>
                </header>

                <div className="roster-grid">
                  {renderedClassrooms.map((cls) => (
                    <div
                      key={cls._id}
                      onClick={() => navigate(`/student/classes/${cls._id}`)}
                      className="roster-card"
                    >
                      <div
                        className={`roster-card__banner roster-card__banner--${cls.bannerType}`}
                        style={cls.image ? { backgroundImage: `url(${cls.image})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                      >
                        <h3 className="roster-card__banner-title">{cls.name}</h3>
                        <Cpu className="roster-card__banner-icon w-5 h-5 opacity-80" />
                      </div>
                      <div className="roster-card__body">
                        <div className="roster-card__instructor">
                          <div className="roster-card__instructor-icon">
                            <Users className="w-3.5 h-3.5" />
                          </div>
                          <span className="roster-card__instructor-name">
                            {cls.teacher?.name || "Instructor"}
                          </span>
                        </div>
                        <div className="roster-card__code-block">
                          ID: {cls.code} | {cls.students?.length || 0} Students
                        </div>
                      </div>
                      <div className="roster-card__footer">
                        {cls.footerIcons.includes("folder") && (
                          <Folder className="roster-card__footer-icon w-4 h-4" />
                        )}
                        {cls.footerIcons.includes("terminal") && (
                          <Terminal className="roster-card__footer-icon w-4 h-4" />
                        )}
                        {cls.footerIcons.includes("chart") && (
                          <Activity className="roster-card__footer-icon w-4 h-4" />
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Join Module Dotted Card */}
                  <div
                    onClick={handleOpenJoinModal}
                    className="roster-card roster-card--join"
                  >
                    <div className="roster-card--join__circle">
                      <Plus className="w-5 h-5" />
                    </div>
                    <h4 className="roster-card--join__title">
                      Join another module
                    </h4>
                    <p className="roster-card--join__desc">
                      Enter a course code provided by your instructor to access
                      new simulation environments.
                    </p>
                  </div>
                </div>
              </section>
            </main>
          </>
        )}

        {/* Tab: Guided Projects Workspace Redesign */}
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

        {/* Tab: Modules (Redesigned as My Projects Directory) */}
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
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "16px",
                      padding: "48px",
                      textAlign: "center",
                      color: "#64748b",
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
                          {/* Thumbnail or Placeholder */}
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

                          {/* Card Body */}
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

                            {/* Actions Footer */}
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
                                      setInfo("Project deleted successfully.");
                                    } catch (err) {
                                      setInfo("Failed to delete project.");
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

        {/* Tab: Adventure map Placeholder Panel */}
        {activeTab === "adventure-map" && (
          <main className="student-db-content">
            <section className="student-db-rosters">
              <header className="student-db-rosters__header">
                <div className="student-db-rosters__title-area">
                  <h2>Adventure Map Progress</h2>
                  <p>Track your gamified learning journey and statistics.</p>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={() => navigate("/adventure?journey=arduino")}
                    className="student-db-rosters__join-btn"
                    style={{
                      borderColor: "#00979d",
                      color: "#00979d",
                      backgroundColor: "rgba(0, 151, 157, 0.05)",
                      fontWeight: 800
                    }}
                  >
                    🔵 Arduino Uno Map
                  </button>
                  <button
                    onClick={() => navigate("/adventure?journey=esp32")}
                    className="student-db-rosters__join-btn"
                    style={{
                      borderColor: "#e74c3c",
                      color: "#e74c3c",
                      backgroundColor: "rgba(231, 76, 60, 0.05)",
                      fontWeight: 800
                    }}
                  >
                    📡 ESP32 Map
                  </button>
                </div>
              </header>

              {/* Progress Panel */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "16px",
                  padding: "24px 32px",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.02)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "24px",
                    flexWrap: "wrap",
                    justifyContent: "space-between"
                  }}
                >
                  <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      <span
                        style={{
                          fontSize: "32px",
                          fontWeight: 900,
                          color: "#fbbf24",
                          fontFamily: "monospace"
                        }}
                      >
                        {xp}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#64748b",
                          fontWeight: 800,
                          letterSpacing: ".05em"
                        }}
                      >
                        ACCUMULATED XP
                      </span>
                    </div>

                    <div style={{ width: 1, height: "48px", background: "#e2e8f0" }} />

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      <span
                        style={{
                          fontSize: "32px",
                          fontWeight: 900,
                          color: "#10b981",
                          fontFamily: "monospace"
                        }}
                      >
                        {completedCount}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#64748b",
                          fontWeight: 800,
                          letterSpacing: ".05em"
                        }}
                      >
                        COMPLETED MAP NODES
                      </span>
                    </div>

                    <div style={{ width: 1, height: "48px", background: "#e2e8f0" }} />

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      <span
                        style={{
                          fontSize: "32px",
                          fontWeight: 900,
                          color: "#475569",
                          fontFamily: "monospace"
                        }}
                      >
                        {totalProjects - completedCount}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#64748b",
                          fontWeight: 800,
                          letterSpacing: ".05em"
                        }}
                      >
                        REMAINING TASKS
                      </span>
                    </div>

                    <div style={{ width: 1, height: "48px", background: "#e2e8f0" }} />

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      <span
                        style={{
                          fontSize: "32px",
                          fontWeight: 900,
                          color: currentLevelData?.color || "#10b981",
                          fontFamily: "monospace"
                        }}
                      >
                        {currentLevelData?.icon || "⭐"} {currentLevel}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#64748b",
                          fontWeight: 800,
                          letterSpacing: ".05em"
                        }}
                      >
                        WORKSTATION LEVEL
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      width: "180px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      gap: "8px"
                    }}
                  >
                    <div
                      style={{
                        height: "8px",
                        borderRadius: "99px",
                        background: "#f1f5f9",
                        overflow: "hidden"
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          borderRadius: "99px",
                          width: `${
                            Math.round((completedCount / totalProjects) * 100) || 0
                          }%`,
                          background: "linear-gradient(90deg, #10b981, #3b82f6)",
                          transition: "width .6s ease"
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#475569",
                        textAlign: "center",
                        fontWeight: 800
                      }}
                    >
                      {Math.round((completedCount / totalProjects) * 100) || 0}%
                      Map Cleared
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    borderTop: "1px dashed #e2e8f0",
                    paddingTop: "20px",
                    marginTop: "10px",
                    display: "flex",
                    gap: "12px"
                  }}
                >
                  <button
                    onClick={() => navigate("/adventure")}
                    className="student-db-sidebar__sim-btn"
                    style={{
                      backgroundColor: "#10b981",
                      padding: "10px 20px"
                    }}
                  >
                    🚀 Enter Learning Map
                  </button>
                  <button
                    onClick={() => navigate("/components")}
                    className="student-db-rosters__join-btn"
                    style={{ margin: 0 }}
                  >
                    🧰 View My Unlocked Components
                  </button>
                </div>
              </div>
            </section>
          </main>
        )}
      </div>

      {/* Join Classroom Modal */}
      {isJoinModalOpen && (
        <div
          className="teacher-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Join class with code"
        >
          <div
            className="teacher-modal__backdrop"
            onClick={() => setIsJoinModalOpen(false)}
          />
          <section className="teacher-modal__content student-join-modal">
            <header className="teacher-modal__header student-join-modal__header">
              <h3>Join class</h3>
              <button
                type="button"
                onClick={() => setIsJoinModalOpen(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </header>

            <form className="teacher-modal__form" onSubmit={handleJoinClass}>
              <p className="student-join-modal__hint">
                Ask your teacher for the class code and enter it below.
              </p>

              <label>
                <span>Class code</span>
                <input
                  type="text"
                  className="student-join-modal__input"
                  value={joinCode}
                  onChange={(event) =>
                    setJoinCode(normalizeJoinCode(event.target.value))
                  }
                  placeholder="AB12CD"
                  autoFocus
                />
              </label>

              {joinError ? (
                <p className="teacher-inline-state teacher-inline-state--error">
                  {joinError}
                </p>
              ) : null}

              <div className="teacher-modal__actions">
                <button
                  type="button"
                  className="teacher-button teacher-button--ghost"
                  onClick={handlePasteCode}
                >
                  Paste code
                </button>
                <button
                  type="button"
                  className="teacher-button teacher-button--ghost"
                  onClick={() => setIsJoinModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="teacher-button teacher-button--primary"
                  disabled={joinLoading}
                >
                  {joinLoading ? "Joining..." : "Join class"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Guided Projects drawer removed - rendered inline */}

      {/* Toast Messages */}
      {info && (
        <div className="teacher-toast" role="status">
          {info}
        </div>
      )}
    </div>
  );
}