import React from 'react';

  function ProjectCard({ proj, currentProjectId, renamingProjectId, renameValue, setRenameValue, handleConfirmRename, setRenamingProjectId, handleLoadProject, isRunning, setShowProjectsSidebar, onContextMenu, formatProjectDate }) {
    const isCurrent = proj.id === currentProjectId;

    return (
      <div
        className={`group relative rounded-xl cursor-pointer transition-all duration-300
        ${isCurrent
            ? 'bg-[var(--card)] border-[var(--accent)] shadow-[0_12px_40px_rgb(var(--accent-rgb,100,180,255),0.15)]'
            : 'bg-[var(--card)] border-[var(--border)] hover:border-[var(--accent)]/50 hover:shadow-2xl hover:-translate-y-1.5'
          }`}
        style={{ padding: '20px', marginBottom: '10px' }}
        onClick={() => { if (renamingProjectId !== proj.id) handleLoadProject(proj); }}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(proj, e.clientX, e.clientY); }}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {renamingProjectId === proj.id ? (
                <input
                  autoFocus
                  className="bg-[var(--bg)] border border-[var(--accent)] text-[var(--text)] px-3 py-2 rounded-xl text-sm w-full outline-none ring-4 ring-[var(--accent)]/10"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleConfirmRename(proj.id); if (e.key === 'Escape') setRenamingProjectId(null); }}
                  onBlur={() => handleConfirmRename(proj.id)}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[15px] text-[var(--text)] truncate block leading-tight tracking-tight">
                    {proj.name || 'Untitled Project'}
                  </span>
                  {isCurrent && (
                    <div className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent)] shadow-[0_0_10px_var(--accent)]"></span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2 text-[11px] text-[var(--text3)] font-semibold bg-[var(--bg)]/50 px-2 py-1 rounded-lg">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-70"><path d="M6 12L12 6L18 12" /><path d="M6 18L12 12L18 18" /></svg>
              {proj.board === 'arduino_uno' ? 'Arduino Uno' : (proj.board || 'Custom Board')}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[var(--text3)] font-semibold bg-[var(--bg)]/50 px-2 py-1 rounded-lg">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-70"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
              {proj.components?.length ?? 0}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--text3)] font-medium ml-auto opacity-60">
              {formatProjectDate(proj.savedAt)}
            </div>
          </div>
        </div>

        {renamingProjectId === proj.id && (
          <div className="flex gap-2 mt-4 justify-end">
            <button className="px-4 py-2 text-xs font-bold text-[var(--text3)] hover:text-[var(--text)] transition-colors" onClick={(e) => { e.stopPropagation(); setRenamingProjectId(null); }}>Cancel</button>
            <button className="px-5 py-2 bg-[var(--accent)] text-white text-xs font-extrabold rounded-xl shadow-lg shadow-[var(--accent)]/20 hover:brightness-110 active:scale-95 transition-all" onClick={(e) => { e.stopPropagation(); handleConfirmRename(proj.id); }}>Rename</button>
          </div>
        )}
      </div>
    );
  }

export function ProjectsSidebar({
  showProjectsSidebar, setShowProjectsSidebar,
  projectsSidebarTab, setProjectsSidebarTab,
  favouriteProjectIds, myProjects, currentProjectId,
  renamingProjectId, setRenamingProjectId,
  renameValue, setRenameValue,
  handleConfirmRename, setProjContextMenu,
  formatProjectDate, handleNewProject, handleLoadProject,
  isRunning, isAnyAuthenticated, isAuthenticated, activeUser,
  navigate, logout,
  autoSaveEnabled, setAutoSaveEnabled,
  handleBackupWorkflow, backupRestoreInputRef, wokwiImportInputRef, handleSyncToCloud,
  setShowCreateComponentModal
}) {
  return (
    <>
          {/* MY PROJECTS SIDEBAR */}
          <aside
            className="bg-[var(--bg2)] border-l border-[var(--border)] flex flex-col shrink-0 overflow-hidden"
            style={{ 
              width: 320, 
              position: 'fixed',
              top: 0,
              right: 0,
              height: '100vh',
              zIndex: 10000,
              transform: `translateX(${showProjectsSidebar ? '0' : '100%'})`,
              opacity: showProjectsSidebar ? 1 : 0,
              pointerEvents: showProjectsSidebar ? 'auto' : 'none',
              transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease-in-out',
              willChange: 'transform, opacity',
              boxShadow: showProjectsSidebar ? '-10px 0 30px rgba(0,0,0,0.1)' : 'none'
            }}
          >
                <div className="flex items-center justify-between shrink-0" style={{ padding: '15px 10px 10px' }}>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-lg font-black text-[var(--text)] tracking-tight leading-none">My Projects</span>
                    <span className="text-[10px] font-bold text-[var(--text3)] uppercase tracking-[0.1em] opacity-60">Circuit Library</span>
                  </div>
                  <button
                    onClick={() => setShowProjectsSidebar(false)}
                    className="bg-[var(--card)] hover:bg-[var(--bg)] border border-[var(--border)] text-[var(--text3)] hover:text-[var(--text)] rounded-xl w-10 h-10 flex items-center justify-center transition-all active:scale-90 shadow-sm"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>

                <div className="shrink-0" style={{ padding: '0 10px 10px' }}>
                  <div className="flex p-1.5 bg-[var(--bg)] rounded-2xl border border-[var(--border)] shadow-inner">
                    {[
                      { id: 'favourites', label: 'Fav', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg> },
                      { id: 'projects', label: 'Library', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg> },
                      { id: 'custom', label: 'Parts', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg> },
                      { id: 'settings', label: 'Gear', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg> },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setProjectsSidebarTab(tab.id)}
                        className={`flex-1 flex flex-col items-center justify-center px-1 rounded-xl transition-all duration-300
                        ${projectsSidebarTab === tab.id
                            ? 'bg-[var(--card)] text-[var(--accent)] shadow-md scale-[1.05]'
                            : 'text-[var(--text3)] hover:text-[var(--text2)] hover:bg-[var(--card)]/50'
                          }`}
                        style={{ padding: '16px 0' }}
                      >
                        <span className="mb-0.5">{tab.icon}</span>
                        <span className="text-[9px] font-black uppercase tracking-wider">{tab.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar" style={{ padding: '10px' }}>
                  {projectsSidebarTab === 'favourites' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pt-2">
                      <div className="text-[10px] font-bold text-[var(--text3)] uppercase tracking-widest px-1 mb-5 opacity-50">Starred Projects</div>
                      {myProjects.filter(p => favouriteProjectIds.includes(p.id)).length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                          <div className="w-20 h-20 rounded-[2.5rem] bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center mb-6 text-[var(--text3)] shadow-inner">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-40"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                          </div>
                          <div className="text-base font-black text-[var(--text)] mb-2">Empty Favorites</div>
                          <div className="text-xs text-[var(--text3)] leading-relaxed max-w-[200px] opacity-70">Star a project from the library to see it here.</div>
                        </div>
                      ) : myProjects.filter(p => favouriteProjectIds.includes(p.id)).map(proj => (
                        <ProjectCard
                          key={proj.id}
                          proj={proj}
                          currentProjectId={currentProjectId}
                          renamingProjectId={renamingProjectId}
                          renameValue={renameValue}
                          setRenameValue={setRenameValue}
                          handleConfirmRename={handleConfirmRename}
                          setRenamingProjectId={setRenamingProjectId}
                          handleLoadProject={handleLoadProject}
                          isRunning={isRunning}
                          setShowProjectsSidebar={setShowProjectsSidebar}
                          onContextMenu={(projData, x, y) => setProjContextMenu({ proj: projData, x, y })}
                          formatProjectDate={formatProjectDate}
                        />
                      ))}
                    </div>
                  )}

                  {projectsSidebarTab === 'projects' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pt-2">
                      <div className="flex flex-col mb-10" style={{ padding: '0 5px' }}>
                        <div className="text-[10px] font-black text-[var(--text3)] uppercase tracking-[0.15em] opacity-60 px-1" style={{ marginBottom: '10px' }}>All Saved Circuits</div>
                        <button
                          onClick={() => { setShowProjectsSidebar(false); handleNewProject(); }}
                          className="group flex items-center justify-center gap-3 bg-[var(--accent)] text-white w-full py-4 rounded-2xl text-[13px] font-black shadow-xl shadow-[var(--accent)]/30 hover:brightness-110 active:scale-95 transition-all"
                          style={{ marginBottom: '10px' }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-90 transition-transform duration-300"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                          CREATE NEW PROJECT
                        </button>
                      </div>
                      {myProjects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 px-6 text-center border-2 border-dashed border-[var(--border)] rounded-[2.5rem] bg-[var(--bg)]/20">
                          <div className="w-16 h-16 rounded-[2rem] bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center mb-6 text-[var(--text3)]">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-40"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
                          </div>
                          <div className="text-base font-black text-[var(--text)] mb-2">No Projects Found</div>
                          <div className="text-xs text-[var(--text3)] leading-relaxed max-w-[200px] opacity-70">Your circuits are automatically saved as you build.</div>
                        </div>
                      ) : myProjects.map(proj => (
                        <ProjectCard
                          key={proj.id}
                          proj={proj}
                          currentProjectId={currentProjectId}
                          renamingProjectId={renamingProjectId}
                          renameValue={renameValue}
                          setRenameValue={setRenameValue}
                          handleConfirmRename={handleConfirmRename}
                          setRenamingProjectId={setRenamingProjectId}
                          handleLoadProject={handleLoadProject}
                          isRunning={isRunning}
                          setShowProjectsSidebar={setShowProjectsSidebar}
                          onContextMenu={(projData, x, y) => setProjContextMenu({ proj: projData, x, y })}
                          formatProjectDate={formatProjectDate}
                        />
                      ))}
                    </div>
                  )}

                  {projectsSidebarTab === 'custom' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pt-2">
                      <div className="flex flex-col mb-10" style={{ padding: '0 5px' }}>
                        <div className="text-[10px] font-black text-[var(--text3)] uppercase tracking-[0.15em] opacity-60 px-1" style={{ marginBottom: '10px' }}>Custom Hardware</div>
                        <button
                          onClick={() => setShowCreateComponentModal(true)}
                          className="group flex items-center justify-center gap-3 bg-[var(--accent)] text-white w-full py-4 rounded-2xl text-[13px] font-black shadow-xl shadow-[var(--accent)]/30 hover:brightness-110 active:scale-95 transition-all"
                          style={{ marginBottom: '10px' }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-90 transition-transform duration-300"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                          CREATE NEW COMPONENT
                        </button>
                      </div>
                      <div className="flex flex-col items-center justify-center py-20 px-6 text-center border-2 border-dashed border-[var(--border)] rounded-[2.5rem] bg-[var(--bg)]/20">
                        <div className="text-base font-black text-[var(--text)] mb-2 opacity-40">Coming Soon</div>
                        <div className="text-xs text-[var(--text3)] leading-relaxed opacity-60">Design and save your own custom components.</div>
                      </div>
                    </div>
                  )}

                  {projectsSidebarTab === 'settings' && (
                    <div className="flex flex-col gap-5 py-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div style={{ marginBottom: '10px' }}>
                        <div className="text-[10px] font-black text-[var(--text3)] uppercase tracking-[0.15em] px-1 opacity-60" style={{ marginBottom: '10px' }}>Preferences</div>
                        <div 
                          className="flex items-center justify-between bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-sm hover:shadow-2xl hover:border-[var(--accent)]/50 hover:-translate-y-1.5 transition-all duration-300"
                          style={{ padding: '15px 20px' }}
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[13px] font-bold text-[var(--text)]">Auto-save</span>
                            <span className="text-[10px] text-[var(--text3)] font-medium opacity-70">Interval: 2.5s</span>
                          </div>
                          <button
                            onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
                            className={`w-11 h-6 rounded-full relative transition-all duration-300 shadow-inner ${autoSaveEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--bg3)]'}`}
                          >
                            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-lg transition-transform duration-300 ${autoSaveEnabled ? 'translate-x-5' : ''}`} />
                          </button>
                        </div>
                      </div>

                      <div className="h-px bg-gradient-to-r from-transparent via-[var(--border)] to-transparent my-1 opacity-50" />
                      
                      <div style={{ marginBottom: '10px' }}>
                        <div className="text-[10px] font-black text-[var(--text3)] uppercase tracking-[0.15em] px-1 opacity-60" style={{ marginBottom: '10px' }}>Data Engine</div>
                        <div className="flex flex-col gap-2.5">
                          <button 
                            className="w-full flex items-center gap-3 bg-[var(--card)] border border-[var(--border)] text-[var(--text)] rounded-xl font-bold shadow-sm hover:shadow-2xl hover:border-[var(--accent)]/50 hover:-translate-y-1.5 transition-all duration-300 active:scale-[0.98]" 
                            style={{ padding: '15px 20px' }}
                            onClick={handleBackupWorkflow}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)]"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                            Export Project
                            <span className="ml-auto text-[10px] font-bold bg-[var(--bg)] px-2 py-0.5 rounded-full text-[var(--text3)]">ZIP</span>
                          </button>
                          <button 
                            className="w-full flex items-center gap-3 bg-[var(--card)] border border-[var(--border)] text-[var(--text)] rounded-xl font-bold shadow-sm hover:shadow-2xl hover:border-[var(--accent)]/50 hover:-translate-y-1.5 transition-all duration-300 active:scale-[0.98]" 
                            style={{ padding: '15px 20px' }}
                            onClick={() => backupRestoreInputRef.current?.click()}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)]"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                            Restore Workspace
                            <span className="ml-auto text-[10px] font-bold bg-[var(--bg)] px-2 py-0.5 rounded-full text-[var(--text3)]">ZIP</span>
                          </button>
                          <button 
                            className="w-full flex items-center gap-3 bg-[var(--card)] border border-[var(--border)] text-[var(--text)] rounded-xl font-bold shadow-sm hover:shadow-2xl hover:border-[var(--accent)]/50 hover:-translate-y-1.5 transition-all duration-300 active:scale-[0.98]" 
                            style={{ padding: '15px 20px' }}
                            onClick={() => wokwiImportInputRef?.current?.click()}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)]"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                            Import Wokwi Project
                            <span className="ml-auto text-[10px] font-bold bg-[var(--bg)] px-2 py-0.5 rounded-full text-[var(--text3)]">ZIP</span>
                          </button>
                          {isAuthenticated && (
                            <button 
                              className="w-full flex items-center gap-3 bg-[var(--card)] border border-[var(--border)] text-[var(--text)] rounded-xl font-bold shadow-sm hover:shadow-2xl hover:border-[var(--accent)]/50 hover:-translate-y-1.5 transition-all duration-300 active:scale-[0.98]" 
                              style={{ padding: '15px 20px' }}
                              onClick={handleSyncToCloud}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)]"><polyline points="1 4 1 10 7 10" /><polyline points="23 20 23 14 17 14" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" /></svg>
                              Cloud Synchronization
                              <span className="ml-auto text-[10px] font-bold bg-[var(--accent)]/10 text-[var(--accent)] px-2 py-0.5 rounded-full">ACTIVE</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {isAuthenticated && (
                        <>
                          <div className="h-px bg-gradient-to-r from-transparent via-[var(--border)] to-transparent my-1 opacity-50" />
                          <div>
                            <div className="text-[10px] font-black text-[var(--text3)] uppercase tracking-[0.15em] px-1 opacity-60" style={{ marginBottom: '10px' }}>Account Control</div>
                            <button 
                              className="w-full flex items-center gap-3 bg-[var(--card)] border border-red-500/20 text-red-500 rounded-xl px-5 py-4 text-sm font-bold shadow-sm hover:bg-red-500 hover:text-white transition-all active:scale-[0.98]" 
                              style={{ padding: '15px 20px' }}
                              onClick={() => { logout(); setShowProjectsSidebar(false); }}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                              Sign Out
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t border-[var(--border)] bg-[var(--bg2)] flex flex-col shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.04)]" style={{ padding: '20px 10px 10px' }}>
                  {!isAnyAuthenticated ? (
                    <button
                      onClick={() => { const lastEmail = localStorage.getItem('ohw_last_email'); navigate('/login', { state: { email: lastEmail, from: window.location.pathname } }); }}
                      className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-[var(--accent)] to-[var(--accent)]/80 text-white rounded-xl text-[14px] font-black shadow-2xl shadow-[var(--accent)]/30 hover:brightness-110 active:scale-[0.97] transition-all"
                      style={{ padding: '9.5px 0' }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
                      Sign In to Cloud
                    </button>
                  ) : (
                    <div
                      className="flex items-center gap-4 p-4 rounded-[1.25rem] bg-[var(--card)] border border-[var(--border)] group cursor-pointer hover:border-[var(--accent)]/50 hover:shadow-xl transition-all"
                      onClick={() => {
                        if (activeUser?.role === 'teacher') navigate('/teacher/dashboard')
                        else if (activeUser?.role === 'student') navigate('/student/dashboard')
                        else if (activeUser?.role === 'admin') navigate('/admin/dashboard')
                        else navigate('/user/dashboard')
                      }}
                      title="Go to dashboard"
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent)]/40 border border-white/20 flex items-center justify-center text-white text-base font-black shadow-lg">
                        {activeUser?.name?.[0] || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-black text-[var(--text)] truncate tracking-tight">{activeUser?.name || 'User'}</div>
                        <div className="text-[11px] text-[var(--text3)] font-bold uppercase tracking-wider opacity-60">{activeUser?.role || 'Developer'}</div>
                      </div>
                      <div className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]"></span>
                      </div>
                    </div>
                  )}

                  <div className="flex p-1.5 bg-[var(--bg)] rounded-2xl border border-[var(--border)] shadow-inner" style={{ marginTop: '10px' }}>
                    <button
                      className={`flex-1 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all
                      ${!isAuthenticated
                          ? 'bg-[var(--card)] text-[var(--accent)] shadow-md'
                          : 'text-[var(--text3)] hover:text-[var(--text2)]'}`}
                      onClick={() => { if (isAnyAuthenticated) { if (activeUser?.email) localStorage.setItem('ohw_last_email', activeUser.email); logout(); } }}
                      style={{ padding: '9.5px 0' }}
                    >
                      Local
                    </button>
                    <button
                      className={`flex-1 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all
                      ${isAuthenticated
                          ? 'bg-[var(--accent)] text-white shadow-xl'
                          : 'text-[var(--text3)] hover:text-[var(--text2)]'}`}
                      onClick={() => { if (!isAuthenticated) { const lastEmail = localStorage.getItem('ohw_last_email'); navigate('/login', { state: { email: lastEmail, from: window.location.pathname } }); } }}
                      style={{ padding: '9.5px 0' }}
                    >
                      Cloud
                    </button>
                  </div>
                </div>
          </aside>
    </>
  );
}

function ProjectContextMenu({
  projContextMenu,
  theme,
  favouriteProjectIds,
  toggleFavourite,
  handleCopyProject,
  handleStartRename,
  handleDeleteProject,
  setProjContextMenu,
  setProjectsSidebarTab,
}) {
  if (!projContextMenu) return null;

  return (
    <div
      className="canvas-menu"
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      onMouseLeave={() => setProjContextMenu(null)}
      style={{
        position: 'fixed',
        left: projContextMenu.x,
        top: Math.min(projContextMenu.y, window.innerHeight - 240),
        zIndex: 10000,
        background: 'var(--card)',
        backdropFilter: 'blur(16px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: theme === 'light' ? '0 10px 40px rgba(0, 0, 0, 0.1)' : '0 10px 40px rgba(0,0,0,0.5)',
        minWidth: 200,
        padding: '5px',
        animation: 'canvasMenuIn 0.12s cubic-bezier(0.16, 1, 0.3, 1)',
        transformOrigin: 'top left',
        fontFamily: "'Space Grotesk', sans-serif",
        willChange: 'transform, opacity, backdrop-filter',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
      }}
    >
      <div className="px-4 py-2.5 text-[10px] font-extrabold text-[var(--text3)] uppercase tracking-wider border-b border-[var(--border)] bg-[var(--bg)]/40 flex items-center justify-between">
        <span className="truncate mr-2">{projContextMenu.proj.name || 'Untitled Project'}</span>
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]/30" />
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]/50" />
        </div>
      </div>

      <div className="p-1 flex flex-col gap-0.5">
        <button className="canvas-menu-item" onClick={() => { toggleFavourite(projContextMenu.proj.id); setProjContextMenu(null); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill={favouriteProjectIds.includes(projContextMenu.proj.id) ? 'var(--orange, #f59e0b)' : 'none'} stroke={favouriteProjectIds.includes(projContextMenu.proj.id) ? 'var(--orange, #f59e0b)' : 'currentColor'} strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
          {favouriteProjectIds.includes(projContextMenu.proj.id) ? 'Unfavourite' : 'Favourite'}
        </button>
        <button className="canvas-menu-item" onClick={() => { handleCopyProject(projContextMenu.proj); setProjContextMenu(null); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
          Make a Copy
        </button>
        <button className="canvas-menu-item" onClick={() => { handleStartRename(projContextMenu.proj, { stopPropagation: () => { } }); setProjContextMenu(null); setProjectsSidebarTab('projects'); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          Rename Project
        </button>
        <div className="h-px bg-[var(--border)] my-1 mx-2 opacity-50" />
        <button className="canvas-menu-item canvas-menu-item--danger" onClick={() => { handleDeleteProject(projContextMenu.proj.id); setProjContextMenu(null); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
          Delete Project
        </button>
      </div>
    </div>
  );
}

function ProjectsSidebarChromeBase(props) {
  const {
    projContextMenu,
    theme,
    favouriteProjectIds,
    toggleFavourite,
    handleCopyProject,
    handleStartRename,
    handleDeleteProject,
    setProjContextMenu,
    setProjectsSidebarTab,
  } = props;

  return (
    <>
      <ProjectsSidebar {...props} />
      <ProjectContextMenu
        projContextMenu={projContextMenu}
        theme={theme}
        favouriteProjectIds={favouriteProjectIds}
        toggleFavourite={toggleFavourite}
        handleCopyProject={handleCopyProject}
        handleStartRename={handleStartRename}
        handleDeleteProject={handleDeleteProject}
        setProjContextMenu={setProjContextMenu}
        setProjectsSidebarTab={setProjectsSidebarTab}
      />
    </>
  );
}

export const ProjectsSidebarChrome = React.memo(ProjectsSidebarChromeBase);
