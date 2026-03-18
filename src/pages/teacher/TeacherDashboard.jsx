import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Archive,
  BookOpenCheck,
  CalendarDays,
  FolderKanban,
  Home,
  Monitor,
  Plus,
  Settings,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { createClassroom, deleteClassroom, getMyClassrooms } from '../../services/classroomService.js'
import { formatDateTime, getAvatarLetters } from '../../components/common/test.js'
import ClassroomSidebar from '../../components/common/ClassroomSidebar.jsx'
import ClassCard from '../../components/common/ClassCard.jsx'
import { ClassCardSkeleton } from '../../components/common/ClassroomSkeletons.jsx'

const sidebarLinks = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'simulator', label: 'Open Simulator', icon: Monitor },
  { key: 'settings', label: 'Settings', icon: Settings }
]

export default function TeacherDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [classrooms, setClassrooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')
  const [newClassForm, setNewClassForm] = useState({
    name: '',
    bio: '',
    image: ''
  })

  const firstName = user?.name?.split(' ')[0] || 'Teacher'
  const avatarInitials = getAvatarLetters(user?.name, 'T')

  const loadClassrooms = async () => {
    setLoading(true)
    setError('')

    try {
      const classroomList = await getMyClassrooms()
      setClassrooms(classroomList)
    } catch (loadError) {
      setError(loadError.message || 'Unable to load classes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClassrooms()
  }, [])

  const upcomingAssignments= useMemo(() => {
    const allAssignments = classrooms.flatMap((classroom) =>
      (classroom.assignments || []).map((assignment) => ({
        classId: classroom._id,
        course: classroom.name,
        title: assignment.title || 'Assignment',
        dueDate: assignment.dueDate
      }))
    )

    return allAssignments
      .filter((item) => item.dueDate)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 4)
  }, [classrooms])

  const totalStudents = useMemo(
    () => classrooms.reduce((count, classroom) => count + (classroom.students?.length || 0), 0),
    [classrooms]
  )

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const navLinks = sidebarLinks.map((item) => ({
    ...item,
    isActive: item.key === 'home',
    onClick: () => {
      if (item.key === 'simulator') navigate('/simulator')
    }
  }))

  const handleCreateInputChange = (event) => {
    setNewClassForm((prev) => ({
      ...prev,
      [event.target.name]: event.target.value
    }))
  }

  const handleCreateClass = async (event) => {
    event.preventDefault()

    if (!newClassForm.name.trim()) {
      setCreateError('Class name is required')
      return
    }

    setCreateLoading(true)
    setCreateError('')

    try {
      await createClassroom({
        name: newClassForm.name,
        bio: newClassForm.bio,
        image: newClassForm.image
      })
      setNewClassForm({ name: '', bio: '', image: '' })
      setIsModalOpen(false)
      await loadClassrooms()
    } catch (createClassError) {
      setCreateError(createClassError.message || 'Failed to create class')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleDeleteClass = async (event, classId) => {
    event.stopPropagation()
    event.preventDefault()

    const shouldDelete = window.confirm('Delete this class? This will remove all assignments and notices.')
    if (!shouldDelete) {
      return
    }

    try {
      await deleteClassroom(classId)
      await loadClassrooms()
    } catch (deleteError) {
      setError(deleteError.message || 'Failed to delete class')
    }
  }

  return (
    <div className="teacher-dashboard-page">
      <ClassroomSidebar links={navLinks} user={user} onLogout={handleLogout} />

      <main className="teacher-dashboard-main teacher-dashboard-main--with-fixed-sidebar">
        <section className="teacher-hero">
          <div className="teacher-hero__content">
            <p className="teacher-hero__eyebrow">Good morning</p>
            <h2 className="teacher-hero__title">{firstName}</h2>
            <p className="teacher-hero__summary">
              You have {classrooms.length} active classes and {upcomingAssignments.length} upcoming assignment deadlines.
            </p>

            <div className="teacher-hero__actions">
              <button type="button" className="teacher-button teacher-button--primary" onClick={() => setIsModalOpen(true)}>
                Add Class
              </button>
              <button type="button" className="teacher-button teacher-button--secondary" onClick={() => navigate('/simulator')}>
                Open Simulator
              </button>
            </div>
          </div>

          <div className="teacher-hero__badge" aria-hidden="true">
            <div className="teacher-hero__shape teacher-hero__shape--outer" />
            <div className="teacher-hero__shape teacher-hero__shape--inner" />
            <span className="teacher-hero__monogram">OH</span>
          </div>
        </section>

        <div className="teacher-dashboard-grid">
          <section className="teacher-classes-panel">
            <div className="teacher-section-heading">
              <h3>Your Classes</h3>
              <button type="button" className="teacher-section-link" onClick={() => setIsModalOpen(true)}>
                + Add new
              </button>
            </div>

            {loading ? <p className="teacher-inline-state">Loading classes...</p> : null}
            {error ? <p className="teacher-inline-state teacher-inline-state--error">{error}</p> : null}

            <div className="teacher-class-grid">
              {loading ? (
                <ClassCardSkeleton count={4} />
              ) : null}

              {classrooms.map((classroom, index) => (
                <ClassCard
                  key={classroom._id}
                  classroom={classroom}
                  index={index}
                  role="teacher"
                  userName={user?.name || 'Teacher'}
                  avatarInitials={avatarInitials}
                  onClick={() => navigate(`/teacher/classes/${classroom._id}`)}
                  onDelete={handleDeleteClass}
                />
              ))}

              <button type="button" className="teacher-class-card teacher-class-card--add" onClick={() => setIsModalOpen(true)}>
                <span className="teacher-class-card__plus"><Plus size={18} /></span>
                <span className="teacher-class-card__add-title">Add New Class</span>
                <span className="teacher-class-card__add-copy">Create classroom and share join code</span>
              </button>
            </div>
          </section>

          <aside className="teacher-dashboard-sidepanels">
            <section className="teacher-side-card">
              <div className="teacher-section-heading teacher-section-heading--compact">
                <h3>Upcoming</h3>
              </div>

              <div className="teacher-upcoming-list">
                {loading ? (
                  <div className="teacher-upcoming-skeleton" aria-hidden="true">
                    <div className="teacher-skeleton teacher-skeleton--line" />
                    <div className="teacher-skeleton teacher-skeleton--line" />
                    <div className="teacher-skeleton teacher-skeleton--line" />
                  </div>
                ) : upcomingAssignments.length === 0 ? (
                  <p className="teacher-inline-state">No upcoming assignments yet.</p>
                ) : (
                  upcomingAssignments.map((item) => (
                    <article key={`${item.classId}-${item.title}`} className="teacher-upcoming-item">
                      <span className="teacher-upcoming-item__dot tone-blue" aria-hidden="true" />
                      <div className="teacher-upcoming-item__copy">
                        <h4>{item.title}</h4>
                        <p>{item.course}</p>
                        <strong>{formatDateTime(item.dueDate)}</strong>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="teacher-side-card teacher-side-card--stats">
              <div className="teacher-section-heading teacher-section-heading--compact">
                <h3>This Week</h3>
              </div>

              <div className="teacher-mini-stats">
                <div className="teacher-mini-stats__row">
                  <span>Active Classes</span>
                  <strong>{classrooms.length}</strong>
                </div>
                <div className="teacher-mini-stats__row">
                  <span>Upcoming</span>
                  <strong>{upcomingAssignments.length}</strong>
                </div>
                <div className="teacher-mini-stats__row">
                  <span>Students</span>
                  <strong>{totalStudents}</strong>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </main>

      {isModalOpen && (
        <div className="teacher-modal" role="dialog" aria-modal="true" aria-label="Add new class">
          <div className="teacher-modal__backdrop" onClick={() => setIsModalOpen(false)} />
          <section className="teacher-modal__content">
            <header className="teacher-modal__header">
              <h3>
                <Plus size={16} />
                <span>Add New Class</span>
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} aria-label="Close modal">x</button>
            </header>

            <form className="teacher-modal__form" onSubmit={handleCreateClass}>
              <label>
                <span>Class Name</span>
                <input
                  type="text"
                  name="name"
                  value={newClassForm.name}
                  onChange={handleCreateInputChange}
                  placeholder="Advanced Mathematics"
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

              <label>
                <span>Header Image URL</span>
                <input
                  type="url"
                  name="image"
                  value={newClassForm.image}
                  onChange={handleCreateInputChange}
                  placeholder="https://..."
                />
              </label>

              {createError ? <p className="teacher-inline-state teacher-inline-state--error">{createError}</p> : null}

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
    </div>
  )
}
