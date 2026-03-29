import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGamification } from '../context/GamificationContext'
import {
  PROJECTS,
  DIFFICULTY_CONFIG,
  getUnlockedProjects,
  getLockedProjects,
  getProjectStatus,
} from '../services/gamification/ProjectsConfig'
// Component unlock now handled by project rewards - no quiz-based unlock

const S = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontFamily: "'Space Grotesk', sans-serif",
    padding: '48px 24px 80px',
  },
  inner: { maxWidth: 1100, margin: '0 auto' },
  hdr: { marginBottom: 36 },
  hdrTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 8 },
  sectionTag: {
    fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
    color: 'var(--accent)', background: 'rgba(0,180,255,.08)',
    border: '1px solid rgba(0,180,255,.2)', borderRadius: 6,
    padding: '4px 10px', display: 'inline-block', marginBottom: 10,
  },
  title: { fontSize: 32, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px', lineHeight: 1.2 },
  subtitle: { fontSize: 15, color: 'var(--text2)', lineHeight: 1.6, margin: 0 },
  xpBanner: {
    display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '14px 18px', marginBottom: 28,
  },
  xpLvl: {
    width: 42, height: 42, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 20, fontWeight: 700, flexShrink: 0,
  },
  xpBarWrap: { flex: 1, minWidth: 160 },
  xpBarTrack: { height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden', marginBottom: 4 },
  xpBarFill: { height: '100%', borderRadius: 999, transition: 'width .5s ease' },
  xpBarMeta: { display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)' },
  filters: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 },
  filterBtn: {
    padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'transparent', color: 'var(--text2)', fontFamily: 'inherit',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
  },
  filterBtnActive: { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'rgba(0,180,255,.06)' },
  statsRow: { display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' },
  statPill: {
    padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--bg2)', fontSize: 13, color: 'var(--text2)',
    display: 'flex', alignItems: 'center', gap: 6,
  },
  statNum: { fontWeight: 700, color: 'var(--text)' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 16,
  },
}

const compReqStyles = {
  reqSection: {
    marginBottom: 14, padding: '10px 14px',
    background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)',
    borderRadius: 9,
  },
  reqTitle: {
    fontSize: 10, fontWeight: 700, color: '#ef4444',
    textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 7,
    display: 'flex', alignItems: 'center', gap: 5,
  },
  reqChips: { display: 'flex', gap: 5, flexWrap: 'wrap' },
  reqChip: {
    fontSize: 10, padding: '3px 8px', borderRadius: 5,
    border: '1px solid rgba(239,68,68,.3)',
    color: '#ef4444', background: 'rgba(239,68,68,.08)',
    display: 'flex', alignItems: 'center', gap: 4,
    cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 600, transition: 'all .15s',
  },
  allUnlocked: {
    fontSize: 10, color: '#22c55e',
    display: 'flex', alignItems: 'center', gap: 5, marginBottom: 14,
    padding: '7px 12px', borderRadius: 7,
    background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.15)',
  },
}

const FILTERS = [
  { id: 'all',          label: 'All Projects' },
  { id: 'unlocked',     label: 'Unlocked' },
  { id: 'beginner',     label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'completed',    label: 'Completed' },
]

export default function ProjectsGallery() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const {
    currentLevel, currentLevelData, nextLevel, xp, xpProgress,
    earnedBadges, completeLevel, unlockedComponentTypes, coins, completedProjects = [],
    isProjectUnlocked,
  } = useGamification()

  // Sequential prerequisite chain (uses shared ProjectsConfig helper)
  const isSeqUnlocked = (slug) => getProjectStatus(slug, completedProjects) !== 'locked' 

  // completedProjects stores slugs e.g. ['led-blink'] — map to project IDs
  const completedProjectIds = useMemo(
    () => new Set(PROJECTS.filter(p => completedProjects.includes(p.slug)).map(p => p.id)),
    [completedProjects]
  )

  const filtered = useMemo(() => {
    return PROJECTS.filter(p => {
      if (filter === 'unlocked')     return p.levelRequired <= currentLevel && canStartProject(p, unlockedComponents)
      if (filter === 'beginner')     return p.difficulty === 'beginner'
      if (filter === 'intermediate') return p.difficulty === 'intermediate'
      if (filter === 'completed')    return completedProjectIds.has(p.id)
      return true
    })
  }, [filter, currentLevel, completedProjectIds])

  const unlockedCount  = PROJECTS.filter(p => p.levelRequired <= currentLevel).length
  const completedCount = completedProjectIds.size
  const totalXPEarned  = PROJECTS.filter(p => completedProjectIds.has(p.id)).reduce((a, p) => a + p.xpReward, 0)

  return (
    <div style={S.page}>
      <div style={S.inner}>

        <div style={S.hdr}>
          <div style={S.hdrTop}>
            <div>
              <div style={S.sectionTag}>Section 11.1</div>
              <h1 style={S.title}>Arduino Projects</h1>
              <p style={S.subtitle}>
                10 hands-on projects from LED blink to sensor circuits.
                Complete each to earn XP, badges, and unlock new components.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <button
                onClick={() => navigate('/adventure')}
                style={{ ...S.filterBtn, flexShrink: 0, background: 'linear-gradient(135deg,rgba(0,194,255,.12),rgba(124,58,237,.12))', border: '1px solid rgba(0,194,255,.3)', color: '#00c2ff', fontWeight: 700 }}
              >🗺️ Adventure Map</button>
              <button
                onClick={() => navigate('/')}
                style={{ ...S.filterBtn, flexShrink: 0, alignSelf: 'flex-start' }}
              >← Back</button>
            </div>
          </div>
        </div>

        <div style={S.xpBanner}>
          <div style={{
            ...S.xpLvl,
            background: `${currentLevelData?.color || '#22c55e'}22`,
            border: `2px solid ${currentLevelData?.color || '#22c55e'}`,
            color: currentLevelData?.color || '#22c55e',
          }}>
            {currentLevel}
          </div>
          <div style={S.xpBarWrap}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              {currentLevelData?.title} &nbsp;
              <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>
                Level {currentLevel}
              </span>
            </div>
            <div style={S.xpBarTrack}>
              <div style={{
                ...S.xpBarFill,
                width: `${xpProgress}%`,
                background: `linear-gradient(90deg, ${currentLevelData?.color}, ${nextLevel?.color || currentLevelData?.color})`,
              }} />
            </div>
            <div style={S.xpBarMeta}>
              <span>{xpProgress}% to Level {nextLevel?.id ?? '—'}</span>
              <span>{xp.toLocaleString()} XP total</span>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fbbf24' }}>{totalXPEarned.toLocaleString()}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>XP from projects</div>
          </div>
        </div>

        <div style={S.statsRow}>
          {[
            { icon: '🔓', label: 'Unlocked',  value: unlockedCount,       total: PROJECTS.length },
            { icon: '✅', label: 'Completed', value: completedCount,      total: PROJECTS.length },
            { icon: '🏅', label: 'Badges',    value: earnedBadges.length, total: null },
            { icon: '🪙', label: 'Coins',     value: coins,               total: null },
          ].map(({ icon, label, value, total }) => (
            <div key={label} style={S.statPill}>
              <span>{icon}</span>
              <span style={S.statNum}>{value}</span>
              <span>{total ? `/ ${total}` : ''}</span>
              <span style={{ color: 'var(--text3)', fontSize: 11 }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={S.filters}>
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                ...S.filterBtn,
                ...(filter === f.id ? S.filterBtnActive : {}),
              }}
            >{f.label}</button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)', alignSelf: 'center' }}>
            {filtered.length} project{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div style={S.grid}>
          {filtered.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              isLocked={project.levelRequired > currentLevel || !isSeqUnlocked(project.slug)}
              isSeqLocked={!isSeqUnlocked(project.slug) && project.levelRequired <= currentLevel}
              isCompleted={completedProjectIds.has(project.id)}
              missingComponents={getMissingComponents(project, unlockedComponents)}
              canStart={canStartProject(project, unlockedComponents) && isSeqUnlocked(project.slug)}
              onStart={() => navigate(`/gamification-simulator/${project.slug}`)}
              onGuide={() => navigate(`/${project.slug}/guide`)}
              onComplete={() => completeLevel(project.levelRequired)}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
            <div style={{ fontSize: 15 }}>No projects match this filter</div>
          </div>
        )}
      </div>
    </div>
  )
}

function ProjectCard({ project, isLocked, isSeqLocked, isCompleted, missingComponents = [], canStart = true, onStart, onGuide, onComplete }) {
  const navigate = useNavigate()
  const diff = DIFFICULTY_CONFIG[project.difficulty]
  const [hovered, setHovered] = useState(false)

  const cardS = {
    card: {
      borderRadius: 14, border: '1px solid var(--border)',
      background: 'var(--bg2)', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      transition: 'all .2s', position: 'relative',
      cursor: isLocked ? 'not-allowed' : 'default',
    },
    cardLocked: { opacity: 0.55 },
    cardCompleted: { borderColor: 'rgba(34,197,94,.35)' },
    cardAccent: { height: 4, flexShrink: 0 },
    cardBody: { padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column' },
    cardTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
    cardNum: { fontSize: 11, fontWeight: 700, color: 'var(--text3)', letterSpacing: '.04em' },
    cardIcon: { fontSize: 22, lineHeight: 1 },
    cardTitle: { fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' },
    cardSub: { fontSize: 12, color: 'var(--text2)', margin: '0 0 10px', lineHeight: 1.5 },
    cardMeta: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 },
    diffPill: { fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5, border: '1px solid', textTransform: 'uppercase', letterSpacing: '.05em' },
    timePill: { fontSize: 10, color: 'var(--text3)', padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'transparent' },
    xpPill: { fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5, border: '1px solid #fbbf2444', color: '#fbbf24', background: '#fbbf2410' },
    cardDesc: { fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, flex: 1, marginBottom: 14 },
    cardTags: { display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 14 },
    tag: { fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(255,255,255,.05)', border: '1px solid var(--border2)', color: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace' },
    cardComponents: { marginBottom: 14 },
    compLabel: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 },
    compChips: { display: 'flex', gap: 4, flexWrap: 'wrap' },
    compChip: { fontSize: 9, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', color: 'var(--text2)', background: 'var(--card)', fontFamily: 'monospace' },
    cardFooter: { padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    startBtn: { flex: 1, padding: '9px 14px', borderRadius: 9, border: 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all .15s' },
    guideBtn: { padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, transition: 'background .15s' },
    lockBadge: { position: 'absolute', top: 12, right: 12, background: 'rgba(7,8,15,.85)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 9px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text3)', backdropFilter: 'blur(4px)' },
    doneBadge: { position: 'absolute', top: 12, right: 12, background: 'rgba(34,197,94,.15)', border: '1px solid rgba(34,197,94,.4)', borderRadius: 8, padding: '4px 9px', fontSize: 11, fontWeight: 700, color: '#22c55e' },
  }

  const effectivelyLocked = isLocked || (!canStart && !isCompleted)
  // Button is only truly disabled (non-clickable) when level-locked.
  // When components are missing the button is clickable to redirect to /components.
  const buttonDisabled = isLocked

  return (
    <div
      style={{
        ...cardS.card,
        ...(effectivelyLocked ? cardS.cardLocked : {}),
        ...(isCompleted ? cardS.cardCompleted : {}),
        ...(hovered && !effectivelyLocked ? {
          borderColor: project.color + '66',
          transform: 'translateY(-2px)',
          boxShadow: `0 8px 32px ${project.color}18`,
        } : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => !effectivelyLocked && onStart()}
    >
      <div style={{ ...cardS.cardAccent, background: project.color }} />

      {isLocked && !isSeqLocked && <div style={cardS.lockBadge}>🔒 Level {project.levelRequired}</div>}
      {isSeqLocked && <div style={{ ...cardS.lockBadge, color: '#a855f7', borderColor: '#a855f740', background: 'rgba(168,85,247,.12)' }}>🔗 Complete previous project</div>}
      {isCompleted && !isLocked && <div style={cardS.doneBadge}>✓ Done</div>}
      {!isLocked && !isSeqLocked && !canStart && !isCompleted && (
        <div style={{ ...cardS.lockBadge, color: '#f59e0b', borderColor: '#f59e0b40', background: 'rgba(245,158,11,.12)' }}>
          🔧 Components needed
        </div>
      )}

      <div style={cardS.cardBody}>
        <div style={cardS.cardTop}>
          <span style={cardS.cardNum}>Project {String(project.number).padStart(2, '0')}</span>
          <span style={cardS.cardIcon}>{project.icon}</span>
        </div>

        <h3 style={cardS.cardTitle}>{project.title}</h3>
        <p style={cardS.cardSub}>{project.subtitle}</p>

        <div style={cardS.cardMeta}>
          <span style={{ ...cardS.diffPill, color: diff.color, background: diff.bg, borderColor: diff.border }}>
            {diff.label}
          </span>
          <span style={cardS.timePill}>⏱ {project.estimatedTime}</span>
          <span style={cardS.xpPill}>+{project.xpReward} XP</span>
        </div>

        <p style={cardS.cardDesc}>{project.description}</p>

        <div style={cardS.cardTags}>
          {project.tags.slice(0, 3).map(t => <span key={t} style={cardS.tag}>{t}</span>)}
        </div>

        {!isLocked && project.requiredComponents?.length > 0 && (
          missingComponents.length > 0 ? (
            <div style={compReqStyles.reqSection} onClick={e => e.stopPropagation()}>
              <div style={compReqStyles.reqTitle}>
                ⚠ Unlock these first ({missingComponents.length})
              </div>
              <div style={compReqStyles.reqChips}>
                {missingComponents.map(c => (
                  <button
                    key={c.id}
                    style={compReqStyles.reqChip}
                    onClick={() => navigate(`/components/${c.id}/theory`)}
                    title={`Study ${c.name} to unlock`}
                  >
                    {c.icon} {c.name} →
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={compReqStyles.allUnlocked}>
              ✅ All components unlocked
            </div>
          )
        )}

        <div style={cardS.cardComponents}>
          <div style={cardS.compLabel}>Components</div>
          <div style={cardS.compChips}>
            {project.components.map(c => (
              <span key={c.type} style={cardS.compChip}>
                {c.qty > 1 ? `${c.qty}× ` : ''}{c.label}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div style={cardS.compLabel}>Concepts</div>
          <div style={cardS.compChips}>
            {project.concepts.slice(0, 4).map(c => (
              <span key={c} style={{ ...cardS.compChip, color: project.color, borderColor: project.color + '44', background: project.color + '0e' }}>
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={cardS.cardFooter} onClick={e => e.stopPropagation()}>
        <button
          style={{
            ...cardS.startBtn,
            background: isLocked
              ? 'var(--border)'
              : isCompleted
                ? 'rgba(34,197,94,.15)'
                : !canStart
                  ? 'rgba(245,158,11,.15)'
                  : project.color,
            color: isLocked
              ? 'var(--text3)'
              : isCompleted
                ? '#22c55e'
                : !canStart
                  ? '#f59e0b'
                  : '#fff',
            border: isCompleted
              ? '1px solid rgba(34,197,94,.4)'
              : !canStart && !isLocked
                ? '1px solid rgba(245,158,11,.3)'
                : 'none',
            cursor: isLocked ? 'not-allowed' : 'pointer',
          }}
          disabled={buttonDisabled}
          onClick={
            isLocked ? undefined
            : !canStart ? () => navigate('/components')
            : onStart
          }
        >
          {isLocked
            ? '🔒 Locked'
            : !canStart
              ? '🔧 Unlock Components First'
              : isCompleted
                ? '↺ Try Again'
                : '▶ Start Project'
          }
        </button>
        {!isLocked && canStart && (
          <button style={cardS.guideBtn} onClick={onGuide}>📖 Guide</button>
        )}
        {!isLocked && !canStart && (
          <button style={{ ...cardS.guideBtn, fontSize: 11 }} onClick={onGuide}>📖 Guide</button>
        )}
      </div>
    </div>
  )
}