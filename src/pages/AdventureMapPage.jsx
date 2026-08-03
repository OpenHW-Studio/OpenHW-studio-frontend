import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useGamification } from '../context/GamificationContext'
import { useAuth } from '../context/AuthContext'
import { PROJECTS, getProjectStatus, getProjectRewardComponents, normalizeDifficulty } from '../services/gamification/ProjectsConfig'
import {
  getAdventureContent,
  getAdventureProgress,
  getLocalAdventureStepProgress,
  markAdventureStepComplete
} from '../services/adventureService'
import { buildFallbackClassAdventureContent } from '../services/classAdventureAdapter'
import {
  Map, Package, ScrollText, Trophy, BarChart2, ShoppingCart,
  Star, Coins, Gem, Lock, Check, ChevronLeft, ChevronRight,
  Zap, Radio, Cpu, Thermometer, RotateCcw, Lightbulb,
  BookOpen, HelpCircle, Gift, Wrench, ArrowLeft, ArrowRight, User,
  Flame, LogOut, Settings, Calendar, Shield, Layers,
  Activity, Wifi, Server, Award, Monitor, Volume2, Keyboard,
  ScanLine, Gauge, Plug, ToggleLeft, Timer, Cog, Sun, Moon,
  Search, Bell, Compass, Folder, FileText
} from 'lucide-react'

// ─── Arduino journey worlds ──────────────────────────────────────────────────
const ARDUINO_WORLDS = [
  { id: 1, name: 'Circuit Basics', theme: 'Beginner', color: '#22c55e', slugs: ['led-blink', 'rgb-led', 'buzzer', 'potentiometer', 'ldr'] },
  { id: 2, name: 'Signal Control', theme: 'Intermediate', color: '#3b82f6', slugs: ['servo-motor', 'led-strip', 'button-debounce', 'temperature-sensor'] },
  { id: 3, name: 'Machines & Sensors', theme: 'Advanced', color: '#f97316', slugs: ['dc-motor'] },
  { id: 4, name: 'Smart Sensing', theme: 'Expert', color: '#14b8a6', slugs: ['push-button', 'ultrasonic-sensor', 'dht11-sensor', 'lcd-display'] },
  { id: 5, name: 'Advanced Components', theme: 'Master', color: '#ec4899', slugs: ['relay-control', 'oled-graphics', 'neopixel-effects', 'keypad-lock', 'rotary-menu', 'seven-segment-clock', 'stepper-motor', 'mpu6050-tilt'] },
]

// ─── ESP32 journey worlds ────────────────────────────────────────────────────
const ESP32_WORLDS = [
  { id: 1, name: 'ESP32 Basics', theme: 'Easy', color: '#22c55e', slugs: ['esp32-blink', 'esp32-analog', 'esp32-pwm'] },
  { id: 2, name: 'ESP32 IoT & WiFi', theme: 'Intermediate', color: '#3b82f6', slugs: ['esp32-wifi-scan', 'esp32-web-server', 'esp32-http-client'] },
  { id: 3, name: 'Advanced ESP32', theme: 'Hard', color: '#f97316', slugs: ['esp32-mqtt', 'esp32-ble', 'esp32-deep-sleep'] },
  { id: 4, name: 'IoT Applications', theme: 'Expert', color: '#a855f7', slugs: ['esp32-oled-wifi', 'esp32-sensor-cloud', 'esp32-cam-stream'] },
]

// All Arduino slugs across all 5 worlds
const ALL_ARDUINO_SLUGS = [
  'led-blink', 'rgb-led', 'buzzer', 'potentiometer', 'ldr',
  'servo-motor', 'led-strip', 'button-debounce', 'temperature-sensor',
  'dc-motor',
  'push-button', 'ultrasonic-sensor', 'dht11-sensor', 'lcd-display',
  'relay-control', 'oled-graphics', 'neopixel-effects', 'keypad-lock',
  'rotary-menu', 'seven-segment-clock', 'stepper-motor', 'mpu6050-tilt',
]

function getProjectJourney(project) {
  if (!project) return 'arduino'
  if (ALL_ARDUINO_SLUGS.includes(project.slug)) return 'arduino'
  const components = project.components || []
  for (const comp of components) {
    const type = String(comp.type || comp.id || '').toLowerCase()
    if (type.includes('esp32')) return 'esp32'
  }
  return 'arduino'
}

// Icon per project slug
function getProjectIcon(slug) {
  const s = String(slug || '').toLowerCase()
  if (s.includes('led') && s.includes('strip') || s.includes('neopixel')) return Layers
  if (s.includes('led') || s.includes('blink') || s.includes('rgb')) return Lightbulb
  if (s.includes('buzzer')) return Activity
  if (s.includes('servo')) return RotateCcw
  if (s.includes('stepper') || s.includes('motor')) return Cog
  if (s.includes('potentiometer') || s.includes('rotary')) return Gauge
  if (s.includes('ldr') || s.includes('ultrasonic') || s.includes('dht') || s.includes('dht11')) return ScanLine
  if (s.includes('temperature')) return Thermometer
  if (s.includes('button') || s.includes('push')) return Zap
  if (s.includes('relay')) return Plug
  if (s.includes('lcd') || s.includes('oled') || s.includes('display') || s.includes('segment')) return Monitor
  if (s.includes('keypad')) return Keyboard
  if (s.includes('mpu') || s.includes('tilt')) return ToggleLeft
  if (s.includes('esp32') && s.includes('wifi')) return Wifi
  if (s.includes('esp32') && s.includes('server')) return Server
  if (s.includes('esp32')) return Cpu
  return Radio
}

// Island image per project slug → /gamification_images/
function getIslandImage(slug) {
  const s = String(slug || '').toLowerCase()
  // Arduino world 1
  if (s === 'led-blink') return '/gamification_images/island_led.png'
  if (s === 'rgb-led') return '/gamification_images/island_rgb.png'
  if (s === 'buzzer') return '/gamification_images/island_buzzer.png'
  if (s === 'potentiometer') return '/gamification_images/island_potentiometer.png'
  if (s === 'ldr') return '/gamification_images/island_ldr.png'
  // Arduino world 2
  if (s === 'servo-motor') return '/gamification_images/island_servo.png'
  if (s === 'led-strip') return '/gamification_images/island_led_strip.png'
  if (s === 'button-debounce') return '/gamification_images/island_button.png'
  if (s === 'temperature-sensor') return '/gamification_images/island_temperature.png'
  // Arduino world 3
  if (s === 'dc-motor') return '/gamification_images/island_dc_motor.png'
  // Arduino world 4
  if (s === 'push-button') return '/gamification_images/island_button.png'
  if (s === 'ultrasonic-sensor') return '/gamification_images/island_ultrasonic.png'
  if (s === 'dht11-sensor') return '/gamification_images/island_dht11.png'
  if (s === 'lcd-display') return '/gamification_images/island_lcd.png'
  // Arduino world 5
  if (s === 'relay-control') return '/gamification_images/island_relay.png'
  if (s === 'oled-graphics') return '/gamification_images/island_oled.png'
  if (s === 'neopixel-effects') return '/gamification_images/island_led_strip.png'
  if (s === 'keypad-lock') return '/gamification_images/island_keypad.png'
  if (s === 'rotary-menu') return '/gamification_images/island_potentiometer.png'
  if (s === 'seven-segment-clock') return '/gamification_images/island_seven_segment.png'
  if (s === 'stepper-motor') return '/gamification_images/island_stepper.png'
  if (s === 'mpu6050-tilt') return '/gamification_images/island_mpu6050.png'
  // ESP32
  if (s.includes('esp32') && s.includes('wifi') || s.includes('web-server') || s.includes('http')) return '/gamification_images/island_wifi.png'
  if (s.includes('mqtt')) return '/gamification_images/island_mqtt.png'
  if (s.includes('ble')) return '/gamification_images/island_ble.png'
  if (s.includes('deep-sleep')) return '/gamification_images/island_deep_sleep.png'
  if (s.includes('oled')) return '/gamification_images/island_oled.png'
  if (s.includes('cloud')) return '/gamification_images/island_cloud.png'
  if (s.includes('cam')) return '/gamification_images/island_camera.png'
  if (s.includes('esp32')) return '/gamification_images/island_esp32.png'
  return '/gamification_images/island_led.png'
}

// Island color palette based on index (used for glow accents)
const ISLAND_PALETTES = [
  { base: '#16a34a', mid: '#22c55e', light: '#4ade80', dark: '#15803d', accent: '#86efac' },
  { base: '#2563eb', mid: '#3b82f6', light: '#60a5fa', dark: '#1d4ed8', accent: '#93c5fd' },
  { base: '#d97706', mid: '#f59e0b', light: '#fcd34d', dark: '#b45309', accent: '#fde68a' },
  { base: '#7c3aed', mid: '#8b5cf6', light: '#a78bfa', dark: '#6d28d9', accent: '#c4b5fd' },
  { base: '#0891b2', mid: '#06b6d4', light: '#22d3ee', dark: '#0e7490', accent: '#67e8f9' },
  { base: '#be123c', mid: '#e11d48', light: '#fb7185', dark: '#9f1239', accent: '#fda4af' },
]

// PNG island node component - uses actual island images
function IslandNode({ project, index, isActive, isCompleted, isLocked, onClick, palette }) {
  const p = palette || ISLAND_PALETTES[index % ISLAND_PALETTES.length]
  const islandImg = getIslandImage(project.slug)

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: isLocked ? 'not-allowed' : 'pointer',
        gap: 0,
        userSelect: 'none',
      }}
    >
      {/* Island image container */}
      <div style={{ position: 'relative', width: 230, height: 200 }}>
        {/* Active glow ring */}
        {isActive && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 999,
            border: '3px solid rgba(99,102,241,0.8)',
            boxShadow: '0 0 0 4px rgba(99,102,241,0.2), 0 0 36px rgba(99,102,241,0.45)',
            animation: 'islandPulse 2s ease-in-out infinite',
            zIndex: 0,
          }} />
        )}

        {/* Island PNG */}
        <img
          src={islandImg}
          alt={project.title}
          style={{
            width: 230, height: 200,
            objectFit: 'contain',
            display: 'block',
            filter: isLocked
              ? 'grayscale(0.85) brightness(0.6)'
              : `drop-shadow(0 12px 24px rgba(0,0,0,0.3))`,
            transition: 'filter 0.3s ease, transform 0.2s ease',
            transform: (project.slug === 'rgb-led' || project.slug === 'led-blink')
              ? (isActive ? 'translateY(-4px) scale(1.75)' : 'translateY(0) scale(1.7)')
              : (isActive ? 'translateY(-4px) scale(1.35)' : 'translateY(0) scale(1.3)'),
            animation: !isLocked && !isActive ? 'islandFloat 4s ease-in-out infinite' : undefined,
          }}
        />

        {/* Lock overlay */}
        {isLocked && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 3,
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: '50%',
              background: 'rgba(15,23,42,0.75)',
              backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid rgba(255,255,255,0.2)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}>
              <Lock size={18} color="#94a3b8" />
            </div>
          </div>
        )}

        {/* Completed check badge */}
        {isCompleted && (
          <div style={{
            position: 'absolute', top: 16, right: 16,
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(16,185,129,0.6)',
            border: '2.5px solid #fff', zIndex: 4,
          }}>
            <Check size={16} color="#fff" strokeWidth={3} />
          </div>
        )}
      </div>

      {/* Label pill */}
      <div style={{
        background: isActive
          ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
          : isCompleted
            ? 'linear-gradient(135deg, #10b981, #059669)'
            : 'rgba(15,23,42,0.82)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: 20,
        padding: '5px 12px 4px',
        border: isActive ? '1.5px solid rgba(255,255,255,0.3)' : '1.5px solid rgba(255,255,255,0.12)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        minWidth: 100,
        textAlign: 'center',
        marginTop: -2,
      }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
          {project.number}. {project.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, marginTop: 2 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <Star key={i} size={8} color={isCompleted ? '#fbbf24' : '#475569'} fill={isCompleted ? '#fbbf24' : 'none'} strokeWidth={1.5} />
          ))}
          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', marginLeft: 2 }}>{isCompleted ? '5/5' : '0/5'}</span>
        </div>
      </div>
    </div>
  )
}

// Step progress circle
function StepNode({ icon: Icon, label, status, isLast, isSelected, onClick }) {
  const isDone = status === 'completed'
  const isCurr = status === 'current'
  const isLocked = status === 'locked'

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        position: 'relative',
        zIndex: 2,
        flex: 1,
        cursor: 'pointer',
      }}
    >
      {!isLast && (
        <div style={{
          position: 'absolute', top: 18, left: '60%', right: '-40%',
          height: 2.5, background: isDone ? '#6366f1' : 'rgba(99,102,241,0.15)',
          zIndex: 1,
          borderRadius: 2,
        }} />
      )}
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: isDone
          ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
          : isCurr
            ? 'linear-gradient(135deg, #f59e0b, #d97706)'
            : 'rgba(241,245,249,0.8)',
        border: isSelected
          ? '3px solid #6366f1'
          : isCurr ? '2.5px solid #fff' : isDone ? 'none' : '2px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: isSelected
          ? '0 0 0 3px rgba(99,102,241,0.45), 0 4px 12px rgba(99,102,241,0.25)'
          : isDone
            ? '0 4px 12px rgba(99,102,241,0.35)'
            : isCurr
              ? '0 4px 12px rgba(245,158,11,0.35)'
              : 'none',
        position: 'relative', zIndex: 2,
        transition: 'all 0.2s',
        opacity: isLocked ? 0.6 : 1,
        transform: isSelected ? 'scale(1.12)' : 'scale(1)',
      }}>
        {isDone ? (
          <Check size={15} color="#fff" strokeWidth={2.5} />
        ) : (
          <Icon size={15} color={isCurr ? '#fff' : '#94a3b8'} strokeWidth={1.8} />
        )}
      </div>
      <span style={{
        fontSize: 9.5,
        fontWeight: isSelected ? 800 : 700,
        color: isSelected ? '#4f46e5' : (isDone || isCurr ? '#334155' : '#94a3b8'),
        whiteSpace: 'nowrap'
      }}>{label}</span>
    </div>
  )
}

// Nav item for sidebar
function NavItem({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 11,
        padding: '10px 14px', borderRadius: 14, border: 'none',
        background: active ? 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(79,70,229,0.08))' : 'transparent',
        color: active ? '#6366f1' : '#475569',
        fontSize: 13, fontWeight: 700, cursor: 'pointer',
        textAlign: 'left', width: '100%', transition: 'all 0.18s',
        borderLeft: active ? '3px solid #6366f1' : '3px solid transparent',
      }}
    >
      <Icon size={17} strokeWidth={1.8} />
      <span>{label}</span>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function AdventureMapPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const classId = searchParams.get('classId')
  const { user, logout } = useAuth()
  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const {
    xp, currentLevel, currentLevelData, nextLevel, xpProgress,
    coins = 0, gems = 0, earnedBadges = [],
    completedProjects: localCompletedProjects = [],
  } = useGamification()

  const [classAdventure, setClassAdventure] = useState(null)
  const [classProgress, setClassProgress] = useState(null)

  const journeyParam = searchParams.get('journey')
  const [activeJourney, setActiveJourney] = useState(
    journeyParam === 'esp32' || journeyParam === 'arduino' ? journeyParam : 'arduino'
  )
  const WORLDS = activeJourney === 'arduino' ? ARDUINO_WORLDS : ESP32_WORLDS

  useEffect(() => {
    const jp = searchParams.get('journey')
    if (jp === 'esp32' || jp === 'arduino') {
      setActiveJourney(jp)
    }
  }, [searchParams])

  const [activeWorldIdx, setActiveWorldIdx] = useState(0)
  const [selectedProject, setSelectedProject] = useState(null)
  const [showRightPanel, setShowRightPanel] = useState(false)
  const [selectedStepKey, setSelectedStepKey] = useState(null)
  const [sidebarTab, setSidebarTab] = useState('world-map')
  // Slug to auto-open when navigating back from a project page
  const [pendingOpenSlug, setPendingOpenSlug] = useState(() => location.state?.openProject || null)

  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768)

  const [toastMessage, setToastMessage] = useState(null)
  const toastTimeoutRef = useRef(null)

  const showToast = useCallback((msg) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    setToastMessage(msg)
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null)
    }, 3000)
  }, [])

  useEffect(() => {
    if (!journeyParam) {
      document.title = "OpenHW Studio - Adventure Hub (Universal Shell)"
    } else {
      document.title = "OpenHW Studio - Adventure Map"
    }
  }, [journeyParam])

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Auto-open the island panel when returning from a project page via router state
  useEffect(() => {
    const openSlug = location.state?.openProject
    if (openSlug) setPendingOpenSlug(openSlug)
  }, [location.state])

  // ── All hooks must be declared before the early return to satisfy Rules of Hooks ──
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
      }))
      .sort((a, b) => (a.world - b.world) || (a.number - b.number))
  }, [classAdventure])

  // When returning from a project page, resolve the pending slug to open the island panel
  useEffect(() => {
    if (!pendingOpenSlug || !resolvedProjects.length) return
    const target = resolvedProjects.find(p => p.slug === pendingOpenSlug)
    if (!target) return
    // Determine which world index contains this project
    const journey = getProjectJourney(target)
    const worlds = journey === 'esp32' ? ESP32_WORLDS : ARDUINO_WORLDS
    const worldIdx = worlds.findIndex(w => w.slugs.includes(target.slug))
    if (worldIdx !== -1) setActiveWorldIdx(worldIdx)
    setSelectedProject(target)
    setShowRightPanel(true)
    setPendingOpenSlug(null) // clear so it doesn't re-trigger
  }, [pendingOpenSlug, resolvedProjects])

  const completedProjects = useMemo(() => {
    const classCompleted = classProgress?.completedProjects?.map(p => p.projectSlug || p) || []
    const inferredCompleted = resolvedProjects.filter(p => {
      const progress = getLocalAdventureStepProgress(p.slug)
      return progress?.completedSteps?.includes(`${p.slug}:sim`)
    }).map(p => p.slug)
    return Array.from(new Set([...localCompletedProjects, ...classCompleted, ...inferredCompleted]))
  }, [localCompletedProjects, classProgress, resolvedProjects])

  const getStatus = useCallback((project) => {
    if (!project) return 'locked'
    if (completedProjects.includes(project.slug)) return 'completed'
    if (!project.prerequisite) return 'available'
    return completedProjects.includes(project.prerequisite) ? 'available' : 'locked'
  }, [completedProjects])

  const currentWorld = useMemo(() => WORLDS[activeWorldIdx] || WORLDS[0], [WORLDS, activeWorldIdx])

  const currentWorldProjects = useMemo(() => {
    const journeyProjects = resolvedProjects.filter(p => getProjectJourney(p) === activeJourney)
    return journeyProjects.filter(p => currentWorld.slugs.includes(p.slug)).sort((a, b) => a.number - b.number)
  }, [resolvedProjects, activeJourney, currentWorld])

  const activeProject = useMemo(() => {
    if (selectedProject && currentWorldProjects.some(p => p.slug === selectedProject.slug)) {
      return selectedProject
    }
    const firstIncomplete = currentWorldProjects.find(p => getStatus(p) === 'available')
    return firstIncomplete || currentWorldProjects[0] || null
  }, [currentWorldProjects, selectedProject, getStatus])

  const getSubstepStatus = useCallback((project, stepKey) => {
    if (!project) return 'locked'
    const projStatus = getStatus(project)
    if (projStatus === 'locked') return 'locked'
    if (completedProjects.includes(project.slug)) return 'completed'
    const progress = getLocalAdventureStepProgress(project.slug)
    const completedSteps = progress?.completedSteps || []
    if (completedSteps.includes(`${project.slug}:${stepKey}`)) return 'completed'
    const stepOrder = { 'read': 1, 'quiz': 2, 'unlock': 3, 'guide': 4, 'sim': 5 }
    const currentOrder = progress?.currentStepOrder || 1
    if (stepOrder[stepKey] === currentOrder) return 'current'
    if (stepOrder[stepKey] < currentOrder) return 'unlocked'
    return 'locked'
  }, [completedProjects, getStatus])

  // Auto-select active step when activeProject updates
  useEffect(() => {
    if (activeProject) {
      const steps = ['read', 'quiz', 'unlock', 'guide', 'sim']
      const activeStep = steps.find(s => getSubstepStatus(activeProject, s) === 'current') || 'read'
      setSelectedStepKey(activeStep)
    }
  }, [activeProject, getSubstepStatus])

  useEffect(() => {
    let cancelled = false
    const loadClassAdventure = async () => {
      if (!classId) return
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
    return () => { cancelled = true }
  }, [classId])

  if (!journeyParam) {
    const initials = (user?.name || 'Alex').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    return (
      <div style={{
        height: '100vh',
        width: '100vw',
        backgroundColor: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Inter', sans-serif",
        overflow: 'hidden',
        userSelect: 'none',
      }}>
        <style>{`
          @keyframes onlinePulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
          @keyframes toastFadeIn {
            from { transform: translateY(20px) scale(0.95); opacity: 0; }
            to { transform: translateY(0) scale(1); opacity: 1; }
          }
          .campaign-card {
            background-color: var(--bg2);
            border: 1px solid var(--border);
            border-radius: 24px;
            padding: 24px;
            display: flex;
            flex-direction: column;
            align-items: center;
            position: relative;
            box-shadow: 0 10px 25px rgba(0,0,0,0.02);
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .campaign-card:hover {
            transform: translateY(-5px);
            box-shadow: var(--shadow);
            border-color: var(--border2);
          }
          .new-sim-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            padding: 10px;
            background-color: #2563eb;
            color: #ffffff;
            border: none;
            border-radius: 12px;
            font-weight: 700;
            font-size: 13px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(37,99,235,0.2);
            transition: all 0.2s;
          }
          .new-sim-btn:hover {
            background-color: #1d4ed8;
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(37,99,235,0.25);
          }
          .sidebar-nav-link {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 12px;
            border-radius: 10px;
            border: none;
            background-color: transparent;
            color: var(--text2);
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            text-align: left;
            width: 100%;
            transition: all 0.2s;
          }
          .sidebar-nav-link:hover {
            background-color: var(--bg3);
            color: var(--text);
          }
          .sidebar-nav-link-active {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 12px;
            border-radius: 10px;
            border: none;
            background-color: #2563eb;
            color: #ffffff;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            text-align: left;
            width: 100%;
            transition: all 0.2s;
          }
          .card-btn-blue {
            width: 100%;
            padding: 12px;
            background-color: #2563eb;
            color: #ffffff;
            border: none;
            border-radius: 12px;
            font-weight: 800;
            font-size: 11px;
            cursor: pointer;
            letter-spacing: 0.04em;
            transition: all 0.2s;
          }
          .card-btn-blue:hover {
            background-color: #1d4ed8;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(37,99,235,0.2);
          }
          .card-btn-light-blue {
            width: 100%;
            padding: 12px;
            background-color: rgba(37, 99, 235, 0.08);
            color: #2563eb;
            border: none;
            border-radius: 12px;
            font-weight: 800;
            font-size: 11px;
            cursor: pointer;
            letter-spacing: 0.04em;
            transition: all 0.2s;
          }
          .card-btn-light-blue:hover {
            background-color: rgba(37, 99, 235, 0.15);
            transform: translateY(-1px);
          }
          .card-btn-outline {
            width: 100%;
            padding: 12px;
            background-color: transparent;
            color: var(--text);
            border: 1px solid var(--border);
            border-radius: 12px;
            font-weight: 800;
            font-size: 11px;
            cursor: pointer;
            letter-spacing: 0.04em;
            transition: all 0.2s;
          }
          .card-btn-outline:hover {
            background-color: var(--bg3);
            border-color: var(--border2);
            transform: translateY(-1px);
          }
          .header-icon-btn {
            color: var(--text2);
            cursor: pointer;
            transition: color 0.2s, transform 0.1s;
            background: none;
            border: none;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .header-icon-btn:hover {
            color: var(--text);
            transform: scale(1.08);
          }
          .locked-overlay {
            position: absolute;
            inset: 0;
            background-color: var(--bg);
            opacity: 0.75;
            backdrop-filter: blur(3px);
            -webkit-backdrop-filter: blur(3px);
            z-index: 5;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .locked-badge {
            background-color: var(--text);
            color: var(--bg);
            padding: 8px 16px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 800;
            display: flex;
            align-items: center;
            box-shadow: var(--shadow);
          }
        `}</style>
        {/* Toast Notification */}
        {toastMessage && (
          <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(8px)',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            boxShadow: '0 12px 36px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.1)',
            zIndex: 1000,
            animation: 'toastFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '16px',
              boxShadow: '0 0 20px rgba(99, 102, 241, 0.15)',
              pointerEvents: 'none',
            }} />
            <Activity size={16} style={{ color: '#60a5fa', marginRight: 8 }} />
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.02em' }}>{toastMessage}</span>
          </div>
        )}

        {/* TOP HEADER */}
        <header style={{
          height: '60px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          backgroundColor: 'var(--bg2)',
          zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <span style={{
              fontWeight: '900',
              fontSize: '18px',
              color: '#2563eb',
              letterSpacing: '-0.02em',
              cursor: 'pointer',
            }} onClick={() => navigate('/student/dashboard')}>OpenHW Studio</span>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '6px 12px',
              width: '280px',
            }}>
              <Search size={14} style={{ color: 'var(--text3)', marginRight: 8 }} />
              <input 
                type="text" 
                placeholder="Search projects or documentation" 
                style={{
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '12px',
                  color: 'var(--text2)',
                  width: '100%',
                }} 
                disabled 
              />
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '9px',
                fontWeight: '800',
                color: '#10b981',
                backgroundColor: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: '6px',
                padding: '2px 6px',
                marginLeft: '8px',
                whiteSpace: 'nowrap',
              }}>
                <span style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  boxShadow: '0 0 8px #10b981',
                  animation: 'onlinePulse 1.5s infinite',
                }} />
                [SYSTEM_ONLINE]
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="header-icon-btn" onClick={() => showToast("No new notifications")}>
              <Bell size={18} />
            </button>
            <button className="header-icon-btn" onClick={() => navigate('/student/profile')}>
              <Settings size={18} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text)' }}>System Architect</span>
                <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text3)' }}>Level 4 Access</span>
              </div>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#6366f1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                cursor: 'pointer',
              }} onClick={() => navigate('/student/profile')}>
                {user?.image ? (
                  <img src={user.image} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '12px', fontWeight: '900', color: '#ffffff' }}>{initials}</span>
                )}
              </div>
            </div>
          </div>
        </header>

        <div style={{ display: 'flex', flex: 1, height: 'calc(100vh - 60px)' }}>
          {/* LEFT SIDEBAR */}
          <aside style={{
            width: '240px',
            borderRight: '1px solid var(--border)',
            padding: '20px 16px',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg2)',
            gap: '16px',
          }}>
            {/* Lets Game Card */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              backgroundColor: 'var(--bg)',
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                backgroundColor: '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}>
                {user?.image ? (
                  <img src={user.image} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '11px', fontWeight: '900', color: '#ffffff' }}>{initials}</span>
                )}
              </div>
              <span style={{ fontWeight: '800', fontSize: '13px', color: 'var(--text)' }}>Lets Game</span>
            </div>

            {/* New Simulation Button */}
            <button className="new-sim-btn" onClick={() => navigate("/simulator")}>
              <span style={{ fontSize: '15px', fontWeight: 'bold' }}>+</span>
              New Simulation
            </button>

            {/* Navigation links */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { label: 'Classroom', icon: BookOpen, active: false, path: classId ? `/student/classes/${encodeURIComponent(classId)}` : '/student/dashboard' },
                { label: 'Projects', icon: Folder, active: false, path: '/student/dashboard' },
                { label: 'Modules', icon: Layers, active: false, path: '/student/dashboard' },
                { label: 'Adventure', icon: Compass, active: true },
                { label: 'Training', icon: Zap, active: false }
              ].map((item, idx) => {
                const Icon = item.icon
                return (
                  <button 
                    key={idx} 
                    className={item.active ? "sidebar-nav-link-active" : "sidebar-nav-link"}
                    onClick={() => item.path && navigate(item.path)}
                  >
                    <Icon size={16} />
                    {item.label}
                  </button>
                )
              })}
            </nav>

            <div style={{ flex: 1 }} />

            {/* Bottom Links */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button className="sidebar-nav-link" onClick={() => showToast("Support system is online")}>
                <HelpCircle size={16} />
                Support
              </button>
              <button className="sidebar-nav-link" onClick={() => showToast("Terminal console initialized")}>
                <Monitor size={16} />
                Terminal
              </button>
            </div>
          </aside>

          {/* MAIN HARDWARE ECOSYSTEM AREA */}
          <main style={{
            flex: 1,
            backgroundColor: 'var(--bg)',
            backgroundImage: 'radial-gradient(var(--border) 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px',
            padding: '40px',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflowY: 'auto',
          }}>
            {/* Coordinate blueprint markings */}
            <span style={{ position: 'absolute', fontSize: '18px', fontWeight: '300', color: 'var(--border)', opacity: 0.5, top: 20, left: 20 }}>+</span>
            <span style={{ position: 'absolute', fontSize: '18px', fontWeight: '300', color: 'var(--border)', opacity: 0.5, top: 20, right: 20 }}>+</span>
            <span style={{ position: 'absolute', fontSize: '18px', fontWeight: '300', color: 'var(--border)', opacity: 0.5, bottom: 20, left: 20 }}>+</span>
            <span style={{ position: 'absolute', fontSize: '18px', fontWeight: '300', color: 'var(--border)', opacity: 0.5, bottom: 20, right: 20 }}>+</span>

            <div style={{ textAlign: 'center', marginBottom: '40px', marginTop: '10px' }}>
              <h1 style={{
                fontSize: '24px',
                fontWeight: '900',
                color: 'var(--text)',
                letterSpacing: '0.12em',
                margin: '0 0 8px 0',
              }}>HARDWARE ECOSYSTEM</h1>
              <p style={{
                fontSize: '11px',
                fontWeight: '800',
                color: 'var(--text2)',
                letterSpacing: '0.08em',
                margin: 0,
              }}>SELECT HARDWARE CAMPAIGN</p>
            </div>

            {/* Campaign Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '24px',
              maxWidth: '900px',
              margin: '0 auto',
              width: '100%',
            }}>
              
              {/* CARD 1: Arduino Uno */}
              <div className="campaign-card">
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: '800',
                    color: '#10b981',
                    backgroundColor: 'rgba(16,185,129,0.08)',
                    border: '1px solid rgba(16,185,129,0.2)',
                    borderRadius: '6px',
                    padding: '3px 8px',
                  }}>[ CAMPAIGN: ACTIVE ]</span>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text3)', fontFamily: 'monospace' }}>ID: AVR-01</span>
                </div>
                <div style={{ width: '100px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                  <Cpu size={56} style={{ color: 'var(--text2)', opacity: 0.8 }} />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text)', margin: '0 0 4px 0' }}>Arduino Uno</h3>
                <p style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text2)', letterSpacing: '0.04em', margin: '0 0 20px 0', fontFamily: 'monospace' }}>8-BIT AVR RISC</p>
                <button 
                  className="card-btn-blue"
                  onClick={() => navigate(classId ? `/adventure?journey=arduino&classId=${encodeURIComponent(classId)}` : `/adventure?journey=arduino`)}
                >
                  Enter World
                </button>
              </div>

              {/* CARD 2: Raspberry Pi Pico */}
              <div className="campaign-card">
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: '800',
                    color: '#2563eb',
                    backgroundColor: 'rgba(37,99,235,0.08)',
                    border: '1px solid rgba(37,99,235,0.2)',
                    borderRadius: '6px',
                    padding: '3px 8px',
                  }}>[ CAMPAIGN: UNLOCKED ]</span>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text3)', fontFamily: 'monospace' }}>ID: ARM-M0</span>
                </div>
                <div style={{ width: '100px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                  <Layers size={56} style={{ color: 'var(--text2)', opacity: 0.8 }} />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text)', margin: '0 0 4px 0' }}>Raspberry Pi Pico</h3>
                <p style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text2)', letterSpacing: '0.04em', margin: '0 0 20px 0', fontFamily: 'monospace' }}>DUAL-CORE ARM CORTEX-M0+</p>
                <button 
                  className="card-btn-light-blue"
                  onClick={() => showToast("Raspberry Pi Pico campaign is coming soon!")}
                >
                  Enter World
                </button>
              </div>

              {/* CARD 3: ESP32 */}
              <div className="campaign-card">
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: '800',
                    color: '#f59e0b',
                    backgroundColor: 'rgba(245,158,11,0.08)',
                    border: '1px solid rgba(245,158,11,0.2)',
                    borderRadius: '6px',
                    padding: '3px 8px',
                  }}>[ SYNC REQUIRED ]</span>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text3)', fontFamily: 'monospace' }}>ID: XT-D32</span>
                </div>
                <div style={{ width: '100px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                  <Wifi size={56} style={{ color: 'var(--text2)', opacity: 0.8 }} />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text)', margin: '0 0 4px 0' }}>ESP32</h3>
                <p style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text2)', letterSpacing: '0.04em', margin: '0 0 20px 0', fontFamily: 'monospace' }}>32-BIT XTENSA DUAL-CORE</p>
                <button 
                  className="card-btn-outline"
                  onClick={() => navigate(classId ? `/adventure?journey=esp32&classId=${encodeURIComponent(classId)}` : `/adventure?journey=esp32`)}
                >
                  Enter World
                </button>
              </div>

              {/* CARD 4: STM32 */}
              <div className="campaign-card" style={{ overflow: 'hidden' }}>
                {/* Lock Overlay */}
                <div className="locked-overlay">
                  <div className="locked-badge">
                    <Lock size={12} style={{ marginRight: 6 }} />
                    EXPERT TIER LOCKED
                  </div>
                </div>
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: '800',
                    color: 'var(--text3)',
                    backgroundColor: 'var(--bg3)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '3px 8px',
                  }}>[ EXPERT TIER LOCKED ]</span>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text3)', fontFamily: 'monospace' }}>ID: ARM-M4</span>
                </div>
                <div style={{ width: '100px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                  <Cpu size={56} style={{ color: 'var(--text3)', opacity: 0.4 }} />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text3)', margin: '0 0 4px 0' }}>STM32</h3>
                <p style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text3)', letterSpacing: '0.04em', margin: '0 0 20px 0', fontFamily: 'monospace' }}>32-BIT ARM CORTEX-M4</p>
                <button 
                  className="card-btn-outline" 
                  style={{ color: 'var(--text3)', borderColor: 'var(--border)', cursor: 'not-allowed' }}
                  disabled
                >
                  LOCKED
                </button>
              </div>

            </div>

            {/* Footer status bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '24px',
              marginTop: 'auto',
              paddingTop: '40px',
            }}>
              <span style={{
                fontSize: '9px',
                fontWeight: '800',
                color: 'var(--text2)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                letterSpacing: '0.05em',
                fontFamily: 'monospace',
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
                LATENCY: 14MS
              </span>
              <span style={{
                fontSize: '9px',
                fontWeight: '800',
                color: 'var(--text2)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                letterSpacing: '0.05em',
                fontFamily: 'monospace',
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                SIM-CODE: STABLE
              </span>
            </div>
          </main>
        </div>
      </div>
    )
  }



  const handleStart = (slug, mode) => {
    const sp = new URLSearchParams()
    if (classId) sp.set('classId', classId)
    sp.set('fromMap', '1')
    const suffix = `?${sp.toString()}`
    if (mode === 'reading') navigate(`/${slug}/reading${suffix}`)
    else if (mode === 'quiz') navigate(`/${slug}/quiz${suffix}`)
    else if (mode === 'guide') navigate(`/${slug}/guide${suffix}`)
    else navigate(`/${slug}/assessment${suffix}`)
  }

  const handleCTAAction = () => {
    if (!activeProject || !selectedStepKey) return
    const stepStat = getSubstepStatus(activeProject, selectedStepKey)
    if (stepStat === 'locked') return // Prevent launching locked steps

    if (selectedStepKey === 'read') {
      handleStart(activeProject.slug, 'reading')
    } else if (selectedStepKey === 'quiz') {
      handleStart(activeProject.slug, 'quiz')
    } else if (selectedStepKey === 'unlock') {
      navigate(classId ? `/${activeProject.slug}/components?classId=${encodeURIComponent(classId)}` : `/${activeProject.slug}/components`)
    } else if (selectedStepKey === 'guide') {
      handleStart(activeProject.slug, 'guide')
    } else if (selectedStepKey === 'sim') {
      handleStart(activeProject.slug, 'assessment')
    }
  }

  // Row 1: left→right  |  Row 2: right→left
  const NODE_POSITIONS = [
    { top: '30%', left: '25%' },
    { top: '30%', left: '50%' },
    { top: '30%', left: '75%' },
    { top: '70%', left: '75%' },
    { top: '70%', left: '50%' },
    { top: '70%', left: '25%' },
  ]

  const PATH_POINTS = [
    [25, 30], [50, 30], [75, 30],
    [75, 70], [50, 70], [25, 70],
  ]

  const userName = user?.name || 'Alex'
  const initials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      fontFamily: "'Inter', system-ui, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        @keyframes islandPulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(99,102,241,0.25), 0 0 24px rgba(99,102,241,0.3); }
          50% { box-shadow: 0 0 0 8px rgba(99,102,241,0.1), 0 0 32px rgba(99,102,241,0.5); }
        }
        @keyframes floatUp {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes islandFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes pathDash {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -50; }
        }
        .island-node:hover { transform: translate(-50%, -55%); transition: transform 0.2s ease; }
        .island-node { transition: transform 0.2s ease; }
        .stat-pill:hover { transform: scale(1.04); transition: transform 0.15s; }
        .stat-pill { transition: transform 0.15s; }
        .glass-panel {
          background: rgba(255, 255, 255, 0.4);
          backdrop-filter: blur(20px) saturate(190%);
          -webkit-backdrop-filter: blur(20px) saturate(190%);
          border: 1px solid rgba(255, 255, 255, 0.25);
          box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
          color: #1e293b;
        }
        .nav-tab-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: transparent;
          border: none;
          color: #64748b;
          cursor: pointer;
          font-weight: 700;
          font-size: 11px;
          gap: 4px;
          transition: all 0.2s;
        }
        .nav-tab-btn:hover {
          color: #4f46e5;
        }
        .nav-tab-btn.active {
          color: #4f46e5;
        }

        @keyframes onlinePulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes toastFadeIn {
          from { transform: translateY(20px) scale(0.95); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        .campaign-card {
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          box-shadow: 0 10px 25px rgba(0,0,0,0.02);
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .campaign-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 40px rgba(15,23,42,0.08);
          border-color: #cbd5e1;
        }
        .new-sim-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 10px;
          background-color: #2563eb;
          color: #ffffff;
          border: none;
          border-radius: 12px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(37,99,235,0.2);
          transition: all 0.2s;
        }
        .new-sim-btn:hover {
          background-color: #1d4ed8;
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(37,99,235,0.25);
        }
        .sidebar-nav-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          border: none;
          background-color: transparent;
          color: #64748b;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          text-align: left;
          width: 100%;
          transition: all 0.2s;
        }
        .sidebar-nav-link:hover {
          background-color: #f1f5f9;
          color: #1e293b;
        }
        .sidebar-nav-link-active {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          border: none;
          background-color: #2563eb;
          color: #ffffff;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          text-align: left;
          width: 100%;
          transition: all 0.2s;
        }
        .card-btn-blue {
          width: 100%;
          padding: 12px;
          background-color: #2563eb;
          color: #ffffff;
          border: none;
          border-radius: 12px;
          font-weight: 800;
          font-size: 11px;
          cursor: pointer;
          letter-spacing: 0.04em;
          transition: all 0.2s;
        }
        .card-btn-blue:hover {
          background-color: #1d4ed8;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(37,99,235,0.2);
        }
        .card-btn-light-blue {
          width: 100%;
          padding: 12px;
          background-color: #eff6ff;
          color: #2563eb;
          border: none;
          border-radius: 12px;
          font-weight: 800;
          font-size: 11px;
          cursor: pointer;
          letter-spacing: 0.04em;
          transition: all 0.2s;
        }
        .card-btn-light-blue:hover {
          background-color: #dbeafe;
          transform: translateY(-1px);
        }
        .card-btn-outline {
          width: 100%;
          padding: 12px;
          background-color: transparent;
          color: #1e293b;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          font-weight: 800;
          font-size: 11px;
          cursor: pointer;
          letter-spacing: 0.04em;
          transition: all 0.2s;
        }
        .card-btn-outline:hover {
          background-color: #f8fafc;
          border-color: #94a3b8;
          transform: translateY(-1px);
        }
        .header-icon-btn {
          color: #64748b;
          cursor: pointer;
          transition: color 0.2s, transform 0.1s;
          background: none;
          border: none;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .header-icon-btn:hover {
          color: #1e293b;
          transform: scale(1.08);
        }
      `}</style>

      {/* ── MAIN MAP AREA ─────────────────────────────────────────────────── */}
      <main
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowRightPanel(false)
          }
        }}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 1,
          backgroundImage: "url('/gamification_images/adventure_map_bg.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >


        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none' }}
        >
          {currentWorldProjects.length > 1 && (
            <>
              <path
                d={PATH_POINTS.slice(0, currentWorldProjects.length).map((pt, i) =>
                  i === 0 ? `M ${pt[0]} ${pt[1]}` : `L ${pt[0]} ${pt[1]}`
                ).join(' ')}
                fill="none"
                stroke="rgba(0,0,0,0.15)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={PATH_POINTS.slice(0, currentWorldProjects.length).map((pt, i) =>
                  i === 0 ? `M ${pt[0]} ${pt[1]}` : `L ${pt[0]} ${pt[1]}`
                ).join(' ')}
                fill="none"
                stroke="rgba(255,255,255,0.95)"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeDasharray="5 5"
                vectorEffect="non-scaling-stroke"
                style={{ animation: 'pathDash 3s linear infinite' }}
              />
            </>
          )}
        </svg>

        {currentWorldProjects.map((project, idx) => {
          const pos = NODE_POSITIONS[idx] || NODE_POSITIONS[0]
          const status = getStatus(project)
          const isActive = activeProject?.slug === project.slug
          const isLocked = status === 'locked'
          const isCompleted = status === 'completed'
          const palette = ISLAND_PALETTES[idx % ISLAND_PALETTES.length]

          return (
            <div
              key={project.slug}
              className="island-node"
              style={{
                position: 'absolute',
                top: pos.top,
                left: pos.left,
                transform: 'translate(-50%, -50%)',
                zIndex: isActive ? 20 : 10,
              }}
            >
              <div onClick={() => {
                if (!isLocked) {
                  setSelectedProject(project)
                  setShowRightPanel(true)
                }
              }}>
                <IslandNode
                  project={project}
                  index={idx}
                  isActive={isActive}
                  isCompleted={isCompleted}
                  isLocked={isLocked}
                  onClick={() => { }}
                  palette={palette}
                />
              </div>

            </div>
          )
        })}
      </main>

      {/* ── TOP HEADER / FLOATING CONTROLS ───────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        top: isMobile ? 8 : 20,
        left: isMobile ? 8 : 20,
        right: isMobile ? 8 : 20,
        height: isMobile ? 'auto' : 56,
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        padding: isMobile ? '10px 12px' : '0 16px',
        zIndex: 30,
        background: 'rgba(255, 255, 255, 0.4)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: 20,
        border: '1px solid rgba(255, 255, 255, 0.25)',
        boxShadow: '0 8px 32px rgba(31, 38, 135, 0.1)',
        gap: isMobile ? 8 : 12,
      }}>
        {isMobile ? (
          <>
            {/* ROW 1: Profile + Journey Switcher + Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              {/* User Profile */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.3)',
                borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)',
                padding: '3px 8px',
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 8,
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 900, color: '#fff',
                  overflow: 'hidden',
                }}>
                  {user?.image ? (
                    <img src={user.image} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { e.target.style.display = 'none' }} />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                <span style={{ fontSize: 11, fontWeight: 900, color: '#1f2937' }}>{userName.split(' ')[0]}</span>
              </div>

              {/* Journey Switcher */}
              <div style={{ display: 'flex', background: 'rgba(15,23,42,0.06)', borderRadius: 10, padding: 2, gap: 1 }}>
                {[{id: 'arduino', label: 'Arduino'}, {id: 'esp32', label: 'ESP32'}].map(j => (
                  <button
                    key={j.id}
                    onClick={() => {
                      setActiveJourney(j.id);
                      setSelectedProject(null);
                      const nextParams = new URLSearchParams(searchParams);
                      nextParams.set('journey', j.id);
                      navigate(`${location.pathname}?${nextParams.toString()}`, { replace: true });
                    }}
                    style={{
                      padding: '3px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: activeJourney === j.id ? 'rgba(255,255,255,0.7)' : 'transparent',
                      color: activeJourney === j.id ? '#4f46e5' : '#64748b',
                      fontWeight: 800, fontSize: 10, transition: 'all 0.2s',
                      boxShadow: activeJourney === j.id ? '0 1px 4px rgba(0,0,0,0.05)' : 'none',
                    }}
                  >
                    {j.label}
                  </button>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <a
                  href="https://openhw-studio.fossee.in/docs/"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    background: 'rgba(15,23,42,0.05)', border: 'none',
                    borderRadius: 8, padding: '4px 8px', color: '#0f172a',
                    fontWeight: 800, fontSize: 10, cursor: 'pointer',
                    textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 2
                  }}
                >
                  <FileText size={10} strokeWidth={2.5} />
                  Docs
                </a>
                <button
                  onClick={handleLogout}
                  style={{
                    background: 'rgba(239,68,68,0.1)', border: 'none',
                    borderRadius: 8, padding: '4px 8px', color: '#dc2626',
                    fontWeight: 800, fontSize: 10, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 2
                  }}
                >
                  <LogOut size={10} strokeWidth={2.5} />
                  Sign Out
                </button>
                <button
                  onClick={() => navigate(classId ? `/student/classes/${encodeURIComponent(classId)}` : '/student/dashboard')}
                  style={{
                    background: 'rgba(15,23,42,0.05)', border: 'none',
                    borderRadius: 8, padding: '4px 8px', color: '#0f172a',
                    fontWeight: 800, fontSize: 10, cursor: 'pointer',
                  }}
                >
                  Exit
                </button>
                <button onClick={() => navigate('/student/profile')} style={{
                  width: 26, height: 26, borderRadius: '50%', border: 'none',
                  background: '#ffffff', color: '#475569', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                }}>
                  <Settings size={13} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* ROW 2: World Switcher + Stats Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 8 }}>
              {/* World Switcher */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  onClick={() => setActiveWorldIdx(prev => Math.max(0, prev - 1))}
                  disabled={activeWorldIdx === 0}
                  style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: activeWorldIdx === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.8)',
                    border: 'none', cursor: activeWorldIdx === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                    opacity: activeWorldIdx === 0 ? 0.4 : 1, color: '#1e40af',
                  }}
                >
                  <ChevronLeft size={12} strokeWidth={2.5} />
                </button>

                <div style={{
                  background: 'rgba(30, 64, 175, 0.85)',
                  borderRadius: 10, padding: '2px 8px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                  textAlign: 'center',
                  minWidth: 100,
                }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#fbbf24', whiteSpace: 'nowrap' }}>
                    {currentWorld.name}
                  </span>
                </div>

                <button
                  onClick={() => setActiveWorldIdx(prev => Math.min(WORLDS.length - 1, prev + 1))}
                  disabled={activeWorldIdx === WORLDS.length - 1}
                  style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: activeWorldIdx === WORLDS.length - 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.8)',
                    border: 'none', cursor: activeWorldIdx === WORLDS.length - 1 ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                    opacity: activeWorldIdx === WORLDS.length - 1 ? 0.4 : 1, color: '#1e40af',
                  }}
                >
                  <ChevronRight size={12} strokeWidth={2.5} />
                </button>
              </div>

              {/* Stats Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {/* XP */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: '#ffffff', borderRadius: 12, padding: '4px 8px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)', height: 26,
                }}>
                  <Star size={11} color="#fbbf24" fill="#fbbf24" strokeWidth={1.5} />
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#1e293b' }}>{xp} XP</span>
                </div>

                {/* Coins */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: '#ffffff', borderRadius: 12, padding: '4px 8px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)', height: 26,
                }}>
                  <Coins size={11} color="#f59e0b" fill="#f59e0b" />
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#1e293b' }}>{coins}</span>
                </div>

                {/* Badges */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: '#ffffff', borderRadius: 12, padding: '4px 8px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)', height: 26,
                }}>
                  <Award size={11} color="#ec4899" fill="#ec4899" />
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#1e293b' }}>{earnedBadges.length}</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Desktop Layout (Standard Row) */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(255,255,255,0.3)',
              borderRadius: 16, border: '1px solid rgba(255,255,255,0.2)',
              padding: '4px 10px',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 900, color: '#fff',
                overflow: 'hidden',
              }}>
                {user?.image ? (
                  <img src={user.image} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { e.target.style.display = 'none' }} />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <span style={{ fontSize: 12, fontWeight: 900, color: '#1f2937' }}>{userName.split(' ')[0]}</span>
            </div>

            <a
              href="https://openhw-studio.fossee.in/docs/"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(15,23,42,0.05)', border: 'none',
                borderRadius: 12, padding: '6px 14px', color: '#0f172a',
                fontWeight: 800, fontSize: 11, cursor: 'pointer', transition: 'all 0.2s',
                textDecoration: 'none'
              }}
            >
              <FileText size={13} strokeWidth={2.5} />
              Docs
            </a>
            <button
              onClick={handleLogout}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(239,68,68,0.1)', border: 'none',
                borderRadius: 12, padding: '6px 14px', color: '#dc2626',
                fontWeight: 800, fontSize: 11, cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <LogOut size={13} strokeWidth={2.5} />
              Sign Out
            </button>
            <button
              onClick={() => navigate(classId ? `/student/classes/${encodeURIComponent(classId)}` : '/student/dashboard')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(15,23,42,0.05)', border: 'none',
                borderRadius: 12, padding: '6px 14px', color: '#0f172a',
                fontWeight: 800, fontSize: 11, cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <ArrowLeft size={13} strokeWidth={2.5} />
              Exit
            </button>

            <div style={{ display: 'flex', background: 'rgba(15,23,42,0.06)', borderRadius: 12, padding: 3, gap: 2 }}>
              {[{id: 'arduino', label: 'Arduino'}, {id: 'esp32', label: 'ESP32'}].map(j => (
                <button
                  key={j.id}
                  onClick={() => {
                    setActiveJourney(j.id);
                    setSelectedProject(null);
                    const nextParams = new URLSearchParams(searchParams);
                    nextParams.set('journey', j.id);
                    navigate(`${location.pathname}?${nextParams.toString()}`, { replace: true });
                  }}
                  style={{
                    padding: '5px 14px', borderRadius: 9, border: 'none', cursor: 'pointer',
                    background: activeJourney === j.id ? 'rgba(255,255,255,0.7)' : 'transparent',
                    color: activeJourney === j.id ? '#4f46e5' : '#64748b',
                    fontWeight: 800, fontSize: 11, transition: 'all 0.2s',
                    boxShadow: activeJourney === j.id ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
                  }}
                >
                  {j.label}
                </button>
              ))}
            </div>

            {/* Center World label/navigation */}
            <div style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <button
                onClick={() => setActiveWorldIdx(prev => Math.max(0, prev - 1))}
                disabled={activeWorldIdx === 0}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: activeWorldIdx === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.8)',
                  border: 'none', cursor: activeWorldIdx === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                  opacity: activeWorldIdx === 0 ? 0.4 : 1, color: '#1e40af',
                }}
              >
                <ChevronLeft size={14} strokeWidth={2.5} />
              </button>

              <div style={{
                background: 'rgba(30, 64, 175, 0.85)',
                borderRadius: 16, padding: '4px 20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                textAlign: 'center',
                minWidth: 200,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }}>
                <span style={{
                  fontSize: 9, fontWeight: 900, color: 'rgba(255, 255, 255, 0.65)',
                  letterSpacing: '0.08em', textTransform: 'uppercase'
                }}>
                  {activeJourney === 'arduino' ? 'Arduino' : 'ESP32'} World {activeWorldIdx + 1}
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 800, color: '#fbbf24', // Gold color for world name
                  letterSpacing: '0.02em'
                }}>
                  {currentWorld.name}
                </span>
              </div>

              <button
                onClick={() => setActiveWorldIdx(prev => Math.min(WORLDS.length - 1, prev + 1))}
                disabled={activeWorldIdx === WORLDS.length - 1}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: activeWorldIdx === WORLDS.length - 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.8)',
                  border: 'none', cursor: activeWorldIdx === WORLDS.length - 1 ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                  opacity: activeWorldIdx === WORLDS.length - 1 ? 0.4 : 1, color: '#1e40af',
                }}
              >
                <ChevronRight size={14} strokeWidth={2.5} />
              </button>
            </div>

            {/* Stats Row in Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
              {/* XP Pill */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#ffffff', borderRadius: 20, padding: '6px 16px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)', height: 38,
              }}>
                <Star size={16} color="#fbbf24" fill="#fbbf24" strokeWidth={1.5} />
                <span style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>{xp.toLocaleString()} XP</span>
              </div>

              {/* Coins Pill with + */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#ffffff', borderRadius: 20, padding: '6px 6px 6px 16px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)', height: 38,
              }}>
                <Coins size={16} color="#f59e0b" fill="#f59e0b" />
                <span style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>{coins.toLocaleString()}</span>
                <button style={{
                  width: 26, height: 26, borderRadius: '50%', border: 'none',
                  background: 'rgba(99,102,241,0.08)', color: '#4f46e5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontWeight: 900, fontSize: 14,
                }}>+</button>
              </div>

              {/* Badges Pill */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#ffffff', borderRadius: 20, padding: '6px 16px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)', height: 38,
              }}>
                <Award size={18} color="#ec4899" fill="#ec4899" />
                <span style={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>
                  {earnedBadges.length} {earnedBadges.length === 1 ? 'Badge' : 'Badges'}
                </span>
              </div>

              <button onClick={() => navigate('/student/profile')} style={{
                width: 38, height: 38, borderRadius: '50%', border: 'none',
                background: '#ffffff', color: '#475569', display: 'flex',
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
              }}>
                <Settings size={16} strokeWidth={2.5} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── BOTTOM NAV TAB BAR (APPLE DESIGN) ────────────────────────────────── */}
      <div className="glass-panel" style={{
        position: 'absolute',
        bottom: isMobile ? 12 : 20,
        left: isMobile ? 12 : '50%',
        right: isMobile ? 12 : 'auto',
        transform: isMobile ? 'none' : 'translateX(-50%)',
        width: isMobile ? 'auto' : 480,
        height: 60,
        borderRadius: 20,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        border: '1px solid rgba(255,255,255,0.3)',
      }}>
        <button onClick={() => navigate('/student/dashboard')} className="nav-tab-btn">
          <BookOpen size={18} />
          <span>Dashboard</span>
        </button>

        <button onClick={() => { }} className="nav-tab-btn active">
          <Map size={18} />
          <span>World Map</span>
        </button>

        <button
          onClick={() => {
            if (activeProject) {
              setShowRightPanel(true)
            }
          }}
          style={{
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
            border: 'none',
            borderRadius: 20,
            padding: '8px 24px',
            color: '#1f2937',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontWeight: 800,
            fontSize: 12,
            boxShadow: '0 4px 14px rgba(245,158,11,0.4)',
            transform: 'scale(1.15) translateY(-4px)',
            transition: 'transform 0.2s',
          }}
        >
          <Activity size={16} strokeWidth={2.5} />
          <span>Play</span>
        </button>

        <button onClick={() => navigate(classId ? `/components?classId=${encodeURIComponent(classId)}` : '/components')} className="nav-tab-btn">
          <Package size={18} />
          <span>Inventory</span>
        </button>

        <button onClick={() => navigate('/student/profile')} className="nav-tab-btn">
          <User size={18} />
          <span>Profile</span>
        </button>
      </div>

      {/* ── RIGHT GLASS DETAIL PANEL ────────────────────────────────────────── */}
      {activeProject && showRightPanel && (
        <aside className="glass-panel" style={{
          position: 'absolute',
          top: isMobile ? 'auto' : 96,
          bottom: isMobile ? 84 : 96,
          right: isMobile ? 12 : 24,
          left: isMobile ? 12 : 'auto',
          height: isMobile ? 380 : 'auto',
          width: isMobile ? 'auto' : 320,
          borderRadius: 28,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 30,
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.18)',
          border: '1px solid rgba(255, 255, 255, 0.4)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header info */}
            <div style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {activeProject.number}. {activeProject.title.toUpperCase()}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  background: getStatus(activeProject) === 'completed' ? 'rgba(16,185,129,0.12)' : 'rgba(99,102,241,0.12)',
                  color: getStatus(activeProject) === 'completed' ? '#059669' : '#4f46e5',
                  borderRadius: 12, padding: '4px 10px', fontSize: 10, fontWeight: 800,
                  border: getStatus(activeProject) === 'completed' ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(99,102,241,0.2)',
                }}>
                  {getStatus(activeProject) === 'completed' ? 'Completed' : 'Active'}
                </span>
                <button
                  onClick={() => setShowRightPanel(false)}
                  style={{
                    border: 'none', background: 'rgba(15, 23, 42, 0.06)', borderRadius: '50%',
                    width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#475569', transition: 'all 0.15s',
                    fontWeight: 'bold', fontSize: 16,
                  }}
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Island visual preview (Sleek container) */}
            {!isMobile && (
              <div style={{ padding: '16px 20px 0' }}>
                <div style={{
                  borderRadius: 20, height: 140,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative', overflow: 'hidden',
                  background: 'linear-gradient(180deg, #e0f2fe 0%, #bae6fd 100%)',
                  border: '1px solid rgba(255,255,255,0.4)',
                  boxShadow: 'inset 0 4px 20px rgba(0, 0, 0, 0.03), 0 8px 24px rgba(14, 165, 233, 0.12)',
                }}>
                  <img
                    src={getIslandImage(activeProject.slug)}
                    alt={activeProject.title}
                    style={{
                      height: 120, width: 'auto',
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 8px 16px rgba(15, 23, 42, 0.15))',
                      animation: 'islandFloat 4s ease-in-out infinite',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Body */}
            <div style={{ padding: '16px 20px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Description */}
              <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.5, fontWeight: 500 }}>
                {activeProject.description || `Learn all about ${activeProject.title}, how it works, and build your own projects!`}
              </p>

              {/* Steps Progress */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 20,
                padding: '12px 8px 16px',
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 900, textTransform: 'uppercase',
                  letterSpacing: '0.06em', color: '#64748b', marginBottom: 12, paddingLeft: 10
                }}>
                  Island Progress
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, position: 'relative' }}>
                  {[
                    { key: 'read', label: 'Theory', icon: BookOpen },
                    { key: 'quiz', label: 'Quiz', icon: HelpCircle },
                    { key: 'unlock', label: 'Unlock', icon: Gift },
                    { key: 'guide', label: 'Guide', icon: ScrollText },
                    { key: 'sim', label: 'Project', icon: Wrench },
                  ].map((s, idx, arr) => (
                    <StepNode
                      key={s.key}
                      icon={s.icon}
                      label={s.label}
                      status={getSubstepStatus(activeProject, s.key)}
                      isLast={idx === arr.length - 1}
                      isSelected={selectedStepKey === s.key}
                      onClick={() => setSelectedStepKey(s.key)}
                    />
                  ))}
                </div>
              </div>

              {/* Rewards */}
              <div>
                <div style={{
                  fontSize: 10, fontWeight: 900, textTransform: 'uppercase',
                  letterSpacing: '0.06em', color: '#64748b', marginBottom: 8
                }}>
                  Completion Rewards
                </div>
                <div style={{
                  background: 'rgba(255,255,255,0.45)', borderRadius: 16,
                  border: '1px solid rgba(255,255,255,0.4)',
                  padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)'
                }}>
                  {[
                    { icon: Star, value: '+150 XP', color: '#fbbf24' },
                    { icon: Coins, value: '+50 Coins', color: '#f59e0b' },
                    { icon: Award, value: 'Badge', color: '#8b5cf6' },
                  ].map(({ icon: Icon, value, color }) => (
                    <div key={value} style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'center' }}>
                      <Icon size={13} color={color} fill={color} />
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#334155' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ flex: 1 }} />

              {/* Action play button */}
              <button
                onClick={handleCTAAction}
                disabled={!selectedStepKey || getSubstepStatus(activeProject, selectedStepKey) === 'locked'}
                style={{
                  width: '100%',
                  background: (!selectedStepKey || getSubstepStatus(activeProject, selectedStepKey) === 'locked')
                    ? 'rgba(15, 23, 42, 0.08)'
                    : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                  color: (!selectedStepKey || getSubstepStatus(activeProject, selectedStepKey) === 'locked') ? '#94a3b8' : '#ffffff',
                  border: 'none',
                  borderRadius: 16,
                  padding: '14px 0',
                  fontWeight: 900,
                  fontSize: 14,
                  cursor: (!selectedStepKey || getSubstepStatus(activeProject, selectedStepKey) === 'locked') ? 'not-allowed' : 'pointer',
                  boxShadow: (!selectedStepKey || getSubstepStatus(activeProject, selectedStepKey) === 'locked') ? 'none' : '0 8px 24px rgba(99, 102, 241, 0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'all 0.2s',
                }}
              >
                {(!selectedStepKey || getSubstepStatus(activeProject, selectedStepKey) === 'locked') ? (
                  <><Lock size={16} strokeWidth={2} /> Level Locked</>
                ) : (
                  <>Play Level <ArrowRight size={16} strokeWidth={2.5} /></>
                )}
              </button>
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}
