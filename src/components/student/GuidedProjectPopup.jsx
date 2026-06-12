import { useState, useRef, useCallback, useEffect } from 'react'
import { X, GripHorizontal, Microchip, CircuitBoard, Code, FlaskConical, Lightbulb, Cpu } from 'lucide-react'

const BOARD_OPTIONS = [
  { key: 'arduino', label: 'Arduino Uno', icon: CircuitBoard },
  { key: 'raspberrypi', label: 'Raspberry Pi', icon: Cpu },
  { key: 'esp32', label: 'ESP32', icon: Microchip },
]

export default function GuidedProjectPopup({ project, levelColor, onClose, readOnly, schemas, activeBoard, onBoardChange }) {
  const popupRef = useRef(null)
  const [pos, setPos] = useState({ x: 40, y: 60 })
  const [drag, setDrag] = useState({ active: false, offsetX: 0, offsetY: 0 })

  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('.popup-no-drag')) return
    setDrag({
      active: true,
      offsetX: e.clientX - pos.x,
      offsetY: e.clientY - pos.y,
    })
  }, [pos])

  useEffect(() => {
    if (!drag.active) return
    const handleMouseMove = (e) => {
      setPos({ x: e.clientX - drag.offsetX, y: e.clientY - drag.offsetY })
    }
    const handleMouseUp = () => setDrag({ ...drag, active: false })
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [drag])

  const explanation = project.description
    ? `This project demonstrates ${project.description.charAt(0).toLowerCase() + project.description.slice(1)}. The code configures the board in the setup() function and runs the main logic repeatedly in the loop() function.`
    : ''

  return (
    <div
      ref={popupRef}
      className="guided-popup"
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 10000,
        width: 420,
        maxHeight: '90vh',
        background: '#ffffff',
        borderRadius: 16,
        boxShadow: '0 25px 60px rgba(15,23,42,0.2), 0 0 0 1px rgba(15,23,42,0.05)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'grab',
          borderBottom: '1px solid #f1f5f9',
          userSelect: 'none',
        }}
      >
        <GripHorizontal size={16} color="#94a3b8" />
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
          flexShrink: 0,
        }}>
          <Microchip size={16} color="#fff" strokeWidth={2.5} />
        </div>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
          {readOnly ? 'Mission Brief' : 'Project Details'}
        </span>
        <button
          className="popup-no-drag"
          onClick={onClose}
          style={{
            background: 'transparent', border: 'none',
            borderRadius: 8, width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#94a3b8',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#475569' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: '#eff6ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Microchip size={22} color="#2563eb" strokeWidth={2} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              {readOnly ? 'Mission Objective' : 'Project'}
            </div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a', lineHeight: 1.3, letterSpacing: '-0.02em' }}>
              {project.title}
            </h3>
          </div>
        </div>

        {/* How It Works */}
        <div style={{
          background: '#f8fafc',
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Lightbulb size={13} strokeWidth={2.5} /> How It Works
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.7 }}>
            {project.description}
          </p>
        </div>

        {/* Board Selector */}
        {schemas && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Target Board
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {BOARD_OPTIONS.map(({ key, label, icon: Icon }) => {
                const hasSchema = schemas[key] != null
                const isActive = activeBoard === key
                return (
                  <button
                    key={key}
                    className="popup-no-drag"
                    onClick={() => hasSchema && onBoardChange?.(key, schemas[key])}
                    disabled={!hasSchema}
                    title={!hasSchema ? 'Schema not available yet' : `Switch to ${label}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 14px', borderRadius: 8,
                      fontSize: 12, fontWeight: 600,
                      border: isActive ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                      background: isActive ? '#eff6ff' : '#ffffff',
                      color: isActive ? '#2563eb' : hasSchema ? '#475569' : '#cbd5e1',
                      cursor: hasSchema ? 'pointer' : 'not-allowed',
                      opacity: hasSchema ? 1 : 0.5,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (hasSchema && !isActive) { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.background = '#f8fafc' } }}
                    onMouseLeave={e => { if (!isActive) { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#ffffff' } }}
                  >
                    <Icon size={14} strokeWidth={2} />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Tags */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 100,
            color: '#2563eb', background: '#eff6ff',
          }}>
            <CircuitBoard size={12} strokeWidth={2.5} />
            {project.board}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 100,
            color: '#64748b', background: '#f1f5f9',
          }}>
            <FlaskConical size={12} strokeWidth={2.5} />
            {project.components.length} components
          </div>
        </div>

        {/* Components */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CircuitBoard size={13} strokeWidth={2.5} /> Required Components
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {project.components.map((comp, i) => (
              <span key={i} style={{
                fontSize: 11, fontWeight: 500, padding: '5px 12px', borderRadius: 8,
                background: '#f8fafc', border: '1px solid #f1f5f9',
                color: '#475569',
              }}>
                {comp}
              </span>
            ))}
          </div>
        </div>

        {/* Code Explanation */}
        {explanation && (
          <div style={{
            background: '#eff6ff',
            borderRadius: 12,
            padding: '14px 16px',
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Lightbulb size={13} strokeWidth={2.5} /> Code Explanation
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.7 }}>
              {explanation}
            </p>
          </div>
        )}

        {/* Source Code */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Code size={13} strokeWidth={2.5} /> Source Code
          </div>
          <pre style={{
            fontSize: 11, lineHeight: 1.7, fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            background: '#0f172a', borderRadius: 12, padding: 16,
            overflowX: 'auto', color: '#94a3b8',
            maxHeight: 180,
            whiteSpace: 'pre',
            tabSize: 2,
            margin: 0,
          }}>
            <code>{project.code}</code>
          </pre>
        </div>
      </div>
    </div>
  )
}
