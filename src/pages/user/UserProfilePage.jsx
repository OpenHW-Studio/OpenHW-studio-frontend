import { useMemo, useState } from 'react'
import {
  BookOpen,
  Building2,
  Folder,
  Home,
  Loader2,
  Mail,
  MapPin,
  PenSquare,
  UserCircle2,
  X,
  Cpu,
  FileText,
  Activity,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  Layers
} from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { getAvatarLetters } from '../../components/common/test.js'
import { updateProfile } from '../../services/authService.js'
import DeleteAccountModal from '../../components/DeleteAccountModal.jsx'

const STYLE_PRESETS = [
  { id: "bottts", label: "Robot" },
  { id: "lorelei", label: "Lorelei" },
  { id: "avataaars", label: "Avataaars" },
  { id: "pixel-art", label: "Pixel Art" },
  { id: "adventurer", label: "Adventurer" },
  { id: "micah", label: "Micah" }
]

const SEEDS = [
  "alpha", "beta", "gamma", "delta", "epsilon", "zeta",
  "eta", "theta", "iota", "kappa", "lambda", "mu",
  "nu", "xi", "omicron", "pi", "rho", "sigma"
]

const parseAvatarUrl = (url) => {
  if (url && url.startsWith("https://api.dicebear.com/")) {
    try {
      const parts = url.split("/")
      const style = parts[4]
      const search = parts[5].split("?")[1]
      const params = new URLSearchParams(search)
      const seed = params.get("seed")
      return { style, seed }
    } catch (e) { return null }
  }
  return null
}

const buildFormState = (user) => ({
  name: user?.name || '',
  college: user?.college || '',
  branch: user?.branch || '',
  semester: user?.semester?.toString() || '',
  bio: user?.bio || '',
  image: user?.image || ''
})

export default function UserProfilePage() {
  const navigate = useNavigate()
  const { user, logout, updateUserSession } = useAuth()
  const [form, setForm] = useState(() => buildFormState(user))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [styleIndex, setStyleIndex] = useState(0)
  const [avatarStyle, setAvatarStyle] = useState('bottts')
  const [avatarSeed, setAvatarSeed] = useState('alpha')
  const [avatarPage, setAvatarPage] = useState(0)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const getAdjacentIndex = (offset) => (styleIndex + offset + STYLE_PRESETS.length) % STYLE_PRESETS.length

  const prevStyle = () => {
    const nextIdx = getAdjacentIndex(-1)
    setStyleIndex(nextIdx)
    const newStyle = STYLE_PRESETS[nextIdx].id
    setAvatarStyle(newStyle); setAvatarPage(0); setAvatarSeed(SEEDS[0])
    setForm(c => ({ ...c, image: `https://api.dicebear.com/9.x/${newStyle}/svg?seed=${SEEDS[0]}` }))
  }

  const nextStyle = () => {
    const nextIdx = getAdjacentIndex(1)
    setStyleIndex(nextIdx)
    const newStyle = STYLE_PRESETS[nextIdx].id
    setAvatarStyle(newStyle); setAvatarPage(0); setAvatarSeed(SEEDS[0])
    setForm(c => ({ ...c, image: `https://api.dicebear.com/9.x/${newStyle}/svg?seed=${SEEDS[0]}` }))
  }

  const handleRandomize = () => {
    const rIdx = Math.floor(Math.random() * STYLE_PRESETS.length)
    const rSeed = "rand-" + Math.random().toString(36).substring(2, 9)
    const newStyle = STYLE_PRESETS[rIdx].id
    setStyleIndex(rIdx); setAvatarStyle(newStyle); setAvatarSeed(rSeed); setAvatarPage(0)
    setForm(c => ({ ...c, image: `https://api.dicebear.com/9.x/${newStyle}/svg?seed=${rSeed}` }))
  }

  const prevPage = () => setAvatarPage(p => (p - 1 + 3) % 3)
  const nextPage = () => setAvatarPage(p => (p + 1) % 3)
  const currentPageSeeds = SEEDS.slice(avatarPage * 6, avatarPage * 6 + 6)

  const avatarInitials = useMemo(() => getAvatarLetters(user?.name, 'U'), [user?.name])
  const profileMetrics = useMemo(() => {
    const completed = [user?.college, user?.branch, user?.semester, user?.bio, user?.image].filter(Boolean).length
    return { completion: Math.round((completed / 5) * 100) }
  }, [user?.bio, user?.branch, user?.college, user?.image, user?.semester])

  const handleLogout = () => { logout(); navigate('/') }

  const openEditModal = () => {
    setForm(buildFormState(user)); setError(''); setIsEditOpen(true)
    const parsed = parseAvatarUrl(user?.image)
    if (parsed) {
      setAvatarStyle(parsed.style); setAvatarSeed(parsed.seed)
      const idx = STYLE_PRESETS.findIndex(p => p.id === parsed.style)
      if (idx !== -1) setStyleIndex(idx)
    } else { setAvatarStyle('bottts'); setAvatarSeed('alpha'); setStyleIndex(0) }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(c => ({ ...c, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setError(''); setInfo('')
    try {
      const payload = {
        name: form.name.trim(), college: form.college.trim(), branch: form.branch.trim(),
        semester: form.semester ? parseInt(form.semester, 10) : null,
        bio: form.bio.trim(), image: form.image.trim()
      }
      const response = await updateProfile(payload)
      if (response?.user) { updateUserSession(response.user); setForm(buildFormState(response.user)) }
      setInfo('Profile updated successfully.'); setIsEditOpen(false)
    } catch (err) { setError(err.message || 'Failed to update profile') }
    finally { setSaving(false) }
  }

  return (
    <div className="student-db-layout">
      {showDeleteModal && (
        <DeleteAccountModal
          userRole={user?.role || 'user'}
          userEmail={user?.email || ''}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => { logout(); navigate('/login'); }}
        />
      )}
      <header className="student-db-header">
        <div className="student-db-header__left">
          <Link to="/" className="student-db-header__brand">
            <img src="/logo-cropped.png" alt="OpenHW Studio" style={{ height: "65px", width: "130px", objectFit: "contain" }} />
          </Link>
        </div>
        <div className="student-db-header__right">
          <div onClick={() => navigate("/user/profile")} className="student-db-header__avatar is-active" title="User Profile" style={{ cursor: 'pointer' }}>
            {user?.image ? <img src={user.image} alt={user?.name || "Profile"} /> : <span>{user?.name ? user.name.slice(0, 2).toUpperCase() : "U"}</span>}
          </div>
        </div>
      </header>

      <div className="student-db-main-container">
        <aside className="student-db-sidebar">
          <div className="student-db-sidebar__top">
            <div className="student-db-profile-card">
              <div className="student-db-profile-card__monogram">
                {user?.image ? <img src={user.image} alt={user?.name || "Profile"} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} /> : avatarInitials}
              </div>
              <div className="student-db-profile-card__info">
                <span className="student-db-profile-card__title">{user?.name || "User Node"}</span>
                <span className="student-db-profile-card__sub">JWT: Authenticated</span>
              </div>
            </div>

            <button onClick={() => navigate("/user/dashboard")} className="student-db-sidebar__sim-btn">
              <Home className="w-4 h-4" /> Back to Dashboard
            </button>

            <nav className="student-db-sidebar__nav">
              <button onClick={() => navigate("/user/dashboard?tab=guided-projects")} className="student-db-sidebar__link">
                <Folder className="w-4 h-4" /> Guided Project
              </button>
              <button onClick={() => navigate("/user/dashboard?tab=modules")} className="student-db-sidebar__link">
                <Layers className="w-4 h-4" /> Modules
              </button>
            </nav>
          </div>

          <div className="student-db-sidebar__bottom">
            <nav className="student-db-sidebar__nav">
              <a href="https://openhw-studio.fossee.in/docs/" target="_blank" rel="noreferrer" className="student-db-sidebar__link">
                <FileText className="w-4 h-4" /> Docs
              </a>
              <button onClick={handleLogout} className="student-db-sidebar__link text-red-600 hover:bg-red-50">
                Sign Out
              </button>
            </nav>
          </div>
        </aside>

        <main className="student-db-content">
          <section className="student-profile-shell" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
            <section className="student-profile-hero">
              <div className="student-profile-hero__media">
                {user?.image ? <img src={user.image} alt={user?.name || 'User'} className="student-profile-hero__image" /> : <div className="student-profile-hero__avatar">{avatarInitials}</div>}
              </div>
              <div className="student-profile-hero__copy">
                <p className="student-profile-hero__eyebrow">General User</p>
                <h1>{user?.name || 'User'}</h1>
                <div className="student-profile-hero__meta">
                  <span><Mail size={14} /> {user?.email || 'user account'}</span>
                  <span><MapPin size={14} /> {user?.college || 'Profile'}</span>
                </div>
              </div>
              <button type="button" className="student-profile-hero__action" onClick={openEditModal}>
                <PenSquare size={16} /> Edit Profile
              </button>
            </section>

            {info ? <p className="teacher-inline-state">{info}</p> : null}

            <section className="student-profile-grid">
              <article className="student-profile-panel student-profile-panel--wide">
                <header className="student-profile-panel__header">
                  <h3><UserCircle2 size={16} /> Identity &amp; Registration</h3>
                </header>
                <div className="student-profile-panel__stats">
                  <article className="student-profile-data"><small>Full Name</small><strong>{user?.name || 'Not added'}</strong></article>
                  <article className="student-profile-data"><small>Email Address</small><strong>{user?.email || 'Not added'}</strong></article>
                  <article className="student-profile-data"><small>Account Status</small><strong className="student-profile-data__status">Active User</strong></article>
                  <article className="student-profile-data"><small>Account Type</small><strong>General User</strong></article>
                </div>
              </article>

              <article className="student-profile-panel student-profile-panel--bio">
                <header className="student-profile-panel__header">
                  <h3><BookOpen size={16} /> Biography</h3>
                </header>
                <p className="student-profile-panel__bio">{user?.bio || 'Add a short bio to describe your interests and background.'}</p>
                <div className="student-profile-metrics">
                  <div className="student-profile-metrics__row"><span>Profile Completion</span><strong>{profileMetrics.completion}%</strong></div>
                  <div className="student-profile-metrics__bar"><span style={{ width: `${profileMetrics.completion}%` }} /></div>
                </div>
              </article>

              <article className="student-profile-panel student-profile-panel--wide">
                <header className="student-profile-panel__header">
                  <h3><Building2 size={16} /> Institutional Placement</h3>
                </header>
                <div className="student-profile-campus">
                  <div className="student-profile-campus__main">
                    <span className="student-profile-campus__icon"><Building2 size={18} /></span>
                    <div><small>University / Organization</small><strong>{user?.college || 'Not added'}</strong></div>
                  </div>
                </div>
                <div className="student-profile-panel__stats student-profile-panel__stats--compact">
                  <article className="student-profile-data"><small>Department / Branch</small><strong>{user?.branch || 'Not added'}</strong></article>
                  <article className="student-profile-data"><small>Current Semester</small><strong>{user?.semester || 'Not added'}</strong></article>
                </div>
              </article>
            </section>
          </section>
        </main>
      </div>

      {isEditOpen ? (
        <div className="teacher-modal">
          <div className="teacher-modal__backdrop" onClick={() => setIsEditOpen(false)} />
          <section className="teacher-modal__content student-profile-modal">
            <header className="teacher-modal__header">
              <div><h3>Edit Profile</h3><p>Update your profile details.</p></div>
              <button type="button" onClick={() => setIsEditOpen(false)} aria-label="Close profile editor"><X size={18} /></button>
            </header>
            <form className="student-profile-form" onSubmit={handleSubmit}>
              <div className="student-profile-form__top-section" style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "32px", alignItems: "start" }}>
                <div className="student-profile-dicebear-builder" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div className="hardware-card" style={{ margin: "0 auto 12px auto" }}>
                    <div className="hardware-card__header">
                      <span>LIVE PROFILE PREVIEW</span>
                      <span className="hardware-card__signal"><Activity className="w-3.5 h-3.5 animate-pulse" /><span>ONLINE</span></span>
                    </div>
                    <div className="hardware-card__preview-area">
                      <img src={`https://api.dicebear.com/9.x/${avatarStyle}/svg?seed=${avatarSeed}`} alt="Profile Preview" className="hardware-card__avatar" />
                      <div className="hardware-card__chip-icon"><Cpu className="w-4 h-4 text-orange-600 animate-pulse" /></div>
                    </div>
                    <div className="hardware-card__footer"><span>ID: READY</span><span>V.1.0.4</span></div>
                  </div>
                  <div className="hardware-tabs-wrapper" style={{ margin: "0 auto 10px auto", width: "100%" }}>
                    <button type="button" onClick={prevStyle} className="hardware-slider-btn"><ChevronLeft className="w-4 h-4" /></button>
                    <div className="hardware-tabs-slider">
                      <button type="button" onClick={prevStyle} className="hardware-tab-slide is-adjacent">{STYLE_PRESETS[getAdjacentIndex(-1)].label.toUpperCase()}</button>
                      <button type="button" className="hardware-tab-slide is-active">{STYLE_PRESETS[styleIndex].label.toUpperCase()}</button>
                      <button type="button" onClick={nextStyle} className="hardware-tab-slide is-adjacent">{STYLE_PRESETS[getAdjacentIndex(1)].label.toUpperCase()}</button>
                    </div>
                    <button type="button" onClick={nextStyle} className="hardware-slider-btn"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                  <div className="hardware-grid-wrapper" style={{ margin: "0 auto 12px auto", width: "100%" }}>
                    <button type="button" onClick={prevPage} className="hardware-slider-btn"><ChevronLeft className="w-4 h-4" /></button>
                    <div className="hardware-grid">
                      {currentPageSeeds.map(seed => (
                        <button key={seed} type="button" onClick={() => { setAvatarSeed(seed); setForm(c => ({ ...c, image: `https://api.dicebear.com/9.x/${avatarStyle}/svg?seed=${seed}` })) }} className={`hardware-grid-item ${avatarSeed === seed ? "is-selected" : ""}`} title={`Seed: ${seed}`}>
                          <img src={`https://api.dicebear.com/9.x/${avatarStyle}/svg?seed=${seed}&size=40`} alt={seed} className="w-10 h-10 object-contain" />
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={nextPage} className="hardware-slider-btn"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                  <button type="button" onClick={handleRandomize} className="hardware-random-btn" style={{ margin: "0 auto 4px auto", display: "flex" }}>
                    <Shuffle className="w-3.5 h-3.5" /> [ RANDOMIZE AVATAR ]
                  </button>
                </div>
                <div className="student-profile-form__grid" style={{ marginTop: 0 }}>
                  <label className="student-profile-field"><span>Full Name</span><input name="name" value={form.name} onChange={handleChange} placeholder="Enter your full name" /></label>
                  <label className="student-profile-field"><span>Email</span><input type="email" value={user?.email || ''} disabled className="student-profile-field__disabled" /></label>
                  <label className="student-profile-field"><span>College / Organization</span><input name="college" value={form.college} onChange={handleChange} placeholder="Your college or organization" /></label>
                  <label className="student-profile-field"><span>Branch / Department</span><input name="branch" value={form.branch} onChange={handleChange} placeholder="Your branch or department" /></label>
                  <label className="student-profile-field"><span>Semester</span><input type="number" min="1" max="12" name="semester" value={form.semester} onChange={handleChange} placeholder="Semester" /></label>
                  <div className="student-profile-field student-profile-field--hint"><span>Account Category</span><input value="General User" disabled className="student-profile-field__disabled" /></div>
                  <label className="student-profile-field student-profile-field--full" style={{ gridColumn: "1 / -1" }}><span>Biography</span><textarea name="bio" rows="4" value={form.bio} onChange={handleChange} placeholder="Tell us about your interests and background" style={{ minHeight: "90px" }} /></label>
                </div>
              </div>
              {error ? <p className="teacher-inline-state teacher-inline-state--error">{error}</p> : null}
              <div className="teacher-modal__actions">
                <button type="button" className="teacher-button teacher-button--ghost" onClick={() => setIsEditOpen(false)}>Discard Changes</button>
                <button type="submit" className="teacher-button teacher-button--primary" disabled={saving}>
                  {saving ? <><Loader2 size={16} className="teacher-spin" /><span>Saving...</span></> : <span>Update Profile</span>}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {/* ── Danger Zone ──────────────────────────────────────────────────── */}
      <div style={{
        margin: '32px auto', maxWidth: '800px', padding: '0 16px',
        boxSizing: 'border-box',
      }}>
        <div style={{
          background: 'rgba(127,29,29,0.1)', border: '1px solid #7f1d1d',
          borderRadius: '12px', padding: '20px 24px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: '16px', flexWrap: 'wrap',
        }}>
          <div>
            <p style={{ color: '#f87171', fontWeight: 700, margin: '0 0 4px', fontSize: '14px', fontFamily: 'monospace', letterSpacing: '1px' }}>
              DANGER ZONE
            </p>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
              Permanently delete your account and all personal data after a 30-day grace period.
            </p>
          </div>
          <button
            id="delete-account-btn"
            onClick={() => setShowDeleteModal(true)}
            style={{
              padding: '10px 20px', background: 'none',
              border: '1px solid #7f1d1d', borderRadius: '8px',
              color: '#f87171', fontWeight: 600, fontSize: '13px',
              fontFamily: 'monospace', cursor: 'pointer',
              whiteSpace: 'nowrap', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#7f1d1d'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#f87171'; }}
          >
            Delete Account
          </button>
        </div>
      </div>
    </div>
  )
}
