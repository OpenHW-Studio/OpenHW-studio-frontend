import React, { useState } from 'react'
import Btn from './Btn.jsx'
import { S } from './styles.js'

// The simulator-specific top bar with board selector, controls and theme toggle.
export default function TopBar({ sim }) {
  const {
    board, setBoard,
    wiringMode, setWiringMode,
    selected,
    setComponents,
    setWires,
    setSelected,
  } = sim

  // theme toggle logic (kept here to reduce page-level state)
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'dark'
  )
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  return (
    <header style={S.bar}>
      <div style={S.barCenter}>
        <select
          style={S.sel}
          value={board}
          onChange={e => setBoard(e.target.value)}
        >
          <option value="arduino_uno">Arduino Uno</option>
          <option value="pico">Raspberry Pi Pico</option>
          <option value="esp32">ESP32</option>
        </select>
        <Btn color="var(--green)">▶ Run</Btn>
        <Btn>⏹ Stop</Btn>
        <Btn
          color={wiringMode ? 'var(--orange)' : undefined}
          onClick={() => {
            setWiringMode(v => !v)
            sim.setWireStart(null)
          }}
          title="Toggle wiring mode (W)"
        >
          {wiringMode ? '✂ Exit Wiring' : '〰 Wire Mode'}
        </Btn>
        {selected && !wiringMode && (
          <Btn
            color="var(--red)"
            onClick={() => {
              setComponents(prev => prev.filter(c => c.id !== selected))
              setWires(prev =>
                prev.filter(
                  w => !w.from.startsWith(selected) && !w.to.startsWith(selected)
                )
              )
              setSelected(null)
            }}
          >
            🗑 Delete
          </Btn>
        )}
        <Btn
          onClick={() => {
            setComponents([])
            setWires([])
            setSelected(null)
          }}
        >
          ↺ Clear All
        </Btn>

        {/* THEME TOGGLE BUTTON */}
        <Btn onClick={toggleTheme} title="Toggle Dark/Light Mode">
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </Btn>
      </div>
    </header>
  )
}
