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
import GuidedProjectsPanel from "../../components/student/GuidedProjectsSection.jsx";
import {
  Cpu,
  Activity,
  Signal,
  Users,
  Settings,
  Bell,
  Plus,
  BookOpen,
  Folder,
  Terminal,
  Layers,
  FileText,
  HelpCircle,
  X,
  TrendingUp,
  SlidersHorizontal,
  GraduationCap
} from "lucide-react";

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

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (!info) return undefined;
    const timeoutId = setTimeout(() => setInfo(""), 3200);
    return () => clearTimeout(timeoutId);
  }, [info]);

  // Combined upcoming assignments + fallback mock tasks
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

    // Default mock tasks from wireframe layout
    const mockTasks = [
      {
        id: "mock-1",
        className: "Arch 301",
        title: "Implement RISC-V ALU",
        description:
          "Complete the arithmetic logic unit module and run initial verification testbenches.",
        tag: "DUE TOMORROW",
        tagStyle: "task-tag--tomorrow",
        cardStyle: "task-card--tomorrow"
      },
      {
        id: "mock-2",
        className: "Embedded Systems",
        title: "UART Telemetry Driver",
        description:
          "Write the C driver for the hardware UART interface to stream telemetry data to the...",
        tag: "DUE FRIDAY",
        tagStyle: "task-tag--friday",
        cardStyle: "task-card--friday"
      },
      {
        id: "mock-3",
        className: "Arch 301",
        title: "Read Pipeline Hazards",
        description:
          "Review textbook chapter 4 and prepare notes on structural, data, and control hazards.",
        tag: "NEXT WEEK",
        tagStyle: "task-tag--nextweek",
        cardStyle: "task-card--nextweek"
      }
    ];

    if (apiTasks.length === 0) {
      return mockTasks;
    }

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

    return [...formattedApiTasks, ...mockTasks].slice(0, 5);
  }, [assignmentsByClass, classrooms]);

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

  // Mock fallbacks for classroom cards to match the design aesthetics when list is empty
  const renderedClassrooms = useMemo(() => {
    const mockClasses = [
      {
        _id: "mock-class-1",
        name: "Intro to Embedded Systems",
        code: "EE-204",
        teacher: { name: "Prof. Vance" },
        students: Array(45).fill(0),
        bannerType: "blue",
        footerIcons: ["folder", "terminal", "chart"]
      },
      {
        _id: "mock-class-2",
        name: "Advanced Computer Architecture",
        code: "CS-401",
        teacher: { name: "Dr. Chen" },
        students: Array(22).fill(0),
        bannerType: "dark",
        footerIcons: ["folder", "terminal"]
      }
    ];

    if (classrooms.length === 0) {
      return mockClasses;
    }

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
            <Cpu className="w-5 h-5 text-blue-600 animate-pulse" />
            <span>OpenHW Studio</span>
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

        <div className="student-db-header__right">
          <button className="student-db-header__icon-btn" title="Settings">
            <Settings className="w-4 h-4" />
          </button>
          <button className="student-db-header__icon-btn" title="Notifications">
            <Bell className="w-4 h-4" />
          </button>
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
                {user?.name ? user.name.slice(0, 2).toUpperCase() : "KV"}
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
                  setShowGuidedProjects(true);
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

              <button
                onClick={() => {
                  setActiveTab("adventure-map");
                }}
                className={`student-db-sidebar__link ${
                  activeTab === "adventure-map" ? "is-active" : ""
                }`}
              >
                <Activity className="w-4 h-4" />
                Adventure map
              </button>
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
                {upcomingTasks.map((task) => (
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
                ))}
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
                      onClick={() => {
                        if (!cls._id.startsWith("mock-")) {
                          navigate(`/student/classes/${cls._id}`);
                        } else {
                          setInfo(
                            `Selected mock environment: ${cls.name}. Key secure.`
                          );
                        }
                      }}
                      className="roster-card"
                    >
                      <div
                        className={`roster-card__banner roster-card__banner--${cls.bannerType}`}
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

        {/* Tab: Guided Projects Panel Switch */}
        {activeTab === "guided-projects" && (
          <main className="student-db-content">
            <section className="student-db-rosters">
              <header className="student-db-rosters__header">
                <div className="student-db-rosters__title-area">
                  <h2>Guided Projects Workspace</h2>
                  <p>Access pre-configured hardware simulator modules and exercises.</p>
                </div>
              </header>

              <div
                style={{
                  background: "#ffffff",
                  border: "1px dashed #cbd5e1",
                  borderRadius: "12px",
                  padding: "48px",
                  textAlign: "center",
                  color: "#64748b"
                }}
              >
                <Folder className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <h4 style={{ fontWeight: 800, color: "#0f172a", marginBottom: "8px" }}>
                  Guided Projects Panel Triggered
                </h4>
                <p style={{ fontSize: "13px", maxWidth: "320px", margin: "0 auto", marginBottom: "16px" }}>
                  The Guided Projects drawer is active. Select a simulation project to launch the workbench environment.
                </p>
                <button
                  onClick={() => setShowGuidedProjects(true)}
                  className="student-db-sidebar__sim-btn"
                  style={{ display: "inline-flex", margin: "0 auto" }}
                >
                  [ Open Guided Projects Drawer ]
                </button>
              </div>
            </section>
          </main>
        )}

        {/* Tab: Modules Section Placeholder */}
        {activeTab === "modules" && (
          <main className="student-db-content">
            <section className="student-db-rosters">
              <header className="student-db-rosters__header">
                <div className="student-db-rosters__title-area">
                  <h2>Modules Directory</h2>
                  <p>Browse course contents, syllabus, and lab modules.</p>
                </div>
              </header>

              <div
                style={{
                  background: "#ffffff",
                  border: "1px dashed #cbd5e1",
                  borderRadius: "12px",
                  padding: "48px",
                  textAlign: "center",
                  color: "#64748b"
                }}
              >
                <Layers className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <h4 style={{ fontWeight: 800, color: "#0f172a", marginBottom: "8px" }}>
                  Modules Sync Complete
                </h4>
                <p style={{ fontSize: "13px", maxWidth: "300px", margin: "0 auto" }}>
                  All course modules are currently synchronized with active classroom instances. Check upcoming tasks for assignments.
                </p>
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
                <button
                  onClick={() => navigate("/adventure")}
                  className="student-db-rosters__join-btn"
                  style={{
                    borderColor: "#10b981",
                    color: "#10b981",
                    backgroundColor: "rgba(16, 185, 129, 0.05)"
                  }}
                >
                  🗺️ FULL ADVENTURE MAP
                </button>
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

      {/* Guided Projects Sidebar Panel Drawer */}
      <GuidedProjectsPanel
        isOpen={showGuidedProjects}
        onClose={() => setShowGuidedProjects(false)}
      />

      {/* Toast Messages */}
      {info && (
        <div className="teacher-toast" role="status">
          {info}
        </div>
      )}
    </div>
  );
}