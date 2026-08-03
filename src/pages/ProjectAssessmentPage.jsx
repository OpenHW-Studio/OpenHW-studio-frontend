import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useGamification } from '../context/GamificationContext'
import { PROJECTS } from '../services/gamification/ProjectsConfig'
import { getProjectGuidedSteps } from '../services/classAdventureAdapter'
import {
  getAdventureProjectContent,
  markAdventureStepComplete,
  postProjectCompleted,
} from '../services/adventureService'
import { useAuth } from '../context/AuthContext'
import { 
  ArrowLeft, ArrowRight, Star, Coins, Sun, Moon, Cpu, Wrench, Play, RotateCcw, 
  Trash2, Clipboard, ShieldAlert, Sparkles, CheckCircle2, AlertCircle, FileText, LogOut 
} from 'lucide-react'

// Slugs that belong to the Arduino journey (mirrors AdventureMapPage)
const ALL_ARDUINO_SLUGS = [
  'led-blink', 'rgb-led', 'buzzer', 'potentiometer', 'ldr',
  'servo-motor', 'led-strip', 'button-debounce', 'temperature-sensor',
  'dc-motor', 'push-button', 'ultrasonic-sensor', 'dht11-sensor', 'lcd-display',
  'relay-control', 'oled-graphics', 'neopixel-effects', 'keypad-lock',
  'rotary-menu', 'seven-segment-clock', 'stepper-motor', 'mpu6050-tilt',
]

const PHASE_LABEL = { wire: 'Wiring', code: 'Coding', run: 'Run' }
const PHASE_COLOR = { wire: '#10b981', code: '#3b82f6', run: '#f59e0b' }

// ─── Evaluation helpers ───────────────────────────────────────────────────────
const ROLE_TO_TYPE = {
  arduino: 'openhw-arduino-uno', resistor: 'openhw-resistor',
  led: 'openhw-led', 'rgb-led': 'openhw-rgb-led',
  potentiometer: 'openhw-potentiometer', 'analog-joystick': 'openhw-analog-joystick',
  buzzer: 'openhw-buzzer', photoresistor: 'openhw-photoresistor',
  lcd: 'openhw-lcd1602', servo: 'openhw-servo',
  neopixel: 'openhw-neopixel-matrix', button: 'openhw-pushbutton',
  ntc: 'openhw-ntc-temperature-sensor', motor: 'openhw-motor',
  'motor-driver': 'openhw-motor-driver',
}

function isTypeMatch(actual, expected) {
  if (!actual || !expected) return false;
  if (actual === expected) return true;
  if (actual.replace('openhw-', 'wokwi-') === expected.replace('openhw-', 'wokwi-')) return true;
  return false;
}

function resolveRoleType(r) { return ROLE_TO_TYPE[r] || r }
function pickFeedback(score, sc) {
  if (!sc) return ''
  const entries = Object.values(sc).filter(i => typeof i?.min === 'number').sort((a,b) => b.min - a.min)
  return entries.find(i => score >= i.min)?.feedback || ''
}

function evaluateAssessment(config, components, wires, code) {
  const cc = config?.evaluationCriteria || {}
  const sc = config?.scoring || {}
  const res = {}
  let total = 0

  if (cc.components) {
    const { required = [], weight = 0 } = cc.components
    const issues = []
    let ok = 0
    required.forEach(req => {
      const t = resolveRoleType(req.type)
      const n = components.filter(c => isTypeMatch(c.type, t)).length
      if (n === req.count) ok++; else issues.push(`Expected ${req.count} ${req.type}, found ${n}.`)
    })
    const score = required.length ? Math.round((ok / required.length) * 100) : 0
    total += score * weight
    res.components = { title: 'Components', score, feedback: pickFeedback(score, sc.components), issues }
  }

  if (cc.wiringAccuracy) {
    const { requiredConnections = [], weight = 0 } = cc.wiringAccuracy
    const issues = []
    let ok = 0
    const wm = (wire, conn) => {
      const checkDir = (fId, fPin, fLabel, tId, tPin, tLabel, cFrom, cTo) => {
        const fC = components.find(c => c.id === fId), tC = components.find(c => c.id === tId)
        const fT = ROLE_TO_TYPE[cFrom.component] || cFrom.component, tT = ROLE_TO_TYPE[cTo.component] || cTo.component
        const fTo = fC ? isTypeMatch(fC.type, fT) || fC.id === cFrom.component : false
        const tTo = tC ? isTypeMatch(tC.type, tT) || tC.id === cTo.component : false
        
        const isResistor = (c) => c && (c.type === 'openhw-resistor' || c.type === 'wokwi-resistor');
        const matchEp = (comp, pin, label, ep) => {
          if (!comp || !ep) return false;
          if (isResistor(comp) && (['1', '2', 'p1', 'p2'].includes(ep.pin) || ['1', '2', 'p1', 'p2'].includes(ep.terminal))) {
            return ['1', '2', 'p1', 'p2'].includes(pin);
          }
          const isArduino = comp && (comp.type === 'openhw-arduino-uno' || comp.type === 'wokwi-arduino-uno');
          const expectedPin = ep.pin || ep.terminal;
          if (isArduino && expectedPin?.toLowerCase().startsWith('gnd') && pin?.toLowerCase().startsWith('gnd')) {
            return true;
          }
          
          const safeCmp = (a, b) => (a||'').toString().toLowerCase() === (b||'').toString().toLowerCase();
          if (ep.pin) return safeCmp(label, ep.pin) || safeCmp(pin, ep.pin);
          if (ep.terminal) return safeCmp(label, ep.terminal) || safeCmp(pin, ep.terminal);
          return false;
        };

        return fTo && tTo && matchEp(fC, fPin, fLabel, cFrom) && matchEp(tC, tPin, tLabel, cTo);
      };

      const [fId, fPin] = wire.from.split(':'), [tId, tPin] = wire.to.split(':')
      return checkDir(fId, fPin, wire.fromLabel, tId, tPin, wire.toLabel, conn.from, conn.to) ||
             checkDir(tId, tPin, wire.toLabel, fId, fPin, wire.fromLabel, conn.from, conn.to);
    }

    const evaluateTopology = (connections) => {
      let matched = 0;
      let missing = [];
      connections.forEach(conn => {
        if (wires.some(w => wm(w, conn))) matched++;
        else missing.push(`Missing: ${conn.from.component} ${conn.from.pin||conn.from.terminal} → ${conn.to.component} ${conn.to.pin||conn.to.terminal}.`);
      });
      return { matched, missing, total: connections.length };
    };

    let bestResult = evaluateTopology(requiredConnections);
    
    if (cc.wiringAccuracy.alternativeConnections) {
      for (const altConns of cc.wiringAccuracy.alternativeConnections) {
        const altResult = evaluateTopology(altConns);
        if (altResult.matched > bestResult.matched || (altResult.matched === altResult.total && altResult.total > 0)) {
          bestResult = altResult;
        }
      }
    }

    if (cc.wiringAccuracy.customWiringCheck === 'rgb-discrete') {
      let matchedPaths = 0;
      const issuesList = [];
      const expectedPins = ['9', '10', '11'];
      const arduinoRole = resolveRoleType('arduino');
      const resistorRole = resolveRoleType('resistor');
      const ledRole = resolveRoleType('led');
      
      expectedPins.forEach(pin => {
        const aWires = wires.filter(w => {
          const [fId, fPin] = w.from.split(':'); const [tId, tPin] = w.to.split(':');
          return (isTypeMatch(components.find(c=>c.id===fId)?.type, arduinoRole) && fPin === pin) ||
                 (isTypeMatch(components.find(c=>c.id===tId)?.type, arduinoRole) && tPin === pin);
        });
        
        let pathValid = false;
        for (const w of aWires) {
          const [fId] = w.from.split(':'); const [tId] = w.to.split(':');
          const aId = isTypeMatch(components.find(c=>c.id===fId)?.type, arduinoRole) ? fId : tId;
          const otherId = aId === fId ? tId : fId;
          const otherC = components.find(c=>c.id===otherId);
          
          if (isTypeMatch(otherC?.type, resistorRole)) {
             const rWires = wires.filter(rw => rw.from.startsWith(otherId+':') || rw.to.startsWith(otherId+':'));
             for (const rw of rWires) {
                const [rfId, rfPin] = rw.from.split(':'); const [rtId, rtPin] = rw.to.split(':');
                const nextId = rfId === otherId ? rtId : rfId;
                const nextPin = rfId === otherId ? rtPin : rfPin;
                if (nextId === aId) continue;
                
                const nextC = components.find(c=>c.id===nextId);
                if (isTypeMatch(nextC?.type, ledRole) && (nextPin === 'A' || nextPin === 'anode')) {
                   const lWires = wires.filter(lw => (lw.from === `${nextId}:K` || lw.from === `${nextId}:cathode` || lw.from === `${nextId}:C`) ||
                                                     (lw.to === `${nextId}:K` || lw.to === `${nextId}:cathode` || lw.to === `${nextId}:C`));
                   for (const lw of lWires) {
                      const [lfId, lfPin] = lw.from.split(':'); const [ltId, ltPin] = lw.to.split(':');
                      const finalId = lfId === nextId ? ltId : lfId;
                      const finalPin = lfId === nextId ? ltPin : lfPin;
                      const finalC = components.find(c=>c.id===finalId);
                      if (isTypeMatch(finalC?.type, arduinoRole) && finalPin.toLowerCase().startsWith('gnd')) {
                         pathValid = true;
                      }
                   }
                }
             }
          }
        }
        if (pathValid) matchedPaths++;
        else issuesList.push(`Missing valid path: Pin ${pin} -> Resistor -> LED Anode, and LED Cathode -> GND.`);
      });
      bestResult = { matched: matchedPaths, missing: issuesList, total: 3 };
    }

    ok = bestResult.matched;
    issues.push(...bestResult.missing);

    const score = bestResult.total ? Math.round((ok / bestResult.total) * 100) : 0
    total += score * weight
    res.wiringAccuracy = { title: 'Wiring', score, feedback: pickFeedback(score, sc.wiringAccuracy), issues }
  }

  if (cc.codeFunctionality) {
    const { requiredFunctions = [], expectedBehavior = {}, weight = 0 } = cc.codeFunctionality
    const issues = []
    let checks = 0, passed = 0
    const ct = code || ''
    const idMap = {}
    ct.split('\n').forEach(l => {
      const dm = l.match(/#define\s+([A-Za-z_]\w*)\s+(\d+|A\d+)/)
      if (dm) { const v = dm[2]; idMap[dm[1]] = /^\d+$/.test(v) ? Number(v) : v; return }
      const cm = l.match(/const\s+int\s+([A-Za-z_]\w*)\s*=\s*(\d+|A\d+)/)
      if (cm) { const v = cm[2]; idMap[cm[1]] = /^\d+$/.test(v) ? Number(v) : v }
    })
    const has = fn => fn && new RegExp(`\\b${fn.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`).test(ct)
    requiredFunctions.forEach(fn => { checks++; if (has(fn)) passed++; else issues.push(`Missing function: ${fn}().`) })
    if (expectedBehavior) {
      const pn = expectedBehavior.pinNumber ?? null, pm = expectedBehavior.pinMode || 'OUTPUT'
      if (pn != null && expectedBehavior.pinMode) {
        checks++
        const dr = new RegExp(`pinMode\\s*\\(\\s*${pn}\\s*,\\s*${pm}\\s*\\)`,'i')
        const idn = Object.entries(idMap).find(([,v]) => v === Number(pn))?.[0]
        const ir = idn ? new RegExp(`pinMode\\s*\\(\\s*${idn}\\s*,\\s*${pm}\\s*\\)`,'i') : null
        if (dr.test(ct)||(ir&&ir.test(ct))) passed++; else issues.push('pinMode should configure the correct output pin.')
        checks++
        if (new RegExp(`digitalWrite\\s*\\(\\s*${pn}\\s*,\\s*HIGH\\s*\\)`,'i').test(ct) && new RegExp(`digitalWrite\\s*\\(\\s*${pn}\\s*,\\s*LOW\\s*\\)`,'i').test(ct)) passed++
        else issues.push('Blink pattern should alternate HIGH and LOW.')
        checks++
        if (new RegExp(`(pinMode|digitalWrite)\\s*\\(\\s*${pn}\\s*`,'i').test(ct)) passed++
        else issues.push('Expected pin number is not used in the code.')
      }
      if (expectedBehavior.blinkDelay != null) { checks++; if (new RegExp(`delay\\s*\\(\\s*${expectedBehavior.blinkDelay}\\s*\\)`,'i').test(ct)) passed++; else issues.push('Blink delay does not match expected.') }
      else if (expectedBehavior.delayMs != null) { checks++; if (new RegExp(`delay\\s*\\(\\s*${expectedBehavior.delayMs}\\s*\\)`,'i').test(ct)) passed++; else issues.push('Delay timing does not match expected.') }
    }
    const score = checks ? Math.round((passed / checks) * 100) : 0
    total += score * weight
    res.codeFunctionality = { title: 'Code', score, feedback: pickFeedback(score, sc.codeFunctionality), issues }
  }

  const totalScore = Math.round(total)
  return { totalScore, passed: totalScore >= (config?.passingThreshold || 0), threshold: config?.passingThreshold || 0, criteria: res }
}

// ─── Score Ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 120, isDarkMode }) {
  const r = (size / 2) - 10
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={isDarkMode ? 'rgba(255,255,255,.06)' : 'rgba(15,23,42,.06)'} strokeWidth={10} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        style={{ fill: color, fontSize: 22, fontWeight: 900, fontFamily: 'Inter, sans-serif', transform: 'rotate(90deg)', transformOrigin: `${size/2}px ${size/2}px` }}>
        {score}%
      </text>
    </svg>
  )
}

// ─── Code Snippet Component ───────────────────────────────────────────────────
function CodeSnippet({ code, isDarkMode }) {
  const [copied, setCopied] = useState(false)
  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden',
      border: isDarkMode ? '1px solid rgba(59,130,246,.25)' : '1px solid rgba(59,130,246,.2)',
      marginTop: 14, boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: isDarkMode ? 'rgba(59,130,246,.12)' : 'rgba(59,130,246,.05)',
        padding: '8px 16px', borderBottom: isDarkMode ? '1px solid rgba(59,130,246,.2)' : '1px solid rgba(59,130,246,.1)'
      }}>
        <span style={{ fontSize: 10, fontWeight: 900, color: '#3b82f6', letterSpacing: '.08em' }}>ARDUINO REFERENCE CODE</span>
        <button onClick={() => { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1600) }}
          style={{
            background: 'transparent', border: 'none', color: copied ? '#10b981' : '#64748b',
            fontSize: 11, fontWeight: 900, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            display: 'flex', alignItems: 'center', gap: 4
          }}>
          <Clipboard size={11} />
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre style={{
        margin: 0, padding: '14px 18px',
        background: isDarkMode ? 'rgba(15, 23, 42, 0.45)' : '#ffffff',
        color: isDarkMode ? '#a5f3fc' : '#0891b2',
        fontSize: 12.5, lineHeight: 1.7, overflowX: 'auto',
        fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
        whiteSpace: 'pre'
      }}>{code}</pre>
    </div>
  )
}

// ─── Step Card Component ─────────────────────────────────────────────────────
function StepCard({ step, index, total, isActive, onClick, isDarkMode }) {
  const phaseColor = PHASE_COLOR[step.phase] || '#10b981'
  return (
    <div
      onClick={onClick}
      style={{
        background: isActive
          ? (isDarkMode ? `linear-gradient(135deg, ${phaseColor}18, ${phaseColor}06)` : `linear-gradient(135deg, ${phaseColor}10, #ffffff)`)
          : (isDarkMode ? 'rgba(255,255,255,.02)' : 'rgba(255,255,255,0.45)'),
        border: `1.5px solid ${isActive ? phaseColor + '55' : (isDarkMode ? 'rgba(255,255,255,.07)' : 'rgba(15,23,42,.08)')}`,
        borderRadius: 20, padding: '20px 24px', cursor: 'pointer',
        transition: 'all 0.25s',
        position: 'relative', overflow: 'hidden',
        boxShadow: isDarkMode ? 'none' : '0 4px 12px rgba(0,0,0,0.01)',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: isActive ? phaseColor : 'transparent', borderRadius: '20px 20px 0 0' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: isActive ? 16 : 0 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: isDarkMode ? `${phaseColor}18` : `${phaseColor}0c`,
          border: `1.5px solid ${phaseColor}${isActive ? '55' : '22'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: phaseColor,
        }}>
          {step.phase === 'wire' ? <Wrench size={18} /> : step.phase === 'code' ? <Cpu size={18} /> : <Play size={18} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              fontSize: 9, fontWeight: 900, color: phaseColor, textTransform: 'uppercase',
              letterSpacing: '.08em', background: isDarkMode ? `${phaseColor}18` : `${phaseColor}0c`,
              padding: '2px 8px', borderRadius: 20, border: `1px solid ${phaseColor}22`
            }}>
              {PHASE_LABEL[step.phase]}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: isDarkMode ? '#64748b' : '#94a3b8' }}>Step {index + 1} / {total}</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: isActive ? (isDarkMode ? '#f8fafc' : '#0f172a') : (isDarkMode ? '#94a3b8' : '#64748b'), lineHeight: 1.2 }}>{step.title}</div>
        </div>
        <div style={{ fontSize: 13, color: isActive ? phaseColor : (isDarkMode ? '#475569' : '#cbd5e1'), flexShrink: 0 }}>
          {isActive ? '▼' : '▶'}
        </div>
      </div>

      {isActive && (
        <div style={{ animation: 'fadeUp .25s ease' }}>
          <div style={{ fontSize: 14, color: isDarkMode ? '#cbd5e1' : '#475569', lineHeight: 1.75, marginBottom: 14, whiteSpace: 'pre-line' }}>{step.instruction}</div>
          {step.code && <CodeSnippet code={step.code} isDarkMode={isDarkMode} />}
          {step.tip && (
            <div style={{
              display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 14,
              background: isDarkMode ? 'rgba(251,191,36,.06)' : 'rgba(251,191,36,.08)',
              border: isDarkMode ? '1px solid rgba(251,191,36,.15)' : '1px solid rgba(251,191,36,.25)',
              borderRadius: 12, padding: '12px 16px',
            }}>
              <AlertCircle size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13, color: isDarkMode ? '#fbbf24' : '#854d0e', fontWeight: 600, lineHeight: 1.5 }}>{step.tip}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Assessment Page Component ───────────────────────────────────────────
export default function ProjectAssessmentPage() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const handleLogout = () => {
    logout()
    navigate('/')
  }
  const { projectName = '' } = useParams()
  const location = useLocation()
  const classId = new URLSearchParams(location.search).get('classId')
  const journey = ALL_ARDUINO_SLUGS.includes(projectName) ? 'arduino' : 'esp32'
  const mapPath = classId
    ? `/adventure?journey=${journey}&classId=${encodeURIComponent(classId)}`
    : `/adventure?journey=${journey}`
  const goBackToMap = () => navigate(mapPath, { state: { openProject: projectName } })
  const { completedProjects = [], completeProject, awardXP, xp = 0, coins = 0 } = useGamification?.() || {}
  const [classProjectContent, setClassProjectContent] = useState(null)

  const projectTitle = useMemo(() => titleFromSlug(projectName), [projectName])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const { project } = await getAdventureProjectContent(classId, projectName)
        if (cancelled) return
        setClassProjectContent(project)
      } catch {
        if (!cancelled) setClassProjectContent(null)
      }
    }
    load()
    return () => { cancelled = true }
  }, [classId, projectName])

  const projectColor = location.state?.projectColor || '#10b981'
  const steps = useMemo(() => getProjectGuidedSteps(classProjectContent, projectName), [classProjectContent, projectName])

  const [activeStep, setActiveStep] = useState(0)
  const [submission, setSubmission] = useState(null)
  const [evalResult, setEvalResult] = useState(null)
  const [evaluating, setEvaluating] = useState(false)

  // Light/Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('assessment_theme')
    return saved !== 'light'
  })

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const next = !prev
      localStorage.setItem('assessment_theme', next ? 'dark' : 'light')
      return next
    })
  }

  const assessmentConfig = useMemo(() => {
    const defaultProject = PROJECTS.find(p => p.slug === projectName)
    const defaultEvaluation = defaultProject?.evaluation || {}

    if (classProjectContent) {
      const assessment = classProjectContent.assessment || {}
      if (assessment.evaluationCriteria?.wiringAccuracy && defaultEvaluation.evaluationCriteria?.wiringAccuracy?.alternativeConnections) {
        if (!assessment.evaluationCriteria.wiringAccuracy.alternativeConnections) {
          assessment.evaluationCriteria.wiringAccuracy.alternativeConnections = defaultEvaluation.evaluationCriteria.wiringAccuracy.alternativeConnections;
        }
      }
      return {
        passingThreshold: assessment.passingThreshold ?? 0,
        evaluationCriteria: assessment.evaluationCriteria || {},
        scoring: assessment.scoring || {},
      }
    }
    return {
      passingThreshold: defaultEvaluation.passingThreshold ?? 0,
      evaluationCriteria: defaultEvaluation.evaluationCriteria || {},
      scoring: defaultEvaluation.scoring || {},
    }
  }, [classProjectContent, projectName])

  const SUB_KEY = `openhw_assessment_submission:${projectName}`
  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      if (cancelled) return
      const raw = sessionStorage.getItem(SUB_KEY)
      if (!raw) { setSubmission(null); setEvalResult(null); return }
      try { setSubmission(JSON.parse(raw)) } catch { setSubmission(null) }
    }
    refresh()
    const handler = () => { refresh() }
    window.addEventListener('focus', handler)
    window.addEventListener('storage', handler)
    return () => { window.removeEventListener('focus', handler); window.removeEventListener('storage', handler) }
  }, [projectName, SUB_KEY])

  useEffect(() => {
    if (!assessmentConfig || !submission) return
    setEvaluating(true)
    const result = evaluateAssessment(assessmentConfig, submission.components || [], submission.wires || [], submission.code || '')
    const payload = { projectName, submittedAt: submission.submittedAt, result }
    setEvalResult(payload)
    sessionStorage.setItem(`openhw_assessment_result:${projectName}`, JSON.stringify(payload))
    setEvaluating(false)
    if (result.passed) {
      const customXp = classProjectContent?.xpReward;
      const customBadge = classProjectContent?.badge;
      if (!completedProjects.includes(projectName)) {
        completeProject?.(projectName, customXp, customBadge)
      } else {
        const proj = PROJECTS.find(p => p.slug === projectName);
        const baseReward = customXp ?? proj?.xpReward ?? 100;
        awardXP?.(Math.round(baseReward * 0.25), 'Re-submission bonus')
      }
      markAdventureStepComplete({
        classId,
        projectSlug: projectName,
        stepKey: 'sim',
        stepOrder: 5,
      }).catch(() => {})
      if (classId) {
        const proj = PROJECTS.find(p => p.slug === projectName)
        postProjectCompleted(classId, projectName, {
          xpEarned: classProjectContent?.xpReward || proj?.xpReward || 0,
        }).catch(() => {})
      }
    }
  }, [assessmentConfig, submission, classId, completedProjects, completeProject, awardXP, projectName, classProjectContent])

  const clearResult = () => {
    sessionStorage.removeItem(`openhw_assessment_result:${projectName}`)
    sessionStorage.removeItem(`openhw_assessment_submission:${projectName}`)
    setSubmission(null); setEvalResult(null)
  }

  const openSimulator = () => {
    const suffix = classId ? `?classId=${encodeURIComponent(classId)}` : ''
    navigate(`/${projectName}/guided${suffix}`, { state: { projectColor } })
  }

  const result = evalResult?.result

  return (
    <div style={{
      minHeight: '100vh',
      background: isDarkMode
        ? 'radial-gradient(circle at top left, #0f172a 0%, #020617 100%)'
        : 'radial-gradient(circle at top left, #f8fafc 0%, #e2e8f0 100%)',
      color: isDarkMode ? '#fff' : '#1e293b',
      fontFamily: "'Inter', system-ui, sans-serif",
      transition: 'background 0.3s ease, color 0.3s ease',
      paddingBottom: 80,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* ── TOP NAV HEADER ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: isDarkMode ? 'rgba(15, 23, 42, 0.35)' : 'rgba(255, 255, 255, 0.65)',
        backdropFilter: 'blur(12px)',
        borderBottom: isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(15, 23, 42, 0.08)',
        padding: '0 24px',
        transition: 'all 0.3s ease',
      }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16, height: 64 }}>
          <button
            onClick={goBackToMap}
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

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: `${projectColor}15`, border: `1px solid ${projectColor}33`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: projectColor
            }}>
              <FileText size={16} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                {classProjectContent?.title || projectTitle}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: isDarkMode ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Simulator Challenge
              </div>
            </div>
          </div>

          {/* Stats Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)',
              padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 800, color: '#fbbf24'
            }}>
              <Star size={12} fill="#fbbf24" color="#fbbf24" />
              <span>{xp} XP</span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
              padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 800, color: '#f59e0b'
            }}>
              <Coins size={12} fill="#f59e0b" color="#f59e0b" />
              <span>{coins}</span>
            </div>

            {/* Theme Switcher */}
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
          </div>
        </div>
      </header>

      {/* ── HERO BANNER ── */}
      <div style={{
        background: `linear-gradient(135deg, ${projectColor}0f, transparent 70%)`,
        borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(15, 23, 42, 0.06)'}`,
        padding: '32px 24px'
      }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: `${projectColor}15`, border: `2px solid ${projectColor}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: projectColor,
            flexShrink: 0
          }}>
            <Cpu size={32} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: projectColor, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              Project Assessment
            </div>
            <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 900, color: isDarkMode ? '#f8fafc' : '#0f172a', letterSpacing: '-0.01em' }}>
              {classProjectContent?.title || projectTitle}
            </h1>
            <p style={{ margin: 0, fontSize: 13.5, color: isDarkMode ? '#94a3b8' : '#475569', lineHeight: 1.5 }}>
              Follow the blueprints below, assemble the hardware layout inside the Simulator environment, and submit your code to earn your certification.
            </p>
          </div>
          {completedProjects.includes(projectName) && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 20px', borderRadius: 16,
              background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)',
              color: '#10b981', fontSize: 13.5, fontWeight: 800,
              flexShrink: 0
            }}>
              <CheckCircle2 size={16} />
              <span>Assessment Passed</span>
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN WORKSPACE CONTENT ── */}
      <div style={{
        maxWidth: 1000, margin: '0 auto',
        padding: '40px 24px',
        display: 'grid',
        gridTemplateColumns: result ? '1.2fr 380px' : '1fr',
        gap: 36
      }}>
        {/* Left Side: Build instructions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: isDarkMode ? '#475569' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em' }}>
              Assembly Blueprint Steps
            </span>
            <div style={{ flex: 1, height: 1, background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(15, 23, 42, 0.08)' }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: projectColor }}>
              {steps.length} Tasks
            </span>
          </div>

          {/* Steps Timeline Navigation */}
          <div style={{ display: 'flex', gap: 6 }}>
            {steps.map((_, i) => (
              <div
                key={i}
                onClick={() => setActiveStep(i)}
                style={{
                  flex: 1, height: 6, borderRadius: 99, cursor: 'pointer', transition: 'all 0.3s',
                  background: i < activeStep ? '#10b981' : i === activeStep ? PHASE_COLOR[steps[i].phase] : (isDarkMode ? 'rgba(255,255,255,.08)' : 'rgba(15, 23, 42, 0.08)'),
                  transform: i === activeStep ? 'scaleY(1.3)' : 'scaleY(1)',
                }}
              />
            ))}
          </div>

          {/* Accordion Steps List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {steps.map((step, i) => (
              <StepCard
                key={step.id}
                step={step}
                index={i}
                total={steps.length}
                isActive={activeStep === i}
                onClick={() => setActiveStep(i === activeStep ? -1 : i)}
                isDarkMode={isDarkMode}
              />
            ))}
          </div>

          {/* Simulator Launch Action Card */}
          <div style={{
            background: isDarkMode 
              ? 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(15,23,42,0.3) 100%)' 
              : 'linear-gradient(135deg, rgba(99,102,241,0.04) 0%, #ffffff 100%)',
            border: isDarkMode ? '1.5px solid rgba(99,102,241,0.2)' : '1.5px solid rgba(99,102,241,0.15)',
            borderRadius: 28, padding: '32px 36px', textAlign: 'center',
            boxShadow: isDarkMode ? 'none' : '0 10px 30px rgba(99,102,241,0.03)',
            transition: 'all 0.3s ease',
          }}>
            <div style={{
              background: 'rgba(99, 102, 241, 0.1)',
              borderRadius: '50%',
              width: 56, height: 56,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#6366f1'
            }}>
              <Wrench size={24} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 900, color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
              Launch Simulator Environment
            </h3>
            <p style={{ margin: '0 0 24px', fontSize: 13.5, color: isDarkMode ? '#94a3b8' : '#64748b', lineHeight: 1.6, maxWidth: 480, marginInline: 'auto' }}>
              Pop open the Wokwi schematic terminal, assemble your electrical circuitry connections, verify your code firmware, then click the blue <strong>Submit Assessment</strong> button inside the toolbar.
            </p>
            <button onClick={openSimulator} style={{
              background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
              border: 'none', borderRadius: 16,
              padding: '16px 36px', fontSize: 14, fontWeight: 900,
              color: '#fff', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              boxShadow: '0 8px 24px rgba(99,102,241,0.3)',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              transition: 'all 0.2s',
            }}>
              <span>Launch Simulator</span>
              <ArrowRight size={16} strokeWidth={2.5} />
            </button>

            {submission && (
              <div style={{ marginTop: 16, fontSize: 13, color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                <CheckCircle2 size={14} />
                <span>Payload detected from {new Date(submission.submittedAt).toLocaleTimeString()} - Score resolved on the right side panel!</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Score card output (only shown when result exists) */}
        {result && (
          <div style={{ animation: 'fadeUp 0.4s ease' }}>
            <div style={{ position: 'sticky', top: 88, display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Score Display Card */}
              <div style={{
                background: result.passed
                  ? (isDarkMode ? 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(15,23,42,0.4) 100%)' : 'rgba(16,185,129,0.05)')
                  : (isDarkMode ? 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(15,23,42,0.4) 100%)' : 'rgba(239,68,68,0.04)'),
                border: `2px solid ${result.passed ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.3)'}`,
                borderRadius: 28, padding: '30px 24px', textAlign: 'center',
                boxShadow: isDarkMode ? 'none' : '0 10px 30px rgba(0,0,0,0.02)',
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 900,
                  color: result.passed ? '#10b981' : '#ef4444',
                  textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 20
                }}>
                  {result.passed ? 'Mission Certified!' : 'Assessment Pending'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                  <ScoreRing score={result.totalScore} size={130} isDarkMode={isDarkMode} />
                </div>
                <div style={{ fontSize: 13, color: isDarkMode ? '#94a3b8' : '#64748b', marginBottom: 16 }}>
                  Requirement to Pass: <strong style={{ color: result.passed ? '#10b981' : '#f59e0b' }}>{result.threshold}%</strong>
                </div>
                {result.passed && (
                  <div style={{
                    background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)',
                    borderRadius: 14, padding: '12px 14px', fontSize: 13.5, fontWeight: 900, color: '#fbbf24',
                    display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center'
                  }}>
                    <Star size={14} fill="#fbbf24" color="#fbbf24" />
                    <span>Bonus Quest XP Claimed!</span>
                  </div>
                )}
              </div>

              {/* Criteria Score Checklist Breakdown */}
              <div style={{
                background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.65)',
                border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'}`,
                borderRadius: 24, padding: 24,
                boxShadow: isDarkMode ? 'none' : '0 8px 24px rgba(0,0,0,0.01)',
              }}>
                <h4 style={{ margin: '0 0 20px', fontSize: 11, fontWeight: 900, color: isDarkMode ? '#475569' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  Blueprint Verification Breakdown
                </h4>
                {Object.values(result.criteria || {}).map(c => (
                  <div key={c.title} style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 800, color: isDarkMode ? '#cbd5e1' : '#334155' }}>{c.title}</span>
                      <span style={{ fontSize: 13, fontWeight: 900, color: c.score >= 80 ? '#10b981' : c.score >= 50 ? '#f59e0b' : '#ef4444' }}>
                        {c.score}%
                      </span>
                    </div>
                    {/* Linear Progress Bar Slider */}
                    <div style={{ height: 8, borderRadius: 99, background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)', overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{
                        height: '100%', borderRadius: 99, width: `${c.score}%`,
                        background: c.score >= 80 ? '#10b981' : c.score >= 50 ? '#f59e0b' : '#ef4444',
                        transition: 'width 0.8s ease'
                      }} />
                    </div>
                    {c.feedback && <p style={{ margin: '0 0 6px', fontSize: 12, color: isDarkMode ? '#64748b' : '#94a3b8', fontStyle: 'italic' }}>{c.feedback}</p>}
                    {c.issues?.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                        {c.issues.map((issue, i) => (
                          <div key={i} style={{ display: 'flex', gap: 6, fontSize: 12, color: '#ef4444', alignItems: 'flex-start' }}>
                            <span style={{ flexShrink: 0, marginTop: 1 }}>•</span>
                            <span>{issue}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Fix issues prompt */}
              {!result.passed && (
                <div style={{
                  background: isDarkMode ? 'rgba(251,191,36,0.06)' : 'rgba(251,191,36,0.08)',
                  border: isDarkMode ? '1px solid rgba(251,191,36,0.15)' : '1px solid rgba(251,191,36,0.25)',
                  borderRadius: 16, padding: '14px 18px', fontSize: 13, color: isDarkMode ? '#fbbf24' : '#854d0e',
                  fontWeight: 600, lineHeight: 1.6, display: 'flex', gap: 8, alignItems: 'flex-start'
                }}>
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>Fix the blueprint checks listed above, click <strong>Submit Assessment</strong> inside the simulator toolbar, then check this panel for a updated score.</span>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={openSimulator} style={{
                  background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                  border: 'none', borderRadius: 14, padding: '14px',
                  fontSize: 13.5, fontWeight: 900, color: '#fff', cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', boxShadow: '0 4px 16px rgba(99,102,241,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                }}>
                  <RotateCcw size={15} />
                  <span>Resume in Simulator</span>
                </button>
                {result.passed && (
                  <button onClick={goBackToMap} style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    border: 'none', borderRadius: 14, padding: '14px',
                    fontSize: 13.5, fontWeight: 900, color: '#fff', cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif', boxShadow: '0 4px 16px rgba(16,185,129,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                  }}>
                    <ArrowRight size={15} />
                    <span>Return to World Map</span>
                  </button>
                )}
                <button onClick={clearResult} style={{
                  background: 'transparent',
                  border: `1.5px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(15, 23, 42, 0.08)'}`,
                  borderRadius: 14, padding: '12px',
                  fontSize: 13, fontWeight: 800, color: isDarkMode ? '#64748b' : '#94a3b8',
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.2s',
                }}>
                  <Trash2 size={14} />
                  <span>Reset Scoreboard</span>
                </button>
              </div>

              {evalResult?.submittedAt && (
                <div style={{ textAlign: 'center', fontSize: 11, color: isDarkMode ? '#475569' : '#94a3b8', marginTop: 4 }}>
                  Last Checked: {new Date(evalResult.submittedAt).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Evaluating spinner (when processing) */}
        {evaluating && !result && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '18px 24px', borderRadius: 16,
            background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)',
            gridColumn: '1 / -1'
          }}>
            <span style={{ fontSize: 16, animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>⏳</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#60a5fa' }}>Verifying build blueprints and testing code parameters…</span>
          </div>
        )}

        {/* No submission yet notification */}
        {!submission && !result && (
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{
              background: isDarkMode ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.45)',
              border: `1.5px dashed ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15, 23, 42, 0.08)'}`,
              borderRadius: 24, padding: '40px 24px', textAlign: 'center',
              boxShadow: isDarkMode ? 'none' : '0 4px 12px rgba(0,0,0,0.01)',
            }}>
              <div style={{
                background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(15, 23, 42, 0.03)',
                borderRadius: '50%', width: 52, height: 52,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
                color: isDarkMode ? '#475569' : '#94a3b8',
              }}>
                <AlertCircle size={22} />
              </div>
              <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: isDarkMode ? '#cbd5e1' : '#334155' }}>
                Awaiting Submission
              </h4>
              <p style={{ margin: 0, fontSize: 13, color: isDarkMode ? '#64748b' : '#94a3b8', lineHeight: 1.5, maxWidth: 440, marginInline: 'auto' }}>
                Assemble the schematic diagram inside the Simulator dashboard. Click the blue <strong>Submit Assessment</strong> button in the editor toolbar when you are ready to get scored.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function titleFromSlug(slug) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}