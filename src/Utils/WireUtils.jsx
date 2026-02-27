const WIRE_COLOR = {
  '5V': '#ff4444', 'VCC': '#ff4444', 'V+': '#ff4444',
  'GND': '#333', 'VSS': '#333',
  'PWM': '#ffaa00',
  default: 'var(--accent)',
}
export function wireColor(pinLabel) {
  return WIRE_COLOR[pinLabel] || WIRE_COLOR.default
}

export function bezierPath(x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1)
  const cx = dx * 0.5
  return `M ${x1} ${y1} C ${x1 + cx} ${y1}, ${x2 - cx} ${y2}, ${x2} ${y2}`
}

// orthogonal wiring paths (horizontal‑vertical segments)
export function orthogonalPath(x1, y1, x2, y2) {
  const midy = (y1 + y2) / 2
  return `M ${x1} ${y1} L ${x1} ${midy} L ${x2} ${midy} L ${x2} ${y2}`
}