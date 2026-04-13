import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useGamification } from '../context/GamificationContext'
import { PROJECTS } from '../services/gamification/ProjectsConfig'
import { getUnlockComponents } from '../services/gamification/ProjectData'

export default function ProjectComponentUnlockPage() {
  const { projectName } = useParams()
  const navigate = useNavigate()
  const { theme = 'dark' } = useGamification()

  const project = PROJECTS.find(p => p.slug === projectName)
  const color = project?.color || '#3b82f6'

  const components = getUnlockComponents(projectName)
  const total = components.length

  const [revealedCount, setRevealedCount] = useState(0)
  const [revealedCards, setRevealedCards] = useState(new Set())
  const [allRevealed, setAllRevealed] = useState(false)

  useEffect(() => {
    if (revealedCount >= total) {
      setAllRevealed(true)
      if (window.markAdventureStepComplete) {
        window.markAdventureStepComplete(projectName, 'unlock', 3)
      }
    }
  }, [revealedCount, total, projectName])

  const handleReveal = (index) => {
    if (!revealedCards.has(index)) {
      setRevealedCards(prev => new Set([...prev, index]))
      setRevealedCount(c => c + 1)
    }
  }

  const handleRevealAll = () => {
    const allIndices = new Set(components.map((_, i) => i))
    setRevealedCards(allIndices)
    setRevealedCount(total)
  }

  if (!project) {
    return (
      <div className="gamification-page" style={{ background: theme === 'dark' ? 'linear-gradient(160deg,#080e1e 0%,#0c1528 55%,#07101f 100%)' : 'linear-gradient(160deg,#f0f4ff 0%,#e8edf8 55%,#f0f4ff 100%)', color: theme === 'dark' ? '#e2e8f0' : '#1e293b', padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Project Not Found</div>
        <div style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b', marginBottom: 24 }}>Could not find project: {projectName}</div>
        <button onClick={() => navigate('/adventure')} style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: color, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          ← Back to Adventure Map
        </button>
      </div>
    )
  }

  if (allRevealed) {
    return (
      <div className="gamification-page completion-screen" style={{ background: theme === 'dark' ? 'linear-gradient(160deg,#080e1e 0%,#0c1528 55%,#07101f 100%)' : 'linear-gradient(160deg,#f0f4ff 0%,#e8edf8 55%,#f0f4ff 100%)', color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap');
        `}</style>
        <div className="completion-icon">🎉</div>
        <div className="completion-title" style={{ color: '#34d399', marginBottom: 8 }}>
          Unlocked!
        </div>
        <div className="completion-subtitle" style={{ color: theme === 'dark' ? '#64748b' : '#94a3b8', marginBottom: 24 }}>
          You earned {total} new components!
        </div>
        
        <div className="component-unlock-list">
          {components.map((comp, i) => (
            <div key={i} className="component-unlock-item" style={{
              background: 'linear-gradient(145deg,#111e35,#0d1728)',
              border: `2px solid ${comp.color}44`,
              borderRadius: 12,
            }}>
              <span style={{ fontSize: 24 }}>{comp.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#f0f4ff' }}>{comp.name}</span>
            </div>
          ))}
        </div>

        <button onClick={() => navigate('/adventure')} className="btn-primary-gradient" style={{
          background: 'linear-gradient(135deg,#22c55e,#16a34a)',
          color: '#fff',
          boxShadow: '0 4px 24px rgba(34,197,94,.45)',
        }}>
          ← Back to Adventure Map
        </button>
      </div>
    )
  }

  return (
    <div className="gamification-page" style={{ background: theme === 'dark' ? 'linear-gradient(160deg,#080e1e 0%,#0c1528 55%,#07101f 100%)' : 'linear-gradient(160deg,#f0f4ff 0%,#e8edf8 55%,#f0f4ff 100%)', color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap');
        .reveal-card { perspective:1200px; }
        .reveal-inner { position:relative; width:100%; height:100%; transition:transform .6s cubic-bezier(.4,0,.2,1); transform-style:preserve-3d; }
        .reveal-inner.revealed { transform:rotateY(180deg); }
      `}</style>

      <div className="gamification-topbar">
        <button className="btn-back" style={{ background: theme === 'dark' ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)', color: '#94a3b8' }} onClick={() => navigate('/adventure')}>
          ← Map
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}>
            🎁 {project.title}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: theme === 'dark' ? '#f0f4ff' : '#0f172a' }}>Component Unlock</div>
        </div>
        <div style={{ fontSize: 13, color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>
          {revealedCount}/{total} revealed
        </div>
      </div>

      <div className="gamification-content" style={{ animation: 'fadeUp .35s ease' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: theme === 'dark' ? '#f0f4ff' : '#0f172a', marginBottom: 8 }}>
            New Components!
          </div>
          <div style={{ fontSize: 14, color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>
            Complete the project to earn these parts
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div className="progress-bar-track" style={{ background: theme === 'dark' ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.08)', height: 6, borderRadius: 99, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ height: '100%', borderRadius: 99, width: `${(revealedCount / total) * 100}%`, background: color, transition: 'width .4s ease' }} />
          </div>
          <div className="progress-dots">
            {components.map((_, i) => (
              <div key={i} className="progress-dot" style={{
                background: revealedCount > i ? color : (theme === 'dark' ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.12)'),
                transform: i === revealedCount ? 'scale(1.3)' : 'scale(1)',
              }} />
            ))}
          </div>
        </div>

        <div className="unlock-cards-grid">
          {components.map((comp, index) => (
            <RevealCard
              key={index}
              component={comp}
              color={comp.color}
              isRevealed={revealedCards.has(index)}
              onReveal={() => handleReveal(index)}
            />
          ))}
        </div>

        {revealedCount > 0 && revealedCount < total && (
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <button onClick={handleRevealAll} className="btn-reveal-all" style={{ color: '#94a3b8' }}>
              Reveal All
            </button>
          </div>
        )}

        {revealedCount === 0 && (
          <div style={{ textAlign: 'center', fontSize: 13, color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>
            👆 Tap each card to reveal your new components!
          </div>
        )}

        {allRevealed && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button onClick={() => navigate('/adventure')} className="btn-secondary-gradient" style={{
              background: `linear-gradient(135deg, ${color}, ${color}cc)`,
              color: '#fff',
            }}>
              ← Back to Adventure Map
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function RevealCard({ component, color, isRevealed, onReveal }) {
  return (
    <div className="reveal-card">
      <div 
        className={`reveal-inner ${isRevealed ? 'revealed' : ''}`}
        onClick={() => !isRevealed && onReveal()}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          cursor: isRevealed ? 'default' : 'pointer',
        }}
      >
        <div style={{
          position: 'absolute',
          inset: 0,
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          borderRadius: 16,
          background: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 12,
          boxShadow: `0 8px 32px ${color}44`,
        }}>
          <div style={{ fontSize: 48 }}>❓</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
            {isRevealed ? 'Unlocked!' : 'Tap to reveal'}
          </div>
        </div>

        <div style={{
          position: 'absolute',
          inset: 0,
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          borderRadius: 16,
          transform: 'rotateY(180deg)',
          background: 'linear-gradient(145deg, #111e35, #0d1728)',
          border: `2px solid ${color}44`,
          padding: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 8,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 56 }}>{component.icon}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#f0f4ff' }}>{component.name}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{component.desc}</div>
        </div>
      </div>
    </div>
  )
}