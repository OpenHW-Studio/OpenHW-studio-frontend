import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Building2, CalendarDays, GraduationCap, Home, Loader2, Mail, MapPin, Monitor, PenSquare, UserCircle2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ClassroomSidebar from '../../components/common/ClassroomSidebar.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { getAvatarLetters } from '../../components/common/test.js'
import { updateProfile } from '../../services/authService.js'
import { uploadClassroomFiles } from '../../components/teacher/class-detail/uploadUtils.js'
import { getMyClassrooms } from '../../services/classroomService.js'

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
  const [uploadingImage, setUploadingImage] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [recentClasses, setRecentClasses] = useState([])

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

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  useEffect(() => {
    const loadClasses = async () => {
      try {
        const classrooms = await getMyClassrooms()
        setRecentClasses(classrooms.slice(0, 4))
      } catch {
        setRecentClasses([])
      }
    }

    loadClasses()
  }, [])

  const openEditModal = () => {
    setForm(buildFormState(user))
    setError('')
    setIsEditOpen(true)
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({
      ...current,
      [name]: value
    }))
  }

  const handleImageUpload = async (event) => {
    try {
      setUploadingImage(true)
      const [image] = await uploadClassroomFiles(event.target.files, {
        classId: user?.id || user?._id || 'student',
        category: 'profiles',
        maxFiles: 1,
        allowedTypes: ['image']
      })

      if (image) {
        setForm((current) => ({
          ...current,
          image
        }))
      }
      setError('')
    } catch (uploadError) {
      setError(uploadError.message || 'Failed to upload profile image')
    } finally {
      setUploadingImage(false)
      event.target.value = ''
    }
  }

  const handleRemoveImage = () => {
    setForm((current) => ({
      ...current,
      image: ''
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
    <div className="teacher-dashboard-page">
      <ClassroomSidebar
        links={sidebarLinks}
        user={user}
        onLogout={handleLogout}
        onProfileClick={() => navigate('/student/profile')}
      />

      <main className="teacher-dashboard-main teacher-dashboard-main--with-fixed-sidebar">
        <section className="student-profile-shell">
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
              <div className="student-profile-upload">
                <div className="student-profile-upload__copy">
                  <strong>Profile Image</strong>
                  <small>Upload a clear professional image for your institutional records. Supported: JPG, PNG (Max 2MB).</small>
                </div>
                <label className="teacher-upload-dropzone teacher-upload-dropzone--image student-profile-upload__dropzone">
                  <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} />
                  {form.image ? (
                    <span className="student-profile-upload__filled">
                      <img src={form.image} alt={form.name || 'Student'} className="student-profile-upload__image student-profile-upload__image--large" />
                      <span className="student-profile-upload__overlay">
                        {uploadingImage ? (
                          <>
                            <Loader2 size={18} className="teacher-spin" />
                            Uploading...
                          </>
                        ) : (
                          'Change Image'
                        )}
                      </span>
                    </span>
                  ) : (
                    <span className="teacher-upload-dropzone__empty">
                      {uploadingImage ? <Loader2 size={18} className="teacher-spin" /> : null}
                      {uploadingImage ? 'Uploading...' : 'Upload New Image'}
                    </span>
                  )}
                </label>
                {form.image ? (
                  <button
                    type="button"
                    className="student-profile-upload__remove"
                    onClick={handleRemoveImage}
                    aria-label="Remove profile image"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>

              <div className="student-profile-form__grid">
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

                <label className="student-profile-field student-profile-field--full">
                  <span>Academic Biography</span>
                  <textarea name="bio" rows="5" value={form.bio} onChange={handleChange} placeholder="Tell your teacher and classmates about yourself" />
                </label>
              </div>

              {error ? <p className="teacher-inline-state teacher-inline-state--error">{error}</p> : null}

              <div className="teacher-modal__actions">
                <button type="button" className="teacher-button teacher-button--ghost" onClick={() => setIsEditOpen(false)}>
                  Discard Changes
                </button>
                <button type="submit" className="teacher-button teacher-button--primary" disabled={saving || uploadingImage}>
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
    </div>
  )
}
