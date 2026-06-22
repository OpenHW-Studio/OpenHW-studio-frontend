import { useMemo } from 'react'

const COMPONENT_COLORS = {
  'openhw-arduino-uno': '#1a5276',
  'openhw-led': '#e74c3c',
  'openhw-rgb-led': '#8e44ad',
  'openhw-resistor': '#f39c12',
  'openhw-buzzer': '#27ae60',
  'openhw-pushbutton': '#2c3e50',
  'openhw-potentiometer': '#e67e22',
  'openhw-ldr-module': '#3498db',
  'openhw-ntc-temperature-sensor': '#1abc9c',
  'wokwi-lcd1602': '#9b59b6',
}

const COMPONENT_LABELS = {
  'openhw-arduino-uno': 'Arduino Uno',
  'openhw-led': 'LED',
  'openhw-rgb-led': 'RGB LED',
  'openhw-resistor': 'Resistor',
  'openhw-buzzer': 'Buzzer',
  'openhw-pushbutton': 'Push Button',
  'openhw-potentiometer': 'Potentiometer',
  'openhw-ldr-module': 'LDR Sensor',
  'openhw-ntc-temperature-sensor': 'Temp Sensor',
  'wokwi-lcd1602': 'LCD Display',
}

function getComponentType(type) {
  for (const key of Object.keys(COMPONENT_LABELS)) {
    if (type.includes(key.replace('openhw-', '')) || type === key) return key
  }
  return 'generic'
}

export default function CircuitCanvas({ schema, components: compList, board }) {
  const layout = useMemo(() => {
    if (schema?.components?.length > 0) {
      const comps = schema.components
      const conns = schema.connections || []
      const boardComp = comps.find(c =>
        c.type?.toLowerCase().includes('arduino') ||
        c.type?.toLowerCase().includes('uno')
      )
      const others = comps.filter(c => c !== boardComp)

      const minX = Math.min(...comps.map(c => c.x || 0))
      const maxX = Math.max(...comps.map(c => (c.x || 0) + (c.w || 100)))
      const minY = Math.min(...comps.map(c => c.y || 0))
      const maxY = Math.max(...comps.map(c => (c.y || 0) + (c.h || 80)))
      const rangeX = Math.max(maxX - minX, 400)
      const rangeY = Math.max(maxY - minY, 200)

      return {
        hasSchema: true,
        components: comps,
        connections: conns,
        boardComp,
        otherComps: others,
        bounds: { minX, maxX, minY, maxY, rangeX, rangeY },
      }
    }
    return { hasSchema: false, components: [], connections: [] }
  }, [schema, compList])

  if (layout.hasSchema) {
    const { components: comps, connections: conns, bounds } = layout
    const W = 700, H = 400
    const pad = 40
    const scaleX = (W - pad * 2) / bounds.rangeX
    const scaleY = (H - pad * 2) / bounds.rangeY
    const scale = Math.min(scaleX, scaleY, 1.2)

    const toX = (x) => pad + (x - bounds.minX) * scale
    const toY = (y) => pad + (y - bounds.minY) * scale

    const connEndpoints = conns.map(conn => {
      const [fromId, fromPin] = conn.from.split(':')
      const [toId, toPin] = conn.to.split(':')
      const fromComp = comps.find(c => c.id === fromId)
      const toComp = comps.find(c => c.id === toId)
      if (!fromComp || !toComp) return null
      return {
        ...conn,
        fromComp, toComp,
        fromPin, toPin,
      }
    }).filter(Boolean)

    return (
      <div style={{
        width: '100%', height: 420, borderRadius: 16,
        background: 'var(--bg2, #0f172a)',
        border: '1px solid var(--border, rgba(255,255,255,0.1))',
        position: 'relative', overflow: 'hidden',
      }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
          {connEndpoints.map((conn, i) => {
            const fx = toX(conn.fromComp.x + (conn.fromComp.w || 60) / 2)
            const fy = toY(conn.fromComp.y + (conn.fromComp.h || 60) / 2)
            const tx = toX(conn.toComp.x + (conn.toComp.w || 60) / 2)
            const ty = toY(conn.toComp.y + (conn.toComp.h || 60) / 2)
            return (
              <line
                key={conn.id || i}
                x1={fx} y1={fy} x2={tx} y2={ty}
                stroke={conn.color || '#64748b'}
                strokeWidth={2}
                strokeDasharray="4 3"
                opacity={0.6}
              />
            )
          })}
        </svg>

        {comps.map((comp, i) => {
          const type = getComponentType(comp.type)
          const color = COMPONENT_COLORS[type] || '#6366f1'
          const label = comp.label || COMPONENT_LABELS[type] || comp.type
          const isBoard = comp.type?.toLowerCase().includes('arduino')
          return (
            <div
              key={comp.id || i}
              style={{
                position: 'absolute',
                left: toX(comp.x || 0),
                top: toY(comp.y || 0),
                width: (comp.w || 100) * scale * 0.8,
                height: (comp.h || 60) * scale * 0.8,
                background: `${color}20`,
                border: `2px solid ${color}60`,
                borderRadius: 10,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: 6,
                fontSize: isBoard ? 13 : 11,
                fontWeight: 700,
                color: '#e2e8f0',
                boxShadow: `0 0 20px ${color}20`,
                zIndex: isBoard ? 1 : 2,
              }}
            >
              <span style={{
                width: isBoard ? 32 : 20, height: isBoard ? 32 : 20,
                borderRadius: isBoard ? 8 : '50%',
                background: color, marginBottom: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: isBoard ? 14 : 10,
              }}>
                {isBoard ? '⚡' : type.includes('led') ? '💡' : type.includes('resistor') ? '⚡' : type.includes('buzzer') ? '🔊' : type.includes('button') ? '🔘' : '🔌'}
              </span>
              <span style={{ textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{
      width: '100%', minHeight: 200, borderRadius: 16,
      background: 'var(--bg2, #0f172a)',
      border: '1px solid var(--border, rgba(255,255,255,0.1))',
      display: 'flex', flexWrap: 'wrap', gap: 16,
      alignItems: 'center', justifyContent: 'center',
      padding: 32,
    }}>
      <div style={{
        padding: '16px 24px', borderRadius: 12,
        background: '#1a527620', border: '2px solid #1a527660',
        textAlign: 'center', color: '#e2e8f0', fontWeight: 700,
      }}>
        <div style={{ fontSize: 24, marginBottom: 6 }}>⚡</div>
        <div>{board || 'Arduino Uno'}</div>
      </div>

      {compList?.map((comp, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 24, height: 2, background: '#64748b', borderRadius: 1,
          }} />
          <div style={{
            padding: '12px 20px', borderRadius: 10,
            background: '#6366f120', border: '2px solid #6366f160',
            textAlign: 'center', color: '#e2e8f0', fontSize: 13, fontWeight: 600,
          }}>
            {comp}
          </div>
        </div>
      ))}
    </div>
  )
}
