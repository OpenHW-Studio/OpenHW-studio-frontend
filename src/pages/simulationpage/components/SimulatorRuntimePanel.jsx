import React from 'react';

function SimulatorRuntimePanelBase({
  isRunning,
  isCompiling,
  isPaused,
  runDurationSec,
  simulationSpeedPercent,
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
        background: 'rgba(25, 25, 25, 0.65)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '10px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
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

      <div style={{ width: '1px', height: '12px', background: 'rgba(255, 255, 255, 0.1)' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 14 4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" />
          </svg>
        </div>
        <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)', fontSize: '11px', fontWeight: 700, minWidth: '35px' }}>
          {simulationSpeedPercent}%
        </span>
      </div>

      {isPaused && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(245, 158, 11, 0.15)', borderRadius: '10px', border: '1px solid var(--orange)', zIndex: -1, animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
      )}
    </div>
  );
}

export const SimulatorRuntimePanel = React.memo(SimulatorRuntimePanelBase);