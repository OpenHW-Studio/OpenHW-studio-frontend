import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

import { useSimulatorState } from '../Hooks/UseSimulatorState.jsx'
import { CATALOG } from '../Utils/Catalog.jsx'

import Palette from '../components/Simulator/Palette.jsx'
import Canvas from '../components/Simulator/Canvas.jsx'
import RightPanel from '../components/Simulator/RightPanel.jsx'
import TopBar from '../components/Simulator/TopBar.jsx'
import { S } from '../components/Simulator/styles.js'

export default function SimulatorPage() {
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const sim = useSimulatorState()
  const {
    board, setBoard,
    wiringMode, setWiringMode,
    selected,
    validationErrors, showValidation, setShowValidation,
  } = sim

  const [paletteWidth, setPaletteWidth] = useState(182)
  const [rightWidth, setRightWidth] = useState(280)
  const paletteRef = React.useRef(null)
  const rightRef = React.useRef(null)

  const startDrag = (e, type) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = type === 'left' ? paletteWidth : rightWidth
    const onMouseMove = ev => {
      const delta = ev.clientX - startX
      if (type === 'left') setPaletteWidth(Math.max(100, startW + delta))
      else setRightWidth(Math.max(100, startW - delta))
    }
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  return (
    <div style={S.page}>
      <TopBar sim={sim} />

      {!isAuthenticated && (
        <div style={S.guestBanner}>
          ⚠️ <strong>Guest Mode</strong> — No cloud save or progress tracking.
          <button style={S.bannerBtn} onClick={() => navigate('/login')}>Sign in →</button>
        </div>
      )}

      {wiringMode && (
        <div style={{ ...S.guestBanner, background: 'rgba(255,170,0,.12)', borderColor: 'rgba(255,170,0,.3)', color: 'var(--orange)' }}>
          〰 <strong>Wiring Mode ON</strong> — Click a pin to start a wire, click another pin to connect. Press Esc to cancel.
          {sim.wireStart && <span style={{ marginLeft: 12 }}>🔵 Started from <strong>{sim.wireStart.compId} [{sim.wireStart.pinLabel}]</strong> — click a destination pin</span>}
        </div>
      )}

      <div style={S.workspace}>
        <div ref={paletteRef} style={{ ...S.palette, width: paletteWidth }}>
          <Palette catalog={CATALOG} onPaletteDragStart={sim.onPaletteDragStart} />
        </div>
        <div
          style={{ width: 4, cursor: 'col-resize', background: 'var(--border)', flexShrink: 0 }}
          onMouseDown={e => startDrag(e, 'left')}
        />

        <Canvas {...sim} />

        <div
          style={{ width: 4, cursor: 'col-resize', background: 'var(--border)', flexShrink: 0 }}
          onMouseDown={e => startDrag(e, 'right')}
        />

        <div ref={rightRef} style={{ width: rightWidth, flexShrink: 0 }}>
          <RightPanel {...sim} />
        </div>
      </div>
    </div>
  )
}
