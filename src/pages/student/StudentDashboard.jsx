import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, ClipboardCheck, Home, Monitor, X } from 'lucide-react'
import { useAuth } from "../../context/AuthContext.jsx";
import { useGamification } from "../../context/GamificationContext.jsx";
import { PROJECTS } from "../../services/gamification/ProjectsConfig.js";
import {
  getClassAssignments,
  getClassroomNotices,
  getMyClassrooms,
  joinClassroomByCode
} from '../../services/classroomService.js'
import { formatDateTime, normalizeJoinCode, getAvatarLetters } from '../../components/common/test.js'
import ClassroomSidebar from '../../components/common/ClassroomSidebar.jsx'
import ClassCard from '../../components/common/ClassCard.jsx'
import { ClassCardSkeleton } from '../../components/common/ClassroomSkeletons.jsx'

const DEMO_PROJECTS = [
  { title: 'LED Blink',          slug: 'led-blink',          board: 'Arduino Uno', difficulty: 'Beginner',     icon: '💡', xp: 100 },
  { title: 'RGB LED',            slug: 'rgb-led',             board: 'Arduino Uno', difficulty: 'Beginner',     icon: '🌈', xp: 150 },
  { title: 'Buzzer',             slug: 'buzzer',              board: 'Arduino Uno', difficulty: 'Beginner',     icon: '🔊', xp: 150 },
  { title: 'Potentiometer',      slug: 'potentiometer',       board: 'Arduino Uno', difficulty: 'Beginner',     icon: '🎛️', xp: 175 },
  { title: 'Button & Debounce',  slug: 'button-debounce',     board: 'Arduino Uno', difficulty: 'Beginner',     icon: '🔘', xp: 200 },
  { title: 'Temperature Sensor', slug: 'temperature-sensor',  board: 'Arduino Uno', difficulty: 'Intermediate', icon: '🌡️', xp: 250 },
]

export default function StudentDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const {
    currentLevel, currentLevelData, nextLevel, xpProgress, xp,
    completedProjects = [], unlockedComponents = [], earnedBadges = [], coins = 0,
  } = useGamification()

  const completedCount = completedProjects.length
  const unlockedCount = unlockedComponents.length

  const [classrooms, setClassrooms] = useState([])
  const [assignmentsByClass, setAssignmentsByClass] = useState({})
  const [noticesByClass, setNoticesByClass] = useState({})
  const [loadingDashboard, setLoadingDashboard] = useState(true)
  const [dashboardError, setDashboardError] = useState('')

  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [info, setInfo] = useState('')

  const firstName = user?.name ? user.name.split(' ')[0] : 'Student'
  const avatarLetter = getAvatarLetters(user?.name, 'S')

  const loadDashboardData = async () => {
    setLoadingDashboard(true)
    setDashboardError('')

    try {
      const classroomList = await getMyClassrooms()
      setClassrooms(classroomList)

      if (classroomList.length === 0) {
        setAssignmentsByClass({})
        setNoticesByClass({})
        return
      }

      const details = await Promise.all(
        classroomList.map(async (classroom) => {
          try {
            const [assignments, notices] = await Promise.all([
              getClassAssignments(classroom._id),
              getClassroomNotices(classroom._id)
            ])

            return [classroom._id, { assignments, notices }]
          } catch {
            return [classroom._id, { assignments: [], notices: [] }]
          }
        })
      )

      const assignmentMap = {}
      const noticeMap = {}

      details.forEach(([classId, payload]) => {
        assignmentMap[classId] = payload.assignments || []
        noticeMap[classId] = payload.notices || []
      })

      setAssignmentsByClass(assignmentMap)
      setNoticesByClass(noticeMap)
    } catch (loadError) {
      setDashboardError(loadError.message || 'Failed to load student dashboard')
    } finally {
      setLoadingDashboard(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  useEffect(() => {
    if (!info) return undefined
    const timeoutId = setTimeout(() => setInfo(''), 3200)
    return () => clearTimeout(timeoutId)
  }, [info])

  useEffect(() => {
    const codeFromQuery = normalizeJoinCode(new URLSearchParams(location.search).get('joinCode'))
    if (codeFromQuery) {
      setJoinCode(codeFromQuery)
      setJoinError('')
      setIsJoinModalOpen(true)
    }
  }, [location.search])

  const upcomingAssignments = useMemo(() => {
    const rows = classrooms.flatMap((classroom) =>
      (assignmentsByClass[classroom._id] || []).map((assignment) => ({
        classId: classroom._id,
        className: classroom.name,
        title: assignment.title || 'Assignment',
        dueDate: assignment.dueDate,
        createdAt: assignment.createdAt
      }))
    )

    return rows
      .filter((item) => item.dueDate)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 6)
  }, [assignmentsByClass, classrooms])

  const recentUpdates = useMemo(() => {
    const items = []

    classrooms.forEach((classroom) => {
      ;(noticesByClass[classroom._id] || []).forEach((notice) => {
        items.push({
          id: `notice-${notice._id}`,
          type: 'notice',
          className: classroom.name,
          title: notice.title || 'Class Notice',
          body: notice.message,
          createdAt: notice.createdAt
        })
      })

      ;(assignmentsByClass[classroom._id] || []).forEach((assignment) => {
        items.push({
          id: `assignment-${assignment._id}`,
          type: 'assignment',
          className: classroom.name,
          title: assignment.title || 'Assignment posted',
          body: assignment.description || 'New assignment added in this class.',
          createdAt: assignment.createdAt
        })
      })
    })

    return items
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 6)
  }, [assignmentsByClass, classrooms, noticesByClass])

  const totalAssignments = useMemo(
    () => Object.values(assignmentsByClass).reduce((sum, row) => sum + row.length, 0),
    [assignmentsByClass]
  )

  const totalNotices = useMemo(
    () => Object.values(noticesByClass).reduce((sum, row) => sum + row.length, 0),
    [noticesByClass]
  )

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const handleOpenJoinModal = () => {
    setJoinError('')
    setJoinCode('')
    setIsJoinModalOpen(true)
  }

  const sidebarLinks = [
    { key: 'home', label: 'Dashboard', icon: Home, isActive: true, onClick: () => {} },
    { key: 'simulator', label: 'Open Simulator', icon: Monitor, isActive: false, onClick: () => navigate('/simulator') },
    { key: 'join', label: 'Join class', icon: BookOpen, isActive: false, onClick: handleOpenJoinModal }
  ]

  const handlePasteCode = async () => {
    try {
      const clipText = await navigator.clipboard.readText()
      setJoinCode(normalizeJoinCode(clipText))
    } catch {
      setJoinError('Clipboard access blocked. Paste the code manually.')
    }
  }

  const handleJoinClass = async (event) => {
    event.preventDefault()

    const normalizedCode = normalizeJoinCode(joinCode)
    if (!normalizedCode) {
      setJoinError('Please enter a valid class code')
      return
    }

    setJoinLoading(true)
    setJoinError('')

    try {
      await joinClassroomByCode(normalizedCode)
      setIsJoinModalOpen(false)
      setInfo('Joined class successfully.')
      await loadDashboardData()
    } catch (joinClassError) {
      setJoinError(joinClassError.message || 'Failed to join class')
    } finally {
      setJoinLoading(false)
    }
  }

  return (
    <div className="teacher-dashboard-page">
      <ClassroomSidebar
        links={sidebarLinks}
        user={user}
        onLogout={handleLogout}
        onProfileClick={() => navigate('/student/profile')}
      />

      <main className="teacher-dashboard-main teacher-dashboard-main--with-fixed-sidebar">
        <section className="teacher-hero">
          <div className="teacher-hero__content">
            <p className="teacher-hero__eyebrow">Welcome back</p>
            <h2 className="teacher-hero__title">{firstName}, ready to build your next project?</h2>
            <p className="teacher-hero__summary">
              You have {classrooms.length} joined classes, {totalAssignments} assignments, and {totalNotices} class updates.
            </p>
            <div className="teacher-hero__actions">
              <button
                type="button"
                className="teacher-button teacher-button--primary"
                onClick={() => navigate('/simulator')}
              >
                Open Simulator
              </button>
              <button
                type="button"
                className="teacher-button teacher-button--secondary"
                onClick={handleOpenJoinModal}
              >
                Join a class
              </button>
            </div>
          </div>

          <div className="teacher-hero__badge">
            <div className="teacher-hero__shape teacher-hero__shape--outer" />
            <div className="teacher-hero__shape teacher-hero__shape--inner" />
            {user?.image ? (
              <img
                src={user.image}
                alt={user?.name || 'Student'}
                className="teacher-hero__avatar-image"
              />
            ) : (
              <div className="teacher-hero__monogram">{avatarLetter}</div>
            )}
          </div>
        </section>

        <section className="teacher-dashboard-grid">
          {/* LEFT COLUMN CONTENT */}
          <div>
            {/* CLASSES PANEL */}
            <section className="teacher-classes-panel">
              <header className="teacher-section-heading teacher-section-heading--compact">
                <h3>Your classes</h3>
                <button type="button" className="teacher-section-link" onClick={handleOpenJoinModal}>
                  + Join
                </button>
              </header>

              {loadingDashboard ? (
                <div className="teacher-class-grid">
                  <ClassCardSkeleton count={4} />
                </div>
              ) : null}
              {dashboardError ? <p className="teacher-inline-state teacher-inline-state--error">{dashboardError}</p> : null}

              {!loadingDashboard && !dashboardError && classrooms.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">??</div>
                  <p>You have not joined any classes yet.</p>
                  <button type="button" className="btn btn-primary" onClick={handleOpenJoinModal}>
                    Join with class code
                  </button>
                </div>
              ) : null}

              {!loadingDashboard && classrooms.length > 0 ? (
                <div className="teacher-class-grid">
                  {classrooms.map((classroom, index) => (
                    <ClassCard
                      key={classroom._id}
                      classroom={classroom}
                      index={index}
                      role="student"
                      userName={classroom.teacher?.name || 'Teacher'}
                      avatarInitials={avatarLetter}
                      onClick={() => navigate(`/student/classes/${classroom._id}`)}
                    />
                  ))}
                </div>
              ) : null}
            </section>

            {/* DEMO PROJECTS — guide only, no gamification */}
            <section className="teacher-classes-panel projects-section student-dashboard__section-gap">
              <header className="teacher-section-heading teacher-section-heading--compact">
                <div>
                  <h3 className="student-dashboard__section-title">Guided project demos</h3>
                  <p className="section-sub student-dashboard__section-sub">
                    Explore the circuit and code before starting the real challenge
                  </p>
                </div>
              </header>

              <div className="projects-grid student-dashboard__projects-grid">
                {DEMO_PROJECTS.map((p) => (
                  <div
                    className="project-card"
                    key={p.slug}
                    onClick={() => navigate(`/${p.slug}/guide`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="project-icon">{p.icon}</div>
                    <div className="project-info">
                      <h4>{p.title}</h4>
                      <span className="project-board">{p.board}</span>
                    </div>
                    <div className="project-meta">
                      <span className={`difficulty ${p.difficulty.toLowerCase()}`}>{p.difficulty}</span>
                      <span className="points">+{p.xp} XP</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* GAMIFIED PROGRESS — XP, level, completed projects */}
            <section className="teacher-classes-panel projects-section student-dashboard__section-gap">
              <header className="teacher-section-heading teacher-section-heading--compact">
                <div>
                  <h3 className="student-dashboard__section-title">Your progress</h3>
                  <p className="section-sub student-dashboard__section-sub">
                    Complete gamified projects to earn XP, coins, and badges
                  </p>
                </div>
                <button type="button" className="teacher-section-link" onClick={() => navigate('/projects')}>
                  Full Project Gallery →
                </button>
              </header>

              {/* XP + level bar */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                background: 'var(--card, #1a2236)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '14px 18px', margin: '1rem 0',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: `${currentLevelData?.color || '#22c55e'}22`,
                  border: `2px solid ${currentLevelData?.color || '#22c55e'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 800, color: currentLevelData?.color || '#22c55e',
                }}>{currentLevel}</div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 5 }}>
                    {currentLevelData?.title || 'Hello, World'}
                    <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.5, marginLeft: 6 }}>
                      Level {currentLevel}
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden', marginBottom: 3 }}>
                    <div style={{
                      height: '100%', borderRadius: 999,
                      width: `${xpProgress}%`,
                      background: `linear-gradient(90deg, ${currentLevelData?.color || '#22c55e'}, ${nextLevel?.color || currentLevelData?.color || '#22c55e'})`,
                      transition: 'width .5s',
                    }} />
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.5 }}>
                    {xpProgress}% to Level {nextLevel?.id ?? '—'} · {xp.toLocaleString()} XP total
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[
                    { icon: '✅', label: 'Completed', value: completedCount },
                    { icon: '🔓', label: 'Components', value: unlockedCount },
                    { icon: '🏅', label: 'Badges', value: earnedBadges.length },
                    { icon: '🪙', label: 'Coins', value: coins },
                  ].map(s => (
                    <div key={s.label} style={{
                      textAlign: 'center', padding: '6px 12px',
                      background: 'var(--bg, #07080f)', border: '1px solid var(--border)',
                      borderRadius: 8,
                    }}>
                      <div style={{ fontSize: 16 }}>{s.icon}</div>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{s.value}</div>
                      <div style={{ fontSize: 9, opacity: 0.45, textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent completed projects */}
              {completedCount > 0 ? (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.4, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>
                    Recently completed
                  </div>
                  <div className="projects-grid">
                    {PROJECTS.filter(p => completedProjects.includes(p.slug)).slice(0, 3).map(p => (
                      <div
                        key={p.slug}
                        className="project-card"
                        onClick={() => navigate(`/gamification-simulator/${p.slug}`)}
                        style={{ cursor: 'pointer', borderColor: 'rgba(34,197,94,.3)', background: 'rgba(34,197,94,.04)' }}
                      >
                        <div className="project-icon">{p.icon}</div>
                        <div className="project-info">
                          <h4 style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ fontSize: 11, color: '#22c55e' }}>✓</span>
                            {p.title}
                          </h4>
                          <span className="project-board">{p.estimatedTime}</span>
                        </div>
                        <div className="project-meta">
                          <span className="difficulty beginner">Done</span>
                          <span className="points">+{p.xpReward} XP</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{
                  textAlign: 'center', padding: '28px 0',
                  opacity: 0.45, fontSize: 13,
                }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>🎯</div>
                  No projects completed yet. Go to the Full Project Gallery to start!
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: '1rem' }}>
                <button
                  type="button"
                  className="teacher-button teacher-button--primary"
                  onClick={() => navigate('/projects')}
                  style={{ flex: 1 }}
                >
                  🚀 Start a Gamified Project
                </button>
                <button
                  type="button"
                  className="teacher-button teacher-button--secondary"
                  onClick={() => navigate('/components')}
                >
                  🔓 Unlock Components
                </button>
              </div>
            </section>
          </div>

          {/* RIGHT SIDEBAR */}
          <aside className="teacher-dashboard-sidepanels">
            <section className="teacher-side-card">
              <header className="teacher-section-heading teacher-section-heading--compact">
                <h3>Upcoming assignments</h3>
              </header>
              <div className="teacher-upcoming-list">
                {loadingDashboard ? (
                  <div className="teacher-upcoming-skeleton" aria-hidden="true">
                    <div className="teacher-skeleton teacher-skeleton--line" />
                    <div className="teacher-skeleton teacher-skeleton--line" />
                    <div className="teacher-skeleton teacher-skeleton--line" />
                  </div>
                ) : upcomingAssignments.length === 0 ? (
                  <p className="teacher-inline-state">No upcoming assignments.</p>
                ) : (
                  upcomingAssignments.map((item) => (
                    <article key={`${item.classId}-${item.title}`} className="teacher-upcoming-item">
                      <span className="teacher-upcoming-item__dot tone-blue" aria-hidden="true" />
                      <div className="teacher-upcoming-item__copy">
                        <h4>{item.title}</h4>
                        <p>{item.className}</p>
                        <strong>{formatDateTime(item.dueDate)}</strong>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="teacher-side-card">
              <header className="teacher-section-heading teacher-section-heading--compact">
                <h3>Recent updates</h3>
              </header>

              <div className="student-update-list">
                {loadingDashboard ? (
                  <div className="teacher-upcoming-skeleton" aria-hidden="true">
                    <div className="teacher-skeleton teacher-skeleton--line" />
                    <div className="teacher-skeleton teacher-skeleton--line" />
                  </div>
                ) : recentUpdates.length === 0 ? (
                  <p className="teacher-inline-state">No class updates yet.</p>
                ) : (
                  recentUpdates.map((item) => (
                    <article key={item.id} className="student-update-item">
                      <div className="student-update-item__icon" aria-hidden="true">
                        <ClipboardCheck size={14} />
                      </div>
                      <div>
                        <strong>{item.title}</strong>
                        <small>
                          {item.className} {'\u00B7'} {formatDateTime(item.createdAt)}
                        </small>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="teacher-side-card">
              <header className="teacher-section-heading teacher-section-heading--compact">
                <h3>Snapshot</h3>
              </header>
              <div className="teacher-mini-stats">
                <div className="teacher-mini-stats__row">
                  <span>Joined Classes</span>
                  <strong>{classrooms.length}</strong>
                </div>
                <div className="teacher-mini-stats__row">
                  <span>Assignments</span>
                  <strong>{totalAssignments}</strong>
                </div>
                <div className="teacher-mini-stats__row">
                  <span>Classmates</span>
                  <strong>{classrooms.reduce((sum, c) => sum + (c.students?.length || 0), 0)}</strong>
                </div>
              </div>
            </section>
          </aside>
        </section>
      </main>

      {isJoinModalOpen && (
        <div className="teacher-modal" role="dialog" aria-modal="true" aria-label="Join class with code">
          <div className="teacher-modal__backdrop" onClick={() => setIsJoinModalOpen(false)} />
          <section className="teacher-modal__content student-join-modal">
            <header className="teacher-modal__header student-join-modal__header">
              <h3>Join class</h3>
              <button type="button" onClick={() => setIsJoinModalOpen(false)} aria-label="Close">
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
                  onChange={(event) => setJoinCode(normalizeJoinCode(event.target.value))}
                  placeholder="AB12CD"
                  autoFocus
                />
              </label>

              {joinError ? <p className="teacher-inline-state teacher-inline-state--error">{joinError}</p> : null}

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
                  {joinLoading ? 'Joining...' : 'Join class'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {info && (
        <div className="teacher-toast" role="status">
          {info}
        </div>
      )}
    </div>
  )
}
