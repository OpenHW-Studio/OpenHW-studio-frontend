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
import { useAuth } from '../context/AuthContext'
import { ArrowLeft, ArrowRight, ShieldAlert, Sparkles, Check, X, Award, Sun, Moon, HelpCircle, FileText, LogOut } from 'lucide-react'

export default function ProjectQuizPage() {
  const { projectName } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const handleLogout = () => {
    logout()
    navigate('/')
  }
  const classId = new URLSearchParams(location.search).get('classId')
  const mapPath = classId ? `/adventure?classId=${encodeURIComponent(classId)}` : '/adventure'
  const { awardXP } = useGamification()

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
  const color = project?.color || '#6366f1'

  const [idx, setIdx] = useState(0)
  const [quizPick, setQuizPick] = useState(null)
  const [allDone, setAllDone] = useState(false)
  const [selectedAnswers, setSelectedAnswers] = useState(() => {
    const baseLen = getProjectFlashcards(projectName)?.length || 5
    return Array(baseLen).fill(null)
  })
  
  // Track if they have clicked an option for the current question
  const [isAnswered, setIsAnswered] = useState(false)

  // Light/Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('quiz_theme')
    return saved !== 'light'
  })

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const next = !prev
      localStorage.setItem('quiz_theme', next ? 'dark' : 'light')
      return next
    })
  }

  const flashcards = (classQuizQuestions && classQuizQuestions.length > 0)
    ? classQuizQuestions.map((question, index) => ({
        id: question.id || index + 1,
        front: question.front || question.question,
        quiz: {
          question: question.question,
          options: question.options || [],
          correctAnswer: Number.isFinite(question.correctAnswer) ? question.correctAnswer : 0,
        },
      }))
    : (getProjectFlashcards(projectName) || DEFAULT_FLASHCARDS)
  const total = flashcards ? flashcards.length : 0
  const card = (flashcards && flashcards[idx]) || DEFAULT_FLASHCARDS[0]
  const quiz = card?.quiz || DEFAULT_FLASHCARDS[0].quiz


  const correctCount = selectedAnswers.filter((ans, i) => {
    const correct = flashcards[i]?.quiz?.correctAnswer
    return ans === correct
  }).length

  useEffect(() => {
    if (total > 0 && selectedAnswers.length !== total) {
      setSelectedAnswers(Array(total).fill(null))
    }
  }, [total])

  useEffect(() => {
    if (allDone && correctCount >= total * 0.7) {
      markAdventureStepComplete({
        classId,
        projectSlug: projectName,
        stepKey: 'quiz',
        stepOrder: 2,
      }).catch(() => {})
      awardXP?.(50, 'Quiz Passed! 📝')
    }
    if (allDone && classId) {
      postQuizSubmitted(classId, projectName, {
        score: total ? Math.round((correctCount / total) * 100) : 0,
        passed: correctCount >= total * 0.7,
      }).catch(() => {})
    }
  }, [allDone, correctCount, total, projectName, classId, awardXP])

  useEffect(() => {
    setQuizPick(selectedAnswers[idx])
    setIsAnswered(selectedAnswers[idx] !== null)
  }, [idx, selectedAnswers])

  const pickAnswer = (i) => {
    if (isAnswered) return // Prevent changing answer
    setQuizPick(i)
    setIsAnswered(true)
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
      <div style={{
        height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', background: '#0b1329', color: '#fff'
      }}>
        <div style={{ fontSize: 48, animation: 'spin 2s linear infinite' }}>⏳</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 16 }}>Loading Quiz Mission...</div>
      </div>
    )
  }

  if (!project) {
    return (
      <div style={{
        height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', background: '#0b1329', color: '#fff',
        padding: 24, textAlign: 'center'
      }}>
        <ShieldAlert size={64} color="#f43f5e" style={{ marginBottom: 16 }} />
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Mission Parameters Offline</div>
        <div style={{ color: '#94a3b8', marginBottom: 24 }}>We couldn't load the quiz for: {projectName}</div>
        <button onClick={() => navigate(mapPath)} style={{
          padding: '12px 24px', borderRadius: 14, border: 'none', background: color, color: '#fff', fontWeight: 800, cursor: 'pointer'
        }}>
          Return to World Map
        </button>
      </div>
    )
  }

  if (allDone) {
    const passed = correctCount >= total * 0.7
    return (
      <div style={{
        height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: isDarkMode 
          ? 'radial-gradient(circle at top, #0f172a 0%, #020617 100%)' 
          : 'radial-gradient(circle at top, #f8fafc 0%, #e2e8f0 100%)',
        color: isDarkMode ? '#fff' : '#0f172a', padding: 24, textAlign: 'center', fontFamily: "'Inter', sans-serif"
      }}>
        <style>{`
          @keyframes slideUp {
            0% { transform: translateY(20px); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
          }
        `}</style>
        <div style={{ fontSize: 72, animation: 'slideUp 0.6s ease' }}>{passed ? '🏆' : '💪'}</div>
        <div style={{
          fontSize: 28, fontWeight: 900, 
          color: passed ? '#10b981' : '#ef4444', 
          marginTop: 16, textTransform: 'uppercase', letterSpacing: '0.04em'
        }}>
          {passed ? 'Quiz Passed!' : 'Quiz Attempt Finished'}
        </div>

        <div style={{
          background: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.75)',
          border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(15, 23, 42, 0.08)',
          borderRadius: 24, padding: '24px 32px', margin: '20px 0 32px', width: '100%', maxWidth: 440,
          boxShadow: isDarkMode ? 'none' : '0 10px 30px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 4 }}>
            {correctCount} / {total}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: isDarkMode ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 16 }}>
            Total Correct Answers
          </div>
          <div style={{ height: 1, background: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15, 23, 42, 0.08)', marginBottom: 16 }} />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: passed ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', padding: '6px 14px', borderRadius: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: passed ? '#10b981' : '#ef4444' }}>
                {passed ? '+50 XP Earned' : 'Requires 70% to Unlock Next'}
              </span>
            </div>
          </div>
        </div>

        <button onClick={() => navigate(mapPath)} style={{
          background: passed ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #4f46e5, #6366f1)',
          color: '#fff', fontWeight: 900, fontSize: 14,
          padding: '16px 36px', borderRadius: 20, border: 'none',
          boxShadow: passed ? '0 8px 24px rgba(16,185,129,0.4)' : '0 8px 24px rgba(99,102,241,0.3)', 
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s'
        }}>
          <span>{passed ? 'Continue Quest' : 'Try Again'}</span>
          <ArrowRight size={16} strokeWidth={2.5} />
        </button>
      </div>
    )
  }

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      background: isDarkMode
        ? 'radial-gradient(circle at top left, #0f172a 0%, #020617 100%)'
        : 'radial-gradient(circle at top left, #f8fafc 0%, #e2e8f0 100%)',
      color: isDarkMode ? '#fff' : '#1e293b',
      fontFamily: "'Inter', system-ui, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'background 0.3s ease, color 0.3s ease',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        
        @keyframes floatEffect {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.35; }
        }
        .tutorial-glow {
          position: absolute;
          width: 300px;
          height: 300px;
          border-radius: 50%;
          filter: blur(120px);
          pointer-events: none;
          z-index: 1;
          animation: glowPulse 4s ease-in-out infinite;
        }
        .quiz-opt-btn {
          display: flex;
          align-items: center;
          width: 100%;
          border: 1.5px solid;
          border-radius: 18px;
          padding: 16px 20px;
          font-weight: 600;
          font-size: 14.5px;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .quiz-opt-btn:hover {
          transform: translateY(-2px);
        }
      `}</style>

      {/* Decorative background glows */}
      {isDarkMode && (
        <>
          <div className="tutorial-glow" style={{ background: color, top: '-50px', left: '-50px' }} />
          <div className="tutorial-glow" style={{ background: '#4f46e5', bottom: '-50px', right: '-50px' }} />
        </>
      )}

      {/* ── TOP NAV HEADER ────────────────────────────────────────────────── */}
      <header style={{
        height: 64,
        borderBottom: isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(15, 23, 42, 0.08)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        zIndex: 10,
        background: isDarkMode ? 'rgba(15, 23, 42, 0.3)' : 'rgba(255, 255, 255, 0.65)',
        backdropFilter: 'blur(12px)',
        transition: 'background 0.3s ease, border-bottom 0.3s ease',
      }}>
        <button
          onClick={() => navigate(mapPath)}
          style={{
            background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(15, 23, 42, 0.05)',
            border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(15, 23, 42, 0.1)',
            borderRadius: 12, padding: '8px 16px',
            color: isDarkMode ? '#94a3b8' : '#475569', fontSize: 12, fontWeight: 800,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all 0.2s',
          }}
        >
          <ArrowLeft size={14} strokeWidth={2.5} />
          <span>Exit Map</span>
        </button>

        <div style={{ margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
            <span style={{
              background: isDarkMode ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)',
              color: isDarkMode ? '#818cf8' : '#4f46e5',
              fontSize: 10, fontWeight: 900, borderRadius: 8, padding: '3px 8px',
              textTransform: 'uppercase', letterSpacing: '0.04em'
            }}>
              Quest Quiz
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: isDarkMode ? '#f8fafc' : '#0f172a' }}>{project.title}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Docs Button */}
          <a
            href="https://openhw-studio.fossee.in/docs/"
            target="_blank"
            rel="noreferrer"
            style={{
              height: 38, borderRadius: 12, padding: '0 16px',
              background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(15, 23, 42, 0.05)',
              border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(15, 23, 42, 0.1)',
              color: isDarkMode ? '#94a3b8' : '#475569',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 800, textDecoration: 'none',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            <FileText size={14} strokeWidth={2.5} />
            <span>Docs</span>
          </a>

          {/* Sign Out Button */}
          <button
            onClick={handleLogout}
            style={{
              height: 38, borderRadius: 12, padding: '0 16px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#dc2626',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 800,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            <LogOut size={14} strokeWidth={2.5} />
            <span>Sign Out</span>
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            style={{
              width: 38, height: 38, borderRadius: '50%',
              background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(15, 23, 42, 0.05)',
              border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(15, 23, 42, 0.1)',
              color: isDarkMode ? '#fbbf24' : '#6366f1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? <Sun size={16} strokeWidth={2.5} fill="#fbbf24" /> : <Moon size={16} strokeWidth={2.5} />}
          </button>

          {/* Level Progress Indicator */}
          <div style={{
            background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(15, 23, 42, 0.05)',
            borderRadius: 12, border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15, 23, 42, 0.08)',
            padding: '8px 14px',
            fontSize: 12, fontWeight: 800, color: isDarkMode ? '#38bdf8' : '#0284c7',
            transition: 'all 0.3s ease',
          }}>
            Score: {correctCount} / {total}
          </div>
        </div>
      </header>

      {/* Progress timeline bar */}
      <div style={{ height: 4, background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(15, 23, 42, 0.05)', width: '100%', zIndex: 10 }}>
        <div style={{
          height: '100%', background: `linear-gradient(90deg, ${color}, #3b82f6)`,
          width: `${((idx + 1) / total) * 100}%`, transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }} />
      </div>

      {/* ── MAIN WORKSPACE CONTENT (CENTERED WRAPPER) ─────────────────────── */}
      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5,
        position: 'relative',
        padding: '24px 20px',
        overflowY: 'auto'
      }}>
        {/* Centered elevated glassmorphic quiz card container */}
        <div style={{
          width: '100%',
          maxWidth: 680,
          background: isDarkMode ? 'rgba(15, 23, 42, 0.45)' : 'rgba(255, 255, 255, 0.55)',
          border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(15, 23, 42, 0.08)',
          boxShadow: isDarkMode ? '0 30px 70px rgba(0,0,0,0.35)' : '0 24px 60px rgba(15, 23, 42, 0.05)',
          borderRadius: 32,
          backdropFilter: 'blur(20px) saturate(190%)',
          padding: '40px 48px',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.3s ease',
        }}>
          
          {/* Question status index */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={14} color="#fbbf24" fill="#fbbf24" />
              <span style={{ fontSize: 11, fontWeight: 900, color: color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                CHALLENGE QUESTION {idx + 1} OF {total}
              </span>
            </div>
            {isAnswered && (
              <span style={{
                fontSize: 11, fontWeight: 800,
                color: quizPick === quiz?.correctAnswer ? '#10b981' : '#ef4444',
                background: quizPick === quiz?.correctAnswer ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                padding: '4px 10px', borderRadius: 8
              }}>
                {quizPick === quiz?.correctAnswer ? 'CORRECT' : 'INCORRECT'}
              </span>
            )}
          </div>

          {/* Question header */}
          <h2 style={{
            margin: '0 0 28px',
            fontSize: 21,
            fontWeight: 800,
            color: isDarkMode ? '#f8fafc' : '#0f172a',
            lineHeight: 1.45,
            transition: 'color 0.3s ease',
          }}>
            {quiz?.question}
          </h2>

          {/* Options Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
            {quiz?.options.map((opt, i) => {
              const isCorrect = i === quiz?.correctAnswer
              const isPicked = quizPick === i
              
              let borderCol = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)'
              let bgCol = isDarkMode ? 'rgba(255, 255, 255, 0.01)' : 'rgba(255, 255, 255, 0.45)'
              let textCol = isDarkMode ? '#e2e8f0' : '#475569'
              let letterBg = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(15, 23, 42, 0.04)'
              let letterText = isDarkMode ? '#94a3b8' : '#64748b'

              if (isAnswered) {
                if (isCorrect) {
                  bgCol = isDarkMode ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.06)'
                  borderCol = 'rgba(16, 185, 129, 0.4)'
                  textCol = '#10b981'
                  letterBg = 'rgba(16, 185, 129, 0.15)'
                  letterText = '#10b981'
                } else if (isPicked) {
                  bgCol = isDarkMode ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.06)'
                  borderCol = 'rgba(239, 68, 68, 0.4)'
                  textCol = '#ef4444'
                  letterBg = 'rgba(239, 68, 68, 0.15)'
                  letterText = '#ef4444'
                }
              } else if (isPicked) {
                borderCol = color
                bgCol = isDarkMode ? `${color}15` : `${color}08`
                textCol = color
                letterBg = `${color}25`
                letterText = color
              }

              return (
                <button
                  key={i}
                  onClick={() => pickAnswer(i)}
                  disabled={isAnswered}
                  className="quiz-opt-btn"
                  style={{
                    background: bgCol,
                    borderColor: borderCol,
                    color: textCol,
                    boxShadow: isDarkMode ? 'none' : '0 2px 8px rgba(0,0,0,0.01)',
                    opacity: isAnswered && !isCorrect && !isPicked ? 0.45 : 1,
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: letterBg, color: letterText,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 12, marginRight: 12, flexShrink: 0,
                    transition: 'all 0.2s',
                  }}>
                    {isAnswered && isCorrect ? (
                      <Check size={12} strokeWidth={3} />
                    ) : isAnswered && isPicked ? (
                      <X size={12} strokeWidth={3} />
                    ) : (
                      ['A', 'B', 'C', 'D'][i]
                    )}
                  </div>
                  <span style={{ fontSize: 13.5 }}>{opt}</span>
                </button>
              )
            })}
          </div>

          {/* Action Back / Next Buttons inside card */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15, 23, 42, 0.08)', paddingTop: 24 }}>
            <button
              onClick={goPrev}
              disabled={idx === 0}
              style={{
                background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255, 255, 255, 0.85)',
                border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15, 23, 42, 0.08)',
                color: idx === 0 ? '#475569' : (isDarkMode ? '#cbd5e1' : '#475569'),
                padding: '12px 24px', borderRadius: 14,
                fontWeight: 800, fontSize: 13,
                cursor: idx === 0 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s',
                boxShadow: isDarkMode ? 'none' : '0 2px 10px rgba(0,0,0,0.04)',
                opacity: idx === 0 ? 0.45 : 1,
              }}
            >
              <ArrowLeft size={15} />
              <span>Back</span>
            </button>

            <button
              onClick={goNext}
              disabled={!isAnswered}
              style={{
                background: !isAnswered
                  ? 'rgba(15, 23, 42, 0.08)'
                  : `linear-gradient(135deg, ${color}, #4f46e5)`,
                color: !isAnswered ? '#94a3b8' : '#fff',
                padding: '12px 28px', borderRadius: 14, border: 'none',
                fontWeight: 900, fontSize: 13,
                cursor: !isAnswered ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: !isAnswered ? 'none' : `0 6px 18px rgba(99,102,241,0.25)`,
                transition: 'all 0.2s',
              }}
            >
              <span>{idx + 1 === total ? 'Finish Quiz' : 'Next Question'}</span>
              <ArrowRight size={15} strokeWidth={2.5} />
            </button>
          </div>

        </div>
      </main>
    </div>
  )
}
