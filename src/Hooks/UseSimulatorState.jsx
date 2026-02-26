import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { PIN_DEFS } from '../Utils/PinDef.jsx'
import { validateCircuit } from '../Utils/ValidateCircuit.jsx'
import { wireColor } from '../Utils/WireUtils.jsx'

export function useSimulatorState() {
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
  const [boardPos,    setBoardPos]    = useState({ x: 0, y: 0 })

  const canvasRef     = useRef(null)
  const svgRef        = useRef(null)
  const dragPayload   = useRef(null)
  const movingComp    = useRef(null)
  const movingBoard   = useRef(null)
  const nextId        = useRef(1)
  const nextWireId    = useRef(1)

  useEffect(() => {
    if (!document.getElementById('wokwi-bundle')) {
      const s = document.createElement('script')
      s.id  = 'wokwi-bundle'
      s.src = 'https://unpkg.com/@wokwi/elements@latest/dist/wokwi-elements.bundle.js'
      s.onload = () => console.log('Wokwi elements loaded')
      s.onerror = () => console.error('Failed to load Wokwi bundle')
      document.head.appendChild(s)
    }
  }, [])

  useEffect(() => {
    setValidationErrors(validateCircuit(components, wires))
  }, [components, wires])

  const errorCompIds = useMemo(() =>
    new Set(validationErrors.flatMap(e => e.compIds)),
    [validationErrors]
  )

  const getPinPos = useCallback((compId, pinId) => {
    // Handle board pins
    if (compId === 'board') {
      const boardTypeMap = {
        arduino_uno: 'wokwi-arduino-uno',
        pico: 'wokwi-raspberry-pi-pico',
        esp32: 'wokwi-esp32-devkit-v1',
      }
      const pins = PIN_DEFS[boardTypeMap[board]] || []
      const pin  = pins.find(p => p.id === pinId)
      if (!pin) return null
      return { x: boardPos.x + pin.x, y: boardPos.y + pin.y }
    }
    // Handle component pins
    const comp = components.find(c => c.id === compId)
    if (!comp) return null
    const pins = PIN_DEFS[comp.type] || []
    const pin  = pins.find(p => p.id === pinId)
    if (!pin) return null
    return { x: comp.x + pin.x, y: comp.y + pin.y }
  }, [components, board, boardPos])

  const onPaletteDragStart = (e, item) => {
    dragPayload.current = item
    e.dataTransfer.effectAllowed = 'copy'
    const ghost = document.createElement('div')
    ghost.style.cssText = 'position:fixed;top:-999px;width:1px;height:1px'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
  }

  const onCanvasDrop = useCallback((e) => {
    e.preventDefault()
    const item = dragPayload.current
    if (!item) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left - (item.w || 60) / 2
    const y = e.clientY - rect.top  - (item.h || 60) / 2
    setComponents(prev => [...prev, {
      id: `${item.type}_${nextId.current++}`,
      type: item.type, label: item.label,
      x: Math.max(8, x), y: Math.max(8, y),
      w: item.w || 60, h: item.h || 60,
      attrs: item.attrs || {},
    }])
    dragPayload.current = null
  }, [])

  const onCompMouseDown = useCallback((e, id) => {
    if (wiringMode) return
    e.stopPropagation()
    setSelected(id)
    const comp = components.find(c => c.id === id)
    movingComp.current = { id, sx: e.clientX, sy: e.clientY, cx: comp.x, cy: comp.y }
  }, [components, wiringMode])

  const onBoardMouseDown = useCallback((e) => {
    if (wiringMode) return
    e.stopPropagation()
    setSelected(null)
    movingBoard.current = { sx: e.clientX, sy: e.clientY, cx: boardPos.x, cy: boardPos.y }
  }, [wiringMode, boardPos])
  useEffect(() => {
    const onMove = (e) => {
      if (movingComp.current) {
        const { id, sx, sy, cx, cy } = movingComp.current
        setComponents(prev => prev.map(c =>
          c.id === id ? { ...c, x: Math.max(0, cx + e.clientX - sx), y: Math.max(0, cy + e.clientY - sy) } : c
        ))
      }
      if (movingBoard.current) {
        const { sx, sy, cx, cy } = movingBoard.current
        setBoardPos({ x: Math.max(0, cx + e.clientX - sx), y: Math.max(0, cy + e.clientY - sy) })
      }
      // Track mouse for wire preview
      if (wireStart && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
      }
    }
    const onUp = () => { movingComp.current = null; movingBoard.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [wireStart])

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
        id:    `w${nextWireId.current++}`,
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

  const onCanvasClick = () => {
    if (!wiringMode) setSelected(null)
  }

  const onCanvasMouseMove = (e) => {
    if (wireStart && canvasRef.current) {
      const r = canvasRef.current.getBoundingClientRect()
      setMousePos({ x: e.clientX - r.left, y: e.clientY - r.top })
    }
  }

  return {
    components, setComponents,
    wires, setWires,
    selected, setSelected,
    wiringMode, setWiringMode,
    wireStart, setWireStart,
    mousePos,
    hoveredPin, setHoveredPin,
    board, setBoard,
    boardPos, setBoardPos,
    codeTab, setCodeTab,
    code, setCode,
    validationErrors, setValidationErrors,
    showValidation, setShowValidation,
    canvasRef, svgRef,
    errorCompIds,
    getPinPos,
    onPaletteDragStart,
    onCanvasDrop,
    onCompMouseDown,
    onBoardMouseDown,
    onPinClick,
    deleteWire,
    onCanvasClick,
    onCanvasMouseMove,
  }
}