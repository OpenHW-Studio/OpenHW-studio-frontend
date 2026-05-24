/**
 * SimulatorWorkspace.jsx  —  src/esp32/components/SimulatorWorkspace.jsx
 *
 * The top-level ESP32 simulation UI panel.
 * Rendered by SimulatorPage when `board === 'esp32'` and a session is running.
 *
 * Props:
 *   isRunning    {boolean}
 *   isCompiling  {boolean}
 *   pinStates    {object}   { [pinNumber]: 0|1 }
 *   serialHistory {Array}   [{ dir, text, ts }]
 *   onRun        {function} () => void
 *   onStop       {function} () => void
 *   onDirectBoot {function} () => void
 *   onSendSerial {function} (text) => void
 *   onClearSerial{function} () => void
 *   onGpioDown   {function} (pin, 1) => void  — button pressed
 *   onGpioUp     {function} (pin, 0) => void  — button released
 *
 * Virtual component layout:
 *   Add your VirtualButton / VirtualLED entries in the VIRTUAL_COMPONENTS
 *   array at the top of the file. The workspace will render them automatically.
 */
import React from 'react';
import VirtualButton from './VirtualButton.jsx';
import VirtualLED    from './VirtualLED.jsx';
import SerialMonitor from './SerialMonitor.jsx';

/**
 * ─── CONFIGURE YOUR VIRTUAL COMPONENTS HERE ──────────────────────────────────
 *
 * Each entry describes one virtual UI element.
 * type  : 'button' | 'led'
 * pin   : GPIO number that maps to SimulatorBridge.h GPIO events
 * label : shown below the widget
 * color : (LED only) lit colour
 */
const VIRTUAL_COMPONENTS = [
  { type: 'button', pin: 0,  label: 'BOOT'  },
  { type: 'button', pin: 2,  label: 'BTN 2' },
  { type: 'led',    pin: 2,  label: 'LED 2', color: '#00ff88' },
  { type: 'led',    pin: 4,  label: 'LED 4', color: '#00d4ff' },
  { type: 'led',    pin: 13, label: 'LED 13', color: '#f59e0b' },
];

// ─── STATUS BADGE ───────────────────────────────────────────────────────────────

/**
 * Phase map: backend phase string → { label, color }
 *
 * 'compiling' — arduino-cli is running
 * 'booting'   — QEMU started, ROM boot detected, waiting for sim_ready()
 * 'running'   — sim_ready() received; device is live
 * 'stalled'   — heartbeat timeout; firmware may have crashed
 * 'stopped'   — session ended
 */
const PHASE_META = {
  compiling: { label: '⚙️ Compiling…',  color: '#f59e0b' },
  booting:   { label: '🔄 Booting…',    color: '#60a5fa' },
  running:   { label: '🟢 Running',      color: '#22c55e' },
  stalled:   { label: '⚠️ Stalled',      color: '#fb923c' },
  stopped:   { label: '⚫ Idle',           color: '#64748b' },
};

function StatusBadge({ phase }) {
  const { label, color } = PHASE_META[phase] ?? PHASE_META.stopped;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, color,
      background: `${color}22`,
      border: `1px solid ${color}55`,
      borderRadius: 4, padding: '2px 8px',
      letterSpacing: 0.4,
    }}>
      {label}
    </span>
  );
}

// ─── TOOLBAR ─────────────────────────────────────────────────────────────────
function Toolbar({ phase, onRun, onStop, onDirectBoot }) {
  const isActive  = phase === 'running' || phase === 'booting' || phase === 'compiling' || phase === 'stalled';
  const isBusy    = phase === 'compiling' || phase === 'booting';
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      {!isActive ? (
        <button
          onClick={onRun}
          style={btnStyle('#22c55e')}
        >
          ▶ Run (ESP32)
        </button>
      ) : (
        <button
          onClick={onStop}
          disabled={false}
          style={btnStyle('#ef4444')}
        >
          ■ Stop
        </button>
      )}
      <button
        onClick={onDirectBoot}
        disabled={isActive}
        title="Boot from pre-compiled binary on server (debug)"
        style={{ ...btnStyle('#8b5cf6'), opacity: isActive ? 0.4 : 1 }}
      >
        ⚡ Direct Boot
      </button>
      <StatusBadge phase={phase} />
      {isBusy && (
        <span style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
          {phase === 'compiling' ? 'Building firmware…' : 'Waiting for sim_ready()…'}
        </span>
      )}
    </div>
  );
}

function btnStyle(accent) {
  return {
    background: `${accent}22`,
    border: `1px solid ${accent}66`,
    borderRadius: 6,
    color: accent,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    padding: '6px 14px',
    letterSpacing: 0.3,
    transition: 'all 0.15s ease',
  };
}

// ─── VIRTUAL GPIO PANEL ────────────────────────────────────────────────────────
function VirtualGpioPanel({ pinStates, onGpioDown, onGpioUp, disabled }) {
  const buttons = VIRTUAL_COMPONENTS.filter(c => c.type === 'button');
  const leds    = VIRTUAL_COMPONENTS.filter(c => c.type === 'led');

  return (
    <div style={{
      background: '#161b22',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 8,
      padding: '14px 18px',
    }}>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 12, letterSpacing: 0.5 }}>
        VIRTUAL GPIO
      </div>

      {/* Buttons row */}
      {buttons.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: '#475569', marginBottom: 8 }}>INPUTS</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {buttons.map(c => (
              <VirtualButton
                key={`btn-${c.pin}`}
                pin={c.pin}
                label={c.label}
                onPress={onGpioDown}
                onRelease={onGpioUp}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}

      {/* LEDs row */}
      {leds.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: '#475569', marginBottom: 8 }}>OUTPUTS</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {leds.map(c => (
              <VirtualLED
                key={`led-${c.pin}-${c.label}`}
                pin={c.pin}
                label={c.label}
                color={c.color}
                pinStates={pinStates}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN WORKSPACE ─────────────────────────────────────────────────────────────────
/**
 * Props:
 *   phase        {'compiling'|'booting'|'running'|'stalled'|'stopped'}
 *   pinStates    {object}   { [pinNumber]: 0|1 }
 *   serialHistory {Array}   [{ dir, text, ts }]
 *   onRun        {function} () => void
 *   onStop       {function} () => void
 *   onDirectBoot {function} () => void
 *   onSendSerial {function} (text) => void
 *   onClearSerial{function} () => void
 *   onGpioDown   {function} (pin, 1) => void
 *   onGpioUp     {function} (pin, 0) => void
 */
export default function SimulatorWorkspace({
  phase         = 'stopped',
  pinStates     = {},
  serialHistory = [],
  onRun,
  onStop,
  onDirectBoot,
  onSendSerial,
  onClearSerial,
  onGpioDown,
  onGpioUp,
}) {
  const isRunning = phase === 'running' || phase === 'stalled';
  const isBusy    = phase === 'compiling' || phase === 'booting';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      height: '100%',
      padding: 12,
      boxSizing: 'border-box',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#161b22',
        borderRadius: 8,
        border: '1px solid rgba(0,212,255,0.15)',
        padding: '10px 16px',
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#00d4ff', letterSpacing: 0.5 }}>
          ⚡ ESP32 QEMU Simulator
        </span>
        <Toolbar
          phase={phase}
          onRun={onRun}
          onStop={onStop}
          onDirectBoot={onDirectBoot}
        />
      </div>

      {/* GPIO Panel */}
      <VirtualGpioPanel
        pinStates={pinStates}
        onGpioDown={onGpioDown}
        onGpioUp={onGpioUp}
        disabled={!isRunning || isBusy}
      />

      {/* Serial Monitor */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <SerialMonitor
          history={serialHistory}
          onSend={onSendSerial}
          isRunning={isRunning && !isBusy}
          onClear={onClearSerial}
        />
      </div>
    </div>
  );
}
