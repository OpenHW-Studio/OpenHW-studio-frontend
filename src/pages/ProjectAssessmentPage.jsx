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

const PHASE_LABEL = { wire: 'Wiring', code: 'Coding', run: 'Run' }
const PHASE_COLOR = { wire: '#22c55e', code: '#3b82f6', run: '#f59e0b' }

// ─── Evaluation helpers (unchanged from original) ─────────────────────────
function titleFromSlug(slug) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

const ROLE_TO_TYPE = {
  arduino: 'openhw-arduino-uno', resistor: 'openhw-resistor',
  led: 'openhw-led', 'rgb-led': 'openhw-rgb-led',
  potentiometer: 'openhw-potentiometer', 'analog-joystick': 'openhw-analog-joystick',
  buzzer: 'openhw-buzzer',
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
function endpointMatches(comp, pinId, pinLabel, ep) {
  if (!comp || !ep) return false
  if (ep.pin)      return pinLabel === ep.pin      || pinId === ep.pin
  if (ep.terminal) return pinLabel === ep.terminal || pinId === ep.terminal
  return false
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
            if (ep.pin) return label === ep.pin || pin === ep.pin;
            if (ep.terminal) return label === ep.terminal || pin === ep.terminal;
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

// ─── CSS ──────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap');
  * { box-sizing: border-box; }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes popIn   { 0%{transform:scale(.88);opacity:0} 80%{transform:scale(1.03)} 100%{transform:scale(1);opacity:1} }
  @keyframes pulse   { 0%,100%{box-shadow:0 4px 24px rgba(34,197,94,.25)} 50%{box-shadow:0 4px 44px rgba(34,197,94,.65)} }
  @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
  @keyframes spin    { to{transform:rotate(360deg)} }
  @keyframes stamp   { 0%{transform:scale(2) rotate(-12deg);opacity:0} 100%{transform:scale(1) rotate(-12deg);opacity:1} }

  .pap-step-card:hover { transform:translateY(-2px); box-shadow:0 8px 32px rgba(0,0,0,.35) !important; }
  .pap-copy-btn:hover  { opacity:.75; }

  ::-webkit-scrollbar { width:6px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:rgba(255,255,255,.1); border-radius:6px; }
`

// ─── Code Snippet ─────────────────────────────────────────────────────────
function CodeSnippet({ code }) {
  const [copied, setCopied] = useState(false)
  return (
    <div style={{ borderRadius:10, overflow:'hidden', border:'1px solid rgba(59,130,246,.3)', marginTop:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(59,130,246,.12)', padding:'6px 12px', borderBottom:'1px solid rgba(59,130,246,.2)' }}>
        <span style={{ fontSize:10, fontWeight:800, color:'#3b82f6', letterSpacing:'.08em' }}>ARDUINO CODE</span>
        <button className="pap-copy-btn" onClick={() => { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(()=>setCopied(false),1600) }}
          style={{ background:'transparent', border:'none', color:copied?'#34d399':'#64748b', fontSize:11, fontWeight:800, cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
          {copied ? '✓ Copied!' : '📋 Copy'}
        </button>
      </div>
      <pre style={{ margin:0, padding:'12px 14px', background:'rgba(0,0,0,.45)', color:'#a5f3fc', fontSize:12, lineHeight:1.7, overflowX:'auto', fontFamily:"'JetBrains Mono','Fira Code',monospace", whiteSpace:'pre' }}>{code}</pre>
    </div>
  )
}

// ─── Step Flashcard ───────────────────────────────────────────────────────
function StepCard({ step, index, total, isActive, onClick }) {
  const phaseColor = PHASE_COLOR[step.phase] || '#22c55e'
  return (
    <div
      className="pap-step-card"
      onClick={onClick}
      style={{
        background: isActive
          ? `linear-gradient(135deg,${phaseColor}18,${phaseColor}06)`
          : 'rgba(255,255,255,.03)',
        border: `2px solid ${isActive ? phaseColor + '55' : 'rgba(255,255,255,.07)'}`,
        borderRadius: 18, padding: '20px 22px', cursor: 'pointer',
        transition: 'all .25s', animation: isActive ? 'popIn .3s ease' : 'none',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Phase ribbon */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background: isActive ? `linear-gradient(90deg,${phaseColor},${phaseColor}80)` : 'transparent', borderRadius:'18px 18px 0 0' }} />

      {/* Header row */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom: isActive ? 14 : 0 }}>
        <div style={{
          width:44, height:44, borderRadius:12, flexShrink:0,
          background: `${phaseColor}20`, border:`2px solid ${phaseColor}${isActive?'55':'33'}`,
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:22,
        }}>{step.icon}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
            <span style={{ fontSize:9, fontWeight:800, color:phaseColor, textTransform:'uppercase', letterSpacing:'.1em', background:`${phaseColor}18`, padding:'2px 8px', borderRadius:20, border:`1px solid ${phaseColor}33` }}>
              {PHASE_LABEL[step.phase]}
            </span>
            <span style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,.25)' }}>Step {index + 1} / {total}</span>
          </div>
          <div style={{ fontSize:15, fontWeight:900, color: isActive ? '#f0f4ff' : '#94a3b8', lineHeight:1.2 }}>{step.title}</div>
        </div>
        <div style={{ fontSize:16, color: isActive ? phaseColor : 'rgba(255,255,255,.15)', flexShrink:0 }}>
          {isActive ? '▼' : '▶'}
        </div>
      </div>

{/* Expanded content */}
      {isActive && (
        <div style={{ animation:'fadeUp .25s ease' }}>
          <div style={{ fontSize:14, color:'#cbd5e1', lineHeight:1.75, marginBottom:12, whiteSpace:'pre-line' }}>{step.instruction}</div>
          {step.code && <CodeSnippet code={step.code} />}
          <div style={{
            display:'flex', gap:8, alignItems:'flex-start', marginTop:12,
            background:'rgba(251,191,36,.08)', border:'1px solid rgba(251,191,36,.2)',
            borderRadius:10, padding:'10px 12px',
          }}>
            <span style={{ fontSize:16, flexShrink:0 }}>💡</span>
            <span style={{ fontSize:12.5, color:'#fbbf24', fontWeight:700, lineHeight:1.55 }}>{step.tip}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Score Ring ───────────────────────────────────────────────────────────
function ScoreRing({ score, size = 120 }) {
  const r = (size / 2) - 10
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#fbbf24' : '#ef4444'
  return (
    <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={10} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition:'stroke-dasharray 1s ease' }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        style={{ fill:color, fontSize:22, fontWeight:900, fontFamily:'Nunito,sans-serif', transform:'rotate(90deg)', transformOrigin:`${size/2}px ${size/2}px` }}>
        {score}%
      </text>
    </svg>
  )
}

// ─── Root Component ───────────────────────────────────────────────────────
export default function ProjectAssessmentPage() {
  const navigate  = useNavigate()
  const { projectName = '' } = useParams()
  const location  = useLocation()
  const classId = new URLSearchParams(location.search).get('classId')
  const { completedProjects = [], completeProject, awardXP, xp = 0, coins = 0 } = useGamification?.() || {}
  const [classProjectContent, setClassProjectContent] = useState(null)

  const projectTitle  = useMemo(() => titleFromSlug(projectName), [projectName])
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

const projectColor  = location.state?.projectColor || '#22c55e'

  const steps         = useMemo(() => getProjectGuidedSteps(classProjectContent, projectName), [classProjectContent, projectName])

  const [theme,            setTheme]           = useState('dark')
  const [activeStep,       setActiveStep]       = useState(0)
  const [submission,       setSubmission]       = useState(null)
  const [evalResult,       setEvalResult]       = useState(null)
  const [evaluating,       setEvaluating]       = useState(false)

  // Assessment config: class (MongoDB) assessment object | built-in PROJECTS.fallback
  const assessmentConfig = useMemo(() => {
    const defaultProject = PROJECTS.find(p => p.slug === projectName)
    const defaultEvaluation = defaultProject?.evaluation || {}

    if (classProjectContent) {
      const assessment = classProjectContent.assessment || {}

      // Merge alternative connections to ensure legacy DB assessments get the relaxed validation
      if (assessment.evaluationCriteria?.wiringAccuracy && defaultEvaluation.evaluationCriteria?.wiringAccuracy?.alternativeConnections) {
        if (!assessment.evaluationCriteria.wiringAccuracy.alternativeConnections) {
          assessment.evaluationCriteria.wiringAccuracy.alternativeConnections =
            defaultEvaluation.evaluationCriteria.wiringAccuracy.alternativeConnections;
        }
      }

      return {
        passingThreshold: assessment.passingThreshold ?? 0,
        evaluationCriteria: assessment.evaluationCriteria || {},
        scoring: assessment.scoring || {},
      }
    }
    // Non-class fallback: built-in PROJECTS data
    return {
      passingThreshold: defaultEvaluation.passingThreshold ?? 0,
      evaluationCriteria: defaultEvaluation.evaluationCriteria || {},
      scoring: defaultEvaluation.scoring || {},
    }
  }, [classProjectContent, projectName])

  // ─── Submission state key ──────────────────────────────────────────────────
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectName])

  // Auto-evaluate when both are ready
  useEffect(() => {
    if (!assessmentConfig || !submission) return
    setEvaluating(true)
    const result = evaluateAssessment(assessmentConfig, submission.components || [], submission.wires || [], submission.code || '')
    const payload = { projectName, submittedAt: submission.submittedAt, result }
    setEvalResult(payload)
    sessionStorage.setItem(`openhw_assessment_result:${projectName}`, JSON.stringify(payload))
    setEvaluating(false)
    if (result.passed) {
      if (!completedProjects.includes(projectName)) completeProject?.(projectName)
      else { const proj = PROJECTS.find(p => p.slug === projectName); awardXP?.(Math.round((proj?.xpReward || 100) * 0.25), 'Re-submission bonus') }
      markAdventureStepComplete({
        classId,
        projectSlug: projectName,
        stepKey: 'sim',
        stepOrder: 4,
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
  const isDark = theme === 'dark'

  return (
    <div style={{
      minHeight: '100vh',
      background: isDark ? 'linear-gradient(160deg,#080e1e 0%,#0c1528 55%,#07101f 100%)' : 'linear-gradient(160deg,#f0f4ff,#e8eef8)',
      color: isDark ? '#e2e8f0' : '#1e293b',
      fontFamily: 'Nunito,system-ui,sans-serif',
    }}>
      <style>{css}</style>

      {/* ── Top Bar ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 200,
        background: isDark ? 'rgba(7,10,20,.97)' : 'rgba(240,244,255,.97)',
        backdropFilter: 'blur(18px)',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)'}`,
        padding: '0 20px',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, height: 56 }}>
          <button onClick={() => navigate(classId ? `/adventure?classId=${encodeURIComponent(classId)}` : `/adventure`)} style={{ background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.07)', border: `1px solid ${isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.12)'}`, borderRadius: 8, padding: '6px 12px', color: isDark ? '#94a3b8' : '#64748b', cursor: 'pointer', fontSize: 12, fontWeight: 800, fontFamily: 'Nunito,sans-serif', flexShrink: 0 }}>← Map</button>

          <div style={{ flex:1, display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:30, height:30, borderRadius:8, background:`${projectColor}20`, border:`1px solid ${projectColor}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>📋</div>
            <div>
              <div style={{ fontSize:14, fontWeight:900, color: isDark ? '#f0f4ff' : '#1e293b' }}>{classProjectContent?.title || projectTitle} — Assessment</div>
              <div style={{ fontSize:10, fontWeight:700, color: isDark ? '#475569' : '#94a3b8', textTransform:'uppercase', letterSpacing:'.07em' }}>Build · Submit · Get Scored</div>
            </div>
          </div>

          <div style={{ display:'flex', gap:8 }}>
            <div style={{ padding:'4px 10px', borderRadius:7, background:'rgba(251,191,36,.1)', border:'1px solid rgba(251,191,36,.2)', fontSize:11, fontWeight:800, color:'#fbbf24' }}>⭐ {xp}</div>
            <div style={{ padding:'4px 10px', borderRadius:7, background:'rgba(245,158,11,.1)', border:'1px solid rgba(245,158,11,.2)', fontSize:11, fontWeight:800, color:'#f59e0b' }}>🪙 {coins}</div>
          </div>

          <button onClick={() => setTheme(t => t==='dark'?'light':'dark')} style={{ background:'transparent', border:`1px solid ${isDark?'rgba(255,255,255,.1)':'rgba(0,0,0,.12)'}`, borderRadius:8, padding:'5px 10px', color: isDark?'#475569':'#64748b', cursor:'pointer', fontSize:12, fontFamily:'Nunito,sans-serif' }}>{isDark ? '☀️' : '🌙'}</button>
        </div>
      </div>

      {/* ── Hero ── */}
      <div style={{ background:`linear-gradient(135deg,${projectColor}14,transparent 70%)`, borderBottom:`1px solid ${isDark?'rgba(255,255,255,.05)':'rgba(0,0,0,.06)'}`, padding:'24px 20px' }}>
        <div style={{ maxWidth:900, margin:'0 auto', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
          <div style={{ width:64, height:64, borderRadius:18, background:`${projectColor}20`, border:`2px solid ${projectColor}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:34, flexShrink:0 }}>
            {projectName === 'led-blink' ? '💡' : projectName === 'rgb-led' ? '🌈' : '🔧'}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, fontWeight:800, color:projectColor, letterSpacing:'.1em', textTransform:'uppercase', marginBottom:5 }}>Project Assessment</div>
            <div style={{ fontSize:26, fontWeight:900, color: isDark?'#f0f4ff':'#1e293b', marginBottom:6 }}>{classProjectContent?.title || projectTitle}</div>
            <div style={{ fontSize:13, color: isDark?'#64748b':'#94a3b8' }}>Follow the steps below, open the simulator, build your circuit, then submit for automatic scoring.</div>
          </div>
          {completedProjects.includes(projectName) && (
            <div style={{ padding:'8px 16px', borderRadius:10, background:'rgba(34,197,94,.15)', border:'1px solid rgba(34,197,94,.35)', color:'#34d399', fontSize:13, fontWeight:800, animation:'stamp .4s ease', transform:'rotate(-2deg)', flexShrink:0 }}>✅ Completed!</div>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ maxWidth:900, margin:'0 auto', padding:'32px 20px 100px', display:'grid', gridTemplateColumns: result ? '1fr 380px' : '1fr', gap:28 }}>

        {/* LEFT: Steps */}
        <div>
          {/* Section header */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:800, color: isDark?'#475569':'#94a3b8', textTransform:'uppercase', letterSpacing:'.1em' }}>📋 Build Steps</div>
            <div style={{ flex:1, height:1, background: isDark?'rgba(255,255,255,.06)':'rgba(0,0,0,.08)' }} />
            <div style={{ fontSize:11, fontWeight:700, color: isDark?'#334155':'#94a3b8' }}>{steps.length} steps</div>
          </div>

          {/* Step progress bar */}
          <div style={{ display:'flex', gap:4, marginBottom:24 }}>
            {steps.map((_,i) => (
              <div key={i} onClick={() => setActiveStep(i)} style={{ flex:1, height:6, borderRadius:99, cursor:'pointer', transition:'all .3s',
                background: i < activeStep ? '#22c55e' : i === activeStep ? PHASE_COLOR[steps[i].phase] : isDark?'rgba(255,255,255,.08)':'rgba(0,0,0,.1)',
                transform: i === activeStep ? 'scaleY(1.4)' : 'scaleY(1)',
              }} />
            ))}
          </div>

          {/* Step cards accordion */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {steps.map((step, i) => (
              <StepCard
                key={step.id}
                step={step}
                index={i}
                total={steps.length}
                isActive={activeStep === i}
                onClick={() => setActiveStep(i === activeStep ? -1 : i)}
              />
            ))}
          </div>

          {/* Launch simulator CTA */}
          <div style={{ marginTop:28, background: isDark ? 'linear-gradient(135deg,rgba(59,130,246,.14),rgba(59,130,246,.05))' : 'linear-gradient(135deg,rgba(59,130,246,.1),rgba(59,130,246,.04))', border:'2px solid rgba(59,130,246,.3)', borderRadius:20, padding:'24px 28px', textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:10 }}>🔨</div>
            <div style={{ fontSize:18, fontWeight:900, color: isDark?'#f0f4ff':'#1e293b', marginBottom:8 }}>Ready to build?</div>
            <div style={{ fontSize:13, color: isDark?'#64748b':'#94a3b8', marginBottom:20, lineHeight:1.6 }}>
              Open the simulator, follow the steps above, then click <strong style={{ color:'#3b82f6' }}>Submit Assessment</strong> inside the toolbar when done.
            </div>
            <button onClick={openSimulator} style={{
              background:'linear-gradient(135deg,#3b82f6,#2563eb)', border:'none',
              borderRadius:14, padding:'15px 40px', fontSize:16, fontWeight:800,
              color:'#fff', cursor:'pointer', fontFamily:'Nunito,sans-serif',
              boxShadow:'0 4px 28px rgba(59,130,246,.45)', transition:'all .2s',
            }}>🚀 Open Simulator →</button>
            {submission && (
              <div style={{ marginTop:14, fontSize:12, color:'#22c55e', fontWeight:700 }}>
                ✅ Submission found from {new Date(submission.submittedAt).toLocaleTimeString()} — scroll right to see your score!
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Assessment result (only shown when there is one) */}
        {result && (
          <div style={{ animation:'fadeUp .4s ease' }}>
            <div style={{ position:'sticky', top:80, display:'flex', flexDirection:'column', gap:16 }}>

              {/* Score card */}
              <div style={{
                background: result.passed
                  ? 'linear-gradient(135deg,rgba(34,197,94,.14),rgba(34,197,94,.05))'
                  : 'linear-gradient(135deg,rgba(239,68,68,.12),rgba(239,68,68,.04))',
                border:`2px solid ${result.passed ? 'rgba(34,197,94,.4)' : 'rgba(239,68,68,.35)'}`,
                borderRadius:20, padding:'24px 20px', textAlign:'center',
              }}>
                <div style={{ fontSize:11, fontWeight:800, color: result.passed?'#34d399':'#f87171', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:16 }}>
                  {result.passed ? '🏆 Assessment Passed!' : '📋 Assessment Result'}
                </div>
                <div style={{ display:'flex', justifyContent:'center', marginBottom:16 }}>
                  <ScoreRing score={result.totalScore} size={130} />
                </div>
                <div style={{ fontSize:13, color: isDark?'#64748b':'#94a3b8', marginBottom: result.passed ? 16 : 8 }}>
                  Need <strong style={{ color: result.passed ? '#34d399' : '#fbbf24' }}>{result.threshold}%</strong> to pass
                </div>
                {result.passed && (
                  <div style={{ background:'rgba(251,191,36,.12)', border:'1px solid rgba(251,191,36,.3)', borderRadius:10, padding:'10px 14px', fontSize:14, fontWeight:800, color:'#fbbf24', animation:'pulse 2s ease infinite' }}>
                    ⚡ XP Earned!
                  </div>
                )}
              </div>

              {/* Criteria breakdown */}
              <div style={{ background: isDark?'rgba(255,255,255,.03)':'rgba(0,0,0,.03)', border:`1px solid ${isDark?'rgba(255,255,255,.07)':'rgba(0,0,0,.08)'}`, borderRadius:16, padding:20 }}>
                <div style={{ fontSize:11, fontWeight:800, color: isDark?'#475569':'#94a3b8', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:16 }}>Breakdown</div>
                {Object.values(result.criteria || {}).map(c => (
                  <div key={c.title} style={{ marginBottom:16 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <span style={{ fontSize:13, fontWeight:800, color: isDark?'#94a3b8':'#64748b' }}>{c.title}</span>
                      <span style={{ fontSize:13, fontWeight:900, color: c.score>=80?'#34d399':c.score>=50?'#fbbf24':'#f87171' }}>{c.score}%</span>
                    </div>
                    <div style={{ height:8, borderRadius:99, background: isDark?'rgba(255,255,255,.06)':'rgba(0,0,0,.08)', overflow:'hidden', marginBottom:6 }}>
                      <div style={{ height:'100%', borderRadius:99, width:`${c.score}%`, background: c.score>=80?'#22c55e':c.score>=50?'#fbbf24':'#ef4444', transition:'width .8s ease' }} />
                    </div>
                    {c.feedback && <div style={{ fontSize:11.5, color: isDark?'#64748b':'#94a3b8', marginBottom:6, fontStyle:'italic' }}>{c.feedback}</div>}
                    {c.issues?.length > 0 && (
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        {c.issues.map((issue, i) => (
                          <div key={i} style={{ display:'flex', gap:6, fontSize:11.5, color:'#f87171' }}>
                            <span style={{ flexShrink:0 }}>•</span><span>{issue}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Retry hint */}
              {!result.passed && (
                <div style={{ background:'rgba(251,191,36,.07)', border:'1px solid rgba(251,191,36,.2)', borderRadius:12, padding:'12px 16px', fontSize:12.5, color:'#fbbf24', fontWeight:700, lineHeight:1.6 }}>
                  💡 Fix the issues above, click <strong>Submit Assessment</strong> inside the simulator, then come back here for a fresh score.
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <button onClick={openSimulator} style={{ background:'linear-gradient(135deg,#3b82f6,#2563eb)', border:'none', borderRadius:12, padding:'13px', fontSize:14, fontWeight:800, color:'#fff', cursor:'pointer', fontFamily:'Nunito,sans-serif', boxShadow:'0 4px 20px rgba(59,130,246,.35)' }}>
                  🔄 Try Again in Simulator
                </button>
                {result.passed && (
                  <button onClick={() => navigate(classId ? `/adventure?classId=${encodeURIComponent(classId)}` : '/adventure')} style={{ background:'linear-gradient(135deg,#22c55e,#16a34a)', border:'none', borderRadius:12, padding:'13px', fontSize:14, fontWeight:800, color:'#fff', cursor:'pointer', fontFamily:'Nunito,sans-serif', boxShadow:'0 4px 20px rgba(34,197,94,.35)' }}>
                    🗺️ Back to Adventure Map
                  </button>
                )}
                <button onClick={clearResult} style={{ background:'transparent', border:`1px solid ${isDark?'rgba(255,255,255,.1)':'rgba(0,0,0,.12)'}`, borderRadius:12, padding:'10px', fontSize:13, fontWeight:700, color: isDark?'#475569':'#94a3b8', cursor:'pointer', fontFamily:'Nunito,sans-serif' }}>
                  🗑 Clear Result
                </button>
              </div>

              {/* Submitted-at timestamp */}
              {evalResult?.submittedAt && (
                <div style={{ textAlign:'center', fontSize:11, color: isDark?'#1e2d45':'#cbd5e1' }}>
                  Submitted {new Date(evalResult.submittedAt).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Evaluating spinner (when no result yet) */}
        {evaluating && !result && (
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'20px 24px', borderRadius:14, background:'rgba(59,130,246,.08)', border:'1px solid rgba(59,130,246,.2)' }}>
            <span style={{ fontSize:18, animation:'spin 1s linear infinite', display:'inline-block' }}>⏳</span>
            <span style={{ fontSize:14, fontWeight:700, color:'#93c5fd' }}>Evaluating your submission…</span>
          </div>
        )}

        {/* No submission yet nudge */}
        {!submission && !result && (
          <div style={{ gridColumn: result ? 'auto' : '1 / -1' }}>
            <div style={{ background: isDark?'rgba(255,255,255,.02)':'rgba(0,0,0,.03)', border:`1px dashed ${isDark?'rgba(255,255,255,.08)':'rgba(0,0,0,.1)'}`, borderRadius:16, padding:'28px', textAlign:'center', color: isDark?'#334155':'#94a3b8' }}>
              <div style={{ fontSize:36, marginBottom:10, opacity:.5 }}>📭</div>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:6 }}>No submission yet</div>
              <div style={{ fontSize:13 }}>Open the simulator, build your circuit, and click <strong>Submit Assessment</strong> inside the toolbar.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}