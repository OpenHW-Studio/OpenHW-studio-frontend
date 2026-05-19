import React, { useSyncExternalStore, useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { CanvasWire, CanvasComponent } from './CanvasPrimitives';
import { calculateWireBundleOffsets } from '../../../utils/wireRouting.js';

const ReactiveComponentUI = React.memo(({ comp, COMPONENT_REGISTRY, getComponentStateAttrs, isRunning, getLiveOopStateSnapshot, subscribeLiveOopState }) => {
  const liveState = useSyncExternalStore(
    useCallback((onStoreChange) => subscribeLiveOopState(comp.id, onStoreChange), [comp.id, subscribeLiveOopState]),
    useCallback(() => getLiveOopStateSnapshot(comp.id), [comp.id, getLiveOopStateSnapshot]),
    useCallback(() => getLiveOopStateSnapshot(comp.id), [comp.id, getLiveOopStateSnapshot])
  );

  return React.createElement(COMPONENT_REGISTRY[comp.type].UI, {
    state: liveState,
    attrs: getComponentStateAttrs(comp, liveState),
    isRunning: isRunning,
    comp: comp
  });
});

ReactiveComponentUI.displayName = 'ReactiveComponentUI';

const ReactiveFallbackComponentUI = React.memo(({ comp, getComponentStateAttrs, getLiveOopStateSnapshot, subscribeLiveOopState, neopixelRefs }) => {
  const liveState = useSyncExternalStore(
    useCallback((onStoreChange) => subscribeLiveOopState(comp.id, onStoreChange), [comp.id, subscribeLiveOopState]),
    useCallback(() => getLiveOopStateSnapshot(comp.id), [comp.id, getLiveOopStateSnapshot]),
    useCallback(() => getLiveOopStateSnapshot(comp.id), [comp.id, getLiveOopStateSnapshot])
  );

  return (
    <div
      style={{ width: '100%', height: '100%', pointerEvents: 'none', background: '#444', border: '1px solid #777' }}
      ref={el => {
        if ((comp.type === 'wokwi-neopixel-matrix' || comp.type === 'openhw-neopixel-matrix') && el) {
          neopixelRefs.current[comp.id] = el;
        }
      }}
    >
      {React.createElement(comp.type, getComponentStateAttrs(comp, liveState))}
    </div>
  );
});

ReactiveFallbackComponentUI.displayName = 'ReactiveFallbackComponentUI';

function CanvasSceneLayerBase({
  innerCanvasRef,
  canvasOffset,
  canvasZoom,
  showGrid,
  wires,
  wiresAlwaysOnTop,
  selected,
  components,
  getPinPos,
  getPinExitPoint,
  wirepointsEnabled,
  theme,
  setSelected,
  canvasRef,
  setWireClickPos,
  canvasOffsetRef,
  canvasZoomRef,
  setSegDrag,
  segDragRef,
  autofixPlan,
  getPinPosWithGhosts,
  wireStart,
  mousePos,
  multiRoutePath,
  svgRef,
  isRunning,
  isComponentDragging,
  COMPONENT_REGISTRY,
  getComponentStateAttrs,
  updateComponentAttr,
  wireClickPos,
  updateWireColor,
  saveHistory,
  setWires,
  deleteWire,
  PIN_DEFS,
  errorCompIds,
  serialBoardFilter,
  onCompContextMenu,
  onCompMouseDown,
  onCompClick,
  getLiveOopStateSnapshot,
  subscribeLiveOopState,
  neopixelRefs,
  hoveredPin,
  setHoveredPin,
  snappingHoles,
  getPinCategory,
  hasCategoryIntersection,
  onPinClick,
  setWireStart,
}) {
  const [showExitOverlay, setShowExitOverlay] = useState(() => {
    try { return localStorage.getItem('showExitOverlay') !== '0'; } catch (e) { return true; }
  });
  useEffect(() => { try { localStorage.setItem('showExitOverlay', showExitOverlay ? '1' : '0'); } catch (e) {} }, [showExitOverlay]);
  const wireOffsetMap = useMemo(() => calculateWireBundleOffsets(wires, (wire) => {
    const fromParts = wire.from.split(':');
    const toParts = wire.to.split(':');
    const p1 = getPinPos(fromParts[0], fromParts.slice(1).join(':'));
    const p2 = getPinPos(toParts[0], toParts.slice(1).join(':'));
    if (!p1 || !p2) return null;
    const e1 = getPinExitPoint(fromParts[0], fromParts.slice(1).join(':'), 0, p2) || p1;
    const e2 = getPinExitPoint(toParts[0], toParts.slice(1).join(':'), 0, p1) || p2;
    return { p1, p2, e1, e2, waypoints: wire.waypoints || [] };
  }), [wires, getPinPos, getPinExitPoint]);

  const backgroundGridRef = useRef(null);

  useEffect(() => {
    const target = innerCanvasRef.current;
    if (!target) return;

    const syncGrid = () => {
      if (!backgroundGridRef.current) return;
      const transform = target.style.transform || '';
      const translateMatch = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
      const scaleMatch = transform.match(/scale\(([-\d.]+)\)/);

      const x = translateMatch ? parseFloat(translateMatch[1]) : canvasOffset.x;
      const y = translateMatch ? parseFloat(translateMatch[2]) : canvasOffset.y;
      const scale = scaleMatch ? parseFloat(scaleMatch[1]) : canvasZoom;

      backgroundGridRef.current.style.backgroundPosition = `${x}px ${y}px`;
      backgroundGridRef.current.style.backgroundSize = `${15 * scale}px ${15 * scale}px`;
    };

    syncGrid();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'style') {
          syncGrid();
          break;
        }
      }
    });

    observer.observe(target, { attributes: true, attributeFilter: ['style'] });

    return () => {
      observer.disconnect();
    };
  }, [innerCanvasRef, canvasOffset, canvasZoom, showGrid]);

  return (
    <>
      {showGrid && (
        <div
          ref={backgroundGridRef}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 0,
            backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
            backgroundSize: `${15 * canvasZoom}px ${15 * canvasZoom}px`,
            backgroundPosition: `${canvasOffset.x}px ${canvasOffset.y}px`,
          }}
        />
      )}
      <div ref={innerCanvasRef} style={{
        position: 'absolute', top: 0, left: 0,
        width: '10000px', height: '8000px',
        transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasZoom})`, transformOrigin: '0 0',
      }}>
      {/* BOTTOM SVG layer for wires (Below Components) */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1, overflow: 'visible' }}
      >
        {/* Placed wires (Bottom layer) - All non-selected wires when alwaysOnTop is disabled */}
        {wires.filter(w => !wiresAlwaysOnTop && selected !== w.id).map((w, index) => {
          const fromParts = w.from.split(':');
          const toParts = w.to.split(':');
          let p1 = getPinPos(fromParts[0], fromParts.slice(1).join(':'));
          let p2 = getPinPos(toParts[0], toParts.slice(1).join(':'));
          if (!p1 || !p2) {
            if (!p1) p1 = { x: 0, y: 0, isFallback: true };
            if (!p2) p2 = { x: 0, y: 0, isFallback: true };
          }
          const offset = wireOffsetMap.get(w.id) || 0;
          const e1 = getPinExitPoint(fromParts[0], fromParts.slice(1).join(':'), offset, p2) || p1;
          const e2 = getPinExitPoint(toParts[0], toParts.slice(1).join(':'), offset, p1) || p2;

          return (
            <CanvasWire
              key={w.id}
              wire={w}
              p1={p1} p2={p2} e1={e1} e2={e2}
              isSelected={selected === w.id}
              offset={offset}
              wirepointsEnabled={wirepointsEnabled}
              theme={theme}
              wiresAlwaysOnTop={wiresAlwaysOnTop}
              isDragging={isComponentDragging}
              onSelect={(e) => {
                e.stopPropagation();
                setSelected(w.id);
                const rect = canvasRef.current.getBoundingClientRect();
                setWireClickPos({ x: (e.clientX - rect.left - canvasOffsetRef.current.x) / canvasZoomRef.current, y: (e.clientY - rect.top - canvasOffsetRef.current.y) / canvasZoomRef.current });
              }}
              onMouseDownSegment={(ev, wire, i, isHoriz, arr, mode) => {
                if (selected !== wire.id) { setSelected(wire.id); return; }
                const rect = canvasRef.current.getBoundingClientRect();
                const mx = (ev.clientX - rect.left - canvasOffsetRef.current.x) / canvasZoomRef.current;
                const my = (ev.clientY - rect.top - canvasOffsetRef.current.y) / canvasZoomRef.current;
                const dragData = { wireId: wire.id, segIdx: i, isHoriz, startMouseCanvas: { x: mx, y: my }, startPts: arr.map(pt => ({ ...pt })), preWires: wires, hasMoved: false, mode };
                segDragRef.current = dragData;
                setSegDrag(dragData);
              }}
            />
          );
        })}
        {autofixPlan?.addedWires?.filter(w => w.isBelow === true).map((w, index) => {
          const fromParts = (w.from || '').split(':');
          const toParts = (w.to || '').split(':');
          let p1 = getPinPosWithGhosts(fromParts[0], fromParts.slice(1).join(':'));
          let p2 = getPinPosWithGhosts(toParts[0], toParts.slice(1).join(':'));
          if (!p1 || !p2) {
            if (!p1) p1 = { x: 0, y: 0, isFallback: true };
            if (!p2) p2 = { x: 0, y: 0, isFallback: true };
          }
          const e1 = p1;
          const e2 = p2;
          return (
            <CanvasWire
              key={`ghost-${w.id || `${w.from}-${w.to}-${index}`}`}
              wire={{ ...w, color: '#38bdf8', path: (w.path && w.path.length >= 2) ? [p1, ...w.path.slice(1, -1), p2] : null }}
              p1={p1} p2={p2} e1={e1} e2={e2}
              isGhost={true}
              theme={theme}
            />
          );
        })}
        {autofixPlan?.addedWires?.filter(w => w.isBelow !== true).map((w, index) => {
          const fromParts = (w.from || '').split(':');
          const toParts = (w.to || '').split(':');
          let p1 = getPinPosWithGhosts(fromParts[0], fromParts.slice(1).join(':'));
          let p2 = getPinPosWithGhosts(toParts[0], toParts.slice(1).join(':'));
          if (!p1 || !p2) {
            if (!p1) p1 = { x: 0, y: 0, isFallback: true };
            if (!p2) p2 = { x: 0, y: 0, isFallback: true };
          }
          const e1 = p1;
          const e2 = p2;
          return (
            <CanvasWire
              key={`ghost-${w.id || `${w.from}-${w.to}-${index}`}`}
              wire={{ ...w, color: '#38bdf8', path: (w.path && w.path.length >= 2) ? [p1, ...w.path.slice(1, -1), p2] : null }}
              p1={p1} p2={p2} e1={e1} e2={e2}
              isGhost={true}
              theme={theme}
            />
          );
        })}
      </svg>

      {/* Overlay toggle button */}
      <div style={{ position: 'absolute', left: 8, top: 8, zIndex: 220, pointerEvents: 'all' }}>
        <button
          onClick={() => setShowExitOverlay(s => !s)}
          title={showExitOverlay ? 'Hide exit overlay' : 'Show exit overlay'}
          style={{
            background: showExitOverlay ? 'rgba(255,204,0,0.95)' : 'rgba(0,0,0,0.6)',
            color: showExitOverlay ? '#000' : '#fff',
            border: 'none', padding: '6px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 12
          }}
        >
          {showExitOverlay ? 'Exit overlay: ON' : 'Exit overlay: OFF'}
        </button>
      </div>

      {/* TOP SVG layer for wires (Above Components) & Context Menu */}
      <svg
        ref={svgRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10, overflow: 'visible' }}
      >
        {/* Placed wires (Top layer) - Selected wire OR all wires if enabled */}
        {wires.filter(w => wiresAlwaysOnTop || selected === w.id).map((w, index) => {
          const fromParts = w.from.split(':');
          const toParts = w.to.split(':');
          let p1 = getPinPos(fromParts[0], fromParts.slice(1).join(':'));
          let p2 = getPinPos(toParts[0], toParts.slice(1).join(':'));
          if (!p1 || !p2) {
            if (!p1) p1 = { x: 0, y: 0, isFallback: true };
            if (!p2) p2 = { x: 0, y: 0, isFallback: true };
          }
          const offset = wireOffsetMap.get(w.id) || 0;
          const e1 = getPinExitPoint(fromParts[0], fromParts.slice(1).join(':'), offset, p2) || p1;
          const e2 = getPinExitPoint(toParts[0], toParts.slice(1).join(':'), offset, p1) || p2;

          return (
            <CanvasWire
              key={w.id}
              wire={w}
              p1={p1} p2={p2} e1={e1} e2={e2}
              isSelected={selected === w.id}
              offset={offset}
              wirepointsEnabled={wirepointsEnabled}
              theme={theme}
              wiresAlwaysOnTop={wiresAlwaysOnTop}
              isDragging={isComponentDragging}
              onSelect={(e) => {
                e.stopPropagation();
                setSelected(w.id);
                const rect = canvasRef.current.getBoundingClientRect();
                setWireClickPos({ x: (e.clientX - rect.left - canvasOffsetRef.current.x) / canvasZoomRef.current, y: (e.clientY - rect.top - canvasOffsetRef.current.y) / canvasZoomRef.current });
              }}
              onMouseDownSegment={(ev, wire, i, isHoriz, arr, mode) => {
                if (selected !== wire.id) { setSelected(wire.id); return; }
                const rect = canvasRef.current.getBoundingClientRect();
                const mx = (ev.clientX - rect.left - canvasOffsetRef.current.x) / canvasZoomRef.current;
                const my = (ev.clientY - rect.top - canvasOffsetRef.current.y) / canvasZoomRef.current;
                const dragData = { wireId: wire.id, segIdx: i, isHoriz, startMouseCanvas: { x: mx, y: my }, startPts: arr.map(pt => ({ ...pt })), preWires: wires, hasMoved: false, mode };
                segDragRef.current = dragData;
                setSegDrag(dragData);
              }}
            />
          );
        })}

        {/* Preview wire while drawing */}
        {wireStart && (
          <path
            d={multiRoutePath({ x: wireStart.x, y: wireStart.y }, mousePos, wireStart.waypoints)}
            stroke="var(--orange)"
            strokeWidth={2}
            strokeDasharray="6 4"
            fill="none"
            strokeLinecap="round"
            opacity={0.8}
          />
        )}

        {/* Exit-point overlay for debugging/resolution (UNO, A4988, Stepper) */}
        {(() => {
          if (!showExitOverlay) return null;
          const interesting = new Set(['openhw-arduino-uno', 'wokwi-arduino-uno', 'openhw-a4988', 'openhw-stepper-motor', 'wokwi-stepper-motor']);
          const markers = [];
          for (const comp of components) {
            if (!interesting.has(comp.type)) continue;
            const pins = PIN_DEFS[comp.type] || [];
            for (const pin of pins) {
              const p = getPinPos(comp.id, pin.id);
              const e = getPinExitPoint(comp.id, pin.id, 0, null) || p;
              if (!p || !e) continue;
              markers.push({ compId: comp.id, pinId: pin.id, p, e, dir: e.dir || null });
            }
          }

          // Group markers by component + side to avoid label overlap
          const groups = new Map();
          for (const m of markers) {
            const key = `${m.compId}::${m.dir || 'none'}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(m);
          }

          const out = [];
          for (const [key, arr] of groups.entries()) {
            // sort depending on side to keep label order stable
            const side = key.split('::')[1];
            if (side === 'top' || side === 'bottom') {
              arr.sort((a, b) => a.e.x - b.e.x);
            } else {
              arr.sort((a, b) => a.e.y - b.e.y);
            }

            for (let i = 0; i < arr.length; i++) {
              const m = arr[i];
              // compute label position with stacking offsets to prevent overlap
              let lx = m.e.x + 6, ly = m.e.y - 6;
              const label = `${m.pinId} (${m.dir || ''})`;
              if (m.dir === 'top') {
                ly = m.e.y - 8 - (i * 14);
                lx = m.e.x;
              } else if (m.dir === 'bottom') {
                ly = m.e.y + 12 + (i * 14);
                lx = m.e.x;
              } else if (m.dir === 'left') {
                lx = m.e.x - 10 - (i * 60);
                ly = m.e.y + 4;
              } else if (m.dir === 'right') {
                lx = m.e.x + 10 + (i * 60);
                ly = m.e.y + 4;
              } else {
                lx = m.e.x + 6; ly = m.e.y - 6;
              }

              const approxWidth = Math.max(28, label.length * 6);
              out.push(
                <g key={`exit-${m.compId}-${m.pinId}`} pointerEvents="none" opacity={0.95}>
                  <line x1={m.p.x} y1={m.p.y} x2={m.e.x} y2={m.e.y} stroke="#ffcc00" strokeWidth={1} strokeDasharray="2 2" />
                  <circle cx={m.e.x} cy={m.e.y} r={3} fill="#ffcc00" stroke="#333" strokeWidth={0.8} />
                  <line x1={m.e.x} y1={m.e.y} x2={lx} y2={ly} stroke="#ffcc00" strokeWidth={0.8} />
                  <rect x={lx - approxWidth / 2} y={ly - 10} rx={4} ry={4} width={approxWidth} height={14} fill="#111" opacity={0.7} />
                  <text x={lx - approxWidth / 2 + 6} y={ly + 2} fontSize={10} fill="#ffcc00" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{label}</text>
                </g>
              );
            }
          }
          return out;
        })()}
      </svg>

      {/* Component Context Menu — rendered at canvas level to avoid overflow:hidden clipping */}
      {(() => {
        const comp = components.find(c => c.id === selected);
        if (!comp) return null;
        const reg = COMPONENT_REGISTRY[comp.type];
        if (!reg?.ContextMenu) return null;
        const showDuringRun = !!reg.contextMenuDuringRun || !!reg.contextMenuOnlyDuringRun;
        if (isRunning && !showDuringRun) return null;
        if (!isRunning && reg.contextMenuOnlyDuringRun) return null;
        return (
          <div key={`cmenu-${comp.id}`} data-contextmenu="true" style={{
            position: 'absolute',
            left: comp.x + comp.w / 2,
            top: comp.y - 14,
            transform: `translateX(-50%) translateY(-100%) scale(${1 / Math.max(canvasZoom, 0.01)})`,
            transformOrigin: 'bottom center',
            background: 'var(--bg2)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 10px', borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)', cursor: 'default',
            pointerEvents: 'all', whiteSpace: 'nowrap', zIndex: 200
          }}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            onDoubleClick={e => e.stopPropagation()}
          >
            {React.createElement(reg.ContextMenu, {
              attrs: getComponentStateAttrs(comp),
              onUpdate: (key, value) => updateComponentAttr(comp.id, key, value)
            })}
            <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid var(--border)' }} />
            <div style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid var(--bg2)' }} />
          </div>
        );
      })()}

      {/* HTML Overlay for Wire Context Menus (Bypasses SVG foreignObject event bugs) */}
      {(() => {
        const w = wires.find(w => w.id === selected);
        if (!w || isRunning) return null;

        const fromParts = w.from.split(':');
        const toParts = w.to.split(':');
        const p1 = getPinPos(fromParts[0], fromParts.slice(1).join(':'));
        const p2 = getPinPos(toParts[0], toParts.slice(1).join(':'));
        if (!p1 || !p2) return null;

        const pts = [p1, ...(w.waypoints || []), p2];
        const midPt = pts[Math.floor(pts.length / 2)];
        const menuPos = wireClickPos || midPt;

        const fromComp = components.find(c => c.id === fromParts[0]);
        const toComp = components.find(c => c.id === toParts[0]);
        const fromLabel = `${fromComp?.label || fromParts[0]} [${w.fromLabel || fromParts[1]}]`;
        const toLabel = `${toComp?.label || toParts[0]} [${w.toLabel || toParts[1]}]`;

        return (
          <div key={`menu-${w.id}`} style={{
            position: 'absolute',
            left: menuPos.x,
            top: menuPos.y - 8,
            transform: 'translateX(-50%) translateY(-100%)',
            zIndex: 50,
            background: 'var(--bg2)', border: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', gap: 6,
            padding: '8px 10px', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.6)', cursor: 'default',
            minWidth: 180,
          }}
            onPointerDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.5, textAlign: 'center' }}
              title={`${fromLabel} → ${toLabel}`}>
              <div style={{ fontSize: 9, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{fromLabel}</div>
              <div style={{ fontSize: 9, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{toLabel}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <input type="color" value={w.color} onChange={e => updateWireColor(w.id, e.target.value)} style={{ width: 22, height: 22, padding: 0, border: 'none', cursor: 'pointer', background: 'transparent', borderRadius: 4 }} title="Change Color" />
              <button
                style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontSize: 13, padding: '4px 7px', borderRadius: 6, display: 'flex', alignItems: 'center' }}
                title="Reset route to auto"
                onPointerDown={e => e.stopPropagation()}
                onClick={e => {
                  e.stopPropagation();
                  saveHistory();
                  setWires(prev => prev.map(ww => ww.id === w.id ? { ...ww, waypoints: [] } : ww));
                }}
              >↺</button>
              <button style={{ background: 'var(--red)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, padding: '4px 8px', borderRadius: 6, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }} onPointerDown={(e) => { e.stopPropagation(); deleteWire(w.id); }} onClick={(e) => { e.stopPropagation(); deleteWire(w.id); }} title="Delete Wire">✕</button>
            </div>
            <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid var(--border)' }} />
            <div style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid var(--bg2)' }} />
          </div>
        );
      })()}

      {/* Empty state */}
      {components.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--text3)] text-center pointer-events-none">
          <div style={{ color: 'var(--text3)', opacity: 0.6, marginBottom: 16 }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" />
              <path d="M6 10v4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-4" />
              <line x1="12" y1="16" x2="12" y2="22" />
              <line x1="10" y1="22" x2="14" y2="22" />
            </svg>
          </div>
          <p style={{ fontSize: 16, marginBottom: 8 }}>Drag components from the left panel</p>
          <p style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace' }}>
            Arduino Uno · LED · Resistor · Button · Servo · LCD
          </p>
        </div>
      )}

      {/* Components (Layered: Breadboards on Bottom) */}
      {(() => {
        const renderComponent = (comp) => {
          const pins = comp.pins || PIN_DEFS[comp.type] || COMPONENT_REGISTRY[comp.type]?.manifest?.pins || [];
          const hasError = errorCompIds.has(comp.id);
          const isSelected = selected === comp.id;
          const isSerialBoardSelected = serialBoardFilter !== 'all' && serialBoardFilter === comp.id;

          return (
            <div
              key={comp.id}
              id={comp.isGhost ? `ghost-${comp.id}` : `comp-master-${comp.id}`}
              style={{
                position: 'absolute',
                left: comp.x, top: comp.y,
                zIndex: (comp.type.startsWith('wokwi-breadboard') || comp.type.startsWith('openhw-breadboard'))
                  ? (isSelected ? 4 : 2)
                  : (isSelected ? 10 : 5),
                opacity: comp.isGhost ? 0.4 : 1,
                filter: comp.isGhost ? 'grayscale(0.5) blur(0.5px)' : 'none',
                pointerEvents: comp.isGhost ? 'none' : 'auto',
              }}
              onContextMenu={e => onCompContextMenu(e, comp.id)}
            >
              <CanvasComponent
                comp={comp}
                isSelected={isSelected}
                hasError={hasError}
                onMouseDown={e => onCompMouseDown(e, comp.id)}
                onClick={e => onCompClick(e, comp.id)}
                getComponentStateAttrs={getComponentStateAttrs}
                COMPONENT_REGISTRY={COMPONENT_REGISTRY}
                PIN_DEFS={PIN_DEFS}
                getLiveOopStateSnapshot={getLiveOopStateSnapshot}
                subscribeLiveOopState={subscribeLiveOopState}
              />

              <div style={{
                position: 'absolute',
                left: 0, top: 0,
                width: comp.w, height: comp.h,
                userSelect: 'none',
                pointerEvents: 'none',
                transform: comp.rotation ? `rotate(${comp.rotation}deg)` : undefined,
                transformOrigin: 'center center',
              }}>
                {isSerialBoardSelected && (() => {
                  const getBounds = () => {
                    const reg = COMPONENT_REGISTRY[comp.type];
                    if (!reg) return { x: 0, y: 0, w: comp.w, h: comp.h };
                    if (typeof reg.BOUNDS === 'function') return reg.BOUNDS(getComponentStateAttrs(comp));
                    return reg.BOUNDS || { x: 0, y: 0, w: comp.w, h: comp.h };
                  };
                  const b = getBounds();
                  return (
                    <>
                      <div style={{
                        position: 'absolute',
                        left: b.x - 10, top: b.y - 10,
                        width: b.w + 20, height: b.h + 20,
                        borderRadius: 10,
                        border: '2px dashed #38bdf8',
                        boxShadow: '0 0 18px rgba(56,189,248,.45)',
                        pointerEvents: 'none', zIndex: 9,
                      }} />
                      <div style={{
                        position: 'absolute',
                        left: b.x - 10,
                        top: b.y - 26,
                        background: '#0c4a6e',
                        color: '#e0f2fe',
                        border: '1px solid #38bdf8',
                        borderRadius: 6,
                        fontSize: 9,
                        padding: '1px 6px',
                        letterSpacing: '0.04em',
                        fontFamily: 'JetBrains Mono, monospace',
                        pointerEvents: 'none',
                        zIndex: 11,
                      }}>
                        SERIAL TARGET
                      </div>
                    </>
                  );
                })()}

                <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0, zIndex: 20 }}>
                  {COMPONENT_REGISTRY[comp.type] ? (
                    <ReactiveComponentUI
                      comp={comp}
                      COMPONENT_REGISTRY={COMPONENT_REGISTRY}
                      getComponentStateAttrs={getComponentStateAttrs}
                      isRunning={isRunning}
                      getLiveOopStateSnapshot={getLiveOopStateSnapshot}
                      subscribeLiveOopState={subscribeLiveOopState}
                    />
                  ) : (
                    <ReactiveFallbackComponentUI
                      comp={comp}
                      getComponentStateAttrs={getComponentStateAttrs}
                      getLiveOopStateSnapshot={getLiveOopStateSnapshot}
                      subscribeLiveOopState={subscribeLiveOopState}
                      neopixelRefs={neopixelRefs}
                    />
                  )}
                </div>

                {pins.map(pin => {
                  const pinStrRef = `${comp.id}:${pin.id}`;
                  const isHovered = hoveredPin === pinStrRef;
                  const isWireStartPin = wireStart?.compId === comp.id && wireStart?.pinId === pin.id;
                  const isSnapping = Array.isArray(snappingHoles) && snappingHoles.some(h => h.bbId === comp.id && h.holeId === pin.id);

                  const hoverCompId = hoveredPin?.split(':')[0];
                  const hoverPinId = hoveredPin?.split(':')[1];
                  const hoverComp = hoverCompId ? components.find(c => c.id === hoverCompId) : null;
                  const hoverCat = (hoverComp && hoverPinId) ? getPinCategory(hoverPinId, '', hoverComp.type) : null;

                  const startCat = wireStart ? getPinCategory(wireStart.pinId, wireStart.pinLabel, wireStart.compType) : null;
                  const currentCat = getPinCategory(pin.id, pin.description, comp.type);

                  const isSuggested = startCat && currentCat && hasCategoryIntersection(startCat, currentCat) && !isWireStartPin;
                  const isRelated = hoverCat && currentCat && hasCategoryIntersection(hoverCat, currentCat) && !isHovered;

                  const isHighlight = isWireStartPin || isHovered || isSuggested || isRelated || isSnapping;
                  const connectedWire = wires.find(w => w.from === pinStrRef || w.to === pinStrRef);
                  const isSocket = connectedWire?.isSocket;

                  const isCompSeated = wires.some(w => w.isSocket && (w.from.startsWith(comp.id + ':') || w.to.startsWith(comp.id + ':')));
                  const isBreadboard = comp.type.startsWith('wokwi-breadboard') || comp.type.startsWith('openhw-breadboard');
                  const isFloating = !isBreadboard && isCompSeated && !isSocket;

                  const pinColor = isSnapping ? '#2ecc71' : (isSocket ? 'none' : (connectedWire ? connectedWire.color : (isHighlight ? '#f1c40f' : 'rgba(255,255,255,0.2)')));
                  const pinBorder = isSnapping ? '#fff' : (isSocket ? 'none' : (isFloating ? '#e67e22' : (isHighlight ? '#fff' : 'rgba(255,255,255,0.8)')));

                  return (
                    <div
                      key={pin.id}
                      id={`pin-dot-${comp.id}-${pin.id}`}
                      title={`${pin.description || pin.id} — click to wire`}
                      style={{
                        position: 'absolute',
                        left: pin.x, top: pin.y,
                        width: 5, height: 5,
                        background: pinColor === 'none' ? 'none' : pinColor,
                        border: pinBorder === 'none' ? 'none' : `1px solid ${pinBorder}`,
                        borderRadius: '0%',
                        cursor: 'crosshair',
                        zIndex: isHovered || isSuggested || isSnapping ? 30 : 20,
                        transform: `translate(-50%, -50%)${isHovered || isSuggested || isSnapping ? ' scale(1.5)' : ''}`,
                        transition: '0.2s',
                        pointerEvents: 'all',
                        boxShadow: isSnapping ? '0 0 10px #2ecc71' : (isSuggested ? '0 0 8px #f1c40f' : 'none'),
                      }}
                      onMouseEnter={() => setHoveredPin(pinStrRef)}
                      onMouseLeave={() => setHoveredPin(null)}
                      onClick={e => onPinClick(e, comp.id, pin.id, pin.description || pin.id)}
                    >
                      {isHovered && (
                        <div style={{
                          position: 'absolute', bottom: 18, left: '50%',
                          transform: 'translateX(-50%)',
                          background: '#111', color: '#fff',
                          padding: '4px 8px', borderRadius: 4,
                          fontSize: 10, whiteSpace: 'nowrap', zIndex: 9999,
                          pointerEvents: 'none', border: '1px solid #444',
                          boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
                        }}>
                          {pin.description || pin.id}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{
                position: 'absolute',
                top: (comp.rotation === 90 || comp.rotation === 270)
                  ? comp.h / 2 + comp.w / 2 + 4
                  : comp.h + 4,
                left: comp.w / 2,
                transform: 'translateX(-50%)',
                fontSize: 10, color: hasError ? 'var(--red)' : 'var(--text3)',
                whiteSpace: 'nowrap', fontFamily: 'JetBrains Mono, monospace',
                pointerEvents: 'none',
                zIndex: 5,
              }}>
                {comp.label}
              </div>
            </div>
          );
        };

        const breadboards = components.filter(c => c.type.startsWith('wokwi-breadboard') || c.type.startsWith('openhw-breadboard'));
        const others = components.filter(c => !c.type.startsWith('wokwi-breadboard') && !c.type.startsWith('openhw-breadboard'));

        return (
          <>
            {breadboards.map(renderComponent)}
            {others.map(renderComponent)}
            {autofixPlan?.addedComponents?.map(c => renderComponent({ ...c, isGhost: true }))}
          </>
        );
      })()}
    </div>
    </>
  );
}

export const CanvasSceneLayer = React.memo(CanvasSceneLayerBase);
