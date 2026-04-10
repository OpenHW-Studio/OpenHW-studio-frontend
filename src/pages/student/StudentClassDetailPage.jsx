import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BookOpen, ClipboardList, FileQuestion, Home, Loader2, Monitor, Search, Upload, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  getClassAssignments,
  getMyAssignmentSubmission,
  getClassroomById,
  getClassroomNotices,
  getClassroomStudents,
  submitAssignment
} from '../../services/classroomService.js'
import { formatDateTime, getAvatarLetters } from '../../components/common/test.js'
import ClassroomSidebar from '../../components/common/ClassroomSidebar.jsx'
import ClassroomAttachmentBlock from '../../components/common/ClassroomAttachmentBlock.jsx'
import ClassroomFilePreviewModal from '../../components/common/ClassroomFilePreviewModal.jsx'
import StreamCard from '../../components/common/StreamCard.jsx'
import { ClassDetailSkeleton } from '../../components/common/ClassroomSkeletons.jsx'
import { getAttachmentLabel, pickAttachments } from '../../components/teacher/class-detail/helpers.js'
import { uploadClassroomFiles } from '../../components/teacher/class-detail/uploadUtils.js'

const tabs = [
  { key: 'stream', label: 'Stream' },
  { key: 'classwork', label: 'Classwork' },
  { key: 'people', label: 'People' }
]

const getSubmissionStatus = (assignment) => {
  if (!assignment?.dueDate) return 'nodue'
  return new Date(assignment.dueDate) < new Date() ? 'overdue' : 'upcoming'
}

const isAssignmentClosed = (assignment) => (
  Boolean(assignment?.dueDate) && new Date(assignment.dueDate) < new Date()
)

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
  const [activeAssignmentId, setActiveAssignmentId] = useState(null)
  const [submissionState, setSubmissionState] = useState({
    loading: false,
    saving: false,
    error: '',
    data: null
  })
  const [submissionForm, setSubmissionForm] = useState({
    notes: '',
    attachments: []
  })
  const [previewFile, setPreviewFile] = useState(null)

  const avatarInitials = useMemo(() => getAvatarLetters(user?.name, 'S'), [user?.name])

  const streamItems = useMemo(() => {
    const noticeItems = (notices || []).map((notice) => ({
      id: notice._id,
      type: 'notice',
      title: notice.title || 'Class notice',
      body: notice.message,
      createdAt: notice.createdAt,
      createdBy: notice.createdBy,
      raw: notice
    }))

    const assignmentItems = (assignments || []).map((assignment) => ({
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

  const handleSelectAssignment = async (assignmentId, options = {}) => {
    const { forceOpen = false } = options

    if (!forceOpen && activeAssignmentId === assignmentId) {
      setActiveAssignmentId(null)
      setSubmissionState({ loading: false, saving: false, error: '', data: null })
      setSubmissionForm({ notes: '', attachments: [] })
      return
    }

    setActiveAssignmentId(assignmentId)
    setSubmissionState({ loading: true, saving: false, error: '', data: null })

    try {
      const response = await getMyAssignmentSubmission(classId, assignmentId)
      const submission = response?.submission || null
      setSubmissionState({ loading: false, saving: false, error: '', data: submission })
      setSubmissionForm({
        notes: submission?.notes || '',
        attachments: submission?.attachments || submission?.files || []
      })
    } catch (submissionError) {
      setSubmissionState({
        loading: false,
        saving: false,
        error: submissionError.message || 'Failed to load submission',
        data: null
      })
    }
  }

  const handleOpenAssignmentFromStream = async (assignmentId) => {
    setActiveTab('classwork')
    await handleSelectAssignment(assignmentId, { forceOpen: true })
  }

  const handleSubmissionFilesChange = async (event) => {
    const currentAssignment = assignments.find((assignment) => assignment._id === activeAssignmentId)

    if (isAssignmentClosed(currentAssignment)) {
      setSubmissionState((current) => ({
        ...current,
        error: 'This assignment is closed. You can no longer upload files.'
      }))
      event.target.value = ''
      return
    }

    try {
      const uploadedFiles = await uploadClassroomFiles(event.target.files, {
        classId,
        category: 'submissions',
        maxFiles: 8,
        allowedTypes: ['application/pdf', 'image']
      })

      setSubmissionForm((current) => ({
        ...current,
        attachments: [...current.attachments, ...uploadedFiles]
      }))
      setSubmissionState((current) => ({ ...current, error: '' }))
    } catch (uploadError) {
      setSubmissionState((current) => ({
        ...current,
        error: uploadError.message || 'Failed to upload submission files'
      }))
    } finally {
      event.target.value = ''
    }
  }

  const handleRemoveSubmissionFile = (index) => {
    setSubmissionForm((current) => ({
      ...current,
      attachments: current.attachments.filter((_, idx) => idx !== index)
    }))
  }

  const handleSubmitAssignment = async (assignmentId) => {
    const currentAssignment = assignments.find((assignment) => assignment._id === assignmentId)

    if (isAssignmentClosed(currentAssignment)) {
      setSubmissionState((current) => ({
        ...current,
        saving: false,
        error: 'This assignment is closed. Submissions are no longer accepted.'
      }))
      return
    }

    setSubmissionState((current) => ({ ...current, saving: true, error: '' }))

    try {
      const response = await submitAssignment(classId, assignmentId, {
        notes: submissionForm.notes,
        attachments: submissionForm.attachments
      })

      const submission = response?.submission || null
      setSubmissionState({
        loading: false,
        saving: false,
        error: '',
        data: submission
      })
      setSubmissionForm({
        notes: submission?.notes || '',
        attachments: submission?.attachments || submission?.files || []
      })
    } catch (submitError) {
      setSubmissionState((current) => ({
        ...current,
        saving: false,
        error: submitError.message || 'Failed to submit assignment'
      }))
    }
  }

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
      <ClassroomSidebar
        links={sidebarLinks}
        user={user}
        onLogout={handleLogout}
        onProfileClick={() => navigate('/student/profile')}
      />

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
                          onAssignmentClick={handleOpenAssignmentFromStream}
                          onPreviewFile={setPreviewFile}
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
                    <div className="teacher-classwork-shell teacher-classwork-shell--student">
                      <header className="teacher-classwork-shell__header">
                        <div className="teacher-classwork-shell__title">
                          <p>Classwork</p>
                        </div>

                        <div className="teacher-classwork-shell__stats">
                          <div className="teacher-classwork-shell__stat">
                            <ClipboardList size={16} />
                            <span>{assignments.length} items</span>
                          </div>
                        </div>
                      </header>

                      <div className="teacher-classwork-shell__list">
                        {assignments.map((assignment) => {
                          const attachments = pickAttachments(assignment)
                          const isExpanded = activeAssignmentId === assignment._id
                          const submission = isExpanded ? submissionState.data : null
                          const statusKey = getSubmissionStatus(assignment)
                          const isClosed = isAssignmentClosed(assignment)
                          const resourceCount = attachments.length

                          return (
                            <article
                              key={assignment._id}
                              className={`teacher-classwork-card teacher-classwork-card--student${isExpanded ? ' is-active' : ''}`}
                            >
                              <div
                                className="teacher-classwork-card__row"
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
                                <div className={`teacher-classwork-card__icon${assignment.dueDate ? ' teacher-classwork-card__icon--due' : ''}`} aria-hidden="true">
                                  {assignment.dueDate ? <ClipboardList size={22} /> : <FileQuestion size={22} />}
                                </div>

                                <div className="teacher-classwork-card__copy">
                                  <div className="teacher-classwork-card__title-row">
                                    <strong className="teacher-classwork-card__title">{assignment.title}</strong>
                                    <span className={`teacher-classwork-card__badge teacher-classwork-card__badge--${statusKey === 'upcoming' ? 'open' : statusKey === 'overdue' ? 'closed' : 'neutral'}`}>
                                      {statusKey === 'overdue' ? 'Overdue' : statusKey === 'upcoming' ? 'Due Soon' : 'No Due Date'}
                                    </span>
                                  </div>

                                  <p className="teacher-classwork-card__meta">
                                    {assignment.dueDate ? `Due ${formatDateTime(assignment.dueDate)}` : `Posted ${formatDateTime(assignment.createdAt)}`}
                                  </p>

                                  {attachments.length > 0 ? (
                                    <div
                                      className="teacher-classwork-card__files"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <ClassroomAttachmentBlock
                                        source={assignment}
                                        onPreviewFile={setPreviewFile}
                                      />
                                    </div>
                                  ) : null}
                                </div>

                                <div className="teacher-classwork-card__metrics">
                                  <div className="teacher-classwork-card__metric">
                                    <strong>{resourceCount}</strong>
                                    <small>Resources</small>
                                  </div>
                                  <div className="teacher-classwork-card__metric">
                                    <strong>{isClosed ? 'Closed' : 'Open'}</strong>
                                    <small>Window</small>
                                  </div>
                                </div>
                              </div>

                              {isExpanded ? (
                                <div className="teacher-classwork-card__submissions student-assignment-submit">
                                  {submission?.updatedAt ? (
                                    <div className="student-assignment-submit__meta">
                                      <span className="student-assignment-submit__status">Updated {formatDateTime(submission.updatedAt)}</span>
                                    </div>
                                  ) : null}

                                  {isClosed ? (
                                    <p className="teacher-inline-state teacher-inline-state--error">
                                      This assignment is closed. Submissions are no longer accepted.
                                    </p>
                                  ) : null}

                                  {submissionState.loading ? (
                                    <p className="teacher-inline-state">Loading submission...</p>
                                  ) : null}
                                  {submissionState.error ? (
                                    <p className="teacher-inline-state teacher-inline-state--error">{submissionState.error}</p>
                                  ) : null}

                                  {!submissionState.loading ? (
                                    <>
                                      <label className="teacher-assignment-form__field">
                                        <span>Submission Notes</span>
                                        <textarea
                                          value={submissionForm.notes}
                                          onChange={(event) =>
                                            setSubmissionForm((current) => ({
                                              ...current,
                                              notes: event.target.value
                                            }))
                                          }
                                          rows={3}
                                          placeholder="Add a short note for your teacher"
                                        />
                                      </label>

                                      <div className="teacher-assignment-form__files-label">
                                        <div className="teacher-assignment-form__files-copy">
                                          <span>Submission Files</span>
                                          <small>Upload PDFs or images for your assignment work.</small>
                                        </div>

                                        <label className="teacher-upload-dropzone student-assignment-submit__dropzone">
                                          <input
                                            type="file"
                                            accept="application/pdf,image/*"
                                            multiple
                                            onChange={handleSubmissionFilesChange}
                                            disabled={isClosed}
                                          />
                                          <span className="teacher-upload-dropzone__empty">
                                            <Upload size={18} />
                                            {isClosed ? 'Submission closed' : 'Upload files'}
                                          </span>
                                        </label>

                                        {submissionForm.attachments.length > 0 ? (
                                          <div className="teacher-assignment-form__link-list">
                                            {submissionForm.attachments.map((file, idx) => (
                                              <div key={`submission-file-${idx}`} className="teacher-assignment-form__link-pill">
                                                <button
                                                  type="button"
                                                  className="teacher-assignment-form__link-pill-copy student-assignment-submit__file"
                                                  onClick={() =>
                                                    setPreviewFile({
                                                      url: file,
                                                      name: getAttachmentLabel(file, idx)
                                                    })
                                                  }
                                                >
                                                  <span>{getAttachmentLabel(file, idx)}</span>
                                                </button>
                                                <button
                                                  type="button"
                                                  className="teacher-assignment-form__link-pill-remove"
                                                  onClick={() => handleRemoveSubmissionFile(idx)}
                                                  aria-label={`Remove file ${idx + 1}`}
                                                >
                                                  <X size={14} />
                                                </button>
                                              </div>
                                            ))}
                                          </div>
                                        ) : null}
                                      </div>

                                      <div className="student-assignment-submit__actions">
                                        <button
                                          type="button"
                                          className="teacher-button teacher-button--primary"
                                          onClick={() => handleSubmitAssignment(assignment._id)}
                                          disabled={submissionState.saving || isClosed}
                                        >
                                          {submissionState.saving ? (
                                            <>
                                              <Loader2 size={16} className="teacher-spin" />
                                              <span>Saving...</span>
                                            </>
                                          ) : (
                                            <span>{isClosed ? 'Submission Closed' : submission ? 'Update Submission' : 'Submit Assignment'}</span>
                                          )}
                                        </button>
                                      </div>
                                    </>
                                  ) : null}
                                </div>
                              ) : null}
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
      {previewFile ? <ClassroomFilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} /> : null}
    </div>
  )
}

