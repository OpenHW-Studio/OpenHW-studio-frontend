import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useGamification } from '../context/GamificationContext'
import { PROJECTS, getProjectStatus, getProjectRewardComponents, normalizeDifficulty } from '../services/gamification/ProjectsConfig'
import {
  getAdventureContent,
  getAdventureProgress,
  getLocalAdventureStepProgress,
} from '../services/adventureService'
import { buildFallbackClassAdventureContent } from '../services/classAdventureAdapter'

// ─── Arduino journey worlds ──────────────────────────────────────────────────
const ARDUINO_WORLDS = [
  { id: 1, name: 'Circuit Basics',      theme: 'Easy',         color: '#22c55e', bg: 'rgba(34,197,94,0.06)',   border: 'rgba(34,197,94,0.18)',  icon: '⚡', slugs: ['led-blink','rgb-led','buzzer','potentiometer','ldr'] },
  { id: 2, name: 'Signal Control',      theme: 'Intermediate', color: '#3b82f6', bg: 'rgba(59,130,246,0.06)',  border: 'rgba(59,130,246,0.18)', icon: '🎮', slugs: ['servo-motor','led-strip','button-debounce','temperature-sensor'] },
  { id: 3, name: 'Machines & Sensors',  theme: 'Hard',         color: '#f97316', bg: 'rgba(249,115,22,0.06)',  border: 'rgba(249,115,22,0.18)', icon: '🤖', slugs: ['dc-motor'] },
]

// ─── ESP32 journey worlds ────────────────────────────────────────────────────
// No ESP32 projects exist yet in ProjectsConfig — shown as "coming soon" until added.
const ESP32_WORLDS = [
  { id: 1, name: 'ESP32 Basics', theme: 'Coming Soon', color: '#e74c3c', bg: 'rgba(231,76,60,0.06)', border: 'rgba(231,76,60,0.18)', icon: '📡', slugs: [], comingSoon: true },
]

// Helper to classify project journey type (arduino vs esp32)
function getProjectJourney(project) {
  if (!project) return 'arduino';
  const BUILTIN_ARDUINO_SLUGS = ['led-blink', 'rgb-led', 'buzzer', 'potentiometer', 'ldr', 'servo-motor', 'led-strip', 'button-debounce', 'temperature-sensor', 'dc-motor'];
  if (BUILTIN_ARDUINO_SLUGS.includes(project.slug)) {
    return 'arduino';
  }
  const components = project.components || [];
  for (const comp of components) {
    const type = String(comp.type || comp.id || "").toLowerCase();
    if (type.includes('esp32')) {
      return 'esp32';
    }
  }
  return 'arduino';
}

// Winding x-positions
const PATH_X = [50, 75, 50, 25, 50, 75, 50, 25, 50, 75]

// ─── Theme tokens ────────────────────────────────────────────────────────────
function getT(theme) {
  const D = theme === 'dark'
  return {
    pageBg:          D ? 'linear-gradient(180deg, #08101f 0%, #060c18 60%, #08101f 100%)' : 'linear-gradient(180deg, #f0f4ff 0%, #e8edf8 60%, #f0f4ff 100%)',
    pageColor:       D ? '#e2e8f0' : '#1e293b',
    headerBg:        D ? 'rgba(8,16,31,0.95)'   : 'rgba(248,250,252,0.97)',
    headerBorder:    D ? 'rgba(255,255,255,0.07)': 'rgba(0,0,0,0.09)',
    backBtnBg:       D ? 'rgba(255,255,255,0.06)': 'rgba(0,0,0,0.07)',
    backBtnBorder:   D ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)',
    backBtnColor:    D ? '#94a3b8'               : '#64748b',
    xpMetaColor:     D ? '#475569'               : '#64748b',
    xpBarTrack:      D ? 'rgba(255,255,255,0.06)': 'rgba(0,0,0,0.08)',
    heroLabel:       D ? '#34d399'               : '#16a34a',
    heroTitle:       D ? 'linear-gradient(135deg, #e2e8f0 30%, #64748b)' : 'linear-gradient(135deg, #1e293b 30%, #475569)',
    heroSubText:     D ? '#475569'               : '#64748b',
    starterChipBg:   D ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.10)',
    starterChipBorder: D ? 'rgba(59,130,246,0.2)': 'rgba(59,130,246,0.25)',
    starterChipColor:D ? '#60a5fa'               : '#2563eb',
    labelText:       D ? '#e2e8f0'               : '#1e293b',
    labelLocked:     D ? '#2d3f5e'               : '#cbd5e1',
    labelXp:         D ? '#3d5070'               : '#94a3b8',
    rewardChipBg:    D ? 'rgba(52,211,153,0.08)' : 'rgba(52,211,153,0.10)',
    rewardChipBorder: D ? 'rgba(52,211,153,0.2)' : 'rgba(52,211,153,0.25)',
    connectorLocked: D ? 'rgba(255,255,255,0.07)': 'rgba(0,0,0,0.10)',
    progressBg:      D ? 'rgba(8,16,31,0.97)'    : 'rgba(248,250,252,0.97)',
    progressBorder:  D ? 'rgba(255,255,255,0.08)': 'rgba(0,0,0,0.10)',
    progressDivider: D ? 'rgba(255,255,255,0.06)': 'rgba(0,0,0,0.08)',
    progressLabel:   D ? '#64748b'               : '#94a3b8',
    progressPct:     D ? '#334155'               : '#94a3b8',
    progressBarTrack: D ? 'rgba(255,255,255,0.05)': 'rgba(0,0,0,0.07)',
    worldClearText:  D ? '#475569'               : '#64748b',
    allDoneText:     D ? '#475569'               : '#64748b',
    // Modal
    modalBg:         D ? 'linear-gradient(155deg, #0e1628, #080f1e)' : 'linear-gradient(155deg, #ffffff, #f1f5f9)',
    modalSubtitle:   D ? '#64748b'               : '#94a3b8',
    modalDesc:       D ? '#94a3b8'               : '#64748b',
    modalTipBg:      D ? 'rgba(59,130,246,0.07)' : 'rgba(59,130,246,0.07)',
    modalTipBorder:  D ? 'rgba(59,130,246,0.2)'  : 'rgba(59,130,246,0.2)',
    modalTipColor:   D ? '#93c5fd'               : '#3b82f6',
    conceptTagBg:    D ? 'rgba(255,255,255,0.05)': 'rgba(0,0,0,0.05)',
    conceptTagColor: D ? '#94a3b8'               : '#64748b',
    conceptTagBorder: D ? 'rgba(255,255,255,0.07)': 'rgba(0,0,0,0.08)',
    lockedPanelBg:   D ? 'rgba(255,255,255,0.03)': 'rgba(0,0,0,0.03)',
    lockedPanelBorder: D ? 'rgba(255,255,255,0.06)': 'rgba(0,0,0,0.06)',
    lockedText:      D ? '#475569'               : '#94a3b8',
    lockedStrong:    D ? '#94a3b8'               : '#64748b',
    closeBtnBg:      D ? 'rgba(255,255,255,0.07)': 'rgba(0,0,0,0.07)',
    closeBtnColor:   D ? '#64748b'               : '#94a3b8',
    rewardBg:        D ? 'rgba(52,211,153,0.07)' : 'rgba(52,211,153,0.08)',
    rewardBorder:    D ? 'rgba(52,211,153,0.2)'  : 'rgba(52,211,153,0.2)',
    rewardLabel:     D ? '#34d399'               : '#16a34a',
    rewardItemBg:    D ? 'rgba(52,211,153,0.05)' : 'rgba(52,211,153,0.06)',
    rewardItemText:  D ? '#f0f4ff'               : '#0f172a',
    rewardItemDesc:  D ? '#64748b'               : '#94a3b8',
    earnedRewardBg:  D ? 'rgba(52,211,153,0.05)' : 'rgba(52,211,153,0.06)',
    earnedRewardBorder: D ? 'rgba(52,211,153,0.15)': 'rgba(52,211,153,0.2)',
    viewGuideBg:     D ? 'rgba(255,255,255,0.04)': 'rgba(0,0,0,0.04)',
    viewGuideBorder: D ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
    viewGuideColor:  D ? '#94a3b8'               : '#64748b',
    toggleBg:        D ? 'rgba(255,255,255,0.06)': 'rgba(0,0,0,0.07)',
    toggleBorder:    D ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)',
    toggleColor:     D ? '#94a3b8'               : '#64748b',
    nodeLockedBorder: D ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)',
    nodeLockedBg:    D ? 'rgba(255,255,255,0.02)': 'rgba(0,0,0,0.02)',
    numberBadgeLocked: D ? '#1a2540'             : '#e2e8f0',
    numberBadgeBorderLocked: D ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)',
    numberBadgeColorLocked: D ? '#334155'        : '#94a3b8',
  }
}

// ─── Reward Preview ──────────────────────────────────────────────────────────
function RewardPreview({ rewards, T }) {
  if (!rewards || rewards.length === 0) return null
  return (
    <div style={{
      marginBottom: 16,
      background: T.rewardBg,
      border: `1px solid ${T.rewardBorder}`,
      borderRadius: 12, padding: '12px 14px',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 800, color: T.rewardLabel,
        textTransform: 'uppercase', letterSpacing: '.07em',
        marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5,
      }}>
        🎁 Complete this project to unlock:
      </div>
      {rewards.map((r, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '8px 10px', borderRadius: 8,
          background: T.rewardItemBg,
          marginBottom: i < rewards.length - 1 ? 6 : 0,
        }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>{r.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.rewardItemText }}>{r.name}</div>
            <div style={{ fontSize: 11, color: T.rewardItemDesc, lineHeight: 1.4 }}>{r.description}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Modal ─────────────────────────────────────────────────────────────────
function ProjectModal({ project, isCompleted, isAvailable, onClose, onStart, T }) {
  const rewards = project.rewardComponents || getProjectRewardComponents(project.slug)
  const fullProject = PROJECTS.find(p => p.slug === project.slug)
  if (!project) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.78)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, backdropFilter: 'blur(6px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: T.modalBg,
          border: `1px solid ${project.color}44`,
          borderRadius: 20, padding: '28px 24px',
          maxWidth: 420, width: '100%',
          boxShadow: `0 0 60px ${project.color}22, 0 20px 60px rgba(0,0,0,0.7)`,
          position: 'relative',
          maxHeight: '90vh', overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 12, right: 12,
            background: T.closeBtnBg, border: 'none',
            borderRadius: 8, width: 30, height: 30,
            color: T.closeBtnColor, cursor: 'pointer', fontSize: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >×</button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{
            fontSize: 54, marginBottom: 8,
            filter: isAvailable || isCompleted ? 'none' : 'grayscale(1) opacity(.35)',
          }}>{project.icon}</div>

          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
            color: project.color, marginBottom: 6,
          }}>
            {normalizeDifficulty(project.difficulty).charAt(0).toUpperCase() + normalizeDifficulty(project.difficulty).slice(1)} · Project {project.number}
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: T.rewardItemText, marginBottom: 4 }}>
            {project.title}
          </div>
          <div style={{ fontSize: 13, color: T.modalSubtitle }}>{project.subtitle}</div>
        </div>

        {/* Completed stars */}
        {isCompleted && (
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            {[1,2,3].map(i => (
              <span key={i} style={{ fontSize: 22, margin: '0 2px' }}>⭐</span>
            ))}
          </div>
        )}

        {/* Description */}
        <p style={{
          fontSize: 14, color: T.modalDesc, lineHeight: 1.65,
          textAlign: 'center', marginBottom: 16,
        }}>
          {fullProject?.description || project.description}
        </p>

        {/* Kid-friendly tip */}
        {fullProject?.kidFriendlyTip && (
          <div style={{
            background: T.modalTipBg,
            border: `1px solid ${T.modalTipBorder}`,
            borderRadius: 10, padding: '10px 14px', marginBottom: 16,
            fontSize: 12, color: T.modalTipColor, lineHeight: 1.5,
          }}>
            {fullProject.kidFriendlyTip}
          </div>
        )}

        {/* Concepts you'll learn */}
        {fullProject?.concepts && fullProject.concepts.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.xpMetaColor, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 7 }}>
              📚 You'll learn:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {fullProject.concepts.map((c, i) => (
                <span key={i} style={{
                  fontSize: 11, padding: '3px 9px', borderRadius: 6,
                  background: T.conceptTagBg, color: T.conceptTagColor,
                  border: `1px solid ${T.conceptTagBorder}`,
                }}>{c}</span>
              ))}
            </div>
          </div>
        )}

        {/* XP reward */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 10,
          marginBottom: 16, flexWrap: 'wrap',
        }}>
          <span style={{
            padding: '5px 14px', borderRadius: 8,
            background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)',
            fontSize: 13, fontWeight: 700, color: '#fbbf24',
          }}>⚡ +{project.xpReward} XP</span>
          {isCompleted && (
            <span style={{
              padding: '5px 14px', borderRadius: 8,
              background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)',
              fontSize: 13, fontWeight: 700, color: '#34d399',
            }}>✓ Completed!</span>
          )}
        </div>

        {/* Reward components preview */}
        {!isCompleted && isAvailable && <RewardPreview rewards={rewards} T={T} />}
        {isCompleted && rewards.length > 0 && (
          <div style={{
            marginBottom: 16, padding: '10px 14px',
            background: T.earnedRewardBg,
            border: `1px solid ${T.earnedRewardBorder}`,
            borderRadius: 10, fontSize: 12, color: '#34d399',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            ✅ Reward earned: {rewards.map(r => r.name).join(', ')}
          </div>
        )}

        {/* Action buttons */}
        {isAvailable || isCompleted ? (
          <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
            <button
              onClick={() => onStart(project.slug, 'guide')}
              style={{
                padding: '13px 0', borderRadius: 10, border: 'none',
                background: `linear-gradient(135deg, ${project.color}, ${project.color}cc)`,
                color: '#fff', fontWeight: 800, fontSize: 15,
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: `0 4px 20px ${project.color}44`,
                letterSpacing: '.04em',
              }}
            >
              {isCompleted ? '🔄 Play Again' : '🚀 Start Project!'}
            </button>
            <button
              onClick={() => onStart(project.slug, 'guide-simple')}
              style={{
                padding: '10px 0', borderRadius: 10,
                border: `1px solid ${project.color}33`,
                background: T.viewGuideBg,
                color: T.viewGuideColor, fontWeight: 600, fontSize: 13,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              📖 View Guide
            </button>
          </div>
        ) : (
          <div style={{
            padding: '16px', borderRadius: 12,
            background: T.lockedPanelBg,
            border: `1px solid ${T.lockedPanelBorder}`,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>🔒</div>
            <div style={{ fontSize: 14, color: T.lockedText, lineHeight: 1.5 }}>
              Complete <strong style={{ color: T.lockedStrong }}>
                {PROJECTS.find(p => p.slug === fullProject?.prerequisite)?.title || 'the previous project'}
              </strong> first to unlock this one!
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
// --- Main Page -----------------------------------------------------------
export default function AdventureMapPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const classId = searchParams.get('classId')
  const {
    xp, currentLevel, currentLevelData, nextLevel, xpProgress,
    completedProjects: localCompletedProjects = [],
  } = useGamification()
  const [classAdventure, setClassAdventure] = useState(null)
  const [classProgress, setClassProgress] = useState(null)

  // ── Read initial theme from document (set by LandingPage) ──
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark')
  const [selectedProject, setSelectedProject] = useState(null)

  // Journey tabs: 'arduino' | 'esp32' — only swaps which WORLDS array feeds worldGroups.
  const [activeJourney, setActiveJourney] = useState('arduino')
  const WORLDS = activeJourney === 'arduino' ? ARDUINO_WORLDS : ESP32_WORLDS

  const T = getT(theme)

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
  }

  useEffect(() => {
    let cancelled = false
    const loadClassAdventure = async () => {
      try {
        const [adventureResponse, progressResponse] = await Promise.all([
          getAdventureContent(classId),
          getAdventureProgress(classId),
        ])
        if (cancelled) return
        setClassAdventure(adventureResponse?.resolved || null)
        setClassProgress(progressResponse?.progress || null)
      } catch {
        if (!cancelled) {
          setClassAdventure(null)
          setClassProgress(null)
        }
      }
    }
    loadClassAdventure()
    return () => {
      cancelled = true
    }
  }, [classId])

  const resolvedProjects = useMemo(() => {
    const source = [...PROJECTS]
    const content = classAdventure || buildFallbackClassAdventureContent()
    const projectRows = Array.isArray(content?.projects) ? content.projects : []
    if (!projectRows.length) return source
    return projectRows
      .filter((project) => project.enabled !== false)
      .map((project, index) => ({
        ...source.find((base) => base.slug === project.slug),
        ...project,
        number: Number.isFinite(project.order) ? project.order : index + 1,
        world: Number(String(project.worldId || '').replace('world-', '')) || 1,
        color: project.color || source.find((base) => base.slug === project.slug)?.color || '#3b82f6',
        icon: project.icon || source.find((base) => base.slug === project.slug)?.icon || '🧩',
      }))
      .sort((a, b) => (a.world - b.world) || (a.number - b.number))
  }, [classAdventure])

  const completedProjects = useMemo(() => {
    const classCompleted = classProgress?.completedProjects?.map(p => p.projectSlug || p) || []
    
    // Fallback: If local step progress says 'sim' is complete, the project is complete.
    // This repairs state if GamificationContext was wiped.
    const inferredCompleted = resolvedProjects.filter(p => {
      const progress = getLocalAdventureStepProgress(p.slug)
      return progress?.completedSteps?.includes(`${p.slug}:sim`)
    }).map(p => p.slug)

    return Array.from(new Set([...localCompletedProjects, ...classCompleted, ...inferredCompleted]))
  }, [localCompletedProjects, classProgress, resolvedProjects])

  const getStatus = (project) => {
    if (!classAdventure?.projects?.length) return getProjectStatus(project.slug, completedProjects)
    if (completedProjects.includes(project.slug)) return 'completed'
    if (!project.prerequisite) return 'available'
    return completedProjects.includes(project.prerequisite) ? 'available' : 'locked'
  }
  const handleNodeClick = (project) => setSelectedProject(project)
  const handleStepNavigate = (project, step) => {
    if (!step?.route) return
    const route = step.route(project.slug)
    const url = new URL(route, window.location.origin)
    if (classId) url.searchParams.set('classId', classId)
    url.searchParams.set('fromMap', '1')
    navigate(url.pathname + url.search)
  }

  const handleStart = (slug, mode) => {
    setSelectedProject(null)
    const searchParams = new URLSearchParams()
    if (classId) searchParams.set('classId', classId)
    searchParams.set('fromMap', '1')
    const suffix = `?${searchParams.toString()}`

    if (mode === 'guide') navigate(`/${slug}/reading${suffix}`)
    else if (mode === 'guide-simple') navigate(`/${slug}/guide${suffix}`)
    else navigate(`/${slug}/assessment${suffix}`)
  }

  const completedCount = completedProjects.length
  const totalProjects  = resolvedProjects.length

  const worldGroups = useMemo(() => {
    const journeyProjects = resolvedProjects.filter(p => getProjectJourney(p) === activeJourney)
    const isESP32Empty = activeJourney === 'esp32' && journeyProjects.length === 0

    if (!classAdventure?.worlds?.length || isESP32Empty) {
      return WORLDS.map(w => ({
        ...w,
        projects: resolvedProjects.filter(p => w.slugs.includes(p.slug)).sort((a, b) => a.number - b.number),
      }))
    }
    return classAdventure.worlds
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((world, worldIdx) => ({
        id: world.id || `world-${worldIdx + 1}`,
        name: world.title || `World ${worldIdx + 1}`,
        theme: world.theme || '',
        color: world.color || '#3b82f6',
        bg: `${world.color || '#3b82f6'}14`,
        border: `${world.color || '#3b82f6'}44`,
        icon: world.icon || '🧭',
        projects: journeyProjects.filter((project) => project.worldId === world.id).sort((a, b) => (a.order || 0) - (b.order || 0)),
      }))
      .filter(w => w.projects.length > 0)
  }, [classId, classAdventure, resolvedProjects, activeJourney])

  const stepGap = 80
  const stepTopPad = 36
  const getStepPoints = (count) => (
    Array.from({ length: count }, (_, i) => ({
      x: PATH_X[i % PATH_X.length],
      y: stepTopPad + i * stepGap,
    }))
  )

  const getStepStatusForProject = (project, step, isProjectLocked) => {
    if (step.soon || isProjectLocked) return 'locked'
    if (completedProjects.includes(project.slug)) return 'completed'

    const progress = getLocalAdventureStepProgress(project.slug)
    const currentOrder = progress?.currentStepOrder || 1
    const completedSteps = progress?.completedSteps || []
    const stepId = `${project.slug}:${step.key}`

    if (completedSteps.includes(stepId)) return 'completed'
    if (step.order === currentOrder) return 'current'
    if (step.order < currentOrder) return 'unlocked'
    return 'locked'
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: T.pageBg,
      fontFamily: "'Nunito', 'Rajdhani', system-ui, sans-serif",
      color: T.pageColor,
      overflowX: 'hidden',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');

        @keyframes nodePulse {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.06); filter: brightness(1.2); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes starSpin {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.2); }
          100% { transform: rotate(360deg) scale(1); }
        }
      `}</style>

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: T.headerBg,
        backdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${T.headerBorder}`,
        padding: '0 20px',
      }}>
        <div style={{
          maxWidth: 900, margin: '0 auto',
          display: 'flex', alignItems: 'center', gap: 16,
          height: 60,
        }}>
          <button
            style={{
              background: T.backBtnBg,
              border: `1px solid ${T.backBtnBorder}`,
              borderRadius: 8, padding: '6px 14px',
              color: T.backBtnColor, cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
              fontFamily: 'inherit', transition: 'all .15s',
            }}
            onClick={() => navigate(classId ? `/student/classes/${encodeURIComponent(classId)}` : '/student/dashboard')}
          >← Back</button>

          <span style={{
            fontSize: 17, fontWeight: 900,
            background: 'linear-gradient(90deg, #34d399, #3b82f6)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>⚡ OpenHW Adventure</span>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* XP bar */}
            <div style={{ width: 100 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.xpMetaColor, marginBottom: 3 }}>
                <span>{xp} XP</span>
                {nextLevel && <span>{nextLevel.xpRequired}</span>}
              </div>
              <div style={{ height: 5, borderRadius: 99, background: T.xpBarTrack, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99, transition: 'width .6s ease',
                  width: `${xpProgress}%`,
                  background: `linear-gradient(90deg, ${currentLevelData?.color || '#34d399'}, ${currentLevelData?.color || '#34d399'}88)`,
                }} />
              </div>
            </div>

            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 900,
              border: `2px solid ${currentLevelData?.color || '#34d399'}`,
              background: `${currentLevelData?.color || '#34d399'}22`,
              color: currentLevelData?.color || '#34d399',
              flexShrink: 0,
            }}>
              {currentLevel}
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title="Toggle light/dark mode"
              style={{
                background: T.toggleBg,
                border: `1px solid ${T.toggleBorder}`,
                borderRadius: 8, padding: '6px 10px',
                color: T.toggleColor, cursor: 'pointer',
                fontSize: 14, fontFamily: 'inherit',
                transition: 'all .15s',
              }}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {/* My Components button */}
            <button
              onClick={() => navigate('/components')}
              title="View your components"
              style={{
                background: 'rgba(59,130,246,0.1)',
                border: '1px solid rgba(59,130,246,0.3)',
                borderRadius: 8, padding: '6px 12px',
                color: '#60a5fa', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                transition: 'all .15s',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              🧰 My Components
            </button>
          </div>
        </div>
      </header>

      {/* ── Journey Tabs: Arduino / ESP32 ────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 60, zIndex: 99,
        background: T.headerBg, backdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${T.headerBorder}`,
      }}>
        <div style={{
          maxWidth: 900, margin: '0 auto', padding: '0 20px',
          display: 'flex', alignItems: 'center', gap: 4, height: 48,
        }}>
          {[
            { id: 'arduino', icon: '🔵', label: 'Arduino Journey', color: '#00979d' },
            { id: 'esp32',   icon: '📡', label: 'ESP32 Journey',   color: '#e74c3c' },
          ].map(j => {
            const active = activeJourney === j.id
            return (
              <button key={j.id} type="button"
                onClick={() => { setActiveJourney(j.id); setSelectedProject(null) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 16px', borderRadius: 8, border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 800,
                  background: active ? `${j.color}22` : 'transparent',
                  color: active ? j.color : T.pageColor,
                  borderBottom: active ? `2px solid ${j.color}` : '2px solid transparent',
                  transition: 'all .18s',
                }}
              >
                <span>{j.icon}</span>
                <span>{j.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '32px 20px 6px', animation: 'fadeSlideUp .5s ease both' }}>
        <div style={{
          fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase',
          color: T.heroLabel, marginBottom: 10,
        }}>🗺️ Your Learning Journey</div>
        <h1 style={{
          fontSize: 30, fontWeight: 900, margin: '0 0 8px',
          background: T.heroTitle,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          lineHeight: 1.2,
        }}>
          {activeJourney === 'arduino' ? 'Arduino Adventure Map' : 'ESP32 Adventure Map'}
        </h1>
        <p style={{ color: T.heroSubText, fontSize: 14, margin: '0 auto 6px', maxWidth: 380, lineHeight: 1.6 }}>
          Complete projects to earn more components.<br/>
          Short quizzes help lock in what you learn.
        </p>
        {classId && (
          <p style={{ color: T.heroSubText, fontSize: 12, margin: '0 auto', maxWidth: 420 }}>
            Class mode active {classProgress?.lastActivityAt ? `- Last activity ${new Date(classProgress.lastActivityAt).toLocaleString()}` : ''}
          </p>
        )}


      </div>

      {/* Map */}
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '12px 20px 120px' }}>
        {worldGroups.map((world, wi) => {
          const allDone = world.projects.every(p => completedProjects.includes(p.slug))
          const isComingSoon = world.comingSoon === true || world.projects.length === 0

          if (isComingSoon) return (
            <div key={world.id} style={{ marginBottom: 10, animation: `fadeSlideUp .5s ease ${wi * 0.1}s both`, opacity: 0.6 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '14px 18px', borderRadius: 10,
                background: world.bg, border: `1px dashed ${world.border}`, color: world.color,
              }}>
                <span style={{ fontSize: 20 }}>{world.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{world.name}</div>
                  <div style={{ fontSize: 11, opacity: .7, fontWeight: 600 }}>Projects coming soon — check back later!</div>
                </div>
              </div>
            </div>
          )

          return (
            <div key={world.id} style={{ marginBottom: 10, animation: `fadeSlideUp .5s ease ${wi * 0.1}s both` }}>
              {/* World header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 18px', borderRadius: 10, marginBottom: 8,
                fontSize: 13, fontWeight: 700,
                background: world.bg, border: `1px solid ${world.border}`, color: world.color,
              }}>
                <span style={{ fontSize: 18 }}>{world.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>World {world.id}: {world.name}</div>
                  <div style={{ fontSize: 11, opacity: .65, fontWeight: 600 }}>
                    {world.theme} · {world.projects.filter(p => completedProjects.includes(p.slug)).length}/{world.projects.length} done
                    {allDone && ' · 🏆 World Clear!'}
                  </div>
                </div>
              </div>

              {/* Project Journey Blocks */}
              {world.projects.map((project) => {
                const status = getStatus(project)
                const isCompleted = status === 'completed'
                const isAvailable = status === 'available'
                const isLocked = status === 'locked'

                const steps = [
                  { key: 'read', label: 'Reading Part', icon: '\u{1F4D6}', order: 1, route: (slug) => '/' + slug + '/reading' },
                  { key: 'quiz', label: 'Quiz', icon: '\u2753', order: 2, route: (slug) => '/' + slug + '/quiz' },
                  { key: 'unlock', label: 'Component Unlock', icon: '\u{1F381}', order: 3, route: (slug) => '/' + slug + '/components' },
                  { key: 'demo', label: 'Learn from project demo', icon: '📺', order: 4, route: (slug) => '/' + slug + '/guide' },
                  { key: 'sim', label: 'Simulator / Project', icon: '\u{1F527}', order: 5, route: (slug) => '/' + slug + '/assessment' },
                ]

                const points = getStepPoints(steps.length)
                const height = points.length > 0 ? points[points.length - 1].y + 44 : 120
                const segments = points.slice(1).flatMap((p, i) => {
                  const prev = points[i]
                  return [
                    {
                      type: 'h',
                      x: Math.min(prev.x, p.x),
                      y: prev.y,
                      length: Math.abs(p.x - prev.x),
                    },
                    {
                      type: 'v',
                      x: p.x,
                      y: Math.min(prev.y, p.y),
                      length: Math.abs(p.y - prev.y),
                    },
                  ]
                })

                return (
                  <div key={project.slug} style={{ marginBottom: 16 }}>
                    {/* Project Heading */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: `${project.color}12`,
                      border: `1px solid ${project.color}33`,
                      color: isLocked ? T.labelLocked : project.color,
                      fontSize: 13,
                      fontWeight: 800,
                    }}>
                      <span style={{ fontSize: 18 }}>{project.icon}</span>
                      <span style={{ flex: 1, color: isLocked ? T.labelLocked : T.labelText }}>
                        {project.title}
                      </span>
                      <span style={{
                        fontSize: 11,
                        color: isLocked ? T.labelLocked : T.labelXp,
                        fontWeight: 700,
                      }}>
                        {isCompleted ? '✅ Completed' : `${project.xpReward} XP`}
                      </span>
                    </div>

                    {/* Step Nodes */}
                    <div style={{ position: 'relative', height, marginTop: 6 }}>
                    {segments.map((seg, idx) => (
                      <div
                        key={idx}
                        style={seg.type === 'h' ? {
                          position: 'absolute',
                          left: `${seg.x}%`,
                          top: seg.y,
                          width: `${seg.length}%`,
                          height: 2,
                          backgroundImage: `repeating-linear-gradient(90deg, ${T.connectorLocked} 0 6px, transparent 6px 14px)`,
                          opacity: 0.9,
                        } : {
                          position: 'absolute',
                          left: `${seg.x}%`,
                          top: seg.y,
                          width: 2,
                          height: seg.length,
                          transform: 'translateX(-50%)',
                          backgroundImage: `repeating-linear-gradient(180deg, ${T.connectorLocked} 0 6px, transparent 6px 14px)`,
                          opacity: 0.9,
                        }}
                      />
                    ))}

                      {steps.map((step, si) => {
                        const point = points[si]
                        const stepStatus = getStepStatusForProject(project, step, isLocked)
                        const isStepLocked = stepStatus === 'locked' || step.soon
                        const nodeSize = isAvailable ? 56 : 50

                        return (
                          <div
                            key={step.key}
                            onClick={() => !isStepLocked && handleStepNavigate(project, step)}
                            style={{
                              position: 'absolute',
                              left: `${point.x}%`,
                              top: point.y,
                              transform: 'translate(-50%, -50%)',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 8,
                              cursor: isStepLocked ? 'default' : 'pointer',
                            }}
                          >
                            <div style={{
                              width: nodeSize,
                              height: nodeSize,
                              borderRadius: '50%',
                              border: `2px solid ${isStepLocked ? T.nodeLockedBorder : project.color}`,
                              background: isStepLocked
                                ? T.nodeLockedBg
                                : `radial-gradient(circle, ${project.color}20, transparent)`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: isStepLocked ? 'none' : `0 0 14px ${project.color}44`,
                              transition: 'transform .2s, box-shadow .2s',
                            }}>
                              <span style={{
                                fontSize: 18,
                                filter: isStepLocked ? 'grayscale(1) opacity(.35)' : 'none',
                                lineHeight: 1,
                              }}>
                                {isStepLocked ? '🔒' : step.icon}
                              </span>
                            </div>

                            <div style={{
                              padding: '6px 10px',
                              borderRadius: 10,
                              border: `1px dashed ${isStepLocked ? T.labelLocked : project.color}55`,
                              background: isStepLocked ? 'rgba(255,255,255,0.02)' : `${project.color}12`,
                              color: isStepLocked ? T.labelLocked : T.labelText,
                              fontSize: 12,
                              fontWeight: 700,
                              minWidth: 160,
                              textAlign: 'center',
                              zIndex: 2,
                            }}>
                              {step.label}
                              {stepStatus === 'completed' && !step.soon && (
                                <span style={{ marginLeft: 6, color: '#22c55e' }}>✓</span>
                              )}
                              {step.soon && (
                                <div style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  marginTop: 2,
                                  color: T.labelLocked,
                                  letterSpacing: '.06em',
                                  textTransform: 'uppercase',
                                }}>
                                  Coming Soon
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {/* World clear badge */}
              {allDone && (
                <div style={{ textAlign: 'center', marginTop: 4, marginBottom: 12, animation: 'fadeSlideUp .4s ease both' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '5px 14px', borderRadius: 8,
                    background: `${world.color}15`, border: `1px solid ${world.color}40`,
                    color: world.color, fontSize: 11, fontWeight: 800, letterSpacing: '.05em',
                  }}>
                    🏆 World {world.id} Complete!
                  </span>
                </div>
              )}
            </div>
          )
        })}

        {/* All done! */}
        {totalProjects > 0 && completedCount === totalProjects && (
          <div style={{ textAlign: 'center', padding: '32px 20px', animation: 'fadeSlideUp .6s ease both' }}>
            <div style={{ fontSize: 56, marginBottom: 12, animation: 'starSpin 3s linear infinite' }}>🏆</div>
            <div style={{
              fontSize: 22, fontWeight: 900,
              background: 'linear-gradient(135deg, #fbbf24, #f97316)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              All Projects Complete!
            </div>
            <p style={{ color: T.allDoneText, fontSize: 13, marginTop: 6 }}>
              You're a true Circuit Champion! 🎖️
            </p>
          </div>
        )}
      </div>

      {/* Progress panel */}
      <div style={{
        position: 'fixed', bottom: 16, left: '50%',
        transform: 'translateX(-50%)',
        background: T.progressBg,
        backdropFilter: 'blur(20px)',
        border: `1px solid ${T.progressBorder}`,
        borderRadius: 16, padding: '10px 20px',
        display: 'flex', alignItems: 'center', gap: 16,
        zIndex: 200,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: 20, fontWeight: 900, lineHeight: 1, color: '#fbbf24' }}>{xp}</span>
          <span style={{ fontSize: 10, color: T.progressLabel, textTransform: 'uppercase', letterSpacing: '.06em' }}>XP</span>
        </div>
        <div style={{ width: 1, height: 32, background: T.progressDivider }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: 20, fontWeight: 900, lineHeight: 1, color: '#34d399' }}>{completedCount}</span>
          <span style={{ fontSize: 10, color: T.progressLabel, textTransform: 'uppercase', letterSpacing: '.06em' }}>Done</span>
        </div>
        <div style={{ width: 1, height: 32, background: T.progressDivider }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: 20, fontWeight: 900, lineHeight: 1, color: T.backBtnColor }}>{totalProjects - completedCount}</span>
          <span style={{ fontSize: 10, color: T.progressLabel, textTransform: 'uppercase', letterSpacing: '.06em' }}>Left</span>
        </div>
        <div style={{ width: 1, height: 32, background: T.progressDivider }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: 20, fontWeight: 900, lineHeight: 1, color: currentLevelData?.color || '#34d399' }}>
            {currentLevelData?.icon} {currentLevel}
          </span>
          <span style={{ fontSize: 10, color: T.progressLabel, textTransform: 'uppercase', letterSpacing: '.06em' }}>Level</span>
        </div>
        <div style={{ width: 80, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
          <div style={{ height: 4, borderRadius: 99, background: T.progressBarTrack, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99,
              width: `${Math.round((completedCount / totalProjects) * 100)}%`,
              background: 'linear-gradient(90deg, #34d399, #3b82f6)',
              transition: 'width .6s ease',
            }} />
          </div>
            <div style={{ fontSize: 10, color: T.progressPct, textAlign: 'center' }}>
            {totalProjects > 0 ? Math.round((completedCount / totalProjects) * 100) : 0}%
          </div>
        </div>
      </div>

      {/* Modal */}
      {selectedProject && (
        <ProjectModal
          project={selectedProject}
          isCompleted={completedProjects.includes(selectedProject.slug)}
          isAvailable={getStatus(selectedProject) !== 'locked'}
          onClose={() => setSelectedProject(null)}
          onStart={handleStart}
          T={T}
        />
      )}
    </div>
  )
}



