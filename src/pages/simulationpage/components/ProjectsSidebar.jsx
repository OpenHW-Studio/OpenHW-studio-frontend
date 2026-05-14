import React from 'react';

  function ProjectCard({ proj, currentProjectId, renamingProjectId, renameValue, setRenameValue, handleConfirmRename, setRenamingProjectId, handleLoadProject, isRunning, setShowProjectsSidebar, onContextMenu, formatProjectDate }) {
    const isCurrent = proj.id === currentProjectId;

    return (
      <div
        className={`group relative rounded-xl p-3.5 mb-3 cursor-pointer transition-all duration-200 border shadow-sm
        ${isCurrent
            ? 'bg-[rgba(var(--accent-rgb,100,180,255),0.08)] border-[var(--accent)]'
            : 'bg-[var(--card)] border-[var(--border)] hover:border-[var(--text3)] hover:shadow-md'
          }`}
        onClick={() => { if (renamingProjectId !== proj.id) handleLoadProject(proj); }}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(proj, e.clientX, e.clientY); }}
      >
        <div className="flex flex-col gap-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {renamingProjectId === proj.id ? (
                <input
                  autoFocus
                  className="bg-[var(--bg)] border border-[var(--accent)] text-[var(--text)] px-2.5 py-1.5 rounded-lg text-sm w-full outline-none ring-2 ring-[var(--accent)]/20"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleConfirmRename(proj.id); if (e.key === 'Escape') setRenamingProjectId(null); }}
                  onBlur={() => handleConfirmRename(proj.id)}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-[var(--text)] truncate block leading-tight">
                    {proj.name || 'Untitled Project'}
                  </span>
                  {isCurrent && (
                    <span className="flex h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)] shrink-0 animate-pulse" title="Currently open" />
                  )}
                </div>
              )}
            </div>
            {!renamingProjectId && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-1 group-hover:translate-x-0">
                <button
                  className="bg-[var(--accent)] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-sm hover:brightness-110 active:scale-95 transition-all"
                  onClick={(e) => { e.stopPropagation(); handleLoadProject(proj); setShowProjectsSidebar(false); }}
                  disabled={isRunning}
                >
                  Load
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text3)] font-medium">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 12L12 6L18 12" /><path d="M6 18L12 12L18 18" /></svg>
              {proj.board === 'arduino_uno' ? 'Arduino Uno' : (proj.board || 'Custom Board')}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text3)] font-medium">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
              {proj.components?.length ?? 0} components
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--text3)] opacity-70 ml-auto">
              {formatProjectDate(proj.savedAt)}
            </div>
          </div>
        </div>

        {renamingProjectId === proj.id && (
          <div className="flex gap-2 mt-3 justify-end">
            <button className="px-3 py-1.5 text-xs font-semibold text-[var(--text3)] hover:text-[var(--text)] transition-colors" onClick={(e) => { e.stopPropagation(); setRenamingProjectId(null); }}>Cancel</button>
            <button className="px-4 py-1.5 bg-[var(--accent)] text-white text-xs font-bold rounded-lg shadow-md" onClick={(e) => { e.stopPropagation(); handleConfirmRename(proj.id); }}>Rename</button>
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
  handleBackupWorkflow, backupRestoreInputRef, handleSyncToCloud,
  setShowCreateComponentModal
}) {
  return (
    <>
          {/* MY PROJECTS SIDEBAR */}
          <aside
            className="bg-[var(--bg2)] border-l border-[var(--border)] flex flex-col shrink-0 overflow-hidden transition-[width] duration-200"
            style={{ width: showProjectsSidebar ? 320 : 0, borderLeft: showProjectsSidebar ? '1px solid var(--border)' : 'none' }}
          >
            {showProjectsSidebar && (
              <>
                <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
                  <span className="text-sm font-bold text-[var(--text)] tracking-tight">My Projects</span>
                  <button
                    onClick={() => setShowProjectsSidebar(false)}
                    className="bg-[var(--card)] hover:bg-[var(--bg)] border border-[var(--border)] text-[var(--text3)] hover:text-[var(--text)] rounded-lg w-7 h-7 flex items-center justify-center transition-all active:scale-95"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>

                <div className="px-5 pb-4 shrink-0">
                  <div className="flex p-1 bg-[var(--bg)] rounded-xl border border-[var(--border)]">
                    {[
                      { id: 'favourites', label: 'Fav' },
                      { id: 'projects', label: 'Projects' },
                      { id: 'custom', label: 'Custom' },
                      { id: 'settings', label: 'Settings' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setProjectsSidebarTab(tab.id)}
                        className={`flex-1 py-1.5 px-1 rounded-lg text-[11px] font-bold transition-all duration-200
                        ${projectsSidebarTab === tab.id
                            ? 'bg-[var(--card)] text-[var(--accent)] shadow-sm'
                            : 'text-[var(--text3)] hover:text-[var(--text2)]'
                          }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                  {projectsSidebarTab === 'favourites' && (
                    <div>
                      <div className="text-[11px] text-[var(--text3)] px-1 py-1.5">Starred projects appear here.</div>
                      {myProjects.filter(p => favouriteProjectIds.includes(p.id)).length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                          <div className="w-16 h-16 rounded-2xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center mb-4 text-[var(--text3)]">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                          </div>
                          <div className="text-sm font-bold text-[var(--text)] mb-1">No Favourites Yet</div>
                          <div className="text-[11px] text-[var(--text3)] leading-normal max-w-[180px]">Star a project from the Projects tab to see it here.</div>
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
                    <div>
                      <div className="flex justify-between items-center mb-4 px-1">
                        <div className="text-[10px] font-extrabold text-[var(--text3)] uppercase tracking-wider">Your Library</div>
                        <button
                          onClick={() => { setShowProjectsSidebar(false); handleNewProject(); }}
                          className="flex items-center gap-1.5 bg-[var(--accent)] text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-lg shadow-[var(--accent)]/20 hover:brightness-110 active:scale-95 transition-all"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                          NEW
                        </button>
                      </div>
                      {myProjects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-[var(--border)] rounded-2xl bg-[var(--bg)]/30">
                          <div className="w-14 h-14 rounded-2xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center mb-4 text-[var(--text3)]">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
                          </div>
                          <div className="text-sm font-bold text-[var(--text)] mb-1">No saved projects</div>
                          <div className="text-[11px] text-[var(--text3)] leading-normal max-w-[180px]">Your circuits are auto-saved as you work.</div>
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
                    <div>
                      <div className="flex justify-between items-center mb-4 px-1">
                        <div className="text-[10px] font-extrabold text-[var(--text3)] uppercase tracking-wider">Custom Parts</div>
                        <button
                          onClick={() => setShowCreateComponentModal(true)}
                          className="flex items-center gap-1.5 bg-[var(--accent)] text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-lg shadow-[var(--accent)]/20 hover:brightness-110 active:scale-95 transition-all"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                          CREATE
                        </button>
                      </div>
                      <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-[var(--border)] rounded-xl">
                        <div className="text-sm font-bold text-[var(--text)] mb-1 opacity-50">Nothing here yet</div>
                        <div className="text-[11px] text-[var(--text3)] leading-normal">Custom components will appear here.</div>
                      </div>
                    </div>
                  )}

                  {projectsSidebarTab === 'settings' && (
                    <div className="flex flex-col gap-2 py-1">
                      <div className="text-[11px] font-bold text-[var(--text3)] uppercase tracking-wider px-1 py-1.5">Preferences</div>
                      <div className="flex items-center justify-between bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2.5 shadow-sm">
                        <div className="flex flex-col">
                          <span className="text-[12px] font-bold text-[var(--text)]">Auto-save Projects</span>
                          <span className="text-[9px] text-[var(--text3)]">Saves changes every 2.5s</span>
                        </div>
                        <button
                          onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
                          className={`w-9 h-5 rounded-full relative transition-all duration-300 ${autoSaveEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--bg3)]'}`}
                        >
                          <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-300 ${autoSaveEnabled ? 'translate-x-4' : ''}`} />
                        </button>
                      </div>

                      <div className="h-px bg-[var(--border)] my-1 opacity-50" />
                      <div className="text-[11px] font-bold text-[var(--text3)] uppercase tracking-wider px-1 py-1.5">Data Management</div>
                      <button className="w-full flex items-center gap-2.5 bg-[var(--card)] border border-[var(--border)] text-[var(--text)] rounded-lg px-3 py-2.5 text-[13px]" onClick={handleBackupWorkflow}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                        Backup
                        <span className="ml-auto text-[11px] text-[var(--text3)]">Download ZIP</span>
                      </button>
                      <button className="w-full flex items-center gap-2.5 bg-[var(--card)] border border-[var(--border)] text-[var(--text)] rounded-lg px-3 py-2.5 text-[13px]" onClick={() => backupRestoreInputRef.current?.click()}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                        Restore
                        <span className="ml-auto text-[11px] text-[var(--text3)]">From ZIP</span>
                      </button>
                      {isAuthenticated && (
                        <button className="w-full flex items-center gap-2.5 bg-[var(--card)] border border-[var(--border)] text-[var(--text)] rounded-lg px-3 py-2.5 text-[13px]" onClick={handleSyncToCloud}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><polyline points="23 20 23 14 17 14" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" /></svg>
                          Sync to Cloud
                          <span className="ml-auto text-[11px] text-[var(--text3)]">Upload</span>
                        </button>
                      )}
                      {isAuthenticated && (
                        <>
                          <div className="h-px bg-[var(--border)] my-1" />
                          <div className="text-[11px] font-bold text-[var(--text3)] uppercase tracking-wider px-1 py-1.5">Account</div>
                          <button className="w-full flex items-center gap-2.5 bg-[var(--card)] border border-[var(--red)] text-[var(--red)] rounded-lg px-3 py-2.5 text-[13px]" onClick={() => { logout(); setShowProjectsSidebar(false); }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                            Logout
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t border-[var(--border)] p-4 bg-[var(--bg2)] flex flex-col gap-3 shrink-0">
                  {!isAnyAuthenticated ? (
                    <button
                      onClick={() => { const lastEmail = localStorage.getItem('ohw_last_email'); navigate('/login', { state: { email: lastEmail, from: window.location.pathname } }); }}
                      className="w-full flex items-center justify-center gap-2 bg-[var(--accent)] text-white py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-[var(--accent)]/20 hover:brightness-110 active:scale-[0.98] transition-all"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
                      Sign In to Sync
                    </button>
                  ) : (
                    <div
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] group cursor-pointer hover:border-[var(--text3)] transition-all"
                      onClick={() => {
                        if (activeUser?.role === 'teacher') navigate('/teacher/dashboard')
                        else if (activeUser?.role === 'student') navigate('/student/dashboard')
                        else if (activeUser?.role === 'admin') navigate('/admin/dashboard')
                        else navigate('/user/dashboard')
                      }}
                      title="Go to dashboard"
                    >
                      <div className="w-8 h-8 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] text-xs font-bold uppercase">
                        {activeUser?.name?.[0] || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold text-[var(--text)] truncate">{activeUser?.name || 'User'}</div>
                        <div className="text-[9px] text-[var(--text3)] font-medium uppercase tracking-tight">{activeUser?.role || 'Developer'}</div>
                      </div>
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                    </div>
                  )}

                  <div className="flex p-1 bg-[var(--bg)] rounded-xl border border-[var(--border)] shadow-inner">
                    <button
                      className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all
                      ${!isAuthenticated
                          ? 'bg-[var(--card)] text-[var(--accent)] shadow-sm border border-[var(--border)]'
                          : 'text-[var(--text3)] hover:text-[var(--text2)]'}`}
                      onClick={() => { if (isAnyAuthenticated) { if (activeUser?.email) localStorage.setItem('ohw_last_email', activeUser.email); logout(); } }}
                    >
                      Local
                    </button>
                    <button
                      className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all
                      ${isAuthenticated
                          ? 'bg-[var(--accent)] text-white shadow-md'
                          : 'text-[var(--text3)] hover:text-[var(--text2)]'}`}
                      onClick={() => { if (!isAuthenticated) { const lastEmail = localStorage.getItem('ohw_last_email'); navigate('/login', { state: { email: lastEmail, from: window.location.pathname } }); } }}
                    >
                      Cloud
                    </button>
                  </div>
                </div>
              </>
            )}
          </aside>
    </>
  );
}
