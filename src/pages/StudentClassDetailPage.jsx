import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BookOpen, ClipboardList, FileQuestion, Home, Monitor, MoreVertical, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  getClassAssignments,
  getClassroomById,
  getClassroomNotices,
  getClassroomStudents
} from '../services/classroomService.js'
import { formatDateTime, getAvatarLetters } from '../components/common/test.js'
import ClassroomSidebar from '../components/common/ClassroomSidebar.jsx'
import StreamCard from '../components/common/StreamCard.jsx'
import { ClassDetailSkeleton, StreamCardSkeleton } from '../components/common/ClassroomSkeletons.jsx'

const tabs = [
  { key: 'stream', label: 'Stream' },
  { key: 'classwork', label: 'Classwork' },
  { key: 'people', label: 'People' }
]

const pickAttachments = (item) => {
  if (Array.isArray(item?.attachments)) return item.attachments
  if (Array.isArray(item?.files)) return item.files
  return []
}

const isImageAttachment = (url) => /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url || '')

const getAttachmentLabel = (url, index) => {
  try {
    const parsedUrl = new URL(url)
    const fileName = parsedUrl.pathname.split('/').filter(Boolean).pop()
    if (fileName) return decodeURIComponent(fileName)
  } catch {
    // Fallback for non-URL or malformed values.
  }
  return `Link ${index + 1}`
}

export default function StudentClassDetailPage() {
  const { classId } = useParams()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [activeTab, setActiveTab] = useState('stream')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [classroom, setClassroom] = useState(null)
  const [students, setStudents] = useState([])
  const [assignments, setAssignments] = useState([])
  const [notices, setNotices] = useState([])
  const [peopleSearch, setPeopleSearch] = useState('')

  const avatarInitials = useMemo(() => getAvatarLetters(user?.name, 'S'), [user?.name])

  const streamItems = useMemo(() => {
    const noticeItems = (notices || []).map((notice) => ({
      id: notice._id,
      type: 'notice',
      title: notice.title || 'Class notice',
      body: notice.message,
      createdAt: notice.createdAt,
      createdBy: notice.createdBy
    }))

    const assignmentItems = (assignments || []).map((assignment) => ({
      id: assignment._id,
      type: 'assignment',
      title: assignment.title || 'Assignment',
      body: assignment.description || '',
      createdAt: assignment.createdAt || assignment.updatedAt,
      dueDate: assignment.dueDate
    }))

    return [...assignmentItems, ...noticeItems].sort((a, b) => {
      const left = new Date(a.createdAt || 0).getTime()
      const right = new Date(b.createdAt || 0).getTime()
      return right - left
    })
  }, [assignments, notices])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const sidebarLinks = [
    { key: 'home', label: 'Dashboard', icon: Home, isActive: false, onClick: () => navigate('/student/dashboard') },
    { key: 'simulator', label: 'Open Simulator', icon: Monitor, isActive: false, onClick: () => navigate('/simulator') },
    { key: 'join', label: 'Join class', icon: BookOpen, isActive: false, onClick: () => navigate('/student/dashboard?joinCode=') }
  ]

  const loadClassDetail = async () => {
    if (!classId) return
    setLoading(true)
    setError('')

    try {
      const classData = await getClassroomById(classId)
      setClassroom(classData)

      const [assignmentRows, noticeRows, studentRows] = await Promise.all([
        getClassAssignments(classId),
        getClassroomNotices(classId),
        getClassroomStudents(classId)
      ])

      setAssignments(assignmentRows)
      setNotices(noticeRows)
      setStudents(studentRows)
    } catch (detailError) {
      setError(detailError.message || 'Failed to load class details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClassDetail()
  }, [classId])

  if (loading) {
    return <ClassDetailSkeleton />
  }

  if (!classroom) {
    return (
      <div className="teacher-dashboard-page">
        <main className="teacher-dashboard-main teacher-dashboard-main--with-fixed-sidebar">
          <p className="teacher-inline-state teacher-inline-state--error">{error || 'Class not found'}</p>
        </main>
      </div>
    )
  }

  return (
    <div className="teacher-dashboard-page">
      <ClassroomSidebar links={sidebarLinks} user={user} onLogout={handleLogout} />

      <main className="teacher-dashboard-main teacher-dashboard-main--with-fixed-sidebar">
        <section className="teacher-class-page teacher-class-page--shell">
          <header className="teacher-class-hero" style={classroom.image ? { backgroundImage: `url(${classroom.image})` } : undefined}>
            <div className="teacher-class-hero__overlay" />
            <div className="teacher-class-hero__content">
              <h1>{classroom.name}</h1>
              <p>{classroom.bio || 'Class stream and assignments'}</p>
            </div>
          </header>

          <nav className="teacher-class-tabs" aria-label="Classroom sections">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`teacher-class-tabs__item${activeTab === tab.key ? ' is-active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="teacher-class-layout is-stream">
            <section className="teacher-class-main">
              {error ? <p className="teacher-inline-state teacher-inline-state--error">{error}</p> : null}

              {activeTab === 'stream' && (
                <section className="teacher-list-block teacher-list-block--stream">
                  <div className="teacher-notice-stream">
                    {streamItems.length === 0 ? (
                      <p className="teacher-inline-state">No posts yet.</p>
                    ) : (
                      streamItems.map((item) => (
                        <StreamCard
                          key={`${item.type}-${item.id}`}
                          item={item}
                          avatarInitials={avatarInitials}
                          teacherName={classroom.teacher?.name || 'Teacher'}
                          classId={classId}
                          showCommentInput={item.type === 'notice'}
                          enableComments={true}
                        />
                      ))
                    )}
                  </div>
                </section>
              )}

              {activeTab === 'classwork' && (
                <section className="teacher-list-block teacher-list-block--classwork teacher-list-block--student-classwork">
                  {assignments.length === 0 ? (
                    <p className="teacher-inline-state teacher-inline-state--plain">No assignment.</p>
                  ) : (
                  <div className="teacher-classwork-module teacher-classwork-module--student">
                    <header className="teacher-classwork-module__header">
                      <div className="teacher-classwork-module__title">
                        <h3>Classwork</h3>
                        <small>{assignments.length} items</small>
                      </div>
                      <button type="button" className="teacher-classwork-module__menu" aria-label="Classwork menu">
                        <MoreVertical size={16} />
                      </button>
                    </header>

                    <div className="teacher-classwork-list">
                    {assignments.map((assignment) => {
                        const attachments = pickAttachments(assignment)
                        const imageAttachments = attachments.filter((url) => isImageAttachment(url)).slice(0, 2)

                        return (
                          <article key={assignment._id} className="teacher-classwork-item teacher-classwork-item--student">
                            <div className="teacher-classwork-item__row">
                              <div className="teacher-classwork-item__icon" aria-hidden="true">
                                {assignment.dueDate ? <ClipboardList size={16} /> : <FileQuestion size={16} />}
                              </div>
                              <div className="teacher-classwork-item__copy">
                                <div className="teacher-classwork-item__top">
                                  <strong>{assignment.title}</strong>
                                  <span className={`teacher-classwork-item__badge teacher-classwork-item__badge--${assignment.dueDate ? (new Date(assignment.dueDate) < new Date() ? 'overdue' : 'upcoming') : 'nodue'}`}>
                                    {assignment.dueDate ? (new Date(assignment.dueDate) < new Date() ? 'Overdue' : 'Due') : 'No due date'}
                                  </span>
                                </div>
                                <small>
                                  {assignment.dueDate ? `Due ${formatDateTime(assignment.dueDate)}` : `Posted ${formatDateTime(assignment.createdAt)}`}
                                </small>
                                {attachments.length > 0 ? (
                                  <div className="teacher-classwork-item__attachments">
                                    {imageAttachments.map((url, idx) => (
                                      <img key={`${assignment._id}-img-${idx}`} src={url} alt="Attachment preview" className="teacher-classwork-item__attachment-thumb" />
                                    ))}
                                    <div className="teacher-classwork-item__links" role="list" aria-label="Assignment links">
                                      {attachments.map((url, idx) => (
                                        <a
                                          key={`${assignment._id}-link-${idx}`}
                                          href={url}
                                          target="_blank"
                                          rel="noreferrer"
                                          role="listitem"
                                          className="teacher-classwork-item__link"
                                        >
                                          {getAttachmentLabel(url, idx)}
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </article>
                        )
                      })}
                  </div>
                  </div>
                  )}
                </section>
              )}

              {activeTab === 'people' && (
                <section className="teacher-list-block teacher-list-block--people">
                  <section className="teacher-people-section">
                    <header className="teacher-people-section__header">
                      <h3>Teachers</h3>
                    </header>

                    <div className="teacher-people-row teacher-people-row--teacher">
                      <div className="teacher-people-row__main">
                        <div className="teacher-people-row__avatar teacher-people-row__avatar--teacher">
                          {classroom.teacher?.image ? (
                            <img src={classroom.teacher.image} alt={classroom.teacher?.name || 'Teacher'} className="teacher-people-row__avatar-image" />
                          ) : (
                            getAvatarLetters(classroom.teacher?.name, 'T')
                          )}
                        </div>
                        <div>
                          <strong>{classroom.teacher?.name || 'Class teacher'}</strong>
                          <small>{classroom.teacher?.email || 'Teacher account'}</small>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="teacher-people-section">
                    <header className="teacher-people-section__header teacher-people-section__header--students">
                      <div className="teacher-people-section__title">
                        <h3>Students</h3>
                        <small>{students.length} students</small>
                      </div>
                    </header>

                    <div className="teacher-people-search">
                      <Search size={18} aria-hidden="true" />
                      <input
                        type="text"
                        placeholder="Search students..."
                        value={peopleSearch}
                        onChange={(event) => setPeopleSearch(event.target.value)}
                      />
                    </div>

                    <div className="teacher-people-list">
                      {students
                        .filter((student) => {
                          if (!peopleSearch.trim()) return true
                          const query = peopleSearch.toLowerCase()
                          return (
                            student.name?.toLowerCase().includes(query) ||
                            student.email?.toLowerCase().includes(query)
                          )
                        })
                        .map((student) => (
                          <article key={student._id} className="teacher-people-row">
                            <div className="teacher-people-row__main">
                              <div className="teacher-people-row__avatar">
                                {student?.image ? (
                                  <img src={student.image} alt={student?.name || 'Student'} className="teacher-people-row__avatar-image" />
                                ) : (
                                  getAvatarLetters(student?.name, 'S')
                                )}
                              </div>
                              <div>
                                <strong>{student.name}</strong>
                                <small>{student.email}</small>
                              </div>
                            </div>
                          </article>
                        ))}
                    </div>
                  </section>
                </section>
              )}
            </section>

            <aside className="teacher-class-right">
              <section className="teacher-detail-card">
                <h3>Class info</h3>
                <div className="teacher-detail-list">
                  <article className="teacher-detail-list__item">
                    <small>Teacher</small>
                    <strong>{classroom.teacher?.name || 'Teacher'}</strong>
                  </article>
                  <article className="teacher-detail-list__item">
                    <small>Students</small>
                    <strong>{students.length}</strong>
                  </article>
                </div>
              </section>
            </aside>
          </div>
        </section>
      </main>
    </div>
  )
}

