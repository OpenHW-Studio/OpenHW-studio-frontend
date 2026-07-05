import { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom'
import {
  BookOpen,
  ClipboardList,
  FileQuestion,
  Home,
  Monitor,
  Search,
  Cpu,
  Settings,
  Bell,
  FileText,
  HelpCircle,
  Users,
  Activity,
  Megaphone,
  MoreVertical
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  getClassAssignments,
  getMyAssignmentSubmission,
  getClassroomById,
  getClassroomNotices,
  getClassroomStudents,
  saveGradeForSubmission,
  submitAssignment,
  removeClassroomStudent,
  getMyClassrooms
} from '../../services/classroomService.js'
import { formatDateTime, getAvatarLetters } from '../../components/common/test.js'
import ClassroomAttachmentBlock from '../../components/common/ClassroomAttachmentBlock.jsx'
import ClassroomFilePreviewModal from '../../components/common/ClassroomFilePreviewModal.jsx'
import StreamCard from '../../components/common/StreamCard.jsx'
import { ClassDetailSkeleton } from '../../components/common/ClassroomSkeletons.jsx'
import { pickAttachments, pickLinks } from '../../components/teacher/class-detail/helpers.js'
import { uploadClassroomFiles } from '../../components/teacher/class-detail/uploadUtils.js'
import StudentAssignmentModal from '../../components/teacher/class-detail/StudentAssignmentModal.jsx'

const tabs = [
  { key: 'stream', label: 'Stream' },
  { key: 'classwork', label: 'Classwork' },
  { key: 'people', label: 'People' },
  { key: 'adventure', label: 'Adventure' }
]

const getSubmissionStatus = (assignment) => {
  if (!assignment?.dueDate) return 'nodue'
  return new Date(assignment.dueDate) < new Date() ? 'overdue' : 'upcoming'
}



const isAssignmentClosed = (assignment) => (
  Boolean(assignment?.dueDate) && new Date(assignment.dueDate) < new Date()
)

const getAssignmentTemplateShareId = (assignment) => {
  if (!assignment || !assignment.templateUrl) return ''
  if (assignment?.templateShareId) return assignment.templateShareId
  const templateUrl = assignment?.templateUrl || ''
  return templateUrl.match(/\/simulator\/share\/([^/?#]+)/)?.[1] || ''
}

export default function StudentClassDetailPage() {
  const { classId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const openAssignmentId = searchParams.get('openAssignment') || new URLSearchParams(window.location.search).get('openAssignment')
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
    links: [''],
    attachments: [],
    simulationShareId: ''
  })
  const [previewFile, setPreviewFile] = useState(null)
  const [liveMeetingCode, setLiveMeetingCode] = useState('')
  const [showClassMenu, setShowClassMenu] = useState(false)
  const [leavingClass, setLeavingClass] = useState(false)
  const classMenuRef = useRef(null)

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

  useEffect(() => {
    if (!showClassMenu) return undefined

    const onPointerDown = (event) => {
      if (!classMenuRef.current?.contains(event.target)) {
        setShowClassMenu(false)
      }
    }

    const onEsc = (event) => {
      if (event.key === 'Escape') {
        setShowClassMenu(false)
      }
    }

    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onEsc)

    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onEsc)
    }
  }, [showClassMenu])

  const handleLeaveClassroom = async () => {
    const shouldLeave = window.confirm(
      "Are you sure you want to leave this class? You will lose access to all assignments and notices."
    )
    if (!shouldLeave) return

    setLeavingClass(true)
    setError('')

    try {
      await removeClassroomStudent(classId, user?._id || user?.id)
      navigate('/student/dashboard')
    } catch (leaveError) {
      setError(leaveError.message || 'Failed to leave classroom')
    } finally {
      setLeavingClass(false)
    }
  }

  useEffect(() => {
    if (assignments.length > 0) {
      console.log('[Dashboard] Assignments Data Sync Check:', assignments.map(a => ({
        id: a._id,
        title: a.title,
        isAutogradingEnabled: a.isAutogradingEnabled,
        hasKey: !!a.autogradingKey,
        keyLength: a.autogradingKey?.length
      })));
    }
  }, [assignments]);

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

  // Handle auto-opening of assignment if requested via URL params
  useEffect(() => {
    if (openAssignmentId && assignments.length > 0) {
      handleOpenAssignmentFromStream(openAssignmentId)
    }
  }, [openAssignmentId, assignments])

  const handleSelectAssignment = async (assignmentId, options = {}) => {
    const { forceOpen = false } = options
    const assignment = assignments.find(a => a._id === assignmentId);
    console.log('[Dashboard] Selecting assignment:', assignmentId, 'Autograde:', assignment?.isAutogradingEnabled, 'Key:', !!assignment?.autogradingKey);

    if (!forceOpen && activeAssignmentId === assignmentId) {
      setActiveAssignmentId(null)
      setSubmissionState({ loading: false, saving: false, error: '', data: null })
      setSubmissionForm({ notes: '', links: [''], attachments: [], simulationShareId: '' })
      return
    }

    setActiveAssignmentId(assignmentId)
    setSubmissionState({ loading: true, saving: false, error: '', data: null })

    try {
      const response = await getMyAssignmentSubmission(classId, assignmentId)
      const submission = response?.submission || null
      
      // Check for simulator draft in session storage
      let draft = null;
      try {
        const draftJson = sessionStorage.getItem(`ohw_submission_draft_${assignmentId}`);
        if (draftJson) {
          draft = JSON.parse(draftJson);
          console.log('[Dashboard] Found draft in sessionStorage:', draft);
          // Only remove if we are successfully loading it
          sessionStorage.removeItem(`ohw_submission_draft_${assignmentId}`);
        }
      } catch (e) {
        console.warn('[Dashboard] Failed to parse submission draft', e);
      }

      setSubmissionState({ loading: false, saving: false, error: '', data: submission })
      const finalForm = {
        notes: draft?.notes || submission?.notes || '',
        links: draft?.links?.length ? draft.links : (submission?.links?.length ? submission.links : (submission?.simulationUrl ? [submission.simulationUrl] : [''])),
        attachments: draft?.attachments || submission?.attachments || submission?.files || [],
        simulationShareId: draft?.simulationShareId || submission?.simulationShareId || ''
      };
      
      console.log('[Dashboard] Setting submission form:', finalForm);
      setSubmissionForm(finalForm)
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

  const handleSubmissionLinkChange = (index, value) => {
    setSubmissionForm((current) => ({
      ...current,
      links: (current.links || []).map((link, idx) => (idx === index ? value : link))
    }))
  }

  const handleAddSubmissionLink = () => {
    setSubmissionForm((current) => ({
      ...current,
      links: [...(current.links || []), '']
    }))
  }

  const handleRemoveSubmissionLink = (index) => {
    setSubmissionForm((current) => {
      const nextLinks = (current.links || []).filter((_, idx) => idx !== index)
      return {
        ...current,
        links: nextLinks.length > 0 ? nextLinks : ['']
      }
    })
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

    // Final check for the PNG preview URL from local cache
    let finalAttachments = [...(submissionForm.attachments || [])];
    try {
      const cachedPng = sessionStorage.getItem(`ohw_preview_${assignmentId}`);
      if (cachedPng && cachedPng.startsWith('http') && !finalAttachments.includes(cachedPng)) {
        console.log('[Dashboard] Auto-attaching cached PNG URL to submission:', cachedPng);
        finalAttachments.push(cachedPng);
      }
    } catch (e) {
      console.warn('[Dashboard] Error checking cached PNG:', e);
    }

    console.log('[Dashboard] Submitting assignment:', assignmentId, 'Payload:', {
      notes: submissionForm.notes,
      attachments: finalAttachments,
      links: (submissionForm.links || []).filter(l => l && l.trim()),
      simulationShareId: submissionForm.simulationShareId
    });

    try {
      const response = await submitAssignment(classId, assignmentId, {
        notes: submissionForm.notes,
        attachments: finalAttachments,
        links: (submissionForm.links || []).filter(l => l && l.trim()),
        simulationShareId: submissionForm.simulationShareId
      })
      console.log('[Dashboard] Submission successful. Response:', response);

      const submission = response?.submission || null
      setSubmissionState({
        loading: false,
        saving: false,
        error: '',
        data: submission
      })
      setSubmissionForm({
        notes: submission?.notes || '',
        links: submission?.links?.length ? submission.links : [''],
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

  const handleSaveGrade = async (gradingResult) => {
    if (!activeAssignmentId) return;
    try {
      const score = typeof gradingResult?.score === 'number' ? gradingResult.score : 0;
      const feedback = gradingResult?.feedback?.join ? gradingResult.feedback.join('\n') : '';
      await saveGradeForSubmission(classId, activeAssignmentId, {
        score: Math.round(score),
        feedback,
        gradingReport: gradingResult,
      });
      console.log('[Dashboard] Grade saved successfully for', activeAssignmentId);
    } catch (err) {
      console.error('[Dashboard] Failed to save grade:', err);
    }
  };

  const handleOpenTemplate = (assignment) => {
    const templateShareId = getAssignmentTemplateShareId(assignment)
    console.log(templateShareId)
    if (!templateShareId) {
      setError('This assignment does not have a simulator template yet.')
      return
    }

    navigate(`/simulator/share/${encodeURIComponent(templateShareId)}/assignment/${encodeURIComponent(classId)}/${encodeURIComponent(assignment._id)}`)
  }

  const handleJoinLiveSimulation = () => {
    const normalizedCode = String(liveMeetingCode || '').trim().toUpperCase()
    if (!normalizedCode) {
      setError('Enter the live simulation code shared by your teacher.')
      return
    }

    setError('')
    navigate(`/simulator/live/${encodeURIComponent(normalizedCode)}?role=student`)
  }

  if (loading) {
    return <ClassDetailSkeleton />
  }

  if (!classroom) {
    return (
      <div className="student-db-layout" style={{ justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p className="teacher-inline-state teacher-inline-state--error">{error || 'Class not found'}</p>
      </div>
    )
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
                onClick={() => setActiveTab("stream")}
                className={`student-db-sidebar__link ${activeTab === "stream" ? "is-active" : ""}`}
              >
                <Megaphone className="w-4 h-4" />
                Class Stream
              </button>

              <button
                onClick={() => setActiveTab("classwork")}
                className={`student-db-sidebar__link ${activeTab === "classwork" ? "is-active" : ""}`}
              >
                <ClipboardList className="w-4 h-4" />
                Classwork
              </button>

              <button
                onClick={() => setActiveTab("people")}
                className={`student-db-sidebar__link ${activeTab === "people" ? "is-active" : ""}`}
              >
                <Users className="w-4 h-4" />
                People
              </button>

              <button
                onClick={() => setActiveTab("adventure")}
                className={`student-db-sidebar__link ${activeTab === "adventure" ? "is-active" : ""}`}
              >
                <Activity className="w-4 h-4" />
                Adventure Map
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
          <section className="student-db-rosters">
            {/* Hero Banner */}
            <header
              className="teacher-class-hero"
              style={classroom.image ? { backgroundImage: `url(${classroom.image})` } : undefined}
            >
              <div className="teacher-class-hero__overlay" />

              {/* Class actions menu for Student to leave class */}
              <div className="teacher-class-hero__actions" ref={classMenuRef}>
                <button
                  type="button"
                  className="teacher-class-hero__menu"
                  onClick={() => setShowClassMenu(!showClassMenu)}
                  aria-label="Open class actions"
                  aria-expanded={showClassMenu}
                >
                  <MoreVertical size={16} />
                </button>

                {showClassMenu && (
                  <div className="teacher-class-hero__menu-list">
                    <button
                      type="button"
                      onClick={handleLeaveClassroom}
                      disabled={leavingClass}
                    >
                      {leavingClass ? "Leaving..." : "Leave class"}
                    </button>
                  </div>
                )}
              </div>

              <div className="teacher-class-hero__content">
                <h1>{classroom.name}</h1>
                <p>{classroom.bio || 'Class stream and assignments'}</p>
              </div>
            </header>

            {/* Live Join Section */}
            <section className="student-live-join">
              <div>
                <strong>Join live simulation</strong>
                <p>Enter the code from your teacher to open the shared simulator and watch changes in real time.</p>
              </div>
              <div className="student-live-join__actions">
                <input
                  type="text"
                  value={liveMeetingCode}
                  onChange={(event) => setLiveMeetingCode(event.target.value.toUpperCase())}
                  placeholder="Enter code"
                  maxLength={12}
                />
                <button type="button" onClick={handleJoinLiveSimulation}>
                  Join
                </button>
              </div>
            </section>

            {/* Split layout: main column and class info sidebar */}
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
                            const links = pickLinks(assignment)
                            const statusKey = getSubmissionStatus(assignment)
                            const isClosed = isAssignmentClosed(assignment)
                            const templateShareId = getAssignmentTemplateShareId(assignment)
                            const resourceCount = attachments.length + links.length

                            return (
                              <article
                                key={assignment._id}
                                className={`teacher-classwork-card teacher-classwork-card--student${activeAssignmentId === assignment._id ? ' is-active' : ''}`}
                              >
                                <div
                                  className="teacher-classwork-card__row"
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => handleSelectAssignment(assignment._id, { forceOpen: true })}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault()
                                      handleSelectAssignment(assignment._id, { forceOpen: true })
                                    }
                                  }}
                                >
                                  <div className={`teacher-classwork-card__icon${assignment.dueDate ? ' teacher-classwork-card__icon--due' : ''}`} aria-hidden="true">
                                    {assignment.dueDate ? <ClipboardList size={22} /> : <FileQuestion size={22} />}
                                  </div>

                                  <div className="teacher-classwork-card__copy">
                                    <div className="teacher-classwork-card__title-row">
                                      <strong className="teacher-classwork-card__title">{assignment.title}</strong>
                                      <div className="teacher-classwork-card__badges">
                                        {(assignment.isAutogradingEnabled || assignment.autogradingKey) && (
                                          <span className="teacher-classwork-card__badge teacher-classwork-card__badge--autograde">Autograde</span>
                                        )}
                                        <span className={`teacher-classwork-card__badge teacher-classwork-card__badge--${statusKey === 'upcoming' ? 'open' : statusKey === 'overdue' ? 'closed' : 'neutral'}`}>
                                          {statusKey === 'overdue' ? 'Overdue' : statusKey === 'upcoming' ? 'Due Soon' : 'No Due Date'}
                                        </span>
                                      </div>
                                    </div>

                                    <p className="teacher-classwork-card__meta">
                                      {assignment.dueDate ? `Due ${formatDateTime(assignment.dueDate)}` : `Posted ${formatDateTime(assignment.createdAt)}`}
                                    </p>

                                    {templateShareId ? (
                                      <button
                                        type="button"
                                        className="teacher-assignment-modal__resource-pill"
                                        style={{ border: 0, borderRadius: 8, cursor: 'pointer' }}
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          handleOpenTemplate(assignment)
                                        }}
                                      >
                                        Open Template
                                      </button>
                                    ) : null}

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
                                      <strong style={{ fontSize: '1.1rem', whiteSpace: 'nowrap', lineHeight: '1.6' }}>
                                        {isClosed ? 'Closed' : 'Open'}
                                      </strong>
                                      <small>Window</small>
                                    </div>
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

                {activeTab === 'adventure' && (
                  <section className="teacher-list-block">
                    <div className="teacher-list-block__heading">
                      <h3>Class Adventure</h3>
                      <small>Open the class-specific learning path</small>
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                      <button
                        type="button"
                        onClick={() => navigate(`/adventure?classId=${encodeURIComponent(classId)}&journey=arduino`)}
                        className="teacher-assignment-modal__resource-pill"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                      >
                        🔵 Arduino Uno Map
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/adventure?classId=${encodeURIComponent(classId)}&journey=esp32`)}
                        className="teacher-assignment-modal__resource-pill"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, borderColor: '#e74c3c', color: '#e74c3c' }}
                      >
                        📡 ESP32 Map
                      </button>
                    </div>
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
      {previewFile ? <ClassroomFilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} /> : null}
      {activeAssignmentId ? (
        <StudentAssignmentModal
          assignment={assignments.find((assignment) => assignment._id === activeAssignmentId) || null}
          submissionState={submissionState}
          submissionForm={submissionForm}
          onClose={() => {
            setActiveAssignmentId(null)
            setSubmissionState({ loading: false, saving: false, error: '', data: null })
            setSubmissionForm({ notes: '', links: [''], attachments: [], simulationShareId: '' })
          }}
          onNotesChange={(value) =>
            setSubmissionForm((current) => ({
              ...current,
              notes: value
            }))
          }
          onLinkChange={handleSubmissionLinkChange}
          onAddLink={handleAddSubmissionLink}
          onRemoveLink={handleRemoveSubmissionLink}
          onFilesChange={handleSubmissionFilesChange}
          onRemoveFile={handleRemoveSubmissionFile}
          onSubmit={() => handleSubmitAssignment(activeAssignmentId)}
          onPreviewFile={setPreviewFile}
          onSaveGrade={handleSaveGrade}
          isClosed={isAssignmentClosed(assignments.find((assignment) => assignment._id === activeAssignmentId))}
        />
      ) : null}
    </div>
  )
}

