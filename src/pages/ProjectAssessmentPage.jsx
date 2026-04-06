import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useGamification } from '../context/GamificationContext'
import { PROJECTS } from '../services/gamification/ProjectsConfig'

const EXAMPLES_BASE_URL = import.meta.env.VITE_EXAMPLES_BASE_URL || 'http://localhost:5001/examples';

const S = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontFamily: 'Space Grotesk, sans-serif',
    padding: '48px 20px',
  },
  card: {
    maxWidth: 920,
    margin: '0 auto',
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 28,
    boxShadow: 'var(--shadow)',
  },
  header: {
    margin: '0 0 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    fontSize: 32,
  },
  subtitle: {
    margin: '0 0 20px',
    color: 'var(--text2)',
    lineHeight: 1.6,
  },
  section: {
    marginBottom: 20,
    padding: 18,
    borderRadius: 12,
    background: 'var(--card2)',
    border: '1px solid var(--border2)',
  },
  sectionTitle: {
    margin: '0 0 12px',
    fontSize: 20,
    fontWeight: 600,
  },
  buttonRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
  },
  backButton: {
    background: 'transparent',
    color: 'var(--accent)',
    border: '1px solid var(--border2)',
    padding: '12px 16px',
    borderRadius: 10,
    fontWeight: 700,
    cursor: 'pointer',
  },
  primaryButton: {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    padding: '12px 18px',
    borderRadius: 10,
    fontWeight: 700,
    cursor: 'pointer',
  },
  resultBox: {
    marginTop: 16,
    padding: 18,
    borderRadius: 10,
    textAlign: 'center',
  },
  successResult: {
    background: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid #10b981',
    color: '#10b981',
  },
  errorResult: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid #ef4444',
    color: '#ef4444',
  },
  criteriaItem: {
    padding: 12,
    borderRadius: 8,
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    marginBottom: 10,
  },
  criteriaHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  criteriaTitle: {
    margin: 0,
    fontWeight: 600,
  },
  criteriaDesc: {
    margin: 0,
    color: 'var(--text2)',
    fontSize: 14,
  },
  badge: {
    padding: '4px 8px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid var(--border)',
  },
  checklist: {
    margin: 0,
    paddingLeft: 18,
    lineHeight: 1.8,
  },
  demoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 16,
  },
  demoCard: {
    textAlign: 'center',
    padding: 10,
    borderRadius: 10,
    background: 'var(--bg)',
    border: '1px solid var(--border)',
  },
  demoImg: {
    width: '100%',
    height: 160,
    objectFit: 'cover',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: '#111',
  },
  themeButton: {
    background: 'transparent',
    color: 'var(--text2)',
    border: '1px solid var(--border)',
    padding: '8px 12px',
    borderRadius: 10,
    fontWeight: 600,
    cursor: 'pointer',
  },
}

function titleFromSlug(slug) {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatWeight(weight) {
  if (typeof weight !== 'number') return ''
  return `${Math.round(weight * 100)}%`
}

const ROLE_TO_TYPE = {
  arduino: 'wokwi-arduino-uno',
  resistor: 'wokwi-resistor',
  led: 'wokwi-led',
  'rgb-led': 'wokwi-rgb-led',
  potentiometer: 'wokwi-potentiometer',
  'analog-joystick': 'wokwi-analog-joystick',
}

function resolveRoleType(roleOrType) {
  if (!roleOrType) return null
  return ROLE_TO_TYPE[roleOrType] || roleOrType
}

function pickFeedback(score, scoreConfig) {
  if (!scoreConfig) return ''
  const entries = Object.values(scoreConfig).filter(item => typeof item?.min === 'number')
  entries.sort((a, b) => b.min - a.min)
  const match = entries.find(item => score >= item.min)
  return match?.feedback || ''
}

function matchesArduinoPin(expected, pinId, pinLabel) {
  if (!expected) return false
  return pinLabel === expected || pinId === expected
}

function matchesResistorTerminal(expected, pinId, pinLabel) {
  if (!expected) return false
  return pinLabel === expected || pinId === expected
}

function matchesPotentiometerTerminal(expected, pinId, pinLabel) {
  if (!expected) return false
  return pinLabel === expected || pinId === expected
}

function matchesLedTerminal(expected, pinId, pinLabel) {
  if (!expected) return false
  return pinLabel === expected || pinId === expected
}

function endpointMatches(comp, pinId, pinLabel, expectedEndpoint) {
  if (!comp || !expectedEndpoint) return false
  if (expectedEndpoint.pin && comp.type === ROLE_TO_TYPE.arduino) {
    return matchesArduinoPin(expectedEndpoint.pin, pinId, pinLabel)
  }
  if (expectedEndpoint.terminal && comp.type === ROLE_TO_TYPE.resistor) {
    return matchesResistorTerminal(expectedEndpoint.terminal, pinId, pinLabel)
  }
  if (expectedEndpoint.terminal && comp.type === ROLE_TO_TYPE.potentiometer) {
    return matchesPotentiometerTerminal(expectedEndpoint.terminal, pinId, pinLabel)
  }
  if (expectedEndpoint.terminal && (comp.type === ROLE_TO_TYPE.led || comp.type === ROLE_TO_TYPE['rgb-led'])) {
    return matchesLedTerminal(expectedEndpoint.terminal, pinId, pinLabel)
  }
  return false
}

function evaluateAssessment(config, components, wires, code) {
  const criteriaConfig = config?.evaluationCriteria || {}
  const scoringConfig = config?.scoring || {}
  const criteriaResult = {}
  let totalWeightedScore = 0

  if (criteriaConfig.components) {
    const { required = [], weight = 0 } = criteriaConfig.components
    const issues = []
    let correctCount = 0

    required.forEach((req) => {
      const expectedType = resolveRoleType(req.type)
      const count = components.filter(c => c.type === expectedType).length
      if (count === req.count) {
        correctCount += 1
      } else {
        issues.push(`Expected ${req.count} ${req.type}, found ${count}.`)
      }
    })

    const score = required.length ? Math.round((correctCount / required.length) * 100) : 0
    totalWeightedScore += score * weight
    criteriaResult.components = {
      title: 'Components',
      score,
      feedback: pickFeedback(score, scoringConfig.components),
      issues,
    }
  }

  if (criteriaConfig.wiringAccuracy) {
    const { requiredConnections = [], weight = 0 } = criteriaConfig.wiringAccuracy
    const issues = []
    let matchCount = 0

    const wireMatches = (wire, conn) => {
      const [fromCompId, fromPinId] = wire.from.split(':')
      const [toCompId, toPinId] = wire.to.split(':')
      const fromComp = components.find(c => c.id === fromCompId)
      const toComp = components.find(c => c.id === toCompId)
      const fromLabel = wire.fromLabel
      const toLabel = wire.toLabel

      const fromType = ROLE_TO_TYPE[conn.from.component]
      const toType = ROLE_TO_TYPE[conn.to.component]
      const fromIdExpected = !fromType ? conn.from.component : null
      const toIdExpected = !toType ? conn.to.component : null
      const fromTypeOk = fromComp && fromType ? fromComp.type === fromType : false
      const toTypeOk = toComp && toType ? toComp.type === toType : false
      const fromIdOk = fromComp && fromIdExpected ? fromComp.id === fromIdExpected : false
      const toIdOk = toComp && toIdExpected ? toComp.id === toIdExpected : false

      const direct =
        (fromTypeOk || fromIdOk) &&
        (toTypeOk || toIdOk) &&
        endpointMatches(fromComp, fromPinId, fromLabel, conn.from) &&
        endpointMatches(toComp, toPinId, toLabel, conn.to)

      const reverse =
        fromComp && toComp &&
        ((toType && fromComp.type === toType) || (toIdExpected && fromComp.id === toIdExpected)) &&
        ((fromType && toComp.type === fromType) || (fromIdExpected && toComp.id === fromIdExpected)) &&
        endpointMatches(fromComp, fromPinId, fromLabel, conn.to) &&
        endpointMatches(toComp, toPinId, toLabel, conn.from)

      return direct || reverse
    }

    requiredConnections.forEach((conn) => {
      const hasMatch = wires.some(wire => wireMatches(wire, conn))
      if (hasMatch) {
        matchCount += 1
      } else {
        issues.push(`Missing connection: ${conn.from.component} ${conn.from.pin || conn.from.terminal} to ${conn.to.component} ${conn.to.pin || conn.to.terminal}.`)
      }
    })

    const score = requiredConnections.length ? Math.round((matchCount / requiredConnections.length) * 100) : 0
    totalWeightedScore += score * weight
    criteriaResult.wiringAccuracy = {
      title: 'Wiring Accuracy',
      score,
      feedback: pickFeedback(score, scoringConfig.wiringAccuracy),
      issues,
    }
  }

  if (criteriaConfig.codeFunctionality) {
    const { requiredFunctions = [], expectedBehavior = {}, weight = 0 } = criteriaConfig.codeFunctionality
    const issues = []
    let checks = 0
    let passed = 0
    const codeText = code || ''
    const identifierToPin = {}

    codeText.split('\n').forEach((line) => {
      const defineMatch = line.match(/#define\s+([A-Za-z_]\w*)\s+(\d+|A\d+)/)
      if (defineMatch) {
        const value = defineMatch[2]
        identifierToPin[defineMatch[1]] = /^\d+$/.test(value) ? Number(value) : value
        return
      }
      const constMatch = line.match(/const\s+int\s+([A-Za-z_]\w*)\s*=\s*(\d+|A\d+)/)
      if (constMatch) {
        const value = constMatch[2]
        identifierToPin[constMatch[1]] = /^\d+$/.test(value) ? Number(value) : value
      }
    })

    const hasFunction = (fn) => {
      if (!fn) return false
      const escaped = fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(`\\b${escaped}\\b`).test(codeText)
    }

    const resolvePinToken = (pinValue) => {
      if (pinValue == null) return null
      const asString = pinValue.toString()
      if (/^\d+$/.test(asString)) {
        const num = Number(asString)
        const id = Object.entries(identifierToPin).find(([, value]) => value === num)?.[0]
        return { numeric: num, identifier: id || null, aliases: [] }
      }
      const mapped = identifierToPin[asString]
      const aliases = Object.entries(identifierToPin)
        .filter(([, value]) => value === asString)
        .map(([key]) => key)
      return {
        identifier: asString,
        numeric: typeof mapped === 'number' ? mapped : null,
        aliases
      }
    }

    requiredFunctions.forEach((fn) => {
      checks += 1
      const hasFn = hasFunction(fn)
      if (hasFn) passed += 1
      else issues.push(`Missing function: ${fn}().`)
    })

    if (expectedBehavior) {
      const pinNumber = expectedBehavior.pinNumber ?? null
      const rgbPins = Array.isArray(expectedBehavior.rgbPins) ? expectedBehavior.rgbPins : null
      const pinArray = Array.isArray(expectedBehavior.pinArray) ? expectedBehavior.pinArray : null
      const delayRange = Array.isArray(expectedBehavior.delayRange) ? expectedBehavior.delayRange : null
      const pinModeExpected = expectedBehavior.pinMode || 'OUTPUT'
      let blinkAlternationOk = null

      if (pinNumber != null && expectedBehavior.pinMode) {
        checks += 1
        const token = resolvePinToken(pinNumber)
        const directRegex = new RegExp(`pinMode\\s*\\(\\s*${pinNumber}\\s*,\\s*${pinModeExpected}\\s*\\)`, 'i')
        const idRegex = token?.identifier
          ? new RegExp(`pinMode\\s*\\(\\s*${token.identifier}\\s*,\\s*${pinModeExpected}\\s*\\)`, 'i')
          : null
        const aliasMatch = token?.aliases?.some((alias) =>
          new RegExp(`pinMode\\s*\\(\\s*${alias}\\s*,\\s*${pinModeExpected}\\s*\\)`, 'i').test(codeText)
        )
        if (directRegex.test(codeText) || (idRegex && idRegex.test(codeText)) || aliasMatch) passed += 1
        else issues.push('pinMode should configure the correct output pin.')
      } else if (rgbPins && rgbPins.length > 0) {
        const pinModeMatches = rgbPins.filter((pin) => {
          const directRegex = new RegExp(`pinMode\\s*\\(\\s*${pin}\\s*,\\s*${pinModeExpected}\\s*\\)`, 'i')
          if (directRegex.test(codeText)) return true
          const mappedId = Object.entries(identifierToPin).find(([, value]) => value === pin)?.[0]
          if (!mappedId) return false
          const idRegex = new RegExp(`pinMode\\s*\\(\\s*${mappedId}\\s*,\\s*${pinModeExpected}\\s*\\)`, 'i')
          return idRegex.test(codeText)
        }).length
        checks += 1
        if (pinModeMatches === rgbPins.length) passed += 1
        else issues.push('pinMode should configure all RGB output pins.')
      }

      if (pinArray && pinArray.length > 0) {
        checks += 1
        const pinMatches = pinArray.filter((pin) => {
          const directRegex = new RegExp(`(pinMode|digitalWrite)\\s*\\(\\s*${pin}\\s*`, 'i')
          if (directRegex.test(codeText)) return true
          const mappedId = Object.entries(identifierToPin).find(([, value]) => value === pin)?.[0]
          if (!mappedId) return false
          const idRegex = new RegExp(`(pinMode|digitalWrite)\\s*\\(\\s*${mappedId}\\s*`, 'i')
          return idRegex.test(codeText)
        }).length
        if (pinMatches === pinArray.length) passed += 1
        else issues.push('All expected pins should be used in pinMode or digitalWrite.')
      }

      if (expectedBehavior.blinkDelay != null) {
        checks += 1
        const delayValue = expectedBehavior.blinkDelay
        const delayRegex = new RegExp(`delay\\s*\\(\\s*${delayValue}\\s*\\)`, 'i')
        if (delayRegex.test(codeText)) passed += 1
        else issues.push('Blink delay does not match the expected value.')
      } else if (expectedBehavior.delayMs != null) {
        checks += 1
        const delayRegex = new RegExp(`delay\\s*\\(\\s*${expectedBehavior.delayMs}\\s*\\)`, 'i')
        if (delayRegex.test(codeText)) passed += 1
        else issues.push('Delay timing does not match the expected value.')
      } else if (delayRange && delayRange.length === 2) {
        checks += 1
        const minDelay = Number(delayRange[0])
        const maxDelay = Number(delayRange[1])
        const delayMatches = [...codeText.matchAll(/delay\s*\(\s*(\d+)\s*\)/gi)]
          .map(match => Number(match[1]))
          .some(val => val >= minDelay && val <= maxDelay)
        if (delayMatches) passed += 1
        else issues.push('Delay timing should fall within the expected range.')
      }

      if (pinNumber != null && expectedBehavior.pinMode) {
        checks += 1
        const highRegex = new RegExp(`digitalWrite\\s*\\(\\s*${pinNumber}\\s*,\\s*HIGH\\s*\\)`, 'i')
        const lowRegex = new RegExp(`digitalWrite\\s*\\(\\s*${pinNumber}\\s*,\\s*LOW\\s*\\)`, 'i')
        blinkAlternationOk = highRegex.test(codeText) && lowRegex.test(codeText)
        if (blinkAlternationOk) passed += 1
        else issues.push('Blink pattern should alternate HIGH and LOW.')

        checks += 1
        const pinUseRegex = new RegExp(`(pinMode|digitalWrite)\\s*\\(\\s*${pinNumber}\\s*`, 'i')
        if (pinUseRegex.test(codeText)) passed += 1
        else issues.push('Expected pin number is not used in the code.')
      }

      if (pinNumber != null && /analogRead\s*\(/i.test(codeText)) {
        checks += 1
        const token = resolvePinToken(pinNumber)
        const directRegex = new RegExp(`analogRead\\s*\\(\\s*${pinNumber}\\s*\\)`, 'i')
        const idRegex = token?.identifier
          ? new RegExp(`analogRead\\s*\\(\\s*${token.identifier}\\s*\\)`, 'i')
          : null
        const aliasMatch = token?.aliases?.some((alias) =>
          new RegExp(`analogRead\\s*\\(\\s*${alias}\\s*\\)`, 'i').test(codeText)
        )
        if (directRegex.test(codeText) || (idRegex && idRegex.test(codeText)) || aliasMatch) passed += 1
        else issues.push('analogRead should use the expected input pin.')
      }

      if (expectedBehavior.pattern) {
        checks += 1
        const pattern = expectedBehavior.pattern.toString().toLowerCase()
        if (pattern === 'running-led') {
          const hasLoop = /for\s*\(|while\s*\(/i.test(codeText)
          const hasWrites = /digitalWrite\s*\(/i.test(codeText)
          if (hasLoop && hasWrites) passed += 1
          else issues.push('Code should implement a running LED pattern.')
        } else if (pattern === 'alternating high/low') {
          if (blinkAlternationOk == null) {
            const highRegex = /digitalWrite\s*\([^,]+,\s*HIGH\s*\)/i
            const lowRegex = /digitalWrite\s*\([^,]+,\s*LOW\s*\)/i
            blinkAlternationOk = highRegex.test(codeText) && lowRegex.test(codeText)
          }
          if (blinkAlternationOk) passed += 1
          else issues.push('Code should alternate HIGH and LOW for the blink pattern.')
        } else {
          const patternRegex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
          if (patternRegex.test(codeText)) passed += 1
          else issues.push('Code should implement the expected pattern.')
        }
      }
    }

    const score = checks ? Math.round((passed / checks) * 100) : 0
    totalWeightedScore += score * weight
    criteriaResult.codeFunctionality = {
      title: 'Code Functionality',
      score,
      feedback: pickFeedback(score, scoringConfig.codeFunctionality),
      issues,
    }
  }

  const totalScore = Math.round(totalWeightedScore)
  return {
    totalScore,
    passed: totalScore >= (config?.passingThreshold || 0),
    threshold: config?.passingThreshold || 0,
    criteria: criteriaResult,
  }
}

export default function ProjectAssessmentPage() {
  const navigate = useNavigate()
  const { projectName = '' } = useParams()

  // Extract gamification functions inside the component body
  const { completedProjects, completeProject, awardXP } = useGamification()

  const projectTitle = useMemo(() => titleFromSlug(projectName), [projectName])
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark')
  const [evaluationConfig, setEvaluationConfig] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [submission, setSubmission] = useState(null)
  const [evaluationResult, setEvaluationResult] = useState(null)

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  useEffect(() => {
    let cancelled = false
    const loadConfig = async () => {
      if (!projectName) return
      setLoadError(null)
      try {
        const res = await fetch(`${EXAMPLES_BASE_URL}/${projectName}/evaluation.json`)
        if (!res.ok) throw new Error('Failed to load evaluation config')
        const data = await res.json()
        if (!cancelled) setEvaluationConfig(data)
      } catch (err) {
        console.error('Failed to load evaluation config', err)
        if (!cancelled) setLoadError('Unable to load evaluation criteria for this project.')
      }
    }
    setEvaluationConfig(null)
    loadConfig()
    return () => { cancelled = true }
  }, [projectName])

  useEffect(() => {
    if (!projectName) return
    const stored = sessionStorage.getItem(`openhw_assessment_submission:${projectName}`)
    if (!stored) {
      setSubmission(null)
      setEvaluationResult(null)
      return
    }
    try {
      const parsed = JSON.parse(stored)
      setSubmission(parsed)
    } catch {
      setSubmission(null)
    }
  }, [projectName])

  useEffect(() => {
    if (!evaluationConfig || !submission) return

    // Evaluate the results
    const result = evaluateAssessment(evaluationConfig, submission.components || [], submission.wires || [], submission.code || '')

    const payload = {
      projectName,
      submittedAt: submission.submittedAt,
      result,
    }
    setEvaluationResult(payload)
    sessionStorage.setItem(`openhw_assessment_result:${projectName}`, JSON.stringify(payload))

    // Process Gamification logic based on the calculated result
    if (result.passed) {
      if (completedProjects && !completedProjects.includes(projectName)) {
        if (completeProject) completeProject(projectName)
      } else {
        const project = PROJECTS.find(p => p.slug === projectName)
        const bonus = Math.round((project?.xpReward || 100) * 0.25)
        if (awardXP) awardXP(bonus, 'Re-submission bonus')
      }
    }
  }, [evaluationConfig, submission, projectName, completedProjects, completeProject, awardXP])

  const criteriaList = useMemo(() => {
    if (!evaluationConfig?.evaluationCriteria) return []
    return Object.entries(evaluationConfig.evaluationCriteria).map(([key, value]) => ({
      id: key,
      ...value,
    }))
  }, [evaluationConfig])

  const openAssessmentSimulator = () => {
    navigate(`/simulator?mode=assessment&project=${encodeURIComponent(projectName)}`)
  }

  const clearResult = () => {
    if (!projectName) return
    sessionStorage.removeItem(`openhw_assessment_result:${projectName}`)
    sessionStorage.removeItem(`openhw_assessment_submission:${projectName}`)
    setSubmission(null)
    setEvaluationResult(null)
  }

  return (
    <div style={S.page} className="min-h-screen bg-[var(--bg)] text-[var(--text)] px-5 py-12">
      <div style={S.card}>
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => navigate('/')} style={S.backButton}>
              ← Back
            </button>
            <h1 style={S.title}>{projectTitle} Assessment</h1>
          </div>
          <button onClick={toggleTheme} style={S.themeButton}>
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>

        <p style={S.subtitle}>
          Build your circuit in the simulator and submit it for automatic evaluation using this project's{' '}
          <code>evaluation.json</code> criteria.
        </p>

        {loadError && (
          <div style={{ ...S.section, borderColor: 'rgba(239,68,68,0.6)', color: '#ef4444' }}>
            {loadError}
          </div>
        )}

        {evaluationConfig && (
          <div style={S.section}>
            <h3 style={S.sectionTitle}>{evaluationConfig.title || 'Evaluation Criteria'}</h3>
            {evaluationConfig.description && (
              <p style={{ margin: '0 0 12px', color: 'var(--text2)' }}>{evaluationConfig.description}</p>
            )}
            <div>
              {criteriaList.map((item) => (
                <div key={item.id} style={S.criteriaItem}>
                  <div style={S.criteriaHeader}>
                    <h4 style={S.criteriaTitle}>{item.description || item.id}</h4>
                    <span style={S.badge}>{formatWeight(item.weight)}</span>
                  </div>
                  {item.required && (
                    <>
                      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>Required components:</div>
                      <ul style={S.checklist}>
                        {item.required.map((comp, idx) => (
                          <li key={`${comp.type}-${idx}`}>
                            {comp.type} x {comp.count}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {item.requiredConnections && (
                    <>
                      <div style={{ fontSize: 13, color: 'var(--text2)', margin: '10px 0 6px' }}>Required connections:</div>
                      <ul style={S.checklist}>
                        {item.requiredConnections.map((conn, idx) => (
                          <li key={`${item.id}-conn-${idx}`}>
                            {conn.from.component} {conn.from.pin || conn.from.terminal} to {conn.to.component} {conn.to.pin || conn.to.terminal}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {item.requiredFunctions && (
                    <>
                      <div style={{ fontSize: 13, color: 'var(--text2)', margin: '10px 0 6px' }}>Required code elements:</div>
                      <ul style={S.checklist}>
                        {item.requiredFunctions.map(fn => (
                          <li key={fn}>{fn}()</li>
                        ))}
                      </ul>
                    </>
                  )}
                  {item.expectedBehavior && (
                    <>
                      <div style={{ fontSize: 13, color: 'var(--text2)', margin: '10px 0 6px' }}>Expected behavior:</div>
                      <ul style={S.checklist}>
                        {item.expectedBehavior.pinArray && (
                          <li>Pins: {item.expectedBehavior.pinArray.join(', ')}</li>
                        )}
                        {item.expectedBehavior.pinNumber != null && (
                          <li>Pin: {item.expectedBehavior.pinNumber}</li>
                        )}
                        {item.expectedBehavior.pinMode && (
                          <li>pinMode: {item.expectedBehavior.pinMode}</li>
                        )}
                        {item.expectedBehavior.delayRange && (
                          <li>Delay range: {item.expectedBehavior.delayRange[0]}–{item.expectedBehavior.delayRange[1]} ms</li>
                        )}
                        {item.expectedBehavior.blinkDelay != null && (
                          <li>Blink delay: {item.expectedBehavior.blinkDelay} ms</li>
                        )}
                        {item.expectedBehavior.delayMs != null && (
                          <li>Delay: {item.expectedBehavior.delayMs} ms</li>
                        )}
                        {item.expectedBehavior.pattern && (
                          <li>Pattern: {item.expectedBehavior.pattern}</li>
                        )}
                      </ul>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {evaluationConfig?.demoImages?.length > 0 && (
          <div style={S.section}>
            <h3 style={S.sectionTitle}>Demo Reference Images</h3>
            <div style={S.demoGrid}>
              {evaluationConfig.demoImages.map((demo) => (
                <div key={demo.id || demo.filename} style={S.demoCard}>
                  <img
                    style={S.demoImg}
                    src={`${EXAMPLES_BASE_URL}/${projectName}/${demo.filename}`}
                    alt={demo.name || 'Demo'}
                  />
                  <h4 style={{ margin: '8px 0 4px' }}>{demo.name}</h4>
                  <p style={{ fontSize: 13, color: 'var(--text2)' }}>{demo.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={S.section}>
          <h3 style={S.sectionTitle}>Assessment Flow</h3>
          <ol style={S.checklist}>
            <li>Open the assessment simulator.</li>
            <li>Build your circuit and upload your code.</li>
            <li>Click "Submit Assessment" inside the simulator.</li>
            <li>Return here to review your results.</li>
          </ol>
          <div style={{ marginTop: 16, ...S.buttonRow }}>
            <button onClick={() => navigate(`/${projectName}/guide`)} style={S.backButton}>
              Back to Guide
            </button>
            <button onClick={openAssessmentSimulator} style={S.primaryButton}>
              Open Assessment Simulator
            </button>
          </div>
        </div>

        {evaluationResult?.result && (
          <div style={S.section}>
            <h3 style={S.sectionTitle}>Latest Results</h3>
            <div style={{
              ...S.resultBox,
              ...(evaluationResult.result.passed ? S.successResult : S.errorResult)
            }}>
              <h3>{evaluationResult.result.passed ? 'Assessment Passed' : 'Assessment Failed'}</h3>
              <div style={{ fontSize: 46, fontWeight: 'bold', margin: '14px 0' }}>
                {evaluationResult.result.totalScore}%
              </div>
              <p style={{ fontSize: 16 }}>
                Passing threshold: {evaluationResult.result.threshold}%
              </p>
            </div>

            <div style={{ marginTop: 16 }}>
              {Object.entries(evaluationResult.result.criteria || {}).map(([key, value]) => (
                <div key={key} style={S.criteriaItem}>
                  <div style={S.criteriaHeader}>
                    <h4 style={S.criteriaTitle}>{value.title || key}</h4>
                    <span style={S.badge}>{value.score}%</span>
                  </div>
                  {value.feedback && <p style={S.criteriaDesc}>{value.feedback}</p>}
                  {Array.isArray(value.issues) && value.issues.length > 0 && (
                    <>
                      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>Issues:</div>
                      <ul style={S.checklist}>
                        {value.issues.map((issue, idx) => (
                          <li key={`${key}-issue-${idx}`}>{issue}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16, ...S.buttonRow }}>
              <button onClick={clearResult} style={S.backButton}>
                Clear Result
              </button>
              <button onClick={openAssessmentSimulator} style={S.primaryButton}>
                Try Again in Simulator
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}