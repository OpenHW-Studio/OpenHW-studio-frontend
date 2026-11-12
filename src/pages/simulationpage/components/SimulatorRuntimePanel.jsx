import React from 'react';

function SimulatorRuntimePanelBase({
  isRunning,
  isCompiling,
  isPaused,
  runDurationSec,
  simulationSpeedPercent,
  measuredSpeed,
  formatRunDuration,
}) {
  if (!isRunning || isCompiling) return null;

  return (
    <div
      data-export-ignore="true"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 14,
        left: 14,
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        // Theme-aware translucent surface (was hardcoded dark — unreadable
        // in light mode). color-mix tracks var(--bg2) across themes.
        background: 'color-mix(in srgb, var(--bg2) 82%, transparent)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        padding: '6px 12px',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ color: 'var(--text3)', display: 'flex', alignItems: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 2h4" /><path d="M12 14v-4" /><path d="M4 13a8 8 0 0 1 8-7 8 8 0 1 1-5.3 14L4 17.6V13z" />
          </svg>
        </div>
        <span style={{ color: 'var(--text)', fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.02em', minWidth: '65px' }}>
          {formatRunDuration(runDurationSec)}
        </span>
      </div>

      <div style={{ width: '1px', height: '12px', background: 'var(--border)' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 14 4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" />
          </svg>
        </div>
        <span
          style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)', fontSize: '11px', fontWeight: 700, minWidth: '35px', position: 'relative', cursor: 'default' }}
          onMouseEnter={(e) => {
            try {
              const tip = e.currentTarget.querySelector('[data-pace-tip]');
              if (tip) tip.style.display = 'block';
            } catch { /* ignore */ }
          }}
          onMouseLeave={(e) => {
            try {
              const tip = e.currentTarget.querySelector('[data-pace-tip]');
              if (tip) tip.style.display = 'none';
            } catch { /* ignore */ }
          }}
        >
          {measuredSpeed === null ? `${simulationSpeedPercent}%` : `${measuredSpeed.label}%`}
          {measuredSpeed !== null && (
            <span
              data-pace-tip
              style={{
                display: 'none', position: 'absolute', top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
                background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px',
                padding: '6px 10px', fontSize: '10px', fontWeight: 500, whiteSpace: 'pre-line', textAlign: 'left',
                boxShadow: '0 4px 16px rgba(0,0,0,0.35)', zIndex: 200, pointerEvents: 'none', minWidth: 'max-content',
              }}
            >
              {measuredSpeed.title}
            </span>
          )}
        </span>
      </div>

      {isPaused && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(245, 158, 11, 0.15)', borderRadius: '10px', border: '1px solid var(--orange)', zIndex: -1, animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
      )}
    </div>
  );
}

export const SimulatorRuntimePanel = React.memo(SimulatorRuntimePanelBase);