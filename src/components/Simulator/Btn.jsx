import React, { useState } from 'react'

export default function Btn({ children, onClick, color, title }) {
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