import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// ─── PIN DEFINITIONS per component type ──────────────────────────────────────
// Each pin: { id, label, x, y } — offsets relative to component top-left
const PIN_DEFS = {
  'wokwi-arduino-uno': [
    // Digital pins (right side)
    { id: 'D13', label: 'D13', x: 192, y: 26 },
    { id: 'D12', label: 'D12', x: 192, y: 36 },
    { id: 'D11', label: 'D11', x: 192, y: 46 },
    { id: 'D10', label: 'D10', x: 192, y: 56 },
    { id: 'D9',  label: 'D9',  x: 192, y: 66 },
    { id: 'D8',  label: 'D8',  x: 192, y: 76 },
    { id: 'D7',  label: 'D7',  x: 192, y: 90 },
    { id: 'D6',  label: 'D6',  x: 192, y: 100 },
    { id: 'D5',  label: 'D5',  x: 192, y: 110 },
    { id: 'D4',  label: 'D4',  x: 192, y: 120 },
    // Power (top)
    { id: '5V',  label: '5V',  x: 30,  y: 0 },
    { id: 'GND', label: 'GND', x: 55,  y: 0 },
    { id: '3V3', label: '3.3V',x: 80,  y: 0 },
    // Analog (bottom)
    { id: 'A0',  label: 'A0',  x: 30,  y: 128 },
    { id: 'A1',  label: 'A1',  x: 55,  y: 128 },
    { id: 'A2',  label: 'A2',  x: 80,  y: 128 },
    { id: 'A3',  label: 'A3',  x: 105, y: 128 },
  ],
  'wokwi-led': [
    { id: 'A',   label: 'A+',  x: 15, y: 0  },
    { id: 'K',   label: 'K−',  x: 15, y: 60 },
  ],
  'wokwi-resistor': [
    { id: '1',   label: '1',   x: 0,  y: 15 },
    { id: '2',   label: '2',   x: 80, y: 15 },
  ],
  'wokwi-pushbutton': [
    { id: '1a',  label: '1a',  x: 0,  y: 10 },
    { id: '2a',  label: '2a',  x: 40, y: 10 },
    { id: '1b',  label: '1b',  x: 0,  y: 30 },
    { id: '2b',  label: '2b',  x: 40, y: 30 },
  ],
  'wokwi-buzzer': [
    { id: '+',   label: '+',   x: 15, y: 0  },
    { id: '-',   label: '−',   x: 35, y: 0  },
  ],
  'wokwi-servo': [
    { id: 'GND', label: 'GND', x: 10, y: 50 },
    { id: 'V+',  label: 'V+',  x: 35, y: 50 },
    { id: 'PWM', label: 'PWM', x: 60, y: 50 },
  ],
  'wokwi-neopixel': [
    { id: 'GND', label: 'GND', x: 0,  y: 15 },
    { id: 'VCC', label: 'VCC', x: 10, y: 0  },
    { id: 'DIN', label: 'DIN', x: 20, y: 15 },
    { id: 'DOUT',label: 'OUT', x: 30, y: 0  },
  ],
  'wokwi-lcd1602': [
    { id: 'VSS', label: 'GND', x: 10,  y: 0  },
    { id: 'VDD', label: 'VCC', x: 25,  y: 0  },
    { id: 'RS',  label: 'RS',  x: 60,  y: 0  },
    { id: 'RW',  label: 'RW',  x: 75,  y: 0  },
    { id: 'E',   label: 'E',   x: 90,  y: 0  },
    { id: 'D4',  label: 'D4',  x: 105, y: 0  },
    { id: 'D5',  label: 'D5',  x: 120, y: 0  },
    { id: 'D6',  label: 'D6',  x: 135, y: 0  },
    { id: 'D7',  label: 'D7',  x: 150, y: 0  },
  ],
}

// ─── VALIDATION RULES ─────────────────────────────────────────────────────────
// Returns array of { type: 'error'|'warning', message, compIds }
function validateCircuit(components, wires) {
  const errors = []

  // Check LED has a resistor in series
  const leds = components.filter(c => c.type === 'wokwi-led')
  const resistors = components.filter(c => c.type === 'wokwi-resistor')

  leds.forEach(led => {
    const ledPins = [`${led.id}:A`, `${led.id}:K`]
    const connectedToResistor = wires.some(w =>
      (ledPins.includes(w.from) || ledPins.includes(w.to)) &&
      resistors.some(r => w.from.startsWith(r.id) || w.to.startsWith(r.id))
    )
    if (!connectedToResistor && wires.some(w => ledPins.includes(w.from) || ledPins.includes(w.to))) {
      errors.push({ type: 'error', message: `LED "${led.id}" has no current-limiting resistor! Will burn out.`, compIds: [led.id] })
    }
  })

  // Check for unconnected power pins on buzzer/servo
  const buzzers = components.filter(c => c.type === 'wokwi-buzzer')
  buzzers.forEach(b => {
    const connected = wires.some(w => w.from.startsWith(b.id) || w.to.startsWith(b.id))
    if (!connected) {
      errors.push({ type: 'warning', message: `Buzzer "${b.id}" is not connected to anything.`, compIds: [b.id] })
    }
  })

  // Duplicate wire check
  const seen = new Set()
  wires.forEach(w => {
    const key = [w.from, w.to].sort().join('--')
    if (seen.has(key)) {
      errors.push({ type: 'warning', message: `Duplicate wire between ${w.from} and ${w.to}.`, compIds: [] })
    }
    seen.add(key)
  })

  return errors
}

// ─── WIRE COLORS by signal type ───────────────────────────────────────────────
const WIRE_COLOR = {
  '5V': '#ff4444', 'VCC': '#ff4444', 'V+': '#ff4444',
  'GND': '#333', 'VSS': '#333',
  'PWM': '#ffaa00',
  default: 'var(--accent)',
}
function wireColor(pinLabel) {
  return WIRE_COLOR[pinLabel] || WIRE_COLOR.default
}

const CATALOG = [
  { group: 'Boards', items: [
    { type: 'wokwi-arduino-uno', label: 'Arduino Uno', icon: '🟦', w: 200, h: 130 },
  ]},
  { group: 'Basic', items: [
    { type: 'wokwi-led',        label: 'LED',         icon: '💡', w: 30,  h: 60,  attrs: { color: 'red' } },
    { type: 'wokwi-resistor',   label: 'Resistor',    icon: '〰️', w: 80,  h: 30,  attrs: { value: '220' } },
    { type: 'wokwi-pushbutton', label: 'Push Button', icon: '🔘', w: 40,  h: 40 },
    { type: 'wokwi-buzzer',     label: 'Buzzer',      icon: '🔊', w: 50,  h: 50 },
  ]},
  { group: 'Actuators', items: [
    { type: 'wokwi-servo',      label: 'Servo',       icon: '⚙️', w: 80,  h: 50 },
    { type: 'wokwi-neopixel',   label: 'NeoPixel',    icon: '🌈', w: 30,  h: 30 },
  ]},
  { group: 'Display', items: [
    { type: 'wokwi-lcd1602',    label: 'LCD 1602',    icon: '📺', w: 160, h: 60 },
  ]},
]

let nextId = 1
let nextWireId = 1

// ─── BEZIER path between two points ──────────────────────────────────────────
function bezierPath(x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1)
  const cx = dx * 0.5
  return `M ${x1} ${y1} C ${x1 + cx} ${y1}, ${x2 - cx} ${y2}, ${x2} ${y2}`
}

export default function SimulatorPage() {
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()

  // Theme Logic
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark')
  
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  const [components,  setComponents]  = useState([])
  const [wires,       setWires]       = useState([])
  const [selected,    setSelected]    = useState(null)   // comp id
  const [wiringMode,  setWiringMode]  = useState(false)
  const [wireStart,   setWireStart]   = useState(null)   // { compId, pinId, pinLabel, x, y }
  const [mousePos,    setMousePos]    = useState({ x: 0, y: 0 })
  const [hoveredPin,  setHoveredPin]  = useState(null)
  const [board,       setBoard]       = useState('arduino_uno')
  const [codeTab,     setCodeTab]     = useState('code')
  const [code,        setCode]        = useState('void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n  delay(1000);\n}\n')
  const [validationErrors, setValidationErrors] = useState([])
  const [showValidation, setShowValidation] = useState(true)

  const canvasRef     = useRef(null)
  const svgRef        = useRef(null)
  const dragPayload   = useRef(null)
  const movingComp    = useRef(null)

  // ── Load Wokwi bundle ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!document.getElementById('wokwi-bundle')) {
      const s = document.createElement('script')
      s.id  = 'wokwi-bundle'
      s.src = 'https://unpkg.com/@wokwi/elements@0.48.3/dist/wokwi-elements.bundle.js'
      document.head.appendChild(s)
    }
  }, [])

  // ── Run validation whenever circuit changes ─────────────────────────────────
  useEffect(() => {
    setValidationErrors(validateCircuit(components, wires))
  }, [components, wires])

  // ── Error component IDs for highlighting ────────────────────────────────────
  const errorCompIds = useMemo(() =>
    new Set(validationErrors.flatMap(e => e.compIds)),
    [validationErrors]
  )

  // ── Get absolute pin position on canvas ────────────────────────────────────
  const getPinPos = useCallback((compId, pinId) => {
    const comp = components.find(c => c.id === compId)
    if (!comp) return null
    const pins = PIN_DEFS[comp.type] || []
    const pin  = pins.find(p => p.id === pinId)
    if (!pin) return null
    return { x: comp.x + pin.x, y: comp.y + pin.y }
  }, [components])

  // ── Palette drag start ──────────────────────────────────────────────────────
  const onPaletteDragStart = (e, item) => {
    dragPayload.current = item
    e.dataTransfer.effectAllowed = 'copy'
    const ghost = document.createElement('div')
    ghost.style.cssText = 'position:fixed;top:-999px;width:1px;height:1px'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
  }

  // ── Canvas drop ────────────────────────────────────────────────────────────
  const onCanvasDrop = useCallback((e) => {
    e.preventDefault()
    const item = dragPayload.current
    if (!item) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left - (item.w || 60) / 2
    const y = e.clientY - rect.top  - (item.h || 60) / 2
    setComponents(prev => [...prev, {
      id: `${item.type}_${nextId++}`,
      type: item.type, label: item.label,
      x: Math.max(8, x), y: Math.max(8, y),
      w: item.w || 60, h: item.h || 60,
      attrs: item.attrs || {},
    }])
    dragPayload.current = null
  }, [])

  // ── Move component ─────────────────────────────────────────────────────────
  const onCompMouseDown = useCallback((e, id) => {
    if (wiringMode) return
    e.stopPropagation()
    setSelected(id)
    const comp = components.find(c => c.id === id)
    movingComp.current = { id, sx: e.clientX, sy: e.clientY, cx: comp.x, cy: comp.y }
  }, [components, wiringMode])

  useEffect(() => {
    const onMove = (e) => {
      if (movingComp.current) {
        const { id, sx, sy, cx, cy } = movingComp.current
        setComponents(prev => prev.map(c =>
          c.id === id ? { ...c, x: Math.max(0, cx + e.clientX - sx), y: Math.max(0, cy + e.clientY - sy) } : c
        ))
      }
      // Track mouse for wire preview
      if (wireStart && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
      }
    }
    const onUp = () => { movingComp.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [wireStart])

  // ── Pin click — start or complete wire ─────────────────────────────────────
  const onPinClick = useCallback((e, compId, pinId, pinLabel) => {
    e.stopPropagation()
    if (!wiringMode) return

    const pos = getPinPos(compId, pinId)
    if (!pos) return

    if (!wireStart) {
      // Start wire
      setWireStart({ compId, pinId, pinLabel, ...pos })
    } else {
      // Complete wire — prevent self-loop
      if (wireStart.compId === compId && wireStart.pinId === pinId) {
        setWireStart(null)
        return
      }
      const newWire = {
        id:    `w${nextWireId++}`,
        from:  `${wireStart.compId}:${wireStart.pinId}`,
        to:    `${compId}:${pinId}`,
        fromLabel: wireStart.pinLabel,
        toLabel:   pinLabel,
        color: wireColor(wireStart.pinLabel),
      }
      setWires(prev => [...prev, newWire])
      setWireStart(null)
    }
  }, [wiringMode, wireStart, getPinPos])

  // ── Cancel wire on Escape / delete selected ─────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { setWireStart(null) }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected && !wiringMode) {
        setComponents(prev => prev.filter(c => c.id !== selected))
        setWires(prev => prev.filter(w => !w.from.startsWith(selected) && !w.to.startsWith(selected)))
        setSelected(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, wiringMode])

  const deleteWire = (id) => setWires(prev => prev.filter(w => w.id !== id))

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>

      {/* TOP BAR */}
      <header style={S.bar}>
        <button style={S.logo} onClick={() => navigate('/')}>⚡ OpenHW-Studio</button>
        <div style={S.barCenter}>
          <select style={S.sel} value={board} onChange={e => setBoard(e.target.value)}>
            <option value="arduino_uno">Arduino Uno</option>
            <option value="pico">Raspberry Pi Pico</option>
            <option value="esp32">ESP32</option>
          </select>
          <Btn color="var(--green)">▶ Run</Btn>
          <Btn>⏹ Stop</Btn>
          <Btn
            color={wiringMode ? 'var(--orange)' : undefined}
            onClick={() => { setWiringMode(v => !v); setWireStart(null) }}
            title="Toggle wiring mode (W)"
          >
            {wiringMode ? '✂ Exit Wiring' : '〰 Wire Mode'}
          </Btn>
          {selected && !wiringMode && (
            <Btn color="var(--red)" onClick={() => {
              setComponents(prev => prev.filter(c => c.id !== selected))
              setWires(prev => prev.filter(w => !w.from.startsWith(selected) && !w.to.startsWith(selected)))
              setSelected(null)
            }}>🗑 Delete</Btn>
          )}
          <Btn onClick={() => { setComponents([]); setWires([]); setSelected(null) }}>↺ Clear All</Btn>

          {/* THEME TOGGLE BUTTON */}
          <Btn onClick={toggleTheme} title="Toggle Dark/Light Mode">
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </Btn>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {isAuthenticated
            ? <><span style={S.userChip}>👤 {user?.name?.split(' ')[0]}</span><Btn>☁ Save</Btn></>
            : <Btn color="var(--accent)" onClick={() => navigate('/login')}>Sign In to Save</Btn>
          }
        </div>
      </header>

      {/* GUEST BANNER */}
      {!isAuthenticated && (
        <div style={S.guestBanner}>
          ⚠️ <strong>Guest Mode</strong> — No cloud save or progress tracking.
          <button style={S.bannerBtn} onClick={() => navigate('/login')}>Sign in →</button>
        </div>
      )}

      {/* WIRING MODE HINT */}
      {wiringMode && (
        <div style={{ ...S.guestBanner, background: 'rgba(255,170,0,.12)', borderColor: 'rgba(255,170,0,.3)', color: 'var(--orange)' }}>
          〰 <strong>Wiring Mode ON</strong> — Click a pin to start a wire, click another pin to connect. Press Esc to cancel.
          {wireStart && <span style={{ marginLeft: 12 }}>🔵 Started from <strong>{wireStart.compId} [{wireStart.pinLabel}]</strong> — click a destination pin</span>}
        </div>
      )}

      <div style={S.workspace}>

        {/* PALETTE */}
        <aside style={S.palette}>
          <div style={S.paletteHeader}>Components</div>
          <input style={S.paletteSearch} placeholder="🔍 Search..." />
          {CATALOG.map(group => (
            <div key={group.group}>
              <div style={S.groupName}>{group.group}</div>
              {group.items.map(item => (
                <div
                  key={item.type}
                  style={S.paletteItem}
                  draggable
                  onDragStart={e => onPaletteDragStart(e, item)}
                  title={`Drag to canvas to add ${item.label}`}
                >
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <span style={{ fontSize: 13, color: 'var(--text2)' }}>{item.label}</span>
                </div>
              ))}
            </div>
          ))}
          <div style={S.paletteTip}>
            Drag → drop to place<br />
            Click <em>Wire Mode</em> then click pins to connect<br />
            Del key removes selected
          </div>
        </aside>

        {/* CANVAS + SVG WIRE LAYER */}
        <main
          style={{ ...S.canvas, cursor: wiringMode ? 'crosshair' : 'default' }}
          ref={canvasRef}
          onDrop={onCanvasDrop}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
          onClick={() => { if (!wiringMode) setSelected(null) }}
          onMouseMove={e => {
            if (wireStart && canvasRef.current) {
              const r = canvasRef.current.getBoundingClientRect()
              setMousePos({ x: e.clientX - r.left, y: e.clientY - r.top })
            }
          }}
        >
          {/* SVG layer for wires */}
          <svg
            ref={svgRef}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}
          >
            <defs>
              <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                <path d="M 0 0 L 6 3 L 0 6 z" fill="var(--accent)" opacity="0.6" />
              </marker>
            </defs>

            {/* Placed wires */}
            {wires.map(w => {
              const fromParts = w.from.split(':')
              const toParts   = w.to.split(':')
              const p1 = getPinPos(fromParts[0], fromParts[1])
              const p2 = getPinPos(toParts[0],   toParts[1])
              if (!p1 || !p2) return null
              return (
                <g key={w.id} style={{ pointerEvents: 'all', cursor: 'pointer' }} onClick={() => deleteWire(w.id)}>
                  {/* Shadow for click hitbox */}
                  <path
                    d={bezierPath(p1.x, p1.y, p2.x, p2.y)}
                    stroke="transparent" strokeWidth={12} fill="none"
                  />
                  <path
                    d={bezierPath(p1.x, p1.y, p2.x, p2.y)}
                    stroke={w.color}
                    strokeWidth={2.5}
                    fill="none"
                    strokeLinecap="round"
                    opacity={0.9}
                  />
                  {/* Dots at ends */}
                  <circle cx={p1.x} cy={p1.y} r={4} fill={w.color} />
                  <circle cx={p2.x} cy={p2.y} r={4} fill={w.color} />
                </g>
              )
            })}

            {/* Preview wire while drawing */}
            {wireStart && (
              <path
                d={bezierPath(wireStart.x, wireStart.y, mousePos.x, mousePos.y)}
                stroke="var(--orange)"
                strokeWidth={2}
                strokeDasharray="6 4"
                fill="none"
                strokeLinecap="round"
                opacity={0.8}
              />
            )}
          </svg>

          {/* Empty state */}
          {components.length === 0 && (
            <div style={S.emptyState}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🔌</div>
              <p style={{ fontSize: 16, marginBottom: 8 }}>Drag components from the left panel</p>
              <p style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace' }}>
                Arduino Uno · LED · Resistor · Button · Servo · LCD
              </p>
            </div>
          )}

          {/* Components */}
          {components.map(comp => {
            const pins = PIN_DEFS[comp.type] || []
            const hasError = errorCompIds.has(comp.id)
            const isSelected = selected === comp.id
            return (
              <div
                key={comp.id}
                style={{
                  position: 'absolute',
                  left: comp.x, top: comp.y,
                  width: comp.w, height: comp.h,
                  cursor: wiringMode ? 'crosshair' : 'move',
                  zIndex: isSelected ? 5 : 2,
                  userSelect: 'none',
                }}
                onMouseDown={e => onCompMouseDown(e, comp.id)}
              >
                {/* Selection ring */}
                {isSelected && !wiringMode && (
                  <div style={{
                    position: 'absolute', inset: -6, borderRadius: 8,
                    border: '2px solid var(--accent)',
                    boxShadow: '0 0 16px var(--glow)',
                    pointerEvents: 'none', zIndex: 10,
                    animation: 'none',
                  }} />
                )}
                {/* Error ring */}
                {hasError && (
                  <div style={{
                    position: 'absolute', inset: -6, borderRadius: 8,
                    border: '2px solid var(--red)',
                    boxShadow: '0 0 16px rgba(255,68,68,.4)',
                    pointerEvents: 'none', zIndex: 10,
                  }} />
                )}

                {/* Wokwi element */}
                <div
                  style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
                  dangerouslySetInnerHTML={{
                    __html: `<${comp.type} ${Object.entries(comp.attrs).map(([k,v]) => `${k}="${v}"`).join(' ')}></${comp.type}>`,
                  }}
                />

                {/* Pins */}
                {pins.map(pin => {
                  const isHovered = hoveredPin === `${comp.id}:${pin.id}`
                  const isWireStartPin = wireStart?.compId === comp.id && wireStart?.pinId === pin.id
                  return (
                    <div
                      key={pin.id}
                      title={`${pin.label} — click to wire`}
                      style={{
                        position: 'absolute',
                        left: pin.x - 6, top: pin.y - 6,
                        width: 12, height: 12,
                        borderRadius: '50%',
                        background: isWireStartPin ? 'var(--orange)'
                                  : isHovered      ? 'var(--accent)'
                                  :                  'var(--card)',
                        border: `2px solid ${isWireStartPin ? 'var(--orange)' : isHovered ? 'var(--accent)' : 'var(--border)'}`,
                        cursor: wiringMode ? 'crosshair' : 'default',
                        zIndex: 20,
                        opacity: wiringMode ? 1 : 0.5,
                        transition: 'all .1s',
                        boxShadow: isHovered || isWireStartPin ? '0 0 8px var(--glow)' : 'none',
                      }}
                      onMouseEnter={() => setHoveredPin(`${comp.id}:${pin.id}`)}
                      onMouseLeave={() => setHoveredPin(null)}
                      onClick={e => onPinClick(e, comp.id, pin.id, pin.label)}
                    >
                      {/* Pin label tooltip */}
                      {isHovered && (
                        <div style={{
                          position: 'absolute', bottom: 14, left: '50%',
                          transform: 'translateX(-50%)',
                          background: 'var(--bg2)', border: '1px solid var(--border)',
                          color: 'var(--accent)', padding: '2px 6px', borderRadius: 4,
                          fontSize: 10, whiteSpace: 'nowrap', zIndex: 100,
                          fontFamily: 'JetBrains Mono, monospace',
                          pointerEvents: 'none',
                        }}>
                          {pin.label}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Component label */}
                <div style={{
                  position: 'absolute', bottom: -18, left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: 10, color: hasError ? 'var(--red)' : 'var(--text3)',
                  whiteSpace: 'nowrap', fontFamily: 'JetBrains Mono, monospace',
                  pointerEvents: 'none',
                }}>
                  {comp.label}
                </div>
              </div>
            )
          })}
        </main>

        {/* RIGHT PANEL */}
        <aside style={S.rightPanel}>
          {/* Validation panel */}
          {validationErrors.length > 0 && showValidation && (
            <div style={S.validationPanel}>
              <div style={S.validationHeader}>
                <span>⚠ Validation ({validationErrors.length})</span>
                <button style={S.closeBtn} onClick={() => setShowValidation(false)}>✕</button>
              </div>
              {validationErrors.map((err, i) => (
                <div key={i} style={{
                  ...S.validationItem,
                  borderLeftColor: err.type === 'error' ? 'var(--red)' : 'var(--orange)',
                }}>
                  <span style={{ color: err.type === 'error' ? 'var(--red)' : 'var(--orange)' }}>
                    {err.type === 'error' ? '🔴' : '🟡'} {err.message}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Wires list */}
          {wires.length > 0 && (
            <div style={S.wiresList}>
              <div style={S.wiresHeader}>Connections ({wires.length})</div>
              {wires.map(w => (
                <div key={w.id} style={S.wireItem}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: w.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 10, color: 'var(--text2)', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {w.from} → {w.to}
                  </span>
                  <button style={S.wireDelete} onClick={() => deleteWire(w.id)}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Code editor */}
          <div style={S.codePanel}>
            <div style={S.codeTabs}>
              {['code', 'blocks', 'serial'].map(t => (
                <button
                  key={t}
                  style={{ ...S.codeTab, ...(codeTab === t ? S.codeTabActive : {}) }}
                  onClick={() => setCodeTab(t)}
                >
                  {t === 'code' ? '{ } Code' : t === 'blocks' ? '🧩 Blocks' : '📟 Serial'}
                </button>
              ))}
            </div>
            {codeTab === 'code' && (
              <textarea
                style={S.codeEditor}
                value={code}
                onChange={e => setCode(e.target.value)}
                spellCheck={false}
              />
            )}
            {codeTab === 'blocks' && (
              <div style={S.codePlaceholder}>
                <div style={{ fontSize: 32 }}>🧩</div>
                <p>Blockly editor</p>
                <p style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>Integrate Blockly.js here</p>
              </div>
            )}
            {codeTab === 'serial' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={S.serialOutput}>
                  <span style={{ color: 'var(--green)', display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                    [Serial Monitor Ready]
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, padding: 8, borderTop: '1px solid var(--border)' }}>
                  <input style={S.serialInput} placeholder="Send message..." />
                  <Btn color="var(--accent)">Send</Btn>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

// ─── Tiny button component (Updated to support CSS Variables) ───────────────
function Btn({ children, onClick, color, title }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: color ? (hov ? color : 'transparent') : hov ? 'var(--border)' : 'var(--card)',
        border: `1px solid ${color || 'var(--border)'}`,
        color: color ? (hov ? '#fff' : color) : 'var(--text)',
        padding: '7px 14px', borderRadius: 8,
        fontFamily: 'Space Grotesk, sans-serif', fontSize: 13,
        cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap',
        fontWeight: color ? 700 : 500,
      }}
    >
      {children}
    </button>
  )
}

// ─── Styles (Refactored to map strictly to CSS variables) ───────────────────────
const S = {
  page:    { display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden', background:'var(--bg)', fontFamily:"'Space Grotesk',sans-serif", color:'var(--text)' },
  bar:     { display:'flex', alignItems:'center', gap:10, padding:'10px 16px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0, flexWrap:'wrap' },
  logo:    { background:'none', border:'none', color:'var(--accent)', fontSize:16, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 },
  barCenter: { display:'flex', alignItems:'center', gap:8, flex:1, flexWrap:'wrap' },
  sel:     { background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)', padding:'7px 12px', borderRadius:8, fontFamily:'inherit', fontSize:13, cursor:'pointer' },
  userChip:{ background:'var(--card)', border:'1px solid var(--border)', padding:'7px 12px', borderRadius:8, fontSize:13, color:'var(--text2)' },
  guestBanner: { background:'rgba(255,145,0,.1)', borderBottom:'1px solid rgba(255,145,0,.25)', color:'var(--orange)', padding:'8px 20px', fontSize:13, display:'flex', alignItems:'center', gap:12, flexShrink:0 },
  bannerBtn:   { background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:13, textDecoration:'underline', fontFamily:'inherit' },
  workspace:   { display:'flex', flex:1, overflow:'hidden' },

  palette:      { width:182, background:'var(--bg2)', borderRight:'1px solid var(--border)', overflowY:'auto', padding:'10px 8px', display:'flex', flexDirection:'column', gap:2, flexShrink:0 },
  paletteHeader:{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.1em', padding:'4px 8px 8px' },
  paletteSearch:{ background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)', padding:'7px 10px', borderRadius:8, fontFamily:'inherit', fontSize:12, width:'100%', marginBottom:8, outline:'none' },
  groupName:    { fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', padding:'4px 8px' },
  paletteItem:  { display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, cursor:'grab', transition:'all .15s', border:'1px solid transparent', userSelect:'none' },
  paletteTip:   { marginTop:'auto', padding:'10px 8px', fontSize:11, color:'var(--text3)', lineHeight:1.6 },

  canvas: {
    flex:1, position:'relative', overflow:'hidden',
    backgroundColor:'var(--canvas-bg)',
    backgroundImage:'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
    backgroundSize:'24px 24px',
  },
  emptyState: { position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'var(--text3)', textAlign:'center', pointerEvents:'none' },

  rightPanel: { width:280, background:'var(--bg2)', borderLeft:'1px solid var(--border)', display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' },

  validationPanel: { background:'var(--bg3)', borderBottom:'1px solid var(--border)', flexShrink:0 },
  validationHeader:{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', fontSize:12, fontWeight:700, color:'var(--orange)' },
  closeBtn:        { background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:14, fontFamily:'inherit' },
  validationItem:  { padding:'6px 12px', fontSize:12, borderLeft:'3px solid', marginBottom:2, lineHeight:1.5 },

  wiresList:   { background:'var(--bg3)', borderBottom:'1px solid var(--border)', maxHeight:140, overflowY:'auto', flexShrink:0 },
  wiresHeader: { fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.08em', padding:'8px 12px 4px' },
  wireItem:    { display:'flex', alignItems:'center', gap:8, padding:'4px 12px', borderBottom:'1px solid var(--border)' },
  wireDelete:  { background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:12, fontFamily:'inherit', flexShrink:0 },

  codePanel:    { flex:1, display:'flex', flexDirection:'column', overflow:'hidden' },
  codeTabs:     { display:'flex', borderBottom:'1px solid var(--border)', flexShrink:0 },
  codeTab:      { flex:1, padding:'10px 4px', background:'none', border:'none', color:'var(--text3)', fontFamily:'inherit', fontSize:12, cursor:'pointer', borderBottom:'2px solid transparent', transition:'all .15s' },
  codeTabActive:{ color:'var(--accent)', borderBottomColor:'var(--accent)' },
  codeEditor:   { flex:1, background:'var(--bg)', color:'var(--text)', border:'none', outline:'none', padding:14, fontFamily:"'JetBrains Mono',monospace", fontSize:12, lineHeight:1.7, resize:'none' },
  codePlaceholder: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'var(--text3)', gap:8 },
  serialOutput:    { flex:1, background:'var(--bg)', padding:12, overflowY:'auto' },
  serialInput:     { flex:1, background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)', padding:'7px 10px', borderRadius:8, fontFamily:'inherit', fontSize:12, outline:'none' },
}