import React, { useState } from 'react';

// ─── Tiny button component ───────────────
export function Btn({ children, onClick, color, title, disabled, iconOnly }) {
  const [hov, setHov] = useState(false)
  const [clicked, setClicked] = useState(false)
  const isInteractive = !disabled && hov;

  const handleClick = () => {
    if (disabled) return;
    setClicked(true);
    setTimeout(() => setClicked(false), 280);
    onClick?.();
  };

  return (
    <button
      title={title}
      onClick={handleClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: disabled ? 'transparent' : (color ? (isInteractive ? color : 'transparent') : isInteractive ? 'var(--border)' : 'var(--card)'),
        border: '1px solid ' + (color || 'var(--border)'),
        color: disabled ? 'var(--text3)' : (color ? (isInteractive ? '#fff' : color) : 'var(--text)'),
        padding: iconOnly ? '7px 10px' : '7px 14px', borderRadius: 8,
        fontFamily: 'Space Grotesk, sans-serif', fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s, color 0.15s, border-color 0.15s, opacity 0.15s',
        whiteSpace: 'nowrap',
        fontWeight: color ? 700 : 500,
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        animation: clicked ? 'toolbtn-pop 0.26s ease' : 'none',
      }}
    >
      {children}
    </button>
  )
}
