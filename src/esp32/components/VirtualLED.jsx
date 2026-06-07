/**
 * VirtualLED.jsx  —  src/esp32/components/VirtualLED.jsx
 *
 * Renders a simulated LED whose state is driven by GPIO_SYNC messages
 * from the backend QEMU session.
 *
 * Props:
 *   pin     {number|string}  GPIO pin to watch
 *   label   {string}         Optional label
 *   color   {string}         Lit colour (default: '#00ff88')
 *   pinStates {object}       Map of { [pin]: 0|1 } maintained by SimulatorPage
 */
import React from 'react';

export default function VirtualLED({
  pin,
  label,
  color = '#00ff88',
  pinStates = {},
}) {
  const isOn = pinStates[String(pin)] === 1 || pinStates[Number(pin)] === 1;

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: isOn
            ? `radial-gradient(circle at 35% 35%, white 0%, ${color} 40%, #003300 100%)`
            : 'radial-gradient(circle at 35% 35%, #555 0%, #1a1a1a 100%)',
          boxShadow: isOn
            ? `0 0 10px ${color}, 0 0 24px ${color}55`
            : '0 2px 4px rgba(0,0,0,0.5)',
          border: `2px solid ${isOn ? color : 'rgba(255,255,255,0.1)'}`,
          transition: 'all 0.08s ease',
        }}
      />
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
