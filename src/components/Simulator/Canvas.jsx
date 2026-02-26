import React from 'react'
import { S } from './styles.js'
import { bezierPath, orthogonalPath } from '../../Utils/WireUtils.jsx'
import { PIN_DEFS } from '../../Utils/PinDef.jsx'

export default function Canvas({
  board,
  boardPos,
  setBoardPos,
  components,
  wires,
  selected,
  wiringMode,
  wireStart,
  mousePos,
  hoveredPin,
  setHoveredPin,
  getPinPos,
  onCompMouseDown,
  onBoardMouseDown,
  onPinClick,
  deleteWire,
  setSelected,
  onCanvasDrop,
  onCanvasClick,
  onCanvasMouseMove,
  canvasRef,
  svgRef,
  errorCompIds,
}) {
  const boardTypeMap = {
    arduino_uno: 'wokwi-arduino-uno',
    pico: 'wokwi-raspberry-pi-pico',
    esp32: 'wokwi-esp32-devkit-v1',
  }

  const boardType = boardTypeMap[board] || boardTypeMap.arduino_uno
  const boardPins = PIN_DEFS[boardType] || []
  const boardRef = React.useRef(null)

  React.useEffect(() => {
    const recalc = () => {
      if (canvasRef.current && boardRef.current) {
        const cRect = canvasRef.current.getBoundingClientRect()
        const bRect = boardRef.current.getBoundingClientRect()
        setBoardPos({
          x: (cRect.width - bRect.width) / 2,
          y: (cRect.height - bRect.height) / 2,
        })
      }
    }
    recalc()
    if (boardType && window.customElements && !window.customElements.get(boardType)) {
      window.customElements.whenDefined(boardType).then(recalc).catch(() => {})
    }
  }, [board, boardType, canvasRef, boardRef, setBoardPos])

  return (
    <main
      style={{ ...S.canvas, cursor: wiringMode ? 'crosshair' : 'default' }}
      ref={canvasRef}
      onDrop={onCanvasDrop}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
      onClick={onCanvasClick}
      onMouseMove={onCanvasMouseMove}
    >
      <div
        ref={boardRef}
        style={{
          position: 'absolute',
          left: boardPos.x, top: boardPos.y,
          cursor: wiringMode ? 'crosshair' : 'move',
          zIndex: 1,
          userSelect: 'none',
        }}
        onMouseDown={onBoardMouseDown}
      >
        <div
          style={{ pointerEvents: 'none', width: 'fit-content', height: 'fit-content' }}
          dangerouslySetInnerHTML={{
            __html: `<${boardType}></${boardType}>`,
          }}
        />

        {boardPins.map(pin => {
          const isHovered = hoveredPin === `board:${pin.id}`
          const isWireStartPin = wireStart?.compId === 'board' && wireStart?.pinId === pin.id
          return (
            <div
              key={pin.id}
              title={`${pin.label} — click to wire`}
              style={{
                position: 'absolute',
                left: pin.x - 6, top: pin.y - 6,
                width: 12, height: 12,
                borderRadius: '50%',
                background: isWireStartPin ? 'var(--orange)'
                          : isHovered      ? 'var(--accent)'
                          :                  'var(--card)',
                border: `2px solid ${isWireStartPin ? 'var(--orange)' : isHovered ? 'var(--accent)' : 'var(--border)'}`,
                cursor: wiringMode ? 'crosshair' : 'default',
                zIndex: 20,
                opacity: wiringMode ? 1 : 0.5,
                transition: 'all .1s',
                boxShadow: isHovered || isWireStartPin ? '0 0 8px var(--glow)' : 'none',
              }}
              onMouseEnter={() => setHoveredPin(`board:${pin.id}`)}
              onMouseLeave={() => setHoveredPin(null)}
              onClick={e => onPinClick(e, 'board', pin.id, pin.label)}
            >
              {isHovered && (
                <div style={{
                  position: 'absolute', bottom: 14, left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  color: 'var(--accent)', padding: '2px 6px', borderRadius: 4,
                  fontSize: 10, whiteSpace: 'nowrap', zIndex: 100,
                  fontFamily: 'JetBrains Mono, monospace',
                  pointerEvents: 'none',
                }}>
                  {pin.label}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <svg
        ref={svgRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}
      >
        <defs>
          <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M 0 0 L 6 3 L 0 6 z" fill="var(--accent)" opacity="0.6" />
          </marker>
        </defs>

        {wires.map(w => {
          const fromParts = w.from.split(':')
          const toParts   = w.to.split(':')
          const p1 = getPinPos(fromParts[0], fromParts[1])
          const p2 = getPinPos(toParts[0],   toParts[1])
          if (!p1 || !p2) return null
          return (
            <g key={w.id} style={{ pointerEvents: 'all', cursor: 'pointer' }} onClick={() => deleteWire(w.id)}>
              <path
                d={orthogonalPath(p1.x, p1.y, p2.x, p2.y)}
                stroke="transparent" strokeWidth={12} fill="none"
              />
              <path
                d={orthogonalPath(p1.x, p1.y, p2.x, p2.y)}
                stroke={w.color}
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                opacity={0.9}
              />
              <circle cx={p1.x} cy={p1.y} r={4} fill={w.color} />
              <circle cx={p2.x} cy={p2.y} r={4} fill={w.color} />
            </g>
          )
        })}

        {/* Preview wire while drawing */}
        {wireStart && (
          <path
            d={orthogonalPath(wireStart.x, wireStart.y, mousePos.x, mousePos.y)}
            stroke="var(--orange)"
            strokeWidth={2}
            strokeDasharray="6 4"
            fill="none"
            strokeLinecap="round"
            opacity={0.8}
          />
        )}
      </svg>

      {/* Empty state */}
      {components.length === 0 && (
        <div style={S.emptyState}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🔌</div>
          <p style={{ fontSize: 16, marginBottom: 8 }}>Drag components from the left panel</p>
          <p style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace' }}>
            Arduino Uno · LED · Resistor · Button · Servo · LCD
          </p>
        </div>
      )}

      {/* Components */}
      {components.map(comp => {
        const pins = PIN_DEFS[comp.type] || []
        const hasError = errorCompIds.has(comp.id)
        const isSelected = selected === comp.id
        return (
          <div
            key={comp.id}
            style={{
              position: 'absolute',
              left: comp.x, top: comp.y,
              width: comp.w, height: comp.h,
              cursor: wiringMode ? 'crosshair' : 'move',
              zIndex: isSelected ? 5 : 2,
              userSelect: 'none',
            }}
            onMouseDown={e => onCompMouseDown(e, comp.id)}
          >
            {isSelected && !wiringMode && (
              <div style={{
                position: 'absolute', inset: -6, borderRadius: 8,
                border: '2px solid var(--accent)',
                boxShadow: '0 0 16px var(--glow)',
                pointerEvents: 'none', zIndex: 10,
                animation: 'none',
              }} />
            )}
            {hasError && (
              <div style={{
                position: 'absolute', inset: -6, borderRadius: 8,
                border: '2px solid var(--red)',
                boxShadow: '0 0 16px rgba(255,68,68,.4)',
                pointerEvents: 'none', zIndex: 10,
              }} />
            )}

            <div
              style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
              dangerouslySetInnerHTML={{
                __html: `<${comp.type} ${Object.entries(comp.attrs).map(([k,v]) => `${k}="${v}"`).join(' ')}></${comp.type}>`,
              }}
            />

            {pins.map(pin => {
              const isHovered = hoveredPin === `${comp.id}:${pin.id}`
              const isWireStartPin = wireStart?.compId === comp.id && wireStart?.pinId === pin.id
              return (
                <div
                  key={pin.id}
                  title={`${pin.label} — click to wire`}
                  style={{
                    position: 'absolute',
                    left: pin.x - 6, top: pin.y - 6,
                    width: 12, height: 12,
                    borderRadius: '50%',
                    background: isWireStartPin ? 'var(--orange)'
                              : isHovered      ? 'var(--accent)'
                              :                  'var(--card)',
                    border: `2px solid ${isWireStartPin ? 'var(--orange)' : isHovered ? 'var(--accent)' : 'var(--border)'}`,
                    cursor: wiringMode ? 'crosshair' : 'default',
                    zIndex: 20,
                    opacity: wiringMode ? 1 : 0.5,
                    transition: 'all .1s',
                    boxShadow: isHovered || isWireStartPin ? '0 0 8px var(--glow)' : 'none',
                  }}
                  onMouseEnter={() => setHoveredPin(`${comp.id}:${pin.id}`)}
                  onMouseLeave={() => setHoveredPin(null)}
                  onClick={e => onPinClick(e, comp.id, pin.id, pin.label)}
                >
                  {isHovered && (
                    <div style={{
                      position: 'absolute', bottom: 14, left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'var(--bg2)', border: '1px solid var(--border)',
                      color: 'var(--accent)', padding: '2px 6px', borderRadius: 4,
                      fontSize: 10, whiteSpace: 'nowrap', zIndex: 100,
                      fontFamily: 'JetBrains Mono, monospace',
                      pointerEvents: 'none',
                    }}>
                      {pin.label}
                    </div>
                  )}
                </div>
              )
            })}

            <div style={{
              position: 'absolute', bottom: -18, left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 10, color: hasError ? 'var(--red)' : 'var(--text3)',
              whiteSpace: 'nowrap', fontFamily: 'JetBrains Mono, monospace',
              pointerEvents: 'none',
            }}>
              {comp.label}
            </div>
          </div>
        )
      })}
    </main>
  )
}