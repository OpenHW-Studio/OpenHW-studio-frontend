import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as EmulatorComponents from "@openhw/emulator";

const COMPONENT_REGISTRY = {};
Object.entries(EmulatorComponents).forEach(([key, module]) => {
  if (key === 'BaseComponent') return;
  if (module && module.manifest) {
    const compId = module.manifest.type || module.manifest.id || key;
    COMPONENT_REGISTRY[compId] = module;
  }
});

const GRID_SIZE = 15;

export default function ComponentLab() {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState('wokwi-hc-sr04');
  const [w, setW] = useState(100);
  const [h, setH] = useState(100);
  const [originalW, setOriginalW] = useState(100);
  const [originalH, setOriginalH] = useState(100);
  const [pins, setPins] = useState([]);

  const [workspaceZoom, setWorkspaceZoom] = useState(1.5);
  const [offsetX, setOffsetX] = useState(GRID_SIZE * 10);
  const [offsetY, setOffsetY] = useState(GRID_SIZE * 5); // Start at the top tuning area
  const [lockRatio, setLockRatio] = useState(true);

  const [draggingPin, setDraggingPin] = useState(null);
  const [selectedPinIndex, setSelectedPinIndex] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [draggingComp, setDraggingComp] = useState(false);
  const [compRotation, setCompRotation] = useState(0);
  const [activeTab, setActiveTab] = useState('modify');
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  const canvasRef = useRef(null);
  const startPos = useRef({ x: 0, y: 0, w: 0, h: 0, offX: 0, offY: 0, pins: [] });

  const rotate = () => {
    const newW = h;
    const newH = w;
    const newPins = pins.map(p => ({
      ...p,
      x: Math.round((h - p.y) * 10) / 10,
      y: Math.round(p.x * 10) / 10
    }));
    setW(newW);
    setH(newH);
    setPins(newPins);
    // DO NOT swap originalW/H here, they are the native SVG baseline
    setCompRotation((compRotation + 90) % 360);
  };

  // Keyboard Controller
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT') return; 

      if (e.key.toLowerCase() === 'r') {
        rotate();
        return;
      }

      if (selectedPinIndex === null) return;
      const step = e.shiftKey ? 5 : 1;
      const newPins = [...pins];
      const pin = newPins[selectedPinIndex];

      if (e.key === 'ArrowLeft') pin.x -= step;
      if (e.key === 'ArrowRight') pin.x += step;
      if (e.key === 'ArrowUp') pin.y -= step;
      if (e.key === 'ArrowDown') pin.y += step;
      
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        setPins(newPins);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPinIndex, pins, w, h]);

  // Load component defaults
  useEffect(() => {
    const reg = COMPONENT_REGISTRY[selectedType];
    if (reg && reg.manifest) {
      const baseW = reg.manifest.w || reg.manifest.width || 100;
      const baseH = reg.manifest.h || reg.manifest.height || 100;
      setW(baseW);
      setH(baseH);
      setOriginalW(baseW);
      setOriginalH(baseH);
      setPins(JSON.parse(JSON.stringify(reg.manifest.pins || [])));
    }
  }, [selectedType]);

  const handleMouseDown = (e, type, data = null) => {
    e.stopPropagation();
    startPos.current = {
      x: e.clientX,
      y: e.clientY,
      w: w,
      h: h,
      offX: offsetX,
      offY: offsetY,
      pins: JSON.parse(JSON.stringify(pins))
    };

    if (type === 'pin') setDraggingPin(data);
    if (type === 'resize') setResizing(data);
    if (type === 'comp') setDraggingComp(true);
    if (type === 'canvas') setResizing('move_canvas');
  };

  const handleMouseMove = useCallback((e) => {
    if (!canvasRef.current) return;
    const dx = (e.clientX - startPos.current.x) / workspaceZoom;
    const dy = (e.clientY - startPos.current.y) / workspaceZoom;

    if (draggingPin !== null) {
      const newPins = [...pins];
      const rawX = startPos.current.pins[draggingPin].x + dx;
      const rawY = startPos.current.pins[draggingPin].y + dy;

      const worldX = offsetX + rawX;
      const worldY = offsetY + rawY;
      const snappedWorldX = Math.round(worldX / GRID_SIZE) * GRID_SIZE;
      const snappedWorldY = Math.round(worldY / GRID_SIZE) * GRID_SIZE;

      newPins[draggingPin].x = snappedWorldX - offsetX;
      newPins[draggingPin].y = snappedWorldY - offsetY;

      setPins(newPins);
    } else if (draggingComp) {
      const rawX = startPos.current.offX + dx;
      const rawY = startPos.current.offY + dy;

      if (pins.length > 0) {
        // Use the first pin as an anchor
        const anchor = pins[0];
        const worldAnchorX = rawX + anchor.x;
        const worldAnchorY = rawY + anchor.y;

        // DUAL SNAP LOGIC:
        // Top area (y < 400) snaps to 15px grid
        // Bottom area (y >= 400) snaps ONLY to actual breadboard holes (proximity-based)
        const isGridZone = worldAnchorY < 400;

        let snappedAnchorX = worldAnchorX;
        let snappedAnchorY = worldAnchorY;

        if (isGridZone) {
          snappedAnchorX = Math.round(worldAnchorX / GRID_SIZE) * GRID_SIZE;
          snappedAnchorY = Math.round(worldAnchorY / GRID_SIZE) * GRID_SIZE;
        } else {
          // BREADBOARD HOLE SNAPPING (Like SimulatorPage.jsx)
          const bbPins = COMPONENT_REGISTRY['wokwi-breadboard']?.manifest?.pins || [];
          const bbY = 450;
          let bestDist = 12; // Snap radius
          let nearestHole = null;

          for (const p of bbPins) {
            const hX = p.x; // Breadboard is at left: 0
            const hY = bbY + p.y;
            const dist = Math.sqrt((worldAnchorX - hX) ** 2 + (worldAnchorY - hY) ** 2);
            if (dist < bestDist) {
              bestDist = dist;
              nearestHole = { x: hX, y: hY };
            }
          }

          if (nearestHole) {
            snappedAnchorX = nearestHole.x;
            snappedAnchorY = nearestHole.y;
          }
        }

        setOffsetX(snappedAnchorX - anchor.x);
        setOffsetY(snappedAnchorY - anchor.y);
      } else {
        setOffsetX(rawX);
        setOffsetY(rawY);
      }
    } else if (resizing === 'move_canvas') {
      setOffsetX(startPos.current.offX + dx);
      setOffsetY(startPos.current.offY + dy);
    } else if (resizing === 'se') {
      let newW = Math.max(10, startPos.current.w + dx);
      let newH = Math.max(10, startPos.current.h + dy);

      if (lockRatio) {
        const isRotated = compRotation % 180 !== 0;
        const ratio = isRotated ? (originalH / originalW) : (originalW / originalH);
        if (Math.abs(dx) > Math.abs(dy)) {
          newH = newW / ratio;
        } else {
          newW = newH * ratio;
        }
      }

      // Update pins proportionally from the ORIGINAL START POS
      // This prevents "drift" and "lost" pins during rapid resizing
      const scaleX = newW / startPos.current.w;
      const scaleY = newH / startPos.current.h;

      const newPins = startPos.current.pins.map(p => ({
        ...p,
        x: p.x * scaleX,
        y: p.y * scaleY
      }));

      setW(newW);
      setH(newH);
      setPins(newPins);
    }
  }, [pins, workspaceZoom, draggingPin, resizing, draggingComp, offsetX, offsetY, w, h, lockRatio]);

  const handleMouseUp = () => {
    setDraggingPin(null);
    setResizing(null);
    setDraggingComp(false);
  };

  const generatedCode = useMemo(() => {
    const reg = COMPONENT_REGISTRY[selectedType];
    const baseManifest = reg?.manifest || {};
    const finalManifest = {
      ...baseManifest,
      w: Math.round(w * 10) / 10,
      h: Math.round(h * 10) / 10,
      pins: pins.map((p, i) => ({
        ...(baseManifest.pins?.[i] || {}),
        id: p.id,
        x: Math.round(p.x * 10) / 10,
        y: Math.round(p.y * 10) / 10
      }))
    };
    return JSON.stringify(finalManifest, null, 4);
  }, [selectedType, w, h, pins]);

  const filePath = `openhw-studio-emulator/src/components/${selectedType}/manifest.json`;

  return (
    <div style={{
      display: 'flex', height: '100vh', background: '#0a0d1a', color: '#fff',
      fontFamily: 'Inter, system-ui, sans-serif', overflow: 'hidden'
    }}>
      {/* Sidebar */}
      <div style={{
        width: 320, borderRight: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', flexDirection: 'column', background: '#0f1221', zIndex: 10
      }}>
        <div style={{ padding: 20, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <h2 style={{ margin: 0, fontSize: 18, color: '#00d4ff' }}>Alignment Lab v3</h2>
          <p style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>CAD-grade Component Tuning</p>

          <div style={{ marginTop: 15, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button onClick={() => navigate('/simulator')} style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 11 }}>← Exit Lab</button>

            <div>
              <label style={{ fontSize: 9, opacity: 0.5, display: 'block', marginBottom: 4 }}>Workspace Zoom</label>
              <input type="range" min="0.5" max="4" step="0.1" value={workspaceZoom} onChange={e => setWorkspaceZoom(parseFloat(e.target.value))} style={{ width: '100%' }} />
            </div>

            <button
              onClick={() => setLockRatio(!lockRatio)}
              style={{
                padding: '8px', borderRadius: 8, fontSize: 11, fontWeight: 'bold', cursor: 'pointer',
                background: lockRatio ? '#00d4ff' : 'rgba(255,255,255,0.05)',
                border: 'none', color: lockRatio ? '#000' : '#fff',
                transition: '0.2s'
              }}
            >
              {lockRatio ? '🔒 Ratio Locked' : '🔓 Ratio Free'}
            </button>

            <button
              onClick={rotate}
              style={{
                padding: '8px', borderRadius: 8, fontSize: 11, fontWeight: 'bold', cursor: 'pointer',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff', transition: '0.2s'
              }}
              title="Shortcut: R"
            >
              🔄 Rotate 90°
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
          {Object.keys(COMPONENT_REGISTRY).sort().map(type => (
            <div
              key={type}
              onClick={() => setSelectedType(type)}
              style={{
                padding: '8px 12px', cursor: 'pointer', borderRadius: 6,
                background: selectedType === type ? '#00d4ff22' : 'transparent',
                color: selectedType === type ? '#00d4ff' : '#aab',
                fontSize: 12, marginBottom: 2, transition: '0.1s'
              }}
            >
              {type}
            </div>
          ))}
        </div>
      </div>

      {/* Main Workspace */}
      <div
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseDown={(e) => {
          handleMouseDown(e, 'canvas');
          setSelectedPinIndex(null); // Clear selection when clicking empty space
        }}
        style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: resizing === 'move_canvas' ? 'grabbing' : 'crosshair' }}
      >
        <div style={{
          position: 'absolute',
          transform: `scale(${workspaceZoom})`,
          transformOrigin: '0 0'
        }}>
          {/* Professional Pin Grid (15px) - High Visibility Neon Style */}
          <div style={{ position: 'absolute', left: 0, top: 0, width: 2000, height: 400, overflow: 'hidden', pointerEvents: 'none' }}>
            <svg width="2000" height="400">
              <defs>
                <pattern id="pinGrid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse" overflow="visible">
                  <circle cx="0" cy="0" r="4.5" fill="white" />
                  <circle cx="0" cy="0" r="3" fill="#ff0000" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#pinGrid)" opacity="0.6" />
            </svg>
          </div>

          {/* Fixed Breadboard Testing Zone - BACKGROUND LAYER (zIndex: 0) */}
          <div style={{ position: 'absolute', left: 0, top: 450, opacity: 1, pointerEvents: 'none', zIndex: 0 }}>
            <div style={{ position: 'relative', width: 990, height: 295 }}>
              <div style={{ position: 'absolute', top: -35, left: 15, fontSize: 14, fontWeight: '900', color: '#00d4ff', opacity: 0.5 }}>
                TESTING BENCH
              </div>

              {/* Base Breadboard UI */}
              <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
                {COMPONENT_REGISTRY['wokwi-breadboard']?.UI && (
                  React.createElement(COMPONENT_REGISTRY['wokwi-breadboard'].UI, {
                    state: {},
                    attrs: {},
                    isRunning: false
                  })
                )}
              </div>

              {/* Official Pin Overlay */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}>
                {COMPONENT_REGISTRY['wokwi-breadboard']?.manifest?.pins?.map(p => (
                  <div
                    key={p.id}
                    style={{
                      position: 'absolute',
                      left: p.x,
                      top: p.y,
                      width: 5,
                      height: 5,
                      background: '#2ecc71',
                      border: '1px solid #fff',
                      borderRadius: '0%',
                      transform: 'translate(-50%, -50%)',
                      boxShadow: '0 0 10px #2ecc71',
                      opacity: 0.4
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Component Under Test - FOREGROUND LAYER (zIndex: 10) */}
          <div
            onMouseDown={(e) => handleMouseDown(e, 'comp')}
            style={{
              position: 'absolute',
              left: offsetX, top: offsetY,
              width: w, height: h,
              outline: '1.5px solid #00d4ff',
              boxShadow: '0 0 20px rgba(0,212,255,0.4)',
              cursor: 'move',
              background: 'rgba(0,212,255,0.08)',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {/* The SVG UI (Visually Rotated and Scaled correctly for aspect ratio) */}
            <div style={{
              width: originalW, height: originalH,
              transform: `rotate(${compRotation}deg) scale(${compRotation % 180 === 0 ? w / originalW : h / originalW}, ${compRotation % 180 === 0 ? h / originalH : w / originalH})`,
              transformOrigin: 'center center',
              pointerEvents: 'none'
            }}>
              {COMPONENT_REGISTRY[selectedType]?.UI && (
                React.createElement(COMPONENT_REGISTRY[selectedType].UI, {
                  state: {}, attrs: {}, isRunning: false
                })
              )}
            </div>

            {/* SE Resize Handle */}
            <div
              onMouseDown={(e) => handleMouseDown(e, 'resize', 'se')}
              style={{
                position: 'absolute', right: -7, bottom: -7, width: 14, height: 14,
                background: '#00d4ff', borderRadius: '4px', cursor: 'nwse-resize',
                pointerEvents: 'all', border: '2px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
              }}
            />
          </div>

          {/* Interaction Pins (Relative to Component) */}
          {pins.map((p, i) => {
            const px = offsetX + p.x;
            const py = offsetY + p.y;
            const isSelected = selectedPinIndex === i;

            const isGridZone = py < 400;

            let isSnapped = false;
            if (isGridZone) {
              isSnapped = Math.abs(px % GRID_SIZE) < 0.1 && Math.abs(py % GRID_SIZE) < 0.1;
            } else {
              // Check proximity to real holes
              const bbPins = COMPONENT_REGISTRY['wokwi-breadboard']?.manifest?.pins || [];
              const bbY = 450;
              isSnapped = bbPins.some(hole => {
                const hX = hole.x;
                const hY = bbY + hole.y;
                return Math.abs(px - hX) < 1 && Math.abs(py - hY) < 1;
              });
            }

            return (
              <div
                key={p.id}
                onMouseDown={(e) => {
                  handleMouseDown(e, 'pin', i);
                  setSelectedPinIndex(i);
                }}
                style={{
                  position: 'absolute',
                  left: px, top: py,
                  width: 6, height: 6,
                  background: isSelected ? '#ff4757' : (isSnapped ? '#2ecc71' : 'rgba(255,255,255,0.2)'),
                  border: `1px solid ${isSelected ? '#fff' : (isSnapped ? '#fff' : 'rgba(255,255,255,0.8)')}`,
                  borderRadius: '0%',
                  cursor: 'crosshair',
                  zIndex: isSelected ? 120 : (isSnapped ? 110 : 100),
                  transform: `translate(-50%, -50%)${isSelected || isSnapped ? ' scale(1.6)' : ''}`,
                  transition: 'background 0.2s, transform 0.2s, box-shadow 0.2s',
                  pointerEvents: 'all',
                  boxShadow: isSelected ? '0 0 15px #ff4757' : (isSnapped ? '0 0 10px #2ecc71' : 'none')
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Collapsible Right Inspector Panel */}
      <div style={{
        width: rightPanelOpen ? 620 : 40,
        background: '#0f1221',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Toggle Button */}
        <button
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
          style={{
            position: 'absolute', left: 8, top: 12, width: 24, height: 24,
            background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff',
            borderRadius: 4, cursor: 'pointer', zIndex: 10
          }}
        >
          {rightPanelOpen ? '❯' : '❮'}
        </button>

        {rightPanelOpen && (
          <>
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', marginTop: 8 }}>
              <button
                onClick={() => setActiveTab('modify')}
                style={{
                  flex: 1, padding: '12px', background: 'transparent', border: 'none',
                  color: activeTab === 'modify' ? '#00d4ff' : '#889',
                  borderBottom: activeTab === 'modify' ? '2px solid #00d4ff' : 'none',
                  fontSize: 11, fontWeight: '900', cursor: 'pointer', letterSpacing: '0.1em'
                }}
              >
                MODIFY
              </button>
              <button
                onClick={() => setActiveTab('code')}
                style={{
                  flex: 1, padding: '12px', background: 'transparent', border: 'none',
                  color: activeTab === 'code' ? '#00d4ff' : '#889',
                  borderBottom: activeTab === 'code' ? '2px solid #00d4ff' : 'none',
                  fontSize: 11, fontWeight: '900', cursor: 'pointer', letterSpacing: '0.1em'
                }}
              >
                CODE
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 25 }}>
              {activeTab === 'modify' ? (
                <div>
                  <h4 style={{ margin: '0 0 20px 0', fontSize: 12, color: '#00d4ff', letterSpacing: '0.05em' }}>DIMENSIONS</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginBottom: 30 }}>
                    <div>
                      <label style={{ fontSize: 11, opacity: 0.6, display: 'block', marginBottom: 6 }}>Width (px)</label>
                      <input 
                        type="number" 
                        step="0.1"
                        value={w.toFixed(1)} 
                        onChange={(e) => {
                          const val = Math.round(parseFloat(e.target.value) * 10) / 10 || 0;
                          setW(val);
                          if (lockRatio) {
                            const isRotated = compRotation % 180 !== 0;
                            const ratio = isRotated ? (originalH / originalW) : (originalW / originalH);
                            setH(Math.round((val / ratio) * 10) / 10);
                          }
                        }}
                        style={{ width: '100%', background: '#000', border: '1px solid #334', color: '#fff', padding: '10px 12px', borderRadius: 6, fontSize: 14 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, opacity: 0.6, display: 'block', marginBottom: 6 }}>Height (px)</label>
                      <input 
                        type="number" 
                        step="0.1"
                        value={h.toFixed(1)} 
                        onChange={(e) => {
                          const val = Math.round(parseFloat(e.target.value) * 10) / 10 || 0;
                          setH(val);
                          if (lockRatio) {
                            const isRotated = compRotation % 180 !== 0;
                            const ratio = isRotated ? (originalH / originalW) : (originalW / originalH);
                            setW(Math.round((val * ratio) * 10) / 10);
                          }
                        }}
                        style={{ width: '100%', background: '#000', border: '1px solid #334', color: '#fff', padding: '10px 12px', borderRadius: 6, fontSize: 14 }}
                      />
                    </div>
                  </div>

                  <h4 style={{ margin: '0 0 20px 0', fontSize: 12, color: '#00d4ff', letterSpacing: '0.05em' }}>PIN MAPPING</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {pins.map((p, i) => (
                      <div 
                        key={p.id}
                        onClick={() => setSelectedPinIndex(i)}
                        style={{
                          padding: '12px 15px', background: selectedPinIndex === i ? '#ff475722' : 'rgba(255,255,255,0.03)',
                          borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          border: `1px solid ${selectedPinIndex === i ? '#ff4757' : 'transparent'}`,
                          cursor: 'pointer', transition: '0.2s'
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 'bold', color: selectedPinIndex === i ? '#ff4757' : '#fff' }}>{p.id}</span>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <div style={{ fontSize: 12, color: '#889', display: 'flex', alignItems: 'center', gap: 4 }}>
                            X: <input 
                              type="number" 
                              step="0.1"
                              value={p.x.toFixed(1)} 
                              onChange={(e) => {
                                const newPins = [...pins];
                                newPins[i].x = Math.round(parseFloat(e.target.value) * 10) / 10 || 0;
                                setPins(newPins);
                              }}
                              style={{ width: 55, background: 'transparent', border: 'none', color: '#fff', textAlign: 'right', fontSize: 13 }} 
                            />
                          </div>
                          <div style={{ fontSize: 12, color: '#889', display: 'flex', alignItems: 'center', gap: 4 }}>
                            Y: <input 
                              type="number" 
                              step="0.1"
                              value={p.y.toFixed(1)} 
                              onChange={(e) => {
                                const newPins = [...pins];
                                newPins[i].y = Math.round(parseFloat(e.target.value) * 10) / 10 || 0;
                                setPins(newPins);
                              }}
                              style={{ width: 55, background: 'transparent', border: 'none', color: '#fff', textAlign: 'right', fontSize: 13 }} 
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ 
                    flex: 1, background: '#000', borderRadius: 10, padding: 20, 
                    fontSize: 13, fontFamily: 'JetBrains Mono, monospace', 
                    lineHeight: '1.6', overflow: 'auto', border: '1px solid #334' 
                  }}>
                    <pre style={{ margin: 0, color: '#889' }}>{generatedCode}</pre>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginTop: 20 }}>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(generatedCode);
                        alert('Copied to clipboard!');
                      }}
                      style={{ padding: '15px', background: '#00d4ff', border: 'none', borderRadius: 10, color: '#000', fontWeight: '900', cursor: 'pointer', fontSize: 13 }}
                    >
                      COPY
                    </button>
                    <button 
                      onClick={() => {
                        const blob = new Blob([generatedCode], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'manifest.json';
                        a.click();
                      }}
                      style={{ padding: '15px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontWeight: '900', cursor: 'pointer', fontSize: 13 }}
                    >
                      DOWNLOAD
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
