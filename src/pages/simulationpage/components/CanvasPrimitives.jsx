import React, { useCallback, useMemo, useSyncExternalStore } from 'react';
import { buildWirePath, getWirePoints } from '../wireUtils';

const samePoint = (prev, next) => (
  prev === next || (
    !!prev &&
    !!next &&
    prev.x === next.x &&
    prev.y === next.y &&
    !!prev.isFallback === !!next.isFallback
  )
);

const areCanvasWirePropsEqual = (prev, next) => (
  prev.wire === next.wire &&
  samePoint(prev.p1, next.p1) &&
  samePoint(prev.p2, next.p2) &&
  samePoint(prev.e1, next.e1) &&
  samePoint(prev.e2, next.e2) &&
  prev.isSelected === next.isSelected &&
  prev.wirepointsEnabled === next.wirepointsEnabled &&
  prev.offset === next.offset &&
  prev.wiresAlwaysOnTop === next.wiresAlwaysOnTop
);

export const CanvasWire = React.memo(({ wire, p1, p2, e1, e2, isSelected, onSelect, onMouseDownSegment, wirepointsEnabled, theme, offset = 0, wiresAlwaysOnTop = false }) => {
  const wirePath = useMemo(() => buildWirePath(p1, e1, e2, p2, wire.waypoints, wire.path, offset), [p1, e1, e2, p2, wire.waypoints, wire.path, offset]);
  const isOrphaned = p1.isFallback || p2.isFallback;

  // Logic:
  // - If forced to top: non-selected wires use 0.6 opacity/1.5px (Feedback)
  // - If at bottom: non-selected wires use 1.0 opacity/2.0px (Normal)
  const useFeedback = wiresAlwaysOnTop && !isSelected;

  return (
    <g style={{ cursor: 'pointer' }} onClick={onSelect} onDoubleClick={e => e.stopPropagation()}>
      <path id={`wire-path-hit-${wire.id}`} d={wirePath} stroke="transparent" strokeWidth={16} fill="none" style={{ pointerEvents: 'stroke' }} />
      <path id={`wire-path-ui-${wire.id}`} d={wirePath}
        stroke={isSelected ? 'var(--orange)' : (isOrphaned ? '#f59e0b' : (wire.isNew ? '#38bdf8' : wire.color))}
        strokeWidth={isSelected ? 2.5 : (useFeedback ? 1.8 : 2.0)}
        fill="none"
        strokeDasharray={isSelected || wire.isNew || isOrphaned ? "6 4" : "none"}
        strokeLinecap="round"
        opacity={useFeedback ? 0.75 : 1.0}
        style={{ animation: (wire.isNew || isOrphaned) ? 'autofixWirePulse 1.5s infinite linear' : 'none' }}
      />
      <circle id={`wire-circ-from-${wire.id}`} cx={p1.x} cy={p1.y} r={isSelected ? 3 : 2} fill={isSelected ? 'var(--orange)' : (isOrphaned ? '#f59e0b' : (wire.isNew ? '#38bdf8' : wire.color))} opacity={useFeedback ? 0.8 : 1} />
      <circle id={`wire-circ-to-${wire.id}`} cx={p2.x} cy={p2.y} r={isSelected ? 3 : 2} fill={isSelected ? 'var(--orange)' : (isOrphaned ? '#f59e0b' : (wire.isNew ? '#38bdf8' : wire.color))} opacity={useFeedback ? 0.8 : 1} />
      {wirepointsEnabled && getWirePoints(p1, e1, e2, p2, wire.waypoints, offset).reduce((acc, pt, i, arr) => {
        // Waypoint Handles (Corners)
        if (i > 0 && i < arr.length - 1) {
          const isCorner = i > 1 && i < arr.length - 2; // Simple heuristic for now
          acc.push(
            <circle key={`wp-${i}`} cx={pt.x} cy={pt.y} r={isSelected ? 5 : 3}
              fill={isSelected ? '#fff' : 'rgba(255,255,255,0.35)'}
              stroke={isSelected ? 'var(--orange)' : wire.color} strokeWidth={1.5}
              opacity={isSelected ? 1 : 0.4}
              style={{ pointerEvents: 'all', cursor: 'move' }}
              onMouseDown={ev => {
                ev.stopPropagation();
                if (onMouseDownSegment) onMouseDownSegment(ev, wire, i, null, arr, 'waypoint');
              }}
              onClick={ev => ev.stopPropagation()}
            />
          );
        }

        // Segment Handles (Middles)
        if (i < arr.length - 1) {
          const a = arr[i], b = arr[i + 1];
          const segLen = Math.hypot(b.x - a.x, b.y - a.y);
          if (segLen >= 20) {
            const isHoriz = Math.abs(b.y - a.y) < 1;
            const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
            acc.push(
              <circle key={`sh-${i}`} cx={midX} cy={midY} r={isSelected ? 6 : 4}
                fill={isSelected ? '#fff' : 'rgba(255,255,255,0.35)'}
                stroke={isSelected ? 'var(--orange)' : wire.color} strokeWidth={1.5}
                opacity={isSelected ? 1 : 0.55}
                style={{ pointerEvents: 'all', cursor: isHoriz ? 'ns-resize' : 'ew-resize' }}
                title={isHoriz ? 'Drag up/down to route' : 'Drag left/right to route'}
                onMouseDown={ev => onMouseDownSegment(ev, wire, i, isHoriz, arr, 'segment')}
                onClick={ev => ev.stopPropagation()}
              />
            );
          }
        }
        return acc;
      }, [])}
    </g>
  );
}, areCanvasWirePropsEqual);

const areCanvasComponentPropsEqual = (prev, next) => (
  prev.comp === next.comp &&
  prev.isSelected === next.isSelected &&
  prev.hasError === next.hasError &&
  prev.getComponentStateAttrs === next.getComponentStateAttrs &&
  prev.COMPONENT_REGISTRY === next.COMPONENT_REGISTRY &&
  prev.getLiveOopStateSnapshot === next.getLiveOopStateSnapshot &&
  prev.subscribeLiveOopState === next.subscribeLiveOopState
);

export const CanvasComponent = React.memo(({ comp, isSelected, hasError, onMouseDown, onClick, getComponentStateAttrs, COMPONENT_REGISTRY, getLiveOopStateSnapshot, subscribeLiveOopState }) => {
  const liveState = useSyncExternalStore(
    useCallback((onStoreChange) => subscribeLiveOopState(comp.id, onStoreChange), [comp.id, subscribeLiveOopState]),
    useCallback(() => getLiveOopStateSnapshot(comp.id), [comp.id, getLiveOopStateSnapshot]),
    useCallback(() => getLiveOopStateSnapshot(comp.id), [comp.id, getLiveOopStateSnapshot])
  );

  const getBounds = () => {
    const reg = COMPONENT_REGISTRY[comp.type];
    if (!reg) return { x: 0, y: 0, w: comp.w, h: comp.h };
    if (typeof reg.BOUNDS === 'function') return reg.BOUNDS(getComponentStateAttrs(comp));
    return reg.BOUNDS || { x: 0, y: 0, w: comp.w, h: comp.h };
  };
  const b = getBounds();

  const attrs = getComponentStateAttrs(comp, liveState);
  const isOverloaded = attrs.glow === true || attrs.isOverloaded === true;

  return (
    <React.Fragment>
      {isOverloaded && (
        <div
          className="overload-glow"
          style={{
            position: 'absolute',
            left: comp.x + b.x - 10, top: comp.y + b.y - 10,
            width: b.w + 20, height: b.h + 20,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(239,68,68,0.5) 0%, transparent 70%)',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
      )}
      <div
        id={`comp-hit-${comp.id}`}
        style={{
          position: 'absolute',
          left: 0, top: 0,
          width: comp.w, height: comp.h,
          zIndex: isSelected ? 4 : 2,
          userSelect: 'none',
          pointerEvents: 'none',
          transform: comp.rotation ? `rotate(${comp.rotation}deg)` : undefined,
          transformOrigin: 'center center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: b.x, top: b.y,
            width: b.w, height: b.h,
            cursor: 'move',
            pointerEvents: 'auto',
            zIndex: 0,
          }}
          onMouseDown={onMouseDown}
          onClick={onClick}
          onDoubleClick={e => e.stopPropagation()}
        />

        {/* Autofix preview panel intentionally rendered at page level (not per-component) */}
        {isSelected && (
          <div style={{
            position: 'absolute',
            left: b.x - 6, top: b.y - 6,
            width: b.w + 12, height: b.h + 12,
            borderRadius: 8,
            border: '2px solid var(--accent)',
            boxShadow: '0 0 16px var(--glow)',
            pointerEvents: 'none', zIndex: 10,
          }} />
        )}
        {hasError && (
          <div
            className="safety-pulse"
            style={{
              position: 'absolute',
              left: b.x - 8, top: b.y - 8,
              width: b.w + 16, height: b.h + 16,
              borderRadius: 12,
              border: '2px solid #ef4444',
              boxShadow: '0 0 20px rgba(239,68,68,0.6)',
              pointerEvents: 'none', zIndex: 9,
              background: 'rgba(239,68,68,0.05)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'flex-end',
              padding: '4px'
            }}
          >
            <div style={{
              background: '#ef4444',
              borderRadius: '50%',
              width: '18px', height: '18px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: '12px', fontWeight: 'bold',
              boxShadow: '0 0 8px rgba(239,68,68,0.8)',
              transform: 'translate(4px, -4px)'
            }}>!</div>
          </div>
        )}
      </div>
    </React.Fragment>
  );
}, areCanvasComponentPropsEqual);
