import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
const DOCS_URL = import.meta.env.VITE_DOCS_URL || 'https://openhw-studio.fossee.in/docs/';

import { Btn } from './Btn';
import AutofixPreviewPanel from '../../components/AutofixPreviewPanel.jsx';

const MenuDropdown = ({ items, visible, isSubmenu = false, theme, setActiveMenu }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  useEffect(() => {
    if (!visible) setHoveredIdx(null);
  }, [visible]);

  if (!visible) return null;

  return (
    <div 
      style={{
        position: 'absolute',
        top: isSubmenu ? 0 : '100%',
        left: isSubmenu ? '100%' : 0,
        zIndex: 10000,
        paddingTop: isSubmenu ? 0 : '4px',
        paddingLeft: isSubmenu ? '4px' : 0,
      }}
    >
      <div 
        className="canvas-menu bg-[var(--bg2)] border border-[var(--border)] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] min-w-[200px]"
        style={{
          background: theme === 'light' ? 'rgba(248, 250, 252, 0.95)' : 'rgba(13, 21, 37, 0.94)',
          backdropFilter: 'blur(16px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
          border: theme === 'light' ? '1px solid rgba(203, 213, 225, 0.8)' : '1px solid rgba(30, 45, 71, 0.8)',
          borderRadius: '12px',
          boxShadow: theme === 'light' ? '0 8px 32px rgba(0, 0, 0, 0.08)' : '0 10px 40px rgba(0,0,0,0.5)',
          minWidth: '200px',
          padding: '5px',
          transformOrigin: 'top left',
          fontFamily: "'Space Grotesk', sans-serif",
          willChange: 'transform, opacity, backdrop-filter',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
      >
        {items.map((item, idx) => (
          item.type === 'separator' ? (
            <div key={idx} style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
          ) : (
            <div 
              key={idx} 
              style={{ position: 'relative' }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <button
                className="canvas-menu-item"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  if (!item.submenu) {
                    item.onClick?.();
                    setActiveMenu(null);
                  }
                }}
                style={{
                  background: hoveredIdx === idx ? 'var(--bg3)' : 'none',
                  ...(item.style || {})
                }}
              >
                <span>{item.label}</span>
                {item.shortcut && <span style={{ color: 'var(--text3)', fontSize: '11px', marginLeft: '12px' }}>{item.shortcut}</span>}
                {item.submenu && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: '10px' }}>
                    <path d="M3 2L6 5L3 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              {item.submenu && hoveredIdx === idx && (
                <MenuDropdown items={item.submenu} visible={true} isSubmenu={true} theme={theme} setActiveMenu={setActiveMenu} />
              )}
            </div>
          )
        ))}
      </div>
    </div>
  );
};

const MenuButton = ({ label, menuKey, items, activeMenu, setActiveMenu, theme }) => (
  <div 
    style={{ position: 'relative', pointerEvents: 'auto' }}
    onMouseLeave={() => setActiveMenu(null)}
  >
    <button
      onMouseDown={(e) => {
        e.stopPropagation();
        setActiveMenu(activeMenu === menuKey ? null : menuKey);
      }}
      style={{
        background: activeMenu === menuKey ? 'rgba(255,255,255,0.05)' : 'none',
        border: 'none',
        color: activeMenu === menuKey ? 'var(--text)' : 'var(--text3)',
        fontSize: '14px',
        fontWeight: '500',
        padding: '2px 8px',
        cursor: 'pointer',
        borderRadius: '4px',
        transition: 'background 0.2s, color 0.2s',
        pointerEvents: 'auto'
      }}
      onMouseEnter={(e) => { e.target.style.background = 'rgba(255,255,255,0.05)'; e.target.style.color = 'var(--text)'; }}
      onMouseLeave={(e) => {
        if (activeMenu !== menuKey) {
          e.target.style.background = 'none';
          e.target.style.color = 'var(--text3)';
        }
      }}
    >
      {label}
    </button>
    <MenuDropdown items={items} visible={activeMenu === menuKey} theme={theme} setActiveMenu={setActiveMenu} />
  </div>
);

const FloatingPanel = ({ title, show, onClose, children, width = 350 }) => {
  if (!show) return null;
  return (
    <div style={{
      position: 'fixed', top: '80px', right: '20px', width: `${width}px`,
      background: 'rgba(23, 23, 23, 0.85)', backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px',
      boxShadow: '0 20px 50px rgba(0,0,0,0.5)', zIndex: 9999,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      animation: 'panel-appear 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(255, 255, 255, 0.03)'
      }}>
        <span style={{ fontSize: '13px', fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }} 
          style={{
            background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'rgba(255, 255, 255, 0.6)',
            cursor: 'pointer', padding: '6px', borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s'
          }} onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          border: 2px solid transparent;
          background-clip: content-box;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
          background-clip: content-box;
        }
      `}</style>
      <div className="custom-scrollbar" style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );
};

function TopToolboxInternal(props) {
  // --- UI CONFIG ---
  const TITLE_WIDTH = '180px'; // Adjust this to change the project title area width
  // -----------------

  const { board, setBoard, isRunning, isPaused, handleRun, handlePause, handleResume, handleStop, isCompiling, isBooting, assessmentMode, assessmentProjectName, isSubmittingAssessment, handleAssessmentSubmit, undo, redo, selected, rotateComponent, theme, toggleTheme, showViewPanel, setShowViewPanel, viewPanelSection, setViewPanelSection, schematicDataUrl, setSchematicDataUrl, schematicLoading, setSchematicLoading, downloadSchematicPng, downloadSchematicPdf, generateSchematic, downloadCompCsv, importFileRef, downloadPng, importPng, downloadSimulationJson, handleSave, isExporting, handleShareSimulation, isSharingSimulation, refreshProjectList, showProjectsDropdown, setShowProjectsDropdown, handleNewProject, handleStartRename, handleConfirmRename, renamingProjectId, setRenamingProjectId, renameValue, setRenameValue, handleLoadProject, handleDeleteProject, handleBackupWorkflow, backupRestoreInputRef, wokwiImportInputRef, handleImportWokwiZip, handleRestoreWorkflow, handleSyncToCloud, user, isAuthenticated, myProjects, currentProjectId, projectName: projectNameProp, formatProjectDate, saveHistory, setWires, setComponents, setSelected, history, components, wires, webSerialSupported, hardwareBoards, hardwareBoardId, setHardwareBoardId, hardwarePortPath, setHardwarePortPath, resolvedHardwarePort, hardwareAvailablePorts, showAllHardwarePorts, setShowAllHardwarePorts, refreshHardwarePorts, isLoadingHardwarePorts, hardwareBaudRate, setHardwareBaudRate, hardwareResetMethod, setHardwareResetMethod, connectHardwareSerial, disconnectHardwareSerial, uploadToHardware, hardwareConnected, hardwareConnecting, isUploadingHardware, hardwareStatus, setShowProjectsSidebar, setProjectsSidebarTab, editingDisabled = false, validationErrors = [], autofixPlan, autofixStatus, autofixLog, onApplyPlan, onRefresh, autoWiringEnabled, setAutoWiringEnabled, autoBreadboardEnabled, setAutoBreadboardEnabled, autoCodingEnabled, setAutoCodingEnabled, showAutofix, setShowAutofix, showShortcuts, setShowShortcuts, onStartTour } = props;
  const navigate = useNavigate();


  const viewPanelRef = useRef(null);
  const connectPanelRef = useRef(null);
  const projectsDropdownRef = useRef(null);
  const [showConnectPanel, setShowConnectPanel] = useState(false);
  const [showAdvancedFlash, setShowAdvancedFlash] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
  const [showSchematic, setShowSchematic] = useState(false);
  const [showComponentList, setShowComponentList] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (showConnectPanel && connectPanelRef.current && !connectPanelRef.current.contains(event.target)) {
        setShowConnectPanel(false);
      }

      if (showProjectsDropdown && projectsDropdownRef.current && !projectsDropdownRef.current.contains(event.target)) {
        setShowProjectsDropdown(false);
      }

      if (activeMenu && menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenu(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showConnectPanel, showProjectsDropdown, activeMenu, setShowConnectPanel, setShowProjectsDropdown]);

  const currentProject = (myProjects || []).find(p => p.id === currentProjectId);
  const projectName = projectNameProp || (currentProject ? (currentProject.name || currentProject.id) : (currentProjectId || 'Untitled Project'));



  const fileMenuItems = [
    { label: 'New', onClick: handleNewProject },
    { label: 'Open', shortcut: 'Ctrl+O', onClick: () => { setShowProjectsSidebar(true); setProjectsSidebarTab('projects'); } },
    { label: 'Import', onClick: () => importFileRef.current?.click() },
    { label: 'Save', shortcut: 'Ctrl+S', onClick: handleSave },
    { label: 'Make a copy', onClick: () => handleSave() }, // Placeholder for copy
    { type: 'separator' },
    { label: 'Save Local Copy', onClick: handleBackupWorkflow }
  ];

  const toolMenuItems = [
    { label: 'Schematic View', onClick: () => { setShowSchematic(true); generateSchematic(); } },
    { label: 'Component List', onClick: () => setShowComponentList(true) },
    { label: 'Alignment Lab', onClick: () => navigate('/alignment-lab') },
    { type: 'separator' },
    { 
      label: 'Export', 
      submenu: [
        { label: 'PNG', onClick: downloadPng },
        { label: 'JSON', onClick: downloadSimulationJson }
      ]
    },
    { type: 'separator' },
    { label: 'Connect Hardware', onClick: () => setShowConnectPanel(true) }
  ];

  const assistMenuItems = [
    { 
      label: `Auto-Wiring: ${autoWiringEnabled ? 'ON' : 'OFF'}`, 
      onClick: () => setAutoWiringEnabled?.(!autoWiringEnabled),
    },
    { 
      label: `Breadboard: ${autoBreadboardEnabled ? 'ON' : 'OFF'}`, 
      onClick: autoWiringEnabled ? (() => setAutoBreadboardEnabled?.(!autoBreadboardEnabled)) : undefined,
      style: { opacity: autoWiringEnabled ? 1 : 0.4, pointerEvents: autoWiringEnabled ? 'auto' : 'none' }
    },
    { 
      label: `Auto-Coding: ${autoCodingEnabled ? 'ON' : 'OFF'}`, 
      onClick: () => setAutoCodingEnabled?.(!autoCodingEnabled),
    }
  ];

  const helpMenuItems = [
    { label: 'Start Tour', onClick: onStartTour },
    { label: 'Documentation', onClick: () => window.open(DOCS_URL, '_blank') },
    { label: 'Keyboard Shortcuts', shortcut: 'H', onClick: () => setShowShortcuts(true) },
    { 
      label: 'Assist', 
      submenu: assistMenuItems
    },
    { type: 'separator' },
    { label: 'About OpenHW Studio', onClick: () => navigate('/about') }
  ];

  return (
    <header className="relative z-[1000] flex items-center gap-4 px-5 py-3 bg-[var(--bg2)] border-b border-[var(--border)] shrink-0 flex-wrap">
      <style>{`
        @keyframes panel-appear {
          from { opacity: 0; transform: translateX(20px) scale(0.98); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>

      <div className="flex items-center gap-4">
        <img
          src="/logo-Photoroom.png"
          alt="OpenHW Studio Logo"
          title="Go to Landing Page"
          draggable="false"
          style={{ height: '36px', width: 'auto', flexShrink: 0, cursor: 'pointer', marginLeft: '6px' }}
          onClick={() => navigate('/')}
        />

        <div className="flex flex-col" style={{ minWidth: TITLE_WIDTH, flexShrink: 0, marginTop: '2px' }}>
          <div style={{ height: '28px', position: 'relative', width: '100%' }}>
            {renamingProjectId === currentProjectId ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => handleConfirmRename(currentProjectId)}
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmRename(currentProjectId)}
                style={{
                  fontSize: '18px', fontWeight: '600', color: 'var(--text)', 
                  background: 'transparent', border: '1px solid #2563eb', borderRadius: '4px',
                  padding: '0px 7px', outline: 'none', width: '100%', boxSizing: 'border-box',
                  height: '28px', position: 'absolute', top: 0, left: 0,
                  fontFamily: 'inherit', margin: 0
                }}
              />
            ) : (
              <span 
                onClick={(e) => handleStartRename(currentProject || { id: currentProjectId, name: projectName }, e)}
                style={{ 
                  fontSize: '18px', fontWeight: '600', color: 'var(--text)', 
                  cursor: 'text', whiteSpace: 'nowrap', overflow: 'hidden', 
                  textOverflow: 'ellipsis', width: '100%',
                  padding: '0px 7px', height: '28px', lineHeight: '26px',
                  position: 'absolute', top: 0, left: 0, boxSizing: 'border-box',
                  display: 'block', border: '1px solid transparent'
                }}
                title={projectName}
              >
                {projectName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 -ml-2" ref={menuRef} style={{ position: 'relative', zIndex: 1500 }}>
            <MenuButton label="File" menuKey="file" items={fileMenuItems} activeMenu={activeMenu} setActiveMenu={setActiveMenu} theme={theme} />
            <MenuButton label="Tool" menuKey="tool" items={toolMenuItems} activeMenu={activeMenu} setActiveMenu={setActiveMenu} theme={theme} />
            <MenuButton label="Help" menuKey="help" items={helpMenuItems} activeMenu={activeMenu} setActiveMenu={setActiveMenu} theme={theme} />
          </div>
        </div>


      </div>

      <div className="flex items-center gap-2 flex-1 flex-wrap">

        {/* RUN button */}
        <Btn
          color={(isRunning || isCompiling || isBooting) ? (isPaused ? 'var(--orange)' : 'var(--green)') : 'var(--green)'}
          disabled={(isRunning || isCompiling || isBooting) || editingDisabled}
          onClick={!(isRunning || isCompiling || isBooting) && !editingDisabled ? handleRun : undefined}
          title={(isRunning || isCompiling || isBooting) ? (isCompiling ? 'Compiling…' : isBooting ? 'Booting…' : isPaused ? 'Paused' : 'Running') : 'Run'}
        >
          {(isRunning || isCompiling || isBooting) ? (
            isCompiling ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'toolbar-spin 0.9s linear infinite', flexShrink: 0 }}>
                  <path d="M21 12a9 9 0 1 1-4.5-7.8" />
                </svg>
                Compiling…
              </>
            ) : isBooting ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'toolbar-spin 0.9s linear infinite', flexShrink: 0 }}>
                  <path d="M21 12a9 9 0 1 1-4.5-7.8" />
                </svg>
                Booting…
              </>
            ) : isPaused ? 'Paused' : 'Running…'
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style={{ flexShrink: 0 }}><polygon points="2,1 11,6 2,11" /></svg>
              Run
            </>
          )}
        </Btn>

        {/* STOP button — SVG icon only */}
        <Btn color={(isRunning || isCompiling || isBooting) ? 'var(--red)' : undefined} disabled={!(isRunning || isCompiling || isBooting)} onClick={(isRunning || isCompiling || isBooting) ? handleStop : undefined} title="Stop" iconOnly>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><rect width="13" height="13" rx="2" /></svg>
        </Btn>

        {/* PAUSE / RESUME button — visible only when running and not still compiling or booting */}
        {isRunning && !isCompiling && !isBooting && (
          <Btn
            color={isPaused ? 'var(--green)' : 'var(--orange)'}
            onClick={isPaused ? handleResume : handlePause}
            title={isPaused ? 'Resume' : 'Pause'}
            iconOnly
          >
            {isPaused ? (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><polygon points="2,1 12,6.5 2,12" /></svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><rect x="1.5" y="1" width="3.5" height="11" rx="1" /><rect x="8" y="1" width="3.5" height="11" rx="1" /></svg>
            )}
          </Btn>
        )}

        {assessmentMode && (
          <Btn
            color="var(--accent)"
            disabled={isSubmittingAssessment || !assessmentProjectName}
            onClick={!isSubmittingAssessment ? handleAssessmentSubmit : undefined}
            title={!assessmentProjectName ? 'Assessment project is missing' : 'Submit assessment'}
          >
            {isSubmittingAssessment ? 'Submitting...' : 'Submit Assessment'}
          </Btn>
        )}

        <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />

        {/* UNDO — SVG icon only */}
        <Btn onClick={undo} disabled={history.past.length === 0 || isRunning || editingDisabled} title="Undo" iconOnly>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" clipRule="evenodd" d="M7.53033 3.46967C7.82322 3.76256 7.82322 4.23744 7.53033 4.53033L5.81066 6.25H15C18.1756 6.25 20.75 8.82436 20.75 12C20.75 15.1756 18.1756 17.75 15 17.75H8.00001C7.58579 17.75 7.25001 17.4142 7.25001 17C7.25001 16.5858 7.58579 16.25 8.00001 16.25H15C17.3472 16.25 19.25 14.3472 19.25 12C19.25 9.65279 17.3472 7.75 15 7.75H5.81066L7.53033 9.46967C7.82322 9.76256 7.82322 10.2374 7.53033 10.5303C7.23744 10.8232 6.76256 10.8232 6.46967 10.5303L3.46967 7.53033C3.17678 7.23744 3.17678 6.76256 3.46967 6.46967L6.46967 3.46967C6.76256 3.17678 7.23744 3.17678 7.53033 3.46967Z" />
          </svg>
        </Btn>

        {/* REDO — SVG icon only */}
        <Btn onClick={redo} disabled={history.future.length === 0 || isRunning || editingDisabled} title="Redo" iconOnly>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 7H9.00001C6.23858 7 4 9.23857 4 12C4 14.7614 6.23858 17 9 17H16M20 7L17 4M20 7L17 10" />
          </svg>
        </Btn>

        <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />

        {/* DELETE — SVG icon only */}
        <Btn color={selected ? 'var(--red)' : undefined} disabled={!selected || isRunning || editingDisabled} onClick={() => {
          if (!selected || isRunning || editingDisabled) return;
          saveHistory();
          if (selected.match(/^w\d+$/)) {
            setWires(prev => prev.filter(w => w.id !== selected));
          } else {
            setComponents(prev => prev.filter(c => c.id !== selected))
            setWires(prev => prev.filter(w => !w.from.startsWith(selected + ':') && !w.to.startsWith(selected + ':')))
          }
          setSelected(null)
        }} title="Delete selected" iconOnly>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" /><path d="M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </Btn>

        {/* ROTATE — SVG icon only, visible when a component is selected */}
        {selected && components.find(c => c.id === selected) && (
          <Btn onClick={() => rotateComponent(selected)} disabled={isRunning || editingDisabled} title="Rotate 90°" iconOnly>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </Btn>
        )}

        {/* THEME TOGGLE — SVG icon only */}
        <Btn onClick={toggleTheme} title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'} iconOnly>
          {theme === 'dark' ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </Btn>

        {/* AUTOFIX BUTTON */}
        <Btn
          onClick={() => {
            const next = !showAutofix;
            setShowAutofix(next);
            if (next) onRefresh?.();
          }}
          color={validationErrors?.length > 0 ? 'var(--orange)' : undefined}
          disabled={!validationErrors?.length}
          title={validationErrors?.length ? `Auto-fix available: ${validationErrors.length} issue(s)` : 'No issues to fix'}
          iconOnly
        >
          <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M29.5,24.5L16.563,11.563C16.84,10.758,17,9.899,17,9c0-4.411-3.589-8-8-8 C8.338,1,7.659,1.089,6.982,1.266c-0.347,0.09-0.619,0.359-0.713,0.706C6.175,2.317,6.273,2.687,6.527,2.941l2.645,2.645 C9.549,5.964,9.757,6.466,9.757,7c0,0.534-0.208,1.036-0.586,1.414L8.414,9.172C8.036,9.549,7.534,9.757,7,9.757 S5.964,9.549,5.586,9.172L2.941,6.526c-0.19-0.19-0.445-0.293-0.707-0.293c-0.087,0-0.175,0.011-0.262,0.035 C1.625,6.363,1.356,6.635,1.266,6.982C1.089,7.659,1,8.338,1,9c0,4.411,3.589,8,8,8c0.899,0,1.758-0.16,2.563-0.437L24.5,29.5 c0.69,0.69,1.595,1.036,2.5,1.036s1.81-0.345,2.5-1.036C30.881,28.119,30.881,25.881,29.5,24.5z M27,28c-0.552,0-1-0.448-1-1 c0-0.552,0.448-1,1-1s1,0.448,1,1C28,27.552,27.552,28,27,28z" />
          </svg>
        </Btn>
      </div>

      {/* RIGHT SIDE — right to left: Sign In/User, My Projects, Save, Export, Import */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div ref={connectPanelRef} style={{ position: 'relative' }}>
          <Btn
            color={hardwareConnected ? 'var(--green)' : undefined}
            onClick={() => setShowConnectPanel(v => !v)}
            title="Connect hardware and flash over bootloader"
          >
            Connect
          </Btn>
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: 320,
            background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,.45)', zIndex: 10000,
            overflow: 'hidden',
            maxHeight: showConnectPanel ? 460 : 0,
            opacity: showConnectPanel ? 1 : 0,
            transition: 'max-height 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease',
            pointerEvents: showConnectPanel ? 'auto' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 10px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Hardware Connect</span>
              <button onClick={() => setShowConnectPanel(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>✕</button>
            </div>

            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {!webSerialSupported && (
                <div style={{ fontSize: 12, color: 'var(--orange)', lineHeight: 1.45 }}>
                  Web Serial is not available in this browser. Flash upload can still work via backend port, but serial monitor connect needs Chrome/Edge over HTTPS or localhost.
                </div>
              )}
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, color: 'var(--text3)' }}>Board from Canvas</label>
                  <select
                    value={hardwareBoardId}
                    onChange={(e) => setHardwareBoardId(e.target.value)}
                    style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '7px 8px', fontSize: 12 }}
                  >
                    {hardwareBoards.length === 0 ? (
                      <option value="">No programmable board on canvas</option>
                    ) : hardwareBoards.map((b) => (
                      <option key={b.id} value={b.id}>{b.id} ({b.type})</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, color: 'var(--text3)' }}>Detected Port (Auto)</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 8, padding: '7px 8px', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', minHeight: 32, display: 'flex', alignItems: 'center' }}>
                      {resolvedHardwarePort || 'No ports found'}
                    </div>
                    <Btn onClick={refreshHardwarePorts} disabled={isLoadingHardwarePorts} title="Refresh available serial ports">{isLoadingHardwarePorts ? '...' : '↻'}</Btn>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text3)' }}>
                    <input
                      id="show-all-ports"
                      type="checkbox"
                      checked={showAllHardwarePorts}
                      onChange={(e) => setShowAllHardwarePorts(e.target.checked)}
                    />
                    <label htmlFor="show-all-ports" style={{ cursor: 'pointer' }}>Show all serial ports</label>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.35 }}>
                    Off: only likely dev boards are shown. On: include Bluetooth and other virtual COM ports.
                  </div>
                </div>

                <button
                  onClick={() => setShowAdvancedFlash((v) => !v)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text2)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}
                >
                  <span>Advanced</span>
                  <span>{showAdvancedFlash ? '▴' : '▾'}</span>
                </button>

                {showAdvancedFlash && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 11, color: 'var(--text3)' }}>Port Override (optional)</label>
                      <select
                        value={hardwarePortPath}
                        onChange={(e) => setHardwarePortPath(e.target.value)}
                        style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '7px 8px', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
                      >
                        <option value="">Auto ({resolvedHardwarePort || 'none'})</option>
                        {(hardwareAvailablePorts || []).map((p) => (
                          <option key={p.port} value={p.port}>{p.label || p.port}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 11, color: 'var(--text3)' }}>Baud Rate</label>
                      <select
                        value={hardwareBaudRate}
                        onChange={(e) => setHardwareBaudRate(e.target.value)}
                        style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '7px 8px', fontSize: 12 }}
                      >
                        {['9600', '19200', '38400', '57600', '115200', '230400', '460800', '921600'].map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 11, color: 'var(--text3)' }}>Reset Method</label>
                      <select
                        value={hardwareResetMethod}
                        onChange={(e) => setHardwareResetMethod(e.target.value)}
                        style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '7px 8px', fontSize: 12 }}
                      >
                        <option value="normal">Normal (RTS/DTR)</option>
                        <option value="no-rts-dtr">No RTS/DTR</option>
                      </select>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 6 }}>
                  {!hardwareConnected ? (
                    <Btn
                      color="var(--accent)"
                      onClick={connectHardwareSerial}
                      disabled={!webSerialSupported || hardwareConnecting || !hardwareBoardId || hardwareBoards.length === 0}
                      title="Open browser serial device picker"
                    >
                      {hardwareConnecting ? 'Connecting...' : 'Connect'}
                    </Btn>
                  ) : (
                    <Btn color="var(--red)" onClick={disconnectHardwareSerial} title="Close serial connection">Disconnect</Btn>
                  )}

                  <Btn
                    color="var(--green)"
                    onClick={uploadToHardware}
                    disabled={!hardwareBoardId || isUploadingHardware || hardwareBoards.length === 0}
                    title="Flash selected board using backend bootloader uploader"
                  >
                    {isUploadingHardware ? 'Uploading...' : 'Upload'}
                  </Btn>
                </div>

                <div style={{ fontSize: 11, color: hardwareConnected ? 'var(--green)' : 'var(--text3)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                  {hardwareStatus}
                </div>
              </>
            </div>
          </div>
        </div>

        {/* Hidden file inputs */}
        <input ref={importFileRef} type="file" accept=".png,image/png,.json,application/json" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) importPng(e.target.files[0]); }} />
        <input ref={backupRestoreInputRef} type="file" accept=".zip" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) { handleRestoreWorkflow(e.target.files[0]); e.target.value = ''; } }} />
        <input ref={wokwiImportInputRef} type="file" accept=".zip" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) { handleImportWokwiZip(e.target.files[0]); e.target.value = ''; } }} />

        {user?.role && user.role !== 'student' && (
          <Btn
            color="var(--green)"
            onClick={handleShareSimulation}
            disabled={isSharingSimulation}
            title={isAuthenticated ? 'Create a share link for this simulator page' : 'Sign in to share this simulator page'}
          >
            {isSharingSimulation ? 'Sharing...' : 'Share'}
          </Btn>
        )}

        <Btn
          onClick={() => {
            refreshProjectList();
            setProjectsSidebarTab('projects');
            setShowProjectsSidebar(v => !v);
          }}
          title="View and manage your saved projects"
        > {isAuthenticated ? (user?.name?.split(' ')[0] || 'User') : 'Local'}</Btn>

      </div>
      <FloatingPanel title="Auto-fix" show={showAutofix} onClose={() => setShowAutofix(false)} width={380}>
        <div style={{ padding: '12px 16px' }}>
          <AutofixPreviewPanel 
            project={{ components, connections: wires }} 
            validationErrors={validationErrors || []} 
            autofixPlan={autofixPlan}
            autofixStatus={autofixStatus}
            autofixLog={autofixLog || []}
            onApplyPlan={onApplyPlan}
            onRefresh={onRefresh}
          />
        </div>
      </FloatingPanel>
      <FloatingPanel title="Schematic View" show={showSchematic} onClose={() => setShowSchematic(false)} width={420}>
        {schematicLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'toolbar-spin 0.9s linear infinite', marginBottom: '12px' }}><path d="M21 12a9 9 0 1 1-4.5-7.8"/></svg>
            <div style={{ fontWeight: '600', color: '#fff' }}>Generating Schematic...</div>
            <div style={{ fontSize: '11px', marginTop: '4px' }}>Capturing current circuit layout</div>
          </div>
        ) : schematicDataUrl ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ 
              background: '#000', borderRadius: '12px', overflow: 'hidden', 
              border: '1px solid rgba(255,255,255,0.1)', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)' 
            }}>
              <img src={schematicDataUrl} alt="Schematic" style={{ width: '100%', display: 'block' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={downloadSchematicPng} style={{ 
                flex: 1, padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', 
                color: '#fff', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                PNG
              </button>
              <button onClick={downloadSchematicPdf} style={{ 
                flex: 1, padding: '10px', borderRadius: '10px', background: 'var(--accent)', 
                color: '#fff', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                PDF
              </button>
              <button onClick={generateSchematic} style={{ 
                padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', 
                color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer'
              }} title="Recapture">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.5)' }}>
            Failed to capture schematic. Please try again.
          </div>
        )}
      </FloatingPanel>

      <FloatingPanel title="Component List" show={showComponentList} onClose={() => setShowComponentList(false)} width={450}>
        {components.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
            No components currently on canvas.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ 
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', 
              overflow: 'hidden', background: 'rgba(0,0,0,0.2)' 
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                    {['#', 'Component', 'Type', 'Qty'].map(h => (
                      <th key={h} style={{ 
                        padding: '10px 14px', textAlign: 'left', color: 'rgba(255,255,255,0.5)', 
                        fontWeight: '700', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' 
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {(() => {
                    const counts = {};
                    components.forEach(c => {
                      if (!counts[c.type]) counts[c.type] = { type: c.type, label: c.label, count: 0 };
                      counts[c.type].count++;
                    });
                    return Object.values(counts).map((row, i) => (
                      <tr key={row.type} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.4)' }}>{i + 1}</td>
                        <td style={{ padding: '10px 14px', fontWeight: '600', color: '#fff' }}>{row.label}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}>{row.type}</td>
                        <td style={{ padding: '10px 14px', fontWeight: '700' }}>{row.count}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
            <button onClick={downloadCompCsv} style={{ 
              padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', 
              color: '#fff', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
              fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'all 0.2s'
            }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
               onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              Download CSV Bill of Materials
            </button>
          </div>
        )}
      </FloatingPanel>
      <FloatingPanel title="Keyboard Shortcuts" show={showShortcuts} onClose={() => setShowShortcuts(false)} width={450}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { group: 'General', shortcuts: [
              { key: 'F5 / ⌘ Enter', desc: 'Run / Stop' },
              { key: 'Esc', desc: 'Cancel / Clear / Stop' },
              { key: '⌘ + S', desc: 'Save Project' },
              { key: '⌘ + O', desc: 'Toggle Projects' },
              { key: '⌘ + Alt + N', desc: 'New Project' },
              { key: 'Alt + H', desc: 'Toggle Shortcuts Help' },
            ]},
            { group: 'Edit', shortcuts: [
              { key: '⌘ + Z', desc: 'Undo' },
              { key: '⌘ + Y', desc: 'Redo' },
              { key: 'Del / Backspace', desc: 'Delete Selected' },
              { key: 'Alt + ⇧ + R', desc: 'Rotate Component' },
            ]},
            { group: 'View & Panels', shortcuts: [
              { key: 'Alt + (+ / -)', desc: 'Zoom In / Out' },
              { key: 'Alt + 0', desc: 'Reset Zoom' },
              { key: 'Alt + V', desc: 'Toggle Right Panel' },
              { key: '⌘ + B', desc: 'Toggle Console' },
              { key: 'Alt + C', desc: 'Open Code Panel' },
              { key: 'Alt + E', desc: 'Toggle Code Explorer' },
              { key: 'Alt + S', desc: 'Open Serial Panel' },
              { key: '⌘ + G', desc: 'Toggle Grid' },
              { key: '⌘ + L', desc: 'Toggle Canvas Lock' },
              { key: 'Alt + F', desc: 'Fit to View' },
              { key: 'Alt + T', desc: 'Wires Top / Bottom' },
              { key: '⌘ + ⇧ + Del', desc: 'Clear Canvas' },
            ]},
          ].map((g, i) => (
            <div key={i} style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', opacity: 0.8 }}>{g.group}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {g.shortcuts.map((s, j) => (
                  <div key={j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{s.desc}</span>
                    <kbd style={{ 
                      background: 'rgba(255,255,255,0.1)', 
                      padding: '2px 6px', 
                      borderRadius: '4px', 
                      fontSize: '11px', 
                      fontFamily: 'JetBrains Mono, monospace',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.1)',
                      boxShadow: '0 2px 0 rgba(0,0,0,0.2)'
                    }}>{s.key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </FloatingPanel>
    </header>
  );
}
export const TopToolbox = React.memo(TopToolboxInternal);
