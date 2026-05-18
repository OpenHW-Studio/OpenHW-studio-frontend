import React from 'react';
import { SimulationConsolePanel, TerminalIcon } from '../SimulationConsole';

function CanvasBottomControlsBase({
  validationToast,
  setValidationToast,
  isConsoleOpen,
  setIsConsoleOpen,
  consoleHeight,
  consoleEntries,
  activeConsoleTab,
  setActiveConsoleTab,
  protocolLogs,
  setProtocolLogs,
  components,
  componentTelemetryEnabled,
  setComponentTelemetryEnabled,
  telemetryMode,
  setTelemetryMode,
  telemetrySampleInterval,
  setTelemetrySampleInterval,
  selectedTelemetryComponentIds,
  setSelectedTelemetryComponentIds,
  onOpenTelemetryModal,
  onMouseDownConsoleResize,
  clearConsoleEntries,
  downloadConsoleLog,
  showCanvasMenu,
  setShowCanvasMenu,
  theme,
  history,
  isRunning,
  showInspector,
  showGrid,
  isCanvasLocked,
  isFullscreen,
  wirepointsEnabled,
  showComponentDesc,
  showConnectionsPanel,
  blocklyDisabled,
  fitToView,
  undo,
  redo,
  toggleFullscreen,
  setWirepointsEnabled,
  setWiresAlwaysOnTop,
  wiresAlwaysOnTop,
  saveHistory,
  setComponents,
  setWires,
  setProjectFiles,
  setCode,
  setSelected,
  chrome,
  applyZoomAtCenter,
  canvasZoomRef,
  canvasZoom,
  handleZoomTextClick,
}) {
  return (
    <>
      <div
        data-export-ignore="true"
        style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 100, display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '4px 6px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        onDoubleClick={e => e.stopPropagation()}
      >
        <button
          className="zoom-btn"
          onClick={() => setIsConsoleOpen(v => !v)}
          style={{ background: isConsoleOpen ? 'var(--card)' : 'none', border: isConsoleOpen ? '1px solid var(--accent)' : 'none', color: isConsoleOpen ? 'var(--accent)' : 'var(--text)', cursor: 'pointer', lineHeight: 1, padding: '4px 7px', borderRadius: 6, display: 'flex', alignItems: 'center' }}
          title="Toggle Console"
        >
          <TerminalIcon size={16} />
        </button>
        <button className="zoom-btn" onClick={() => applyZoomAtCenter(Math.max(0.25, parseFloat((canvasZoomRef.current - 0.25).toFixed(2))))} style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', lineHeight: 1, padding: '4px 7px', borderRadius: 6, display: 'flex', alignItems: 'center' }} title="Zoom Out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
        </button>
        <button onClick={handleZoomTextClick} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 11, padding: '2px 6px', borderRadius: 6, minWidth: 40, fontFamily: 'JetBrains Mono, monospace' }} title="Center & Reset Zoom (Click) | Center Only (Double Click)">{Math.round(canvasZoom * 100)}%</button>
        <button className="zoom-btn" onClick={() => applyZoomAtCenter(Math.min(2, parseFloat((canvasZoomRef.current + 0.25).toFixed(2))))} style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', lineHeight: 1, padding: '4px 7px', borderRadius: 6, display: 'flex', alignItems: 'center' }} title="Zoom In">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
        </button>
        <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 2px' }} />
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowCanvasMenu(m => !m)} style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 16, padding: '2px 7px', borderRadius: 6 }} title="Canvas Menu">⋮</button>
          {showCanvasMenu && (
            <div className="canvas-menu" onMouseLeave={() => setShowCanvasMenu(false)} style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 10, zIndex: 10000, background: theme === 'light' ? 'rgba(248, 250, 252, 0.8)' : 'rgba(13, 21, 37, 0.75)', backdropFilter: 'blur(16px) saturate(1.4)', WebkitBackdropFilter: 'blur(16px) saturate(1.4)', border: theme === 'light' ? '1px solid rgba(203, 213, 225, 0.6)' : '1px solid rgba(30, 45, 71, 0.6)', borderRadius: 12, boxShadow: theme === 'light' ? '0 8px 32px rgba(0, 0, 0, 0.08)' : '0 10px 40px rgba(0,0,0,0.5)', padding: '5px', minWidth: 190, animation: 'canvasMenuIn 0.12s cubic-bezier(0.16, 1, 0.3, 1)', transformOrigin: 'bottom right', fontFamily: "'Space Grotesk', sans-serif", willChange: 'transform, opacity, backdrop-filter', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
              <button className="canvas-menu-item" onClick={() => { fitToView('fit'); setShowCanvasMenu(false); }}>Fit to Canvas</button>
              <button className={`canvas-menu-item${history.past.length === 0 || isRunning ? ' canvas-menu-item--disabled' : ''}`} onClick={() => { undo(); setShowCanvasMenu(false); }} disabled={history.past.length === 0 || isRunning}>Undo</button>
              <button className={`canvas-menu-item${history.future.length === 0 || isRunning ? ' canvas-menu-item--disabled' : ''}`} onClick={() => { redo(); setShowCanvasMenu(false); }} disabled={history.future.length === 0 || isRunning}>Redo</button>
              <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
              <button className="canvas-menu-item" onClick={() => { chrome.setShowInspector(v => !v); setShowCanvasMenu(false); }}>{showInspector ? 'Disable Inspector' : 'Enable Component Inspector'}</button>
              <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
              <button className="canvas-menu-item" onClick={() => { chrome.setShowGrid(g => !g); setShowCanvasMenu(false); }}>{showGrid ? 'Hide Grid' : 'Show Grid'}</button>
              <button className="canvas-menu-item" onClick={() => { chrome.setIsCanvasLocked(l => !l); setShowCanvasMenu(false); }}>{isCanvasLocked ? 'Unlock Canvas' : 'Lock Canvas'}</button>
              <button className="canvas-menu-item" onClick={() => { toggleFullscreen(); setShowCanvasMenu(false); }}>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</button>
              <button className="canvas-menu-item" onClick={() => { setWirepointsEnabled(v => !v); setShowCanvasMenu(false); }}>{wirepointsEnabled ? 'Disable Wire Waypoints' : 'Enable Wire Waypoints'}</button>
              <button className="canvas-menu-item" onClick={() => { chrome.setShowComponentDesc(d => !d); setShowCanvasMenu(false); }}>{showComponentDesc ? 'Hide Component Info' : 'Show Component Info'}</button>
              <button className="canvas-menu-item" onClick={() => { setWiresAlwaysOnTop(v => !v); setShowCanvasMenu(false); }}>{wiresAlwaysOnTop ? 'Move Wires to Bottom' : 'Move Wires to Top'}</button>
              <button className="canvas-menu-item" onClick={() => { chrome.setShowConnectionsPanel(p => !p); setShowCanvasMenu(false); }}>{showConnectionsPanel ? 'Hide Connections Panel' : 'Show Connections Panel'}</button>
              <button className="canvas-menu-item" onClick={() => { const next = !blocklyDisabled; chrome.setBlocklyDisabled(next); setShowCanvasMenu(false); }} title={blocklyDisabled ? 'Re-enable block code editor (uses more CPU)' : 'Disable block code editor to improve canvas performance'}>{blocklyDisabled ? 'Enable Block Coding' : 'Disable Block Coding'}</button>
              <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
              <button className="canvas-menu-item canvas-menu-item--danger" onClick={() => { if (!isRunning) { saveHistory(); setComponents([]); setWires([]); if (setProjectFiles) setProjectFiles(prev => prev.filter(f => f.id === 'project/diagram.json')); if (setCode) setCode(''); setSelected(null); } setShowCanvasMenu(false); }}>Clear Canvas</button>
            </div>
          )}
        </div>
      </div>

      <SimulationConsolePanel
        isOpen={isConsoleOpen}
        height={consoleHeight}
        entries={consoleEntries}
        activeTab={activeConsoleTab}
        onTabChange={setActiveConsoleTab}
        protocolLogs={protocolLogs}
        componentTelemetryEnabled={componentTelemetryEnabled}
        setComponentTelemetryEnabled={setComponentTelemetryEnabled}
        telemetryMode={telemetryMode}
        setTelemetryMode={setTelemetryMode}
        telemetrySampleInterval={telemetrySampleInterval}
        setTelemetrySampleInterval={setTelemetrySampleInterval}
        selectedTelemetryComponentIds={selectedTelemetryComponentIds}
        onOpenTelemetryModal={onOpenTelemetryModal}
        onResizeStart={onMouseDownConsoleResize}
        onClose={() => setIsConsoleOpen(false)}
        onClear={() => {
          if (activeConsoleTab === 'telemetry') {
            setProtocolLogs([]);
            clearConsoleEntries('telemetry');
          } else {
            clearConsoleEntries('console');
          }
        }}
        onDownload={() => downloadConsoleLog(activeConsoleTab, protocolLogs, telemetryMode, 'json')}
        onDownloadLog={() => downloadConsoleLog(activeConsoleTab, protocolLogs, telemetryMode, 'log')}
      />
    </>
  );
}

export const CanvasBottomControls = React.memo(CanvasBottomControlsBase);