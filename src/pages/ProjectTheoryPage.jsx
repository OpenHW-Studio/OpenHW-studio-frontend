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
import { useAuth } from '../context/AuthContext'
import { BookOpen, Sparkles, ArrowRight, ArrowLeft, Trophy, CheckCircle, ShieldAlert, Award, Sun, Moon, FileText, LogOut } from 'lucide-react'

// Slugs that belong to the Arduino journey (mirrors AdventureMapPage)
const ALL_ARDUINO_SLUGS = [
  'led-blink', 'rgb-led', 'buzzer', 'potentiometer', 'ldr',
  'servo-motor', 'led-strip', 'button-debounce', 'temperature-sensor',
  'dc-motor', 'push-button', 'ultrasonic-sensor', 'dht11-sensor', 'lcd-display',
  'relay-control', 'oled-graphics', 'neopixel-effects', 'keypad-lock',
  'rotary-menu', 'seven-segment-clock', 'stepper-motor', 'mpu6050-tilt',
]

export default function ProjectTheoryPage() {
  const { projectName } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const handleLogout = () => {
    logout()
    navigate('/')
  }
  const classId = new URLSearchParams(location.search).get('classId')
  const journey = ALL_ARDUINO_SLUGS.includes(projectName) ? 'arduino' : 'esp32'
  const mapPath = classId
    ? `/adventure?journey=${journey}&classId=${encodeURIComponent(classId)}`
    : `/adventure?journey=${journey}`
  const goBackToMap = () => navigate(mapPath, { state: { openProject: projectName } })
  const [classTheoryCards, setClassTheoryCards] = useState(null)
  const { awardXP } = useGamification()
  
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
  const color = project?.color || '#6366f1'

  const [currentIdx, setCurrentIdx] = useState(0)
  const [doneCount, setDoneCount] = useState(0)
  const [allDone, setAllDone] = useState(false)

  // Light/Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theory_theme')
    return saved !== 'light'
  })

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const next = !prev
      localStorage.setItem('theory_theme', next ? 'dark' : 'light')
      return next
    })
  }

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

  const flashcards = (classTheoryCards && classTheoryCards.length > 0)
    ? classTheoryCards
    : (getProjectFlashcards(projectName) || DEFAULT_FLASHCARDS)
  const total = flashcards ? flashcards.length : 0
  const card = (flashcards && flashcards[currentIdx]) || DEFAULT_FLASHCARDS[0]


  useEffect(() => {
    if (doneCount >= total && total > 0) {
      setAllDone(true)
      markAdventureStepComplete({
        classId,
        projectSlug: projectName,
        stepKey: 'read',
        stepOrder: 1,
      }).catch(() => {})
      awardXP?.(25, 'Briefing reviewed! 📖')
    }
  }, [doneCount, total, projectName, classId, awardXP])

  const handleNext = () => {
    setDoneCount(d => Math.max(d, currentIdx + 1))
    if (currentIdx + 1 >= total) {
      setAllDone(true)
      return
    }
    setCurrentIdx(n => n + 1)
  }

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(n => n - 1)
    }
  }

  if (loading) {
    return (
      <div style={{
        height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', background: '#0b1329', color: '#fff'
      }}>
        <div style={{ fontSize: 48, animation: 'spin 2s linear infinite' }}>⏳</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 16 }}>Deploying Tutorial Briefing...</div>
      </div>
    )
  }

  if (!project) {
    return (
      <div style={{
        height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', background: '#0b1329', color: '#fff',
        padding: 24, textAlign: 'center'
      }}>
        <ShieldAlert size={64} color="#f43f5e" style={{ marginBottom: 16 }} />
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Mission Coordinates Lost</div>
        <div style={{ color: '#94a3b8', marginBottom: 24 }}>We couldn't map the project details for: {projectName}</div>
        <button onClick={goBackToMap} style={{
          padding: '12px 24px', borderRadius: 14, border: 'none', background: color, color: '#fff', fontWeight: 800, cursor: 'pointer'
        }}>
          Return to World Map
        </button>
      </div>
    )
  }

  if (allDone) {
    return (
      <div style={{
        height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: isDarkMode 
          ? 'radial-gradient(circle at top, #0f172a 0%, #020617 100%)' 
          : 'radial-gradient(circle at top, #f8fafc 0%, #e2e8f0 100%)',
        color: isDarkMode ? '#fff' : '#0f172a', padding: 24, textAlign: 'center', fontFamily: "'Inter', sans-serif"
      }}>
        <style>{`
          @keyframes bounceUp {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
        `}</style>
        <div style={{ fontSize: 72, animation: 'bounceUp 2.5s ease-in-out infinite' }}>🎉</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: '#10b981', marginTop: 16, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Mission Briefing Complete!
        </div>
        <p style={{ color: isDarkMode ? '#94a3b8' : '#475569', fontSize: 15, maxWidth: 460, margin: '12px auto 32px', lineHeight: 1.6 }}>
          Excellent work, cadet! You have successfully reviewed all {total} learning objectives for <strong>{project.title}</strong>. You are now authorized to proceed to the Quiz Level.
        </p>
        <button onClick={goBackToMap} style={{
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: '#fff', fontWeight: 900, fontSize: 14,
          padding: '16px 36px', borderRadius: 20, border: 'none',
          boxShadow: '0 8px 24px rgba(16,185,129,0.4)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s'
        }}>
          <span>Return to World Map</span>
          <ArrowRight size={16} strokeWidth={2.5} />
        </button>
      </div>
    )
  }

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      background: isDarkMode
        ? 'radial-gradient(circle at top left, #0f172a 0%, #020617 100%)'
        : 'radial-gradient(circle at top left, #f8fafc 0%, #e2e8f0 100%)',
      color: isDarkMode ? '#fff' : '#1e293b',
      fontFamily: "'Inter', system-ui, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'background 0.3s ease, color 0.3s ease',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        
        @keyframes floatEffect {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(1deg); }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.45; }
        }
        .tutorial-glow {
          position: absolute;
          width: 300px;
          height: 300px;
          border-radius: 50%;
          filter: blur(120px);
          pointer-events: none;
          z-index: 1;
          animation: glowPulse 4s ease-in-out infinite;
        }
      `}</style>

      {/* Decorative background glows */}
      {isDarkMode && (
        <>
          <div className="tutorial-glow" style={{ background: color, top: '-50px', left: '-50px' }} />
          <div className="tutorial-glow" style={{ background: '#4f46e5', bottom: '-50px', right: '-50px' }} />
        </>
      )}

      {/* ── TOP NAV HEADER ────────────────────────────────────────────────── */}
      <header style={{
        height: 64,
        borderBottom: isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(15, 23, 42, 0.08)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        zIndex: 10,
        background: isDarkMode ? 'rgba(15, 23, 42, 0.3)' : 'rgba(255, 255, 255, 0.65)',
        backdropFilter: 'blur(12px)',
        transition: 'background 0.3s ease, border-bottom 0.3s ease',
      }}>
        <button
          onClick={goBackToMap}
          style={{
            background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(15, 23, 42, 0.05)',
            border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(15, 23, 42, 0.1)',
            borderRadius: 12, padding: '8px 16px',
            color: isDarkMode ? '#94a3b8' : '#475569', fontSize: 12, fontWeight: 800,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all 0.2s',
          }}
        >
          <ArrowLeft size={14} strokeWidth={2.5} />
          <span>Exit Map</span>
        </button>

        <div style={{ margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
            <span style={{
              background: isDarkMode ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)',
              color: isDarkMode ? '#818cf8' : '#4f46e5',
              fontSize: 10, fontWeight: 900, borderRadius: 8, padding: '3px 8px',
              textTransform: 'uppercase', letterSpacing: '0.04em'
            }}>
              Quest Briefing
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: isDarkMode ? '#f8fafc' : '#0f172a' }}>{project.title}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Docs Button */}
          <a
            href="https://openhw-studio.fossee.in/docs/"
            target="_blank"
            rel="noreferrer"
            style={{
              height: 38, borderRadius: 12, padding: '0 16px',
              background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(15, 23, 42, 0.05)',
              border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(15, 23, 42, 0.1)',
              color: isDarkMode ? '#94a3b8' : '#475569',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 800, textDecoration: 'none',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            <FileText size={14} strokeWidth={2.5} />
            <span>Docs</span>
          </a>

          {/* Sign Out Button */}
          <button
            onClick={handleLogout}
            style={{
              height: 38, borderRadius: 12, padding: '0 16px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#dc2626',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 800,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            <LogOut size={14} strokeWidth={2.5} />
            <span>Sign Out</span>
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            style={{
              width: 38, height: 38, borderRadius: '50%',
              background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(15, 23, 42, 0.05)',
              border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(15, 23, 42, 0.1)',
              color: isDarkMode ? '#fbbf24' : '#6366f1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? <Sun size={16} strokeWidth={2.5} fill="#fbbf24" /> : <Moon size={16} strokeWidth={2.5} />}
          </button>

          {/* Level Counter Indicator */}
          <div style={{
            background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(15, 23, 42, 0.05)',
            borderRadius: 12, border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15, 23, 42, 0.08)',
            padding: '8px 14px',
            fontSize: 12, fontWeight: 800, color: isDarkMode ? '#38bdf8' : '#0284c7',
            transition: 'all 0.3s ease',
          }}>
            Goal {currentIdx + 1}/{total}
          </div>
        </div>
      </header>

      {/* Progress timeline bar */}
      <div style={{ height: 4, background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(15, 23, 42, 0.05)', width: '100%', zIndex: 10 }}>
        <div style={{
          height: '100%', background: `linear-gradient(90deg, ${color}, #3b82f6)`,
          width: `${((currentIdx + 1) / total) * 100}%`, transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }} />
      </div>

      {/* ── MAIN WORKSPACE CONTENT ────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        display: 'flex',
        zIndex: 5,
        position: 'relative',
      }}>
        {/* Left Side: Immersive schematic/concept preview card */}
        <div style={{
          flex: 1,
          borderRight: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15, 23, 42, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: isDarkMode ? 'rgba(15, 23, 42, 0.15)' : 'rgba(255, 255, 255, 0.25)',
          padding: 40,
          transition: 'background 0.3s ease, border-right 0.3s ease',
        }}>
          <div style={{
            width: '100%', maxWidth: 360, aspectRatio: '1',
            borderRadius: 32,
            background: isDarkMode 
              ? `linear-gradient(135deg, ${color}20 0%, rgba(15, 23, 42, 0.6) 100%)`
              : `linear-gradient(135deg, ${color}12 0%, rgba(255, 255, 255, 0.85) 100%)`,
            border: isDarkMode ? `1.5px solid ${color}35` : `1.5px solid ${color}22`,
            boxShadow: isDarkMode 
              ? `0 24px 60px rgba(0,0,0,0.35), inset 0 4px 30px ${color}10`
              : `0 24px 60px rgba(15, 23, 42, 0.08), inset 0 4px 30px ${color}05`,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            position: 'relative',
            animation: 'floatEffect 5s ease-in-out infinite',
            transition: 'background 0.3s ease, border 0.3s ease, box-shadow 0.3s ease',
          }}>
            {/* Holographic background ripples */}
            <div style={{
              position: 'absolute', inset: 24, borderRadius: 24,
              border: isDarkMode ? '1px dashed rgba(255,255,255,0.1)' : '1px dashed rgba(15, 23, 42, 0.1)',
            }} />
            <div style={{ fontSize: 110, zIndex: 2, filter: 'drop-shadow(0 16px 24px rgba(0,0,0,0.15))' }}>
              {card.emoji || '💡'}
            </div>
            
            <div style={{
              position: 'absolute', bottom: 24,
              background: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15, 23, 42, 0.05)', 
              borderRadius: 12,
              padding: '6px 14px', 
              border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15, 23, 42, 0.08)',
              fontSize: 11, fontWeight: 800, color: isDarkMode ? '#f8fafc' : '#0f172a',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              transition: 'all 0.3s ease',
            }}>
              OBJECTIVE SCHEMATIC
            </div>
          </div>
        </div>

        {/* Right Side: Sleek tutorial mission guide details */}
        <div style={{
          flex: 1.2,
          padding: '48px 60px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}>
          {/* Mission header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Sparkles size={16} color="#fbbf24" fill="#fbbf24" />
            <span style={{ fontSize: 11, fontWeight: 900, color: color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              LEARNING MISSION #{currentIdx + 1}
            </span>
          </div>

          <h1 style={{
            margin: '0 0 16px', fontSize: 32, fontWeight: 900,
            color: isDarkMode ? '#f8fafc' : '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.2,
            transition: 'color 0.3s ease',
          }}>
            {card.front}
          </h1>

          <p style={{
            margin: '0 0 32px', fontSize: 16, color: isDarkMode ? '#94a3b8' : '#475569',
            lineHeight: 1.6, fontWeight: 500,
            transition: 'color 0.3s ease',
          }}>
            {card.simple}
          </p>

          {/* Section details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 36 }}>
            {/* How it works */}
            <div style={{
              background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.65)',
              border: isDarkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(15, 23, 42, 0.08)',
              boxShadow: isDarkMode ? 'none' : '0 4px 20px rgba(15, 23, 42, 0.02)',
              borderRadius: 20, padding: '18px 24px',
              transition: 'all 0.3s ease',
            }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: isDarkMode ? '#38bdf8' : '#0284c7', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                🔧 HOW IT WORKS
              </div>
              <div style={{ 
                fontSize: 14, 
                color: isDarkMode ? '#cbd5e1' : '#334155', 
                lineHeight: 1.7, 
                whiteSpace: 'pre-line', 
                fontFamily: 'monospace',
                transition: 'color 0.3s ease',
              }}>
                {card.detail}
              </div>
            </div>

            {/* Pro Tip/Fun Fact */}
            <div style={{
              background: isDarkMode 
                ? 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(245,158,11,0.02))'
                : 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(251,191,36,0.03))',
              border: isDarkMode ? '1px solid rgba(251,191,36,0.15)' : '1px solid rgba(251,191,36,0.25)',
              borderRadius: 20, padding: '18px 24px',
              transition: 'all 0.3s ease',
            }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: isDarkMode ? '#fbbf24' : '#854d0e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Award size={14} /> PRO MISSION INTEL
              </div>
              <div style={{ 
                fontSize: 13.5, 
                color: isDarkMode ? '#fef08a' : '#713f12', 
                lineHeight: 1.65, 
                fontWeight: 500,
                transition: 'color 0.3s ease',
              }}>
                {card.funFact}
              </div>
            </div>
          </div>

          {/* Footer Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
            <button
              onClick={handlePrev}
              disabled={currentIdx === 0}
              style={{
                background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255, 255, 255, 0.85)',
                border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15, 23, 42, 0.08)',
                color: currentIdx === 0 ? '#475569' : (isDarkMode ? '#cbd5e1' : '#475569'),
                padding: '14px 28px', borderRadius: 16,
                fontWeight: 800, fontSize: 13,
                cursor: currentIdx === 0 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
                boxShadow: isDarkMode ? 'none' : '0 2px 10px rgba(0,0,0,0.04)',
              }}
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>

            <button
              onClick={handleNext}
              style={{
                background: `linear-gradient(135deg, ${color}, #4f46e5)`,
                color: '#fff',
                padding: '14px 36px', borderRadius: 16, border: 'none',
                fontWeight: 900, fontSize: 13.5,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: `0 6px 20px rgba(99,102,241,0.3)`
              }}
            >
              <span>{currentIdx + 1 >= total ? 'Complete Briefing' : 'Next Objective'}</span>
              <ArrowRight size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}