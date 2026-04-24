import { useState, useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useGamification } from '../context/GamificationContext'
import { PROJECTS } from '../services/gamification/ProjectsConfig'
import { getUnlockComponents } from '../services/gamification/ProjectData'
import { getResolvedClassAdventure } from '../services/classAdventureService'
import { getProjectContentBySlug } from '../services/classAdventureAdapter'

export default function ProjectComponentUnlockPage() {
  const { projectName } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const classId = new URLSearchParams(location.search).get('classId')
  const mapPath = classId ? `/adventure?classId=${encodeURIComponent(classId)}` : '/adventure'
  const [classRewardComponents, setClassRewardComponents] = useState(null)
  const { theme = 'dark' } = useGamification()

  const project = PROJECTS.find(p => p.slug === projectName)
  const color = project?.color || '#3b82f6'

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!classId) {
        setClassRewardComponents(null)
        return
      }
      try {
        const response = await getResolvedClassAdventure(classId)
        if (cancelled) return
        const projectContent = getProjectContentBySlug(response?.resolved, projectName)
        setClassRewardComponents(Array.isArray(projectContent?.rewardComponents) && projectContent.rewardComponents.length ? projectContent.rewardComponents : null)
      } catch {
        if (!cancelled) setClassRewardComponents(null)
      }
    }
    load()
    return () => { cancelled = true }
  }, [classId, projectName])

  const components = classRewardComponents || getUnlockComponents(projectName)
  const total = components.length

  const [unlockedComponents, setUnlockedComponents] = useState(new Set())
  const [allUnlocked, setAllUnlocked] = useState(false)

  useEffect(() => {
    if (unlockedComponents.size >= total) {
      setAllUnlocked(true)
      if (window.markAdventureStepComplete) {
        window.markAdventureStepComplete(projectName, 'unlock', 3)
      }
    }
  }, [unlockedComponents, total, projectName])

   const handleUnlock = (index) => {
     if (!unlockedComponents.has(index)) {
       setUnlockedComponents(prev => new Set([...prev, index]))
     }
   }

   const handleUnlockAll = () => {
     const allIndices = new Set(components.map((_, i) => i))
     setUnlockedComponents(allIndices)
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

  if (allUnlocked) {
    return (
      <div className="gamification-page completion-screen" style={{ background: theme === 'dark' ? 'linear-gradient(160deg,#080e1e 0%,#0c1528 55%,#07101f 100%)' : 'linear-gradient(160deg,#f0f4ff 0%,#e8edf8 55%,#f0f4ff 100%)', color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap');
        `}</style>
        <div className="completion-icon">🎉</div>
        <div className="completion-title" style={{ color: '#34d399', marginBottom: 8 }}>
          All Unlocked!
        </div>
        <div className="completion-subtitle" style={{ color: theme === 'dark' ? '#64748b' : '#94a3b8', marginBottom: 24 }}>
          You earned all {total} new components!
        </div>
        
        <div className="component-unlock-list" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
          {components.map((comp, i) => (
            <div key={i} className="component-unlock-item" style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              background: `linear-gradient(145deg,${comp.color}22,${comp.color}11)`,
              border: `1px solid ${comp.color}44`,
              borderRadius: 8,
            }}>
              <span style={{ fontSize: 20 }}>{comp.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: theme === 'dark' ? '#f0f4ff' : '#0f172a' }}>{comp.name}</span>
            </div>
          ))}
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
              🎁 {project.title}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: theme === 'dark' ? '#f0f4ff' : '#0f172a' }}>Component Unlock</div>
          </div>
          <div style={{ fontSize: 13, color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>
            {unlockedComponents.size}/{total} unlocked
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
            <div style={{ fontSize: 14, color: theme === 'dark' ? '#94a3b8' : '#64748b', marginBottom: 8 }}>
              {unlockedComponents.size} of {total} components unlocked
            </div>
            <div className="progress-bar-track" style={{ background: theme === 'dark' ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.08)', height: 6, borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 99, width: `${(unlockedComponents.size / total) * 100}%`, background: color, transition: 'width .4s ease' }} />
            </div>
          </div>

          <div className="component-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {components.map((comp, index) => {
              const isUnlocked = unlockedComponents.has(index)
              return (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: 16,
                    background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                    borderRadius: 12,
                    border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                    opacity: isUnlocked ? 1 : 0.7,
                  }}
                >
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    background: isUnlocked ? comp.color : (theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 28,
                    flexShrink: 0,
                  }}>
                    {isUnlocked ? comp.icon : '🔒'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: theme === 'dark' ? '#f0f4ff' : '#0f172a', marginBottom: 2 }}>
                      {comp.name}
                    </div>
                     <div style={{ fontSize: 13, color: theme === 'dark' ? '#94a3b8' : '#64748b', lineHeight: 1.4 }}>
                       {comp.desc}
                     </div>
                  </div>
                  {!isUnlocked && (
                    <button
                      onClick={() => handleUnlock(index)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        border: 'none',
                        background: `linear-gradient(135deg, ${comp.color}, ${comp.color}cc)`,
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      Unlock
                    </button>
                  )}
                  {isUnlocked && (
                    <div style={{
                      padding: '8px 16px',
                      borderRadius: 8,
                      background: 'rgba(34,197,94,0.15)',
                      color: '#22c55e',
                      fontWeight: 700,
                      fontSize: 13,
                    }}>
                      Unlocked
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {unlockedComponents.size < total && (
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button
                onClick={handleUnlockAll}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Unlock All ({total - unlockedComponents.size} remaining)
              </button>
            </div>
          )}

          {allUnlocked && (
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button onClick={() => navigate(mapPath)} className="btn-secondary-gradient" style={{
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

