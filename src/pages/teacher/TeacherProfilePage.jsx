import { useEffect, useMemo, useState } from 'react'
import { BookOpenCheck, Building2, CalendarDays, GraduationCap, Home, Loader2, Mail, MapPin, Monitor, PenSquare, Settings, UserCircle2, X } from 'lucide-react'
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

export default function TeacherProfilePage() {
  const navigate = useNavigate()
  const { user, logout, updateUserSession } = useAuth()
  const [form, setForm] = useState(() => buildFormState(user))
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [recentClasses, setRecentClasses] = useState([])
  const [loadingRecentClasses, setLoadingRecentClasses] = useState(true)

  const avatarInitials = useMemo(() => getAvatarLetters(user?.name, 'T'), [user?.name])
  const totalStudents = useMemo(
    () => recentClasses.reduce((sum, classroom) => sum + (classroom.students?.length || 0), 0),
    [recentClasses]
  )
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
      classes: recentClasses.length,
      students: totalStudents
    }
  }, [recentClasses.length, totalStudents, user?.bio, user?.branch, user?.college, user?.image, user?.semester])

  const sidebarLinks = [
    { key: 'home', label: 'Home', icon: Home, isActive: false, onClick: () => navigate('/teacher/dashboard') },
    { key: 'simulator', label: 'Open Simulator', icon: Monitor, isActive: false, onClick: () => navigate('/simulator') },
    { key: 'settings', label: 'Settings', icon: Settings, isActive: false, onClick: () => navigate('/teacher/dashboard') }
  ]

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  useEffect(() => {
    const loadClasses = async () => {
      try {
        setLoadingRecentClasses(true)
        const classrooms = await getMyClassrooms()
        setRecentClasses(classrooms.slice(0, 4))
      } catch {
        setRecentClasses([])
      } finally {
        setLoadingRecentClasses(false)
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
        classId: user?.id || user?._id || 'teacher',
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
        onProfileClick={() => navigate('/teacher/profile')}
      />

      <main className="teacher-dashboard-main teacher-dashboard-main--with-fixed-sidebar">
        <section className="student-profile-shell">
          <section className="student-profile-hero">
            <div className="student-profile-hero__media">
              {user?.image ? (
                <img src={user.image} alt={user?.name || 'Teacher'} className="student-profile-hero__image" />
              ) : (
                <div className="student-profile-hero__avatar">{avatarInitials}</div>
              )}
            </div>
            <div className="student-profile-hero__copy">
              <p className="student-profile-hero__eyebrow">Faculty Associate</p>
              <h1>{user?.name || 'Teacher'}</h1>
              <div className="student-profile-hero__meta">
                <span>
                  <Mail size={14} />
                  {user?.email || 'teacher account'}
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
                  Identity & Faculty Registration
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
                  <strong className="student-profile-data__status">Active Faculty</strong>
                </article>
                <article className="student-profile-data">
                  <small>Current Semester Focus</small>
                  <strong>{user?.semester || 'Not added'}</strong>
                </article>
              </div>
            </article>

            <article className="student-profile-panel student-profile-panel--bio">
              <header className="student-profile-panel__header">
                <h3>
                  <BookOpenCheck size={16} />
                  Biography
                </h3>
              </header>

              <p className="student-profile-panel__bio">
                {user?.bio || 'Add a short teaching biography, focus areas, and classroom context for your students.'}
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
                  <span>Total Students</span>
                  <strong>{profileMetrics.students}</strong>
                </div>
                <div className="student-profile-metrics__bar">
                  <span style={{ width: `${Math.min(profileMetrics.students * 8, 100)}%` }} />
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
                    <small>Institution</small>
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
                  <small>Semester Coverage</small>
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
                <p>Your latest active classrooms and teaching spaces.</p>
              </div>
              <button type="button" className="teacher-section-link" onClick={() => navigate('/teacher/dashboard')}>
                View All
              </button>
            </header>

            <div className="student-profile-classes">
              {loadingRecentClasses ? (
                <>
                  <article className="student-profile-class student-profile-class--loading">
                    <strong>Loading classes...</strong>
                    <small>Fetching your latest teaching spaces.</small>
                  </article>
                  <article className="student-profile-class student-profile-class--loading">
                    <strong>Loading classes...</strong>
                    <small>Fetching your latest teaching spaces.</small>
                  </article>
                </>
              ) : recentClasses.length === 0 ? (
                <article className="student-profile-class student-profile-class--empty">
                  <strong>No classes yet</strong>
                  <small>Create a classroom to see it listed here.</small>
                </article>
              ) : (
                recentClasses.map((classroom) => (
                  <article
                    key={classroom._id}
                    className="student-profile-class"
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/teacher/classes/${classroom._id}`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        navigate(`/teacher/classes/${classroom._id}`)
                      }
                    }}
                  >
                    <small>{classroom.students?.length || 0} students</small>
                    <strong>{classroom.name}</strong>
                    <span>{classroom.assignments?.length || 0} assignments</span>
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
                <p>Update your faculty profile details.</p>
              </div>
              <button type="button" onClick={() => setIsEditOpen(false)} aria-label="Close profile editor">
                <X size={18} />
              </button>
            </header>

            <form className="student-profile-form" onSubmit={handleSubmit}>
              <div className="student-profile-upload">
                <div className="student-profile-upload__copy">
                  <strong>Profile Image</strong>
                  <small>Upload a clear professional image for your institutional profile. Supported: JPG, PNG (Max 2MB).</small>
                </div>
                <label className="teacher-upload-dropzone teacher-upload-dropzone--image student-profile-upload__dropzone">
                  <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} />
                  {form.image ? (
                    <span className="student-profile-upload__filled">
                      <img src={form.image} alt={form.name || 'Teacher'} className="student-profile-upload__image student-profile-upload__image--large" />
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
                  <span>Institutional Placement</span>
                  <input name="college" value={form.college} onChange={handleChange} placeholder="Your institution" />
                </label>

                <label className="student-profile-field">
                  <span>Branch / Department</span>
                  <input name="branch" value={form.branch} onChange={handleChange} placeholder="Your department" />
                </label>

                <label className="student-profile-field">
                  <span>Semester Coverage</span>
                  <input type="number" min="1" max="12" name="semester" value={form.semester} onChange={handleChange} placeholder="Semester" />
                </label>

                <div className="student-profile-field student-profile-field--hint">
                  <span>Account Category</span>
                  <input value="Faculty Member" disabled className="student-profile-field__disabled" />
                </div>

                <label className="student-profile-field student-profile-field--full">
                  <span>Academic Biography</span>
                  <textarea name="bio" rows="5" value={form.bio} onChange={handleChange} placeholder="Describe your teaching focus and academic background" />
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
