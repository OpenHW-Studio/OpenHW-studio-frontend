import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getToken } from '../services/authService'

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api');

const BOARD_ICONS = {
  arduino_uno: 'A',
  'esp-32': 'E',
  pico: 'P',
};

function getBoardLabel(type) {
  const map = {
    arduino_uno: 'Arduino Uno',
    'esp-32': 'ESP32',
    pico: 'Raspberry Pi Pico',
  }
  return map[type] || type || 'Board'
}

export default function ExploreCommunity() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [menuProject, setMenuProject] = useState(null)
  const [editProject, setEditProject] = useState(null)
  const [editName, setEditName] = useState('')
  const menuRef = useRef(null)

  useEffect(() => {
    fetch(`${API_BASE}/community/projects`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setProjects(data.projects)
        else setProjects([])
      })
      .catch(() => setProjects([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuProject(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = search.trim()
    ? projects.filter((p) =>
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.publishedByName?.toLowerCase().includes(search.toLowerCase())
      )
    : projects

  const currentUserId = user?._id || user?.id

  const handleOpenInSimulator = async (proj) => {
    const { saveProject } = await import('../services/projectStore')
    const localId = `community_${proj._id}`
    await saveProject({
      id: localId,
      name: proj.name,
      board: proj.board || 'arduino_uno',
      components: proj.components || [],
      connections: proj.connections || [],
      wires: proj.connections || [],
      code: proj.code || '',
      blocklyXml: '',
      blocklyGeneratedCode: '',
      useBlocklyCode: false,
      projectFiles: [],
      openCodeTabs: [],
      activeCodeFileId: '',
      thumbnail: proj.thumbnail || '',
      owner: user?.email || 'guest',
      savedAt: Date.now(),
    })
    navigate('/simulator', { state: { loadProjectId: localId } })
  }

  const handleEditName = async () => {
    if (!editName.trim() || !editProject) return
    try {
      const token = getToken()
      const res = await fetch(`${API_BASE}/community/project/${editProject._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editName.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        setProjects((prev) =>
          prev.map((p) => (p._id === editProject._id ? { ...p, name: editName.trim() } : p))
        )
      }
    } catch {}
    setEditProject(null)
    setEditName('')
    setMenuProject(null)
  }

  const handleDelete = async (proj) => {
    try {
      const token = getToken()
      const res = await fetch(`${API_BASE}/community/project/${proj._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setProjects((prev) => prev.filter((p) => p._id !== proj._id))
      }
    } catch {}
    setMenuProject(null)
  }

  return (
    <div className="explore-page">
      <div className="explore-hero">
        <button className="explore-back" onClick={() => navigate(-1)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back
        </button>
        <h1 className="explore-title">Explore Community</h1>
        <p className="explore-subtitle">Discover circuits shared by fellow makers</p>
        <div className="explore-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input
            type="text"
            placeholder="Search projects or authors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="explore-grid">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="explore-card-skeleton">
              <div className="explore-card-skeleton__img" />
              <div className="explore-card-skeleton__body">
                <div className="explore-card-skeleton__line" />
                <div className="explore-card-skeleton__line explore-card-skeleton__line--short" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="explore-empty">
            {search ? (
              <>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M8 11h6"/></svg>
                <p>No projects match your search</p>
              </>
            ) : (
              <>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>
                <p>No projects published yet. Be the first to share!</p>
              </>
            )}
          </div>
        ) : (
          filtered.map((proj) => {
            const isOwn = currentUserId && proj.publishedBy === currentUserId
            return (
              <div key={proj._id} className="explore-card" onClick={() => handleOpenInSimulator(proj)}>
                <div className="explore-card__img-wrap">
                  {proj.thumbnail ? (
                    <img src={proj.thumbnail} alt={proj.name} className="explore-card__img" />
                  ) : (
                    <div className="explore-card__img-placeholder">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>
                    </div>
                  )}
                  <div className="explore-card__board-badge">{BOARD_ICONS[proj.board] || 'B'}</div>
                  {isOwn && (
                    <button
                      className="explore-card__menu-btn"
                      onClick={(e) => { e.stopPropagation(); setMenuProject(menuProject?._id === proj._id ? null : proj) }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                    </button>
                  )}
                  {menuProject?._id === proj._id && (
                    <div className="explore-card__menu" ref={menuRef} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="explore-card__menu-item"
                        onClick={() => { setEditProject(proj); setEditName(proj.name); setMenuProject(null) }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Edit name
                      </button>
                      <button
                        className="explore-card__menu-item explore-card__menu-item--danger"
                        onClick={() => { if (window.confirm('Delete this project from community?')) handleDelete(proj) }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                <div className="explore-card__body">
                  <h3 className="explore-card__title">{proj.name}</h3>
                  <div className="explore-card__meta">
                    <span className="explore-card__board">{getBoardLabel(proj.board)}</span>
                    <span className="explore-card__dot">&middot;</span>
                    <span className="explore-card__count">{proj.components?.length || 0} parts</span>
                  </div>
                  {proj.publishedByName && (
                    <div className="explore-card__author">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      {proj.publishedByName}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {editProject && (
        <div className="explore-modal-overlay" onClick={() => { setEditProject(null); setEditName('') }}>
          <div className="explore-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="explore-modal__title">Edit project name</h3>
            <input
              className="explore-modal__input"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleEditName(); if (e.key === 'Escape') { setEditProject(null); setEditName('') } }}
              autoFocus
            />
            <div className="explore-modal__actions">
              <button className="explore-modal__btn explore-modal__btn--cancel" onClick={() => { setEditProject(null); setEditName('') }}>Cancel</button>
              <button className="explore-modal__btn explore-modal__btn--save" onClick={handleEditName}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
