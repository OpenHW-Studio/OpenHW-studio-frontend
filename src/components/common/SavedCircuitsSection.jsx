import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { listProjects, saveProject } from '../../services/projectStore.js'
import { generateCircuitThumbnail } from '../../utils/circuitThumbnail.js'
import { getToken } from '../../services/authService.js'

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api');

function getOwner(user) {
  if (!user) return 'guest'
  return user.email || 'guest'
}

function getBoardLabel(type) {
  const map = {
    arduino_uno: 'Arduino Uno',
    'esp-32': 'ESP32',
    pico: 'Raspberry Pi Pico',
  }
  return map[type] || type || 'Board'
}

export default function SavedCircuitsSection({ user }) {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const trackRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [menuProject, setMenuProject] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const [publishMsg, setPublishMsg] = useState('')
  const menuRef = useRef(null)

  const updateArrows = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  const scroll = useCallback((dir) => {
    const el = trackRef.current
    if (!el) return
    const card = el.querySelector('.saved-circuit-card')
    const step = card ? card.offsetWidth + 16 : 236
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
    setTimeout(updateArrows, 350)
  }, [updateArrows])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const owner = getOwner(user)
      const list = await listProjects(owner)
      const withThumbs = await Promise.all(
        list.map(async (p) => {
          if (p.thumbnail) return p
          const thumb = generateCircuitThumbnail(p.components, p.connections || p.wires)
          try {
            await saveProject({ ...p, thumbnail: thumb })
          } catch {}
          return { ...p, thumbnail: thumb }
        })
      )
      setProjects(withThumbs.slice(0, 20))
    } catch {
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    updateArrows()
    el.addEventListener('scroll', updateArrows, { passive: true })
    return () => el.removeEventListener('scroll', updateArrows)
  }, [updateArrows, loading])

  useEffect(() => {
    if (!menuProject) return
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuProject(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuProject])

  const handlePublish = async (proj) => {
    setPublishing(true)
    setPublishMsg('')
    try {
      const token = getToken()
      const res = await fetch(`${API_BASE}/community/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: proj.name || 'Untitled',
          board: proj.board || 'arduino_uno',
          components: proj.components || [],
          connections: proj.connections || proj.wires || [],
          code: proj.code || '',
          thumbnail: proj.thumbnail || '',
        }),
      })
      const data = await res.json()
      if (data.success) {
        setPublishMsg('Published!')
      } else {
        setPublishMsg(data.message || 'Failed to publish')
      }
    } catch {
      setPublishMsg('Failed to publish')
    } finally {
      setPublishing(false)
      setMenuProject(null)
      setTimeout(() => setPublishMsg(''), 3000)
    }
  }

  if (!loading && projects.length === 0) return null

  return (
    <section className="saved-circuits-section">
      {publishMsg && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 99999, background: publishMsg === 'Published!' ? '#10b981' : '#ef4444', color: '#fff', padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
          {publishMsg}
        </div>
      )}

      <header className="teacher-section-heading teacher-section-heading--compact">
        <div>
          <h3 className="saved-circuits-title">Saved Circuits</h3>
          <p className="section-sub">Your recently saved circuit designs</p>
        </div>
        <button
          type="button"
          className="teacher-section-link"
          onClick={() => navigate('/explore')}
        >
          Explore Project
        </button>
      </header>

      <div className="saved-circuits-slider">
        {!loading && canScrollLeft && (
          <button type="button" className="saved-circuits-arrow saved-circuits-arrow--left" onClick={() => scroll(-1)} aria-label="Scroll left">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
        )}

        <div className="saved-circuits-track" ref={trackRef}>
          {loading ? (
            <div className="saved-circuits-skeleton-track">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="saved-circuit-card-skeleton">
                  <div className="saved-circuit-card-skeleton__img" />
                  <div className="saved-circuit-card-skeleton__title" />
                  <div className="saved-circuit-card-skeleton__meta" />
                </div>
              ))}
            </div>
          ) : (
            projects.map((proj) => (
              <div key={proj.id} className="saved-circuit-card-wrap">
                <button
                  type="button"
                  className="saved-circuit-card"
                  onClick={() => navigate('/simulator', { state: { loadProjectId: proj.id } })}
                >
                  <div className="saved-circuit-card__img-wrap">
                    {proj.thumbnail ? (
                      <img
                        src={proj.thumbnail}
                        alt={proj.name || 'Untitled'}
                        className="saved-circuit-card__img"
                      />
                    ) : (
                      <div className="saved-circuit-card__img-placeholder">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>
                      </div>
                    )}
                  </div>
                  <div className="saved-circuit-card__body">
                    <span className="saved-circuit-card__title">{proj.name || 'Untitled'}</span>
                    <div className="saved-circuit-card__meta">
                      <span className="saved-circuit-card__board">{getBoardLabel(proj.board)}</span>
                      <span className="saved-circuit-card__count">{proj.components?.length || 0} parts</span>
                    </div>
                  </div>
                </button>
                <div className="saved-circuit-card__menu-wrap">
                  <button
                    type="button"
                    className="saved-circuit-card__dots"
                    onClick={(e) => { e.stopPropagation(); setMenuProject(menuProject?.id === proj.id ? null : proj) }}
                    aria-label="More options"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                  </button>
                  {menuProject?.id === proj.id && (
                    <div className="saved-circuit-card__menu" ref={menuRef}>
                      <button
                        type="button"
                        className="saved-circuit-card__menu-item"
                        disabled={publishing}
                        onClick={(e) => { e.stopPropagation(); handlePublish(proj) }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        {publishing ? 'Publishing...' : 'Publish'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {!loading && canScrollRight && (
          <button type="button" className="saved-circuits-arrow saved-circuits-arrow--right" onClick={() => scroll(1)} aria-label="Scroll right">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        )}
      </div>
    </section>
  )
}
