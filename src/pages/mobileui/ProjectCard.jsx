import React from 'react';

export function ProjectCard({ proj, currentProjectId, renamingProjectId, renameValue, setRenameValue, handleConfirmRename, setRenamingProjectId, handleLoadProject, isRunning, setShowProjectsSidebar, onContextMenu, formatProjectDate }) {
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
            <div className="flex gap-1 transition-opacity">
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
