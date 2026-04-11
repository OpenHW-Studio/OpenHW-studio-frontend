import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useGamification } from '../context/GamificationContext'
import { PROJECTS } from '../services/gamification/ProjectsConfig'
import { getUnlockComponents } from '../services/gamification/ProjectData'

function getT(theme) {
  const D = theme === 'dark'
  return {
    page: D ? 'linear-gradient(160deg,#080e1e 0%,#0c1528 55%,#07101f 100%)' : 'linear-gradient(160deg,#f0f4ff 0%,#e8edf8 55%,#f0f4ff 100%)',
    topbar: D ? 'rgba(7,10,20,.97)' : 'rgba(248,250,252,.97)',
    topbarBorder: D ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)',
    textH: D ? '#f0f4ff' : '#0f172a',
    text: D ? '#e2e8f0' : '#1e293b',
    textMuted: D ? '#94a3b8' : '#64748b',
    textDim: D ? '#64748b' : '#94a3b8',
    cardBack: D ? 'linear-gradient(145deg,#1e3a5f,#0d1929)' : 'linear-gradient(145deg,#1e3a5f,#0d1929)',
    cardFront: D ? 'linear-gradient(145deg,#111e35,#0d1728)' : 'linear-gradient(145deg,#ffffff,#f1f5f9)',
  }
}

function RevealCard({ component, color, isRevealed, onReveal, isLast, allRevealed }) {
  return (
    <div className="reveal-card" style={{ perspective: '1200px', width: '100%', height: 200 }}>
      <div 
        className={`reveal-inner ${isRevealed ? 'revealed' : ''}`}
        onClick={() => !isRevealed && onReveal()}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          transformStyle: 'preserve-3d',
          transform: isRevealed ? 'rotateY(180deg)' : 'rotateY(0)',
          cursor: isRevealed ? 'default' : 'pointer',
        }}
      >
        {/* CARD BACK (face down) */}
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

        {/* CARD FRONT (revealed) */}
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

export default function ProjectComponentUnlockPage() {
  const { projectName } = useParams()
  const navigate = useNavigate()
  const { theme = 'dark' } = useGamification()
  const T = getT(theme)

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
    }
  }, [revealedCount, total])

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
      <div style={{ minHeight: '100vh', background: T.page, color: T.text, padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Project Not Found</div>
        <div style={{ color: T.textMuted, marginBottom: 24 }}>Could not find project: {projectName}</div>
        <button onClick={() => navigate('/adventure')} style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: color, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          ← Back to Adventure Map
        </button>
      </div>
    )
  }

  if (allRevealed) {
    return (
      <div style={{ minHeight: '100vh', background: T.page, color: T.text, padding: 40, textAlign: 'center' }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap');
          * { box-sizing: border-box; }
          @keyframes revealPop { from { opacity:0; transform:scale(0.8); } to { opacity:1; transform:scale(1); } }
          @keyframes sparkle { 0%,100% { transform:scale(1); opacity:1; } 50% { transform:scale(1.1); opacity:.9; } }
          .reveal-card { perspective:1200px; }
          .reveal-inner { position:relative; width:100%; height:100%; transition:transform .6s cubic-bezier(.4,0,.2,1); transform-style:preserve-3d; }
          .reveal-inner.revealed { transform:rotateY(180deg); }
        `}</style>
        <div style={{ fontSize: 80, marginBottom: 12, animation: 'sparkle 1s ease infinite' }}>🎉</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: '#34d399', marginBottom: 8 }}>
          Unlocked!
        </div>
        <div style={{ fontSize: 16, color: T.textDim, marginBottom: 24 }}>
          You earned {total} new components!
        </div>
        
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 36 }}>
          {components.map((comp, i) => (
            <div key={i} style={{
              background: 'linear-gradient(145deg,#111e35,#0d1728)',
              border: `2px solid ${comp.color}44`,
              borderRadius: 12,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{ fontSize: 24 }}>{comp.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#f0f4ff' }}>{comp.name}</span>
            </div>
          ))}
        </div>

        <button onClick={() => navigate('/adventure')} style={{
          background: 'linear-gradient(135deg,#22c55e,#16a34a)',
          border: 'none', borderRadius: 14, padding: '16px 44px',
          fontSize: 18, fontWeight: 800, color: '#fff', cursor: 'pointer',
          boxShadow: '0 4px 24px rgba(34,197,94,.45)', fontFamily: 'Nunito,sans-serif',
        }}>
          ← Back to Adventure Map
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: T.page, color: T.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes revealPop { from { opacity:0; transform:scale(0.8); } to { opacity:1; transform:scale(1); } }
        .reveal-card { perspective:1200px; }
        .reveal-inner { position:relative; width:100%; height:100%; transition:transform .6s cubic-bezier(.4,0,.2,1); transform-style:preserve-3d; }
        .reveal-inner.revealed { transform:rotateY(180deg); }
      `}</style>

      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.topbarBorder}`, background: T.topbar, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate('/adventure')} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,.06)', color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          ← Map
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}>
            🎁 {project.title}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.textH }}>Component Unlock</div>
        </div>
        <div style={{ fontSize: 13, color: T.textMuted }}>
          {revealedCount}/{total} revealed
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 20px', animation: 'fadeUp .35s ease' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.textH, marginBottom: 8 }}>
            New Components!
          </div>
          <div style={{ fontSize: 14, color: T.textMuted }}>
            Complete the project to earn these parts
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,.06)', overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ height: '100%', borderRadius: 99, width: `${(revealedCount / total) * 100}%`, background: color, transition: 'width .4s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
            {components.map((_, i) => (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: '50%', transition: 'all .3s',
                background: revealedCount > i ? color : 'rgba(255,255,255,.1)',
                transform: i === revealedCount ? 'scale(1.3)' : 'scale(1)',
              }} />
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
          {components.map((comp, index) => (
            <RevealCard
              key={index}
              component={comp}
              color={comp.color}
              isRevealed={revealedCards.has(index)}
              onReveal={() => handleReveal(index)}
              isLast={index === total - 1}
              allRevealed={allRevealed}
            />
          ))}
        </div>

        {revealedCount > 0 && revealedCount < total && (
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <button onClick={handleRevealAll} style={{
              background: 'rgba(255,255,255,.06)',
              border: '1px solid rgba(255,255,255,.1)',
              borderRadius: 10,
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 700,
              color: '#94a3b8',
              cursor: 'pointer',
              fontFamily: 'Nunito,sans-serif',
            }}>
              Reveal All
            </button>
          </div>
        )}

        {revealedCount === 0 && (
          <div style={{ textAlign: 'center', fontSize: 13, color: T.textMuted }}>
            👆 Tap each card to reveal your new components!
          </div>
        )}

        {allRevealed && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button onClick={() => navigate('/adventure')} style={{
              background: `linear-gradient(135deg, ${color}, ${color}cc)`,
              border: 'none', borderRadius: 10, padding: '14px 32px',
              fontSize: 15, fontWeight: 800, color: '#fff', cursor: 'pointer',
              fontFamily: 'Nunito,sans-serif',
            }}>
              ← Back to Adventure Map
            </button>
          </div>
        )}
      </div>
    </div>
  )
}