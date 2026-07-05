import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Plus,
  Settings,
  Bell,
  GraduationCap,
  Folder,
  Layers,
  FileText,
  HelpCircle,
  Users,
  Terminal,
  Activity,
  Cpu,
  FolderKanban,
  Microchip,
  Zap,
  Sliders,
  Eye,
  Smartphone,
  BarChart3,
  Target,
  Wifi,
  Hash,
  Droplet,
  Bluetooth,
  Tv,
  Trash2,
  Palette,
  Thermometer,
  ToggleLeft,
  Sun,
  Monitor,
  Megaphone,
  ChevronDown,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  createClassroom,
  deleteClassroom,
  getMyClassrooms,
} from '../../services/classroomService.js'
import { uploadClassroomFiles } from '../../components/teacher/class-detail/uploadUtils.js'
import { listProjects, deleteProject, formatProjectDate } from '../../services/projectStore.js'
import PROJECT_DATA from '../../services/guidedProjects.json'

/* ─── Constants ──────────────────────────────────────────────── */
const EXAMPLES_BASE_URL =
  import.meta.env.VITE_EXAMPLES_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000/examples' : '/examples')

const LEVEL_ICONS = { BEGINNER: Terminal, INTERMEDIATE: BarChart3, ADVANCED: Target }
const CATEGORY_ICONS = { Zap, Sliders, Eye, Smartphone, Layers, Cpu, Wifi, Terminal, BarChart3, Target, Microchip }

/* ─── Helpers ────────────────────────────────────────────────── */
const TrafficLightIcon = (props) => (
  <svg
    width={props.size || 14}
    height={props.size || 14}
    viewBox="0 0 24 24"
    fill="none"
    stroke={props.color || 'currentColor'}
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
)

function getProjectIcon(slug, title) {
  const s = slug ? slug.toLowerCase() : ''
  const t = title ? title.toLowerCase() : ''
  if (t.includes('rgb led')) return Palette
  if (t.includes('led') || s.includes('led')) return Microchip
  if (t.includes('buzzer') || t.includes('alarm') || t.includes('sound')) return Megaphone
  if (t.includes('traffic light') || s.includes('traffic')) return TrafficLightIcon
  if (t.includes('temperature') || t.includes('thermometer') || s.includes('temp') || t.includes('dht')) return Thermometer
  if (t.includes('button') || t.includes('switch')) return ToggleLeft
  if (t.includes('potentiometer') || t.includes('brightness')) return Sliders
  if (t.includes('light') || t.includes('ldr') || t.includes('dark')) return Sun
  if (t.includes('lcd') || t.includes('display') || t.includes('screen')) return Monitor
  if (t.includes('counter')) return Hash
  if (t.includes('water') || t.includes('level') || t.includes('liquid')) return Droplet
  if (t.includes('bluetooth')) return Bluetooth
  if (t.includes('wifi') || t.includes('esp32') || t.includes('esp8266')) return Wifi
  if (t.includes('remote') || t.includes('ir') || t.includes('rf')) return Tv
  if (t.includes('robot') || t.includes('avoid') || t.includes('follow')) return Cpu
  if (t.includes('dustbin') || t.includes('trash')) return Trash2
  return Microchip
}

function buildDefaultCategoryState() {
  const state = {}
  Object.entries(PROJECT_DATA).forEach(([levelKey, level]) => {
    Object.keys(level.categories).forEach((catKey) => {
      state[`${levelKey}-${catKey}`] = `${levelKey}-${catKey}` === 'BEGINNER-Basic Output'
    })
  })
  return state
}

function getBoardLabel(type) {
  const map = { arduino_uno: 'Arduino Uno', 'esp-32': 'ESP32', pico: 'Raspberry Pi Pico' }
  return map[type] || type || 'Board'
}

/* ─── Component ──────────────────────────────────────────────── */
export default function TeacherDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  /* ── Classroom state ── */
  const [classrooms, setClassrooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  /* ── Create-class modal state ── */
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')
  const [newClassForm, setNewClassForm] = useState({ name: '', bio: '', image: '' })

  /* ── Tabs ── */
  const [activeTab, setActiveTab] = useState('classroom')

  /* ── Guided projects inline workspace ── */
  const [guidedDifficulty, setGuidedDifficulty] = useState('BEGINNER')
  const [guidedExpandedCategories, setGuidedExpandedCategories] = useState(buildDefaultCategoryState)
  const [imageErrors, setImageErrors] = useState({})

  /* ── My Saved Circuits (Modules) ── */
  const [userProjects, setUserProjects] = useState([])
  const [loadingProjects, setLoadingProjects] = useState(false)

  /* ── Profile ── */
  const firstName = user?.name?.split(' ')[0] || 'Teacher'
  const initials = user?.name ? user.name.slice(0, 2).toUpperCase() : 'TC'

  /* ── Data loading ── */
  const loadClassrooms = async () => {
    setLoading(true)
    setError('')
    try {
      const list = await getMyClassrooms()
      setClassrooms(list)
    } catch (e) {
      setError(e.message || 'Unable to load classes')
    } finally {
      setLoading(false)
    }
  }

  const fetchUserProjects = useCallback(async () => {
    setLoadingProjects(true)
    try {
      const owner = user?.email || 'guest'
      const list = await listProjects(owner)
      setUserProjects(list || [])
    } catch (e) {
      console.error('Failed to fetch projects:', e)
    } finally {
      setLoadingProjects(false)
    }
  }, [user])

  useEffect(() => { loadClassrooms() }, [])

  useEffect(() => {
    if (activeTab === 'modules') fetchUserProjects()
  }, [activeTab, fetchUserProjects])

  useEffect(() => {
    if (!info) return
    const t = setTimeout(() => setInfo(''), 3200)
    return () => clearTimeout(t)
  }, [info])

  /* ── Derived data ── */
  const upcomingAssignments = useMemo(() => {
    const all = classrooms.flatMap((c) =>
      (c.assignments || []).map((a) => ({
        classId: c._id,
        className: c.name,
        title: a.title || 'Assignment',
        dueDate: a.dueDate,
      }))
    )
    return all
      .filter((x) => x.dueDate)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 8)
  }, [classrooms])

  const totalStudents = useMemo(
    () => classrooms.reduce((n, c) => n + (c.students?.length || 0), 0),
    [classrooms]
  )

  /* ── Rendered classrooms with banner style ── */
  const renderedClassrooms = useMemo(() => {
    const mockClasses = [
      {
        _id: 'mock-1',
        name: 'Intro to Embedded Systems',
        bio: 'Fundamentals of embedded hardware and software.',
        students: Array(30).fill(0),
        bannerType: 'blue',
        footerIcons: ['folder', 'terminal', 'chart'],
      },
      {
        _id: 'mock-2',
        name: 'Advanced Computer Architecture',
        bio: 'Deep dive into processor design and memory systems.',
        students: Array(18).fill(0),
        bannerType: 'dark',
        footerIcons: ['folder', 'terminal'],
      },
    ]
    if (classrooms.length === 0) return mockClasses
    return classrooms.map((c, i) => ({
      ...c,
      bannerType: i % 2 === 0 ? 'blue' : 'dark',
      footerIcons: i % 2 === 0 ? ['folder', 'terminal', 'chart'] : ['folder', 'terminal'],
    }))
  }, [classrooms])

  /* ── Handlers ── */
  const handleLogout = () => { logout(); navigate('/') }

  const handleCreateInputChange = (e) => {
    setNewClassForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleCreateImageUpload = async (e) => {
    try {
      const [image] = await uploadClassroomFiles(e.target.files, {
        category: 'classes', classId: 'new', maxFiles: 1, allowedTypes: ['image'],
      })
      if (image) { setNewClassForm((prev) => ({ ...prev, image })); setCreateError('') }
    } catch (err) {
      setCreateError(err.message || 'Failed to upload image')
    } finally {
      e.target.value = ''
    }
  }

  const handleCreateClass = async (e) => {
    e.preventDefault()
    if (!newClassForm.name.trim()) { setCreateError('Class name is required'); return }
    setCreateLoading(true)
    setCreateError('')
    try {
      await createClassroom({ name: newClassForm.name, bio: newClassForm.bio, image: newClassForm.image })
      setNewClassForm({ name: '', bio: '', image: '' })
      setIsModalOpen(false)
      await loadClassrooms()
    } catch (err) {
      setCreateError(err.message || 'Failed to create class')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleDeleteClass = async (e, classId) => {
    e.stopPropagation()
    e.preventDefault()
    if (!window.confirm('Delete this class? All assignments and notices will be removed.')) return
    try {
      await deleteClassroom(classId)
      await loadClassrooms()
    } catch (err) {
      setError(err.message || 'Failed to delete class')
    }
  }

  /* ── Upcoming tag helpers ── */
  function getUpcomingTag(dueDate) {
    const now = new Date()
    const due = new Date(dueDate)
    const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24))
    if (diff <= 1) return { label: 'DUE TOMORROW', style: 'task-tag--tomorrow', cardStyle: 'task-card--tomorrow' }
    if (diff <= 3) return { label: 'DUE SOON', style: 'task-tag--friday', cardStyle: 'task-card--friday' }
    return { label: 'UPCOMING', style: 'task-tag--nextweek', cardStyle: 'task-card--nextweek' }
  }

  /* ─────────────────────────────────── JSX ─────────────────────────────────── */
  return (
    <div className="student-db-layout">

      {/* ── Top Header Bar ── */}
      <header className="student-db-header">
        <div className="student-db-header__left">
          <Link to="/" className="student-db-header__brand">
            <img
              src="/logo-cropped.png"
              alt="OpenHW Studio"
              style={{ height: '65px', width: '130px', objectFit: 'contain' }}
            />
          </Link>
        </div>



        <div className="student-db-header__right">

          <button className="student-db-header__icon-btn" title="Notifications">
            <Bell size={16} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="student-db-header__deploy-btn"
          >
            + Add Class
          </button>
          <div
            onClick={() => navigate('/teacher/profile')}
            className="student-db-header__avatar"
            title="Teacher Profile"
          >
            {user?.image ? (
              <img src={user.image} alt={user?.name || 'Profile'} />
            ) : (
              <span>{initials}</span>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Body ── */}
      <div className="student-db-main-container">

        {/* ── Left Sidebar ── */}
        <aside className="student-db-sidebar">
          <div className="student-db-sidebar__top">
            {/* Profile card */}
            <div className="student-db-profile-card">
              <div className="student-db-profile-card__monogram">{initials}</div>
              <div className="student-db-profile-card__info">
                <span className="student-db-profile-card__title">{user?.name || firstName}</span>
                <span className="student-db-profile-card__sub">TEACHER · Authenticated</span>
              </div>
            </div>

            <button onClick={() => setIsModalOpen(true)} className="student-db-sidebar__sim-btn">
              <Plus size={16} />
              New Class
            </button>

            <nav className="student-db-sidebar__nav">
              <button
                onClick={() => setActiveTab('classroom')}
                className={`student-db-sidebar__link ${activeTab === 'classroom' ? 'is-active' : ''}`}
              >
                <GraduationCap size={16} />
                Classroom
              </button>

              <button
                onClick={() => setActiveTab('guided-projects')}
                className={`student-db-sidebar__link ${activeTab === 'guided-projects' ? 'is-active' : ''}`}
              >
                <Folder size={16} />
                Guided Projects
              </button>

              <button
                onClick={() => setActiveTab('modules')}
                className={`student-db-sidebar__link ${activeTab === 'modules' ? 'is-active' : ''}`}
              >
                <Layers size={16} />
                Modules
              </button>

              <button
                onClick={() => navigate('/teacher/project-bank')}
                className="student-db-sidebar__link"
              >
                <FolderKanban size={16} />
                Project Bank
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
                <FileText size={16} />
                Docs
              </a>

              <button
                onClick={handleLogout}
                className="student-db-sidebar__link"
                style={{ color: '#ef4444' }}
              >
                Sign Out
              </button>
            </nav>
          </div>
        </aside>

        {/* ════════════════════ Tab: Classroom ════════════════════ */}
        {activeTab === 'classroom' && (
          <>

            {/* Classes Roster */}
            <main className="student-db-content">
              <section className="student-db-rosters">
                <header className="student-db-rosters__header">
                  <div className="student-db-rosters__title-area">
                    <h2>Your Classes</h2>
                    <p>
                      {classrooms.length} active {classrooms.length === 1 ? 'class' : 'classes'} · {totalStudents} total students enrolled.
                    </p>
                  </div>
                  <button onClick={() => setIsModalOpen(true)} className="student-db-rosters__join-btn">
                    <Plus size={14} />
                    ADD NEW CLASS
                  </button>
                </header>

                {error && (
                  <div style={{ color: '#ef4444', fontSize: '13px', padding: '8px 0' }}>{error}</div>
                )}

                <div className="roster-grid">
                  {loading ? (
                    [0, 1, 2].map((i) => (
                      <div key={i} className="roster-card" style={{ minHeight: '220px', opacity: 0.5 }}>
                        <div className="roster-card__banner roster-card__banner--blue" />
                        <div className="roster-card__body" />
                      </div>
                    ))
                  ) : (
                    renderedClassrooms.map((cls) => (
                      <div
                        key={cls._id}
                        onClick={() => {
                          if (!cls._id.startsWith('mock-')) {
                            navigate(`/teacher/classes/${cls._id}`)
                          }
                        }}
                        className="roster-card"
                      >
                        <div
                          className={`roster-card__banner roster-card__banner--${cls.bannerType}`}
                          style={cls.image ? { backgroundImage: `url(${cls.image})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                        >
                          <h3 className="roster-card__banner-title">{cls.name}</h3>
                          <GraduationCap className="roster-card__banner-icon" size={20} style={{ opacity: 0.8 }} />
                        </div>

                        <div className="roster-card__body">
                          {cls.bio && (
                            <div className="roster-card__instructor">
                              <div className="roster-card__instructor-icon">
                                <BookOpen size={14} />
                              </div>
                              <span
                                className="roster-card__instructor-name"
                                style={{ fontWeight: 500, fontSize: '12px', color: '#475569' }}
                              >
                                {cls.bio}
                              </span>
                            </div>
                          )}
                          <div className="roster-card__code-block">
                            <Users size={12} style={{ display: 'inline', marginRight: '6px' }} />
                            {cls.students?.length || 0} Students Enrolled
                          </div>
                        </div>

                        <div className="roster-card__footer">
                          {!cls._id.startsWith('mock-') && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteClass(e, cls._id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#ef4444',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                marginRight: 'auto',
                              }}
                              title="Delete class"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                          {cls.footerIcons?.includes('folder') && <Folder className="roster-card__footer-icon" size={16} />}
                          {cls.footerIcons?.includes('terminal') && <Terminal className="roster-card__footer-icon" size={16} />}
                          {cls.footerIcons?.includes('chart') && <Activity className="roster-card__footer-icon" size={16} />}
                        </div>
                      </div>
                    ))
                  )}

                  {/* Add New Class dotted card */}
                  <div onClick={() => setIsModalOpen(true)} className="roster-card roster-card--join">
                    <div className="roster-card--join__circle">
                      <Plus size={20} />
                    </div>
                    <h4 className="roster-card--join__title">Add New Class</h4>
                    <p className="roster-card--join__desc">
                      Create a classroom and share the join code with your students.
                    </p>
                  </div>
                </div>
              </section>
            </main>
          </>
        )}

        {/* ════════════════════ Tab: Guided Projects ════════════════════ */}
        {activeTab === 'guided-projects' && (
          <main className="student-db-content">
            <section className="student-db-rosters">
              <header className="student-db-rosters__header">
                <div className="student-db-rosters__title-area">
                  <h2>Guided Projects Workspace</h2>
                  <p>Browse pre-configured hardware simulator modules and assign them to students.</p>
                </div>
              </header>

              <div className="guided-projects-workspace">
                {/* Difficulty segmented controls */}
                <div className="guided-difficulty-container">
                  {Object.entries(PROJECT_DATA).map(([levelKey, level]) => {
                    const LevelIcon = LEVEL_ICONS[levelKey] || Terminal
                    const isActive = guidedDifficulty === levelKey
                    let cls = 'guided-difficulty-btn'
                    if (levelKey === 'BEGINNER') cls += ' guided-difficulty-btn--beginner'
                    if (levelKey === 'INTERMEDIATE') cls += ' guided-difficulty-btn--intermediate'
                    if (levelKey === 'ADVANCED') cls += ' guided-difficulty-btn--advanced'
                    return (
                      <button
                        key={levelKey}
                        className={`${cls} ${isActive ? 'is-active' : ''}`}
                        onClick={() => setGuidedDifficulty(levelKey)}
                      >
                        <LevelIcon size={14} style={{ flexShrink: 0 }} />
                        <span>{level.label.replace(' LEVEL', '')}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Categories accordion */}
                <div className="guided-categories-list">
                  {Object.entries(PROJECT_DATA[guidedDifficulty]?.categories || {}).map(([catKey, category]) => {
                    const catId = `${guidedDifficulty}-${catKey}`
                    const isExpanded = !!guidedExpandedCategories[catId]
                    const CatIcon = CATEGORY_ICONS[category.icon] || Microchip
                    return (
                      <div
                        key={catKey}
                        className={`guided-category-accordion ${isExpanded ? 'is-expanded' : ''}`}
                      >
                        <button
                          className="guided-category-header"
                          onClick={() =>
                            setGuidedExpandedCategories((prev) => ({
                              ...prev,
                              [catId]: !prev[catId],
                            }))
                          }
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
                            <ChevronDown size={16} className="guided-category-header__chevron" />
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="guided-category-content">
                            <div className="guided-project-grid">
                              {category.projects.map((project) => {
                                const ProjectIcon = getProjectIcon(project.slug, project.title)
                                const hasImageError = !!imageErrors[project.slug]
                                const imageUrl = project.slug === 'buzzer'
                                  ? `${EXAMPLES_BASE_URL}/Turn_on_Buzzer/Turn_on_Buzzer.png`
                                  : `${EXAMPLES_BASE_URL}/${project.slug}/circuit.png`
                                return (
                                  <div
                                    key={project.slug}
                                    className="guided-project-card"
                                    onClick={() => navigate(`/${project.slug}/demo`, {
                                      state: { guidedProject: project }
                                    })}
                                  >
                                    <div className="guided-project-card__img-container">
                                      {!hasImageError ? (
                                        <img
                                          src={imageUrl}
                                          alt={project.title}
                                          className="guided-project-card__img"
                                          onError={() =>
                                            setImageErrors((prev) => ({ ...prev, [project.slug]: true }))
                                          }
                                        />
                                      ) : (
                                        <div className="guided-project-card__fallback">
                                          <ProjectIcon className="guided-project-card__fallback-icon" size={28} />
                                          <span className="guided-project-card__fallback-text">{project.slug}</span>
                                        </div>
                                      )}
                                    </div>
                                    <div className="guided-project-card__body">
                                      <h4 className="guided-project-card__title">{project.title}</h4>
                                      <p className="guided-project-card__desc">{project.description}</p>
                                      <div className="guided-project-card__tags">
                                        {project.board && (
                                          <span className="guided-project-card__tag guided-project-card__tag--board">
                                            {project.board}
                                          </span>
                                        )}
                                        {project.components?.slice(0, 2).map((comp, ci) => (
                                          <span key={ci} className="guided-project-card__tag">{comp}</span>
                                        ))}
                                        {project.components?.length > 2 && (
                                          <span className="guided-project-card__tag">+{project.components.length - 2}</span>
                                        )}
                                      </div>
                                      <button className="guided-project-card__action">LAUNCH WORKBENCH // [RUN]</button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>
          </main>
        )}

        {/* ════════════════════ Tab: Modules (Saved Circuits) ════════════════════ */}
        {activeTab === 'modules' && (
          <main className="student-db-content">
            <section className="student-db-rosters">
              <header className="student-db-rosters__header">
                <div className="student-db-rosters__title-area">
                  <h2>My Projects Directory</h2>
                  <p>Access, manage, and launch your custom simulation layouts and designs.</p>
                </div>
                <button onClick={() => navigate('/simulator')} className="student-db-rosters__join-btn">
                  <Plus size={14} />
                  CREATE NEW SIMULATION
                </button>
              </header>

              <div className="user-projects-workspace">
                {loadingProjects ? (
                  <div style={{
                    background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px',
                    padding: '48px', textAlign: 'center', color: '#64748b',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                      FETCHING REGISTRY...
                    </span>
                  </div>
                ) : userProjects.length === 0 ? (
                  <div className="user-project-empty-state">
                    <div className="user-project-empty-state__icon-wrap">
                      <Folder size={32} />
                    </div>
                    <h4 className="user-project-empty-state__title">No Saved Circuits Found</h4>
                    <p className="user-project-empty-state__desc">
                      Create custom designs in the simulator, save them, and they will appear here.
                    </p>
                    <button
                      onClick={() => navigate('/simulator')}
                      className="student-db-sidebar__sim-btn"
                      style={{ display: 'inline-flex', margin: '0 auto' }}
                    >
                      [ Launch Simulator Workbench ]
                    </button>
                  </div>
                ) : (
                  <div className="user-project-grid">
                    {userProjects.map((proj) => {
                      const projBoard = getBoardLabel(proj.board)
                      const partsCount = proj.components?.length || 0
                      const dateStr = proj.savedAt ? formatProjectDate(proj.savedAt) : 'N/A'
                      return (
                        <div key={proj.id} className="user-project-card">
                          <div className="user-project-card__thumbnail-wrap">
                            {proj.thumbnail ? (
                              <img src={proj.thumbnail} alt={proj.name || 'Untitled'} className="user-project-card__thumbnail" />
                            ) : (
                              <div className="user-project-card__placeholder">
                                <Cpu className="user-project-card__placeholder-icon" size={32} />
                                <span className="user-project-card__placeholder-text">{projBoard.toUpperCase()} LAYOUT</span>
                              </div>
                            )}
                          </div>
                          <div className="user-project-card__body">
                            <h4 className="user-project-card__title" title={proj.name || 'Untitled'}>
                              {proj.name || 'Untitled'}
                            </h4>
                            <div className="user-project-card__meta">
                              <span className="user-project-card__board">{projBoard}</span>
                              <span className="user-project-card__count">{partsCount} parts</span>
                            </div>
                            <span className="user-project-card__date">SAVED: {dateStr.toUpperCase()}</span>
                            <div className="user-project-card__footer">
                              <button
                                type="button"
                                className="user-project-card__btn-delete"
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  if (window.confirm(`Delete "${proj.name || 'Untitled'}"?`)) {
                                    try {
                                      await deleteProject(proj.id, user?.email || 'guest')
                                      setUserProjects((prev) => prev.filter((p) => p.id !== proj.id))
                                      setInfo('Project deleted.')
                                    } catch {
                                      setInfo('Failed to delete project.')
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
                                onClick={() => navigate('/simulator', { state: { loadProjectId: proj.id } })}
                              >
                                OPEN WORKBENCH // [EDIT]
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>
          </main>
        )}
      </div>

      {/* ════════════════════ Create Class Modal ════════════════════ */}
      {isModalOpen && (
        <div className="teacher-modal" role="dialog" aria-modal="true" aria-label="Add new class">
          <div className="teacher-modal__backdrop" onClick={() => setIsModalOpen(false)} />
          <section className="teacher-modal__content">
            <header className="teacher-modal__header">
              <h3>Add New Class</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} aria-label="Close modal">✕</button>
            </header>

            <form className="teacher-modal__form" onSubmit={handleCreateClass}>
              <label>
                <span>Class Name</span>
                <input
                  type="text"
                  name="name"
                  value={newClassForm.name}
                  onChange={handleCreateInputChange}
                  placeholder="Advanced Embedded Systems"
                  required
                />
              </label>

              <label>
                <span>Class Bio</span>
                <textarea
                  name="bio"
                  value={newClassForm.bio}
                  onChange={handleCreateInputChange}
                  rows={3}
                  placeholder="Short class summary"
                />
              </label>

              <div className="teacher-upload-field">
                <div className="teacher-upload-field__copy">
                  <span>Header Image</span>
                  <small>Upload a cover image for the class card.</small>
                </div>
                <label className="teacher-upload-dropzone teacher-upload-dropzone--image">
                  <input type="file" accept="image/*" onChange={handleCreateImageUpload} />
                  {newClassForm.image ? (
                    <>
                      <img src={newClassForm.image} alt="Class cover preview" className="teacher-upload-dropzone__preview" />
                      <span className="teacher-upload-dropzone__overlay">Upload another image</span>
                      <button
                        type="button"
                        className="teacher-upload-dropzone__remove"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setNewClassForm((p) => ({ ...p, image: '' })) }}
                        aria-label="Remove image"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <span className="teacher-upload-dropzone__empty">Upload image</span>
                  )}
                </label>
              </div>

              {createError && <p className="teacher-inline-state teacher-inline-state--error">{createError}</p>}

              <div className="teacher-modal__actions">
                <button type="button" className="teacher-button teacher-button--ghost" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="teacher-button teacher-button--primary" disabled={createLoading}>
                  {createLoading ? 'Creating...' : 'Create Class'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ── Toast ── */}
      {info && <div className="teacher-toast" role="status">{info}</div>}
    </div>
  )
}
