import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Archive,
  BookOpenCheck,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FilePlus2,
  FileQuestion,
  FolderKanban,
  Home,
  Monitor,
  MoreVertical,
  Copy,
  Link2,
  Plus,
  Search,
  Settings,
  Share2,
  Trash2,
  Video,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  createClassAssignment,
  createClassNotice,
  deleteClassAssignment,
  deleteClassNotice,
  deleteClassroom,
  getAssignmentSubmissions,
  getClassAssignments,
  getClassroomById,
  getClassroomNotices,
  getClassroomStudents,
  removeClassroomStudent,
  updateClassroom,
} from '../services/classroomService.js'
import { formatDateTime, getAvatarLetters, assignmentStatus } from '../components/common/test.js'
import ClassroomSidebar from '../components/common/ClassroomSidebar.jsx'
import StreamCard from '../components/common/StreamCard.jsx'

const sidebarLinks = [
  { key: 'home', label: 'Home', icon: Home, route: '/teacher/dashboard' },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
  { key: 'simulator', label: 'Open Simulator', icon: Monitor, route: '/simulator' },
  { key: 'settings', label: 'Settings', icon: Settings }
]

const tabs = [
  { key: 'stream', label: 'Stream' },
  { key: 'classwork', label: 'Classwork' },
  { key: 'people', label: 'People' },
  { key: 'marks', label: 'Marks' }
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

export default function TeacherClassDetailPage() {
  const { classId } = useParams()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [classroom, setClassroom] = useState(null)
  const [notices, setNotices] = useState([])
  const [assignments, setAssignments] = useState([])
  const [students, setStudents] = useState([])

  const [noticeInput, setNoticeInput] = useState('')
  const [noticeForm, setNoticeForm] = useState({
    title: '',
    message: ''
  })
  const [assignmentForm, setAssignmentForm] = useState({
    title: '',
    description: '',
    dueDate: ''
  })

  const [noticeFiles, setNoticeFiles] = useState('')
  const [assignmentLinks, setAssignmentLinks] = useState([])
  const [assignmentLinkInput, setAssignmentLinkInput] = useState('')

  const [loading, setLoading] = useState(true)
  const [postingNotice, setPostingNotice] = useState(false)
  const [postingAssignment, setPostingAssignment] = useState(false)
  const [deletingClass, setDeletingClass] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const [activeTab, setActiveTab] = useState('stream')
  const [showComposer, setShowComposer] = useState(false)
  const [composerMode, setComposerMode] = useState('assignment')

  const [showClassMenu, setShowClassMenu] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [updatingClass, setUpdatingClass] = useState(false)
  const [editError, setEditError] = useState('')
  const [editForm, setEditForm] = useState({
    name: '',
    bio: '',
    image: ''
  })

  const [activeAssignmentId, setActiveAssignmentId] = useState(null)
  const [submissionsState, setSubmissionsState] = useState({
    loading: false,
    error: '',
    data: null
  })
  const [assignmentMetrics, setAssignmentMetrics] = useState({})
  const classMenuRef = useRef(null)
  const codeMenuRef = useRef(null)
  const [showCodeMenu, setShowCodeMenu] = useState(false)
  const [peopleSearch, setPeopleSearch] = useState('')

  const avatarInitials = useMemo(() => getAvatarLetters(user?.name, 'T'), [user])

  const markStats = useMemo(() => {
    const withDueDate = assignments.filter((item) => item.dueDate)
    const upcoming = withDueDate.filter((item) => new Date(item.dueDate).getTime() >= Date.now())
    const closed = withDueDate.filter((item) => new Date(item.dueDate).getTime() < Date.now())

    return {
      total: assignments.length,
      upcoming: upcoming.length,
      closed: closed.length,
      noDueDate: assignments.length - withDueDate.length
    }
  }, [assignments])

  const streamItems = useMemo(() => {
    const noticeItems = notices.map((notice) => ({
      id: notice._id,
      type: 'notice',
      title: notice.title || 'Class notice',
      body: notice.message,
      createdAt: notice.createdAt,
      createdBy: notice.createdBy,
      raw: notice
    }))

    const assignmentItems = assignments.map((assignment) => ({
      id: assignment._id,
      type: 'assignment',
      title: assignment.title || 'Assignment',
      body: assignment.description || '',
      createdAt: assignment.createdAt || assignment.updatedAt,
      dueDate: assignment.dueDate,
      raw: assignment
    }))

    return [...assignmentItems, ...noticeItems].sort((a, b) => {
      const left = new Date(a.createdAt || 0).getTime()
      const right = new Date(b.createdAt || 0).getTime()
      return right - left
    })
  }, [assignments, notices])

  useEffect(() => {
    if (!info) {
      return undefined
    }

    const timeoutId = setTimeout(() => {
      setInfo('')
    }, 3000)

    return () => clearTimeout(timeoutId)
  }, [info])

  const loadDetailData = async () => {
    if (!classId) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const classData = await getClassroomById(classId)
      setClassroom(classData)

      const [noticesResponse, assignmentsResponse, studentsResponse] = await Promise.all([
        getClassroomNotices(classId),
        getClassAssignments(classId),
        getClassroomStudents(classId)
      ])

      setNotices(noticesResponse)
      setAssignments(assignmentsResponse)
      setStudents(studentsResponse)
    } catch (detailError) {
      setError(detailError.message || 'Failed to load class details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDetailData()
  }, [classId])

  useEffect(() => {
    if (!showComposer) {
      return undefined
    }

    const onEsc = (event) => {
      if (event.key === 'Escape') {
        setShowComposer(false)
      }
    }

    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [showComposer])

  useEffect(() => {
    if (!showClassMenu && !showCodeMenu) {
      return undefined
    }

    const onPointerDown = (event) => {
      if (!classMenuRef.current?.contains(event.target)) {
        setShowClassMenu(false)
      }

      if (!codeMenuRef.current?.contains(event.target)) {
        setShowCodeMenu(false)
      }
    }

    const onEsc = (event) => {
      if (event.key === 'Escape') {
        setShowClassMenu(false)
        setShowCodeMenu(false)
      }
    }

    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onEsc)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onEsc)
    }
  }, [showClassMenu, showCodeMenu])

  useEffect(() => {
    let cancelled = false

    const loadAssignmentMetrics = async () => {
      if (!classId || assignments.length === 0) {
        setAssignmentMetrics({})
        return
      }

      const entries = await Promise.all(
        assignments.map(async (assignment) => {
          try {
            const response = await getAssignmentSubmissions(classId, assignment._id)
            return [assignment._id, response?.stats || { submittedCount: 0, classStudentCount: students.length || 0 }]
          } catch {
            return [assignment._id, { submittedCount: 0, classStudentCount: students.length || 0 }]
          }
        })
      )

      if (!cancelled) {
        setAssignmentMetrics(Object.fromEntries(entries))
      }
    }

    loadAssignmentMetrics()

    return () => {
      cancelled = true
    }
  }, [classId, assignments, students.length])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const navLinks = sidebarLinks.map((item) => ({
    ...item,
    isActive: item.key === 'classes',
    onClick: () => {
      if (item.route) navigate(item.route)
    }
  }))

  const handlePostNotice = async (event) => {
    event.preventDefault()

    if (!noticeInput.trim()) {
      return
    }

    setPostingNotice(true)
    setError('')

    const attachments = noticeFiles.split('\n').map(s => s.trim()).filter(Boolean)

    try {
      await createClassNotice(classId, {
        title: 'Class Update',
        message: noticeInput,
        attachments
      })
      setNoticeInput('')
      setNoticeFiles('')
      setNotices(await getClassroomNotices(classId))
      setShowComposer(false)
    } catch (postError) {
      setError(postError.message || 'Failed to post notice')
    } finally {
      setPostingNotice(false)
    }
  }

  const handleNoticeComposerInput = (event) => {
    setNoticeForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }))
  }

  const handleCreateNoticeFromComposer = async (event) => {
    event.preventDefault()

    if (!noticeForm.message.trim()) {
      return
    }

    setPostingNotice(true)
    setError('')

    const attachments = noticeFiles.split('\n').map((s) => s.trim()).filter(Boolean)

    try {
      await createClassNotice(classId, {
        title: noticeForm.title || 'Class Update',
        message: noticeForm.message,
        attachments
      })
      setNoticeForm({ title: '', message: '' })
      setNoticeFiles('')
      setNotices(await getClassroomNotices(classId))
      setShowComposer(false)
    } catch (postError) {
      setError(postError.message || 'Failed to post notice')
    } finally {
      setPostingNotice(false)
    }
  }

  const handleAssignmentInput = (event) => {
    setAssignmentForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }))
  }

  const handleCreateAssignment = async (event) => {
    event.preventDefault()

    if (!assignmentForm.title.trim()) {
      return
    }

    setPostingAssignment(true)
    setError('')

    const pendingLink = assignmentLinkInput.trim()
    const attachments = [
      ...assignmentLinks.map((link) => link.trim()).filter(Boolean),
      ...(pendingLink ? [pendingLink] : [])
    ]

    try {
      await createClassAssignment(classId, {
        title: assignmentForm.title,
        description: assignmentForm.description,
        dueDate: assignmentForm.dueDate || undefined,
        attachments
      })

      setAssignmentForm({ title: '', description: '', dueDate: '' })
      setAssignmentLinks([])
      setAssignmentLinkInput('')
      setAssignments(await getClassAssignments(classId))
      setShowComposer(false)
      setActiveTab('classwork')
    } catch (assignmentError) {
      setError(assignmentError.message || 'Failed to create assignment')
    } finally {
      setPostingAssignment(false)
    }
  }

  const handleDeleteNotice = async (noticeId) => {
    try {
      await deleteClassNotice(classId, noticeId)
      setNotices(await getClassroomNotices(classId))
    } catch (deleteError) {
      setError(deleteError.message || 'Failed to delete notice')
    }
  }

  const handleDeleteAssignment = async (assignmentId) => {
    try {
      await deleteClassAssignment(classId, assignmentId)
      const refreshedAssignments = await getClassAssignments(classId)
      setAssignments(refreshedAssignments)
      if (activeAssignmentId === assignmentId) {
        setActiveAssignmentId(null)
        setSubmissionsState({ loading: false, error: '', data: null })
      }
    } catch (deleteError) {
      setError(deleteError.message || 'Failed to delete assignment')
    }
  }

  const handleAddAssignmentLink = () => {
    const normalizedLink = assignmentLinkInput.trim()
    if (!normalizedLink) {
      return
    }

    setAssignmentLinks((current) => [...current, normalizedLink])
    setAssignmentLinkInput('')
  }

  const handleRemoveAssignmentLink = (index) => {
    setAssignmentLinks((current) => current.filter((_, idx) => idx !== index))
  }

  const handleDeleteClass = async () => {
    const shouldDelete = window.confirm('Delete this class and all assignments/notices?')
    if (!shouldDelete) {
      return
    }

    setDeletingClass(true)

    try {
      await deleteClassroom(classId)
      navigate('/teacher/dashboard')
    } catch (deleteError) {
      setError(deleteError.message || 'Failed to delete class')
    } finally {
      setDeletingClass(false)
    }
  }

  const openEditModal = () => {
    setShowClassMenu(false)
    setEditError('')
    setEditForm({
      name: classroom?.name || '',
      bio: classroom?.bio || '',
      image: classroom?.image || ''
    })
    setIsEditModalOpen(true)
  }

  const handleEditInput = (event) => {
    setEditForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }))
  }

  const handleUpdateClassroom = async (event) => {
    event.preventDefault()

    if (!editForm.name.trim()) {
      setEditError('Class name is required')
      return
    }

    setUpdatingClass(true)
    setEditError('')

    try {
      const updated = await updateClassroom(classId, {
        name: editForm.name,
        bio: editForm.bio,
        image: editForm.image
      })
      setClassroom(updated)
      setIsEditModalOpen(false)
      setInfo('Class details updated successfully.')
    } catch (updateError) {
      setEditError(updateError.message || 'Failed to update classroom')
    } finally {
      setUpdatingClass(false)
    }
  }

  const handleSelectAssignment = async (assignmentId) => {
    if (activeAssignmentId === assignmentId) {
      setActiveAssignmentId(null)
      setSubmissionsState({ loading: false, error: '', data: null })
      return
    }

    setActiveAssignmentId(assignmentId)
    setSubmissionsState({ loading: true, error: '', data: null })

    try {
      const response = await getAssignmentSubmissions(classId, assignmentId)
      setSubmissionsState({ loading: false, error: '', data: response })
    } catch (submissionError) {
      setSubmissionsState({ loading: false, error: submissionError.message || 'Failed to load submissions', data: null })
    }
  }

  const handleRemoveStudent = async (studentId) => {
    const shouldRemove = window.confirm('Remove this student from the class?')
    if (!shouldRemove) {
      return
    }

    try {
      const updatedStudents = await removeClassroomStudent(classId, studentId)
      setStudents(updatedStudents)
      setInfo('Student removed from class.')
    } catch (removeError) {
      setError(removeError.message || 'Failed to remove student')
    }
  }

  const handleShareClass = async () => {
    if (!classroom) {
      return
    }

    const joinUrl = `${window.location.origin}/student/dashboard?joinCode=${encodeURIComponent(classroom.joinCode)}`
    const shareText = `Join ${classroom.name} using class code: ${classroom.joinCode}`

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${classroom.name} Class Invite`,
          text: shareText,
          url: joinUrl
        })
      } else {
        await navigator.clipboard.writeText(`${shareText}\n${joinUrl}`)
      }
      setInfo('Class invite copied/shared successfully.')
      setShowCodeMenu(false)
    } catch (shareError) {
      setError(shareError.message || 'Failed to share class invite')
    }
  }

  const handleCopyClassCode = async () => {
    if (!classroom?.joinCode) return

    try {
      await navigator.clipboard.writeText(classroom.joinCode)
      setInfo('Class code copied.')
      setShowCodeMenu(false)
    } catch (copyError) {
      setError(copyError.message || 'Failed to copy class code')
    }
  }

  const handleOpenLiveMeeting = () => {
    const liveMeetingUrl = `${window.location.origin}/simulator?classId=${encodeURIComponent(classId)}&liveMeeting=1`
    window.open(liveMeetingUrl, '_blank', 'noopener,noreferrer')
  }

  if (loading) {
    return (
      <div className="teacher-dashboard-page">
        <ClassroomSidebar links={navLinks} user={user} onLogout={handleLogout} />
        <main className="teacher-dashboard-main teacher-dashboard-main--with-fixed-sidebar">
          <section className="teacher-class-page teacher-class-page--shell">
            <header className="teacher-class-hero teacher-class-hero--skeleton" aria-hidden="true">
              <div className="teacher-skeleton teacher-skeleton--hero" />
            </header>
            <nav className="teacher-class-tabs" aria-hidden="true">
              <div className="teacher-skeleton teacher-skeleton--tab" />
              <div className="teacher-skeleton teacher-skeleton--tab" />
              <div className="teacher-skeleton teacher-skeleton--tab" />
              <div className="teacher-skeleton teacher-skeleton--tab" />
            </nav>
            <div className="teacher-class-layout">
              <section className="teacher-class-main">
                <section className="teacher-list-block" aria-hidden="true">
                  <div className="teacher-skeleton teacher-skeleton--line" />
                  <div className="teacher-skeleton teacher-skeleton--activity" />
                  <div className="teacher-skeleton teacher-skeleton--activity" />
                </section>
              </section>
              <aside className="teacher-class-right" aria-hidden="true">
                <section className="teacher-detail-card">
                  <div className="teacher-skeleton teacher-skeleton--line" />
                  <div className="teacher-skeleton teacher-skeleton--line" />
                </section>
              </aside>
            </div>
          </section>
        </main>
      </div>
    )
  }

  if (!classroom) {
    return (
      <div className="teacher-class-page">
        <p className="teacher-inline-state teacher-inline-state--error">{error || 'Class not found'}</p>
      </div>
    )
  }

  return (
    <div className="teacher-dashboard-page">
      <ClassroomSidebar links={navLinks} user={user} onLogout={handleLogout} />

      <main className="teacher-dashboard-main teacher-dashboard-main--with-fixed-sidebar">
        <section className="teacher-class-page teacher-class-page--shell">
          <header className="teacher-class-hero" style={classroom.image ? { backgroundImage: `url(${classroom.image})` } : undefined}>
            <div className="teacher-class-hero__overlay" />
            <div className="teacher-class-hero__actions" ref={classMenuRef}>
              <button
                type="button"
                className="teacher-class-hero__menu"
                onClick={() => setShowClassMenu((currentState) => !currentState)}
                aria-label="Open class actions"
                aria-expanded={showClassMenu}
              >
                <MoreVertical size={16} />
              </button>

              {showClassMenu && (
                <div className="teacher-class-hero__menu-list">
                  <button type="button" onClick={openEditModal}>Edit class details</button>
                  <button type="button" onClick={handleDeleteClass} disabled={deletingClass}>
                    {deletingClass ? 'Deleting class...' : 'Delete class'}
                  </button>
                </div>
              )}
            </div>

            <div className="teacher-class-hero__content">
              <h1>{classroom.name}</h1>
              <p>{classroom.bio || 'Class detail and announcements'}</p>
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

          <div className={`teacher-class-layout${activeTab === 'stream' ? ' is-stream' : ''}`}>
            <section className="teacher-class-main">
              {error ? <p className="teacher-inline-state teacher-inline-state--error">{error}</p> : null}

              {activeTab === 'stream' && (
                <section className="teacher-list-block teacher-list-block--stream">
                  <form className="teacher-announce-box teacher-announce-box--stream teacher-announce-box--flat" onSubmit={handlePostNotice}>
                    <div className="teacher-announce-box__avatar">{avatarInitials}</div>
                    <input
                      type="text"
                      value={noticeInput}
                      onChange={(event) => setNoticeInput(event.target.value)}
                      placeholder="Announce something to your class..."
                    />
                    <button type="submit" disabled={postingNotice} aria-label="Post to class stream">
                      <ChevronRight size={16} />
                    </button>
                  </form>

                  <div className="teacher-notice-stream">
                    {streamItems.length === 0 ? (
                      <p className="teacher-inline-state">No posts or notices yet.</p>
                    ) : (
                      streamItems.map((item) => (
                        <StreamCard
                          key={`stream-${item.type}-${item.id}`}
                          item={item}
                          avatarInitials={avatarInitials}
                          teacherName={user?.name || 'Teacher'}
                          classId={classId}
                          showCommentInput={true}
                          enableComments={true}
                          onDeleteNotice={handleDeleteNotice}
                          onAssignmentClick={(id) => {
                            setActiveTab('classwork')
                            handleSelectAssignment(id)
                          }}
                        />
                      ))
                    )}
                  </div>
                </section>
              )}

              {activeTab === 'classwork' && (
                <section className="teacher-list-block teacher-list-block--classwork">
                  <div className="teacher-classwork-module">
                    <header className="teacher-classwork-module__header">
                      <div className="teacher-classwork-module__title">
                        <h3>Classwork</h3>
                        <small>{assignments.length} items</small>
                      </div>
                      <button type="button" className="teacher-classwork-module__menu" aria-label="Classwork menu">
                        <MoreVertical size={16} />
                      </button>
                    </header>

                    <div className="teacher-classwork-list teacher-assignment-list--clickable">
                    {assignments.length === 0 ? (
                      <p className="teacher-inline-state">No assignments yet.</p>
                    ) : (
                      assignments.map((assignment) => {
                        const stats = assignmentMetrics[assignment._id] || {
                          submittedCount: 0,
                          classStudentCount: students.length || 0
                        }

                        const status = assignmentStatus(assignment)
                        const attachments = pickAttachments(assignment)
                        const imageAttachments = attachments.filter((url) => isImageAttachment(url)).slice(0, 2)

                        return (
                          <article
                            key={assignment._id}
                            className={`teacher-classwork-item${activeAssignmentId === assignment._id ? ' is-active' : ''}`}
                          >
                            <div
                              className="teacher-classwork-item__row"
                              role="button"
                              tabIndex={0}
                              onClick={() => handleSelectAssignment(assignment._id)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault()
                                  handleSelectAssignment(assignment._id)
                                }
                              }}
                            >
                              <div className="teacher-classwork-item__icon" aria-hidden="true">
                                {assignment.dueDate ? <ClipboardList size={16} /> : <FileQuestion size={16} />}
                              </div>

                              <div className="teacher-classwork-item__copy">
                                <div className="teacher-classwork-item__top">
                                  <strong>{assignment.title}</strong>
                                  <span className={`teacher-classwork-item__badge teacher-classwork-item__badge--${status.key}`}>
                                    {status.label}
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
                                          onClick={(event) => event.stopPropagation()}
                                        >
                                          {getAttachmentLabel(url, idx)}
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                              </div>

                              <div className="teacher-classwork-item__meta">
                                <div className="teacher-classwork-item__meta-block">
                                  <strong>{stats.submittedCount}</strong>
                                  <small>handed in</small>
                                </div>
                              </div>

                              <div className="teacher-classwork-item__actions">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    handleDeleteAssignment(assignment._id)
                                  }}
                                  aria-label="Delete assignment"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            {activeAssignmentId === assignment._id && (
                              <div className="teacher-classwork-item__submissions">
                                <header className="teacher-assignment-submissions__header">
                                  <h4>Student solutions</h4>
                                  {submissionsState.data?.stats ? (
                                    <small>
                                      {submissionsState.data.stats.submittedCount}/{submissionsState.data.stats.classStudentCount} submitted
                                    </small>
                                  ) : null}
                                </header>

                                {submissionsState.loading ? <p className="teacher-inline-state">Loading submissions...</p> : null}
                                {submissionsState.error ? <p className="teacher-inline-state teacher-inline-state--error">{submissionsState.error}</p> : null}

                                {!submissionsState.loading && !submissionsState.error && submissionsState.data && (
                                  <div className="teacher-submission-list">
                                    {submissionsState.data.submissions.length === 0 ? (
                                      <p className="teacher-inline-state">No student solutions yet.</p>
                                    ) : (
                                      submissionsState.data.submissions.map((submission) => (
                                        <article key={submission._id} className="teacher-submission-item">
                                          <div className="teacher-submission-item__left">
                                            <div className="teacher-notice-card__avatar">
                                              {submission.studentId?.name
                                                ? submission.studentId.name
                                                    .split(' ')
                                                    .slice(0, 2)
                                                    .map((part) => part[0])
                                                    .join('')
                                                    .toUpperCase()
                                                : 'S'}
                                            </div>
                                            <div>
                                              <strong>{submission.studentId?.name || 'Student'}</strong>
                                              <small>{submission.studentId?.email || 'No email'}</small>
                                            </div>
                                          </div>
                                          <div className="teacher-submission-item__meta">
                                            <small>Updated {formatDateTime(submission.updatedAt)}</small>
                                            <small>Board: {submission.projectId?.board || 'N/A'}</small>
                                          </div>
                                        </article>
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </article>
                        )
                      })
                    )}
                  </div>
                  </div>
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
                          <strong>{classroom.teacher?.name || user?.name || 'Class teacher'}</strong>
                          <small>{classroom.teacher?.email || user?.email || 'Teacher account'}</small>
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
                      {students.length === 0 ? (
                        <p className="teacher-inline-state">No students in this class yet.</p>
                      ) : (
                        students
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

                              <div className="teacher-people-row__meta">
                                <button
                                  type="button"
                                  className="teacher-people-row__remove"
                                  onClick={() => handleRemoveStudent(student._id)}
                                  aria-label={`Remove ${student.name}`}
                                  title="Remove student"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </article>
                          ))
                      )}
                    </div>
                  </section>
                </section>
              )}

              {activeTab === 'marks' && (
                <section className="teacher-list-block">
                  <div className="teacher-list-block__heading">
                    <h3>Marks Overview</h3>
                    <small>Assignment status</small>
                  </div>

                  <div className="teacher-marks-grid">
                    <article className="teacher-marks-card">
                      <strong>{markStats.total}</strong>
                      <span>Total assignments</span>
                    </article>
                    <article className="teacher-marks-card">
                      <strong>{markStats.upcoming}</strong>
                      <span>Open assignments</span>
                    </article>
                    <article className="teacher-marks-card">
                      <strong>{markStats.closed}</strong>
                      <span>Closed assignments</span>
                    </article>
                    <article className="teacher-marks-card">
                      <strong>{markStats.noDueDate}</strong>
                      <span>No due date</span>
                    </article>
                  </div>
                </section>
              )}
            </section>

            <aside className="teacher-class-right">
              <section className="teacher-detail-card teacher-detail-card--live">
                <div className="teacher-detail-card__live-head">
                  <h3>Live Meeting</h3>
                  <Video size={16} />
                </div>
                <p>Start an instant live class with your students.</p>
                <button type="button" className="teacher-button teacher-button--primary" onClick={handleOpenLiveMeeting}>
                  Start Live Meeting
                </button>
              </section>

              <section className="teacher-detail-card teacher-detail-card--class-code" ref={codeMenuRef}>
                <div className="teacher-detail-card__live-head">
                  <h3>Class code</h3>
                  <button
                    type="button"
                    className="teacher-detail-card__icon-action"
                    onClick={() => setShowCodeMenu((currentState) => !currentState)}
                    aria-label="Open class code actions"
                    aria-expanded={showCodeMenu}
                  >
                    <MoreVertical size={14} />
                  </button>

                  {showCodeMenu && (
                    <div className="teacher-detail-card__menu">
                      <button type="button" onClick={handleCopyClassCode}>
                        <Copy size={14} />
                        <span>Copy code</span>
                      </button>
                      <button type="button" onClick={handleShareClass}>
                        <Share2 size={14} />
                        <span>Share link</span>
                      </button>
                    </div>
                  )}
                </div>
                <div className="teacher-detail-card__code-row">
                  <p className="teacher-detail-card__code">{classroom.joinCode}</p>
                  <button type="button" className="teacher-detail-card__icon-action" onClick={handleCopyClassCode} aria-label="Copy class code">
                    <Copy size={14} />
                  </button>
                </div>
              </section>
              <section className="teacher-detail-card">
                <h3>Upcoming assignments</h3>
                <div className="teacher-detail-list">
                  {assignments.filter((item) => item.dueDate).length === 0 ? (
                    <p className="teacher-inline-state">No upcoming assignments.</p>
                  ) : (
                    assignments
                      .filter((item) => item.dueDate)
                      .slice(0, 4)
                      .map((assignment) => (
                        <article key={assignment._id} className="teacher-detail-list__item">
                          <small>Due {formatDateTime(assignment.dueDate)}</small>
                          <strong>{assignment.title}</strong>
                        </article>
                      ))
                  )}
                </div>
              </section>
            </aside>
          </div>

          <div className="teacher-fab">
            <button
              type="button"
              className="teacher-fab__trigger"
              aria-label="Open class composer"
              onClick={() => {
                setComposerMode(activeTab === 'stream' ? 'notice' : 'assignment')
                setShowComposer(true)
              }}
            >
              <Plus size={20} />
            </button>
          </div>
        </section>
      </main>

      {info && (
        <div className="teacher-toast" role="status">
          {info}
        </div>
      )}

      {showComposer && (
        <div className="teacher-composer-modal" role="dialog" aria-modal="true" aria-label="Create class content">
          <div className="teacher-composer-modal__backdrop" onClick={() => setShowComposer(false)} />
          <section className="teacher-composer-modal__content">
            <div className="teacher-fab__switches">
              <button type="button" className={composerMode === 'assignment' ? 'is-active' : ''} onClick={() => setComposerMode('assignment')}>
                <FilePlus2 size={14} />
                <span>Assignment</span>
              </button>
              <button type="button" className={composerMode === 'notice' ? 'is-active' : ''} onClick={() => setComposerMode('notice')}>
                <BookOpenCheck size={14} />
                <span>Notice</span>
              </button>
            </div>

            {composerMode === 'assignment' ? (
              <form className="teacher-assignment-form" onSubmit={handleCreateAssignment}>
                <h3>Add Assignment</h3>
                <label className="teacher-assignment-form__field">
                  <span>Assignment Title</span>
                  <input
                    type="text"
                    name="title"
                    value={assignmentForm.title}
                    onChange={handleAssignmentInput}
                    placeholder="Problem Set 1: Limits"
                    required
                  />
                </label>
                <label className="teacher-assignment-form__field">
                  <span>Description</span>
                  <textarea
                    name="description"
                    value={assignmentForm.description}
                    onChange={handleAssignmentInput}
                    placeholder="What students need to complete"
                    rows={3}
                  />
                </label>
                <label className="teacher-assignment-form__field">
                  <span><CalendarDays size={14} /> Due Date</span>
                  <input
                    type="datetime-local"
                    name="dueDate"
                    value={assignmentForm.dueDate}
                    onChange={handleAssignmentInput}
                  />
                </label>
                <div className="teacher-assignment-form__files-label">
                  <span>Assignment Links</span>
                  <div className="teacher-assignment-form__link-input-row">
                    <input
                      type="url"
                      value={assignmentLinkInput}
                      onChange={(event) => setAssignmentLinkInput(event.target.value)}
                      placeholder="Paste URL here (e.g., https://...)"
                    />
                    <button
                      type="button"
                      className="teacher-assignment-form__link-add-icon"
                      onClick={handleAddAssignmentLink}
                      aria-label="Add attachment link"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {assignmentLinks.length > 0 ? (
                    <div className="teacher-assignment-form__link-list" role="list" aria-label="Added assignment links">
                      {assignmentLinks.map((link, idx) => (
                        <div key={`assignment-link-${idx}`} className="teacher-assignment-form__link-pill" role="listitem">
                          <span className="teacher-assignment-form__link-pill-copy">
                            <Link2 size={14} />
                            {getAttachmentLabel(link, idx)}
                          </span>
                          <button
                            type="button"
                            className="teacher-assignment-form__link-pill-remove"
                            onClick={() => handleRemoveAssignmentLink(idx)}
                            aria-label={`Remove link ${idx + 1}`}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button type="submit" disabled={postingAssignment}>
                  {postingAssignment ? 'Creating...' : 'Add Assignment'}
                </button>
              </form>
            ) : (
              <form className="teacher-assignment-form teacher-assignment-form--notice" onSubmit={handleCreateNoticeFromComposer}>
                <h3>Add Notice</h3>
                <label className="teacher-assignment-form__field">
                  <span>Notice Title</span>
                  <input
                    type="text"
                    name="title"
                    value={noticeForm.title}
                    onChange={handleNoticeComposerInput}
                    placeholder="Class Update"
                  />
                </label>
                <label className="teacher-assignment-form__field">
                  <span>Notice Message</span>
                  <textarea
                    name="message"
                    value={noticeForm.message}
                    onChange={handleNoticeComposerInput}
                    placeholder="Type your announcement for students"
                    rows={3}
                    required
                  />
                </label>
                <label className="teacher-assignment-form__files-label">
                  <span>Attachments (paste URLs, one per line)</span>
                  <textarea
                    value={noticeFiles}
                    onChange={(e) => setNoticeFiles(e.target.value)}
                    placeholder={'https://example.com/notes.pdf'}
                    rows={2}
                  />
                </label>
                <button type="submit" disabled={postingNotice}>{postingNotice ? 'Posting...' : 'Post Notice'}</button>
              </form>
            )}
          </section>
        </div>
      )}

      {isEditModalOpen && (
        <div className="teacher-modal" role="dialog" aria-modal="true" aria-label="Edit class details">
          <div className="teacher-modal__backdrop" onClick={() => setIsEditModalOpen(false)} />
          <section className="teacher-modal__content">
            <header className="teacher-modal__header">
              <h3>Edit Class Details</h3>
              <button type="button" onClick={() => setIsEditModalOpen(false)} aria-label="Close modal">x</button>
            </header>

            <form className="teacher-modal__form" onSubmit={handleUpdateClassroom}>
              <label>
                <span>Class Name</span>
                <input
                  type="text"
                  name="name"
                  value={editForm.name}
                  onChange={handleEditInput}
                  required
                />
              </label>

              <label>
                <span>Class Bio</span>
                <textarea
                  name="bio"
                  value={editForm.bio}
                  onChange={handleEditInput}
                  rows={3}
                  placeholder="Short class summary"
                />
              </label>

              <label>
                <span>Header Image URL</span>
                <input
                  type="url"
                  name="image"
                  value={editForm.image}
                  onChange={handleEditInput}
                  placeholder="https://..."
                />
              </label>

              {editError ? <p className="teacher-inline-state teacher-inline-state--error">{editError}</p> : null}

              <div className="teacher-modal__actions">
                <button type="button" className="teacher-button teacher-button--ghost" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="teacher-button teacher-button--primary" disabled={updatingClass}>
                  {updatingClass ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
