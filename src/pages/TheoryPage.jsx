import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useGamification } from '../context/GamificationContext'
import { COMPONENT_MAP } from '../services/gamification/ComponentsConfig'

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontFamily: "'Space Grotesk', sans-serif",
    padding: '0 0 80px',
  },

  // Top bar
  topBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 24px', borderBottom: '1px solid var(--border)',
    background: 'var(--bg2)', position: 'sticky', top: 0, zIndex: 10,
    backdropFilter: 'blur(12px)',
  },
  backBtn: {
    padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'transparent', color: 'var(--text2)', fontFamily: 'inherit',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  progressTrack: {
    flex: 1, maxWidth: 300, height: 4, borderRadius: 999,
    background: 'var(--border)', overflow: 'hidden', margin: '0 20px',
  },
  progressFill: {
    height: '100%', borderRadius: 999, transition: 'width .4s ease',
  },
  topBarRight: { display: 'flex', alignItems: 'center', gap: 10 },
  sectionCounter: { fontSize: 12, color: 'var(--text3)' },

  // Hero
  hero: {
    padding: '48px 24px 32px',
    borderBottom: '1px solid var(--border)',
    background: 'linear-gradient(180deg, var(--bg2) 0%, var(--bg) 100%)',
  },
  heroInner: { maxWidth: 720, margin: '0 auto' },
  compIcon: { fontSize: 52, lineHeight: 1, marginBottom: 16, display: 'block' },
  compLabel: {
    fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
    padding: '4px 10px', borderRadius: 6, border: '1px solid',
    display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12,
  },
  heroTitle: { fontSize: 30, fontWeight: 800, margin: '0 0 6px', lineHeight: 1.2 },
  heroSub: { fontSize: 14, color: 'var(--text2)', margin: '0 0 20px' },
  heroMeta: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  metaPill: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 12, color: 'var(--text3)',
    background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 7, padding: '5px 12px',
  },

  // Content
  content: { maxWidth: 720, margin: '0 auto', padding: '40px 24px' },

  section: {
    marginBottom: 40, padding: '24px 28px',
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 14, position: 'relative', overflow: 'hidden',
  },
  sectionNum: {
    position: 'absolute', top: 20, right: 20,
    fontSize: 48, fontWeight: 900, opacity: 0.06, lineHeight: 1,
    color: 'var(--text)', pointerEvents: 'none',
  },
  sectionTitle: {
    fontSize: 17, fontWeight: 700, marginBottom: 14,
    display: 'flex', alignItems: 'center', gap: 10,
  },
  sectionDot: {
    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
  },
  sectionContent: {
    fontSize: 13, color: 'var(--text2)', lineHeight: 1.85,
    whiteSpace: 'pre-line', fontFamily: 'inherit',
  },

  // Code-like blocks (lines starting with •)
  readStatus: {
    display: 'flex', alignItems: 'center', gap: 8, marginTop: 16,
    fontSize: 11, color: 'var(--text3)',
    padding: '8px 12px', borderRadius: 8,
    background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.15)',
  },

  // Quiz CTA
  quizCTA: {
    marginTop: 48, padding: '32px',
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 16, textAlign: 'center',
  },
  quizTitle: { fontSize: 22, fontWeight: 700, marginBottom: 8 },
  quizSub: { fontSize: 14, color: 'var(--text2)', marginBottom: 24 },
  quizStats: { display: 'flex', gap: 20, justifyContent: 'center', marginBottom: 28, flexWrap: 'wrap' },
  quizStatItem: { textAlign: 'center' },
  quizStatVal: { fontSize: 24, fontWeight: 800 },
  quizStatLbl: { fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' },
  startQuizBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '13px 32px', borderRadius: 10, border: 'none',
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
    transition: 'all .15s', fontFamily: 'inherit',
    color: '#fff',
  },

  // Already unlocked notice
  unlockedNotice: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '16px 20px', borderRadius: 12,
    background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.25)',
    marginBottom: 28,
  },
  unlockedText: { fontSize: 14, color: '#22c55e', fontWeight: 600 },
  unlockedSub: { fontSize: 12, color: 'var(--text3)' },
}

// Renders content with code-like formatting for lines starting with spaces
function ContentBlock({ text, color }) {
  const lines = text.split('\n')
  return (
    <div>
      {lines.map((line, i) => {
        const isBullet = line.trimStart().startsWith('•')
        const isCode = line.startsWith('  ') && !isBullet
        const isEmpty = line.trim() === ''

        if (isEmpty) return <br key={i} />
        if (isCode) return (
          <div key={i} style={{
            fontFamily: 'JetBrains Mono, Consolas, monospace',
            fontSize: 12, color: color, lineHeight: 1.7,
            background: color + '10', border: `1px solid ${color}22`,
            borderRadius: 5, padding: '2px 8px', margin: '2px 0',
            whiteSpace: 'pre',
          }}>{line}</div>
        )
        if (isBullet) return (
          <div key={i} style={{
            ...S.sectionContent,
            paddingLeft: 16, position: 'relative',
          }}>
            <span style={{ position: 'absolute', left: 4, color: color }}>▸</span>
            {line.replace(/^[\s•]+/, '')}
          </div>
        )
        return <div key={i} style={S.sectionContent}>{line}</div>
      })}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TheoryPage() {
  const { componentId } = useParams()
  const navigate = useNavigate()
  const { unlockedComponents = [] } = useGamification()

  const comp = COMPONENT_MAP[componentId]
  const [readSections, setReadSections] = useState(new Set())
  const [currentSection, setCurrentSection] = useState(0)

  const isUnlocked = unlockedComponents.includes(componentId)
  const totalSections = comp?.theory?.sections?.length ?? 0
  const allRead = readSections.size >= totalSections
  const progress = totalSections > 0 ? (readSections.size / totalSections) * 100 : 0

  // Mark section as read when scrolled into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = parseInt(entry.target.dataset.sectionIdx)
            if (!isNaN(idx)) {
              setReadSections(prev => new Set([...prev, idx]))
            }
          }
        })
      },
      { threshold: 0.5 }
    )
    document.querySelectorAll('[data-section-idx]').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [comp])

  if (!comp) {
    return (
      <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
          <div>Component not found</div>
          <button onClick={() => navigate('/components')} style={{ marginTop: 16, ...S.backBtn }}>
            ← Back to Components
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={S.page}>
      {/* ── Sticky top bar ─────────────────────────────────────────── */}
      <div style={S.topBar}>
        <button style={S.backBtn} onClick={() => navigate('/components')}>
          ← Components
        </button>
        <div style={S.progressTrack}>
          <div style={{ ...S.progressFill, width: `${progress}%`, background: comp.color }} />
        </div>
        <div style={S.topBarRight}>
          <span style={S.sectionCounter}>
            {readSections.size}/{totalSections} sections
          </span>
          {allRead && (
            <button
              style={{
                padding: '7px 16px', borderRadius: 8, border: 'none',
                background: comp.color, color: '#fff', fontFamily: 'inherit',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
              onClick={() => navigate(`/components/${componentId}/quiz`)}
            >
              Take Quiz →
            </button>
          )}
        </div>
      </div>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <div style={S.hero}>
        <div style={S.heroInner}>
          <span style={S.compIcon}>{comp.icon}</span>
          <div style={{
            ...S.compLabel,
            color: comp.color,
            background: comp.color + '15',
            borderColor: comp.color + '40',
          }}>
            {comp.category} Component
          </div>
          <h1 style={S.heroTitle}>{comp.name}</h1>
          <p style={S.heroSub}>{comp.fullName}</p>

          <div style={S.heroMeta}>
            <div style={S.metaPill}>⏱ {comp.theory.readTime} read</div>
            <div style={S.metaPill}>📝 {comp.quiz.questions.length} quiz questions</div>
            <div style={{ ...S.metaPill, color: '#fbbf24', borderColor: '#fbbf2430', background: '#fbbf2408' }}>
              ⭐ +{comp.xpReward} XP on unlock
            </div>
            <div style={{ ...S.metaPill, color: '#f59e0b', borderColor: '#f59e0b30', background: '#f59e0b08' }}>
              🪙 +{comp.coinReward} coins
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────── */}
      <div style={S.content}>
        {/* Already unlocked notice */}
        {isUnlocked && (
          <div style={S.unlockedNotice}>
            <span style={{ fontSize: 24 }}>✅</span>
            <div>
              <div style={S.unlockedText}>You've already unlocked {comp.name}!</div>
              <div style={S.unlockedSub}>Reviewing theory is always a good idea. You can retake the quiz from the components page.</div>
            </div>
          </div>
        )}

        {/* Theory sections */}
        {comp.theory.sections.map((section, idx) => (
          <div
            key={idx}
            data-section-idx={idx}
            style={{
              ...S.section,
              borderColor: readSections.has(idx) ? comp.color + '40' : 'var(--border)',
              borderLeftWidth: 3,
              borderLeftColor: readSections.has(idx) ? comp.color : 'var(--border)',
            }}
          >
            <div style={S.sectionNum}>{idx + 1}</div>

            <div style={S.sectionTitle}>
              <div style={{ ...S.sectionDot, background: readSections.has(idx) ? comp.color : 'var(--text3)' }} />
              {section.title}
            </div>

            <ContentBlock text={section.content} color={comp.color} />

            {readSections.has(idx) && (
              <div style={S.readStatus}>
                <span style={{ color: '#22c55e' }}>✓</span>
                Section read
              </div>
            )}
          </div>
        ))}

        {/* ── Quiz CTA ─────────────────────────────────────────────── */}
        <div style={S.quizCTA}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
          <div style={S.quizTitle}>
            {allRead ? 'Ready to take the quiz!' : `Read all ${totalSections} sections first`}
          </div>
          <div style={S.quizSub}>
            {allRead
              ? `Pass with ${comp.quiz.passingScore}% or higher to unlock ${comp.name}`
              : `${totalSections - readSections.size} section${totalSections - readSections.size !== 1 ? 's' : ''} remaining. Scroll down to read them.`
            }
          </div>

          <div style={S.quizStats}>
            {[
              { val: comp.quiz.questions.length, lbl: 'Questions', color: 'var(--text)' },
              { val: `${comp.quiz.passingScore}%`, lbl: 'Pass mark', color: comp.color },
              { val: `+${comp.xpReward}`, lbl: 'XP reward', color: '#fbbf24' },
              { val: `+${comp.coinReward}`, lbl: 'Coins', color: '#f59e0b' },
            ].map(s => (
              <div key={s.lbl} style={S.quizStatItem}>
                <div style={{ ...S.quizStatVal, color: s.color }}>{s.val}</div>
                <div style={S.quizStatLbl}>{s.lbl}</div>
              </div>
            ))}
          </div>

          <button
            style={{
              ...S.startQuizBtn,
              background: allRead ? comp.color : 'var(--border)',
              color: allRead ? '#fff' : 'var(--text3)',
              cursor: allRead ? 'pointer' : 'not-allowed',
              boxShadow: allRead ? `0 4px 20px ${comp.color}44` : 'none',
            }}
            disabled={!allRead && !isUnlocked}
            onClick={() => navigate(`/components/${componentId}/quiz`)}
          >
            {isUnlocked ? '🔄 Retake Quiz' : allRead ? '▶ Start Quiz' : `📖 Read ${totalSections - readSections.size} more section${totalSections - readSections.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}