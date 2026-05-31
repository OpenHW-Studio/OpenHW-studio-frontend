import React from 'react';
import EditorComponent from 'react-simple-code-editor';
const Editor = EditorComponent.default || EditorComponent;
import Prism from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import { Btn } from '../Btn';

const DISABLED_FILE_SUFFIX = '.disabled';

export default function CodeEditorView(props) {
  const {
    code, setCode,
    activeCodeFileId,
    projectFiles,
    openCodeTabs,
    onOpenCodeFile,
    onCloseCodeTab,
    onSaveCodeFile,
    onDuplicateCodeFile,
    onRenameCodeFile,
    onDeleteCodeFile,
    onDownloadCodeFile,
    onToggleCodeFileDisabled,
    onCreateCodeFile,
    onUploadCodeFile,
    showCodeExplorer,
    onToggleCodeExplorer,
    explorerWidth,
    onMouseDownExplorerResize,
    isExplorerDragging,
    boardComponentMap,
    onToggleBoardFirmwareSource,
    serialBoardKinds,
    serialBoardSourceModes,
    theme,
    projectName,
    editingDisabled = false,
    editingDisabledMessage = 'Editing is disabled.',
    setSelected,
    // Library props
    libQuery, setLibQuery, handleSearchLibraries, isSearchingLib, libMessage, libInstalled, libResults, handleInstallLibrary, installingLib
  } = props;

  const [fileMenu, setFileMenu] = React.useState(null);
  const [folderMenu, setFolderMenu] = React.useState(null);
  const [collapsedBoards, setCollapsedBoards] = React.useState({});
  const [sidebarMode, setSidebarMode] = React.useState('explorer'); // 'explorer' | 'library'
  const longPressTimer = React.useRef(null);

  const handleLongPressStart = (type, data, e) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    
    const clientX = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
    const clientY = (e.touches && e.touches.length > 0) ? e.touches[0].clientY : e.clientY;

    longPressTimer.current = setTimeout(() => {
      if (type === 'file') {
        setFileMenu({ x: clientX, y: clientY, fileId: data.fileId });
      } else if (type === 'folder') {
        setFolderMenu({ x: clientX, y: clientY, boardId: data.boardId });
      }
      longPressTimer.current = null;
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)', background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', minHeight: 0, flex: 1, position: 'relative' }}>
        {/* Sidebar Toggle Handle */}
        <div 
          onClick={onToggleCodeExplorer}
          style={{
            position: 'absolute',
            left: showCodeExplorer ? explorerWidth : 0,
            top: '40%',
            transform: 'translateY(-50%)',
            zIndex: 100,
            width: 28,
            height: 54,
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderLeft: 'none',
            borderRadius: '0 12px 12px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '4px 0 16px rgba(0,0,0,0.2)',
          }}
        >
          <svg 
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            style={{ 
              transition: 'transform 0.3s',
              transform: showCodeExplorer ? 'rotate(180deg)' : 'rotate(0deg)',
              color: 'var(--accent)'
            }}
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </div>

        {/* Sidebar Container */}
        <div style={{ 
          width: showCodeExplorer ? explorerWidth : 0, 
          height: '100%', 
          borderRight: showCodeExplorer ? '1px solid var(--border)' : 'none', 
          display: 'flex', 
          flexDirection: 'column', 
          background: 'var(--bg2)',
          flexShrink: 0,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          zIndex: 90
        }}>
          {sidebarMode === 'explorer' ? (
            <>
              <div className="panel-scroll" onClick={() => {
                if (setSelected) setSelected(null);
                if (onOpenCodeFile) onOpenCodeFile(null);
                setFileMenu(null);
              }} style={{ flex: 1, overflow: 'auto', cursor: 'default', minWidth: explorerWidth }}>
                {/* Header shows Project Name */}
                <div style={{ padding: '12px 14px', fontSize: 11, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }} title={projectName || 'project'}>
                  {projectName || 'Project'}
                </div>

                <div style={{ padding: '8px 0' }}>
                  {projectRootFiles.map((file) => (
                    <div
                      key={file.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFileMenu(null);
                        onOpenCodeFile(file.id);
                        if (setSelected) setSelected(null);
                      }}
                      onTouchStart={e => handleLongPressStart('file', { fileId: file.id }, e)}
                      onTouchEnd={handleLongPressEnd}
                      onTouchMove={handleLongPressEnd}
                      onMouseDown={e => handleLongPressStart('file', { fileId: file.id }, e)}
                      onMouseUp={handleLongPressEnd}
                      onMouseLeave={handleLongPressEnd}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setFileMenu({ x: e.clientX, y: e.clientY, fileId: file.id });
                      }}
                      style={{
                        padding: '6px 14px',
                        fontSize: (file.name === 'diagram.json' || file.name === 'library.txt') ? 11 : 12,
                        cursor: 'pointer',
                        color: activeCodeFileId === file.id ? 'var(--accent)' : 'var(--text2)',
                        background: activeCodeFileId === file.id ? 'rgba(0,255,255,0.08)' : 'transparent',
                        borderLeft: activeCodeFileId === file.id ? '2px solid var(--accent)' : '2px solid transparent',
                        fontFamily: 'JetBrains Mono, monospace',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
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
                        onTouchStart={e => handleLongPressStart('folder', { boardId: group.boardId }, e)}
                        onTouchEnd={handleLongPressEnd}
                        onTouchMove={handleLongPressEnd}
                        onMouseDown={e => handleLongPressStart('folder', { boardId: group.boardId }, e)}
                        onMouseUp={handleLongPressEnd}
                        onMouseLeave={handleLongPressEnd}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setFolderMenu({ x: e.clientX, y: e.clientY, boardId: group.boardId });
                          setFileMenu(null);
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 14px',
                          fontSize: 12,
                          color: 'var(--text3)',
                          fontWeight: 700,
                          fontFamily: 'JetBrains Mono, monospace',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          transition: 'all 0.2s'
                        }}
                      >
                        <span style={{ width: 14, display: 'inline-flex', justifyContent: 'center', opacity: 0.7 }}>
                          {!collapsedBoards[group.boardId] ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                          )}
                        </span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
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
                          onTouchStart={e => handleLongPressStart('file', { fileId: file.id }, e)}
                          onTouchEnd={handleLongPressEnd}
                          onTouchMove={handleLongPressEnd}
                          onMouseDown={e => handleLongPressStart('file', { fileId: file.id }, e)}
                          onMouseUp={handleLongPressEnd}
                          onMouseLeave={handleLongPressEnd}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setFileMenu({ x: e.clientX, y: e.clientY, fileId: file.id });
                          }}
                          style={{
                            padding: '6px 14px 6px 32px',
                            fontSize: (file.name === 'diagram.json' || file.name === 'library.txt') ? 10 : 12,
                            cursor: 'pointer',
                            color: activeCodeFileId === file.id ? 'var(--accent)' : 'var(--text2)',
                            background: activeCodeFileId === file.id ? 'rgba(0,255,255,0.08)' : 'transparent',
                            borderLeft: activeCodeFileId === file.id ? '2px solid var(--accent)' : '2px solid transparent',
                            fontFamily: 'JetBrains Mono, monospace',
                            textDecoration: String(file.name || '').toLowerCase().endsWith(DISABLED_FILE_SUFFIX) ? 'line-through' : 'none',
                            opacity: activeCodeFileId === file.id ? 1 : (String(file.name || '').toLowerCase().endsWith(DISABLED_FILE_SUFFIX) ? 0.6 : 0.85),
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                          }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                          {file.name}{file.dirty ? ' *' : ''}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              {/* Library Button pinned to bottom of Explorer */}
              <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg3)', marginTop: 'auto', paddingBottom: 24, flexShrink: 0 }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSidebarMode('library');
                  }}
                  className="group"
                  style={{
                    width: '100%',
                    padding: '12px 12px',
                    borderRadius: '12px',
                    background: 'var(--accent)',
                    border: 'none',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    boxShadow: '0 4px 12px rgba(0,255,255,0.2)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    <path d="M12 6v10" />
                    <path d="M8 10h8" />
                  </svg>
                  <span>Library Manager</span>
                </button>
              </div>
            </>
          ) : (
            /* Library Manager Mode Content */
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg3)' }}>
                <button 
                  onClick={() => setSidebarMode('explorer')}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1 }}>Library Manager</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', padding: '16px 14px', paddingBottom: 20 }}>
                <form 
                  onSubmit={(e) => { e.preventDefault(); handleSearchLibraries?.(e); }}
                  style={{ display: 'flex', gap: 8, marginBottom: 20 }}
                >
                  <input
                    className="bg-[var(--card)] border border-[var(--border)] text-[var(--text)] px-3.5 py-2 rounded-xl text-xs outline-none font-inherit flex-1 focus:border-[var(--accent)] transition-all"
                    placeholder="Search libraries..."
                    value={libQuery}
                    onChange={e => setLibQuery?.(e.target.value)}
                  />
                  <Btn color="var(--accent)" disabled={isSearchingLib} style={{ padding: '0 12px' }}>
                    {isSearchingLib ? '...' : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>}
                  </Btn>
                </form>

                {libMessage && (
                  <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 12, background: libMessage.type === 'error' ? 'rgba(255,68,68,0.1)' : 'rgba(0,230,118,0.1)', color: libMessage.type === 'error' ? 'var(--red)' : 'var(--green)', border: `1px solid ${libMessage.type === 'error' ? 'rgba(255,68,68,0.2)' : 'rgba(0,230,118,0.2)'}` }}>
                    {libMessage.text}
                  </div>
                )}

                <div className="panel-scroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {libResults && libResults.length > 0 && <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>Search Results</div>}
                  {libResults?.map((lib, idx) => (
                    <div key={idx} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--accent)', wordBreak: 'break-word' }}>{lib.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{lib.author}</div>
                        </div>
                        <Btn
                          color="var(--green)"
                          disabled={installingLib === lib.name}
                          onClick={() => handleInstallLibrary?.(lib.name)}
                          style={{ padding: '4px 10px', fontSize: 10, borderRadius: 6 }}
                        >
                          {installingLib === lib.name ? '...' : 'Install'}
                        </Btn>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.4, marginBottom: 8 }}>{lib.sentence}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace' }}>v{lib.version}</div>
                    </div>
                  ))}

                  {(!libResults || libResults.length === 0) && (
                    <>
                      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 10 }}>Installed</div>
                      {(!libInstalled || libInstalled.length === 0) ? (
                        <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', padding: '10px 0' }}>No external libraries.</div>
                      ) : (
                        libInstalled.map((lib, idx) => (
                          <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>{lib.library?.name || lib.name}</div>
                            <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace' }}>
                              <span>v{lib.library?.version || lib.version}</span>
                              <span style={{ color: 'var(--green)' }}>✓ Installed</span>
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
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, pointerEvents: editingDisabled ? 'none' : 'auto' }}>
          <div className="panel-scroll hide-scrollbar" style={{ display: 'flex', gap: 2, overflowX: 'auto', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {openFiles.map((file) => (
              <div
                key={file.id}
                onClick={() => onOpenCodeFile(file.id)}
                onTouchStart={e => handleLongPressStart('file', { fileId: file.id }, e)}
                onTouchEnd={handleLongPressEnd}
                onTouchMove={handleLongPressEnd}
                onMouseDown={e => handleLongPressStart('file', { fileId: file.id }, e)}
                onMouseUp={handleLongPressEnd}
                onMouseLeave={handleLongPressEnd}
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

          <div className="panel-scroll hide-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>
            {(() => {
              if (!activeFile || !boardComponentMap) return null;
              const pathParts = activeFile.path.split('/');
              if (pathParts.length < 3 || pathParts[0] !== 'project') return null;
              
              const boardId = pathParts[1];
              const boardComp = boardComponentMap.get(boardId);
              if (!boardComp || !boardComp.attrs?.useUploadedFirmware) return null;
              
              const firmwareName = boardComp.attrs.firmwareArtifactName || 'custom binary';
              
              return (
                <div className="bg-[var(--accent)]/5 border-b border-[var(--accent)]/20 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
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
              background: theme === 'light' ? 'rgba(248, 250, 252, 1)' : 'rgba(13, 21, 37, 1)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              minWidth: 180,
              padding: '5px',
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
              background: theme === 'light' ? 'rgba(248, 250, 252, 1)' : 'rgba(13, 21, 37, 1)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              minWidth: 180,
              padding: '5px',
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
  );
}
