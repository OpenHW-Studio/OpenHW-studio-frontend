import { useState, useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useGamification } from '../context/GamificationContext'
import { PROJECTS } from '../services/gamification/ProjectsConfig'
import { getProjectFlashcards } from '../services/gamification/ProjectData'
import {
  getAdventureProjectContent,
  markAdventureStepComplete,
  postQuizSubmitted,
  toProjectDisplayMeta,
} from '../services/adventureService'

export default function ProjectQuizPage() {
  const { projectName } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const classId = new URLSearchParams(location.search).get('classId')
  const mapPath = classId ? `/adventure?classId=${encodeURIComponent(classId)}` : '/adventure'
  const { theme = 'dark' } = useGamification()

  const baseProject = PROJECTS.find(p => p.slug === projectName)
  const [customProject, setCustomProject] = useState(null)
  const [classQuizQuestions, setClassQuizQuestions] = useState(null)
  const [loadingContent, setLoadingContent] = useState(() => !baseProject)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!baseProject) setLoadingContent(true)
      try {
        const { project: projectContent } = await getAdventureProjectContent(classId, projectName)
        if (cancelled) return
        if (!baseProject) {
          setCustomProject(toProjectDisplayMeta(projectContent))
        }
        setClassQuizQuestions(
          Array.isArray(projectContent?.quizQuestions) && projectContent.quizQuestions.length
            ? projectContent.quizQuestions
            : null,
        )
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load project quiz content:', err)
        if (!baseProject) setCustomProject(null)
        setClassQuizQuestions(null)
      } finally {
        if (!cancelled) setLoadingContent(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [classId, projectName, baseProject])

  const project = baseProject || customProject
  const loading = loadingContent && !baseProject
  const color = project?.color || '#3b82f6'

  const [idx, setIdx] = useState(0)
  const [quizPick, setQuizPick] = useState(null)
  const [allDone, setAllDone] = useState(false)
  const [selectedAnswers, setSelectedAnswers] = useState(() => Array(getProjectFlashcards(projectName).length).fill(null))

  const flashcards = classQuizQuestions
    ? classQuizQuestions.map((question, index) => ({
        id: question.id || index + 1,
        front: question.question,
        quiz: {
          question: question.question,
          options: question.options || [],
          correctAnswer: Number.isFinite(question.correctAnswer) ? question.correctAnswer : 0,
        },
      }))
    : getProjectFlashcards(projectName)
  const total = flashcards.length
  const card = flashcards[idx]
  const quiz = card?.quiz

  const correctCount = selectedAnswers.filter((ans, i) => {
    const correct = flashcards[i]?.quiz?.correctAnswer
    return ans === correct
  }).length

  useEffect(() => {
    if (allDone && correctCount >= total * 0.7) {
      markAdventureStepComplete({
        classId,
        projectSlug: projectName,
        stepKey: 'quiz',
        stepOrder: 2,
      }).catch(() => {})
    }
    if (allDone && classId) {
      postQuizSubmitted(classId, projectName, {
        score: total ? Math.round((correctCount / total) * 100) : 0,
        passed: correctCount >= total * 0.7,
      }).catch(() => {})
    }
  }, [allDone, correctCount, total, projectName, classId])

  useEffect(() => {
    setQuizPick(selectedAnswers[idx])
  }, [idx, selectedAnswers])

  const pickAnswer = (i) => {
    if (allDone) return
    if (quizPick === i) return

    setQuizPick(i)
    setSelectedAnswers(prev => {
      const next = [...prev]
      next[idx] = i
      return next
    })
  }

  const goNext = () => {
    if (idx + 1 < total) {
      setIdx(n => n + 1)
    } else {
      setAllDone(true)
    }
  }

  const goPrev = () => {
    if (idx > 0) {
      setIdx(n => n - 1)
    }
  }

  if (loading) {
    return (
      <div className="gamification-page" style={{ background: theme === 'dark' ? 'linear-gradient(160deg,#080e1e 0%,#0c1528 55%,#07101f 100%)' : 'linear-gradient(160deg,#f0f4ff 0%,#e8edf8 55%,#f0f4ff 100%)', color: theme === 'dark' ? '#e2e8f0' : '#1e293b', padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Loading project…</div>
      </div>
    )
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

  if (allDone) {
    return (
      <div className="gamification-page completion-screen" style={{ background: theme === 'dark' ? 'linear-gradient(160deg,#080e1e 0%,#0c1528 55%,#07101f 100%)' : 'linear-gradient(160deg,#f0f4ff 0%,#e8edf8 55%,#f0f4ff 100%)', color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap');
        `}</style>
        <div className="completion-icon">🎉</div>
        <div className="completion-title" style={{ color: '#34d399', marginBottom: 8 }}>
          Quiz Complete!
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: theme === 'dark' ? '#f0f4ff' : '#0f172a', marginBottom: 8 }}>
          {correctCount}/{total} correct
        </div>
        <div className="completion-subtitle" style={{ color: theme === 'dark' ? '#64748b' : '#94a3b8', marginBottom: 36 }}>
          {correctCount >= total * 0.7 ? "Great job! You're ready to build!" : 'Keep learning and try again!'}
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-back" style={{ background: theme === 'dark' ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)', color: '#94a3b8' }} onClick={() => navigate(mapPath)}>
            ← Map
          </button>
          {idx > 0 && (
            <button style={{ background: theme === 'dark' ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)', color: '#94a3b8', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }} onClick={goPrev}>
              ← Prev
            </button>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}>
            🎯 {project.title}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: theme === 'dark' ? '#f0f4ff' : '#0f172a' }}>Quiz</div>
        </div>
        <div style={{ fontSize: 13, color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>
          {correctCount} correct
        </div>
      </div>

      <div className="gamification-content" style={{ animation: 'fadeUp .35s ease' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: theme === 'dark' ? '#94a3b8' : '#64748b', fontWeight: 700, marginBottom: 6 }}>
            Question {idx + 1} of {total}
          </div>
          <div className="progress-bar-track" style={{ background: theme === 'dark' ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.08)', height: 6, borderRadius: 99, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ height: '100%', borderRadius: 99, width: `${((idx + 1) / total) * 100}%`, background: color, transition: 'width .4s ease' }} />
          </div>
          <div className="progress-dots">
            {flashcards.map((_, i) => {
              const isAnswered = selectedAnswers[i] !== null
              return (
                <div key={i} className="progress-dot" style={{
                  background: i < idx ? color : isAnswered ? '#60a5fa' : (theme === 'dark' ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.12)'),
                }} />
              )
            })}
          </div>
        </div>

        <div style={{ marginBottom: 24, padding: '16px 20px', borderRadius: 12, background: color + '12', border: `1px solid ${color}33` }}>
          <div style={{ fontSize: 12, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
             {card?.front}
           </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: theme === 'dark' ? '#f0f4ff' : '#0f172a' }}>
             {quiz?.question}
           </div>
         </div>

        <div className="quiz-options-grid">
          {quiz?.options.map((opt, i) => {
            const isCorrect = i === quiz?.correctAnswer
            const isPicked = quizPick === i
            const showResult = allDone && quizPick !== null
            return (
               <button
                 key={i}
                 onClick={() => pickAnswer(i)}
                 className={`quiz-option ${showResult && isCorrect && isPicked ? 'quiz-option--correct' : ''} ${showResult && isPicked && !isCorrect ? 'quiz-option--wrong' : ''}`}
                 style={{
                   background: showResult && isCorrect && isPicked ? 'rgba(34,197,94,.14)' : showResult && isPicked && !isCorrect ? 'rgba(239,68,68,.14)' : isPicked && !allDone ? 'rgba(59,130,246,.14)' : (theme === 'dark' ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)'),
                   borderColor: showResult && isCorrect && isPicked ? '#22c55e' : showResult && isPicked && !isCorrect ? '#ef4444' : isPicked && !allDone ? '#3b82f6' : (theme === 'dark' ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.1)'),
                   color: showResult && isCorrect && isPicked ? '#34d399' : showResult && isPicked && !isCorrect ? '#f87171' : isPicked && !allDone ? '#60a5fa' : (theme === 'dark' ? '#94a3b8' : '#64748b'),
                   cursor: quizPick && !isPicked ? 'default' : 'pointer',
                                    }}
               >
                 {allDone && showResult && isCorrect && isPicked ? '✅ ' : allDone && showResult && isPicked && !isCorrect ? '❌ ' : `${['A','B','C','D'][i]}. `}
                 {opt}
               </button>
             )
           })}
         </div>

         {!allDone && (
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
             {idx > 0 && (
               <button
                 onClick={goPrev}
                 style={{
                   flex: 1,
                  padding: '10px 24px',
                  borderRadius: 8,
                   border: 'none',
                   background: theme === 'dark' ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.08)',
                   color: theme === 'dark' ? '#e2e8f0' : '#1e293b',
                   fontWeight: 700,
                   cursor: 'pointer',
                   fontSize: 14,
                 }}
               >
                 ← Prev
               </button>
             )}
             <button
               onClick={goNext}
               style={{
                 flex: idx > 0 ? 1 : 'auto',
                padding: '10px 24px',
                borderRadius: 8,
                 border: 'none',
                background: color,
                 color: '#fff',
                 fontWeight: 700,
                 cursor: 'pointer',
                 fontSize: 14,
               }}
             >
               {idx + 1 === total ? 'Finish' : 'Next'}
             </button>
           </div>
         )}
      </div>
    </div>
  )
}
