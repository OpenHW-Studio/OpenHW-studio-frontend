import React from 'react'
import { S } from './styles.js'

export default function Palette({ catalog, onPaletteDragStart }) {
  return (
    <aside style={{ ...S.palette, width: '100%' }}>
      <div style={S.paletteHeader}>Components</div>
      <input style={S.paletteSearch} placeholder="🔍 Search..." />
      {catalog.map(group => (
        <div key={group.group}>
          <div style={S.groupName}>{group.group}</div>
          {group.items.map(item => (
            <div
              key={item.type}
              style={S.paletteItem}
              draggable
              onDragStart={e => onPaletteDragStart(e, item)}
              title={`Drag to canvas to add ${item.label}`}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>{item.label}</span>
            </div>
          ))}
        </div>
      ))}
      <div style={S.paletteTip}>
        Drag → drop to place<br />
        Click <em>Wire Mode</em> then click pins to connect<br />
        Del key removes selected
      </div>
    </aside>
  )
}