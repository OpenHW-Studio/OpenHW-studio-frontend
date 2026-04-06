import React from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import { Btn } from './Btn';

// Lazy-load the heavy Blockly editor to improve initial LCP metrics
const BlocklyEditor = React.lazy(() => import('../../components/BlocklyEditor.jsx'));

const DISABLED_FILE_SUFFIX = '.disabled';

export function RightPanel(props) {
  const {
    isPanelOpen, panelWidth, isDragging, onMouseDownResize, setIsPanelOpen,
    explorerWidth, isExplorerDragging, onMouseDownExplorerResize,
    validationErrors, showValidation, setShowValidation,
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
    rp2040DebugTelemetryEnabled, setRp2040DebugTelemetryEnabled,
    hardwareConnected,
    plotterPaused, setPlotterPaused, plotData, setPlotData, selectedPlotPins, setSelectedPlotPins, plotterCanvasRef, serialPlotLabelsRef,
    showConnectionsPanel, wires, updateWireColor, deleteWire,
    selected, setSelected,
    blocklyDisabled, setBlocklyDisabled,
  } = props;

  const [fileMenu, setFileMenu] = React.useState(null); // { x, y, fileId }
  const [folderMenu, setFolderMenu] = React.useState(null); // { x, y, boardId }
  const [collapsedBoards, setCollapsedBoards] = React.useState({});
  const [serialSendTarget, setSerialSendTarget] = React.useState(
    serialBoardFilter && serialBoardFilter !== 'all' ? serialBoardFilter : 'all'
  );
  const [showSendTargetMenu, setShowSendTargetMenu] = React.useState(false);
  const [isLibPanelOpen, setIsLibPanelOpen] = React.useState(false);
  const sendMenuRef = React.useRef(null);

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

  const boardColors = React.useMemo(() => {
    const palette = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#14b8a6', '#eab308', '#06b6d4', '#8b5cf6'];
    const map = { all: '#94a3b8' };
    (serialBoardOptions || []).filter((id) => id !== 'all').forEach((id, idx) => {
      map[id] = palette[idx % palette.length];
    });
    return map;
  }, [serialBoardOptions]);

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
                <span>⚠ Validation ({validationErrors.length})</span>
                <button className="bg-transparent border-none text-[var(--text3)] cursor-pointer text-sm font-inherit" onClick={() => setShowValidation(false)}>✕</button>
              </div>
              {validationErrors.map((err, i) => (
                <div key={i} className="px-3 py-1.5 text-xs border-l-3 mb-0.5 leading-relaxed" style={{
                  borderLeftColor: err.type === 'error' ? 'var(--red)' : 'var(--orange)',
                }}>
                  <span style={{ color: err.type === 'error' ? 'var(--red)' : 'var(--orange)' }}>
                    {err.type === 'error' ? '🔴' : '🟡'} {err.message}
                  </span>
                </div>
              ))}
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
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--bg)' }}>
                <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
                  {showCodeExplorer && (
                    <>
                      <div style={{ width: explorerWidth, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg2)', flexShrink: 0 }}>
                        <div className="panel-scroll" onClick={() => {
                          if (setSelected) setSelected(null);
                          if (onOpenCodeFile) onOpenCodeFile(null);
                          setFileMenu(null);
                        }} style={{ flex: 1, overflow: 'auto', cursor: 'default' }}>
                          <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.8 }}>project</div>

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

                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <div className="panel-scroll hide-scrollbar" style={{ display: 'flex', gap: 2, overflowX: 'auto', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      {openFiles.map((file) => (
                        <div
                          key={file.id}
                          onClick={() => onOpenCodeFile(file.id)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setFileMenu({ x: e.clientX, y: e.clientY, fileId: file.id });
                          }}
                          className={`group transition-all duration-150 ${activeCodeFileId === file.id ? 'bg-[rgba(0,255,255,0.04)]' : 'hover:bg-[rgba(255,255,255,0.02)]'}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '7px 12px',
                            fontSize: 11,
                            cursor: 'pointer',
                            borderBottom: activeCodeFileId === file.id ? '2px solid var(--accent)' : '2px solid transparent',
                            color: activeCodeFileId === file.id ? 'var(--accent)' : 'var(--text2)',
                            fontFamily: 'JetBrains Mono, monospace',
                            whiteSpace: 'nowrap',
                            userSelect: 'none',
                            textDecoration: String(file.name || '').toLowerCase().endsWith(DISABLED_FILE_SUFFIX) ? 'line-through' : 'none',
                            opacity: String(file.name || '').toLowerCase().endsWith(DISABLED_FILE_SUFFIX) ? 0.75 : 1,
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

                    <div className="panel-scroll" style={{ flex: 1, overflow: 'auto' }}>
                      <Editor
                        value={code}
                        onValueChange={v => {
                          if (!activeCodeFileId || activeCodeFileId === 'project/diagram.json') return;
                          setCode(v);
                        }}
                        readOnly={!activeCodeFileId || activeCodeFileId === 'project/diagram.json'}
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
                          opacity: (!activeCodeFileId || activeCodeFileId === 'project/diagram.json') ? 0.7 : 1
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
                      style={{
                        position: 'fixed',
                        left: fileMenu.x,
                        top: fileMenu.y,
                        zIndex: 9999,
                        background: 'var(--bg2)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
                        minWidth: 180,
                        overflow: 'hidden',
                        animation: 'canvasMenuIn 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        transformOrigin: 'top left',
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
                          onClick={() => {
                            item.action();
                            setFileMenu(null);
                          }}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            background: 'none',
                            border: 'none',
                            color: item.color || 'var(--text2)',
                            padding: '6px 12px',
                            fontSize: 13,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            fontFamily: 'inherit',
                            transition: 'background 0.1s ease',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
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
                      style={{
                        position: 'fixed',
                        left: folderMenu.x,
                        top: folderMenu.y,
                        zIndex: 9999,
                        background: 'var(--bg2)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
                        minWidth: 180,
                        overflow: 'hidden',
                        animation: 'canvasMenuIn 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        transformOrigin: 'top left',
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
                          onClick={() => {
                            item.action();
                            setFolderMenu(null);
                          }}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            background: 'none',
                            border: 'none',
                            color: item.color || 'var(--text2)',
                            padding: '6px 12px',
                            fontSize: 13,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            fontFamily: 'inherit',
                            transition: 'background 0.1s ease',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                          {item.icon}
                          {item.label}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
            {codeTab === 'block' && (
              <div style={{ display: 'flex', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
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
                  <React.Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>Loading Block Editor...</div>}>
                    <BlocklyEditor
                      onExportCode={(generated) => { setCode(generated); setCodeTab('code'); }}
                      onChange={(generated) => setBlocklyGeneratedCode(generated)}
                      xml={blocklyXml}
                      onXmlChange={setBlocklyXml}
                      useBlocklyCode={useBlocklyCode}
                      onToggleUseBlocklyCode={() => setUseBlocklyCode(!useBlocklyCode)}
                      visible={true}
                      boardKind={(serialBoardFilter && serialBoardFilter !== 'all') ? (serialBoardKinds?.[serialBoardFilter] || 'arduino_uno') : (Object.values(serialBoardKinds || {})[0] || 'arduino_uno')}
                    />
                  </React.Suspense>
                )}
              </div>
            )}
            {codeTab === 'serial' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'var(--bg)', overflow: 'hidden' }}>
                {/* Serial panel toolbar */}
                <div className="px-2.5 py-1.5 border-b border-[var(--border)] bg-[var(--bg2)] shrink-0" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      position: 'relative',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      width: 168,
                      height: 26,
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
                        height: 22,
                        borderRadius: 999,
                        background: 'var(--accent)',
                        transition: 'left .2s ease',
                        boxShadow: '0 2px 8px rgba(0,0,0,.25)',
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
                            color: serialViewMode === mode ? '#fff' : 'var(--text2)',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                          }}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>

                    <div style={{ flex: 1 }} />

                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>Board</span>
                    <select
                      value={serialBoardFilter}
                      onChange={(e) => setSerialBoardFilter(e.target.value)}
                      style={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        color: 'var(--text2)',
                        borderRadius: 6,
                        padding: '2px 6px',
                        fontSize: 11,
                        cursor: 'pointer'
                      }}
                      title="Select board"
                    >
                      {serialBoardOptions.map((id) => (
                        <option key={id} value={id} style={{ color: boardColors[id] || 'var(--text2)' }}>
                          {`● ${serialBoardLabels?.[id] || (id === 'all' ? 'All Boards' : id)}`}
                        </option>
                      ))}
                    </select>

                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>Baud</span>
                    <select
                      value={serialBaudRate}
                      onChange={(e) => setSerialBaudRate(e.target.value)}
                      style={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        color: 'var(--text2)',
                        borderRadius: 6,
                        padding: '2px 6px',
                        fontSize: 11,
                        cursor: 'pointer'
                      }}
                      title="Baud rate"
                    >
                      {(serialBaudOptions && serialBaudOptions.length ? serialBaudOptions : ['9600', '19200', '38400', '57600', '115200']).map((baud) => (
                        <option key={baud} value={baud}>{baud}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
                      color: (serialViewMode === 'monitor' ? serialPaused : plotterPaused) ? 'var(--text3)' : 'var(--green)'
                    }}>
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: (serialViewMode === 'monitor' ? serialPaused : plotterPaused) ? 'var(--text3)' : 'var(--green)',
                        boxShadow: (serialViewMode === 'monitor' ? serialPaused : plotterPaused) ? 'none' : '0 0 6px var(--green)',
                        animation: (!(serialViewMode === 'monitor' ? serialPaused : plotterPaused) && isRunning) ? 'pulse 1.2s infinite' : 'none',
                        flexShrink: 0
                      }} />
                      {(serialViewMode === 'monitor' ? serialPaused : plotterPaused) ? 'Paused' : (isRunning || hardwareConnected) ? 'Live' : 'Idle'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {serialViewMode === 'monitor' ? `${filteredSerialHistory.length} lines` : `${plotData.length} samples`}
                    </span>
                    <div style={{ flex: 1 }} />
                    <button
                      className="bg-transparent border border-[var(--border)] text-[var(--text2)] rounded-md px-2 py-0.5 text-[11px] cursor-pointer font-inherit whitespace-nowrap"
                      onClick={() => serialViewMode === 'monitor' ? setSerialPaused(p => !p) : setPlotterPaused(p => !p)}
                      title={serialViewMode === 'monitor' ? (serialPaused ? 'Resume serial monitor' : 'Pause serial monitor') : (plotterPaused ? 'Resume plotting' : 'Pause plotting')}
                    >
                      {(serialViewMode === 'monitor' ? serialPaused : plotterPaused) ? '▶ Resume' : '⏸ Pause'}
                    </button>
                    {serialViewMode === 'monitor' && (
                      <select
                        value={serialLineEnding || 'nl'}
                        onChange={(e) => setSerialLineEnding(e.target.value)}
                        title="Serial line ending"
                        style={{
                          background: 'var(--card)',
                          border: '1px solid var(--border)',
                          color: 'var(--text2)',
                          borderRadius: 6,
                          padding: '2px 6px',
                          fontSize: 11,
                          cursor: 'pointer'
                        }}
                      >
                        <option value="nl">\\n</option>
                        <option value="crlf">\\r\\n</option>
                        <option value="cr">\\r</option>
                        <option value="none">None</option>
                      </select>
                    )}
                    <button
                      className="bg-transparent border border-[var(--border)] text-[var(--text2)] rounded-md px-2 py-0.5 text-[11px] cursor-pointer font-inherit whitespace-nowrap" style={{ color: 'var(--red)', borderColor: 'rgba(255,68,68,0.3)' }}
                      onClick={() => serialViewMode === 'monitor' ? (clearSerialMonitor ? clearSerialMonitor() : setSerialHistory([])) : setPlotData([])}
                      title={serialViewMode === 'monitor' ? 'Clear all output' : 'Clear plot'}
                    >
                      🗑 Clear
                    </button>
                    {serialViewMode === 'monitor' && (
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text3)', cursor: 'pointer' }} title="RP2040 debug telemetry">
                        <input
                          type="checkbox"
                          checked={!!rp2040DebugTelemetryEnabled}
                          onChange={(e) => setRp2040DebugTelemetryEnabled(e.target.checked)}
                          style={{ margin: 0 }}
                        />
                        RP2040 dbg
                      </label>
                    )}
                  </div>
                </div>
                {serialViewMode === 'monitor' ? (
                  <>
                    {/* Output Area */}
                    <div ref={serialOutputRef} className="flex-1 overflow-y-auto py-1.5 flex flex-col panel-scroll" >
                      {filteredSerialHistory.length === 0 ? (
                        <div style={{ color: 'var(--text3)', fontSize: 12, padding: '20px 0', textAlign: 'center' }}>
                          {isRunning ? 'Waiting for serial output...' : 'Run the simulator to see serial output.'}
                        </div>
                      ) : (
                        filteredSerialHistory.map((entry, i) => {
                          const badgeColor = entry.dir === 'rx' ? '#2ecc71' : entry.dir === 'tx' ? '#3498db' : '#888';
                          const badgeBg = entry.dir === 'rx' ? 'rgba(46,204,113,0.12)' : entry.dir === 'tx' ? 'rgba(52,152,219,0.12)' : 'rgba(128,128,128,0.12)';
                          const boardColor = boardColors[entry.boardId] || '#64748b';
                          return (
                            <div key={i} className="flex items-start gap-2 px-3 py-0.5 text-[11px] font-mono border-b border-[var(--border)]">
                              <span className="text-[var(--text3)] text-[10px] min-w-[84px] shrink-0 pt-[1px]" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: boardColor, boxShadow: `0 0 0 1px ${boardColor}55` }} />
                                {entry.ts || ''}
                              </span>
                              <span className="inline-block text-[9px] font-bold rounded-[3px] px-1 py-[1px] shrink-0 mt-[1px]" style={{ color: badgeColor, background: badgeBg, border: `1px solid ${badgeColor}40` }}>
                                {entry.dir?.toUpperCase() || 'RX'}
                              </span>
                              <span style={{ flex: 1, color: entry.dir === 'tx' ? '#3498db' : entry.dir === 'sys' ? 'var(--text3)' : 'var(--green)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                {entry.text}
                              </span>
                              <span style={{ color: 'var(--text3)', fontSize: 10, minWidth: 90, textAlign: 'right' }}>
                                {entry.boardId || '-'}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* TX Input Row */}
                    <div style={{ display: 'flex', gap: 6, padding: '8px 10px', borderTop: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg2)' }}>
                      <input
                        className="bg-[var(--card)] border border-[var(--border)] text-[var(--text)] px-2.5 py-1.5 rounded-lg text-xs outline-none font-inherit" style={{ flex: 1, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}
                        placeholder="Send message to Arduino..."
                        value={serialInput}
                        onChange={e => setSerialInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            sendSerialInput(serialBoardFilter === 'all' ? serialSendTarget : serialBoardFilter);
                          }
                        }}
                        disabled={!isRunning && !hardwareConnected}
                      />
                      <div ref={sendMenuRef} style={{ position: 'relative', display: 'inline-flex' }}>
                        <button
                          onClick={() => sendSerialInput(serialBoardFilter === 'all' ? serialSendTarget : serialBoardFilter)}
                          disabled={(!isRunning && !hardwareConnected) || !serialInput.trim()}
                          style={{
                            background: ((isRunning || hardwareConnected) && serialInput.trim()) ? 'var(--accent)' : 'transparent',
                            border: '1px solid var(--accent)',
                            borderRight: serialBoardFilter === 'all' ? 'none' : '1px solid var(--accent)',
                            color: ((isRunning || hardwareConnected) && serialInput.trim()) ? '#fff' : 'var(--text3)',
                            borderRadius: serialBoardFilter === 'all' ? '8px 0 0 8px' : '8px',
                            padding: '6px 10px',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: ((isRunning || hardwareConnected) && serialInput.trim()) ? 'pointer' : 'not-allowed',
                            fontFamily: 'inherit',
                            transition: 'all .15s',
                            whiteSpace: 'nowrap',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                          title={`Send to ${serialBoardLabels?.[(serialBoardFilter === 'all' ? serialSendTarget : serialBoardFilter)] || (serialBoardFilter === 'all' ? serialSendTarget : serialBoardFilter)}`}
                        >
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: boardColors[serialBoardFilter === 'all' ? serialSendTarget : serialBoardFilter] || '#94a3b8', boxShadow: `0 0 0 1px ${(boardColors[serialBoardFilter === 'all' ? serialSendTarget : serialBoardFilter] || '#94a3b8')}66` }} />
                          Send
                        </button>

                        {serialBoardFilter === 'all' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowSendTargetMenu((v) => !v);
                            }}
                            disabled={!isRunning && !hardwareConnected}
                            style={{
                              background: ((isRunning || hardwareConnected) && serialInput.trim()) ? 'var(--accent)' : 'transparent',
                              border: '1px solid var(--accent)',
                              color: ((isRunning || hardwareConnected) && serialInput.trim()) ? '#fff' : 'var(--text3)',
                              borderRadius: '0 8px 8px 0',
                              padding: '6px 7px',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: (!isRunning && !hardwareConnected) ? 'not-allowed' : 'pointer',
                              fontFamily: 'inherit',
                              transition: 'all .15s',
                              whiteSpace: 'nowrap'
                            }}
                            title="Choose board to send"
                          >
                            ▾
                          </button>
                        )}

                        {serialBoardFilter === 'all' && showSendTargetMenu && (
                          <div style={{
                            position: 'absolute',
                            right: 0,
                            bottom: 'calc(100% + 6px)',
                            minWidth: 180,
                            background: 'var(--bg2)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                            overflow: 'hidden',
                            zIndex: 20,
                          }}>
                            {(serialBoardOptions || []).filter((id) => id !== 'all').map((id) => {
                              const active = serialSendTarget === id;
                              return (
                                <button
                                  key={`send-target-${id}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSerialSendTarget(id);
                                    setShowSendTargetMenu(false);
                                  }}
                                  style={{
                                    width: '100%',
                                    border: 'none',
                                    borderBottom: '1px solid var(--border)',
                                    background: active ? 'rgba(0,255,255,0.08)' : 'transparent',
                                    color: active ? 'var(--accent)' : 'var(--text2)',
                                    fontSize: 11,
                                    padding: '7px 9px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 7,
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: boardColors[id] || '#94a3b8', boxShadow: `0 0 0 1px ${(boardColors[id] || '#94a3b8')}66` }} />
                                  <span>{serialBoardLabels?.[id] || id}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Pin Selector */}
                    <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>Pins:</span>
                      {availablePins.map((pin, i) => {
                        const isSel = selectedPlotPins.includes(pin);
                        const isAna = pin.startsWith('A');
                        const isLogic = basePins.includes(pin);
                        let bg = isAna ? 'rgba(52,152,219,0.2)' : 'rgba(46,204,113,0.2)';
                        let br = isAna ? '#3498db' : '#2ecc71';
                        if (!isLogic) {
                          const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c'];
                          const c = colors[i % colors.length];
                          bg = `${c}33`; br = c;
                        }
                        return (
                          <button
                            key={pin}
                            onClick={() => setSelectedPlotPins(prev => {
                              if (prev.includes(pin)) return prev.filter(p => p !== pin);
                              if (prev.length >= 8) return [...prev.slice(1), pin];
                              return [...prev, pin];
                            })}
                            style={{
                              background: isSel ? bg : 'transparent',
                              border: `1px solid ${isSel ? br : 'var(--border)'}`,
                              color: isSel ? br : 'var(--text3)',
                              borderRadius: 4, padding: '1px 5px', fontSize: 10, cursor: 'pointer'
                            }}
                          >{pin}</button>
                        );
                      })}
                    </div>

                    {/* Legend */}
                    {selectedPlotPins.length > 0 && (
                      <div className="flex flex-wrap gap-y-1 gap-x-4 px-2.5 py-1 border-b border-[var(--border)] shrink-0">
                        {selectedPlotPins.map((pin, i) => {
                          let bg = pin.startsWith('A') ? '#3498db' : '#2ecc71';
                          let lbl = `Pin ${pin}`;
                          if (isNaN(parseInt(pin)) && !pin.startsWith('A')) {
                            const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c'];
                            const serialVars = selectedPlotPins.filter(p => isNaN(parseInt(p)) && !p.startsWith('A'));
                            bg = colors[serialVars.indexOf(pin) % colors.length];
                            lbl = pin;
                          }
                          return (
                            <span key={pin} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, cursor: 'pointer' }}
                              onClick={() => setSelectedPlotPins(prev => prev.filter(p => p !== pin))}
                              title="Click to remove" >
                              <span style={{ width: 10, height: 10, borderRadius: 2, background: bg, flexShrink: 0 }} />
                              <span style={{ color: 'var(--text2)', fontFamily: 'JetBrains Mono, monospace' }}>{lbl}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Canvas */}
                    <div style={{ flex: 1, position: 'relative' }}>
                      {!isRunning && plotData.length === 0 ? (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', gap: 8, fontSize: 13 }}>
                          <span style={{ fontSize: 28 }}>📈</span>
                          Run simulator to trace signals.
                        </div>
                      ) : (
                        <canvas
                          ref={plotterCanvasRef}
                          width={800}
                          height={600}
                          style={{ position: 'absolute', width: '100%', height: '100%', background: '#070b14' }}
                        />
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}


