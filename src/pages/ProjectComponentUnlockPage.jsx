import { useState, useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useGamification } from '../context/GamificationContext'
import { PROJECTS } from '../services/gamification/ProjectsConfig'
import { getUnlockComponents } from '../services/gamification/ProjectData'
import { saveClassAdventureUnlocks } from '../services/gamification/unlockService'
import {
  getAdventureProjectContent,
  markAdventureStepComplete,
  toProjectDisplayMeta,
} from '../services/adventureService'
import { useAuth } from '../context/AuthContext'
import { ArrowLeft, ArrowRight, ShieldAlert, Sparkles, Check, Lock, Sun, Moon, Gift, FileText, LogOut } from 'lucide-react'

export default function ProjectComponentUnlockPage() {
  const { projectName } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const handleLogout = () => {
    logout()
    navigate('/')
  }
  const classId = new URLSearchParams(location.search).get('classId')
  const mapPath = classId ? `/adventure?classId=${encodeURIComponent(classId)}` : '/adventure'
  const { unlockComponentTypes } = useGamification()

  const baseProject = PROJECTS.find(p => p.slug === projectName)
  const [customProject, setCustomProject] = useState(null)
  const [classRewardComponents, setClassRewardComponents] = useState(null)
  const [loadingContent, setLoadingContent] = useState(() => !baseProject)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!baseProject) setLoadingContent(true)
      try {
        const { project: projectContent } = await getAdventureProjectContent(classId, projectName)
        if (cancelled) return
        if (!baseProject) {
          setCustomProject(toProjectDisplayMeta(projectContent))
        }
        setClassRewardComponents(
          Array.isArray(projectContent?.rewardComponents) && projectContent.rewardComponents.length
            ? projectContent.rewardComponents
            : null,
        )
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load project unlock content:', err)
        if (!baseProject) setCustomProject(null)
        setClassRewardComponents(null)
      } finally {
        if (!cancelled) setLoadingContent(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [classId, projectName, baseProject])

  const project = baseProject || customProject
  const loading = loadingContent && !baseProject
  const color = project?.color || '#6366f1'

  const components = classRewardComponents || getUnlockComponents(projectName)
  const total = components.length

  const [unlockedComponents, setUnlockedComponents] = useState(new Set())
  const [allUnlocked, setAllUnlocked] = useState(false)

  // Light/Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('unlock_theme')
    return saved !== 'light'
  })

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const next = !prev
      localStorage.setItem('unlock_theme', next ? 'dark' : 'light')
      return next
    })
  }

  useEffect(() => {
    if (unlockedComponents.size >= total && total > 0) {
      setAllUnlocked(true)
      markAdventureStepComplete({
        classId,
        projectSlug: projectName,
        stepKey: 'unlock',
        stepOrder: 3,
      }).catch(() => {})
    }
  }, [unlockedComponents, total, projectName, classId])

  const handleUnlock = async (index) => {
    if (!unlockedComponents.has(index)) {
      setUnlockedComponents(prev => new Set([...prev, index]))

      const component = components[index]
      if (component && component.type) {
        const canonicalType = component.type

        setIsSaving(true)
        try {
          if (classId) {
            await saveClassAdventureUnlocks(classId, [canonicalType])
          }
          await unlockComponentTypes([canonicalType])
        } catch (error) {
          console.error('Failed to unlock component type:', error)
          setUnlockedComponents(prev => new Set([...prev].filter((_, i) => i !== index)))
        } finally {
          setIsSaving(false)
        }
      }
    }
  }

  const handleUnlockAll = async () => {
    const allIndices = new Set(components.map((_, i) => i))
    setUnlockedComponents(allIndices)

    const canonicalTypes = components
      .filter(comp => comp && comp.type)
      .map(comp => comp.type)
      .filter(Boolean)

    if (canonicalTypes.length > 0) {
      setIsSaving(true)
      try {
        if (classId) {
          await saveClassAdventureUnlocks(classId, canonicalTypes)
        }
        await unlockComponentTypes(canonicalTypes)
      } catch (error) {
        console.error('Failed to unlock component types:', error)
        setUnlockedComponents(new Set())
      } finally {
        setIsSaving(false)
      }
    }
  }

  if (loading) {
    return (
      <div style={{
        height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', background: '#0b1329', color: '#fff'
      }}>
        <div style={{ fontSize: 48, animation: 'spin 2s linear infinite' }}>⏳</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 16 }}>Loading Vault coordinates...</div>
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
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Vault Locked</div>
        <div style={{ color: '#94a3b8', marginBottom: 24 }}>We couldn't load the reward information for: {projectName}</div>
        <button onClick={() => navigate(mapPath)} style={{
          padding: '12px 24px', borderRadius: 14, border: 'none', background: color, color: '#fff', fontWeight: 800, cursor: 'pointer'
        }}>
          Return to World Map
        </button>
      </div>
    )
  }

  if (allUnlocked) {
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
          Components Acquired!
        </div>
        <p style={{ color: isDarkMode ? '#94a3b8' : '#475569', fontSize: 15, maxWidth: 460, margin: '12px auto 32px', lineHeight: 1.6 }}>
          Fantastic work, cadet! You have successfully unlocked all {total} reward items for <strong>{project.title}</strong>. They have been added to your profile inventory.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginBottom: 36, maxWidth: 500 }}>
          {components.map((comp, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
              background: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.85)',
              border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(15, 23, 42, 0.08)',
              borderRadius: 16,
              boxShadow: isDarkMode ? 'none' : '0 4px 12px rgba(0,0,0,0.02)'
            }}>
              <span style={{ fontSize: 22 }}>{comp.icon || '📦'}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: isDarkMode ? '#f8fafc' : '#0f172a' }}>{comp.name}</span>
            </div>
          ))}
        </div>

        <button onClick={() => navigate(mapPath)} style={{
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
        
        @keyframes glowPulse {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.35; }
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
        .comp-card {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 20px 24px;
          border-radius: 24px;
          border: 1.5px solid;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .comp-card:hover {
          transform: translateY(-2px);
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
          onClick={() => navigate(mapPath)}
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
              Vault Claim
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

          {/* Level Progress Indicator */}
          <div style={{
            background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(15, 23, 42, 0.05)',
            borderRadius: 12, border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15, 23, 42, 0.08)',
            padding: '8px 14px',
            fontSize: 12, fontWeight: 800, color: isDarkMode ? '#38bdf8' : '#0284c7',
            transition: 'all 0.3s ease',
          }}>
            Unlocked: {unlockedComponents.size} / {total}
          </div>
        </div>
      </header>

      {/* Progress timeline bar */}
      <div style={{ height: 4, background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(15, 23, 42, 0.05)', width: '100%', zIndex: 10 }}>
        <div style={{
          height: '100%', background: `linear-gradient(90deg, ${color}, #3b82f6)`,
          width: `${total ? (unlockedComponents.size / total) * 100 : 0}%`, transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }} />
      </div>

      {/* ── MAIN WORKSPACE CONTENT ────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5,
        position: 'relative',
        padding: '24px 20px',
        overflowY: 'auto'
      }}>
        {/* Centered elevated glassmorphic vault card */}
        <div style={{
          width: '100%',
          maxWidth: 680,
          background: isDarkMode ? 'rgba(15, 23, 42, 0.45)' : 'rgba(255, 255, 255, 0.55)',
          border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(15, 23, 42, 0.08)',
          boxShadow: isDarkMode ? '0 30px 70px rgba(0,0,0,0.35)' : '0 24px 60px rgba(15, 23, 42, 0.05)',
          borderRadius: 32,
          backdropFilter: 'blur(20px) saturate(190%)',
          padding: '40px 48px',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.3s ease',
        }}>
          {/* Header section inside card */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              background: 'rgba(99, 102, 241, 0.1)',
              borderRadius: '50%',
              width: 64, height: 64,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px',
            }}>
              <Gift size={32} color={color} />
            </div>
            <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 900, color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
              Claim New Components!
            </h2>
            <p style={{ margin: 0, fontSize: 13.5, color: isDarkMode ? '#94a3b8' : '#64748b', fontWeight: 500 }}>
              Add these newly unlocked hardware elements to your inventory toolbox.
            </p>
          </div>

          {/* Component Inventory Cards List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
            {components.map((comp, index) => {
              const isUnlocked = unlockedComponents.has(index)
              
              let borderCol = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)'
              let bgCol = isDarkMode ? 'rgba(255, 255, 255, 0.01)' : 'rgba(255, 255, 255, 0.45)'
              let iconBg = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(15, 23, 42, 0.04)'

              if (isUnlocked) {
                borderCol = `${comp.color || color}44`
                bgCol = isDarkMode ? `${comp.color || color}0b` : `${comp.color || color}06`
                iconBg = comp.color || color
              }

              return (
                <div
                  key={index}
                  className="comp-card"
                  style={{
                    background: bgCol,
                    borderColor: borderCol,
                    boxShadow: isDarkMode ? 'none' : '0 2px 10px rgba(0,0,0,0.01)',
                    opacity: isUnlocked ? 1 : 0.75,
                  }}
                >
                  {/* Icon Block */}
                  <div style={{
                    width: 56, height: 56, borderRadius: 16,
                    background: iconBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 26, flexShrink: 0,
                    boxShadow: isUnlocked ? '0 8px 20px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.25s',
                  }}>
                    {isUnlocked ? (comp.icon || '📦') : <Lock size={20} color={isDarkMode ? '#64748b' : '#94a3b8'} />}
                  </div>

                  {/* Info details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 800, color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                      {comp.name}
                    </h3>
                    <p style={{ margin: 0, fontSize: 12.5, color: isDarkMode ? '#94a3b8' : '#64748b', lineHeight: 1.45 }}>
                      {comp.desc || comp.description || `Special unlocked part for ${project.title}`}
                    </p>
                  </div>

                  {/* Actions button */}
                  {!isUnlocked ? (
                    <button
                      disabled={isSaving}
                      onClick={() => handleUnlock(index)}
                      style={{
                        padding: '10px 20px', borderRadius: 12, border: 'none',
                        background: isSaving
                          ? 'rgba(15, 23, 42, 0.15)'
                          : `linear-gradient(135deg, ${comp.color || color}, #4f46e5)`,
                        color: '#fff', fontWeight: 800, fontSize: 13,
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                        boxShadow: `0 4px 14px rgba(99,102,241,0.2)`,
                        transition: 'all 0.2s',
                      }}
                    >
                      {isSaving ? 'Claiming...' : 'Claim Part'}
                    </button>
                  ) : (
                    <div style={{
                      padding: '10px 18px', borderRadius: 12,
                      background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)',
                      color: '#10b981', fontWeight: 800, fontSize: 12,
                      display: 'flex', alignItems: 'center', gap: 4
                    }}>
                      <Check size={14} strokeWidth={2.5} /> Unlocked
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer actions block */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15, 23, 42, 0.08)', paddingTop: 24 }}>
            {unlockedComponents.size < total ? (
              <button
                disabled={isSaving}
                onClick={handleUnlockAll}
                style={{
                  width: '100%',
                  padding: '14px 0', borderRadius: 16, border: 'none',
                  background: isSaving ? 'rgba(15, 23, 42, 0.08)' : `linear-gradient(135deg, ${color}, #4f46e5)`,
                  color: isSaving ? '#94a3b8' : '#fff', fontWeight: 900, fontSize: 13.5,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  boxShadow: `0 6px 18px rgba(99,102,241,0.25)`,
                  transition: 'all 0.2s',
                }}
              >
                {isSaving ? 'Acquiring Vault...' : `Claim All Unlocked Parts`}
              </button>
            ) : (
              <button
                onClick={() => navigate(mapPath)}
                style={{
                  width: '100%',
                  padding: '14px 0', borderRadius: 16, border: 'none',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#fff', fontWeight: 900, fontSize: 13.5,
                  cursor: 'pointer',
                  boxShadow: '0 6px 18px rgba(16,185,129,0.25)',
                  transition: 'all 0.2s',
                }}
              >
                ← Return to World Map
              </button>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}
