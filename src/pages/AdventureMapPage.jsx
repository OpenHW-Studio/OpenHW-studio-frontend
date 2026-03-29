
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGamification } from '../context/GamificationContext'
import { PROJECTS, getProjectStatus, getProjectRewardComponents } from '../services/gamification/ProjectsConfig'

// ─── World groupings ────────────────────────────────────────────────────────
const WORLDS = [
  { id: 1, name: 'Circuit Basics',      theme: 'Beginner',     color: '#22c55e', bg: 'rgba(34,197,94,0.06)',   border: 'rgba(34,197,94,0.18)',  icon: '⚡', slugs: ['led-blink','rgb-led','buzzer','potentiometer','ldr'] },
  { id: 2, name: 'Signal Control',      theme: 'Intermediate', color: '#3b82f6', bg: 'rgba(59,130,246,0.06)',  border: 'rgba(59,130,246,0.18)', icon: '🎮', slugs: ['servo-motor','led-strip','button-debounce','temperature-sensor'] },
  { id: 3, name: 'Machines & Sensors',  theme: 'Advanced',     color: '#f97316', bg: 'rgba(249,115,22,0.06)',  border: 'rgba(249,115,22,0.18)', icon: '🤖', slugs: ['dc-motor'] },
]

// Winding x-positions
const PATH_X = [50, 75, 50, 25, 50, 75, 50, 25, 50, 75]

// ─── Styles ─────────────────────────────────────────────────────────────────
const css = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #08101f 0%, #060c18 60%, #08101f 100%)',
    fontFamily: "'Nunito', 'Rajdhani', system-ui, sans-serif",
    color: '#e2e8f0',
    overflowX: 'hidden',
  },
  header: {
    position: 'sticky', top: 0, zIndex: 100,
    background: 'rgba(8,16,31,0.95)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    padding: '0 20px',
  },
  headerInner: {
    maxWidth: 900, margin: '0 auto',
    display: 'flex', alignItems: 'center', gap: 16,
    height: 60,
  },
  backBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '6px 14px',
    color: '#94a3b8', cursor: 'pointer',
    fontSize: 13, fontWeight: 700,
    fontFamily: 'inherit', transition: 'all .15s',
  },
  logoText: {
    fontSize: 17, fontWeight: 900,
    background: 'linear-gradient(90deg, #34d399, #3b82f6)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
  },
  xpSection: {
    marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10,
  },
  xpBarWrap: { width: 100 },
  xpMeta: {
    display: 'flex', justifyContent: 'space-between',
    fontSize: 10, color: '#475569', marginBottom: 3,
  },
  xpBarTrack: { height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  xpBarFill: { height: '100%', borderRadius: 99, transition: 'width .6s ease' },
  lvlBadge: {
    width: 34, height: 34, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 900,
    border: '2px solid', flexShrink: 0,
  },
  mapContainer: {
    maxWidth: 700, margin: '0 auto',
    padding: '12px 20px 120px',
  },
  worldLabel: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 18px', borderRadius: 10, marginBottom: 8,
    fontSize: 13, fontWeight: 700,
  },
  progressPanel: {
    position: 'fixed', bottom: 16, left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(8,16,31,0.97)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16, padding: '10px 20px',
    display: 'flex', alignItems: 'center', gap: 16,
    zIndex: 200,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  progressStat: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
  },
  progressNum: { fontSize: 20, fontWeight: 900, lineHeight: 1 },
  progressLabel: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em' },
  progressDivider: { width: 1, height: 32, background: 'rgba(255,255,255,0.06)' },
}

// ─── Reward Preview ──────────────────────────────────────────────────────────
function RewardPreview({ rewards }) {
  if (!rewards || rewards.length === 0) return null
  return (
    <div style={{
      marginBottom: 16,
      background: 'rgba(52,211,153,0.07)',
      border: '1px solid rgba(52,211,153,0.2)',
      borderRadius: 12, padding: '12px 14px',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 800, color: '#34d399',
        textTransform: 'uppercase', letterSpacing: '.07em',
        marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5,
      }}>
        🎁 Complete this project to unlock:
      </div>
      {rewards.map((r, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '8px 10px', borderRadius: 8,
          background: 'rgba(52,211,153,0.05)',
          marginBottom: i < rewards.length - 1 ? 6 : 0,
        }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>{r.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#f0f4ff' }}>{r.name}</div>
            <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>{r.description}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Modal ─────────────────────────────────────────────────────────────────
function ProjectModal({ project, isCompleted, isAvailable, onClose, onStart }) {
  const rewards = getProjectRewardComponents(project.slug)
  const fullProject = PROJECTS.find(p => p.slug === project.slug)
  if (!project) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.78)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, backdropFilter: 'blur(6px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(155deg, #0e1628, #080f1e)',
          border: `1px solid ${project.color}44`,
          borderRadius: 20, padding: '28px 24px',
          maxWidth: 420, width: '100%',
          boxShadow: `0 0 60px ${project.color}22, 0 20px 60px rgba(0,0,0,0.7)`,
          position: 'relative',
          maxHeight: '90vh', overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 12, right: 12,
            background: 'rgba(255,255,255,0.07)', border: 'none',
            borderRadius: 8, width: 30, height: 30,
            color: '#64748b', cursor: 'pointer', fontSize: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >×</button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{
            fontSize: 54, marginBottom: 8,
            filter: isAvailable || isCompleted ? 'none' : 'grayscale(1) opacity(.35)',
          }}>{project.icon}</div>

          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
            color: project.color, marginBottom: 6,
          }}>
            {project.difficulty} · Project {project.number}
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#f0f4ff', marginBottom: 4 }}>
            {project.title}
          </div>
          <div style={{ fontSize: 13, color: '#64748b' }}>{project.subtitle}</div>
        </div>

        {/* Completed stars */}
        {isCompleted && (
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            {[1,2,3].map(i => (
              <span key={i} style={{ fontSize: 22, margin: '0 2px' }}>⭐</span>
            ))}
          </div>
        )}

        {/* Description */}
        <p style={{
          fontSize: 14, color: '#94a3b8', lineHeight: 1.65,
          textAlign: 'center', marginBottom: 16,
        }}>
          {fullProject?.description || project.description}
        </p>

        {/* Kid-friendly tip */}
        {fullProject?.kidFriendlyTip && (
          <div style={{
            background: 'rgba(59,130,246,0.07)',
            border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 10, padding: '10px 14px', marginBottom: 16,
            fontSize: 12, color: '#93c5fd', lineHeight: 1.5,
          }}>
            {fullProject.kidFriendlyTip}
          </div>
        )}

        {/* Concepts you'll learn */}
        {fullProject?.concepts && fullProject.concepts.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 7 }}>
              📚 You'll learn:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {fullProject.concepts.map((c, i) => (
                <span key={i} style={{
                  fontSize: 11, padding: '3px 9px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.05)', color: '#94a3b8',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}>{c}</span>
              ))}
            </div>
          </div>
        )}

        {/* XP reward */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 10,
          marginBottom: 16, flexWrap: 'wrap',
        }}>
          <span style={{
            padding: '5px 14px', borderRadius: 8,
            background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)',
            fontSize: 13, fontWeight: 700, color: '#fbbf24',
          }}>⚡ +{project.xpReward} XP</span>
          {isCompleted && (
            <span style={{
              padding: '5px 14px', borderRadius: 8,
              background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)',
              fontSize: 13, fontWeight: 700, color: '#34d399',
            }}>✓ Completed!</span>
          )}
        </div>

        {/* Reward components preview */}
        {!isCompleted && isAvailable && <RewardPreview rewards={rewards} />}
        {isCompleted && rewards.length > 0 && (
          <div style={{
            marginBottom: 16, padding: '10px 14px',
            background: 'rgba(52,211,153,0.05)',
            border: '1px solid rgba(52,211,153,0.15)',
            borderRadius: 10, fontSize: 12, color: '#34d399',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            ✅ Reward earned: {rewards.map(r => r.name).join(', ')}
          </div>
        )}

        {/* Action buttons */}
        {isAvailable || isCompleted ? (
          <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
            <button
              onClick={() => onStart(project.slug, 'guide')}
              style={{
                padding: '13px 0', borderRadius: 10, border: 'none',
                background: `linear-gradient(135deg, ${project.color}, ${project.color}cc)`,
                color: '#fff', fontWeight: 800, fontSize: 15,
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: `0 4px 20px ${project.color}44`,
                letterSpacing: '.04em',
              }}
            >
              {isCompleted ? '🔄 Play Again' : '🚀 Start Project!'}
            </button>
            <button
              onClick={() => onStart(project.slug, 'simulator')}
              style={{
                padding: '10px 0', borderRadius: 10,
                border: `1px solid ${project.color}33`,
                background: 'rgba(255,255,255,0.04)',
                color: '#94a3b8', fontWeight: 600, fontSize: 13,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              🔌 Open Simulator Only
            </button>
          </div>
        ) : (
          <div style={{
            padding: '16px', borderRadius: 12,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>🔒</div>
            <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.5 }}>
              Complete <strong style={{ color: '#94a3b8' }}>
                {PROJECTS.find(p => p.slug === fullProject?.prerequisite)?.title || 'the previous project'}
              </strong> first to unlock this one!
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Project Node ───────────────────────────────────────────────────────────
function ProjectNode({ project, status, onClick, isFirst, rewards }) {
  const isCompleted = status === 'completed'
  const isAvailable = status === 'available'
  const isLocked    = status === 'locked'

  const size = isAvailable ? 74 : isCompleted ? 68 : 58
  const glow = project.color + '55'

  return (
    <div
      onClick={() => !isLocked && onClick(project)}
      style={{
        width: size, height: size, borderRadius: '50%',
        border: `${isAvailable ? 3 : 2}px solid ${
          isCompleted ? project.color : isAvailable ? project.color : 'rgba(255,255,255,0.1)'
        }`,
        background: isCompleted
          ? `radial-gradient(circle, ${project.color}30, ${project.color}10)`
          : isAvailable
          ? `radial-gradient(circle, ${project.color}18, transparent)`
          : 'rgba(255,255,255,0.02)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: isLocked ? 'default' : 'pointer',
        transition: 'transform .2s, box-shadow .2s',
        position: 'relative',
        boxShadow: isAvailable
          ? `0 0 22px ${glow}, 0 0 6px ${glow}`
          : isCompleted ? `0 0 12px ${project.color}33` : 'none',
        animation: isAvailable ? 'nodePulse 2.2s ease-in-out infinite' : 'none',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        if (!isLocked) {
          e.currentTarget.style.transform = 'scale(1.12)'
          e.currentTarget.style.boxShadow = `0 0 30px ${glow}`
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'scale(1)'
        e.currentTarget.style.boxShadow = isAvailable
          ? `0 0 22px ${glow}, 0 0 6px ${glow}`
          : isCompleted ? `0 0 12px ${project.color}33` : 'none'
      }}
    >
      <span style={{
        fontSize: isAvailable ? 22 : isCompleted ? 20 : 16,
        filter: isLocked ? 'grayscale(1) opacity(.3)' : 'none',
        lineHeight: 1,
      }}>
        {isLocked ? '🔒' : project.icon}
      </span>
      {isCompleted && <span style={{ fontSize: 8, marginTop: 2 }}>⭐⭐⭐</span>}

      {/* Number badge */}
      <div style={{
        position: 'absolute', top: -7, right: -7,
        width: 19, height: 19, borderRadius: '50%',
        background: isCompleted ? project.color : isAvailable ? project.color : '#1a2540',
        border: `2px solid ${isCompleted || isAvailable ? project.color : 'rgba(255,255,255,0.08)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 8, fontWeight: 900, color: isCompleted || isAvailable ? '#fff' : '#334155',
      }}>
        {project.number}
      </div>

      {/* START label */}
      {isFirst && isAvailable && (
        <div style={{
          position: 'absolute', bottom: -22,
          background: project.color, color: '#fff',
          fontSize: 7, fontWeight: 900,
          padding: '2px 7px', borderRadius: 4,
          letterSpacing: '.1em', textTransform: 'uppercase',
          animation: 'nodePulse 2s ease-in-out infinite',
        }}>START</div>
      )}
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function AdventureMapPage() {
  const navigate = useNavigate()
  const {
    xp, currentLevel, currentLevelData, nextLevel, xpProgress,
    completedProjects = [],
  } = useGamification()

  const [selectedProject, setSelectedProject] = useState(null)

  const getStatus = (project) => getProjectStatus(project.slug, completedProjects)

  const handleNodeClick = (project) => setSelectedProject(project)

  const handleStart = (slug, mode) => {
    setSelectedProject(null)
    if (mode === 'guide') navigate(`/${slug}/guide`)
    else navigate(`/gamification-simulator/${slug}`)
  }

  const completedCount = completedProjects.length
  const totalProjects  = PROJECTS.length

  const worldGroups = WORLDS.map(w => ({
    ...w,
    projects: PROJECTS.filter(p => w.slugs.includes(p.slug)).sort((a, b) => a.number - b.number),
  }))

  return (
    <div style={css.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');

        @keyframes nodePulse {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.06); filter: brightness(1.2); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes starSpin {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.2); }
          100% { transform: rotate(360deg) scale(1); }
        }
      `}</style>

      {/* Header */}
      <header style={css.header}>
        <div style={css.headerInner}>
          <button style={css.backBtn} onClick={() => navigate(-1)}>← Back</button>
          <span style={css.logoText}>⚡ OpenHW Adventure</span>
          <div style={css.xpSection}>
            <div style={css.xpBarWrap}>
              <div style={css.xpMeta}>
                <span style={{ fontSize: 10, color: '#64748b' }}>{xp} XP</span>
                {nextLevel && <span style={{ fontSize: 10, color: '#64748b' }}>{nextLevel.xpRequired}</span>}
              </div>
              <div style={css.xpBarTrack}>
                <div style={{
                  ...css.xpBarFill,
                  width: `${xpProgress}%`,
                  background: `linear-gradient(90deg, ${currentLevelData?.color || '#34d399'}, ${currentLevelData?.color || '#34d399'}88)`,
                }} />
              </div>
            </div>
            <div style={{
              ...css.lvlBadge,
              background: `${currentLevelData?.color || '#34d399'}22`,
              borderColor: currentLevelData?.color || '#34d399',
              color: currentLevelData?.color || '#34d399',
            }}>
              {currentLevel}
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '32px 20px 6px', animation: 'fadeSlideUp .5s ease both' }}>
        <div style={{
          fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase',
          color: '#34d399', marginBottom: 10,
        }}>🗺️ Your Learning Journey</div>
        <h1 style={{
          fontSize: 30, fontWeight: 900, margin: '0 0 8px',
          background: 'linear-gradient(135deg, #e2e8f0 30%, #64748b)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          lineHeight: 1.2,
        }}>
          Adventure Map
        </h1>
        <p style={{ color: '#475569', fontSize: 14, margin: '0 auto 6px', maxWidth: 380, lineHeight: 1.6 }}>
          🎁 Start with LED + Resistor. Complete projects to earn more components.<br/>
          No quizzes — just build and learn!
        </p>

        {/* Starter kit reminder */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '7px 16px', borderRadius: 99, marginBottom: 4,
          background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
          fontSize: 12, color: '#60a5fa', fontWeight: 700,
        }}>
          🎒 Your Starter Kit: <strong>Arduino + LED + Resistor</strong>
        </div>
      </div>

      {/* Map */}
      <div style={css.mapContainer}>
        {worldGroups.map((world, wi) => {
          const allDone = world.projects.every(p => completedProjects.includes(p.slug))
          return (
            <div key={world.id} style={{ marginBottom: 10, animation: `fadeSlideUp .5s ease ${wi * 0.1}s both` }}>
              {/* World header */}
              <div style={{
                ...css.worldLabel,
                background: world.bg, border: `1px solid ${world.border}`, color: world.color,
              }}>
                <span style={{ fontSize: 18 }}>{world.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>World {world.id}: {world.name}</div>
                  <div style={{ fontSize: 11, opacity: .65, fontWeight: 600 }}>
                    {world.theme} · {world.projects.filter(p => completedProjects.includes(p.slug)).length}/{world.projects.length} done
                    {allDone && ' · 🏆 World Clear!'}
                  </div>
                </div>
              </div>

              {/* Nodes */}
              {world.projects.map((project, pi) => {
                const status     = getStatus(project)
                const globalIdx  = PROJECTS.indexOf(project)
                const xPct       = PATH_X[globalIdx] ?? 50
                const isFirst    = project.number === 1
                const rewards    = getProjectRewardComponents(project.slug)

                return (
                  <div key={project.slug}>
                    <div style={{
                      display: 'flex', alignItems: 'center',
                      justifyContent: xPct < 40 ? 'flex-start' : xPct > 60 ? 'flex-end' : 'center',
                      paddingLeft:  xPct < 40  ? `${xPct}%` : 0,
                      paddingRight: xPct > 60  ? `${100 - xPct}%` : 0,
                      minHeight: 96, position: 'relative',
                    }}>
                      {/* Connector line */}
                      {(pi > 0 || wi > 0) && (
                        <svg
                          style={{
                            position: 'absolute', top: 0, left: '50%',
                            transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 0,
                          }}
                          width="4" height="30"
                        >
                          <line
                            x1="2" y1="0" x2="2" y2="30"
                            stroke={status === 'locked' ? 'rgba(255,255,255,0.07)' : `${project.color}55`}
                            strokeWidth="2" strokeDasharray="4 3"
                          />
                        </svg>
                      )}

                      {/* Label */}
                      <div style={{
                        position: 'absolute',
                        [xPct >= 50 ? 'right' : 'left']: 'calc(50% + 44px)',
                        top: '50%', transform: 'translateY(-50%)',
                        maxWidth: 140,
                      }}>
                        <div style={{
                          fontSize: 13, fontWeight: 800,
                          color: status === 'locked' ? '#2d3f5e' : status === 'completed' ? project.color : '#e2e8f0',
                          lineHeight: 1.2, marginBottom: 2,
                        }}>
                          {project.title}
                        </div>
                        <div style={{ fontSize: 11, color: '#3d5070', marginBottom: 3 }}>
                          {status === 'completed' ? '✓ Done · ' : ''}⚡{project.xpReward}
                        </div>
                        {/* Reward preview chip */}
                        {status !== 'completed' && rewards.length > 0 && status === 'available' && (
                          <div style={{
                            fontSize: 10, color: '#34d399',
                            background: 'rgba(52,211,153,0.08)',
                            border: '1px solid rgba(52,211,153,0.2)',
                            padding: '2px 7px', borderRadius: 5,
                            display: 'inline-block', fontWeight: 700,
                          }}>
                            🎁 {rewards[0]?.icon} +{rewards.length} reward{rewards.length > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>

                      <ProjectNode
                        project={project}
                        status={status}
                        onClick={handleNodeClick}
                        isFirst={isFirst}
                        rewards={rewards}
                      />
                    </div>
                  </div>
                )
              })}

              {/* World clear badge */}
              {allDone && (
                <div style={{ textAlign: 'center', marginTop: 4, marginBottom: 12, animation: 'fadeSlideUp .4s ease both' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '5px 14px', borderRadius: 8,
                    background: `${world.color}15`, border: `1px solid ${world.color}40`,
                    color: world.color, fontSize: 11, fontWeight: 800, letterSpacing: '.05em',
                  }}>
                    🏆 World {world.id} Complete!
                  </span>
                </div>
              )}
            </div>
          )
        })}

        {/* All done! */}
        {completedCount === totalProjects && (
          <div style={{ textAlign: 'center', padding: '32px 20px', animation: 'fadeSlideUp .6s ease both' }}>
            <div style={{ fontSize: 56, marginBottom: 12, animation: 'starSpin 3s linear infinite' }}>🏆</div>
            <div style={{
              fontSize: 22, fontWeight: 900,
              background: 'linear-gradient(135deg, #fbbf24, #f97316)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              All Projects Complete!
            </div>
            <p style={{ color: '#475569', fontSize: 13, marginTop: 6 }}>
              You're a true Circuit Champion! 🎖️
            </p>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={css.progressPanel}>
        <div style={css.progressStat}>
          <span style={{ ...css.progressNum, color: '#fbbf24' }}>{xp}</span>
          <span style={css.progressLabel}>XP</span>
        </div>
        <div style={css.progressDivider} />
        <div style={css.progressStat}>
          <span style={{ ...css.progressNum, color: '#34d399' }}>{completedCount}</span>
          <span style={css.progressLabel}>Done</span>
        </div>
        <div style={css.progressDivider} />
        <div style={css.progressStat}>
          <span style={{ ...css.progressNum, color: '#94a3b8' }}>{totalProjects - completedCount}</span>
          <span style={css.progressLabel}>Left</span>
        </div>
        <div style={css.progressDivider} />
        <div style={css.progressStat}>
          <span style={{ ...css.progressNum, color: currentLevelData?.color || '#34d399' }}>
            {currentLevelData?.icon} {currentLevel}
          </span>
          <span style={css.progressLabel}>Level</span>
        </div>
        <div style={{
          width: 80, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4,
        }}>
          <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99,
              width: `${Math.round((completedCount / totalProjects) * 100)}%`,
              background: 'linear-gradient(90deg, #34d399, #3b82f6)',
              transition: 'width .6s ease',
            }} />
          </div>
          <div style={{ fontSize: 10, color: '#334155', textAlign: 'center' }}>
            {Math.round((completedCount / totalProjects) * 100)}%
          </div>
        </div>
      </div>

      {/* Modal */}
      {selectedProject && (
        <ProjectModal
          project={selectedProject}
          isCompleted={completedProjects.includes(selectedProject.slug)}
          isAvailable={getStatus(selectedProject) !== 'locked'}
          onClose={() => setSelectedProject(null)}
          onStart={handleStart}
        />
      )}
    </div>
  )
}
