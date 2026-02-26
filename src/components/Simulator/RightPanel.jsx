import React, { useState, useRef } from 'react'
import { S } from './styles.js'
import ValidationPanel from './ValidationPanel.jsx'
import CodePanel from './CodePanel.jsx'
import Btn from './Btn.jsx'

export default function RightPanel({
  validationErrors,
  showValidation,
  setShowValidation,
  wires,
  deleteWire,
  codeTab,
  setCodeTab,
  code,
  setCode,
}) {
  const [codeHeight, setCodeHeight] = useState(300)
  const startRef = useRef(null)

  const beginResize = e => {
    e.preventDefault()
    startRef.current = { startY: e.clientY, startH: codeHeight }
    const onMouseMove = ev => {
      const delta = ev.clientY - startRef.current.startY
      setCodeHeight(Math.max(100, startRef.current.startH - delta))
    }
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  return (
    <aside style={{ ...S.rightPanel, width: '100%' }}>
      <ValidationPanel
        validationErrors={validationErrors}
        showValidation={showValidation}
        setShowValidation={setShowValidation}
      />

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

      {/* horizontal drag handle above code panel */}
      <div
        style={{ height: 4, cursor: 'row-resize', background: 'var(--border)', flexShrink: 0 }}
        onMouseDown={beginResize}
      />

      <div style={{ height: codeHeight, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <CodePanel
          codeTab={codeTab}
          setCodeTab={setCodeTab}
          code={code}
          setCode={setCode}
        />
      </div>
    </aside>
  )
}