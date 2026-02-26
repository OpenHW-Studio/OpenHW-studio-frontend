import React from 'react'
import { S } from './styles.js'

export default function ValidationPanel({ validationErrors, showValidation, setShowValidation }) {
  if (!showValidation || validationErrors.length === 0) return null

  return (
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
  )
}
