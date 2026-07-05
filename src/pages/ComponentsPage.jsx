
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Sun, Moon } from 'lucide-react'
import { useGamification } from '../context/GamificationContext'
import { COMPONENTS } from '../services/gamification/ComponentsConfig'
import { PROJECTS } from '../services/gamification/ProjectsConfig'
import { STARTING_COMPONENTS } from '../services/gamification/GamificationConfig.jsx'

// ── Which project unlocks which component? ────────────────────────────────────
function findUnlockProject(componentType) {
  // Normalize the component type (remove both prefixes for comparison)
  const norm = (t) => String(t || '').replace('openhw-', '').replace('wokwi-', '');
  for (const project of PROJECTS) {
    for (const reward of (project.rewardComponents || [])) {
      if (reward.type === '*') return project;
      // Compare both normalized forms
      if (norm(reward.type) === norm(componentType)) {
        return project;
      }
    }
  }
  return null;
}

// ── Theme Palettes ─────────────────────────────────────────────────────────────
const themeColors = {
  dark: {
    pageBg: 'linear-gradient(135deg, #0d1117 0%, #111827 50%, #0d1117 100%)',
    textColor: '#e2e8f0',
    subText: '#94a3b8',
    headerBg: 'rgba(13, 17, 23, 0.95)',
    headerBorder: 'rgba(255, 255, 255, 0.08)',
    heroTitle: 'linear-gradient(90deg, #34d399, #3b82f6, #a78bfa)',
    progressBg: 'rgba(52, 211, 153, 0.06)',
    progressBorder: 'rgba(52, 211, 153, 0.2)',
    cardBgOwned: 'linear-gradient(135deg, rgba(52,211,153,0.08), rgba(59,130,246,0.06))',
    cardBorderOwned: 'rgba(52,211,153,0.25)',
    cardBgNext: 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(245,158,11,0.06))',
    cardBorderNext: 'rgba(251,191,36,0.3)',
    cardBgLocked: 'rgba(255,255,255,0.02)',
    cardBorderLocked: 'rgba(255,255,255,0.06)',
    cardName: '#f1f5f9',
    cardFull: '#64748b',
    cardDesc: '#94a3b8',
    cardTheoryBg: 'rgba(255,255,255,0.04)',
    cardTheoryBorder: 'rgba(255,255,255,0.06)',
    cardTheoryText: '#64748b',
    backBtnBg: 'rgba(255, 255, 255, 0.06)',
    backBtnBorder: 'rgba(255, 255, 255, 0.1)',
    backBtnText: '#94a3b8',
    learnBtnBg: 'rgba(255,255,255,0.06)',
    learnBtnBorder: 'rgba(255,255,255,0.1)',
    learnBtnText: '#e2e8f0',
    sectionTitleLocked: '#475569',
    sectionBadgeLockedBg: 'rgba(255,255,255,0.04)',
    sectionBadgeLockedBorder: 'rgba(255,255,255,0.08)',
    sectionBadgeLockedText: '#475569',
  },
  light: {
    pageBg: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #f8fafc 100%)',
    textColor: '#1e293b',
    subText: '#475569',
    headerBg: 'rgba(255, 255, 255, 0.95)',
    headerBorder: 'rgba(0, 0, 0, 0.08)',
    heroTitle: 'linear-gradient(90deg, #059669, #2563eb, #7c3aed)',
    progressBg: 'rgba(52, 211, 153, 0.1)',
    progressBorder: 'rgba(52, 211, 153, 0.4)',
    cardBgOwned: 'linear-gradient(135deg, rgba(52,211,153,0.12), rgba(59,130,246,0.08))',
    cardBorderOwned: 'rgba(52,211,153,0.4)',
    cardBgNext: 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(245,158,11,0.08))',
    cardBorderNext: 'rgba(251,191,36,0.5)',
    cardBgLocked: 'rgba(0,0,0,0.02)',
    cardBorderLocked: 'rgba(0,0,0,0.08)',
    cardName: '#0f172a',
    cardFull: '#475569',
    cardDesc: '#334155',
    cardTheoryBg: 'rgba(0,0,0,0.03)',
    cardTheoryBorder: 'rgba(0,0,0,0.06)',
    cardTheoryText: '#475569',
    backBtnBg: 'rgba(0,0,0,0.04)',
    backBtnBorder: 'rgba(0,0,0,0.08)',
    backBtnText: '#475569',
    learnBtnBg: 'rgba(0,0,0,0.04)',
    learnBtnBorder: 'rgba(0,0,0,0.08)',
    learnBtnText: '#1e293b',
    sectionTitleLocked: '#64748b',
    sectionBadgeLockedBg: 'rgba(0,0,0,0.03)',
    sectionBadgeLockedBorder: 'rgba(0,0,0,0.06)',
    sectionBadgeLockedText: '#64748b',
  }
}

// ── Style Builder ──────────────────────────────────────────────────────────────
function getStyles(theme) {
  const p = themeColors[theme] || themeColors.dark
  return {
    page: {
      minHeight: '100vh',
      background: p.pageBg,
      color: p.textColor,
      fontFamily: "'Nunito', 'Fredoka One', system-ui, sans-serif",
      padding: '0 0 80px',
      transition: 'background 0.3s ease, color 0.3s ease',
    },
    header: {
      background: p.headerBg,
      backdropFilter: 'blur(16px)',
      borderBottom: `1px solid ${p.headerBorder}`,
      padding: '0 24px',
      position: 'sticky', top: 0, zIndex: 100,
      transition: 'background 0.3s ease, border-color 0.3s ease',
    },
    headerInner: {
      maxWidth: 1100, margin: '0 auto',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64,
    },
    backBtn: {
      background: p.backBtnBg,
      border: `1px solid ${p.backBtnBorder}`,
      borderRadius: 8, padding: '6px 14px',
      color: p.backBtnText, cursor: 'pointer',
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
      background: p.heroTitle,
      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      lineHeight: 1.2,
    },
    heroSub: {
      fontSize: 16, color: p.subText, margin: '0 0 28px', lineHeight: 1.6,
    },
    progressBanner: {
      display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
      background: p.progressBg,
      border: `1px solid ${p.progressBorder}`,
      borderRadius: 16, padding: '18px 24px', marginBottom: 32,
      transition: 'background 0.3s ease, border-color 0.3s ease',
    },
    progressIcon: {
      fontSize: 36, flexShrink: 0,
    },
    progressText: { flex: 1 },
    progressTitle: { fontSize: 18, fontWeight: 800, color: '#34d399', margin: '0 0 4px' },
    progressDesc: { fontSize: 13, color: p.subText, margin: 0 },
    progressCount: {
      textAlign: 'right', flexShrink: 0,
    },
    progressNum: { fontSize: 32, fontWeight: 900, color: '#34d399' },
    progressTotal: { fontSize: 13, color: p.subText },
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
      background: p.cardBgOwned,
      border: `1px solid ${p.cardBorderOwned}`,
    },
    cardNext: {
      background: p.cardBgNext,
      border: `1px solid ${p.cardBorderNext}`,
    },
    cardLocked: {
      background: p.cardBgLocked,
      border: `1px solid ${p.cardBorderLocked}`,
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
    cardName: { fontSize: 16, fontWeight: 800, margin: '0 0 3px', color: p.cardName },
    cardFull: { fontSize: 11, color: p.cardFull, margin: '0 0 6px', fontWeight: 600, letterSpacing: '.03em' },
    cardCat: {
      fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
      padding: '2px 8px', borderRadius: 5,
    },
    cardDesc: { fontSize: 13, color: p.cardDesc, lineHeight: 1.5, margin: '0 0 12px' },
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
      fontSize: 12, fontWeight: 600, color: p.subText,
      background: p.cardTheoryBg,
      border: `1px solid ${p.cardTheoryBorder}`,
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
      fontSize: 12, fontWeight: 700, color: p.learnBtnText,
      background: p.learnBtnBg,
      border: `1px solid ${p.learnBtnBorder}`,
      cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
    },
  }
}


export default function ComponentsPage() {
  const navigate = useNavigate('/adventure')
  const { unlockedComponentTypes, completedProjects, currentLevel, xp } = useGamification()
  const [expandedCard, setExpandedCard] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
  }

  const S = getStyles(theme)
  const p = themeColors[theme] || themeColors.dark

  const isAllUnlocked = unlockedComponentTypes === '*'
  const unlockedSet = isAllUnlocked ? null : new Set(Array.isArray(unlockedComponentTypes) ? unlockedComponentTypes : [])

  const isOwned = (wokwiType) => {
    if (isAllUnlocked) return true
    // Check both openhw-* and wokwi-* formats
    const altType = wokwiType?.startsWith('openhw-')
      ? `wokwi-${wokwiType.slice(7)}`
      : wokwiType?.startsWith('wokwi-')
        ? `openhw-${wokwiType.slice(6)}`
        : null
    return unlockedSet?.has(wokwiType) || unlockedSet?.has(altType)
  }

  // Which project will unlock this component next?
  const getUnlocker = (wokwiType) => findUnlockProject(wokwiType)

  // Next project the player should complete (first available, incomplete)
  const nextProject = PROJECTS.find(p => !completedProjects.includes(p.slug) &&
    (!p.prerequisite || completedProjects.includes(p.prerequisite)))

  // Categorize components
  const ownedComponents = COMPONENTS.filter(c => isOwned(c.wokwiType))
  const nextComponents = COMPONENTS.filter(c => {
    if (isOwned(c.wokwiType)) return false
    const unlocker = getUnlocker(c.wokwiType)
    return unlocker && unlocker.slug === nextProject?.slug
  })
  const lockedComponents = COMPONENTS.filter(c => {
    if (isOwned(c.wokwiType)) return false
    const unlocker = getUnlocker(c.wokwiType)
    return !unlocker || unlocker.slug !== nextProject?.slug
  })

  const totalOwned = ownedComponents.length

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.headerInner}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button style={S.backBtn} onClick={() => navigate('/adventure')}>
              <ArrowLeft size={16} />
              <span>Back to Map</span>
            </button>
            <span style={S.logo}>⚡ My Components</span>
          </div>

          <button
            onClick={toggleTheme}
            style={{
              background: theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              border: theme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
              borderRadius: 10,
              width: 38,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: theme === 'dark' ? '#fbbf24' : '#6366f1',
              transition: 'all 0.2s',
            }}
            title={theme === 'dark' ? 'Switch to Bright Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={18} fill="#fbbf24" stroke="none" /> : <Moon size={18} fill="#6366f1" stroke="none" />}
          </button>
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
              theme={theme}
              isStarting={isOwned(comp.wokwiType) && STARTING_COMPONENTS.some(s => s === comp.wokwiType || s === `wokwi-${comp.id}` || s === `openhw-${comp.id}`)}
              expanded={expandedCard === comp.id}
              onToggle={() => setExpandedCard(expandedCard === comp.id ? null : comp.id)}
              onLearn={() => navigate('/adventure')}
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
                theme={theme}
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
            <h2 style={{ ...S.sectionTitle, color: p.sectionTitleLocked }}>🔒 Still Locked</h2>
            <span style={{ ...S.sectionBadge, background: p.sectionBadgeLockedBg, color: p.sectionBadgeLockedText, border: `1px solid ${p.sectionBadgeLockedBorder}` }}>
              Keep completing projects!
            </span>
          </div>
          <div style={S.grid}>
            {lockedComponents.map(comp => {
              const unlocker = getUnlocker(comp.wokwiType)
              return (
                <ComponentCard
                  key={comp.id}
                  comp={comp}
                  status="locked"
                  theme={theme}
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
function ComponentCard({ comp, status, isStarting, unlocker, expanded, onToggle, onLearn, onGoToProject, theme }) {
  const S = getStyles(theme)
  const p = themeColors[theme] || themeColors.dark

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
    transition: 'all 0.3s ease',
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
            background: p.cardTheoryBg,
            borderRadius: 10, border: `1px solid ${p.cardTheoryBorder}`,
            transition: 'background 0.3s ease, border-color 0.3s ease',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: p.cardFull, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            {comp.theory.sections[0].title}
          </div>
          <div style={{ fontSize: 12, color: p.cardTheoryText, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {comp.theory.sections[0].content.slice(0, 200)}…
          </div>
        </div>
      )}
    </div>
  )
}
