import React, { Suspense } from 'react';
import RightPanelEditor from './components/RightPanelEditor';
import { PlotterManager } from './components/PlotterManager';
import { SerialTabBar, SerialOutputPane, SerialSendRow } from './components/SerialMonitor';
import { Btn } from './Btn';
import { getBoardColors } from './projectUtils';



// Lazy-load the heavy Blockly editor to improve initial LCP metrics
const BlocklyEditor = React.lazy(() => import('../../components/BlocklyEditor.jsx'));

const DISABLED_FILE_SUFFIX = '.disabled';


const RightPanelInternal = React.forwardRef((props, ref) => {

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
  const [compareWithId, setCompareWithId] = React.useState(null); // ID of the file to compare with active file

  const asideRef = React.useRef(null);
  const explorerRef = React.useRef(null);

  React.useImperativeHandle(ref, () => ({
    get aside() { return asideRef.current; },
    get explorer() { return explorerRef.current; }
  }));

  const editorRef = React.useRef(null);

  const handleEditorMount = React.useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Add Custom Commands to the Command Palette (F1)
    editor.addAction({
      id: 'openhw-save',
      label: 'OpenHW: Save Current File',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => onSaveCodeFile?.(activeCodeFileId)
    });

    editor.addAction({
      id: 'openhw-toggle-explorer',
      label: 'OpenHW: Toggle File Explorer',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE],
      run: () => onToggleCodeExplorer?.()
    });

    editor.addAction({
      id: 'openhw-compare-file',
      label: 'OpenHW: Compare with Another File...',
      run: () => {
        const otherFiles = (projectFiles || []).filter(f => f.id !== activeCodeFileId && f.kind === 'code');
        if (otherFiles.length === 0) {
          alert('No other files available to compare with.');
          return;
        }
        // Simple prompt for demonstration, in a real app you'd use a custom modal
        const choice = window.prompt('Enter the name of the file to compare with:\n' + otherFiles.map(f => f.name).join('\n'));
        const target = otherFiles.find(f => f.name === choice);
        if (target) setCompareWithId(target.id);
      }
    });

    // One-shot layout after mount to ensure correct initial sizing
    requestAnimationFrame(() => editor.layout());
  }, [activeCodeFileId, onSaveCodeFile, onToggleCodeExplorer, projectFiles]);

  // Single layout call when dragging ends — much cheaper than polling
  const prevDragging = React.useRef(false);
  React.useEffect(() => {
    const wasDragging = prevDragging.current;
    prevDragging.current = isDragging || isExplorerDragging;
    if (wasDragging && !(isDragging || isExplorerDragging) && editorRef.current) {
      // Defer to let the CSS transition finish before we measure
      requestAnimationFrame(() => {
        requestAnimationFrame(() => editorRef.current?.layout());
      });
    }
  });

  // Stable options — never depends on drag state so editor never remounts during drag
  const editorOptions = React.useMemo(() => ({
    readOnly: editingDisabled || !activeCodeFileId || activeCodeFileId === 'project/diagram.json',
    fontSize: 12,
    fontFamily: "'JetBrains Mono', monospace",
    minimap: { enabled: false },
    automaticLayout: true,
    scrollBeyondLastLine: false,
    lineNumbers: 'on',
    padding: { top: 14, bottom: 14 },
    renderWhitespace: 'none',
    tabSize: 2,
    bracketPairColorization: { enabled: true },
    guides: { indentation: true },
    wordWrap: 'on',
    folding: true,
    lineDecorationsWidth: 10,
    fixedOverflowWidgets: true,
    scrollbar: {
      vertical: 'auto',
      horizontal: 'auto',
      useShadows: false,
      verticalHasArrows: false,
      horizontalHasArrows: false,
    }
  }), [editingDisabled, activeCodeFileId]);

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
      try { localStorage.setItem('ohw_blockly_disabled', String(next)); } catch (_) { }
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
    if (activeFileExt === '.xml') return 'xml';
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
    <aside
      ref={asideRef}
      data-tour-step="ide"
      className="relative bg-[var(--bg2)] border-l border-[var(--border)] flex flex-col shrink-0 overflow-hidden"
      style={{
        width: isDragging ? 'var(--panel-width)' : (isPanelOpen ? panelWidth : 21),
        transition: isDragging ? 'none' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        willChange: isDragging ? 'width' : 'auto',
        contain: isDragging ? 'size layout paint' : 'none'
      }}
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
              <div style={{ maxHeight: '170px', overflowY: 'auto' }} className="panel-scroll">
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
                          <span style={{ color: isError ? 'var(--red)' : 'var(--orange)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            {isError ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                              </svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                              </svg>
                            )}
                            <span>{err.message}</span>
                          </span>
                          {err.remediation && (
                            <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .6 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                                <line x1="9" y1="18" x2="15" y2="18" />
                                <line x1="10" y1="22" x2="14" y2="22" />
                              </svg>
                              <span>{err.remediation}</span>
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
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.21 1.21 0 0 0 1.72 0L21.64 5.36a1.21 1.21 0 0 0 0-1.72Z" />
                                <path d="m14 7 3 3" />
                                <path d="M5 6v4" />
                                <path d="M19 14v4" />
                                <path d="M10 2v2" />
                                <path d="M7 8H3" />
                                <path d="M21 16h-4" />
                                <path d="M11 3H9" />
                              </svg>
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
                    data-tour-id={`tab-${id}`}
                    onClick={() => React.startTransition(() => setCodeTab(id))}
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
                      <div 
                        ref={explorerRef}
                        className="code-explorer-container"
                        style={{ width: isExplorerDragging ? 'var(--explorer-width)' : explorerWidth, maxWidth: 200, borderRight: theme === 'light' ? '1px solid #cbd5e1' : '1px solid #1e2d47', display: 'flex', flexDirection: 'column', background: theme === 'light' ? '#f1f5f9' : '#090e1a', flexShrink: 0, willChange: isExplorerDragging ? 'width' : 'auto', contain: isExplorerDragging ? 'size layout paint' : 'none' }}
                      >
                        <div style={{
                          padding: '10px 12px',
                          fontSize: 11,
                          color: theme === 'light' ? '#475569' : '#94a3b8',
                          textTransform: 'uppercase',
                          letterSpacing: 1.2,
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderBottom: theme === 'light' ? '1px solid #cbd5e1' : '1px solid #1e2d47',
                          background: theme === 'light' ? '#e2e8f0' : '#0d1525'
                        }}>
                          <span>Explorer</span>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onCreateCodeFile) onCreateCodeFile('Untitled', true);
                              }}
                              title="New File"
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 2, display: 'flex', opacity: 0.7 }}
                              className="hover:opacity-100"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onSaveCodeFile && activeCodeFileId) onSaveCodeFile(activeCodeFileId);
                              }}
                              title="Save"
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 2, display: 'flex', opacity: 0.7 }}
                              className="hover:opacity-100"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                            </button>
                          </div>
                        </div>
                        <div className="panel-scroll" onClick={() => {
                          if (setSelected) setSelected(null);
                          if (onOpenCodeFile) onOpenCodeFile(null);
                          setFileMenu(null);
                        }} style={{ flex: 1, overflow: 'auto', cursor: 'default', padding: '4px 0' }}>
                          <div style={{ padding: '8px 12px', fontSize: 11, color: theme === 'light' ? '#0284c7' : '#00d4ff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.8 }}>{projectName || 'project'}</div>

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
                                padding: '4px 16px',
                                fontSize: 13,
                                cursor: 'pointer',
                                color: activeCodeFileId === file.id ? (theme === 'light' ? '#0284c7' : '#00d4ff') : (theme === 'light' ? '#334155' : '#e2e8f0'),
                                background: activeCodeFileId === file.id ? (theme === 'light' ? 'rgba(2,132,199,0.1)' : 'rgba(0,212,255,0.1)') : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                borderLeft: `2px solid ${activeCodeFileId === file.id ? (theme === 'light' ? '#0284c7' : '#00d4ff') : 'transparent'}`,
                                fontFamily: "'Inter', sans-serif",
                                transition: 'all 0.1s'
                              }}
                              className="hover:bg-[rgba(255,255,255,0.03)]"
                            >
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {file.name}{file.dirty ? ' *' : ''}
                              </span>
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
                                  padding: '6px 12px',
                                  fontSize: 12,
                                  color: boardColors[group.boardId] || (theme === 'light' ? '#475569' : '#94a3b8'),
                                  fontWeight: 800,
                                  fontFamily: "'Inter', sans-serif",
                                  background: selected === group.boardId ? (theme === 'light' ? 'rgba(2,132,199,0.05)' : 'rgba(0,212,255,0.05)') : 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  transition: 'all 0.1s',
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.8
                                }}
                                title={collapsedBoards[group.boardId] ? 'Expand folder' : 'Collapse folder'}
                                className="hover:bg-[rgba(255,255,255,0.02)]"
                              >
                                <span style={{ width: 16, display: 'inline-flex', justifyContent: 'center', opacity: 0.8 }}>
                                  {!collapsedBoards[group.boardId] ? (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                  ) : (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                  )}
                                </span>
                                <span style={{ opacity: 0.70 }}>{group.boardId}</span>
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
                                    padding: '4px 16px 4px 32px',
                                    fontSize: 13,
                                    cursor: 'pointer',
                                    color: activeCodeFileId === file.id ? (theme === 'light' ? '#0284c7' : '#00d4ff') : (theme === 'light' ? '#475569' : '#e2e8f0'),
                                    background: activeCodeFileId === file.id ? (theme === 'light' ? 'rgba(2,132,199,0.08)' : 'rgba(0,212,255,0.08)') : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    borderLeft: `2px solid ${activeCodeFileId === file.id ? (theme === 'light' ? '#0284c7' : '#00d4ff') : 'transparent'}`,
                                    fontFamily: "'Inter', sans-serif",
                                    transition: 'all 0.1s',
                                    textDecoration: String(file.name || '').toLowerCase().endsWith(DISABLED_FILE_SUFFIX) ? 'line-through' : 'none',
                                    opacity: String(file.name || '').toLowerCase().endsWith(DISABLED_FILE_SUFFIX) ? 0.6 : 1,
                                  }}
                                  className="hover:bg-[rgba(255,255,255,0.02)]"
                                >
                                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {file.name}{file.dirty ? ' *' : ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ))}

                        </div>

                        {/* Libraries Button at bottom of Explorer */}
                        <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.05)' }}>
                          <button
                            data-tour-step="library"
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

                  {/* Small Library Panel Overlay - Absolute positioned to avoid pushing the editor */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: 0,
                    width: Math.min(320, panelWidth - 40),
                    background: 'var(--bg2)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    zIndex: 100,
                    boxShadow: isLibPanelOpen ? (theme === 'light' ? '8px 0 24px rgba(0,0,0,0.08)' : '10px 0 40px rgba(0,0,0,0.5)') : 'none',
                    borderRight: '1px solid var(--border)',
                    transform: isLibPanelOpen ? 'translateX(0)' : 'translateX(-105%)',
                    transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.28s',
                    pointerEvents: isLibPanelOpen ? 'all' : 'none',
                    backdropFilter: isLibPanelOpen ? 'blur(10px)' : 'none',
                    WebkitBackdropFilter: isLibPanelOpen ? 'blur(10px)' : 'none',
                  }}>
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: theme === 'light' ? 'rgba(226, 232, 240, 0.8)' : 'rgba(13, 21, 37, 0.8)' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1 }}>Library Manager</span>
                      <button
                        onClick={() => setIsLibPanelOpen(false)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 14, padding: '4px' }}
                        className="hover:text-[var(--red)] transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', padding: 12 }}>
                      <form onSubmit={handleSearchLibraries} style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                        <input
                          className="bg-[var(--card)] border border-[var(--border)] text-[var(--text)] px-3 py-2 rounded-xl text-xs outline-none font-inherit flex-1 focus:border-[var(--accent)] transition-all shadow-sm"
                          placeholder="Search Arduino library..."
                          value={libQuery}
                          onChange={e => setLibQuery(e.target.value)}
                        />
                        <Btn color="var(--accent)" disabled={isSearchingLib} style={{ borderRadius: '10px' }}>
                          {isSearchingLib ? '...' : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>}
                        </Btn>
                      </form>

                      {libMessage && (
                        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 12, background: libMessage.type === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', color: libMessage.type === 'error' ? '#ef4444' : '#22c55e', border: `1px solid ${libMessage.type === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`, animation: 'slideDown 0.2s ease-out' }}>
                          {libMessage.text}
                        </div>
                      )}

                      <div className="panel-scroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
                        {libResults.length > 0 && <div style={{ fontSize: 10, fontWeight: '800', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 4, opacity: 0.6 }}>Search Results</div>}
                        {libResults.map((lib, idx) => (
                          <div key={idx} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, transition: 'transform 0.15s' }} className="hover:scale-[1.01] hover:border-[var(--accent)] transition-all">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--accent)', wordBreak: 'break-word', letterSpacing: -0.2 }}>{lib.name}</div>
                                {lib.author && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, fontWeight: 500 }}>{lib.author}</div>}
                              </div>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <a
                                  href={`https://www.arduino.cc/reference/en/libraries/${(lib.name || '').toLowerCase().replace(/ /g, '-')}/`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'flex',
                                    padding: '5px',
                                    borderRadius: '6px',
                                    color: 'var(--text3)',
                                    background: 'rgba(255,255,255,0.02)',
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
                                  style={{ padding: '4px 10px', fontSize: 10, borderRadius: '8px' }}
                                >
                                  {installingLib === lib.name ? '...' : 'Install'}
                                </Btn>
                              </div>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 8, lineHeight: 1.4, opacity: 0.9 }}>{lib.sentence}</div>
                            <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                              <span style={{ color: 'var(--accent)', opacity: 0.8 }}>v{lib.version}</span>
                            </div>
                          </div>
                        ))}

                        {libResults.length === 0 && (
                          <>
                            <div style={{ fontSize: 10, fontWeight: '800', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 4, opacity: 0.6 }}>Installed</div>
                            {libInstalled.length === 0 ? (
                              <div style={{ fontSize: 12, color: 'var(--text3)', padding: '20px 0', textAlign: 'center', opacity: 0.5 }}>No external libraries.</div>
                            ) : (
                              libInstalled.map((lib, idx) => (
                                <div key={idx} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, opacity: 0.85 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                    <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)', wordBreak: 'break-word', flex: 1, letterSpacing: -0.2 }}>{lib.library.name}</div>
                                    <a
                                      href={`https://www.arduino.cc/reference/en/libraries/${(lib.library.name || '').toLowerCase().replace(/ /g, '-')}/`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        display: 'flex',
                                        padding: '5px',
                                        borderRadius: '6px',
                                        color: 'var(--text3)',
                                        background: 'rgba(255,255,255,0.02)',
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
                                  <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace', marginTop: 6, fontWeight: 600 }}>
                                    <span style={{ color: 'var(--accent)', opacity: 0.8 }}>v{lib.library.version}</span>
                                    <span style={{ color: 'var(--green)', opacity: 0.8 }}>● Installed</span>
                                  </div>
                                </div>
                              ))
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, pointerEvents: editingDisabled ? 'none' : 'auto' }}>
                    <div className="panel-scroll hide-scrollbar" style={{ display: 'flex', gap: 0, overflowX: 'auto', borderBottom: theme === 'light' ? '1px solid #cbd5e1' : '1px solid #1e2d47', background: theme === 'light' ? '#e6e7eb' : '#0d1525', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      {openFiles.map((file) => (
                        <div
                          key={file.id}
                          onClick={() => onOpenCodeFile(file.id)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setFileMenu({ x: e.clientX, y: e.clientY, fileId: file.id });
                          }}
                          className={`group transition-all duration-200 ${activeCodeFileId === file.id ? '' : 'hover:bg-[rgba(255,255,255,0.03)]'}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 7,
                            padding: '8px 16px',
                            fontSize: 11,
                            cursor: 'pointer',
                            background: activeCodeFileId === file.id ? (theme === 'light' ? '#f8fafc' : '#070b14') : (theme === 'light' ? '#e6e7eb' : '#0d1525'),
                            borderRight: theme === 'light' ? '1px solid #cbd5e1' : '1px solid #1e2d47',
                            borderBottom: activeCodeFileId === file.id ? `2px solid ${theme === 'light' ? '#0284c7' : '#00d4ff'}` : '2px solid transparent',
                            color: activeCodeFileId === file.id ? (theme === 'light' ? '#0f172a' : '#e8edf5') : (theme === 'light' ? '#64748b' : '#4d6380'),
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
                    </div>

                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        position: 'relative',
                        minHeight: 0,
                      }}
                    >
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
                      <RightPanelEditor
                        theme={theme}
                        editorLanguage={editorLanguage}
                        editorOptions={editorOptions}
                        activeCodeFileId={activeCodeFileId}
                        compareWithId={compareWithId}
                        projectFiles={projectFiles}
                        onSaveCodeFile={onSaveCodeFile}
                        editingDisabled={editingDisabled}
                        isDragging={isDragging}
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
            <div data-tour-step="blockly" style={{ display: codeTab === 'block' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden', position: 'relative', pointerEvents: editingDisabled ? 'none' : 'auto' }}>
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
              <div id="serial-container" data-tour-step="serial" style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'var(--bg)', overflow: 'hidden', position: 'relative' }}>
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
                        data-tour-id={mode === 'plotter' ? 'plotter-view-btn' : undefined}
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
                    <div data-tour-step="plotter" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <PlotterManager
                      showAddChannel={showAddChannel}
                      setShowAddChannel={setShowAddChannel}
                      plotterPaused={plotterPaused}
                      setPlotterPaused={setPlotterPaused}
                      plotDataRef={plotDataRef}
                      selectedPlotPins={selectedPlotPins}
                      setSelectedPlotPins={setSelectedPlotPins}
                      plotterTimeDiv={plotterTimeDiv}
                      setPlotterTimeDiv={setPlotterTimeDiv}
                      serialBoardOptions={serialBoardOptions}
                      serialBoardLabels={serialBoardLabels}
                      serialBoardKinds={serialBoardKinds}
                      boardColors={boardColors}
                      theme={theme}
                      isRunning={isRunning}
                    />
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
});
const RightPanelBase = React.forwardRef((props, ref) => {
  const {
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
  } = props;

  const [activePanel, setActivePanel] = React.useState('code');

  React.useEffect(() => {
    if (codeTab === 'serial') setActivePanel('serial');
    else setActivePanel('code');
  }, [codeTab]);

  return (
    <RightPanelInternal
      ref={ref}
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
});




export const RightPanel = React.memo(RightPanelBase);