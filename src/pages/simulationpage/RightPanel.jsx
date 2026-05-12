import React from 'react';
import EditorComponent from 'react-simple-code-editor';
const Editor = EditorComponent.default || EditorComponent;
import Prism from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import { Btn } from './Btn';
import { getBoardColors } from './projectUtils';
import PlotterCanvas from './PlotterCanvas';
 
const PLOTTER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c'];



// Lazy-load the heavy Blockly editor to improve initial LCP metrics
const BlocklyEditor = React.lazy(() => import('../../components/BlocklyEditor.jsx'));

const DISABLED_FILE_SUFFIX = '.disabled';

function RightPanelInternal(props) {

  const {
    isPanelOpen, panelWidth, isDragging, onMouseDownResize, setIsPanelOpen,
    explorerWidth, isExplorerDragging, onMouseDownExplorerResize,
    validationErrors, showValidation, setShowValidation,
    healthScore = 100, applyFix,
    codeTab, setCodeTab, code, setCode, 
    blocklyXml, setBlocklyXml, blocklyGeneratedCode, setBlocklyGeneratedCode, useBlocklyCode, setUseBlocklyCode,
    projectFiles, openCodeTabs, activeCodeFileId, showCodeExplorer,
    onToggleCodeExplorer, onOpenCodeFile, onCloseCodeTab,
    onSaveCodeFile, onDuplicateCodeFile, onRenameCodeFile, onDeleteCodeFile, onDownloadCodeFile,
    onToggleCodeFileDisabled,
    onCreateCodeFile, onCreateCodeTab, onUploadCodeFile,
    libQuery, setLibQuery, handleSearchLibraries, isSearchingLib, libMessage, libInstalled, libResults, handleInstallLibrary, installingLib,
    serialPaused, setSerialPaused, isRunning, serialHistory, setSerialHistory, serialOutputRef, serialInput, setSerialInput, sendSerialInput, clearSerialMonitor,
    serialViewMode, setSerialViewMode, serialBoardFilter, setSerialBoardFilter, serialBoardOptions, serialBoardLabels, serialBoardKinds, serialBoardSourceModes, serialBaudRate, setSerialBaudRate, serialBaudOptions, serialLineEnding, setSerialLineEnding,
    hardwareConnected,
    plotterPaused, setPlotterPaused, plotDataRef, selectedPlotPins, setSelectedPlotPins, serialPlotLabelsRef,
    showConnectionsPanel, wires, updateWireColor, deleteWire,
    selected, setSelected,
    blocklyDisabled, setBlocklyDisabled,
    boardComponentMap, onToggleBoardFirmwareSource,
    theme,
    projectName,
    editingDisabled = false,
    editingDisabledMessage = 'Editing is disabled.',
    boardLineEndings, setBoardLineEndings,
    boardAutoscrolls, setBoardAutoscrolls,
    boardBaudRates, setBoardBaudRates,
    boardPausedStates, setBoardPausedStates,
    boardInputs, setBoardInputs,
    isSerialSplit, setIsSerialSplit,
    serialSplitRatio, setSerialSplitRatio,
    serialBoardFilter2, setSerialBoardFilter2,
    plotterTimeDiv, setPlotterTimeDiv
  } = props;

  const [fileMenu, setFileMenu] = React.useState(null); // { x, y, fileId }
  const [folderMenu, setFolderMenu] = React.useState(null); // { x, y, boardId }
  const [collapsedBoards, setCollapsedBoards] = React.useState({});
  const [serialSendTarget, setSerialSendTarget] = React.useState(
    serialBoardFilter && serialBoardFilter !== 'all' ? serialBoardFilter : 'all'
  );
  const [showSendTargetMenu, setShowSendTargetMenu] = React.useState(false);

  const [isLibPanelOpen, setIsLibPanelOpen] = React.useState(false);
  const [plotterPaused2, setPlotterPaused2] = React.useState(false);
  const [showAddChannel, setShowAddChannel] = React.useState(false);

  const sendMenuRef = React.useRef(null);
  const sendMenuRef2 = React.useRef(null);
  const serialOutputRef2 = React.useRef(null);

  const [isSerialResizing, setIsSerialResizing] = React.useState(false);

  React.useEffect(() => {
    if (isSerialSplit && !serialBoardFilter2) {
      const boards = (serialBoardOptions || []).filter(id => id !== 'all');
      if (boards.length > 1) {
        setSerialBoardFilter2(boards[1]);
      } else if (boards.length > 0) {
        setSerialBoardFilter2(boards[0]);
      }
    }
  }, [isSerialSplit, serialBoardOptions, serialBoardFilter2]);

  const onPointerDownSerialResize = React.useCallback((e) => {
    e.preventDefault();
    e.target.setPointerCapture(e.pointerId);
    setIsSerialResizing(true);
  }, []);

  const onPointerMoveSerialResize = React.useCallback((e) => {
    if (!isSerialResizing) return;
    const serialContainer = document.getElementById('serial-container');
    if (!serialContainer) return;
    
    const rect = serialContainer.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const ratio = relativeY / rect.height;

    // Snap-to-close logic
    if (ratio < 0.05) {
      setSerialBoardFilter(serialBoardFilter2);
      setIsSerialSplit(false);
      setIsSerialResizing(false);
      return;
    }
    if (ratio > 0.95) {
      setIsSerialSplit(false);
      setIsSerialResizing(false);
      return;
    }

    setSerialSplitRatio(Math.max(0.1, Math.min(0.9, ratio)));
  }, [isSerialResizing, serialBoardFilter2]);

  const onPointerUpSerialResize = React.useCallback((e) => {
    setIsSerialResizing(false);
  }, []);

  // ── Block Editor enable/disable toggle (persisted via props from SimulatorPage) ─
  const toggleBlocklyDisabled = React.useCallback(() => {
    if (!setBlocklyDisabled) return;
    setBlocklyDisabled(prev => {
      const next = !prev;
      try { localStorage.setItem('ohw_blockly_disabled', String(next)); } catch (_) {}
      return next;
    });
  }, [setBlocklyDisabled]);


  React.useEffect(() => {
    const onWindowClick = () => {
      setFileMenu(null);
      setFolderMenu(null);
    };
    window.addEventListener('click', onWindowClick);
    return () => window.removeEventListener('click', onWindowClick);
  }, []);

  const projectRootFiles = React.useMemo(() => {
    return (projectFiles || [])
      .filter((f) => f.path.startsWith('project/') && f.path.split('/').length === 2)
      .filter((f) => f.id !== 'project/diagram.png')
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [projectFiles]);

  const projectBoardFiles = React.useMemo(() => {
    const grouped = new Map();
    (projectFiles || [])
      .filter((f) => f.path.startsWith('project/') && f.path.split('/').length >= 3)
      .forEach((f) => {
        const boardId = f.path.split('/')[1];
        if (!grouped.has(boardId)) grouped.set(boardId, []);
        grouped.get(boardId).push(f);
      });

    const boardIds = new Set([
      ...Object.keys(serialBoardKinds || {}),
      ...grouped.keys(),
    ]);

    return [...boardIds]
      .sort((a, b) => a.localeCompare(b))
      .map((boardId) => ({
        boardId,
        files: (grouped.get(boardId) || []).sort((a, b) => a.path.localeCompare(b.path)),
      }));
  }, [projectFiles, serialBoardKinds]);

  const openFiles = React.useMemo(() => {
    const map = new Map((projectFiles || []).map((f) => [f.id, f]));
    return (openCodeTabs || []).map((id) => map.get(id)).filter(Boolean);
  }, [openCodeTabs, projectFiles]);

  const activeFile = React.useMemo(() => {
    return (projectFiles || []).find((f) => f.id === activeCodeFileId) || null;
  }, [projectFiles, activeCodeFileId]);

  const activeFileExt = React.useMemo(() => {
    const rawName = String(activeFile?.name || '').toLowerCase();
    const name = rawName.endsWith(DISABLED_FILE_SUFFIX)
      ? rawName.slice(0, -DISABLED_FILE_SUFFIX.length)
      : rawName;
    const idx = name.lastIndexOf('.');
    return idx >= 0 ? name.slice(idx) : '';
  }, [activeFile?.name]);

  const editorLanguage = React.useMemo(() => {
    if (activeFileExt === '.py') return 'python';
    if (activeFileExt === '.json') return 'json';
    if (activeFileExt === '.xml') return 'markup';
    if (activeFileExt === '.h' || activeFileExt === '.hpp' || activeFileExt === '.c' || activeFileExt === '.cpp' || activeFileExt === '.ino') return 'cpp';
    return 'cpp';
  }, [activeFileExt]);

  const highlightCode = React.useCallback((value) => {
    if (editorLanguage === 'python') return Prism.highlight(value || '', Prism.languages.python, 'python');
    if (editorLanguage === 'json') return Prism.highlight(value || '', Prism.languages.json, 'json');
    if (editorLanguage === 'markup') return Prism.highlight(value || '', Prism.languages.markup, 'markup');
    return Prism.highlight(value || '', Prism.languages.cpp, 'cpp');
  }, [editorLanguage]);

  const filteredSerialHistory = serialBoardFilter === 'all'
    ? serialHistory
    : serialHistory.filter((entry) => entry.boardId === serialBoardFilter);

  const filteredSerialHistory2 = serialBoardFilter2 === 'all'
    ? serialHistory
    : serialHistory.filter((entry) => entry.boardId === serialBoardFilter2);

  React.useEffect(() => {
    const autoscroll = boardAutoscrolls[serialBoardFilter] ?? true;
    if (autoscroll && serialOutputRef.current) {
      serialOutputRef.current.scrollTop = serialOutputRef.current.scrollHeight;
    }
  }, [filteredSerialHistory, serialBoardFilter, boardAutoscrolls]);

  React.useEffect(() => {
    const autoscroll = boardAutoscrolls[serialBoardFilter2] ?? true;
    if (autoscroll && serialOutputRef2.current) {
      serialOutputRef2.current.scrollTop = serialOutputRef2.current.scrollHeight;
    }
  }, [filteredSerialHistory2, serialBoardFilter2, boardAutoscrolls]);

  const boardColors = React.useMemo(() => getBoardColors(serialBoardOptions), [serialBoardOptions]);

  React.useEffect(() => {
    if (!serialBoardOptions?.length) {
      setSerialSendTarget('all');
      return;
    }
    if (!serialBoardOptions.includes(serialSendTarget)) {
      setSerialSendTarget(serialBoardOptions.includes('all') ? 'all' : serialBoardOptions[0]);
    }
  }, [serialBoardOptions, serialSendTarget]);

  React.useEffect(() => {
    if (serialBoardFilter === 'all') {
      setSerialSendTarget('all');
      return;
    }
    setSerialSendTarget(serialBoardFilter);
    setShowSendTargetMenu(false);
  }, [serialBoardFilter]);

  React.useEffect(() => {
    const onDocMouseDown = (event) => {
      if (!showSendTargetMenu) return;
      if (sendMenuRef.current && sendMenuRef.current.contains(event.target)) return;
      setShowSendTargetMenu(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [showSendTargetMenu]);

  const UNO_BASE_PINS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
  const PICO_BASE_PINS = Array.from({ length: 29 }, (_, idx) => `GP${idx}`);
  const getBasePinsForKind = (kind) => (kind === 'rp2040' ? PICO_BASE_PINS : UNO_BASE_PINS);

  const activeKinds = React.useMemo(() => {
    if (serialBoardFilter && serialBoardFilter !== 'all') {
      return [serialBoardKinds?.[serialBoardFilter] || 'arduino_uno'];
    }
    const kinds = new Set();
    (serialBoardOptions || []).forEach((id) => {
      if (id === 'all') return;
      kinds.add(serialBoardKinds?.[id] || 'arduino_uno');
    });
    if (kinds.size === 0) kinds.add('arduino_uno');
    return Array.from(kinds);
  }, [serialBoardFilter, serialBoardOptions, serialBoardKinds]);

  const basePins = React.useMemo(() => {
    const allPins = new Set();
    activeKinds.forEach((kind) => {
      getBasePinsForKind(kind).forEach((pin) => allPins.add(pin));
    });
    return Array.from(allPins);
  }, [activeKinds]);

  const serialOnlyLabels = serialPlotLabelsRef.current.filter(l => !basePins.includes(l));
  const availablePins = [...basePins, ...serialOnlyLabels];

  return (
    <aside className="relative bg-[var(--bg2)] border-l border-[var(--border)] flex flex-col shrink-0 overflow-hidden transition-[width] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]" 
      style={{ width: isPanelOpen ? panelWidth : 21, transition: isDragging ? 'none' : 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {/* Drag Handle */}
      {isPanelOpen && (
        <div
          onMouseDown={onMouseDownResize}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 5,
            cursor: 'col-resize',
            zIndex: 10,
            background: 'transparent'
          }}
        />
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        style={{
          position: 'absolute',
          left: isPanelOpen ? 0 : 0,
          top: '50%',
          transform: 'translateY(-50%)',
          height: 48,
          width: 20,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderLeft: 'none',
          borderRadius: '0 8px 8px 0',
          color: 'var(--text3)',
          cursor: 'pointer',
          zIndex: 11,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '2px 0 8px rgba(0,0,0,0.2)'
        }}
      >
        {isPanelOpen ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        )}
      </button>

      {isPanelOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', paddingLeft: 12 }}>
          {/* Validation panel */}
          {validationErrors.length > 0 && showValidation && (
            <div className="bg-[var(--bg3)] border-b border-[var(--border)] shrink-0">
              <div className="flex items-center justify-between px-3 py-2 text-xs font-bold text-[var(--orange)]">
                <div className="flex items-center gap-2">
                   <div style={{
                     width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden'
                   }}>
                      <div style={{
                        width: `${healthScore}%`, height: '100%',
                        background: healthScore > 80 ? 'var(--green)' : healthScore > 50 ? 'var(--orange)' : 'var(--red)',
                        transition: 'width 0.5s ease-out'
                      }} />
                   </div>
                   <span>Project Health: {healthScore}%</span>
                </div>
                <button className="bg-transparent border-none text-[var(--text3)] cursor-pointer text-sm font-inherit" onClick={() => setShowValidation(false)}>✕</button>
              </div>
              {validationErrors.map((err, i) => {
                const isError = err.severity === 'error' || err.type === 'error';
                const confidence = err.confidence ? `${Math.round(err.confidence * 100)}%` : 'unknown';
                return (
                <div key={i} className="px-3 py-2 text-xs border-l-4 mb-0.5 leading-relaxed group relative" style={{
                  borderLeftColor: isError ? 'var(--red)' : 'var(--orange)',
                  background: 'rgba(0,0,0,0.1)'
                }}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <span style={{ color: isError ? 'var(--red)' : 'var(--orange)' }}>
                        {isError ? '🔴' : '🟡'} {err.message}
                      </span>
                      {err.remediation && (
                        <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}>
                          💡 {err.remediation}
                        </div>
                      )}
                      {err.details?.rootCauseGroup && (
                        <div style={{ fontSize: '9px', color: 'var(--text4)', marginTop: '2px' }}>
                          Root cause: {err.details.rootCauseGroup}
                        </div>
                      )}
                    </div>
                    {err.remediation && applyFix && (
                      <div className="shrink-0 flex gap-1">
                        <button 
                          onClick={() => applyFix(err)}
                          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-black font-bold px-2 py-0.5 rounded text-[10px] flex items-center gap-1 transition-all"
                          title={`Fix with ${confidence} confidence`}
                        >
                          <span>🪄</span>
                          <span>FIX</span>
                          <span style={{ fontSize: '8px', opacity: 0.7 }}>({confidence})</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
              })}
            </div>
          )}

          {/* Wires list */}
          {showConnectionsPanel && (
            <div className="bg-[var(--bg3)] border-b border-[var(--border)] max-h-[140px] overflow-y-auto shrink-0 panel-scroll" >
              <div className="text-[11px] font-bold text-[var(--text3)] uppercase tracking-widest px-3 pt-2 pb-1">Connections ({wires.length})</div>
              {wires.length === 0 ? (
                <div style={{ padding: '12px 12px 16px', fontSize: 12, color: 'var(--text3)' }}>
                  No wires connected.
                </div>
              ) : (
                wires.map(w => (
                  <div key={w.id} className="flex items-center gap-2 px-3 py-1 border-b border-[var(--border)]">
                    <input
                      type="color"
                      value={w.color}
                      onChange={e => updateWireColor(w.id, e.target.value)}
                      style={{ width: 14, height: 14, padding: 0, border: 'none', cursor: 'pointer', background: 'transparent' }}
                      title="Change wire color"
                    />
                    <span style={{ flex: 1, fontSize: 10, color: 'var(--text2)', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {w.from} → {w.to}
                    </span>
                    <button className="bg-transparent border-none text-[var(--text3)] cursor-pointer text-xs font-inherit shrink-0" onClick={() => deleteWire(w.id)}>✕</button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Code editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              borderBottom: '1px solid var(--border)', 
              background: 'var(--bg2)', 
              padding: '0 12px', 
              height: 44, 
              flexShrink: 0,
              gap: 8
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                width: codeTab === 'code' ? '120px' : '0px',
                opacity: codeTab === 'code' ? 1 : 0,
                overflow: 'hidden',
                pointerEvents: codeTab === 'code' ? 'auto' : 'none',
              }}>
                {onToggleCodeExplorer && (
                  <button
                    onClick={onToggleCodeExplorer}
                    title={showCodeExplorer ? 'Hide explorer' : 'Show explorer'}
                    className="group"
                    style={{ 
                      padding: "6px 10px",
                      background: showCodeExplorer ? 'rgba(0,255,255,0.08)' : 'transparent',
                      border: `1px solid ${showCodeExplorer ? 'var(--accent)' : 'transparent'}`,
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      color: showCodeExplorer ? 'var(--accent)' : 'var(--text3)',
                      fontSize: 12,
                      fontWeight: 600,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: showCodeExplorer ? 1 : 0.7 }}>
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="9" y1="3" x2="9" y2="21" />
                    </svg>
                    <span className="hidden sm:inline">Explorer</span>
                  </button>
                )}
                <div style={{ height: 20, minWidth: 1, background: 'var(--border)', margin: '0 4px' }} />
              </div>

              <div style={{ 
                display: 'flex', 
                flex: 1, 
                gap: 4, 
                background: 'rgba(0,0,0,0.15)', 
                padding: '3px', 
                borderRadius: '8px', 
                border: '1px solid var(--border)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Sliding indicator */}
                <div style={{
                  position: 'absolute',
                  top: '3px',
                  bottom: '3px',
                  left: '3px',
                  width: 'calc((100% - 6px - 8px) / 3)', 
                  background: 'var(--accent)',
                  borderRadius: '6px',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: `translateX(calc(${['code', 'block', 'serial'].indexOf(codeTab)} * (100% + 4px)))`,
                  zIndex: 0
                }} />
                {[
                  { id: 'code', label: 'Code', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg> },
                  { id: 'block', label: 'Blocks', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg> },
                  { id: 'serial', label: 'Serial', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg> },
                ].map(({ id, label, icon }) => (
                  <button
                    key={id}
                    onClick={() => setCodeTab(id)}
                    className="group"
                    style={{
                      flex: 1,
                      padding: '6px 4px',
                      borderRadius: '6px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      color: codeTab === id ? '#000' : 'var(--text3)',
                      background: 'transparent',
                      boxShadow: 'none',
                      fontFamily: 'inherit',
                      minWidth: 0,
                      zIndex: 1,
                      position: 'relative'
                    }}
                  >
                    <span style={{ opacity: codeTab === id ? 1 : 0.7, flexShrink: 0 }}>{icon}</span>
                    <span style={{ 
                      display: 'inline-block', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap' 
                    }}>{label}</span>
                  </button>
                ))}
              </div>
            </div>
            {codeTab === 'code' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--bg)', position: 'relative' }}>
                <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
                  {showCodeExplorer && (
                    <>
                      <div style={{ width: explorerWidth, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg2)', flexShrink: 0 }}>
                        <div className="panel-scroll" onClick={() => {
                          if (setSelected) setSelected(null);
                          if (onOpenCodeFile) onOpenCodeFile(null);
                          setFileMenu(null);
                        }} style={{ flex: 1, overflow: 'auto', cursor: 'default' }}>
                          <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={projectName || 'project'}>{projectName || 'project'}</div>

                          {projectRootFiles.map((file) => (
                            <div
                              key={file.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setFileMenu(null);
                                onOpenCodeFile(file.id);
                                if (setSelected) setSelected(null);
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setFileMenu({ x: e.clientX, y: e.clientY, fileId: file.id });
                              }}
                              style={{
                                padding: '3px 10px',
                                fontSize: (file.name === 'diagram.json' || file.name === 'library.txt') ? 11 : 12,
                                cursor: 'pointer',
                                color: activeCodeFileId === file.id ? 'var(--accent)' : 'var(--text2)',
                                background: activeCodeFileId === file.id ? 'rgba(0,255,255,0.08)' : 'transparent',
                                borderLeft: activeCodeFileId === file.id ? '2px solid var(--accent)' : '2px solid transparent',
                                fontFamily: 'JetBrains Mono, monospace',
                              }}
                            >
                              {file.name}{file.dirty ? ' *' : ''}
                            </div>
                          ))}

                          {projectBoardFiles.map((group) => (
                            <div key={group.boardId}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCollapsedBoards((prev) => ({ ...prev, [group.boardId]: !prev[group.boardId] }));
                                  if (setSelected) {
                                    setSelected(group.boardId);
                                  }
                                  setFileMenu(null);
                                  setFolderMenu(null);
                                }}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setFolderMenu({ x: e.clientX, y: e.clientY, boardId: group.boardId });
                                  setFileMenu(null);
                                }}
                                style={{
                                  width: '100%',
                                  textAlign: 'left',
                                  padding: '2px 0px 4px',
                                  fontSize: 12,
                                  color: selected === group.boardId ? 'var(--accent)' : 'var(--text3)',
                                  fontWeight: 700,
                                  fontFamily: 'JetBrains Mono, monospace',
                                  background: selected === group.boardId ? 'rgba(0,255,255,0.06)' : 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  transition: 'all 0.2s'
                                }}
                                title={collapsedBoards[group.boardId] ? 'Expand folder' : 'Collapse folder'}
                              >
                                <span style={{ width: 14, display: 'inline-flex', justifyContent: 'center', opacity: 0.7 }}>
                                  {!collapsedBoards[group.boardId] ? (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                  ) : (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                  )}
                                </span>
                                <span style={{
                                  width: 7,
                                  height: 7,
                                  borderRadius: '50%',
                                  background: boardColors[group.boardId] || '#64748b',
                                  boxShadow: `0 0 0 1px ${(boardColors[group.boardId] || '#64748b')}55`,
                                  display: 'inline-block'
                                }} />
                                <span>{group.boardId}</span>
                              </button>
                              {!collapsedBoards[group.boardId] && group.files.map((file) => (
                                <div
                                  key={file.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFileMenu(null);
                                    onOpenCodeFile(file.id);
                                    if (setSelected) setSelected(null);
                                  }}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setFileMenu({ x: e.clientX, y: e.clientY, fileId: file.id });
                                  }}
                                  style={{
                                    padding: '3px 10px 1px 18px',
                                    fontSize: (file.name === 'diagram.json' || file.name === 'library.txt') ? 10 : 12,
                                    cursor: 'pointer',
                                    color: activeCodeFileId === file.id ? 'var(--accent)' : 'var(--text2)',
                                    background: activeCodeFileId === file.id ? 'rgba(0,255,255,0.08)' : 'transparent',
                                    borderLeft: activeCodeFileId === file.id ? '2px solid var(--accent)' : '2px solid transparent',
                                    fontFamily: 'JetBrains Mono, monospace',
                                    textDecoration: String(file.name || '').toLowerCase().endsWith(DISABLED_FILE_SUFFIX) ? 'line-through' : 'none',
                                    opacity: String(file.name || '').toLowerCase().endsWith(DISABLED_FILE_SUFFIX) ? 0.7 : 1,
                                  }}
                                >
                                  {file.name}{file.dirty ? ' *' : ''}
                                </div>
                              ))}
                              {!collapsedBoards[group.boardId] && group.files.length === 0 && (
                                <div
                                  style={{
                                    padding: '3px 10px 4px 18px',
                                    fontSize: 11,
                                    color: 'var(--text3)',
                                    fontStyle: 'italic',
                                    fontFamily: 'JetBrains Mono, monospace',
                                  }}
                                >
                                  (empty)
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Libraries Button at bottom of Explorer */}
                        <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.05)' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFileMenu(null);
                              setIsLibPanelOpen(!isLibPanelOpen);
                            }}
                            className="group"
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              background: isLibPanelOpen ? 'rgba(0,255,255,0.1)' : 'transparent',
                              border: `1px solid ${isLibPanelOpen ? 'var(--accent)' : 'var(--border)'}`,
                              color: isLibPanelOpen ? 'var(--accent)' : 'var(--text2)',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: isLibPanelOpen ? 1 : 0.7 }}>
                              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                              <path d="M12 6v10" />
                              <path d="M8 10h8" />
                            </svg>
                            <span>Libraries</span>
                          </button>
                        </div>
                      </div>
                    {/* Internal Explorer Resize Handle */}
                    <div
                      onMouseDown={onMouseDownExplorerResize}
                      style={{
                        width: 4,
                        cursor: 'col-resize',
                        background: isExplorerDragging ? 'var(--accent)' : 'transparent',
                        zIndex: 10,
                        transition: 'background 0.2s',
                        borderRight: '1px solid var(--border)',
                        marginLeft: -2,
                        marginRight: -2,
                      }}
                      className="hover:bg-[var(--accent)]"
                    />
                  </>
                )}

                {/* Small Library Panel Overlay */}
                {isLibPanelOpen && (
                  <div style={{
                    width: Math.min(320, panelWidth - 40),
                    borderRight: '1px solid var(--border)',
                    background: 'var(--bg2)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    zIndex: 5,
                    boxShadow: '4px 0 12px rgba(0,0,0,0.2)',
                  }}>
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg3)' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Library Manager</span>
                      <button 
                        onClick={() => setIsLibPanelOpen(false)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 14 }}
                        className="hover:text-[var(--red)] transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', padding: 12 }}>
                      <form onSubmit={handleSearchLibraries} style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                        <input
                          className="bg-[var(--card)] border border-[var(--border)] text-[var(--text)] px-2.5 py-1.5 rounded-lg text-xs outline-none font-inherit flex-1"
                          placeholder="Search Arduino library..."
                          value={libQuery}
                          onChange={e => setLibQuery(e.target.value)}
                        />
                        <Btn color="var(--accent)" disabled={isSearchingLib}>
                          {isSearchingLib ? '...' : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>}
                        </Btn>
                      </form>

                      {libMessage && (
                        <div style={{ padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 12, background: libMessage.type === 'error' ? 'rgba(255,68,68,0.1)' : 'rgba(0,230,118,0.1)', color: libMessage.type === 'error' ? 'var(--red)' : 'var(--green)', border: `1px solid ${libMessage.type === 'error' ? 'rgba(255,68,68,0.3)' : 'rgba(0,230,118,0.3)'}` }}>
                          {libMessage.text}
                        </div>
                      )}

                      <div className="panel-scroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {libResults.length > 0 && <div style={{ fontSize: 10, fontWeight: 'bold', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>Search Results</div>}
                        {libResults.map((lib, idx) => (
                          <div key={idx} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)', wordBreak: 'break-word' }}>{lib.name}</div>
                                {lib.author && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{lib.author}</div>}
                              </div>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <a 
                                  href={`https://www.arduino.cc/reference/en/libraries/${(lib.name || '').toLowerCase().replace(/ /g, '-')}/`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'flex',
                                    padding: '4px',
                                    borderRadius: '4px',
                                    color: 'var(--text3)',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid var(--border)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s'
                                  }}
                                  className="hover:text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[rgba(0,255,255,0.05)]"
                                  title="View on Arduino Website"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                    <polyline points="15 3 21 3 21 9" />
                                    <line x1="10" y1="14" x2="21" y2="3" />
                                  </svg>
                                </a>
                                <Btn
                                  color="var(--green)"
                                  disabled={installingLib === lib.name}
                                  onClick={() => handleInstallLibrary(lib.name)}
                                  style={{ padding: '2px 8px', fontSize: 10 }}
                                >
                                  {installingLib === lib.name ? '...' : 'Install'}
                                </Btn>
                              </div>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6, lineHeight: 1.3 }}>{lib.sentence}</div>
                            <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace' }}>
                              <span>v{lib.version}</span>
                            </div>
                          </div>
                        ))}

                        {libResults.length === 0 && (
                          <>
                            <div style={{ fontSize: 10, fontWeight: 'bold', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>Installed</div>
                            {libInstalled.length === 0 ? (
                              <div style={{ fontSize: 12, color: 'var(--text3)' }}>No external libraries.</div>
                            ) : (
                              libInstalled.map((lib, idx) => (
                                <div key={idx} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, opacity: 0.85 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', wordBreak: 'break-word', flex: 1 }}>{lib.library.name}</div>
                                    <a 
                                      href={`https://www.arduino.cc/reference/en/libraries/${(lib.library.name || '').toLowerCase().replace(/ /g, '-')}/`} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      style={{
                                        display: 'flex',
                                        padding: '4px',
                                        borderRadius: '4px',
                                        color: 'var(--text3)',
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid var(--border)',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                        marginLeft: 6
                                      }}
                                      className="hover:text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[rgba(0,255,255,0.05)]"
                                      title="View on Arduino Website"
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                        <polyline points="15 3 21 3 21 9" />
                                        <line x1="10" y1="14" x2="21" y2="3" />
                                      </svg>
                                    </a>
                                  </div>
                                  <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace', marginTop: 4 }}>
                                    <span>v{lib.library.version}</span>
                                    <span>Installed</span>
                                  </div>
                                </div>
                              ))
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, pointerEvents: editingDisabled ? 'none' : 'auto' }}>
                    <div className="panel-scroll hide-scrollbar" style={{ display: 'flex', gap: 2, overflowX: 'auto', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      {openFiles.map((file) => (
                        <div
                          key={file.id}
                          onClick={() => onOpenCodeFile(file.id)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setFileMenu({ x: e.clientX, y: e.clientY, fileId: file.id });
                          }}
                          className={`group transition-all duration-200 ${activeCodeFileId === file.id ? 'bg-[rgba(0,255,255,0.06)]' : 'hover:bg-[rgba(255,255,255,0.03)]'}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 7,
                            padding: '8px 16px',
                            fontSize: 11,
                            cursor: 'pointer',
                            borderBottom: activeCodeFileId === file.id ? '2px solid var(--accent)' : '2px solid transparent',
                            color: activeCodeFileId === file.id ? 'var(--accent)' : 'var(--text2)',
                            fontFamily: 'JetBrains Mono, monospace',
                            whiteSpace: 'nowrap',
                            userSelect: 'none',
                            fontWeight: activeCodeFileId === file.id ? 600 : 400,
                            textDecoration: String(file.name || '').toLowerCase().endsWith(DISABLED_FILE_SUFFIX) ? 'line-through' : 'none',
                            opacity: activeCodeFileId === file.id ? 1 : (String(file.name || '').toLowerCase().endsWith(DISABLED_FILE_SUFFIX) ? 0.6 : 0.85),
                          }}
                        >
                          <span>{file.name}{file.dirty ? ' *' : ''}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); onCloseCodeTab(file.id); }}
                            style={{
                              border: '1px solid transparent',
                              background: 'transparent',
                              color: 'var(--text3)',
                              cursor: 'pointer',
                              padding: 3,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '4px',
                              transition: 'all 0.1s ease-in-out'
                            }}
                            className="hover:bg-[rgba(255,68,68,0.15)] hover:text-[var(--red)] hover:border-[rgba(255,68,68,0.3)] active:scale-90"
                            title="Close tab"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      <div style={{ marginLeft: 'auto', padding: '7px 10px', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.7, display: 'flex', alignItems: 'center' }}>
                        {editorLanguage}
                      </div>
                    </div>

                    <div className="panel-scroll hide-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
                      {(() => {
                        if (!activeFile || !boardComponentMap) return null;
                        const pathParts = activeFile.path.split('/');
                        if (pathParts.length < 3 || pathParts[0] !== 'project') return null;
                        
                        const boardId = pathParts[1];
                        const boardComp = boardComponentMap.get(boardId);
                        if (!boardComp || !boardComp.attrs?.useUploadedFirmware) return null;
                        
                        const firmwareName = boardComp.attrs.firmwareArtifactName || 'custom binary';
                        
                        return (
                          <div className="bg-[var(--accent)]/5 border-b border-[var(--accent)]/20 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 animate-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-2.5 text-[11px] text-[var(--accent)] font-semibold">
                              <div className="bg-[var(--accent)]/20 p-1 rounded-md">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                              </div>
                              <span className="tracking-tight">Override Active: <strong className="text-[var(--text)] uppercase opacity-80">{boardId}</strong> is using <strong>{firmwareName}</strong></span>
                            </div>
                            <Btn 
                              onClick={() => onToggleBoardFirmwareSource?.(boardId, false)}
                              color="var(--accent)"
                            >
                              <span className="text-[10px] font-bold px-1">Switch to Code</span>
                            </Btn>
                          </div>
                        );
                      })()}
                      <Editor
                        value={code}
                        onValueChange={v => {
                          if (!activeCodeFileId || activeCodeFileId === 'project/diagram.json') return;
                          if (editingDisabled) return;
                          setCode(v);
                        }}
                        readOnly={editingDisabled || !activeCodeFileId || activeCodeFileId === 'project/diagram.json'}
                        highlight={highlightCode}
                        padding={14}
                        style={{
                          fontFamily: "'JetBrains Mono',monospace",
                          fontSize: 12,
                          lineHeight: 1.7,
                          minHeight: '100%',
                          color: 'var(--text)',
                          border: 'none',
                          outline: 'none',
                          resize: 'none',
                          // Add a subtle opacity change if read only
                          opacity: (editingDisabled || !activeCodeFileId || activeCodeFileId === 'project/diagram.json') ? 0.7 : 1,
                          overflow: 'hidden'
                        }}
                        textareaClassName="editor-textarea"
                      />
                    </div>
                  </div>
                </div>

                {fileMenu && (() => {
                  const theFile = (projectFiles || []).find(f => f.id === fileMenu.fileId);
                  const fileName = theFile?.name || 'File';
                  const isCodeFile = theFile?.kind === 'code';
                  const isDisabledFile = String(theFile?.name || '').toLowerCase().endsWith(DISABLED_FILE_SUFFIX);
                  return (
                    <div
                      className="canvas-menu"
                      onMouseLeave={() => setFileMenu(null)}
                      style={{
                        position: 'fixed',
                        left: fileMenu.x,
                        top: fileMenu.y,
                        zIndex: 9999,
                        background: theme === 'light' ? 'rgba(248, 250, 252, 0.8)' : 'rgba(13, 21, 37, 0.75)',
                        backdropFilter: 'blur(16px) saturate(1.4)',
                        WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
                        border: theme === 'light' ? '1px solid rgba(203, 213, 225, 0.6)' : '1px solid rgba(30, 45, 71, 0.6)',
                        borderRadius: 12,
                        boxShadow: theme === 'light' ? '0 8px 32px rgba(0, 0, 0, 0.08)' : '0 10px 40px rgba(0,0,0,0.5)',
                        minWidth: 180,
                        padding: '5px',
                        animation: 'canvasMenuIn 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        transformOrigin: 'top left',
                        fontFamily: "'Space Grotesk', sans-serif"
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ padding: '6px 12px 5px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                        {fileName}
                      </div>

                      {[
                        { label: 'Save', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v13a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>, action: () => onSaveCodeFile(fileMenu.fileId) },
                        { label: 'Edit', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>, action: () => { onOpenCodeFile(fileMenu.fileId); if (setSelected) setSelected(null); } },
                        { label: 'Duplicate', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>, action: () => onDuplicateCodeFile(fileMenu.fileId) },
                        ...(isCodeFile && typeof onToggleCodeFileDisabled === 'function' ? [{
                          label: isDisabledFile ? 'Enable file' : 'Disable file',
                          icon: isDisabledFile
                            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>,
                          action: () => onToggleCodeFileDisabled(fileMenu.fileId),
                        }] : []),
                        {
                          label: 'Rename',
                          icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
                          action: () => {
                            const next = window.prompt('Rename file to:', (projectFiles || []).find(f => f.id === fileMenu.fileId)?.name || '');
                            if (next) onRenameCodeFile(fileMenu.fileId, next);
                          }
                        },
                        {
                          label: 'Delete',
                          icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>,
                          color: 'var(--red)',
                          action: () => {
                            if (window.confirm('Delete this file?')) onDeleteCodeFile(fileMenu.fileId);
                          }
                        },
                        { label: 'Download', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>, action: () => onDownloadCodeFile(fileMenu.fileId) },
                      ].map((item) => (
                        <button
                          key={item.label}
                          className="canvas-menu-item"
                          onClick={() => {
                            item.action();
                            setFileMenu(null);
                          }}
                          style={{
                            color: item.color || 'var(--text2)',
                          }}
                        >
                          {item.icon}
                          {item.label}
                        </button>
                      ))}
                    </div>
                  );
                })()}

                {folderMenu && (() => {
                  return (
                    <div
                      className="canvas-menu"
                      onMouseLeave={() => setFolderMenu(null)}
                      style={{
                        position: 'fixed',
                        left: folderMenu.x,
                        top: folderMenu.y,
                        zIndex: 9999,
                        background: theme === 'light' ? 'rgba(248, 250, 252, 0.8)' : 'rgba(13, 21, 37, 0.75)',
                        backdropFilter: 'blur(16px) saturate(1.4)',
                        WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
                        border: theme === 'light' ? '1px solid rgba(203, 213, 225, 0.6)' : '1px solid rgba(30, 45, 71, 0.6)',
                        borderRadius: 12,
                        boxShadow: theme === 'light' ? '0 8px 32px rgba(0, 0, 0, 0.08)' : '0 10px 40px rgba(0,0,0,0.5)',
                        minWidth: 180,
                        padding: '5px',
                        animation: 'canvasMenuIn 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        transformOrigin: 'top left',
                        fontFamily: "'Space Grotesk', sans-serif"
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ padding: '6px 12px 5px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                        {folderMenu.boardId}
                      </div>

                      {[
                        { 
                          label: 'Add new file', 
                          icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>, 
                          action: () => {
                            const boardKind = serialBoardKinds?.[folderMenu.boardId] || 'arduino_uno';
                            const sourceMode = serialBoardSourceModes?.[folderMenu.boardId] || 'native';
                            const suggestedName = boardKind === 'rp2040'
                              ? (sourceMode === 'micropython' ? 'main.py' : `${folderMenu.boardId}.ino`)
                              : `${folderMenu.boardId}.ino`;
                            const name = window.prompt('New file name:', suggestedName);
                            if (name) onCreateCodeFile(name, true, `project/${folderMenu.boardId}`);
                          } 
                        },
                        { 
                          label: 'Upload new file', 
                          icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>, 
                          action: () => {
                            if (onUploadCodeFile) onUploadCodeFile(`project/${folderMenu.boardId}`);
                          } 
                        },
                      ].map((item) => (
                        <button
                          key={item.label}
                          className="canvas-menu-item"
                          onClick={() => {
                            item.action();
                            setFolderMenu(null);
                          }}
                          style={{
                            color: item.color || 'var(--text2)',
                          }}
                        >
                          {item.icon}
                          {item.label}
                        </button>
                      ))}
                    </div>
                  );
                })()}
                {editingDisabled && (
                  <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 5, background: 'rgba(15,23,42,0.92)', color: '#fff', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 10, padding: '8px 10px', fontSize: 11, maxWidth: 220 }}>
                    {editingDisabledMessage}
                  </div>
                )}
              </div>
            )}
            {codeTab === 'block' && editingDisabled && (
                  <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 5, background: 'rgba(15,23,42,0.92)', color: '#fff', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 10, padding: '8px 10px', fontSize: 11, maxWidth: 220 }}>
                    {editingDisabledMessage}
                  </div>
                )}
            {/* Block editor — always mounted to preserve workspace state, hidden via CSS when not active */}
            <div style={{ display: codeTab === 'block' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden', position: 'relative', pointerEvents: editingDisabled ? 'none' : 'auto' }}>
              {blocklyDisabled ? (
                /* ── Block editor disabled placeholder ─────────────── */
                <div style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 12, padding: 24, textAlign: 'center',
                  background: 'var(--bg)',
                }}>
                  <span style={{ fontSize: 36, opacity: 0.4 }}>🧱</span>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>Block Editor is disabled</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', maxWidth: 220, lineHeight: 1.5 }}>
                    Block coding is turned off to improve canvas performance.
                  </div>
                  <button
                    onClick={toggleBlocklyDisabled}
                    style={{
                      marginTop: 4,
                      padding: '7px 18px',
                      background: 'var(--accent)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Enable Block Editor
                  </button>
                </div>
              ) : (
                /* ── Block editor enabled — kept mounted to preserve state ── */
                <React.Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>Loading Block Editor...</div>}>
                  <BlocklyEditor
                    onExportCode={(generated) => { if (!editingDisabled) { setCode(generated); setCodeTab('code'); } }}
                    onChange={(generated) => { if (!editingDisabled) setBlocklyGeneratedCode(generated); }}
                    xml={blocklyXml}
                    onXmlChange={(nextXml) => { if (!editingDisabled) setBlocklyXml(nextXml); }}
                    useBlocklyCode={useBlocklyCode}
                    onToggleUseBlocklyCode={() => { if (!editingDisabled) setUseBlocklyCode(!useBlocklyCode); }}
                    visible={codeTab === 'block'}
                    boardKind={(serialBoardFilter && serialBoardFilter !== 'all') ? (serialBoardKinds?.[serialBoardFilter] || 'arduino_uno') : (Object.values(serialBoardKinds || {})[0] || 'arduino_uno')}
                    isMobile={false}
                  />
                </React.Suspense>
              )}
            </div>
            {codeTab === 'serial' && (
              <div id="serial-container" style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'var(--bg)', overflow: 'hidden', position: 'relative' }}>
                {/* Topmost Header */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '8px 12px', 
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--bg2)',
                  height: 48,
                  flexShrink: 0
                }}>
                  {/* Reuse existing Monitor/Plotter slider style */}
                  <div style={{
                    position: 'relative',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    width: 160,
                    height: 32,
                    borderRadius: 999,
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: 1,
                      left: serialViewMode === 'monitor' ? 1 : '50%',
                      width: 'calc(50% - 2px)',
                      height: 28,
                      borderRadius: 999,
                      background: 'var(--accent)',
                      transition: 'left .2s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 2px 8px rgba(0,0,0,.2)',
                    }} />
                    {['monitor', 'plotter'].map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setSerialViewMode(mode)}
                        style={{
                          position: 'relative',
                          zIndex: 1,
                          border: 'none',
                          background: 'transparent',
                          color: serialViewMode === mode ? '#000' : 'var(--text2)',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          textTransform: 'capitalize',
                        }}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase' }}>Baud</span>
                    <select
                      value={serialBoardFilter === 'all' ? serialBaudRate : (boardBaudRates[serialBoardFilter] || serialBaudRate)}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (serialBoardFilter === 'all') {
                          setSerialBaudRate(val);
                        } else {
                          setBoardBaudRates(prev => ({ ...prev, [serialBoardFilter]: val }));
                        }
                      }}
                      style={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        color: 'var(--text2)',
                        borderRadius: 8,
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    >
                      {(serialBaudOptions && serialBaudOptions.length ? serialBaudOptions : ['9600', '19200', '38400', '57600', '115200']).map((baud) => (
                        <option key={baud} value={baud}>{baud}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Main Serial Content */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {serialViewMode === 'monitor' ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      {/* Pane 1 */}
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        height: isSerialSplit ? `${serialSplitRatio * 100}%` : '100%',
                        minHeight: isSerialSplit ? 100 : '100%',
                        overflow: 'hidden'
                      }}>
                        <SerialTabBar 
                          activeBoard={serialBoardFilter}
                          otherActiveBoard={isSerialSplit ? serialBoardFilter2 : null}
                          setBoard={setSerialBoardFilter}
                          isPaused={boardPausedStates[serialBoardFilter] ?? false}
                          onTogglePause={() => setBoardPausedStates(p => ({ ...p, [serialBoardFilter]: !(p[serialBoardFilter] ?? false) }))}
                          autoscroll={boardAutoscrolls[serialBoardFilter] ?? true}
                          onToggleAutoscroll={(val) => setBoardAutoscrolls(p => ({ ...p, [serialBoardFilter]: val }))}
                          onClear={() => setSerialHistory(prev => prev.filter(e => e.boardId !== serialBoardFilter))}
                          onToggleSplit={() => setIsSerialSplit(!isSerialSplit)}
                          isSplit={isSerialSplit}
                          boardOptions={serialBoardOptions}
                          boardColors={boardColors}
                          boardLabels={serialBoardLabels}
                          boardKinds={serialBoardKinds}
                        />
                        <SerialOutputPane 
                          boardId={serialBoardFilter}
                          history={serialHistory}
                          outputRef={serialOutputRef}
                          isPaused={boardPausedStates[serialBoardFilter] ?? false}
                          boardColors={boardColors}
                          isRunning={isRunning}
                        />
                        <SerialSendRow 
                          boardId={serialBoardFilter}
                          input={boardInputs[serialBoardFilter] || ''}
                          setInput={(val) => setBoardInputs(p => ({ ...p, [serialBoardFilter]: val }))}
                          onSend={(id, text, ending, baud) => {
                            sendSerialInput(id, text, ending, baud);
                            setBoardInputs(p => ({ ...p, [id]: '' }));
                          }}
                          isRunning={isRunning}
                          hardwareConnected={hardwareConnected}
                          serialLineEnding={boardLineEndings[serialBoardFilter] || 'none'}
                          setSerialLineEnding={(val) => setBoardLineEndings(p => ({ ...p, [serialBoardFilter]: val }))}
                          serialBaudRate={boardBaudRates[serialBoardFilter] || serialBaudRate}
                          setSerialBaudRate={(val) => setBoardBaudRates(p => ({ ...p, [serialBoardFilter]: val }))}
                          boardLabels={serialBoardLabels}
                          theme={theme}
                        />
                      </div>

                      {/* Resizer */}
                      {isSerialSplit && (
                        <div 
                          onPointerDown={onPointerDownSerialResize}
                          onPointerMove={onPointerMoveSerialResize}
                          onPointerUp={onPointerUpSerialResize}
                          style={{ 
                            height: 6, 
                            cursor: 'row-resize', 
                            background: isSerialResizing ? 'var(--accent)' : 'var(--bg3)',
                            borderTop: '1px solid var(--border)',
                            borderBottom: '1px solid var(--border)',
                            zIndex: 10,
                            transition: 'background 0.2s',
                            pointerEvents: 'auto',
                            touchAction: 'none'
                          }} 
                          className="hover:bg-[var(--accent)]"
                        />
                      )}

                      {/* Pane 2 */}
                      {isSerialSplit && (
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          height: `${(1 - serialSplitRatio) * 100}%`,
                          minHeight: 100,
                          overflow: 'hidden'
                        }}>
                          <SerialTabBar 
                            activeBoard={serialBoardFilter2}
                            otherActiveBoard={serialBoardFilter}
                            setBoard={setSerialBoardFilter2}
                            isPaused={boardPausedStates[serialBoardFilter2] ?? false}
                            onTogglePause={() => setBoardPausedStates(p => ({ ...p, [serialBoardFilter2]: !(p[serialBoardFilter2] ?? false) }))}
                            autoscroll={boardAutoscrolls[serialBoardFilter2] ?? true}
                            onToggleAutoscroll={(val) => setBoardAutoscrolls(p => ({ ...p, [serialBoardFilter2]: val }))}
                            onClear={() => setSerialHistory(prev => prev.filter(e => e.boardId !== serialBoardFilter2))}
                            onToggleSplit={() => setIsSerialSplit(false)}
                            isSplit={true}
                            boardOptions={serialBoardOptions}
                            boardColors={boardColors}
                            boardLabels={serialBoardLabels}
                            boardKinds={serialBoardKinds}
                          />
                          <SerialOutputPane 
                            boardId={serialBoardFilter2}
                            history={serialHistory}
                            outputRef={serialOutputRef2}
                            isPaused={boardPausedStates[serialBoardFilter2] ?? false}
                            boardColors={boardColors}
                            isRunning={isRunning}
                          />
                        <SerialSendRow 
                          boardId={serialBoardFilter2}
                          input={boardInputs[serialBoardFilter2] || ''}
                          setInput={(val) => setBoardInputs(p => ({ ...p, [serialBoardFilter2]: val }))}
                          onSend={(id, text, ending, baud) => {
                            sendSerialInput(id, text, ending, baud);
                            setBoardInputs(p => ({ ...p, [id]: '' }));
                          }}
                          isRunning={isRunning}
                          hardwareConnected={hardwareConnected}
                          serialLineEnding={boardLineEndings[serialBoardFilter2] || 'none'}
                          setSerialLineEnding={(val) => setBoardLineEndings(p => ({ ...p, [serialBoardFilter2]: val }))}
                          serialBaudRate={boardBaudRates[serialBoardFilter2] || serialBaudRate}
                          setSerialBaudRate={(val) => setBoardBaudRates(p => ({ ...p, [serialBoardFilter2]: val }))}
                          boardLabels={serialBoardLabels}
                          theme={theme}
                        />
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Plotter Mode - Modernized with Per-Board Management */
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
                      <PlotterToolbar 
                        onAddChannel={() => setShowAddChannel(!showAddChannel)}
                        isPaused={plotterPaused}
                        onTogglePause={() => setPlotterPaused(!plotterPaused)}
                        onClear={() => { if(plotDataRef.current) plotDataRef.current = []; }}
                        timeDiv={plotterTimeDiv}
                        setTimeDiv={setPlotterTimeDiv}
                      />
                      
                      {showAddChannel && (
                        <AddChannelPanel 
                          boardOptions={serialBoardOptions}
                          boardLabels={serialBoardLabels}
                          boardKinds={serialBoardKinds}
                          boardColors={boardColors}
                          selectedPins={selectedPlotPins}
                          setSelectedPins={setSelectedPlotPins}
                          onClose={() => setShowAddChannel(false)}
                        />
                      )}
                      
                      {/* Plotter Layout - Scrollable Container */}
                      <div className="panel-scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
                        <div style={{ display: 'flex', minHeight: '100%', width: '100%' }}>
                          {/* Label Column */}
                          {selectedPlotPins.length > 0 && (
                            <div style={{ 
                              width: 65, 
                              background: 'var(--bg2)', 
                              borderRight: '1px solid var(--border)',
                              display: 'flex',
                              flexDirection: 'column',
                              flexShrink: 0,
                              zIndex: 2
                            }}>
                              {selectedPlotPins.map((chan, i) => {
                                const color = PLOTTER_COLORS[i % PLOTTER_COLORS.length];
                                const boardLabel = serialBoardLabels[chan.boardId] || chan.boardId;
                                return (
                                  <div key={`${chan.boardId}:${chan.pinId}`} style={{ 
                                    height: 80, 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    borderBottom: '1px solid var(--border)',
                                    padding: '4px 2px',
                                    gap: 3,
                                    position: 'relative',
                                    background: i % 2 === 1 ? 'rgba(255,255,255,0.01)' : 'transparent',
                                    boxSizing: 'border-box'
                                  }}>
                                    <span style={{ fontSize: 9, color: 'var(--text4)', textTransform: 'lowercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'center' }} title={boardLabel}>
                                      {boardLabel}
                                    </span>
                                    <span style={{ fontSize: 11, fontWeight: 800, color: color, fontFamily: 'JetBrains Mono, monospace' }}>
                                      {chan.pinId}
                                    </span>
                                    <button 
                                      onClick={() => setSelectedPlotPins(prev => prev.filter(p => p.boardId !== chan.boardId || p.pinId !== chan.pinId))}
                                      style={{ background: 'transparent', border: 'none', color: 'var(--text4)', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                                      className="hover:text-[var(--red)] transition-colors"
                                      title="Remove channel"
                                    >
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Canvas Area */}
                          <PlotterCanvas 
                            plotDataRef={plotDataRef}
                            selectedPlotPins={selectedPlotPins}
                            plotterPaused={plotterPaused}
                            plotterTimeDiv={plotterTimeDiv}
                            theme={theme}
                            isRunning={isRunning}
                          />

                        </div>
                      </div>


                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
const RightPanelBase = ({ 
  isPanelOpen, panelWidth, isDragging, onMouseDownResize, setIsPanelOpen,
  explorerWidth, isExplorerDragging, onMouseDownExplorerResize,
  selected, setSelected, theme, projectName,
  validationErrors, showValidation, setShowValidation,
  healthScore, applyFix,
  codeTab, setCodeTab, code, setCode,
  blocklyXml, setBlocklyXml,
  blocklyGeneratedCode, setBlocklyGeneratedCode,
  useBlocklyCode, setUseBlocklyCode,
  blocklyDisabled, setBlocklyDisabled,
  projectFiles, openCodeTabs, activeCodeFileId, showCodeExplorer, onToggleCodeExplorer, onOpenCodeFile, onCloseCodeTab,
  onSaveCodeFile, onDuplicateCodeFile, onRenameCodeFile, onDeleteCodeFile, onDownloadCodeFile,
  onToggleCodeFileDisabled,
  onCreateCodeFile, onCreateCodeTab, onUploadCodeFile,
  libQuery, setLibQuery, handleSearchLibraries, isSearchingLib, libMessage, libInstalled, libResults, handleInstallLibrary, installingLib,
  serialPaused, setSerialPaused, isRunning, serialHistory, setSerialHistory, serialOutputRef, serialInput, setSerialInput, sendSerialInput, clearSerialMonitor,
  serialViewMode, setSerialViewMode, serialBoardFilter, setSerialBoardFilter, serialBoardOptions, serialBoardLabels, serialBoardKinds, serialBoardSourceModes, serialBaudRate, setSerialBaudRate, serialBaudOptions, serialLineEnding, setSerialLineEnding,
  hardwareConnected,
  plotterPaused, setPlotterPaused, plotDataRef, selectedPlotPins, setSelectedPlotPins, serialPlotLabelsRef,
  showConnectionsPanel, wires, updateWireColor, deleteWire,
  boardComponentMap, onToggleBoardFirmwareSource,
  editingDisabled,
  editingDisabledMessage,
  boardLineEndings, setBoardLineEndings,
  boardAutoscrolls, setBoardAutoscrolls,
  boardBaudRates, setBoardBaudRates,
  boardPausedStates, setBoardPausedStates,
  boardInputs, setBoardInputs,
  isSerialSplit, setIsSerialSplit,
  serialSplitRatio, setSerialSplitRatio,
  serialBoardFilter2, setSerialBoardFilter2,
  plotterTimeDiv, setPlotterTimeDiv
}) => {

  const [activePanel, setActivePanel] = React.useState('code');
  
  React.useEffect(() => {
    if (codeTab === 'serial') setActivePanel('serial');
    else setActivePanel('code');
  }, [codeTab]);

  return (
    <RightPanelInternal 
      {...{
        isPanelOpen, panelWidth, isDragging, onMouseDownResize, setIsPanelOpen,
        explorerWidth, isExplorerDragging, onMouseDownExplorerResize,
        selected, setSelected, theme, projectName,
        validationErrors, showValidation, setShowValidation,
        healthScore, applyFix,
        codeTab, setCodeTab, code, setCode,
        blocklyXml, setBlocklyXml,
        blocklyGeneratedCode, setBlocklyGeneratedCode,
        useBlocklyCode, setUseBlocklyCode,
        blocklyDisabled, setBlocklyDisabled,
        projectFiles, openCodeTabs, activeCodeFileId, showCodeExplorer, onToggleCodeExplorer, onOpenCodeFile, onCloseCodeTab,
        onSaveCodeFile, onDuplicateCodeFile, onRenameCodeFile, onDeleteCodeFile, onDownloadCodeFile,
        onToggleCodeFileDisabled,
        onCreateCodeFile, onCreateCodeTab, onUploadCodeFile,
        libQuery, setLibQuery, handleSearchLibraries, isSearchingLib, libMessage, libInstalled, libResults, handleInstallLibrary, installingLib,
        serialPaused, setSerialPaused, isRunning, serialHistory, setSerialHistory, serialOutputRef, serialInput, setSerialInput, sendSerialInput, clearSerialMonitor,
        serialViewMode, setSerialViewMode, serialBoardFilter, setSerialBoardFilter, serialBoardOptions, serialBoardLabels, serialBoardKinds, serialBoardSourceModes, serialBaudRate, setSerialBaudRate, serialBaudOptions, serialLineEnding, setSerialLineEnding,
        hardwareConnected,
        plotterPaused, setPlotterPaused, plotDataRef, selectedPlotPins, setSelectedPlotPins, serialPlotLabelsRef,
        showConnectionsPanel, wires, updateWireColor, deleteWire,
        boardComponentMap, onToggleBoardFirmwareSource,
        editingDisabled,
        editingDisabledMessage,
        boardLineEndings, setBoardLineEndings,
        boardAutoscrolls, setBoardAutoscrolls,
        boardBaudRates, setBoardBaudRates,
        boardPausedStates, setBoardPausedStates,
        boardInputs, setBoardInputs,
        isSerialSplit, setIsSerialSplit,
        serialSplitRatio, setSerialSplitRatio,
        serialBoardFilter2, setSerialBoardFilter2,
        plotterTimeDiv, setPlotterTimeDiv
      }}
    />
  );
};

const PlotterToolbar = ({ onAddChannel, isPaused, onTogglePause, onClear, timeDiv, setTimeDiv }) => {
  return (
    <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', background: 'var(--bg2)', flexShrink: 0 }}>
      <button 
        onClick={onAddChannel}
        style={{
          background: 'var(--accent)',
          color: '#000',
          border: 'none',
          borderRadius: 6,
          padding: '4px 12px',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}
        className="hover:brightness-110 active:scale-95 transition-all"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Channel
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
        <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>Window:</span>
        <select 
          value={timeDiv}
          onChange={(e) => setTimeDiv(Number(e.target.value))}
          style={{
            background: 'var(--bg3)',
            border: '1px solid var(--border)',
            color: 'var(--text2)',
            borderRadius: 4,
            fontSize: 10,
            padding: '2px 4px',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value={1}>1ms</option>
          <option value={10}>10ms</option>
          <option value={100}>100ms</option>
          <option value={500}>500ms</option>
          <option value={1000}>1000ms</option>
          <option value={2000}>2000ms</option>
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 10, borderLeft: '1px solid var(--border)' }}>
        <button 
          onClick={onTogglePause}
          title={isPaused ? 'Resume' : 'Pause'}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isPaused ? 'var(--orange)' : 'var(--text3)', padding: 2, display: 'flex', alignItems: 'center' }}
        >
          {isPaused ? <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>}
        </button>
        <button 
          onClick={onClear}
          title="Clear Plot"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 2, display: 'flex', alignItems: 'center' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  );
};

const AddChannelPanel = ({ boardOptions, boardLabels, boardKinds, boardColors, selectedPins, setSelectedPins, onClose }) => {
  const boards = (boardOptions || []).filter(id => id !== 'all');
  const [selectedBoardId, setSelectedBoardId] = React.useState(boards[0] || null);
  
  const tabsRef = React.useRef(null);
  const [canScroll, setCanScroll] = React.useState({ left: false, right: false });

  const checkScroll = React.useCallback(() => {
    if (!tabsRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current;
    setCanScroll({
      left: scrollLeft > 2,
      right: scrollLeft + clientWidth < scrollWidth - 2
    });
  }, []);

  const scrollTabs = (direction) => {
    if (!tabsRef.current) return;
    const amount = 120;
    tabsRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth'
    });
  };

  const panelRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [onClose]);

  React.useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll, boards.length]);

  const UNO_BASE_PINS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
  const PICO_BASE_PINS = Array.from({ length: 29 }, (_, idx) => `GP${idx}`);

  const activeBoardId = selectedBoardId || boards[0];
  const activeKind = boardKinds[activeBoardId] || 'arduino_uno';
  const activePins = activeKind === 'rp2040' ? PICO_BASE_PINS : UNO_BASE_PINS;
  const activeBoardColor = boardColors[activeBoardId] || 'var(--accent)';

  return (
    <div ref={panelRef} style={{
      position: 'absolute', top: 42, left: 12, right: 12, 
      maxHeight: 'calc(100% - 60px)',
      background: 'var(--bg1)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
      zIndex: 150,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      animation: 'slideInPlotter 0.2s cubic-bezier(0,0,0.2,1)',
      backdropFilter: 'blur(20px)',
      boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)'
    }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg3)' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}><path d="M12 20v-6M6 20V10M18 20V4"/></svg>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text1)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Add Channel</span>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16 }} className="hover:text-[var(--red)] transition-colors">✕</button>
      </div>

      {/* Board Selection Bar */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        background: 'var(--bg2)', 
        borderBottom: '1px solid var(--border)',
        height: 38,
        position: 'relative',
        padding: '0 4px'
      }}>
        {canScroll.left && (
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 24, zIndex: 2, background: 'linear-gradient(90deg, var(--bg2) 40%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
             <button onClick={() => scrollTabs('left')} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
             </button>
          </div>
        )}
        
        <div 
          ref={tabsRef}
          onScroll={checkScroll}
          className="panel-scroll"
          style={{ 
            display: 'flex', 
            flex: 1, 
            overflowX: 'auto', 
            overflowY: 'hidden',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            padding: '4px 0'
          }}
        >
          {boards.map(id => (
            <button
              key={id}
              onClick={() => setSelectedBoardId(id)}
              style={{
                flexShrink: 0,
                padding: '4px 12px',
                margin: '0 2px',
                fontSize: 11,
                fontWeight: 700,
                color: activeBoardId === id ? 'var(--accent)' : 'var(--text3)',
                background: activeBoardId === id ? 'rgba(0,255,255,0.08)' : 'transparent',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              }}
            >
              <span style={{ 
                width: 6, 
                height: 6, 
                borderRadius: '50%', 
                background: boardColors[id] || 'var(--text4)',
                boxShadow: activeBoardId === id ? `0 0 6px ${boardColors[id] || 'var(--text4)'}` : 'none'
              }} />
              {boardLabels[id] || id}
            </button>
          ))}
        </div>

        {canScroll.right && (
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 24, zIndex: 2, background: 'linear-gradient(-90deg, var(--bg2) 40%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
             <button onClick={() => scrollTabs('right')} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
             </button>
          </div>
        )}
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }} className="panel-scroll">
        {!activeBoardId ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
            No boards detected in circuit.
          </div>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(42px, 1fr))', gap: 6 }}>
              {activePins.map(pin => {
                const pinIdx = selectedPins.findIndex(p => p.boardId === activeBoardId && p.pinId === pin);
                const isSelected = pinIdx >= 0;
                
                const PLOTTER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c'];
                const selectedColor = isSelected ? PLOTTER_COLORS[pinIdx % PLOTTER_COLORS.length] : 'var(--accent)';

                return (
                  <button
                    key={pin}
                    onClick={() => {
                      setSelectedPins(prev => {
                        if (isSelected) return prev.filter(p => p.boardId !== activeBoardId || p.pinId !== pin);
                        if (prev.length >= 12) return prev; // Limit channels
                        return [...prev, { boardId: activeBoardId, pinId: pin }];
                      });
                    }}
                    style={{
                      padding: '8px 2px',
                      fontSize: 10,
                      fontWeight: 700,
                      background: isSelected ? `${selectedColor}25` : 'rgba(255,255,255,0.02)',
                      color: isSelected ? selectedColor : 'var(--text3)',
                      border: `1px solid ${isSelected ? selectedColor : 'var(--border)'}`,
                      borderRadius: 6,
                      cursor: 'pointer',
                      transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: isSelected ? `inset 0 0 10px ${selectedColor}15` : 'none'
                    }}
                    className={isSelected ? '' : 'hover:border-[var(--text4)] hover:bg-white/5'}
                  >{pin}</button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInPlotter { from { opacity: 0; transform: translateY(-8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </div>
  );
};

export const RightPanel = React.memo(RightPanelBase);

// ── Serial UI Sub-Components ────────────────────────────────────────────────

const SerialTabBar = ({ 
  activeBoard, 
  otherActiveBoard, 
  setBoard,
  isPaused, 
  onTogglePause, 
  autoscroll, 
  onToggleAutoscroll, 
  onClear, 
  onToggleSplit, 
  isSplit,
  boardOptions,
  boardColors,
  boardLabels,
  boardKinds
}) => {
  const boards = (boardOptions || []).filter(id => id !== 'all');
  const tabsRef = React.useRef(null);
  const [canScroll, setCanScroll] = React.useState({ left: false, right: false });
  const [isHovered, setIsHovered] = React.useState(false);

  const checkScroll = React.useCallback(() => {
    if (!tabsRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current;
    setCanScroll({
      left: scrollLeft > 2,
      right: scrollLeft + clientWidth < scrollWidth - 2
    });
  }, []);

  const scrollTabs = (direction) => {
    if (!tabsRef.current) return;
    const amount = 150;
    tabsRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth'
    });
  };

  React.useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll, boards.length]);

  return (
    <div 
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 2, 
        padding: '4px 8px 0', 
        background: 'var(--bg2)', 
        borderBottom: '1px solid var(--border)',
        height: 36,
        flexShrink: 0,
        position: 'relative'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        {/* Left Indicator */}
        {isHovered && canScroll.left && (
          <button 
            onClick={() => scrollTabs('left')}
            style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: 28,
              background: 'linear-gradient(to right, var(--bg2) 60%, transparent)',
              display: 'flex', alignItems: 'center', paddingLeft: 4, zIndex: 10,
              border: 'none', cursor: 'pointer', color: 'var(--accent)',
              animation: 'fadeIn 0.2s'
            }}
            className="hover:scale-110 transition-transform"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
        )}

        <div 
          ref={tabsRef}
          onScroll={checkScroll}
          style={{ display: 'flex', gap: 2, flex: 1, overflowX: 'auto', scrollbarWidth: 'none' }} 
          className="hide-scrollbar"
        >
          {boards.map(id => {
            const isActive = activeBoard === id;
            const isDisabled = otherActiveBoard === id;
            const boardColor = boardColors[id] || '#64748b';
            const kind = boardKinds?.[id] || 'arduino_uno';
            
            return (
              <button
                key={id}
                onClick={() => !isDisabled && setBoard(id)}
                disabled={isDisabled}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  fontSize: 11,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--accent)' : isDisabled ? 'var(--text4)' : 'var(--text2)',
                  background: isActive ? 'rgba(0,255,255,0.08)' : 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                  opacity: isDisabled ? 0.4 : 1,
                  fontFamily: 'JetBrains Mono, monospace'
                }}
              >
                <span style={{ 
                  width: 7, 
                  height: 7, 
                  borderRadius: kind === 'rp2040' ? '1px' : '50%', 
                  background: boardColor,
                  boxShadow: isActive ? `0 0 6px ${boardColor}` : 'none'
                }} />
                {boardLabels?.[id] || id}
              </button>
            );
          })}
        </div>

        {/* Right Indicator */}
        {isHovered && canScroll.right && (
          <button 
            onClick={() => scrollTabs('right')}
            style={{
              position: 'absolute', right: 0, top: 0, bottom: 0, width: 28,
              background: 'linear-gradient(to left, var(--bg2) 60%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 4, zIndex: 10,
              border: 'none', cursor: 'pointer', color: 'var(--accent)',
              animation: 'fadeIn 0.2s'
            }}
            className="hover:scale-110 transition-transform"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 8, borderLeft: '1px solid var(--border)', marginLeft: 2 }}>
        <button 
          onClick={() => onToggleAutoscroll(!autoscroll)}
          style={{ 
            background: autoscroll ? 'rgba(0, 255, 255, 0.08)' : 'transparent',
            border: `1px solid ${autoscroll ? 'var(--accent)' : 'var(--border)'}`,
            color: autoscroll ? 'var(--accent)' : 'var(--text3)',
            padding: '3px 8px',
            borderRadius: 4,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            transition: 'all 0.2s',
            userSelect: 'none',
            marginRight: 4
          }}
          className="hover:border-[var(--accent)]"
        >
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Autoscroll</span>
        </button>

        <button 
          onClick={onTogglePause}
          title={isPaused ? 'Resume' : 'Pause'}
          style={{ 
            background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, borderRadius: 4,
            color: isPaused ? 'var(--orange)' : 'var(--text3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          className="hover:bg-white/5"
        >
          {isPaused ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          )}
        </button>

        <button 
          onClick={onClear}
          title="Clear Output"
          style={{ 
            background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, borderRadius: 4,
            color: 'var(--red)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          className="hover:bg-[rgba(255,68,68,0.1)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        </button>

        <button 
          onClick={onToggleSplit}
          title={isSplit ? 'Single View' : 'Split View'}
          style={{ 
            background: isSplit ? 'rgba(0,255,255,0.1)' : 'transparent', 
            border: `1px solid ${isSplit ? 'var(--accent)' : 'transparent'}`, 
            cursor: 'pointer', padding: 2, borderRadius: 4,
            color: isSplit ? 'var(--accent)' : 'var(--text3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          className="hover:bg-white/5"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

const SerialOutputPane = ({ boardId, history, outputRef, isPaused, boardColors, isRunning }) => {
  const filtered = boardId === 'all' ? history : history.filter(e => e.boardId === boardId);
  
  return (
    <div ref={outputRef} className="flex-1 overflow-y-auto py-1.5 flex flex-col panel-scroll" style={{ background: 'var(--bg)' }}>
      {filtered.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 12, padding: '40px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 24, opacity: 0.5 }}>📡</span>
          {isRunning ? `Waiting for serial output from ${boardId}...` : 'Start simulation to see serial output.'}
        </div>
      ) : (
        filtered.map((entry, i) => {
          const badgeColor = entry.dir === 'rx' ? '#2ecc71' : entry.dir === 'tx' ? '#3498db' : '#888';
          const badgeBg = entry.dir === 'rx' ? 'rgba(46,204,113,0.12)' : entry.dir === 'tx' ? 'rgba(52,152,219,0.12)' : 'rgba(128,128,128,0.12)';
          const boardColor = boardColors[entry.boardId] || '#64748b';
          return (
            <div key={i} className="flex items-start gap-2 px-3 py-0.5 text-[11px] font-mono border-b border-[var(--border)] hover:bg-white/[0.02] transition-colors">
              <span className="text-[var(--text3)] text-[10px] min-w-[84px] shrink-0 pt-[1px]" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: boardColor }} />
                {entry.ts || ''}
              </span>
              <span className="inline-block text-[8px] font-bold rounded-[3px] px-1 py-[0px] shrink-0 mt-[2px] leading-tight" style={{ color: badgeColor, background: badgeBg, border: `1px solid ${badgeColor}40` }}>
                {entry.dir?.toUpperCase() || 'RX'}
              </span>
              <span style={{ flex: 1, color: entry.dir === 'tx' ? '#3498db' : entry.dir === 'sys' ? 'var(--text3)' : 'var(--green)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {entry.text}
              </span>
              {boardId === 'all' && (
                <span style={{ color: 'var(--text3)', fontSize: 9, minWidth: 60, textAlign: 'right', opacity: 0.7 }}>
                  {entry.boardId || '-'}
                </span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

const BaudRateSelector = ({ value, onChange, theme }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = React.useRef(null);
  const options = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 74880, 115200, 230400, 250000, 500000, 1000000, 2000000];

  React.useEffect(() => {
    const handleClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6,
          padding: '6px 10px', fontSize: 11, color: 'var(--text2)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s', minWidth: 80,
          fontFamily: 'JetBrains Mono, monospace'
        }}
        className="hover:border-[var(--accent)]"
      >
        <span style={{ flex: 1, textAlign: 'left' }}>{value}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {isOpen && (
        <div style={{
          position: 'absolute', bottom: '100%', right: 0, marginBottom: 8, width: 100,
          background: 'rgba(20, 20, 25, 0.85)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)', padding: 4, zIndex: 100,
          maxHeight: 200, overflowY: 'auto'
        }} className="hide-scrollbar">
          {options.map(opt => (
            <div
              key={opt}
              onClick={() => { onChange(opt); setIsOpen(false); }}
              style={{
                padding: '6px 10px', fontSize: 11, color: opt === value ? 'var(--accent)' : 'var(--text2)',
                cursor: 'pointer', borderRadius: 4, transition: 'all 0.15s',
                background: opt === value ? 'rgba(0, 255, 255, 0.08)' : 'transparent',
                fontFamily: 'JetBrains Mono, monospace'
              }}
              className="hover:bg-white/5"
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SerialSendRow = ({ 
  boardId, 
  input, 
  setInput, 
  onSend, 
  isRunning, 
  hardwareConnected, 
  serialLineEnding, 
  setSerialLineEnding,
  serialBaudRate,
  setSerialBaudRate,
  boardLabels,
  theme 
}) => {
  return (
    <div style={{ display: 'flex', gap: 6, padding: '8px 10px', borderTop: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg2)', alignItems: 'center' }}>
      <input
        className="bg-[var(--card)] border border-[var(--border)] text-[var(--text)] outline-none font-inherit" 
        style={{ 
          flex: 1, 
          fontFamily: 'JetBrains Mono, monospace', 
          fontSize: 11, 
          transition: 'border-color 0.2s',
          borderRadius: 6,
          padding: '6px 14px'
        }}
        placeholder={`Send to ${boardLabels?.[boardId] || boardId}...`}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') onSend(boardId, input, serialLineEnding, serialBaudRate);
        }}
        disabled={!isRunning && !hardwareConnected}
      />
      <LineEndingSelector value={serialLineEnding} onChange={setSerialLineEnding} theme={theme} />
      <button 
        onClick={() => onSend(boardId, input, serialLineEnding, serialBaudRate)}
        disabled={!isRunning && !hardwareConnected}
        style={{ 
          background: (isRunning || hardwareConnected) ? 'var(--accent)' : 'var(--bg3)', 
          color: (isRunning || hardwareConnected) ? '#000' : 'var(--text4)', 
          border: 'none', 
          cursor: (isRunning || hardwareConnected) ? 'pointer' : 'not-allowed', 
          padding: '6px 20px', 
          borderRadius: 10, 
          fontSize: 11, 
          fontWeight: 800,
          transition: 'all 0.2s',
          fontFamily: "'Space Grotesk', sans-serif",
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}
        className="hover:opacity-90 active:scale-95"
      >
        Send
      </button>
    </div>
  );
};

const LineEndingSelector = ({ value, onChange, theme }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [hoveredIdx, setHoveredIdx] = React.useState(null);
  const menuRef = React.useRef(null);
  
  const options = [
    { label: 'No line ending', value: 'none' },
    { label: 'Newline', value: 'nl' },
    { label: 'Carriage return', value: 'cr' },
    { label: 'Both NL & CR', value: 'crlf' }
  ];

  const currentOption = options.find(o => o.value === value) || options[1];

  React.useEffect(() => {
    const handleDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handleDown);
    return () => document.removeEventListener('mousedown', handleDown);
  }, [isOpen]);

  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          color: 'var(--text2)',
          padding: '6px 14px',
          fontSize: 10,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          borderRadius: 20,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 0.2s',
          fontFamily: "'Space Grotesk', sans-serif"
        }}
        className="hover:text-[var(--accent)] hover:border-[var(--accent)]"
      >
        {currentOption.label}
        <svg 
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        >
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 8px)',
          right: 0,
          background: theme === 'light' ? 'rgba(248, 250, 252, 0.95)' : 'rgba(13, 21, 37, 0.94)',
          backdropFilter: 'blur(16px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
          border: theme === 'light' ? '1px solid rgba(203, 213, 225, 0.8)' : '1px solid rgba(30, 45, 71, 0.8)',
          borderRadius: 12,
          boxShadow: theme === 'light' ? '0 8px 32px rgba(0, 0, 0, 0.08)' : '0 10px 40px rgba(0,0,0,0.5)',
          zIndex: 1000,
          minWidth: 160,
          overflow: 'hidden',
          padding: '5px',
          fontFamily: "'Space Grotesk', sans-serif",
          animation: 'serialMenuIn 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transformOrigin: 'bottom right'
        }}>
          {options.map((opt, idx) => (
            <div 
              key={opt.value}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                padding: '8px 14px',
                fontSize: 12,
                fontWeight: value === opt.value ? 600 : 500,
                color: value === opt.value ? 'var(--text)' : 'var(--text2)',
                background: hoveredIdx === idx ? 'var(--bg3)' : (value === opt.value ? 'rgba(52, 152, 219, 0.1)' : 'transparent'),
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: 8,
                margin: '1px 0'
              }}
            >
              {opt.label}
              {value === opt.value && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              )}
            </div>
          ))}
        </div>
      )}
      <style>{`
        @keyframes serialMenuIn {
          from { opacity: 0; transform: translateY(10px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};


