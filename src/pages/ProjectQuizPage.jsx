import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useGamification } from '../context/GamificationContext'
import { PROJECTS } from '../services/gamification/ProjectsConfig'
import { getProjectFlashcards } from '../services/gamification/ProjectData'

function getT(theme) {
  const D = theme === 'dark'
  return {
    page: D ? 'linear-gradient(160deg,#080e1e 0%,#0c1528 55%,#07101f 100%)' : 'linear-gradient(160deg,#f0f4ff 0%,#e8edf8 55%,#f0f4ff 100%)',
    topbar: D ? 'rgba(7,10,20,.97)' : 'rgba(248,250,252,.97)',
    topbarBorder: D ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)',
    textH: D ? '#f0f4ff' : '#0f172a',
    text: D ? '#e2e8f0' : '#1e293b',
    textMuted: D ? '#94a3b8' : '#64748b',
    textDim: D ? '#64748b' : '#94a3b8',
    text2: D ? '#cbd5e1' : '#475569',
    barTrack: D ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.08)',
    dot: D ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.12)',
    dotActive: D ? '#fff' : '#475569',
    quizOptBg: D ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)',
    quizOptBorder: D ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.1)',
  }
}

export default function ProjectQuizPage() {
  const { projectName } = useParams()
  const navigate = useNavigate()
  const { theme = 'dark' } = useGamification()
  const T = getT(theme)

  const project = PROJECTS.find(p => p.slug === projectName)
  const color = project?.color || '#3b82f6'

  const [idx, setIdx] = useState(0)
  const [quizPick, setQuizPick] = useState(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [allDone, setAllDone] = useState(false)
  const [wrongMsg, setWrongMsg] = useState(null)

  // Get flashcards from centralized data file
  const flashcards = getProjectFlashcards(projectName)
  const total = flashcards.length
  const card = flashcards[idx]

  // Get quiz for current card
  const quiz = card?.quiz

  const pickAnswer = (i) => {
    if (quizPick !== null) return
    setQuizPick(i)
    const isCorrect = i === quiz?.correctAnswer
    if (isCorrect) {
      setTimeout(() => {
        setCorrectCount(c => c + 1)
        if (idx + 1 >= total) { setAllDone(true); return }
        setIdx(n => n + 1)
        setQuizPick(null)
        setWrongMsg(null)
      }, 900)
    } else {
      setWrongMsg(`Wrong! The correct answer is: "${quiz?.options[quiz?.correctAnswer]}" — try again!`)
      setTimeout(() => setQuizPick(null), 1500)
    }
  }

  if (!project) {
    return (
      <div style={{ minHeight: '100vh', background: T.page, color: T.text, padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Project Not Found</div>
        <div style={{ color: T.textMuted, marginBottom: 24 }}>Could not find project: {projectName}</div>
        <button onClick={() => navigate('/adventure')} style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: color, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          ← Back to Adventure Map
        </button>
      </div>
    )
  }

  if (allDone) {
    return (
      <div style={{ minHeight: '100vh', background: T.page, color: T.text, padding: 40, textAlign: 'center' }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap');
          * { box-sizing: border-box; }
          @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
          @keyframes sparkle { 0%,100% { transform:scale(1); opacity:1; } 50% { transform:scale(1.15); opacity:.8; } }
          .flip-card { perspective:1200px; }
          .flip-inner { position:relative; width:100%; height:100%; transition:transform .55s cubic-bezier(.45,0,.55,1); transform-style:preserve-3d; }
          .flip-inner.flipped { transform:rotateY(180deg); }
          .flip-face { position:absolute; inset:0; backface-visibility:hidden; -webkit-backface-visibility:hidden; border-radius:20px; }
          .flip-back { transform:rotateY(180deg); }
        `}</style>
        <div style={{ fontSize: 80, marginBottom: 12, animation: 'sparkle 1s ease infinite' }}>🎉</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: '#34d399', marginBottom: 8 }}>
          Quiz Complete!
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.textH, marginBottom: 8 }}>
          {correctCount}/{total} correct
        </div>
        <div style={{ fontSize: 15, color: T.textDim, marginBottom: 36 }}>
          {correctCount >= total * 0.7 ? 'Great job! You\'re ready to build!' : 'Keep learning and try again!'}
        </div>
        <button onClick={() => navigate('/adventure')} style={{
          background: 'linear-gradient(135deg,#22c55e,#16a34a)',
          border: 'none', borderRadius: 14, padding: '16px 44px',
          fontSize: 18, fontWeight: 800, color: '#fff', cursor: 'pointer',
          boxShadow: '0 4px 24px rgba(34,197,94,.45)', fontFamily: 'Nunito,sans-serif',
        }}>
          ← Back to Adventure Map
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: T.page, color: T.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }
      `}</style>

      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.topbarBorder}`, background: T.topbar, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate('/adventure')} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,.06)', color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          ← Map
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}>
            🎯 {project.title}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.textH }}>Quiz</div>
        </div>
        <div style={{ fontSize: 13, color: T.textMuted }}>
          {correctCount} correct
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 20px', animation: 'fadeUp .35s ease' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, marginBottom: 6 }}>
            Question {idx + 1} of {total}
          </div>
          <div style={{ height: 6, borderRadius: 99, background: T.barTrack, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ height: '100%', borderRadius: 99, width: `${((idx + 1) / total) * 100}%`, background: color, transition: 'width .4s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
            {flashcards.map((_, i) => (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: '50%', transition: 'all .3s',
                background: i < idx ? color : T.dot,
              }} />
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 24, padding: '16px 20px', borderRadius: 12, background: color + '12', border: `1px solid ${color}33` }}>
          <div style={{ fontSize: 12, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
            {card?.front}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.textH }}>
            {quiz?.question}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {quiz?.options.map((opt, i) => {
            const isCorrect = i === quiz?.correctAnswer
            const isPicked = quizPick === i
            const showResult = quizPick !== null
            return (
              <button
                key={i}
                onClick={() => pickAnswer(i)}
                style={{
                  padding: '14px 16px', borderRadius: 12, cursor: (quizPick && !isPicked) ? 'default' : 'pointer',
                  border: `2px solid ${showResult && isCorrect && isPicked ? '#22c55e' : showResult && isPicked && !isCorrect ? '#ef4444' : T.quizOptBorder}`,
                  background: showResult && isCorrect && isPicked ? 'rgba(34,197,94,.14)' : showResult && isPicked && !isCorrect ? 'rgba(239,68,68,.14)' : T.quizOptBg,
                  color: showResult && isCorrect && isPicked ? '#34d399' : showResult && isPicked && !isCorrect ? '#f87171' : T.textMuted,
                  fontSize: 14, fontWeight: 700, textAlign: 'left', fontFamily: 'Nunito,sans-serif', lineHeight: 1.4,
                  transition: 'all .2s',
                }}
              >
                {showResult && isCorrect && isPicked ? '✅ ' : showResult && isPicked && !isCorrect ? '❌ ' : `${['A','B','C','D'][i]}. `}
                {opt}
              </button>
            )
          })}
        </div>

        {wrongMsg && (
          <div style={{
            marginTop: 16, padding: '14px 18px', borderRadius: 12,
            background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.35)',
            color: '#f87171', fontSize: 14, fontWeight: 700, animation: 'shake .5s ease',
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>💡</span>
            <span>{wrongMsg}</span>
          </div>
        )}
      </div>
    </div>
  )
}