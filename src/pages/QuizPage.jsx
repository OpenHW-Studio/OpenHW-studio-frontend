import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useGamification } from '../context/GamificationContext'
import { COMPONENT_MAP } from '../services/gamification/ComponentsConfig'

const S = {
  page: {
    minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)',
    fontFamily: "'Space Grotesk', sans-serif", padding: '0 0 80px',
  },

  // Top bar
  topBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 24px', borderBottom: '1px solid var(--border)',
    background: 'var(--bg2)', position: 'sticky', top: 0, zIndex: 10,
  },
  backBtn: {
    padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'transparent', color: 'var(--text2)', fontFamily: 'inherit',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  timerBadge: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 14px', borderRadius: 8,
    fontSize: 13, fontWeight: 700,
  },
  qProgress: { fontSize: 12, color: 'var(--text3)' },

  // Question area
  inner: { maxWidth: 680, margin: '0 auto', padding: '48px 24px' },

  // Component badge
  compBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '8px 16px', borderRadius: 10, border: '1px solid',
    fontSize: 13, fontWeight: 600, marginBottom: 28,
  },

  // Progress dots
  dotRow: { display: 'flex', gap: 8, marginBottom: 36 },
  dot: {
    height: 6, borderRadius: 999, transition: 'all .3s',
  },

  questionCard: {
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 16, padding: '28px 32px', marginBottom: 24,
  },
  qNum: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text3)', marginBottom: 12 },
  qText: { fontSize: 18, fontWeight: 700, lineHeight: 1.5, margin: 0 },

  // Options
  options: { display: 'flex', flexDirection: 'column', gap: 10 },
  option: {
    padding: '14px 18px', borderRadius: 11,
    border: '1px solid var(--border)', background: 'var(--bg2)',
    fontFamily: 'inherit', fontSize: 14, fontWeight: 500,
    color: 'var(--text)', cursor: 'pointer',
    transition: 'all .15s', textAlign: 'left',
    display: 'flex', alignItems: 'center', gap: 12,
  },
  optLetter: {
    width: 26, height: 26, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700, flexShrink: 0,
    background: 'var(--border)', color: 'var(--text2)',
  },

  // Explanation box
  explanation: {
    padding: '16px 20px', borderRadius: 10,
    fontSize: 13, lineHeight: 1.6, marginTop: 16,
    display: 'flex', gap: 10, alignItems: 'flex-start',
  },

  nextBtn: {
    width: '100%', padding: '14px', borderRadius: 11,
    border: 'none', fontSize: 15, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all .15s', marginTop: 20,
  },

  // Results screen
  results: {
    textAlign: 'center', padding: '48px 24px',
    maxWidth: 560, margin: '0 auto',
  },
  resultIcon: { fontSize: 72, marginBottom: 20 },
  resultTitle: { fontSize: 28, fontWeight: 800, marginBottom: 8 },
  resultSub: { fontSize: 15, color: 'var(--text2)', marginBottom: 32 },

  scoreCircle: {
    width: 120, height: 120, borderRadius: '50%',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 32px', border: '3px solid',
  },
  scoreNum: { fontSize: 30, fontWeight: 900, lineHeight: 1 },
  scoreLbl: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 },

  // Rewards earned
  rewardBanner: {
    display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap',
    marginBottom: 32,
  },
  rewardItem: {
    padding: '14px 24px', borderRadius: 12, border: '1px solid',
    textAlign: 'center',
  },
  rewardVal: { fontSize: 26, fontWeight: 900 },
  rewardLbl: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 },

  // Q review
  reviewList: {
    display: 'flex', flexDirection: 'column', gap: 10,
    textAlign: 'left', marginBottom: 32,
  },
  reviewItem: {
    padding: '12px 16px', borderRadius: 10, border: '1px solid',
    display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 13,
  },

  resultBtns: { display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' },
  resultBtn: {
    padding: '12px 28px', borderRadius: 10, border: '1px solid var(--border)',
    fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
    cursor: 'pointer', transition: 'all .15s',
  },
}

const LETTERS = ['A', 'B', 'C', 'D']

export default function QuizPage() {
  const { componentId } = useParams()
  const navigate = useNavigate()
  const { unlockedComponents = [], unlockComponent } = useGamification()

  const comp = COMPONENT_MAP[componentId]
  const questions = comp?.quiz?.questions ?? []

  const [phase, setPhase] = useState('quiz') // 'quiz' | 'results'
  const [currentQ, setCurrentQ] = useState(0)
  const [selected, setSelected] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [answers, setAnswers] = useState([])
  const [unlockTriggered, setUnlockTriggered] = useState(false)

  // Capture lock state at quiz START — before any unlock call changes the context.
  // Using a ref so it never re-evaluates after unlockComponent() updates unlockedComponents.
  const wasAlreadyUnlockedRef = useRef(unlockedComponents.includes(componentId))
  const isAlreadyUnlocked = wasAlreadyUnlockedRef.current

  const q = questions[currentQ]

  function handleSelect(idx) {
    if (revealed) return
    setSelected(idx)
    setRevealed(true)
  }

  function handleNext() {
    const isRight = selected === q.correct
    const newAnswers = [...answers, { selected, correct: q.correct, isRight, question: q }]
    setAnswers(newAnswers)
    setSelected(null)
    setRevealed(false)

    if (currentQ + 1 >= questions.length) {
      // Go to results
      const score = Math.round((newAnswers.filter(a => a.isRight).length / questions.length) * 100)
      const passed = score >= comp.quiz.passingScore

      setPhase('results')

      if (passed && !isAlreadyUnlocked && !unlockTriggered) {
        setUnlockTriggered(true)
        unlockComponent?.(componentId, comp.xpReward, comp.coinReward)
      }
    } else {
      setCurrentQ(prev => prev + 1)
    }
  }

  function handleRetry() {
    setPhase('quiz')
    setCurrentQ(0)
    setSelected(null)
    setRevealed(false)
    setAnswers([])
    setUnlockTriggered(false)
  }

  if (!comp) return (
    <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
        <div>Component not found</div>
        <button onClick={() => navigate('/components')} style={{ marginTop: 16, ...S.backBtn }}>← Back</button>
      </div>
    </div>
  )

  // ── Results screen ───────────────────────────────────────────────────────────
  if (phase === 'results') {
    const correct = answers.filter(a => a.isRight).length
    const score = Math.round((correct / questions.length) * 100)
    const passed = score >= comp.quiz.passingScore

    return (
      <div style={S.page}>
        <div style={S.topBar}>
          <button style={S.backBtn} onClick={() => navigate('/components')}>← Components</button>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>{comp.icon} {comp.name} Quiz</span>
          <span />
        </div>

        <div style={S.results}>
          <div style={S.resultIcon}>{passed ? '🎉' : '😤'}</div>
          <div style={S.resultTitle}>{passed ? 'Component Unlocked!' : 'Not quite — try again!'}</div>
          <div style={S.resultSub}>
            {passed
              ? `You scored ${score}% and unlocked ${comp.name}. +${comp.xpReward} XP and +${comp.coinReward} coins added to your account!`
              : `You scored ${score}%. You need ${comp.quiz.passingScore}% to unlock ${comp.name}. Review the theory and try again.`
            }
          </div>

          {/* Score circle */}
          <div style={{
            ...S.scoreCircle,
            borderColor: passed ? comp.color : '#ef4444',
            background: passed ? comp.color + '12' : '#ef444412',
          }}>
            <div style={{ ...S.scoreNum, color: passed ? comp.color : '#ef4444' }}>{score}%</div>
            <div style={{ ...S.scoreLbl, color: 'var(--text3)' }}>{correct}/{questions.length}</div>
          </div>

          {/* Rewards (only if passed for first time) */}
          {passed && !isAlreadyUnlocked && (
            <div style={S.rewardBanner}>
              <div style={{
                ...S.rewardItem,
                borderColor: '#fbbf2430', background: '#fbbf2410',
              }}>
                <div style={{ ...S.rewardVal, color: '#fbbf24' }}>+{comp.xpReward}</div>
                <div style={{ ...S.rewardLbl, color: '#fbbf24' }}>XP</div>
              </div>
              <div style={{
                ...S.rewardItem,
                borderColor: '#f59e0b30', background: '#f59e0b10',
              }}>
                <div style={{ ...S.rewardVal, color: '#f59e0b' }}>+{comp.coinReward}</div>
                <div style={{ ...S.rewardLbl, color: '#f59e0b' }}>Coins</div>
              </div>
              <div style={{
                ...S.rewardItem,
                borderColor: comp.color + '40', background: comp.color + '10',
              }}>
                <div style={{ ...S.rewardVal, color: comp.color }}>{comp.icon}</div>
                <div style={{ ...S.rewardLbl, color: comp.color }}>Unlocked</div>
              </div>
            </div>
          )}
          {passed && isAlreadyUnlocked && (
            <div style={{
              padding: '12px 20px', borderRadius: 10, marginBottom: 28,
              background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)',
              fontSize: 13, color: '#22c55e',
            }}>
              ✓ Component already unlocked — no rewards for retakes
            </div>
          )}

          {/* Q-by-Q review */}
          <div style={{ textAlign: 'left', marginBottom: 32 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
              Review
            </div>
            <div style={S.reviewList}>
              {answers.map((a, i) => (
                <div key={i} style={{
                  ...S.reviewItem,
                  borderColor: a.isRight ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.25)',
                  background: a.isRight ? 'rgba(34,197,94,.06)' : 'rgba(239,68,68,.06)',
                }}>
                  <span style={{ fontSize: 16 }}>{a.isRight ? '✅' : '❌'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: 3, color: 'var(--text)' }}>{a.question.question}</div>
                    {!a.isRight && (
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                        Your answer: {a.question.options[a.selected]} &nbsp;·&nbsp;
                        <span style={{ color: '#22c55e' }}>Correct: {a.question.options[a.correct]}</span>
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3, fontStyle: 'italic' }}>
                      {a.question.explanation}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA buttons */}
          <div style={S.resultBtns}>
            {!passed && (
              <>
                <button
                  style={{ ...S.resultBtn, background: 'var(--bg2)', color: 'var(--text2)' }}
                  onClick={() => navigate(`/components/${componentId}/theory`)}
                >📖 Review Theory</button>
                <button
                  style={{ ...S.resultBtn, background: comp.color, color: '#fff', border: 'none' }}
                  onClick={handleRetry}
                >🔄 Try Again</button>
              </>
            )}
            {passed && (
              <>
                <button
                  style={{ ...S.resultBtn, background: 'var(--bg2)', color: 'var(--text2)' }}
                  onClick={() => navigate('/components')}
                >← Back to Components</button>
                <button
                  style={{ ...S.resultBtn, background: comp.color, color: '#fff', border: 'none' }}
                  onClick={() => navigate('/projects')}
                >🚀 Go to Projects</button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Quiz screen
  return (
    <div style={S.page}>
      <div style={S.topBar}>
        <button style={S.backBtn} onClick={() => navigate(`/components/${componentId}/theory`)}>
          ← Theory
        </button>
        <span style={{ fontSize: 13, color: 'var(--text3)' }}>
          {comp.icon} {comp.name} Quiz
        </span>
        <span style={S.qProgress}>
          {currentQ + 1} / {questions.length}
        </span>
      </div>

      <div style={S.inner}>
        {/* Component badge */}
        <div style={{
          ...S.compBadge,
          color: comp.color, background: comp.color + '12', borderColor: comp.color + '40',
        }}>
          {comp.icon} {comp.name}
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>· Pass {comp.quiz.passingScore}% to unlock</span>
        </div>

        {/* Progress dots */}
        <div style={S.dotRow}>
          {questions.map((_, idx) => {
            const done = idx < currentQ
            const active = idx === currentQ
            const width = active ? 24 : done ? 14 : 8
            return (
              <div key={idx} style={{
                ...S.dot, width,
                background: done ? comp.color : active ? comp.color : 'var(--border)',
                opacity: done ? 0.6 : 1,
              }} />
            )
          })}
        </div>

        {/* Question card */}
        <div style={S.questionCard}>
          <div style={S.qNum}>Question {currentQ + 1}</div>
          <p style={S.qText}>{q.question}</p>
        </div>

        {/* Options */}
        <div style={S.options}>
          {q.options.map((opt, idx) => {
            const isSelected = selected === idx
            const isCorrect = idx === q.correct
            const isWrong = revealed && isSelected && !isCorrect

            let bg = 'var(--bg2)'
            let borderColor = 'var(--border)'
            let letterBg = 'var(--border)'
            let letterColor = 'var(--text2)'

            if (revealed) {
              if (isCorrect) {
                bg = 'rgba(34,197,94,.08)'
                borderColor = 'rgba(34,197,94,.4)'
                letterBg = '#22c55e'
                letterColor = '#fff'
              } else if (isWrong) {
                bg = 'rgba(239,68,68,.08)'
                borderColor = 'rgba(239,68,68,.4)'
                letterBg = '#ef4444'
                letterColor = '#fff'
              }
            } else if (isSelected) {
              bg = comp.color + '12'
              borderColor = comp.color + '80'
              letterBg = comp.color
              letterColor = '#fff'
            }

            return (
              <button
                key={idx}
                style={{
                  ...S.option,
                  background: bg,
                  borderColor,
                  cursor: revealed ? 'default' : 'pointer',
                }}
                onClick={() => handleSelect(idx)}
              >
                <div style={{ ...S.optLetter, background: letterBg, color: letterColor }}>
                  {revealed && isCorrect ? '✓' : revealed && isWrong ? '✗' : LETTERS[idx]}
                </div>
                {opt}
              </button>
            )
          })}
        </div>

        {revealed && (
          <div style={{
            ...S.explanation,
            background: selected === q.correct ? 'rgba(34,197,94,.07)' : 'rgba(239,68,68,.07)',
            border: `1px solid ${selected === q.correct ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.25)'}`,
            borderRadius: 10,
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>
              {selected === q.correct ? '✅' : '❌'}
            </span>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4, color: selected === q.correct ? '#22c55e' : '#ef4444' }}>
                {selected === q.correct ? 'Correct!' : 'Incorrect'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{q.explanation}</div>
            </div>
          </div>
        )}

        {revealed && (
          <button
            style={{
              ...S.nextBtn,
              background: comp.color,
              color: '#fff',
              boxShadow: `0 4px 16px ${comp.color}44`,
            }}
            onClick={handleNext}
          >
            {currentQ + 1 >= questions.length ? '📊 See Results' : 'Next Question →'}
          </button>
        )}
      </div>
    </div>
  )
}