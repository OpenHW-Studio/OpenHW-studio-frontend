import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Btn } from './Btn';
import AutofixPreviewPanel from '../../components/AutofixPreviewPanel.jsx';

function TopToolboxInternal(props) {
  const { 
    handleRun, handleStop, isRunning, handleSave, downloadPng, downloadSimulationJson, 
    handleNewProject, setShowProjectsSidebar, setProjectsSidebarTab, theme, 
    isAuthenticated, user, myProjects, currentProjectId, refreshProjectList,
    schematicDataUrl, schematicLoading, generateSchematic, downloadSchematicPng, downloadSchematicPdf,
    downloadCompCsv, components, importFileRef, handleBackupWorkflow,
    shareUrl, isSharingSimulation, handleShareSimulation, toggleTheme,
    validationErrors = [], runAutoFixAll, onApplyPlan, wires = [],
    autoWiringEnabled, setAutoWiringEnabled, autoCodingEnabled, setAutoCodingEnabled
  } = props;
  const navigate = useNavigate();


  const [activeMenu, setActiveMenu] = useState(null);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [showSchematic, setShowSchematic] = useState(false);
  const [showComponentList, setShowComponentList] = useState(false);
  const [showAutofix, setShowAutofix] = useState(false);
  
  const menuRef = useRef(null);
  const sharePanelRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (activeMenu && menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenu(null);
      }
      if (showSharePanel && sharePanelRef.current && !sharePanelRef.current.contains(event.target)) {
        setShowSharePanel(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [activeMenu, showSharePanel]);

  // When opening share panel, if no URL exists, generate one
  useEffect(() => {
    if (showSharePanel && !shareUrl && !isSharingSimulation) {
      handleShareSimulation();
    }
  }, [showSharePanel, shareUrl, isSharingSimulation, handleShareSimulation]);



  const fileMenuItems = [
    { label: 'New Project', onClick: handleNewProject },
    { label: 'Open Project', onClick: () => { setShowProjectsSidebar(true); setProjectsSidebarTab('projects'); } },
    { label: 'Import PNG/JSON', onClick: () => importFileRef.current?.click() },
    { label: 'Save Local Copy (ZIP)', onClick: handleBackupWorkflow },
  ];

  const toolMenuItems = [
    { label: 'Schematic View', onClick: () => { setShowSchematic(true); generateSchematic(); } },
    { label: 'Component List', onClick: () => setShowComponentList(true) },
  ];

  const assistMenuItems = [
    { 
      label: `Auto-Wiring: ${autoWiringEnabled ? 'ON' : 'OFF'}`, 
      onClick: () => setAutoWiringEnabled?.(!autoWiringEnabled),
      icon: autoWiringEnabled ? '✅' : '❌'
    },
    { 
      label: `Auto-Coding: ${autoCodingEnabled ? 'ON' : 'OFF'}`, 
      onClick: () => setAutoCodingEnabled?.(!autoCodingEnabled),
      icon: autoCodingEnabled ? '✅' : '❌'
    }
  ];

  const helpMenuItems = [
    { label: 'Documentation', onClick: () => window.open('https://docs.openhw.org', '_blank') },
    { label: 'About OpenHW Studio', onClick: () => { } }
  ];

  const mobileMenuItems = [
    { label: 'FILE', type: 'header' },
    ...fileMenuItems,
    { type: 'separator' },
    { label: 'TOOLS', type: 'header' },
    ...toolMenuItems,
    { type: 'separator' },
    { label: 'ASSIST', type: 'header' },
    ...assistMenuItems,
    { type: 'separator' },
    { label: 'HELP', type: 'header' },
    ...helpMenuItems,
  ];

  const FloatingPanel = ({ title, show, onClose, children, width = 450 }) => {
    if (!show) return null;
    return (
      <div style={{
        position: 'fixed', top: '70px', left: '50%', transform: 'translateX(-50%)',
        width: 'min(92vw, 480px)', maxHeight: 'calc(100vh - 160px)',
        background: 'var(--bg2)', backdropFilter: 'blur(24px)',
        border: '1px solid var(--border)', borderRadius: '20px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.6)', zIndex: 7000,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'panel-appear 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyBetween: 'center',
          background: 'rgba(255,255,255,0.02)'
        }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text)', letterSpacing: '0.01em' }}>{title}</h3>
          <button onClick={onClose} style={{
            marginLeft: 'auto', background: 'var(--bg3)', border: 'none', color: 'var(--text3)',
            cursor: 'pointer', padding: '6px', borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div style={{ padding: '20px', overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    );
  };

  return (
    <header className="flex items-center justify-between px-4 h-14 bg-[var(--bg2)] border-b border-[var(--border)] shrink-0 z-[1000]">
      <div className="flex items-center gap-3">
        <img
          src="/logo-Photoroom.png"
          alt="OpenHW Studio Logo"
          title="Go to Landing Page"
          draggable="false"
          style={{ height: '32px', width: 'auto', flexShrink: 0, cursor: 'pointer' }}
          onClick={() => navigate('/')}
        />

        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px' }} />
        
        <button 
          onClick={handleSave}
          className="p-2 rounded-xl hover:bg-[var(--bg3)] text-[var(--text2)] transition-colors"
          title="Save Project"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        </button>

        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setActiveMenu(activeMenu === 'mobile' ? null : 'mobile')}
            className={`p-2 rounded-xl transition-colors ${activeMenu === 'mobile' ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/30' : 'hover:bg-[var(--bg3)] text-[var(--text2)]'}`}
            title="Menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>

          {activeMenu === 'mobile' && (
            <div className="absolute top-[calc(100%+8px)] left-0 w-64 bg-[var(--bg2)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden py-1.5 animate-in fade-in zoom-in duration-200 origin-top-left z-[5000]">
              {mobileMenuItems.map((item, idx) => (
                item.type === 'header' ? (
                  <div key={idx} className="px-4 py-2 text-[10px] font-black text-[var(--text3)] uppercase tracking-widest opacity-50">{item.label}</div>
                ) : item.type === 'separator' ? (
                  <div key={idx} className="h-px bg-[var(--border)] my-1.5 mx-2" />
                ) : (
                  <button
                    key={idx}
                    className="w-full px-4 py-3 text-left text-[13px] font-bold text-[var(--text)] hover:bg-[var(--accent)] hover:text-white transition-colors flex items-center justify-between"
                    onClick={() => { item.onClick?.(); setActiveMenu(null); }}
                  >
                    <span>{item.label}</span>
                    {item.icon && <span>{item.icon}</span>}
                  </button>
                )
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* AUTOFIX BUTTON */}
        <Btn
          onClick={() => setShowAutofix(v => !v)}
          color={validationErrors?.length > 0 ? 'var(--orange)' : undefined}
          disabled={!validationErrors?.length}
          title={validationErrors?.length ? `Auto-fix available: ${validationErrors.length} issue(s)` : 'No issues to fix'}
          iconOnly
        >
          <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M29.5,24.5L16.563,11.563C16.84,10.758,17,9.899,17,9c0-4.411-3.589-8-8-8 C8.338,1,7.659,1.089,6.982,1.266c-0.347,0.09-0.619,0.359-0.713,0.706C6.175,2.317,6.273,2.687,6.527,2.941l2.645,2.645 C9.549,5.964,9.757,6.466,9.757,7c0,0.534-0.208,1.036-0.586,1.414L8.414,9.172C8.036,9.549,7.534,9.757,7,9.757 S5.964,9.549,5.586,9.172L2.941,6.526c-0.19-0.19-0.445-0.293-0.707-0.293c-0.087,0-0.175,0.011-0.262,0.035 C1.625,6.363,1.356,6.635,1.266,6.982C1.089,7.659,1,8.338,1,9c0,4.411,3.589,8,8,8c0.899,0,1.758-0.16,2.563-0.437L24.5,29.5 c0.69,0.69,1.595,1.036,2.5,1.036s1.81-0.345,2.5-1.036C30.881,28.119,30.881,25.881,29.5,24.5z M27,28c-0.552,0-1-0.448-1-1 c0-0.552,0.448-1,1-1s1,0.448,1,1C28,27.552,27.552,28,27,28z" />
          </svg>
        </Btn>

        <Btn onClick={toggleTheme} title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'} iconOnly>
          <div className="transition-transform duration-500" style={{ transform: theme === 'dark' ? 'rotate(0deg)' : 'rotate(180deg)' }}>
            {theme === 'dark' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
            )}
          </div>
        </Btn>

        <div className="relative" ref={sharePanelRef}>
          <button 
            onClick={() => setShowSharePanel(!showSharePanel)}
            className={`p-2 rounded-xl transition-colors ${showSharePanel ? 'bg-[var(--accent)] text-white shadow-lg' : 'hover:bg-[var(--bg3)] text-[var(--text2)]'}`}
            title="Share"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          </button>

          {showSharePanel && (
            <div className="absolute top-[calc(100%+8px)] right-0 w-[min(90vw,340px)] bg-[var(--bg2)] border border-[var(--border)] rounded-2xl shadow-2xl p-5 animate-in fade-in zoom-in duration-200 origin-top-right z-[5000]">
              <div className="text-sm font-extrabold mb-4 text-[var(--text)] flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.59 13.51l6.83 3.98" /><path d="M15.41 6.51l-6.82 3.98" /></svg>
                Share Project
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <div className="text-[10px] font-bold text-[var(--text3)] uppercase">Simulation Link</div>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-xs text-[var(--text2)] overflow-hidden">
                      {isSharingSimulation ? (
                        <div className="animate-pulse">Generating link...</div>
                      ) : (
                        <div className="truncate">{shareUrl || 'Click Share to generate'}</div>
                      )}
                    </div>
                    <button 
                      disabled={!shareUrl || isSharingSimulation}
                      onClick={() => { navigator.clipboard.writeText(shareUrl); alert('Link Copied!'); }}
                      className="px-3 py-2 bg-[var(--accent)] text-white text-xs font-bold rounded-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div className="h-px bg-[var(--border)] my-1" />
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={downloadPng}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[var(--bg3)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--text)] text-[11px] font-bold rounded-xl transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                    PNG
                  </button>
                  <button 
                    onClick={downloadSimulationJson}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[var(--bg3)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--text)] text-[11px] font-bold rounded-xl transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                    JSON
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <Btn
          onClick={() => {
            refreshProjectList();
            setProjectsSidebarTab('projects');
            setShowProjectsSidebar(v => !v);
          }}
          title="My Projects"
        >
          {isAuthenticated ? (user?.name?.split(' ')[0] || 'User') : 'Local'}
        </Btn>
      </div>

      <FloatingPanel title="Auto-fix" show={showAutofix} onClose={() => setShowAutofix(false)}>
        <div className="p-3">
          <AutofixPreviewPanel 
            project={{ components, connections: wires }} 
            validationErrors={validationErrors || []} 
            runAutoFixAll={runAutoFixAll} 
            onApplyPlan={onApplyPlan}
          />
        </div>
      </FloatingPanel>

      <FloatingPanel title="Schematic View" show={showSchematic} onClose={() => setShowSchematic(false)}>
        {schematicLoading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-4 text-[var(--text3)]">
            <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 12a9 9 0 1 1-6.21-8.58"/></svg>
            <div className="text-sm font-bold">Generating Schematic...</div>
          </div>
        ) : schematicDataUrl ? (
          <div className="flex flex-col gap-5">
            <div className="bg-black rounded-2xl overflow-hidden border border-[var(--border)] shadow-inner">
              <img src={schematicDataUrl} alt="Schematic" className="w-full block" />
            </div>
            <div className="flex gap-3">
              <button onClick={downloadSchematicPng} className="flex-1 py-3 bg-[var(--bg3)] border border-[var(--border)] text-[var(--text)] rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                PNG
              </button>
              <button onClick={downloadSchematicPdf} className="flex-1 py-3 bg-[var(--accent)] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                PDF
              </button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-[var(--text3)] text-sm">Failed to load schematic.</div>
        )}
      </FloatingPanel>

      <FloatingPanel title="Component List" show={showComponentList} onClose={() => setShowComponentList(false)}>
        {!components || components.length === 0 ? (
          <div className="py-12 text-center text-[var(--text3)] text-sm italic">No components on canvas.</div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="border border-[var(--border)] rounded-2xl overflow-hidden bg-[var(--bg)]/40">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[var(--bg3)] text-[var(--text3)] font-black uppercase tracking-widest text-[9px]">
                  <tr>
                    <th className="p-3 pl-4">Part</th>
                    <th className="p-3">Qty</th>
                  </tr>
                </thead>
                <tbody className="text-[var(--text2)]">
                  {(() => {
                    const counts = {};
                    components.forEach(c => { counts[c.label] = (counts[c.label] || 0) + 1; });
                    return Object.entries(counts).map(([label, count]) => (
                      <tr key={label} className="border-t border-[var(--border)]">
                        <td className="p-3 pl-4 font-bold text-[var(--text)]">{label}</td>
                        <td className="p-3 font-mono">{count}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
            <button onClick={downloadCompCsv} className="w-full py-3.5 bg-[var(--bg3)] border border-[var(--border)] text-[var(--text)] rounded-xl text-xs font-bold flex items-center justify-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              Download BOM (.csv)
            </button>
          </div>
        )}
      </FloatingPanel>
    </header>
  );
}


export const TopToolbox = React.memo(TopToolboxInternal);
