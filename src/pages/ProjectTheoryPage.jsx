import { useState, useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useGamification } from '../context/GamificationContext'
import { PROJECTS } from '../services/gamification/ProjectsConfig'
import { getProjectFlashcards } from '../services/gamification/ProjectData'
import {
  getAdventureProjectContent,
  markAdventureStepComplete,
  toProjectDisplayMeta,
} from '../services/adventureService'

export default function ProjectTheoryPage() {
  const { projectName } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const classId = new URLSearchParams(location.search).get('classId')
  const mapPath = classId ? `/adventure?classId=${encodeURIComponent(classId)}` : '/adventure'
  const [classTheoryCards, setClassTheoryCards] = useState(null)
  const { theme = 'dark' } = useGamification()

const baseProject = PROJECTS.find(p => p.slug === projectName)
  const [customProject, setCustomProject] = useState(null)
  const [loadingCustom, setLoadingCustom] = useState(() => !baseProject)

  // Load custom project metadata from class adventure if needed
  useEffect(() => {
    if (baseProject) {
      setCustomProject(null)
      setLoadingCustom(false)
      return
    }
    let cancelled = false
    setLoadingCustom(true)
    const load = async () => {
      try {
        const { project: classProject } = await getAdventureProjectContent(classId, projectName)
        if (cancelled) return
        setCustomProject(toProjectDisplayMeta(classProject))
      } catch (err) {
        console.error('Failed to load custom project:', err)
        setCustomProject(null)
      } finally {
        if (!cancelled) setLoadingCustom(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [classId, projectName, baseProject])

  const project = baseProject || customProject
  const loading = loadingCustom && !baseProject
  const color = project?.color || '#3b82f6'

  const [currentIdx, setCurrentIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [doneCount, setDoneCount] = useState(0)
  const [allDone, setAllDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const { project: projectContent } = await getAdventureProjectContent(classId, projectName)
        if (cancelled) return
        setClassTheoryCards(Array.isArray(projectContent?.theory) && projectContent.theory.length ? projectContent.theory : null)
      } catch {
        if (!cancelled) setClassTheoryCards(null)
      }
    }
    load()
    return () => { cancelled = true }
  }, [classId, projectName])

  const flashcards = classTheoryCards || getProjectFlashcards(projectName)
  const total = flashcards.length
  const card = flashcards[currentIdx]

  useEffect(() => {
    if (doneCount >= total && total > 0) {
      setAllDone(true)
      markAdventureStepComplete({
        classId,
        projectSlug: projectName,
        stepKey: 'read',
        stepOrder: 1,
      }).catch(() => {})
    }
  }, [doneCount, total, projectName, classId])

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

  if (loading) {
    return (
      <div className="gamification-page" style={{ background: theme === 'dark' ? 'linear-gradient(160deg,#080e1e 0%,#0c1528 55%,#07101f 100%)' : 'linear-gradient(160deg,#f0f4ff 0%,#e8edf8 55%,#f0f4ff 100%)', color: theme === 'dark' ? '#e2e8f0' : '#1e293b', padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Loading project…</div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="gamification-page" style={{ background: theme === 'dark' ? 'linear-gradient(160deg,#080e1e 0%,#0c1528 55%,#07101f 100%)' : 'linear-gradient(160deg,#f0f4ff 0%,#e8edf8 55%,#f0f4ff 100%)', color: theme === 'dark' ? '#e2e8f0' : '#1e293b', padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Project Not Found</div>
        <div style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b', marginBottom: 24 }}>Could not find project: {projectName}</div>
        <button onClick={() => navigate(mapPath)} style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: color, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          ← Back to Adventure Map
        </button>
      </div>
    )
  }

  if (allDone) {
    return (
      <div className="gamification-page completion-screen" style={{ background: theme === 'dark' ? 'linear-gradient(160deg,#080e1e 0%,#0c1528 55%,#07101f 100%)' : 'linear-gradient(160deg,#f0f4ff 0%,#e8edf8 55%,#f0f4ff 100%)', color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap');
        `}</style>
        <div className="completion-icon">🎉</div>
        <div className="completion-title" style={{ color: '#34d399', marginBottom: 8 }}>
          All Done!
        </div>
        <div className="completion-subtitle" style={{ color: theme === 'dark' ? '#64748b' : '#94a3b8', marginBottom: 36 }}>
          You've reviewed all {total} cards for {project.title}
        </div>
        <button onClick={() => navigate(mapPath)} className="btn-primary-gradient" style={{
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
      `}</style>

      <div className="gamification-topbar">
        <button className="btn-back" style={{ background: theme === 'dark' ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)', color: '#94a3b8' }} onClick={() => navigate(mapPath)}>
          ← Map
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}>
            📖 {project.title}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: theme === 'dark' ? '#f0f4ff' : '#0f172a' }}>Reading</div>
        </div>
        <div style={{ fontSize: 13, color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>
          {doneCount}/{total}
        </div>
      </div>

      <div className="gamification-content" style={{ animation: 'fadeUp .35s ease' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: theme === 'dark' ? '#94a3b8' : '#64748b', marginBottom: 7, fontWeight: 700 }}>
            <span>Card {currentIdx + 1} of {total}</span>
            <span style={{ color }}>{Math.round((doneCount / total) * 100)}%</span>
          </div>
          <div className="progress-bar-track" style={{ background: theme === 'dark' ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.08)', height: 6, borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ height: '100%', borderRadius: 99, width: `${(doneCount / total) * 100}%`, background: color, transition: 'width .4s ease' }} />
          </div>
          <div className="progress-dots">
            {flashcards.map((_, i) => (
              <div key={i} className="progress-dot" style={{
                background: doneCount > i ? color : (theme === 'dark' ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.12)'),
                transform: i === currentIdx ? 'scale(1.3)' : 'scale(1)',
              }} />
            ))}
          </div>
        </div>

        <FlipCard
          card={card}
          color={color}
          theme={theme}
          flipped={flipped}
          onFlip={handleFlip}
        />

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button onClick={handleNext} className="btn-secondary-gradient" style={{
            background: `linear-gradient(135deg, ${color}, ${color}cc)`,
            color: '#fff',
          }}>
            {currentIdx + 1 >= total ? 'Finish' : 'Next Card →'}
          </button>
        </div>
      </div>
    </div>
  )
}

function FlipCard({ card, color, theme, flipped, onFlip }) {
  return (
    <div className="flip-card">
      <div className={`flip-inner ${flipped ? 'flipped' : ''}`}>
         <div className="flip-face" onClick={() => !flipped && onFlip()} style={{
          background: `linear-gradient(145deg,${color}18,${color}07)`,
          border: `2px solid ${color}45`,
           display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', padding: 32, cursor: flipped ? 'default' : 'pointer',
         }}>
           <div style={{ fontSize: 64, marginBottom: 14 }}>{card.emoji}</div>
          <div style={{ fontSize: 21, fontWeight: 900, color: theme === 'dark' ? '#f0f4ff' : '#0f172a', marginBottom: 10 }}>{card.front}</div>
          <div style={{ fontSize: 15, color: theme === 'dark' ? '#94a3b8' : '#64748b', lineHeight: 1.65, maxWidth: 480 }}>{card.simple}</div>
           {!flipped && (
            <div style={{ marginTop: 20, fontSize: 11, fontWeight: 800, color, letterSpacing: '.08em', background: color + '18', padding: '5px 14px', borderRadius: 20, border: `1px solid ${color}33` }}>
               TAP TO FLIP ▶
             </div>
           )}
         </div>
         <div className="flip-face flip-back" style={{
           background: theme === 'dark' ? 'linear-gradient(145deg,#111e35,#0d1728)' : 'linear-gradient(145deg,#ffffff,#f1f5f9)',
          border: `2px solid ${color}45`,
           padding: 28, overflow: 'auto',
         }}>
           <div style={{ fontSize: 12, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 14 }}>
             📚 Here's How It Works
           </div>
          <div style={{ fontSize: 13, color: theme === 'dark' ? '#94a3b8' : '#64748b', lineHeight: 1.85, marginBottom: 16, whiteSpace: 'pre-line', fontFamily: 'monospace' }}>
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