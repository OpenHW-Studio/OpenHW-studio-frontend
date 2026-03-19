import React from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import { Btn } from './Btn';
import BlocklyEditor from '../../components/BlocklyEditor.jsx';

export function RightPanel(props) {
  const {
    isPanelOpen, panelWidth, isDragging, onMouseDownResize, setIsPanelOpen,
    explorerWidth, isExplorerDragging, onMouseDownExplorerResize,
    validationErrors, showValidation, setShowValidation,
    codeTab, setCodeTab, code, setCode, blockXml, setBlocklyXml,
    projectFiles, openCodeTabs, activeCodeFileId, showCodeExplorer,
    onToggleCodeExplorer, onOpenCodeFile, onCloseCodeTab,
    onSaveCodeFile, onDuplicateCodeFile, onRenameCodeFile, onDeleteCodeFile, onDownloadCodeFile,
    onCreateCodeFile, onCreateCodeTab,
    libQuery, setLibQuery, handleSearchLibraries, isSearchingLib, libMessage, libInstalled, libResults, handleInstallLibrary, installingLib,
    serialPaused, setSerialPaused, isRunning, serialHistory, setSerialHistory, serialOutputRef, serialInput, setSerialInput, sendSerialInput,
    serialViewMode, setSerialViewMode, serialBoardFilter, setSerialBoardFilter, serialBoardOptions, serialBoardLabels, serialBaudRate, setSerialBaudRate, serialBaudOptions,
    hardwareConnected,
    plotterPaused, setPlotterPaused, plotData, setPlotData, selectedPlotPins, setSelectedPlotPins, plotterCanvasRef, serialPlotLabelsRef,
    showConnectionsPanel, wires, updateWireColor, deleteWire,
    selected, setSelected
  } = props;

  const [fileMenu, setFileMenu] = React.useState(null); // { x, y, fileId }
  const [collapsedBoards, setCollapsedBoards] = React.useState({});


  React.useEffect(() => {
    const onWindowClick = () => setFileMenu(null);
    window.addEventListener('click', onWindowClick);
    return () => window.removeEventListener('click', onWindowClick);
  }, []);

  const projectRootFiles = React.useMemo(() => {
    return (projectFiles || [])
      .filter((f) => f.path.startsWith('project/') && f.path.split('/').length === 2)
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

    return [...grouped.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([boardId, files]) => ({
        boardId,
        files: files.sort((a, b) => a.path.localeCompare(b.path)),
      }));
  }, [projectFiles]);

  const openFiles = React.useMemo(() => {
    const map = new Map((projectFiles || []).map((f) => [f.id, f]));
    return (openCodeTabs || []).map((id) => map.get(id)).filter(Boolean);
  }, [openCodeTabs, projectFiles]);

  const filteredSerialHistory = serialBoardFilter === 'all'
    ? serialHistory
    : serialHistory.filter((entry) => entry.boardId === serialBoardFilter || entry.boardId === 'all');

  const basePins = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
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
            <div className="flex border-b border-[var(--border)] shrink-0 overflow-x-auto whitespace-nowrap scrollbar-hide" style={{ display: "flex", gap: "10px" }}>
              {codeTab === 'code' && (
                <button
                  className={`shrink-0 bg-transparent border-none font-inherit text-xs cursor-pointer border-b-2 transition-all duration-200 
                    ${showCodeExplorer 
                      ? 'text-[var(--accent)] border-b-[var(--accent)] bg-[rgba(0,212,255,0.06)]' 
                      : 'text-[var(--text3)] border-b-transparent hover:text-[var(--text2)] hover:bg-[rgba(255,255,255,0.02)]'
                    } 
                    active:scale-95 active:bg-[rgba(0,212,255,0.12)]`}
                  onClick={onToggleCodeExplorer}
                  style={{ padding: "10px 14px" }}
                  title={showCodeExplorer ? 'Hide explorer' : 'Show explorer'}
                >
                  Explorer
                </button>
              )}
              {['code', 'block', 'libraries', 'serial'].map(t => (
                <button
                  key={t}
                  className={`shrink-0 bg-transparent border-none font-inherit text-xs cursor-pointer border-b-2 transition-all duration-200 
                    ${codeTab === t 
                      ? 'text-[var(--accent)] border-b-[var(--accent)] bg-[rgba(0,212,255,0.06)]' 
                      : 'text-[var(--text3)] border-b-transparent hover:text-[var(--text2)] hover:bg-[rgba(255,255,255,0.02)]'
                    } 
                    active:scale-95 active:bg-[rgba(0,212,255,0.12)]`}
                  onClick={() => setCodeTab(t)}
                  style={{ padding: "10px 16px" }}
                >
                  {t === 'code' ? '{ } Code' : t === 'block' ? 'Block' : t === 'libraries' ? ' Libraries' : ' Serial'}
                </button>
              ))}
            </div>
            {codeTab === 'code' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--bg)' }}>
                <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
                  {showCodeExplorer && (
                    <>
                      <div className="panel-scroll" onClick={() => {
                        if (setSelected) setSelected(null);
                        if (onOpenCodeFile) onOpenCodeFile(null);
                      }} style={{ width: explorerWidth, borderRight: '1px solid var(--border)', overflow: 'auto', background: 'var(--bg2)', cursor: 'default', flexShrink: 0 }}>
                      <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.8 }}>project</div>

                      {projectRootFiles.map((file) => (
                        <div
                          key={file.id}
                          onClick={(e) => {
                            e.stopPropagation();
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
                            fontSize: (file.name === 'diagram.json' || file.name === 'diagram.png' || file.name === 'library.txt') ? 11 : 12,
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
                              if (onOpenCodeFile) onOpenCodeFile(null);
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
                            <span>{group.boardId}</span>
                          </button>
                          {!collapsedBoards[group.boardId] && group.files.map((file) => (
                            <div
                              key={file.id}
                              onClick={(e) => {
                                e.stopPropagation();
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
                                fontSize: (file.name === 'diagram.json' || file.name === 'diagram.png' || file.name === 'library.txt') ? 10 : 12,
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
                        </div>
                      ))}
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

                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <div className="panel-scroll" style={{ display: 'flex', gap: 2, overflowX: 'auto', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
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

                    <div className="panel-scroll" style={{ flex: 1, overflow: 'auto' }}>
                      <Editor
                        value={code}
                        onValueChange={v => {
                          if (activeCodeFileId === 'project/diagram.json') return;
                          setCode(v);
                        }}
                        readOnly={activeCodeFileId === 'project/diagram.json'}
                        highlight={v => Prism.highlight(v, Prism.languages.cpp, 'cpp')}
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
                          opacity: activeCodeFileId === 'project/diagram.json' ? 0.7 : 1
                        }}
                        textareaClassName="editor-textarea"
                      />
                    </div>
                  </div>
                </div>

                {fileMenu && (() => {
                  const theFile = (projectFiles || []).find(f => f.id === fileMenu.fileId);
                  const fileName = theFile?.name || 'File';
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
                      <div style={{ padding: '8px 14px 7px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                        {fileName}
                      </div>

                      {[
                        { label: 'Save', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v13a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>, action: () => onSaveCodeFile(fileMenu.fileId) },
                        { label: 'Duplicate', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>, action: () => onDuplicateCodeFile(fileMenu.fileId) },
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
                            padding: '10px 14px',
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
              <BlocklyEditor onExportCode={(generated) => { setCode(generated); setCodeTab('code'); }} />
            )}
            {codeTab === 'libraries' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', padding: 12, background: 'var(--bg)' }}>
                <form onSubmit={handleSearchLibraries} style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                  <input
                    className="bg-[var(--card)] border border-[var(--border)] text-[var(--text)] px-2.5 py-1.5 rounded-lg text-xs outline-none font-inherit"
                    placeholder="Search for an Arduino library..."
                    value={libQuery}
                    onChange={e => setLibQuery(e.target.value)}
                  />
                  <Btn color="var(--accent)" disabled={isSearchingLib}>
                    {isSearchingLib ? '...' : 'Search'}
                  </Btn>
                </form>

                {libMessage && (
                  <div style={{ padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 13, background: libMessage.type === 'error' ? 'rgba(255,68,68,0.1)' : 'rgba(0,230,118,0.1)', color: libMessage.type === 'error' ? 'var(--red)' : 'var(--green)', border: `1px solid ${libMessage.type === 'error' ? 'rgba(255,68,68,0.3)' : 'rgba(0,230,118,0.3)'}` }}>
                    {libMessage.text}
                  </div>
                )}

                <div className="panel-scroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
                  {libResults.length > 0 && <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 }}>Search Results</div>}
                  {libResults.map((lib, idx) => (
                    <div key={idx} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)' }}>{lib.name}</div>
                        <Btn
                          color="var(--green)"
                          disabled={installingLib === lib.name}
                          onClick={() => handleInstallLibrary(lib.name)}
                        >
                          {installingLib === lib.name ? 'Installing...' : 'Install'}
                        </Btn>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8, lineHeight: 1.4 }}>{lib.sentence}</div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace' }}>
                        <span>v{lib.version}</span>
                        <span>{lib.author}</span>
                      </div>
                    </div>
                  ))}

                  {libResults.length === 0 && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 }}>Installed on Host Server</div>
                      {libInstalled.length === 0 ? (
                        <div style={{ fontSize: 13, color: 'var(--text3)' }}>No external libraries installed.</div>
                      ) : (
                        libInstalled.map((lib, idx) => (
                          <div key={idx} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, opacity: 0.85 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{lib.library.name}</div>
                            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace', marginTop: 6 }}>
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
                        <option key={id} value={id}>{serialBoardLabels?.[id] || (id === 'all' ? 'All Boards' : id)}</option>
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
                      title={serialViewMode === 'monitor' ? (serialPaused ? 'Resume auto-scroll' : 'Pause auto-scroll') : (plotterPaused ? 'Resume plotting' : 'Pause plotting')}
                    >
                      {(serialViewMode === 'monitor' ? serialPaused : plotterPaused) ? '▶ Resume' : '⏸ Pause'}
                    </button>
                    <button
                      className="bg-transparent border border-[var(--border)] text-[var(--text2)] rounded-md px-2 py-0.5 text-[11px] cursor-pointer font-inherit whitespace-nowrap" style={{ color: 'var(--red)', borderColor: 'rgba(255,68,68,0.3)' }}
                      onClick={() => serialViewMode === 'monitor' ? setSerialHistory([]) : setPlotData([])}
                      title={serialViewMode === 'monitor' ? 'Clear all output' : 'Clear plot'}
                    >
                      🗑 Clear
                    </button>
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
                          return (
                            <div key={i} className="flex items-start gap-2 px-3 py-0.5 text-[11px] font-mono border-b border-[var(--border)]">
                              <span className="text-[var(--text3)] text-[10px] min-w-[84px] shrink-0 pt-[1px]">{entry.ts || ''}</span>
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
                        onKeyDown={e => { if (e.key === 'Enter') sendSerialInput(); }}
                        disabled={!isRunning && !hardwareConnected}
                      />
                      <button
                        onClick={sendSerialInput}
                        disabled={(!isRunning && !hardwareConnected) || !serialInput.trim()}
                        style={{
                          background: ((isRunning || hardwareConnected) && serialInput.trim()) ? 'var(--accent)' : 'transparent',
                          border: '1px solid var(--accent)', color: ((isRunning || hardwareConnected) && serialInput.trim()) ? '#fff' : 'var(--text3)',
                          borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700,
                          cursor: ((isRunning || hardwareConnected) && serialInput.trim()) ? 'pointer' : 'not-allowed',
                          fontFamily: 'inherit', transition: 'all .15s', whiteSpace: 'nowrap'
                        }}
                      >
                        ↑ Send
                      </button>
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


