// ─── ComponentsPage.jsx ───────────────────────────────────────────────────────
// Displays all Arduino components in a gallery.
// Locked → read theory → take quiz → unlock → earn XP + coins
// Usage: <ComponentsPage /> at route /components

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGamification } from '../context/GamificationContext'
import { COMPONENTS, CATEGORIES } from '../services/gamification/ComponentsConfig'

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontFamily: "'Space Grotesk', sans-serif",
    padding: '48px 24px 80px',
  },
  inner: { maxWidth: 1100, margin: '0 auto' },

  sectionTag: {
    fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
    color: 'var(--accent)', background: 'rgba(0,180,255,.08)',
    border: '1px solid rgba(0,180,255,.2)', borderRadius: 6,
    padding: '4px 10px', display: 'inline-block', marginBottom: 10,
  },
  title: { fontSize: 32, fontWeight: 700, margin: '0 0 8px', lineHeight: 1.2 },
  subtitle: { fontSize: 15, color: 'var(--text2)', lineHeight: 1.6, margin: '0 0 28px' },

  // Stats bar
  statsBar: {
    display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28,
  },
  statCard: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '12px 18px',
  },
  statIcon: { fontSize: 22 },
  statVal: { fontSize: 20, fontWeight: 800, color: 'var(--text)', lineHeight: 1 },
  statLbl: { fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' },

  // Coins banner
  coinsBanner: {
    display: 'flex', alignItems: 'center', gap: 14,
    background: 'linear-gradient(135deg, #fbbf2412, #f59e0b08)',
    border: '1px solid #fbbf2430', borderRadius: 12,
    padding: '14px 20px', marginBottom: 28,
  },
  coinIcon: { fontSize: 32, lineHeight: 1 },
  coinVal: { fontSize: 28, fontWeight: 800, color: '#fbbf24', lineHeight: 1 },
  coinSub: { fontSize: 12, color: 'var(--text3)' },

  // Filters
  filters: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 },
  filterBtn: {
    padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'transparent', color: 'var(--text2)', fontFamily: 'inherit',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
  },
  filterActive: { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'rgba(0,180,255,.06)' },

  // Grid
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
    gap: 16,
  },

  // Card
  card: {
    borderRadius: 14, border: '1px solid var(--border)',
    background: 'var(--bg2)', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    transition: 'all .2s', position: 'relative',
  },
  cardLocked: { opacity: 0.6 },
  cardUnlocked: {},

  accentBar: { height: 3, flexShrink: 0 },
  cardBody: { padding: '18px', flex: 1, display: 'flex', flexDirection: 'column' },

  cardHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  cardIcon: { fontSize: 28, lineHeight: 1 },
  catPill: {
    fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em',
    padding: '3px 8px', borderRadius: 4, border: '1px solid',
  },

  cardTitle: { fontSize: 15, fontWeight: 700, margin: '0 0 2px', color: 'var(--text)' },
  cardSub: { fontSize: 11, color: 'var(--text3)', margin: '0 0 10px', fontStyle: 'italic' },
  cardDesc: { fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, flex: 1, marginBottom: 14 },

  // Rewards row
  rewards: { display: 'flex', gap: 6, marginBottom: 14 },
  rewardPill: {
    fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 5,
    display: 'flex', alignItems: 'center', gap: 4,
  },

  // Projects using this
  usedIn: { marginBottom: 14 },
  usedInLabel: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 },
  projectChips: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  projectChip: {
    fontSize: 10, padding: '2px 7px', borderRadius: 4,
    background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)',
    color: 'var(--text3)', fontFamily: 'monospace',
  },

  // Footer
  cardFooter: {
    padding: '12px 18px',
    borderTop: '1px solid var(--border)',
    display: 'flex', gap: 8,
  },
  btn: {
    flex: 1, padding: '9px 12px', borderRadius: 9,
    border: 'none', fontFamily: 'inherit',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
    transition: 'all .15s', textAlign: 'center',
  },
  btnSecondary: {
    padding: '9px 12px', borderRadius: 9,
    border: '1px solid var(--border)', background: 'transparent',
    color: 'var(--text2)', fontFamily: 'inherit',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    transition: 'background .15s',
  },

  // Lock badge
  lockBadge: {
    position: 'absolute', top: 10, right: 10,
    background: 'rgba(0,0,0,.7)', border: '1px solid var(--border)',
    borderRadius: 7, padding: '3px 8px',
    fontSize: 10, color: 'var(--text3)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', gap: 4,
  },
  // Unlocked badge
  unlockedBadge: {
    position: 'absolute', top: 10, right: 10,
    background: 'rgba(34,197,94,.15)', border: '1px solid rgba(34,197,94,.4)',
    borderRadius: 7, padding: '3px 9px',
    fontSize: 10, fontWeight: 700, color: '#22c55e',
  },
}

const CATEGORY_COLORS = {
  Output: '#f59e0b',
  Input: '#06b6d4',
  Sensor: '#ef4444',
  Actuator: '#84cc16',
  Passive: '#8b5cf6',
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ComponentsPage() {
  const navigate = useNavigate()
  const [category, setCategory] = useState('All')
  const [hoveredId, setHoveredId] = useState(null)
  const {
    unlockedComponents = [],
    coins = 0,
    currentLevel,
  } = useGamification()

  const filtered = useMemo(() =>
    COMPONENTS.filter(c => category === 'All' || c.category === category),
    [category]
  )

  const unlockedCount = COMPONENTS.filter(c => unlockedComponents.includes(c.id)).length
  const totalXPFromComponents = COMPONENTS
    .filter(c => unlockedComponents.includes(c.id))
    .reduce((a, c) => a + c.xpReward, 0)
  const totalCoinsFromComponents = COMPONENTS
    .filter(c => unlockedComponents.includes(c.id))
    .reduce((a, c) => a + c.coinReward, 0)

  return (
    <div style={S.page}>
      <div style={S.inner}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          <div>
            <div style={S.sectionTag}>Component Library</div>
            <h1 style={S.title}>Arduino Components</h1>
            <p style={S.subtitle}>
              Study the theory, pass the quiz, unlock the component.
              Unlocked components grant access to projects that use them.
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            style={{ ...S.filterBtn, flexShrink: 0, alignSelf: 'flex-start' }}
          >← Back</button>
        </div>

        {/* ── Coins banner ───────────────────────────────────────────── */}
        <div style={S.coinsBanner}>
          <div style={S.coinIcon}>🪙</div>
          <div>
            <div style={S.coinVal}>{coins.toLocaleString()}</div>
            <div style={S.coinSub}>coins earned · spend in the shop</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              {totalCoinsFromComponents} coins from components
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{totalXPFromComponents} XP earned</div>
          </div>
        </div>

        {/* ── Stats ──────────────────────────────────────────────────── */}
        <div style={S.statsBar}>
          {[
            { icon: '🔓', label: 'Unlocked', val: `${unlockedCount} / ${COMPONENTS.length}` },
            { icon: '🔒', label: 'Locked', val: COMPONENTS.length - unlockedCount },
            { icon: '⭐', label: 'Level', val: currentLevel },
          ].map(s => (
            <div key={s.label} style={S.statCard}>
              <div style={S.statIcon}>{s.icon}</div>
              <div>
                <div style={S.statVal}>{s.val}</div>
                <div style={S.statLbl}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Category filters ───────────────────────────────────────── */}
        <div style={S.filters}>
          {['All', 'Output', 'Input', 'Sensor', 'Actuator', 'Passive'].map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{ ...S.filterBtn, ...(category === cat ? S.filterActive : {}) }}
            >{cat}</button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)', alignSelf: 'center' }}>
            {filtered.length} component{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* ── Grid ───────────────────────────────────────────────────── */}
        <div style={S.grid}>
          {filtered.map(comp => {
            const isUnlocked = unlockedComponents.includes(comp.id)
            const isAvailable = comp.levelRequired <= currentLevel
            const hovered = hoveredId === comp.id
            const catColor = CATEGORY_COLORS[comp.category] || comp.color

            return (
              <div
                key={comp.id}
                style={{
                  ...S.card,
                  ...(!isUnlocked ? S.cardLocked : {}),
                  ...(hovered && isAvailable ? {
                    borderColor: comp.color + '66',
                    transform: 'translateY(-2px)',
                    boxShadow: `0 8px 24px ${comp.color}18`,
                  } : {}),
                }}
                onMouseEnter={() => setHoveredId(comp.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Accent bar */}
                <div style={{ ...S.accentBar, background: comp.color }} />

                {/* Status badge */}
                {isUnlocked ? (
                  <div style={S.unlockedBadge}>✓ Unlocked</div>
                ) : !isAvailable ? (
                  <div style={S.lockBadge}>🔒 Lvl {comp.levelRequired}</div>
                ) : (
                  <div style={{ ...S.lockBadge, color: '#fbbf24', borderColor: '#fbbf2440', background: 'rgba(251,191,36,.1)' }}>
                    📖 Study to unlock
                  </div>
                )}

                {/* Body */}
                <div style={S.cardBody}>
                  <div style={S.cardHeader}>
                    <span style={S.cardIcon}>{comp.icon}</span>
                    <span style={{
                      ...S.catPill,
                      color: catColor,
                      background: catColor + '15',
                      borderColor: catColor + '40',
                    }}>{comp.category}</span>
                  </div>

                  <h3 style={S.cardTitle}>{comp.name}</h3>
                  <p style={S.cardSub}>{comp.fullName}</p>
                  <p style={S.cardDesc}>{comp.description}</p>

                  {/* Rewards */}
                  <div style={S.rewards}>
                    <span style={{
                      ...S.rewardPill,
                      background: '#fbbf2412', border: '1px solid #fbbf2430', color: '#fbbf24',
                    }}>⭐ +{comp.xpReward} XP</span>
                    <span style={{
                      ...S.rewardPill,
                      background: '#f59e0b12', border: '1px solid #f59e0b30', color: '#f59e0b',
                    }}>🪙 +{comp.coinReward} coins</span>
                    <span style={{
                      ...S.rewardPill,
                      background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text3)',
                    }}>⏱ {comp.theory.readTime} read</span>
                  </div>

                  {/* Used in projects */}
                  <div style={S.usedIn}>
                    <div style={S.usedInLabel}>Used in</div>
                    <div style={S.projectChips}>
                      {comp.usedInProjects.map(p => (
                        <span key={p} style={S.projectChip}>{p}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div style={S.cardFooter} onClick={e => e.stopPropagation()}>
                  {isUnlocked ? (
                    <>
                      <button
                        style={{ ...S.btn, background: comp.color + '22', color: comp.color, border: `1px solid ${comp.color}44` }}
                        onClick={() => navigate(`/components/${comp.id}/theory`)}
                      >📖 Review Theory</button>
                      <button
                        style={{ ...S.btn, background: '#22c55e1a', color: '#22c55e', border: '1px solid rgba(34,197,94,.3)' }}
                        onClick={() => navigate(`/components/${comp.id}/quiz`)}
                      >🔄 Retake Quiz</button>
                    </>
                  ) : isAvailable ? (
                    <button
                      style={{ ...S.btn, background: comp.color, color: '#fff' }}
                      onClick={() => navigate(`/components/${comp.id}/theory`)}
                    >📖 Start Learning →</button>
                  ) : (
                    <button style={{ ...S.btn, background: 'var(--border)', color: 'var(--text3)', cursor: 'not-allowed' }} disabled>
                      🔒 Requires Level {comp.levelRequired}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}