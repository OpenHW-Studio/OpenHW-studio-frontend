/**
 * VirtualButton.jsx  —  src/esp32/components/VirtualButton.jsx
 *
 * A pressable button that calls onPress(pin, 1) on pointer-down and
 * onRelease(pin, 0) on pointer-up, so the caller can relay SET_GPIO
 * messages to the backend WebSocket.
 *
 * Props:
 *   pin       {number|string}  GPIO pin number (e.g. 2)
 *   label     {string}         Optional label shown below the button
 *   onPress   {function}       (pin, value) => void
 *   onRelease {function}       (pin, value) => void
 *   disabled  {boolean}        Disables interaction when not running
 */
import React, { useState, useCallback } from 'react';

export default function VirtualButton({ pin, label, onPress, onRelease, disabled = false }) {
  const [held, setHeld] = useState(false);

  const handleDown = useCallback((e) => {
    e.preventDefault();
    if (disabled) return;
    setHeld(true);
    onPress?.(pin, 1);
  }, [disabled, pin, onPress]);

  const handleUp = useCallback((e) => {
    e.preventDefault();
    if (!held) return;
    setHeld(false);
    onRelease?.(pin, 0);
  }, [held, pin, onRelease]);

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <button
        onPointerDown={handleDown}
        onPointerUp={handleUp}
        onPointerLeave={handleUp}
        disabled={disabled}
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          border: held
            ? '2px solid #00d4ff'
            : '2px solid rgba(255,255,255,0.15)',
          background: held
            ? 'radial-gradient(circle, #00d4ff 0%, #0080cc 100%)'
            : 'radial-gradient(circle, #2a2a3e 0%, #1a1a2e 100%)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 1,
          boxShadow: held
            ? '0 0 14px rgba(0,212,255,0.7), inset 0 2px 4px rgba(0,0,0,0.4)'
            : '0 4px 8px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.05)',
          transition: 'all 0.08s ease',
          transform: held ? 'scale(0.93)' : 'scale(1)',
          color: held ? '#fff' : 'rgba(255,255,255,0.7)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.5,
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        {held ? '●' : '○'}
      </button>
      {label && (
        <span style={{
          fontSize: 10,
          color: 'rgba(255,255,255,0.55)',
          fontFamily: 'monospace',
          letterSpacing: 0.3,
        }}>
          {label} (GPIO {pin})
        </span>
      )}
    </div>
  );
}
