import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Building2,
  CalendarDays,
  GraduationCap,
  Home,
  Loader2,
  Mail,
  MapPin,
  Monitor,
  PenSquare,
  UserCircle2,
  X,
  Cpu,
  Settings,
  Bell,
  FileText,
  HelpCircle,
  Activity,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  Megaphone,
  ClipboardList
} from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { getAvatarLetters } from '../../components/common/test.js'
import { updateProfile } from '../../services/authService.js'
import DeleteAccountModal from '../../components/DeleteAccountModal.jsx'
import { getMyClassrooms, getClassAssignments, getClassroomNotices } from '../../services/classroomService.js'

// Presets for the Avatar Builder
const STYLE_PRESETS = [
  { id: "bottts", label: "Robot" },
  { id: "lorelei", label: "Lorelei" },
  { id: "avataaars", label: "Avataaars" },
  { id: "pixel-art", label: "Pixel Art" },
  { id: "adventurer", label: "Adventurer" },
  { id: "micah", label: "Micah" }
];

const SEEDS = [
  "alpha", "beta", "gamma", "delta", "epsilon", "zeta",
  "eta", "theta", "iota", "kappa", "lambda", "mu",
  "nu", "xi", "omicron", "pi", "rho", "sigma"
];

const parseAvatarUrl = (url) => {
  if (url && url.startsWith("https://api.dicebear.com/")) {
    try {
      const parts = url.split("/");
      const style = parts[4];
      const search = parts[5].split("?")[1];
      const params = new URLSearchParams(search);
      const seed = params.get("seed");
      return { style, seed };
    } catch (e) {
      return null;
    }
  }
  return null;
};

const buildFormState = (user) => ({
  name: user?.name || '',
  college: user?.college || '',
  branch: user?.branch || '',
  semester: user?.semester?.toString() || '',
  bio: user?.bio || '',
  image: user?.image || ''
})

export default function StudentProfilePage() {
  const navigate = useNavigate()
  const { user, logout, updateUserSession } = useAuth()
  const [form, setForm] = useState(() => buildFormState(user))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [recentClasses, setRecentClasses] = useState([])


  const [styleIndex, setStyleIndex] = useState(0)
  const [avatarStyle, setAvatarStyle] = useState('bottts')
  const [avatarSeed, setAvatarSeed] = useState('alpha')
  const [avatarPage, setAvatarPage] = useState(0)

  const getAdjacentIndex = (offset) => {
    const len = STYLE_PRESETS.length
    return (styleIndex + offset + len) % len
  }

  const prevStyle = () => {
    const nextIdx = getAdjacentIndex(-1)
    setStyleIndex(nextIdx)
    const newStyle = STYLE_PRESETS[nextIdx].id
    setAvatarStyle(newStyle)
    setAvatarPage(0)
    setAvatarSeed(SEEDS[0])
    setForm(c => ({ ...c, image: `https://api.dicebear.com/9.x/${newStyle}/svg?seed=${SEEDS[0]}` }))
  }

  const nextStyle = () => {
    const nextIdx = getAdjacentIndex(1)
    setStyleIndex(nextIdx)
    const newStyle = STYLE_PRESETS[nextIdx].id
    setAvatarStyle(newStyle)
    setAvatarPage(0)
    setAvatarSeed(SEEDS[0])
    setForm(c => ({ ...c, image: `https://api.dicebear.com/9.x/${newStyle}/svg?seed=${SEEDS[0]}` }))
  }

  const handleRandomize = () => {
    const randomStyleIdx = Math.floor(Math.random() * STYLE_PRESETS.length)
    const randSeed = "rand-" + Math.random().toString(36).substring(2, 9)
    const newStyle = STYLE_PRESETS[randomStyleIdx].id

    setStyleIndex(randomStyleIdx)
    setAvatarStyle(newStyle)
    setAvatarSeed(randSeed)
    setAvatarPage(0)
    setForm(c => ({ ...c, image: `https://api.dicebear.com/9.x/${newStyle}/svg?seed=${randSeed}` }))
  }

  const prevPage = () => {
    setAvatarPage((prev) => (prev - 1 + 3) % 3)
  }

  const nextPage = () => {
    setAvatarPage((prev) => (prev + 1) % 3)
  }

  const currentPageSeeds = SEEDS.slice(avatarPage * 6, avatarPage * 6 + 6)

  const avatarInitials = useMemo(() => getAvatarLetters(user?.name, 'S'), [user?.name])
  const profileMetrics = useMemo(() => {
    const completed = [
      user?.college,
      user?.branch,
      user?.semester,
      user?.bio,
      user?.image
    ].filter(Boolean).length

    return {
      completion: Math.round((completed / 5) * 100),
      classes: recentClasses.length
    }
  }, [recentClasses.length, user?.bio, user?.branch, user?.college, user?.image, user?.semester])

  const sidebarLinks = [
    { key: 'home', label: 'Dashboard', icon: Home, isActive: false, onClick: () => navigate('/student/dashboard') },
    { key: 'simulator', label: 'Open Simulator', icon: Monitor, isActive: false, onClick: () => navigate('/simulator') },
    { key: 'join', label: 'Join class', icon: BookOpen, isActive: false, onClick: () => navigate('/student/dashboard?joinCode=') }
  ]

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  useEffect(() => {
    const loadClasses = async () => {
      try {
        const classrooms = await getMyClassrooms()
        setRecentClasses(classrooms.slice(0, 4))
      } catch (e) {
        setRecentClasses([])
      }
    }

    loadClasses()
  }, [])

  const [allNotifications, setAllNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const classroomList = await getMyClassrooms()
        const details = await Promise.all(
          classroomList.map(async (cls) => {
            try {
              const [assignmentsData, noticesData] = await Promise.all([
                getClassAssignments(cls._id),
                getClassroomNotices(cls._id)
              ])
              return { classroomName: cls.name, classId: cls._id, assignments: assignmentsData, notices: noticesData }
            } catch (e) {
              return { classroomName: cls.name, classId: cls._id, assignments: [], notices: [] }
            }
          })
        )

        const list = []
        details.forEach(({ classroomName, classId, assignments: aRows, notices: nRows }) => {
          nRows.forEach((notice) => {
            list.push({
              id: `notice-${notice._id}`,
              type: "announcement",
              classroomName,
              title: notice.title || "Class notice",
              body: notice.message,
              date: new Date(notice.createdAt),
              link: `/student/classes/${classId}`
            })
          })

          aRows.forEach((assignment) => {
            list.push({
              id: `assignment-${assignment._id}`,
              type: "assignment",
              classroomName,
              title: assignment.title || "Assignment",
              body: assignment.description || "New assignment available.",
              date: new Date(assignment.createdAt || assignment.dueDate),
              link: `/student/classes/${classId}`
            })
          })
        })

        setAllNotifications(list.sort((a, b) => b.date - a.date))
      } catch (e) {
        console.warn("Failed to load notifications", e)
      }
    }

    fetchNotifications()
  }, [])

  const openEditModal = () => {
    setForm(buildFormState(user))
    setError('')
    setIsEditOpen(true)

    const parsed = parseAvatarUrl(user?.image)
    if (parsed) {
      setAvatarStyle(parsed.style)
      setAvatarSeed(parsed.seed)
      const styleIdx = STYLE_PRESETS.findIndex(p => p.id === parsed.style)
      if (styleIdx !== -1) setStyleIndex(styleIdx)
    } else {
      setAvatarStyle('bottts')
      setAvatarSeed('alpha')
      setStyleIndex(0)
    }
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({
      ...current,
      [name]: value
    }))
  }



  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setInfo('')

    try {
      const payload = {
        name: form.name.trim(),
        college: form.college.trim(),
        branch: form.branch.trim(),
        semester: form.semester ? Number.parseInt(form.semester, 10) : null,
        bio: form.bio.trim(),
        image: form.image.trim()
      }

      const response = await updateProfile(payload)
      if (response?.user) {
        updateUserSession(response.user)
        setForm(buildFormState(response.user))
      }
      setInfo('Profile updated successfully.')
      setIsEditOpen(false)
    } catch (profileError) {
      setError(profileError.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

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



        <div className="student-db-header__right" style={{ position: "relative" }}>

          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="student-db-header__icon-btn"
            title="Notifications"
            style={{ position: "relative" }}
          >
            <Bell className="w-4 h-4" />
            {allNotifications.length > 0 && (
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
                {allNotifications.length}
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
                  <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700 }}>{allNotifications.length} new</span>
                </div>

                <div style={{ overflowY: "auto", flex: 1 }}>
                  {allNotifications.length === 0 ? (
                    <div style={{ padding: "32px 16px", textAlign: "center", color: "#64748b" }}>
                      <Bell className="w-8 h-8" style={{ margin: "0 auto 8px auto", opacity: 0.4 }} />
                      <span style={{ fontSize: "13px" }}>No new notifications.</span>
                    </div>
                  ) : (
                    allNotifications.map((n) => (
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


          <div
            onClick={() => navigate("/student/profile")}
            className="student-db-header__avatar is-active"
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
                {avatarInitials}
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
              onClick={() => navigate("/student/dashboard")}
              className="student-db-sidebar__sim-btn"
            >
              <Home className="w-4 h-4" />
              Back to Dashboard
            </button>

            <nav className="student-db-sidebar__nav">
              <button
                onClick={() => navigate("/student/dashboard")}
                className="student-db-sidebar__link"
              >
                <Monitor className="w-4 h-4" />
                Workstations
              </button>

              <button
                onClick={() => navigate("/student/dashboard?joinCode=")}
                className="student-db-sidebar__link"
              >
                <BookOpen className="w-4 h-4" />
                Join Class
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
                className="student-db-sidebar__link text-red-600 hover:bg-red-50"
              >
                Sign Out
              </button>
            </nav>
          </div>
        </aside>

        {/* Content Column Area */}
        <main className="student-db-content">
          <section className="student-profile-shell" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
            <section className="student-profile-hero">
              <div className="student-profile-hero__media">
                {user?.image ? (
                  <img src={user.image} alt={user?.name || 'Student'} className="student-profile-hero__image" />
                ) : (
                  <div className="student-profile-hero__avatar">{avatarInitials}</div>
                )}
              </div>
              <div className="student-profile-hero__copy">
                <p className="student-profile-hero__eyebrow">Student Associate</p>
                <h1>{user?.name || 'Student'}</h1>
                <div className="student-profile-hero__meta">
                  <span>
                    <Mail size={14} />
                    {user?.email || 'student account'}
                  </span>
                  <span>
                    <MapPin size={14} />
                    {user?.college || 'Academic profile'}
                  </span>
                </div>
              </div>
              <button type="button" className="student-profile-hero__action" onClick={openEditModal}>
                <PenSquare size={16} />
                Edit Profile
              </button>
            </section>

            {info ? <p className="teacher-inline-state">{info}</p> : null}

            <section className="student-profile-grid">
              <article className="student-profile-panel student-profile-panel--wide">
                <header className="student-profile-panel__header">
                  <h3>
                    <UserCircle2 size={16} />
                    Identity & Registration
                  </h3>
                </header>

                <div className="student-profile-panel__stats">
                  <article className="student-profile-data">
                    <small>Full Name</small>
                    <strong>{user?.name || 'Not added'}</strong>
                  </article>
                  <article className="student-profile-data">
                    <small>Email Address</small>
                    <strong>{user?.email || 'Not added'}</strong>
                  </article>
                  <article className="student-profile-data">
                    <small>Academic Status</small>
                    <strong className="student-profile-data__status">Active Student</strong>
                  </article>
                  <article className="student-profile-data">
                    <small>Current Semester</small>
                    <strong>{user?.semester || 'Not added'}</strong>
                  </article>
                </div>
              </article>

              <article className="student-profile-panel student-profile-panel--bio">
                <header className="student-profile-panel__header">
                  <h3>
                    <BookOpen size={16} />
                    Biography
                  </h3>
                </header>

                <p className="student-profile-panel__bio">
                  {user?.bio || 'Add a short bio to describe your academic interests and background.'}
                </p>

                <div className="student-profile-metrics">
                  <div className="student-profile-metrics__row">
                    <span>Profile Completion</span>
                    <strong>{profileMetrics.completion}%</strong>
                  </div>
                  <div className="student-profile-metrics__bar">
                    <span style={{ width: `${profileMetrics.completion}%` }} />
                  </div>
                  <div className="student-profile-metrics__row">
                    <span>Joined Classes</span>
                    <strong>{profileMetrics.classes}</strong>
                  </div>
                  <div className="student-profile-metrics__bar">
                    <span style={{ width: `${Math.min(profileMetrics.classes * 20, 100)}%` }} />
                  </div>
                </div>
              </article>

              <article className="student-profile-panel student-profile-panel--wide">
                <header className="student-profile-panel__header">
                  <h3>
                    <Building2 size={16} />
                    Institutional Placement
                  </h3>
                </header>

                <div className="student-profile-campus">
                  <div className="student-profile-campus__main">
                    <span className="student-profile-campus__icon">
                      <GraduationCap size={18} />
                    </span>
                    <div>
                      <small>University</small>
                      <strong>{user?.college || 'Not added'}</strong>
                    </div>
                  </div>
                </div>

                <div className="student-profile-panel__stats student-profile-panel__stats--compact">
                  <article className="student-profile-data">
                    <small>Department / Branch</small>
                    <strong>{user?.branch || 'Not added'}</strong>
                  </article>
                  <article className="student-profile-data">
                    <small>Current Semester</small>
                    <strong>{user?.semester || 'Not added'}</strong>
                  </article>
                </div>
              </article>
            </section>

            <section className="student-profile-panel student-profile-panel--recent">
              <header className="student-profile-panel__header student-profile-panel__header--row">
                <div>
                  <h3>
                    <CalendarDays size={16} />
                    Recent Classes
                  </h3>
                  <p>Your latest joined classrooms and active learning spaces.</p>
                </div>
                <button type="button" className="teacher-section-link" onClick={() => navigate('/student/dashboard')}>
                  View All
                </button>
              </header>

              <div className="student-profile-classes">
                {recentClasses.length === 0 ? (
                  <article className="student-profile-class student-profile-class--empty">
                    <strong>No classes yet</strong>
                    <small>Join a classroom to see it listed here.</small>
                  </article>
                ) : (
                  recentClasses.map((classroom) => (
                    <article
                      key={classroom._id}
                      className="student-profile-class"
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/student/classes/${classroom._id}`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          navigate(`/student/classes/${classroom._id}`)
                        }
                      }}
                    >
                      <small>{classroom.teacher?.name || 'Teacher'}</small>
                      <strong>{classroom.name}</strong>
                      <span>{classroom.students?.length || 0} students</span>
                    </article>
                  ))
                )}
              </div>
            </section>
          </section>
        </main>
      </div>

      {isEditOpen ? (
        <div className="teacher-modal">
          <div className="teacher-modal__backdrop" onClick={() => setIsEditOpen(false)} />
          <section className="teacher-modal__content student-profile-modal">
            <header className="teacher-modal__header">
              <div>
                <h3>Edit Profile</h3>
                <p>Update your student profile details.</p>
              </div>
              <button type="button" onClick={() => setIsEditOpen(false)} aria-label="Close profile editor">
                <X size={18} />
              </button>
            </header>

            <form className="student-profile-form" onSubmit={handleSubmit}>
              <div className="student-profile-form__top-section" style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "32px", alignItems: "start" }}>
                {/* Left: Dicebear builder */}
                <div className="student-profile-dicebear-builder" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div className="hardware-card" style={{ margin: "0 auto 12px auto" }}>
                    <div className="hardware-card__header">
                      <span>LIVE PROFILE PREVIEW</span>
                      <span className="hardware-card__signal">
                        <Activity className="w-3.5 h-3.5 animate-pulse" />
                        <span>ONLINE</span>
                      </span>
                    </div>

                    <div className="hardware-card__preview-area">
                      <img
                        src={`https://api.dicebear.com/9.x/${avatarStyle}/svg?seed=${avatarSeed}`}
                        alt="Profile Preview"
                        className="hardware-card__avatar"
                      />
                      <div className="hardware-card__chip-icon">
                        <Cpu className="w-4 h-4 text-orange-600 animate-pulse" />
                      </div>
                    </div>

                    <div className="hardware-card__footer">
                      <span>ID: READY</span>
                      <span>V.1.0.4</span>
                    </div>
                  </div>

                  <div className="hardware-tabs-wrapper" style={{ margin: "0 auto 10px auto", width: "100%" }}>
                    <button
                      type="button"
                      onClick={prevStyle}
                      className="hardware-slider-btn"
                      title="Previous Style"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="hardware-tabs-slider">
                      <button
                        type="button"
                        onClick={prevStyle}
                        className="hardware-tab-slide is-adjacent"
                      >
                        {STYLE_PRESETS[getAdjacentIndex(-1)].label.toUpperCase()}
                      </button>

                      <button
                        type="button"
                        className="hardware-tab-slide is-active"
                      >
                        {STYLE_PRESETS[styleIndex].label.toUpperCase()}
                      </button>

                      <button
                        type="button"
                        onClick={nextStyle}
                        className="hardware-tab-slide is-adjacent"
                      >
                        {STYLE_PRESETS[getAdjacentIndex(1)].label.toUpperCase()}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={nextStyle}
                      className="hardware-slider-btn"
                      title="Next Style"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="hardware-grid-wrapper" style={{ margin: "0 auto 12px auto", width: "100%" }}>
                    <button
                      type="button"
                      onClick={prevPage}
                      className="hardware-slider-btn"
                      title="Previous Page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="hardware-grid">
                      {currentPageSeeds.map((seed) => (
                        <button
                          key={seed}
                          type="button"
                          onClick={() => {
                            setAvatarSeed(seed);
                            setForm(c => ({ ...c, image: `https://api.dicebear.com/9.x/${avatarStyle}/svg?seed=${seed}` }));
                          }}
                          className={`hardware-grid-item ${avatarSeed === seed ? "is-selected" : ""}`}
                          title={`Seed: ${seed}`}
                        >
                          <img
                            src={`https://api.dicebear.com/9.x/${avatarStyle}/svg?seed=${seed}&size=40`}
                            alt={seed}
                            className="w-10 h-10 object-contain"
                          />
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={nextPage}
                      className="hardware-slider-btn"
                      title="Next Page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleRandomize}
                    className="hardware-random-btn"
                    style={{ margin: "0 auto 4px auto", display: "flex" }}
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    [ RANDOMIZE AVATAR ]
                  </button>
                </div>

                {/* Right: Info fields */}
                <div className="student-profile-form__grid" style={{ marginTop: 0 }}>
                  <label className="student-profile-field">
                    <span>Full Name</span>
                    <input name="name" value={form.name} onChange={handleChange} placeholder="Enter your full name" />
                  </label>

                  <label className="student-profile-field">
                    <span>Email</span>
                    <input type="email" value={user?.email || ''} disabled className="student-profile-field__disabled" />
                  </label>

                  <label className="student-profile-field">
                    <span>College</span>
                    <input name="college" value={form.college} onChange={handleChange} placeholder="Your college" />
                  </label>

                  <label className="student-profile-field">
                    <span>Branch</span>
                    <input name="branch" value={form.branch} onChange={handleChange} placeholder="Your branch" />
                  </label>

                  <label className="student-profile-field">
                    <span>Semester</span>
                    <input type="number" min="1" max="12" name="semester" value={form.semester} onChange={handleChange} placeholder="Semester" />
                  </label>

                  <div className="student-profile-field student-profile-field--hint">
                    <span>Account Category</span>
                    <input value="Undergraduate Student" disabled className="student-profile-field__disabled" />
                  </div>

                  <label className="student-profile-field student-profile-field--full" style={{ gridColumn: "1 / -1" }}>
                    <span>Academic Biography</span>
                    <textarea name="bio" rows="4" value={form.bio} onChange={handleChange} placeholder="Tell your teacher and classmates about yourself" style={{ minHeight: "90px" }} />
                  </label>
                </div>
              </div>

              {error ? <p className="teacher-inline-state teacher-inline-state--error">{error}</p> : null}

              <div className="teacher-modal__actions">
                <button type="button" className="teacher-button teacher-button--ghost" onClick={() => setIsEditOpen(false)}>
                  Discard Changes
                </button>
                <button type="submit" className="teacher-button teacher-button--primary" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 size={16} className="teacher-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Update Profile</span>
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <DeleteAccountModal
          userRole="student"
          userEmail={user?.email || ''}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => { logout(); navigate('/login'); }}
        />
      )}

      {/* ── Danger Zone ──────────────────────────────────────────────────── */}
      <div style={{
        margin: '32px auto', maxWidth: '960px', padding: '0 16px',
        boxSizing: 'border-box',
      }}>
        <div style={{
          background: 'rgba(127,29,29,0.1)', border: '1px solid #7f1d1d',
          borderRadius: '12px', padding: '20px 24px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: '16px', flexWrap: 'wrap',
        }}>
          <div>
            <p style={{ color: '#f87171', fontWeight: 700, margin: '0 0 4px', fontSize: '14px', fontFamily: 'monospace', letterSpacing: '1px' }}>
              DANGER ZONE
            </p>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
              Permanently delete your account and all personal data after a 30-day grace period.
            </p>
          </div>
          <button
            id="student-delete-account-btn"
            onClick={() => setShowDeleteModal(true)}
            style={{
              padding: '10px 20px', background: 'none',
              border: '1px solid #7f1d1d', borderRadius: '8px',
              color: '#f87171', fontWeight: 600, fontSize: '13px',
              fontFamily: 'monospace', cursor: 'pointer',
              whiteSpace: 'nowrap', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#7f1d1d'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#f87171'; }}
          >
            Delete Account
          </button>
        </div>
      </div>
    </div>
  )
}
