import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGamification } from '../../context/GamificationContext'
import { PROJECTS, getProjectStatus, getProjectRewardComponents } from '../../services/gamification/ProjectsConfig'

// ─── World config ────────────────────────────────────────────────────────────
const WORLDS = [
  { id: 1, name: 'Circuit Basics',     color: '#22c55e', icon: '⚡', slugs: ['led-blink','rgb-led','buzzer','potentiometer','ldr'] },
  { id: 2, name: 'Signal Control',     color: '#3b82f6', icon: '🎮', slugs: ['servo-motor','led-strip','button-debounce','temperature-sensor'] },
  { id: 3, name: 'Machines & Sensors', color: '#f97316', icon: '🤖', slugs: ['dc-motor'] },
]

// Winding path x-offsets per global project index
const PATH_X = [50, 72, 50, 28, 50, 72, 50, 28, 50, 72]

// ─── Inline styles ────────────────────────────────────────────────────────────
const S = {
  root: {
    fontFamily: "'Nunito', system-ui, sans-serif",
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: 800,
    color: 'var(--text, #0f172a)',
    margin: 0,
  },
  sub: {
    fontSize: 12,
    color: 'var(--text-muted, #64748b)',
    margin: '3px 0 0',
  },
  viewAllBtn: {
    fontSize: 12,
    fontWeight: 700,
    color: '#3b82f6',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
    marginTop: 2,
    fontFamily: 'inherit',
  },
  mapScroll: {
    overflowX: 'auto',
    paddingBottom: 4,
  },
  mapInner: {
    minWidth: 320,
  },
  worldBlock: {
    marginBottom: 4,
  },
  worldHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '5px 10px',
    borderRadius: 8,
    marginBottom: 4,
    fontSize: 11,
    fontWeight: 800,
  },
  worldDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  },
  worldLabel: {
    flex: 1,
  },
  worldCount: {
    fontSize: 10,
    opacity: 0.65,
    fontWeight: 600,
  },
  nodesRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    position: 'relative',
    padding: '4px 0',
  },
  connectorWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    flexShrink: 0,
  },
  bottomBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    padding: '10px 14px',
    background: 'var(--card, #f8fafc)',
    border: '1px solid var(--border, #e2e8f0)',
    borderRadius: 10,
    flexWrap: 'wrap',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: 40,
  },
  statVal: {
    fontSize: 16,
    fontWeight: 900,
    lineHeight: 1,
  },
  statLabel: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    color: 'var(--text-muted, #64748b)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    background: 'var(--border, #e2e8f0)',
    flexShrink: 0,
  },
  startBtn: {
    marginLeft: 'auto',
    padding: '7px 14px',
    borderRadius: 8,
    border: 'none',
    background: 'linear-gradient(135deg,#22c55e,#16a34a)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 2px 10px rgba(34,197,94,.3)',
    flexShrink: 0,
  },
}

// ─── Project Node (compact) ───────────────────────────────────────────────────
function CompactNode({ project, status, onClick }) {
  const isCompleted = status === 'completed'
  const isAvailable = status === 'available'
  const isLocked    = status === 'locked'

  const size   = isAvailable ? 52 : 44
  const color  = project.color
  const glow   = color + '55'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div
        onClick={() => !isLocked && onClick(project)}
        style={{
          width: size, height: size, borderRadius: '50%',
          border: `${isAvailable ? 2.5 : 2}px solid ${
            isCompleted ? color : isAvailable ? color : 'rgba(0,0,0,0.12)'
          }`,
          background: isCompleted
            ? `radial-gradient(circle, ${color}28, ${color}0a)`
            : isAvailable
            ? `radial-gradient(circle, ${color}14, transparent)`
            : 'rgba(0,0,0,0.03)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          cursor: isLocked ? 'default' : 'pointer',
          transition: 'transform .18s, box-shadow .18s',
          position: 'relative', flexShrink: 0,
          boxShadow: isAvailable
            ? `0 0 14px ${glow}`
            : isCompleted ? `0 0 8px ${color}22` : 'none',
          animation: isAvailable ? 'embedNodePulse 2.2s ease-in-out infinite' : 'none',
        }}
        onMouseEnter={e => { if (!isLocked) { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = `0 0 20px ${glow}` } }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = isAvailable ? `0 0 14px ${glow}` : isCompleted ? `0 0 8px ${color}22` : 'none' }}
      >
        <span style={{
          fontSize: isAvailable ? 16 : 13,
          filter: isLocked ? 'grayscale(1) opacity(.3)' : 'none',
          lineHeight: 1,
        }}>
          {isLocked ? '🔒' : project.icon}
        </span>
        {isCompleted && (
          <span style={{ fontSize: 6, lineHeight: 1, marginTop: 1 }}>⭐⭐⭐</span>
        )}
        {/* Number badge */}
        <div style={{
          position: 'absolute', top: -5, right: -5,
          width: 15, height: 15, borderRadius: '50%',
          background: isCompleted ? color : isAvailable ? color : '#cbd5e1',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 7, fontWeight: 900,
          color: isCompleted || isAvailable ? '#fff' : '#94a3b8',
          border: '1.5px solid #fff',
        }}>
          {project.number}
        </div>
        {/* Available pulse ring */}
        {isAvailable && (
          <div style={{
            position: 'absolute', inset: -4,
            borderRadius: '50%',
            border: `1.5px solid ${color}60`,
            animation: 'embedRingPulse 2s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
        )}
      </div>
      {/* Label below node */}
      <div style={{
        fontSize: 9, fontWeight: 700, textAlign: 'center',
        maxWidth: 58, lineHeight: 1.2,
        color: isLocked ? '#cbd5e1' : isCompleted ? color : '#475569',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        maxWidth: 60,
      }}>
        {project.title}
      </div>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function NodeModal({ project, isCompleted, isAvailable, onClose, onStart }) {
  if (!project) return null
  const rewards = getProjectRewardComponents(project.slug)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          border: `1px solid ${project.color}33`,
          borderRadius: 18, padding: '24px 22px',
          maxWidth: 380, width: '100%',
          boxShadow: `0 0 40px ${project.color}18, 0 16px 48px rgba(0,0,0,0.18)`,
          position: 'relative', maxHeight: '88vh', overflowY: 'auto',
          fontFamily: "'Nunito', system-ui, sans-serif",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 10, right: 10,
          background: '#f1f5f9', border: 'none', borderRadius: 8,
          width: 28, height: 28, color: '#94a3b8',
          cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{
            fontSize: 48, marginBottom: 8,
            filter: isAvailable || isCompleted ? 'none' : 'grayscale(1) opacity(.35)',
          }}>{project.icon}</div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: project.color, marginBottom: 5 }}>
            {project.difficulty} · Project {project.number}
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginBottom: 3 }}>{project.title}</div>
          {isCompleted && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 4 }}>
              {[1,2,3].map(i => <span key={i} style={{ fontSize: 18 }}>⭐</span>)}
            </div>
          )}
        </div>

        {/* XP */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{
            padding: '4px 12px', borderRadius: 7,
            background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)',
            fontSize: 12, fontWeight: 700, color: '#d97706',
          }}>⚡ +{project.xpReward} XP</span>
          {isCompleted && (
            <span style={{
              padding: '4px 12px', borderRadius: 7,
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)',
              fontSize: 12, fontWeight: 700, color: '#16a34a',
            }}>✓ Completed!</span>
          )}
        </div>

        {/* Rewards preview */}
        {!isCompleted && isAvailable && rewards.length > 0 && (
          <div style={{
            marginBottom: 14, background: 'rgba(34,197,94,.06)',
            border: '1px solid rgba(34,197,94,.2)', borderRadius: 10,
            padding: '10px 12px',
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
              🎁 Complete to unlock:
            </div>
            {rewards.slice(0,2).map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: i < rewards.length-1 ? 5 : 0 }}>
                <span style={{ fontSize: 18 }}>{r.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{r.name}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{r.description}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        {isAvailable || isCompleted ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <button onClick={() => onStart(project.slug, 'guide')} style={{
              padding: '12px', borderRadius: 10, border: 'none',
              background: `linear-gradient(135deg, ${project.color}, ${project.color}bb)`,
              color: '#fff', fontWeight: 800, fontSize: 14,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: `0 3px 14px ${project.color}40`,
            }}>
              {isCompleted ? '🔄 Play Again' : '🚀 Start Project!'}
            </button>
            <button onClick={() => onStart(project.slug, 'guide-simple')} style={{
              padding: '9px', borderRadius: 10,
              border: '1px solid #e2e8f0',
              background: '#f8fafc', color: '#64748b',
              fontWeight: 600, fontSize: 12,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              📖 View Guide
            </button>
          </div>
        ) : (
          <div style={{
            padding: '14px', borderRadius: 10,
            background: '#f8fafc', border: '1px solid #e2e8f0',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 18, marginBottom: 5 }}>🔒</div>
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
              Complete the previous project first to unlock this one!
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main embed component ─────────────────────────────────────────────────────
export default function AdventureMapEmbed() {
  const navigate = useNavigate()
  const {
    xp, currentLevel, currentLevelData, completedProjects = [],
  } = useGamification()

  const [selected, setSelected] = useState(null)

  const completedCount = completedProjects.length
  const totalProjects  = PROJECTS.length

  const worldGroups = WORLDS.map(w => ({
    ...w,
    projects: PROJECTS.filter(p => w.slugs.includes(p.slug))
      .sort((a, b) => a.number - b.number),
  }))

  const getStatus = (project) => getProjectStatus(project.slug, completedProjects)

  const handleStart = (slug, mode) => {
    setSelected(null)
    if (mode === 'guide') navigate(`/${slug}/gamified-guide`)
    else navigate(`/${slug}/guide`)
  }

  // Find first available project for CTA
  const firstAvailable = PROJECTS.find(p => getStatus(p) === 'available')

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap');
        @keyframes embedNodePulse {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.18); }
        }
        @keyframes embedRingPulse {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 0; transform: scale(1.35); }
        }
      `}</style>

      <div style={S.root}>
        {/* Section header */}
        <div style={S.header}>
          <div>
            <h3 style={S.title}>Your Adventure Map</h3>
            <p style={S.sub}>Complete projects to unlock components &amp; earn XP</p>
          </div>
          <button style={S.viewAllBtn} onClick={() => navigate('/adventure')}>
            Full Map →
          </button>
        </div>

        {/* Map */}
        <div style={S.mapScroll}>
          <div style={S.mapInner}>
            {worldGroups.map((world, wi) => {
              const doneCount = world.projects.filter(p => completedProjects.includes(p.slug)).length
              const allDone   = doneCount === world.projects.length && world.projects.length > 0

              return (
                <div key={world.id} style={S.worldBlock}>
                  {/* World header pill */}
                  <div style={{
                    ...S.worldHeader,
                    background: `${world.color}0f`,
                    border: `1px solid ${world.color}28`,
                    color: world.color,
                  }}>
                    <div style={{ ...S.worldDot, background: world.color }} />
                    <span style={S.worldLabel}>
                      {world.icon} World {world.id}: {world.name}
                    </span>
                    <span style={S.worldCount}>
                      {doneCount}/{world.projects.length}
                      {allDone && ' · 🏆'}
                    </span>
                  </div>

                  {/* Nodes row — horizontal winding */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 0,
                    padding: '6px 8px',
                    position: 'relative',
                    overflowX: 'auto',
                  }}>
                    {world.projects.map((project, pi) => {
                      const status    = getStatus(project)
                      const globalIdx = PROJECTS.indexOf(project)
                      const xPct      = PATH_X[globalIdx] ?? 50
                      // Vertical offset to create winding feel
                      const yShift    = xPct < 40 ? 10 : xPct > 60 ? -10 : 0

                      return (
                        <div key={project.slug} style={{
                          display: 'flex', alignItems: 'center', flexShrink: 0,
                        }}>
                          {/* Connector between nodes */}
                          {pi > 0 && (
                            <div style={{
                              width: 22, height: 2,
                              background: status === 'locked'
                                ? 'rgba(0,0,0,0.08)'
                                : `${project.color}40`,
                              flexShrink: 0,
                              marginBottom: yShift,
                              borderTop: `2px dashed ${status === 'locked' ? 'rgba(0,0,0,0.1)' : project.color + '55'}`,
                              background: 'none',
                            }} />
                          )}

                          <div style={{ transform: `translateY(${yShift}px)`, transition: 'transform .2s' }}>
                            <CompactNode
                              project={project}
                              status={status}
                              onClick={setSelected}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Bottom stats + CTA */}
        <div style={S.bottomBar}>
          {[
            { val: xp, label: 'XP',    color: '#d97706' },
            { val: completedCount,     label: 'Done',  color: '#16a34a' },
            { val: totalProjects - completedCount, label: 'Left', color: '#64748b' },
            { val: `${currentLevelData?.icon || '🌱'} ${currentLevel}`, label: 'Level', color: currentLevelData?.color || '#22c55e' },
          ].map((s, i) => (
            <>
              {i > 0 && <div key={`div-${i}`} style={S.statDivider} />}
              <div key={s.label} style={S.statItem}>
                <span style={{ ...S.statVal, color: s.color }}>{s.val}</span>
                <span style={S.statLabel}>{s.label}</span>
              </div>
            </>
          ))}

          {/* Progress bar */}
          <div style={{ flex: 1, minWidth: 60, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{
              height: 5, borderRadius: 99,
              background: 'var(--border, #e2e8f0)', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 99,
                width: `${Math.round((completedCount / totalProjects) * 100)}%`,
                background: 'linear-gradient(90deg, #22c55e, #3b82f6)',
                transition: 'width .6s ease',
              }} />
            </div>
            <div style={{ fontSize: 9, color: '#94a3b8', textAlign: 'right' }}>
              {Math.round((completedCount / totalProjects) * 100)}% complete
            </div>
          </div>

          {firstAvailable && (
            <button
              style={S.startBtn}
              onClick={() => navigate(`/${firstAvailable.slug}/gamified-guide`)}
            >
              🚀 Continue
            </button>
          )}
        </div>
      </div>

      {/* Modal */}
      {selected && (
        <NodeModal
          project={selected}
          isCompleted={completedProjects.includes(selected.slug)}
          isAvailable={getStatus(selected) !== 'locked'}
          onClose={() => setSelected(null)}
          onStart={handleStart}
        />
      )}
    </>
  )
}