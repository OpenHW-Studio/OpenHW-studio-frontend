import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api');

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
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="explore-page">
      <header className="explore-header">
        <button className="explore-back" onClick={() => navigate(-1)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back
        </button>
        <div>
          <h1 className="explore-title">Explore Community</h1>
          <p className="explore-subtitle">Discover circuits shared by fellow makers</p>
        </div>
      </header>

      <div className="explore-grid">
        {loading ? (
          <p className="explore-empty">Loading...</p>
        ) : projects.length === 0 ? (
          <p className="explore-empty">No projects published yet. Be the first to share!</p>
        ) : (
          projects.map((proj) => (
            <div key={proj._id} className="explore-card">
              <div className="explore-card__img-wrap">
                {proj.thumbnail ? (
                  <img src={proj.thumbnail} alt={proj.name} className="explore-card__img" />
                ) : (
                  <div className="explore-card__img-placeholder">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>
                  </div>
                )}
              </div>
              <div className="explore-card__body">
                <h3 className="explore-card__title">{proj.name}</h3>
                <div className="explore-card__meta">
                  <span className="explore-card__board">{getBoardLabel(proj.board)}</span>
                  <span className="explore-card__count">{proj.components?.length || 0} parts</span>
                </div>
                {proj.publishedByName && (
                  <span className="explore-card__author">by {proj.publishedByName}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
