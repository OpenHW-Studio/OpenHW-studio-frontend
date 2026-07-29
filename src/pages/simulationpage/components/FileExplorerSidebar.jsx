import React from 'react';

const DISABLED_FILE_SUFFIX = '.disabled';

const FileItem = React.memo(({
  file,
  activeCodeFileId,
  theme,
  onOpenCodeFile,
  setCodeTab,
  setFileMenu,
  setSelected,
  isNested = false
}) => {
  const isActive = activeCodeFileId === file.id;
  const isDisabled = String(file.name || '').toLowerCase().endsWith(DISABLED_FILE_SUFFIX);

  const handleClick = React.useCallback((e) => {
    e.stopPropagation();
    if (setFileMenu) setFileMenu(null);
    if (setCodeTab) setCodeTab('code');
    if (onOpenCodeFile) onOpenCodeFile(file.id);
    if (setSelected) setSelected(null);
  }, [file.id, onOpenCodeFile, setCodeTab, setFileMenu, setSelected]);

  const handleContextMenu = React.useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (setFileMenu) setFileMenu({ x: e.clientX, y: e.clientY, fileId: file.id });
  }, [file.id, setFileMenu]);

  const textColor = isActive 
    ? (theme === 'light' ? '#0284c7' : '#00d4ff') 
    : (theme === 'light' ? (isNested ? '#475569' : '#334155') : '#e2e8f0');

  const bgColor = isActive 
    ? (theme === 'light' ? 'rgba(2,132,199,0.1)' : 'rgba(0,212,255,0.1)') 
    : 'transparent';

  const borderLeftColor = isActive 
    ? (theme === 'light' ? '#0284c7' : '#00d4ff') 
    : 'transparent';

  return (
    <div
      key={file.id}
      data-tour-file={file.name}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      style={{
        padding: isNested ? '4px 16px 4px 32px' : '4px 16px',
        fontSize: 13,
        cursor: 'pointer',
        color: textColor,
        background: bgColor,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderLeft: `2px solid ${borderLeftColor}`,
        fontFamily: "'Inter', sans-serif",
        transition: 'all 0.1s',
        textDecoration: isDisabled ? 'line-through' : 'none',
        opacity: isDisabled ? 0.6 : 1,
      }}
      className="hover:bg-[rgba(255,255,255,0.03)]"
    >
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {file.name}{file.dirty ? ' *' : ''}
      </span>
    </div>
  );
});

const BoardFolder = React.memo(({
  group,
  collapsedBoards,
  setCollapsedBoards,
  selected,
  setSelected,
  boardColors,
  theme,
  activeCodeFileId,
  onOpenCodeFile,
  setCodeTab,
  setFileMenu,
  setFolderMenu
}) => {
  const isCollapsed = Boolean(collapsedBoards[group.boardId]);
  const isSelected = selected === group.boardId;

  const handleClick = React.useCallback((e) => {
    e.stopPropagation();
    if (setCollapsedBoards) {
      setCollapsedBoards((prev) => ({ ...prev, [group.boardId]: !prev[group.boardId] }));
    }
    if (setSelected) setSelected(group.boardId);
    if (setFileMenu) setFileMenu(null);
    if (setFolderMenu) setFolderMenu(null);
  }, [group.boardId, setCollapsedBoards, setFileMenu, setFolderMenu, setSelected]);

  const handleContextMenu = React.useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (setFolderMenu) setFolderMenu({ x: e.clientX, y: e.clientY, boardId: group.boardId });
    if (setFileMenu) setFileMenu(null);
  }, [group.boardId, setFileMenu, setFolderMenu]);

  const folderColor = boardColors[group.boardId] || (theme === 'light' ? '#475569' : '#94a3b8');

  return (
    <div>
      <button
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '6px 12px',
          fontSize: 12,
          color: folderColor,
          fontWeight: 800,
          fontFamily: "'Inter', sans-serif",
          background: isSelected ? (theme === 'light' ? 'rgba(2,132,199,0.05)' : 'rgba(0,212,255,0.05)') : 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          transition: 'all 0.1s',
          textTransform: 'uppercase',
          letterSpacing: 0.8
        }}
        title={isCollapsed ? 'Expand folder' : 'Collapse folder'}
        className="hover:bg-[rgba(255,255,255,0.02)]"
      >
        <span style={{ width: 16, display: 'inline-flex', justifyContent: 'center', opacity: 0.8 }}>
          {!isCollapsed ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          )}
        </span>
        <span style={{ opacity: 0.70 }}>{group.boardId}</span>
      </button>

      {!isCollapsed && group.files.map((file) => (
        <FileItem
          key={file.id}
          file={file}
          activeCodeFileId={activeCodeFileId}
          theme={theme}
          onOpenCodeFile={onOpenCodeFile}
          setCodeTab={setCodeTab}
          setFileMenu={setFileMenu}
          setSelected={setSelected}
          isNested={true}
        />
      ))}
    </div>
  );
});

export const FileExplorerSidebar = React.memo(({
  explorerRef,
  isExplorerDragging,
  explorerWidth,
  theme,
  projectName,
  projectRootFiles,
  projectBoardFiles,
  activeCodeFileId,
  selected,
  setSelected,
  onOpenCodeFile,
  setCodeTab,
  onCreateCodeFile,
  onSaveCodeFile,
  setFileMenu,
  setFolderMenu,
  collapsedBoards,
  setCollapsedBoards,
  boardColors = {},
  isActiveFileLibraryTxt,
  isActiveFileIno,
  hasBlocksInCanvas,
  isLibPanelOpen,
  setIsLibPanelOpen,
  inoManualEditEnabled,
  setInoManualEditEnabled,
  onMouseDownExplorerResize,
}) => {
  const handleEmptyClick = React.useCallback((e) => {
    if (e.target !== e.currentTarget) return;
    if (setSelected) setSelected(null);
    if (onOpenCodeFile) onOpenCodeFile(null);
    if (setFileMenu) setFileMenu(null);
  }, [onOpenCodeFile, setFileMenu, setSelected]);

  const handleNewFile = React.useCallback((e) => {
    e.stopPropagation();
    if (onCreateCodeFile) onCreateCodeFile('Untitled', true);
  }, [onCreateCodeFile]);

  const handleSaveFile = React.useCallback((e) => {
    e.stopPropagation();
    if (onSaveCodeFile && activeCodeFileId) onSaveCodeFile(activeCodeFileId);
  }, [activeCodeFileId, onSaveCodeFile]);

  const handleToggleLib = React.useCallback((e) => {
    e.stopPropagation();
    if (setFileMenu) setFileMenu(null);
    if (setIsLibPanelOpen) setIsLibPanelOpen(!isLibPanelOpen);
  }, [isLibPanelOpen, setFileMenu, setIsLibPanelOpen]);

  const handleToggleInoEdit = React.useCallback((e) => {
    e.stopPropagation();
    if (setFileMenu) setFileMenu(null);
    if (!inoManualEditEnabled) {
      const confirmEnable = window.confirm(
        "⚠️ Warning: Enabling manual text editing allows you to type directly in the code editor. However, any future block changes will replace your manual edits! Do you want to enable manual editing?"
      );
      if (confirmEnable && setInoManualEditEnabled) {
        setInoManualEditEnabled(true);
      }
    } else {
      if (setInoManualEditEnabled) setInoManualEditEnabled(false);
    }
  }, [inoManualEditEnabled, setFileMenu, setInoManualEditEnabled]);

  return (
    <>
      <div
        ref={explorerRef}
        className="code-explorer-container"
        style={{
          width: isExplorerDragging ? 'var(--explorer-width)' : explorerWidth,
          maxWidth: 200,
          borderRight: theme === 'light' ? '1px solid #cbd5e1' : '1px solid #1e2d47',
          display: 'flex',
          flexDirection: 'column',
          background: theme === 'light' ? '#f1f5f9' : '#090e1a',
          flexShrink: 0,
          willChange: isExplorerDragging ? 'width' : 'auto',
          contain: isExplorerDragging ? 'size layout paint' : 'none',
        }}
      >
        {/* Header */}
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
              onClick={handleNewFile}
              title="New File"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 2, display: 'flex', opacity: 0.7 }}
              className="hover:opacity-100"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button
              onClick={handleSaveFile}
              title="Save"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: 2, display: 'flex', opacity: 0.7 }}
              className="hover:opacity-100"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            </button>
          </div>
        </div>

        {/* Scrollable File Tree */}
        <div className="panel-scroll" onClick={handleEmptyClick} style={{ flex: 1, overflow: 'auto', cursor: 'default', padding: '4px 0' }}>
          <div style={{ padding: '8px 12px', fontSize: 11, color: theme === 'light' ? '#0284c7' : '#00d4ff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.8 }}>{projectName || 'project'}</div>

          {projectRootFiles.map((file) => (
            <FileItem
              key={file.id}
              file={file}
              activeCodeFileId={activeCodeFileId}
              theme={theme}
              onOpenCodeFile={onOpenCodeFile}
              setCodeTab={setCodeTab}
              setFileMenu={setFileMenu}
              setSelected={setSelected}
              isNested={false}
            />
          ))}

          {projectBoardFiles.map((group) => (
            <BoardFolder
              key={group.boardId}
              group={group}
              collapsedBoards={collapsedBoards}
              setCollapsedBoards={setCollapsedBoards}
              selected={selected}
              setSelected={setSelected}
              boardColors={boardColors}
              theme={theme}
              activeCodeFileId={activeCodeFileId}
              onOpenCodeFile={onOpenCodeFile}
              setCodeTab={setCodeTab}
              setFileMenu={setFileMenu}
              setFolderMenu={setFolderMenu}
            />
          ))}
        </div>

        {/* Libraries Button at bottom of Explorer */}
        {isActiveFileLibraryTxt && (
          <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.05)' }}>
            <button
              data-tour-step="library"
              onClick={handleToggleLib}
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
        )}

        {/* 
          Edit Enable / Disable Button at bottom of Explorer for .ino files 
          NOTE: This button has been hidden per user request. 
        */}
        {/* {isActiveFileIno && hasBlocksInCanvas && (
          <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.05)' }}>
            ... button code hidden ...
          </div>
        )} */}
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
  );
});
