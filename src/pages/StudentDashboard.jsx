import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, ClipboardCheck, Home, Monitor, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  getClassAssignments,
  getClassroomNotices,
  getMyClassrooms,
  joinClassroomByCode
} from '../services/classroomService.js'
import { formatDateTime, normalizeJoinCode, getAvatarLetters } from '../components/common/test.js'
import ClassroomSidebar from '../components/common/ClassroomSidebar.jsx'
import ClassCard from '../components/common/ClassCard.jsx'
import { ClassCardSkeleton } from '../components/common/ClassroomSkeletons.jsx'

export default function StudentDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

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
      <ClassroomSidebar links={sidebarLinks} user={user} onLogout={handleLogout} />

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
            <div className="teacher-hero__monogram">{avatarLetter}</div>
          </div>
        </section>

        <section className="teacher-dashboard-grid">
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
