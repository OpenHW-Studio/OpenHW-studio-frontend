
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGamification } from '../context/GamificationContext'
import { COMPONENTS } from '../services/gamification/ComponentsConfig'
import { PROJECTS } from '../services/gamification/ProjectsConfig'
import { STARTING_COMPONENTS } from '../services/gamification/GamificationConfig.jsx'

// ── Which project unlocks which component? ────────────────────────────────────
function findUnlockProject(componentType) {
  for (const project of PROJECTS) {
    for (const reward of (project.rewardComponents || [])) {
      if (reward.type === componentType || reward.type === '*') {
        return project;
      }
    }
  }
  return null;
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0d1117 0%, #111827 50%, #0d1117 100%)',
    color: '#e2e8f0',
    fontFamily: "'Nunito', 'Fredoka One', system-ui, sans-serif",
    padding: '0 0 80px',
  },
  header: {
    background: 'rgba(13,17,23,0.95)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    padding: '0 24px',
    position: 'sticky', top: 0, zIndex: 100,
  },
  headerInner: {
    maxWidth: 1100, margin: '0 auto',
    display: 'flex', alignItems: 'center', gap: 16, height: 64,
  },
  backBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '6px 14px',
    color: '#94a3b8', cursor: 'pointer',
    fontSize: 13, fontWeight: 700,
    fontFamily: 'inherit', transition: 'all .15s',
    display: 'flex', alignItems: 'center', gap: 6,
  },
  logo: {
    fontSize: 18, fontWeight: 800,
    background: 'linear-gradient(90deg, #34d399, #3b82f6)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
  },
  heroSection: {
    maxWidth: 1100, margin: '0 auto',
    padding: '40px 24px 24px',
  },
  heroTitle: {
    fontSize: 36, fontWeight: 900, margin: '0 0 8px',
    background: 'linear-gradient(90deg, #34d399, #3b82f6, #a78bfa)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
    lineHeight: 1.2,
  },
  heroSub: {
    fontSize: 16, color: '#94a3b8', margin: '0 0 28px', lineHeight: 1.6,
  },
  progressBanner: {
    display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
    background: 'rgba(52,211,153,0.06)',
    border: '1px solid rgba(52,211,153,0.2)',
    borderRadius: 16, padding: '18px 24px', marginBottom: 32,
  },
  progressIcon: {
    fontSize: 36, flexShrink: 0,
  },
  progressText: { flex: 1 },
  progressTitle: { fontSize: 18, fontWeight: 800, color: '#34d399', margin: '0 0 4px' },
  progressDesc: { fontSize: 13, color: '#94a3b8', margin: 0 },
  progressCount: {
    textAlign: 'right', flexShrink: 0,
  },
  progressNum: { fontSize: 32, fontWeight: 900, color: '#34d399' },
  progressTotal: { fontSize: 13, color: '#64748b' },
  // Sections
  section: { maxWidth: 1100, margin: '0 auto', padding: '0 24px 32px' },
  sectionHeader: {
    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20, fontWeight: 800, margin: 0,
  },
  sectionBadge: {
    padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
  },
  // Component card states
  card: {
    borderRadius: 16, padding: '20px',
    transition: 'all 0.2s',
    cursor: 'pointer',
    position: 'relative', overflow: 'hidden',
  },
  cardOwned: {
    background: 'linear-gradient(135deg, rgba(52,211,153,0.08), rgba(59,130,246,0.06))',
    border: '1px solid rgba(52,211,153,0.25)',
  },
  cardNext: {
    background: 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(245,158,11,0.06))',
    border: '1px solid rgba(251,191,36,0.3)',
  },
  cardLocked: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    opacity: 0.6,
  },
  cardTop: {
    display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12,
  },
  iconCircle: {
    width: 52, height: 52, borderRadius: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 26, flexShrink: 0,
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: 800, margin: '0 0 3px', color: '#f1f5f9' },
  cardFull: { fontSize: 11, color: '#64748b', margin: '0 0 6px', fontWeight: 600, letterSpacing: '.03em' },
  cardCat: {
    fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
    padding: '2px 8px', borderRadius: 5,
  },
  cardDesc: { fontSize: 13, color: '#94a3b8', lineHeight: 1.5, margin: '0 0 12px' },
  ownedBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '5px 12px', borderRadius: 8,
    fontSize: 12, fontWeight: 700, color: '#34d399',
    background: 'rgba(52,211,153,0.1)',
    border: '1px solid rgba(52,211,153,0.2)',
  },
  lockBadge: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 12px', borderRadius: 10,
    fontSize: 12, fontWeight: 600, color: '#94a3b8',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    lineHeight: 1.3,
  },
  nextBadge: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 12px', borderRadius: 10,
    fontSize: 12, fontWeight: 700, color: '#f59e0b',
    background: 'rgba(251,191,36,0.08)',
    border: '1px solid rgba(251,191,36,0.2)',
    lineHeight: 1.3, cursor: 'pointer',
  },
  startingTag: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '5px 12px', borderRadius: 8,
    fontSize: 12, fontWeight: 700, color: '#3b82f6',
    background: 'rgba(59,130,246,0.1)',
    border: '1px solid rgba(59,130,246,0.2)',
  },
  learnBtn: {
    marginTop: 10,
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 16px', borderRadius: 8,
    fontSize: 12, fontWeight: 700, color: '#e2e8f0',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
  },
}

export default function ComponentsPage() {
  const navigate = useNavigate()
  const { unlockedComponentTypes, completedProjects, currentLevel, xp } = useGamification()
  const [expandedCard, setExpandedCard] = useState(null)

  const isAllUnlocked = unlockedComponentTypes === '*'
  const unlockedSet = isAllUnlocked ? null : new Set(Array.isArray(unlockedComponentTypes) ? unlockedComponentTypes : [])

  const isOwned = (wokwiType) => {
    if (isAllUnlocked) return true
    return unlockedSet?.has(wokwiType) || STARTING_COMPONENTS.includes(wokwiType)
  }

  // Which project will unlock this component next?
  const getUnlocker = (wokwiType) => findUnlockProject(wokwiType)

  // Next project the player should complete (first available, incomplete)
  const nextProject = PROJECTS.find(p => !completedProjects.includes(p.slug) &&
    (!p.prerequisite || completedProjects.includes(p.prerequisite)))

  // Categorize components
  const ownedComponents = COMPONENTS.filter(c => isOwned(c.wokwiType || `wokwi-${c.id}`))
  const nextComponents = COMPONENTS.filter(c => {
    if (isOwned(c.wokwiType || `wokwi-${c.id}`)) return false
    const unlocker = getUnlocker(c.wokwiType || `wokwi-${c.id}`)
    return unlocker && unlocker.slug === nextProject?.slug
  })
  const lockedComponents = COMPONENTS.filter(c => {
    if (isOwned(c.wokwiType || `wokwi-${c.id}`)) return false
    const unlocker = getUnlocker(c.wokwiType || `wokwi-${c.id}`)
    return !unlocker || unlocker.slug !== nextProject?.slug
  })

  const totalOwned = ownedComponents.length

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.headerInner}>
          <button style={S.backBtn} onClick={() => navigate('/adventure')}>
            ← Back to Map
          </button>
          <span style={S.logo}>⚡ My Components</span>
        </div>
      </div>

      {/* Hero */}
      <div style={S.heroSection}>
        <h1 style={S.heroTitle}>Your Component Toolbox 🧰</h1>
        <p style={S.heroSub}>
          Complete projects on the Adventure Map to earn new components!<br/>
          No quizzes — just build, learn, and unlock. 🚀
        </p>

        {/* Progress banner */}
        <div style={S.progressBanner}>
          <span style={S.progressIcon}>🏆</span>
          <div style={S.progressText}>
            <p style={S.progressTitle}>
              {isAllUnlocked ? 'All Components Unlocked! 🎉' : `Keep going, maker! ${nextProject ? `Complete "${nextProject.title}" to earn more!` : ''}`}
            </p>
            <p style={S.progressDesc}>
              You have earned {totalOwned} components. Complete more projects to unlock the rest!
            </p>
          </div>
          <div style={S.progressCount}>
            <div style={S.progressNum}>{totalOwned}</div>
            <div style={S.progressTotal}>/ {COMPONENTS.length} earned</div>
          </div>
        </div>
      </div>

      {/* OWNED */}
      <div style={S.section}>
        <div style={S.sectionHeader}>
          <h2 style={{ ...S.sectionTitle, color: '#34d399' }}>✅ Your Components</h2>
          <span style={{ ...S.sectionBadge, background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
            {totalOwned} owned
          </span>
        </div>
        <div style={S.grid}>
          {ownedComponents.map(comp => (
            <ComponentCard
              key={comp.id}
              comp={comp}
              status="owned"
              isStarting={STARTING_COMPONENTS.includes(comp.wokwiType || `wokwi-${comp.id}`)}
              expanded={expandedCard === comp.id}
              onToggle={() => setExpandedCard(expandedCard === comp.id ? null : comp.id)}
              onLearn={() => navigate(`/components/${comp.id}/theory`)}
            />
          ))}
        </div>
      </div>

      {/* EARN NEXT */}
      {nextComponents.length > 0 && (
        <div style={S.section}>
          <div style={S.sectionHeader}>
            <h2 style={{ ...S.sectionTitle, color: '#f59e0b' }}>🎁 Earn These Next!</h2>
            <span style={{ ...S.sectionBadge, background: 'rgba(251,191,36,0.1)', color: '#f59e0b', border: '1px solid rgba(251,191,36,0.2)' }}>
              Complete "{nextProject?.title}"
            </span>
          </div>
          <div style={S.grid}>
            {nextComponents.map(comp => (
              <ComponentCard
                key={comp.id}
                comp={comp}
                status="next"
                unlocker={nextProject}
                expanded={expandedCard === comp.id}
                onToggle={() => setExpandedCard(expandedCard === comp.id ? null : comp.id)}
                onGoToProject={() => navigate('/adventure')}
              />
            ))}
          </div>
        </div>
      )}

      {/* LOCKED */}
      {lockedComponents.length > 0 && (
        <div style={S.section}>
          <div style={S.sectionHeader}>
            <h2 style={{ ...S.sectionTitle, color: '#475569' }}>🔒 Still Locked</h2>
            <span style={{ ...S.sectionBadge, background: 'rgba(255,255,255,0.04)', color: '#475569', border: '1px solid rgba(255,255,255,0.08)' }}>
              Keep completing projects!
            </span>
          </div>
          <div style={S.grid}>
            {lockedComponents.map(comp => {
              const unlocker = getUnlocker(comp.wokwiType || `wokwi-${comp.id}`)
              return (
                <ComponentCard
                  key={comp.id}
                  comp={comp}
                  status="locked"
                  unlocker={unlocker}
                  expanded={expandedCard === comp.id}
                  onToggle={() => setExpandedCard(expandedCard === comp.id ? null : comp.id)}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── ComponentCard ─────────────────────────────────────────────────────────────
function ComponentCard({ comp, status, isStarting, unlocker, expanded, onToggle, onLearn, onGoToProject }) {
  const catColors = {
    Output: { bg: 'rgba(52,211,153,0.12)', color: '#34d399' },
    Input:  { bg: 'rgba(59,130,246,0.12)', color: '#60a5fa' },
    Power:  { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24' },
    Sensor: { bg: 'rgba(168,85,247,0.12)', color: '#a78bfa' },
    Motor:  { bg: 'rgba(249,115,22,0.12)', color: '#fb923c' },
    Display:{ bg: 'rgba(236,72,153,0.12)', color: '#f472b6' },
    IC:     { bg: 'rgba(20,184,166,0.12)', color: '#2dd4bf' },
  }
  const cat = catColors[comp.category] || { bg: 'rgba(255,255,255,0.06)', color: '#94a3b8' }

  const cardStyle = {
    ...S.card,
    ...(status === 'owned' ? S.cardOwned : status === 'next' ? S.cardNext : S.cardLocked),
  }

  // Simple kid-friendly description (first 80 chars of description)
  const shortDesc = comp.description
    ? comp.description.slice(0, 90) + (comp.description.length > 90 ? '…' : '')
    : ''

  return (
    <div style={cardStyle} onClick={onToggle}>
      <div style={S.cardTop}>
        <div style={{ ...S.iconCircle, background: cat.bg }}>
          {comp.icon || '🔌'}
        </div>
        <div style={S.cardInfo}>
          <div style={S.cardName}>{comp.name}</div>
          <div style={S.cardFull}>{comp.fullName || comp.name}</div>
          <span style={{ ...S.cardCat, background: cat.bg, color: cat.color }}>
            {comp.category}
          </span>
        </div>

        {/* Status badge top-right */}
        {status === 'owned' && (
          <div style={{ fontSize: 18 }}>✅</div>
        )}
        {status === 'next' && (
          <div style={{ fontSize: 18 }}>🎁</div>
        )}
        {status === 'locked' && (
          <div style={{ fontSize: 18 }}>🔒</div>
        )}
      </div>

      <p style={S.cardDesc}>{shortDesc}</p>

      {/* Bottom action area */}
      {status === 'owned' && isStarting && (
        <span style={S.startingTag}>🎁 Starter Kit</span>
      )}
      {status === 'owned' && !isStarting && (
        <span style={S.ownedBadge}>✓ In your toolbox</span>
      )}
      {status === 'owned' && (
        <button
          style={S.learnBtn}
          onClick={(e) => { e.stopPropagation(); onLearn?.() }}
        >
          📖 Learn more
        </button>
      )}

      {status === 'next' && unlocker && (
        <div
          style={S.nextBadge}
          onClick={(e) => { e.stopPropagation(); onGoToProject?.() }}
        >
          <span>🎯</span>
          <span>Complete <strong>"{unlocker.title}"</strong> to unlock!</span>
        </div>
      )}

      {status === 'locked' && unlocker && (
        <div style={S.lockBadge}>
          <span>🔒</span>
          <span>Unlocked by completing <strong>"{unlocker.title}"</strong></span>
        </div>
      )}
      {status === 'locked' && !unlocker && (
        <div style={S.lockBadge}>
          <span>🔒</span>
          <span>Keep completing projects to unlock!</span>
        </div>
      )}

      {/* Expanded theory preview */}
      {expanded && comp.theory?.sections?.[0] && (
        <div
          style={{
            marginTop: 14, padding: '12px 14px',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            {comp.theory.sections[0].title}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {comp.theory.sections[0].content.slice(0, 200)}…
          </div>
        </div>
      )}
    </div>
  )
}
