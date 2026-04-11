import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useGamification } from '../context/GamificationContext'
import { PROJECTS } from '../services/gamification/ProjectsConfig'
import { getProjectFlashcards } from '../services/gamification/ProjectData'

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
    text2: D ? '#cbd5e1' : '#475569',
    barTrack: D ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.08)',
    dot: D ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.12)',
    dotActive: D ? '#fff' : '#475569',
    cardBackBg: D ? 'linear-gradient(145deg,#111e35,#0d1728)' : 'linear-gradient(145deg,#ffffff,#f1f5f9)',
  }
}

function FlipCard({ card, color, T, flipped, onFlip }) {
  return (
    <div className="flip-card" style={{ width: '100%', height: 280 }}>
      <div className={`flip-inner ${flipped ? 'flipped' : ''}`}>
        <div className="flip-face" onClick={() => !flipped && onFlip()} style={{
          background: `linear-gradient(145deg,${color}18,${color}07)`,
          border: `2px solid ${color}45`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', padding: 32, cursor: flipped ? 'default' : 'pointer',
        }}>
          <div style={{ fontSize: 64, marginBottom: 14 }}>{card.emoji}</div>
          <div style={{ fontSize: 21, fontWeight: 900, color: T.textH, marginBottom: 10 }}>{card.front}</div>
          <div style={{ fontSize: 15, color: T.textMuted, lineHeight: 1.65, maxWidth: 480 }}>{card.simple}</div>
          {!flipped && (
            <div style={{ marginTop: 20, fontSize: 11, fontWeight: 800, color, letterSpacing: '.08em', background: color + '18', padding: '5px 14px', borderRadius: 20, border: `1px solid ${color}33` }}>
              TAP TO FLIP ▶
            </div>
          )}
        </div>
        <div className="flip-face flip-back" style={{
          background: T.cardBackBg,
          border: `2px solid ${color}45`,
          padding: 28, overflow: 'auto',
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 14 }}>
            📚 Here's How It Works
          </div>
          <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.85, marginBottom: 16, whiteSpace: 'pre-line', fontFamily: 'monospace' }}>
            {card.detail}
          </div>
          <div style={{ background: color + '14', border: `1px solid ${color}33`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color, fontWeight: 700, lineHeight: 1.5 }}>
            {card.funFact}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProjectTheoryPage() {
  const { projectName } = useParams()
  const navigate = useNavigate()
  const { theme = 'dark' } = useGamification()
  const T = getT(theme)

  const project = PROJECTS.find(p => p.slug === projectName)
  const color = project?.color || '#3b82f6'

  const [currentIdx, setCurrentIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [doneCount, setDoneCount] = useState(0)
  const [allDone, setAllDone] = useState(false)

  // Get flashcards from centralized data file
  const flashcards = getProjectFlashcards(projectName)
  const total = flashcards.length
  const card = flashcards[currentIdx]

  useEffect(() => {
    if (doneCount >= total) {
      setAllDone(true)
    }
  }, [doneCount, total])

  const handleFlip = () => !flipped && setFlipped(true)

  const handleNext = () => {
    setDoneCount(d => d + 1)
    if (currentIdx + 1 >= total) {
      setAllDone(true)
      return
    }
    setCurrentIdx(n => n + 1)
    setFlipped(false)
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

  if (allDone) {
    return (
      <div style={{ minHeight: '100vh', background: T.page, color: T.text, padding: 40, textAlign: 'center' }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap');
          * { box-sizing: border-box; }
          @keyframes sparkle { 0%,100% { transform:scale(1); opacity:1; } 50% { transform:scale(1.15); opacity:.8; } }
          .flip-card { perspective:1200px; }
          .flip-inner { position:relative; width:100%; height:100%; transition:transform .55s cubic-bezier(.45,0,.55,1); transform-style:preserve-3d; }
          .flip-inner.flipped { transform:rotateY(180deg); }
          .flip-face { position:absolute; inset:0; backface-visibility:hidden; -webkit-backface-visibility:hidden; border-radius:20px; }
          .flip-back { transform:rotateY(180deg); }
        `}</style>
        <div style={{ fontSize: 80, marginBottom: 12, animation: 'sparkle 1s ease infinite' }}>🎉</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: '#34d399', marginBottom: 8 }}>
          All Done!
        </div>
        <div style={{ color: T.textDim, fontSize: 16, marginBottom: 36 }}>
          You've reviewed all {total} cards for {project.title}
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
        .flip-card { perspective:1200px; }
        .flip-inner { position:relative; width:100%; height:100%; transition:transform .55s cubic-bezier(.45,0,.55,1); transform-style:preserve-3d; }
        .flip-inner.flipped { transform:rotateY(180deg); }
        .flip-face { position:absolute; inset:0; backface-visibility:hidden; -webkit-backface-visibility:hidden; border-radius:20px; }
        .flip-back { transform:rotateY(180deg); }
      `}</style>

      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.topbarBorder}`, background: T.topbar, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate('/adventure')} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,.06)', color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          ← Map
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}>
            📖 {project.title}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.textH }}>Reading</div>
        </div>
        <div style={{ fontSize: 13, color: T.textMuted }}>
          {doneCount}/{total}
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 20px', animation: 'fadeUp .35s ease' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: T.textMuted, marginBottom: 7, fontWeight: 700 }}>
            <span>Card {currentIdx + 1} of {total}</span>
            <span style={{ color }}>{Math.round((doneCount / total) * 100)}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: T.barTrack, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ height: '100%', borderRadius: 99, width: `${(doneCount / total) * 100}%`, background: color, transition: 'width .4s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
            {flashcards.map((_, i) => (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: '50%', transition: 'all .3s',
                background: doneCount > i ? color : i === currentIdx ? T.dotActive : T.dot,
                transform: i === currentIdx ? 'scale(1.3)' : 'scale(1)',
              }} />
            ))}
          </div>
        </div>

        <FlipCard
          card={card}
          color={color}
          T={T}
          flipped={flipped}
          onFlip={handleFlip}
        />

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button onClick={handleNext} style={{
            background: `linear-gradient(135deg, ${color}, ${color}cc)`,
            border: 'none', borderRadius: 10, padding: '14px 32px',
            fontSize: 15, fontWeight: 800, color: '#fff', cursor: 'pointer',
            fontFamily: 'Nunito,sans-serif',
          }}>
            {currentIdx + 1 >= total ? 'Finish' : 'Next Card →'}
          </button>
        </div>
      </div>
    </div>
  )
}