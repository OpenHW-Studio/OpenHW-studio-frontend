import React, { useState, useRef, useEffect, memo } from 'react';

const PalettePanel = memo(({
  theme,
  liveEditingDisabled,
  addComponentAtCenter,
  onPaletteDragStart,
  handleUploadZip,
  openComponentEditor,
  showLockToast,
  isPaletteItemLocked,
  CATALOG,
  GROUP_COLORS,
  GROUP_ICON_SVG,
  COMPONENT_REGISTRY,
  COMPONENT_DESCRIPTIONS,
  WOKWI_TO_COMP_ID,
  componentZipInputRef,
  buildLogicSourceFromRegistry,
  buildUiSourceFromRegistry,
  buildValidationSourceFromRegistry,
  buildIndexSourceFromRegistry,
  writeEditCopyPayload
}) => {
  const [isPaletteHovered, setIsPaletteHovered] = useState(false);
  const [paletteContextMenu, setPaletteContextMenu] = useState(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState('');
  const [activeGroupFilter, setActiveGroupFilter] = useState('All');
  const [paletteViewMode, setPaletteViewMode] = useState('grid');
  const [showFavorites, setShowFavorites] = useState(true);
  const [favoriteComponents, setFavoriteComponents] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('openhw_fav_components') || '[]')); }
    catch (e) { return new Set(); }
  });

  const toggleFavorite = React.useCallback((type) => {
    setFavoriteComponents(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      try { localStorage.setItem('openhw_fav_components', JSON.stringify([...next])); } catch (e) { }
      return next;
    });
  }, []);


  useEffect(() => {
    if (!paletteContextMenu) return;
    const close = () => { setPaletteContextMenu(null); setIsPaletteHovered(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [paletteContextMenu]);

  // ── Close Filter dropdown on outside click ──────────────────────────────────
  useEffect(() => {
    if (!showFilterDropdown) return;
    const close = (e) => { if (!e.target.closest('.filter-dropdown-container')) setShowFilterDropdown(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showFilterDropdown]);

  const favoriteItemsGrid = React.useMemo(() => {
    if (favoriteComponents.size === 0) {
      return <div style={{ padding: '6px 2px', fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>Right-click a component to favourite</div>;
    }
    const favItems = [];
    CATALOG.forEach(g => g.items.forEach(item => { if (favoriteComponents.has(item.type)) favItems.push({ ...item, group: g.group }); }));
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, padding: '2px 0' }}>
        {favItems.map(item => {
          const gColor = GROUP_COLORS[item.group] || 'var(--accent)';
          return (
            <div
              key={`fav-${item.type}`}
              draggable
              onDragStart={e => onPaletteDragStart(e, item)}
              onClick={() => { addComponentAtCenter(item); }}
              onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setPaletteContextMenu({ x: e.clientX, y: e.clientY, item }); }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '6px 4px', borderRadius: 7, border: `1px solid ${gColor}44`, background: 'var(--bg)', cursor: 'pointer', userSelect: 'none', transition: 'all .15s', minHeight: 38, boxSizing: 'border-box' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = gColor; e.currentTarget.style.background = `${gColor}14`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = `${gColor}44`; e.currentTarget.style.background = 'var(--bg)'; }}
            >
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)', textAlign: 'center', lineHeight: 1.2, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 2, paddingRight: 2 }}>{item.label}</span>
            </div>
          );
        })}
      </div>
    );
  }, [favoriteComponents, CATALOG, GROUP_COLORS, onPaletteDragStart, addComponentAtCenter]);

  const catalogItemsGrid = React.useMemo(() => {
    return CATALOG.map((group, index) => {
      const isGroupMatch = activeGroupFilter === 'All' || group.group === activeGroupFilter;
      if (!isGroupMatch) return null;

      const filteredItems = group.items.filter(item => {
        const label = (item.label || item.name || '').toLowerCase();
        const type = (item.type || '').toLowerCase();
        const search = (paletteSearch || '').toLowerCase();
        return label.includes(search) || type.includes(search);
      });
      if (filteredItems.length === 0) return null;
      const groupColor = GROUP_COLORS[group.group] || 'var(--accent)';
      return (
        <div key={group.group || `group-${index}`} style={{ marginBottom: paletteViewMode === 'grid' ? 10 : 4 }}>
          <div className="text-[10px] font-bold text-[var(--text3)] uppercase tracking-widest px-2 py-1 flex items-center gap-1" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {GROUP_ICON_SVG[group.group]?.(groupColor) || <span style={{ width: 6, height: 6, borderRadius: '50%', background: groupColor, display: 'inline-block' }} />}
            </span>
            {group.group}
          </div>

          {paletteViewMode === 'grid' ? (
            /* GRID VIEW */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, padding: '4px 0' }}>
              {filteredItems.map(item => {
                const compW = item.w || 60;
                const compH = item.h || 60;
                /* 84×66 target visible area with breathing room */
                const previewW = 84, previewH = 66;
                const rawScale = Math.min(previewW / compW, previewH / compH);
                const scale = Math.max(0.22, Math.min(1.6, rawScale));
                const hasUI = !!COMPONENT_REGISTRY[item.type]?.UI;
                const locked = isPaletteItemLocked(item.type);
                return (
                  <div
                    key={item.type}
                    draggable={!locked}
                    onDragStart={e => !locked && onPaletteDragStart(e, item)}
                    onClick={() => {
                      if (locked) { showLockToast(item.label, WOKWI_TO_COMP_ID[item.type]); return; }
                      addComponentAtCenter(item);
                    }}
                    onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setPaletteContextMenu({ x: e.clientX, y: e.clientY, item: { ...item, group: group.group } }); }}
                    title={item.label}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: '0 4px 7px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', cursor: locked ? 'not-allowed' : 'pointer', userSelect: 'none', transition: 'all .15s', height: 104, boxSizing: 'border-box', minWidth: 0, overflow: 'hidden', position: 'relative', opacity: locked ? 0.4 : 1, filter: locked ? 'grayscale(1)' : 'none' }}
                    onMouseEnter={e => { if (!locked) { e.currentTarget.style.borderColor = groupColor; e.currentTarget.style.background = `${groupColor}14`; } }}
                    onMouseLeave={e => { if (!locked) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--card)'; } }}
                  >
                    {/* Overlay for locked state */}
                    {locked && (
                      <div style={{ position: 'absolute', top: 5, right: 6, zIndex: 10, fontSize: 13, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 6, padding: '2px 4px', color: '#ef4444' }}>
                        🔒
                      </div>
                    )}
                    {/* Component SVG — absolutely centred in upper area, no inner box */}
                    {hasUI ? (
                      <div style={{ position: 'absolute', top: 'calc(50% - 7px)', left: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center center', pointerEvents: 'none', lineHeight: 0, width: compW, height: compH }}>
                        {React.createElement(COMPONENT_REGISTRY[item.type].UI, { state: {}, attrs: {}, isRunning: false })}
                      </div>
                    ) : (
                      <div style={{ position: 'absolute', top: 'calc(50% - 7px)', left: '50%', transform: 'translate(-50%, -50%)' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={groupColor} strokeWidth="1.2" opacity="0.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
                      </div>
                    )}
                    {/* Label — pinned to bottom, single line */}
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)', textAlign: 'center', lineHeight: 1.2, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 2, paddingRight: 2, position: 'relative', zIndex: 1 }}>{item.label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            /* LIST VIEW */
            filteredItems.map(item => {
              const locked = isPaletteItemLocked(item.type);
              return (
                <div
                  key={item.type}
                  draggable={!locked}
                  onDragStart={e => !locked && onPaletteDragStart(e, item)}
                  onClick={() => {
                    if (locked) { showLockToast(item.label, WOKWI_TO_COMP_ID[item.type]); return; }
                    addComponentAtCenter(item);
                  }}
                  onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setPaletteContextMenu({ x: e.clientX, y: e.clientY, item: { ...item, group: group.group } }); }}
                  style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', cursor: locked ? 'not-allowed' : 'pointer', userSelect: 'none', marginBottom: 4, borderLeft: `3px solid ${groupColor}`, transition: 'all .15s', opacity: locked ? 0.4 : 1, filter: locked ? 'grayscale(1)' : 'none', position: 'relative' }}
                  onMouseEnter={e => { if (!locked) e.currentTarget.style.background = 'var(--bg3)'; }}
                  onMouseLeave={e => { if (!locked) e.currentTarget.style.background = 'var(--card)'; }}
                >
                  {locked && (
                    <div style={{ position: 'absolute', top: '50%', right: 10, transform: 'translateY(-50%)', fontSize: 13, color: '#ef4444' }}>
                      🔒
                    </div>
                  )}
                  <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)', marginBottom: 2 }}>{item.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.4 }}>
                    {COMPONENT_REGISTRY[item.type]?.manifest?.description || COMPONENT_DESCRIPTIONS[item.type] || `${item.type} component`}
                  </div>
                </div>
              )
            })
          )}
        </div>
      );
    });
  }, [CATALOG, activeGroupFilter, paletteSearch, paletteViewMode, GROUP_COLORS, GROUP_ICON_SVG, COMPONENT_REGISTRY, isPaletteItemLocked, onPaletteDragStart, showLockToast, WOKWI_TO_COMP_ID, addComponentAtCenter, COMPONENT_DESCRIPTIONS]);

  return (
    <>
      {/* PALETTE — hover to expand */}
      <aside
        className="bg-[var(--bg2)] border-r border-[var(--border)] overflow-y-auto overflow-x-hidden flex flex-col shrink-0"
        style={{
          width: isPaletteHovered ? 340 : 38,
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          zIndex: 10,
          pointerEvents: liveEditingDisabled ? 'none' : 'auto',
          opacity: liveEditingDisabled ? 0.65 : 1,
        }}
        onMouseEnter={() => setIsPaletteHovered(true)}
        onMouseLeave={() => {
          if (!paletteContextMenu) { setIsPaletteHovered(false); setShowFilterDropdown(false); }
        }}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {/* Collapsed indicator — visible only when closed */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
          opacity: isPaletteHovered ? 0 : 1, transition: 'opacity 0.15s', pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', writingMode: 'vertical-rl', letterSpacing: '0.1em' }}>Components</span>
        </div>

        {/* Full palette content */}
        <div style={{
          width: 340,
          opacity: isPaletteHovered ? 1 : 0,
          transition: 'opacity 0.2s',
          pointerEvents: isPaletteHovered ? 'auto' : 'none',
          display: 'flex', flexDirection: 'column', height: '100%',
        }}>
            {/* Sticky top section */}
            <div style={{ flexShrink: 0, padding: '10px 8px 0', background: 'var(--bg2)' }}>
              <div className="text-[11px] font-bold text-[var(--text3)] uppercase tracking-widest px-2 pt-1 pb-2">Components</div>

              {/* Search + Filter + View Toggle */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                  <input
                    className="bg-[var(--card)] border border-[var(--border)] text-[var(--text)] pl-9 pr-3 rounded-lg text-xs w-full outline-none font-inherit box-border transition-all focus:border-[var(--accent)]"
                    style={{ flex: 1, height: 28, marginBottom: 0 }}
                    placeholder="Search..."
                    value={paletteSearch}
                    onChange={(e) => setPaletteSearch(e.target.value)}
                  />
                  {paletteSearch && (
                    <button onClick={() => setPaletteSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, opacity: 0.5, display: 'flex' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>

                <div className="filter-dropdown-container" style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                    style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: activeGroupFilter !== 'All' ? 'var(--accent)' : 'var(--card)', color: activeGroupFilter !== 'All' ? '#fff' : 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                    title="Filter by group"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>
                  </button>

                  {showFilterDropdown && (
                    <div
                      className="canvas-menu"
                      onMouseLeave={() => setShowFilterDropdown(false)}
                      style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: 6,
                        zIndex: 100,
                        background: theme === 'light' ? 'rgba(248, 250, 252, 0.8)' : 'rgba(13, 21, 37, 0.75)',
                        backdropFilter: 'blur(16px) saturate(1.4)',
                        WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
                        border: theme === 'light' ? '1px solid rgba(203, 213, 225, 0.6)' : '1px solid rgba(30, 45, 71, 0.6)',
                        borderRadius: 12,
                        boxShadow: theme === 'light' ? '0 8px 32px rgba(0, 0, 0, 0.08)' : '0 10px 40px rgba(0,0,0,0.5)',
                        padding: '5px',
                        minWidth: 160,
                        animation: 'canvasMenuIn 0.12s cubic-bezier(0.16, 1, 0.3, 1)',
                        transformOrigin: 'top right',
                        fontFamily: "'Space Grotesk', sans-serif",
                        willChange: 'transform, opacity, backdrop-filter',
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                      }}
                    >
                      <div className="text-[10px] font-bold text-[var(--text3)] uppercase tracking-widest px-3 py-1.5 border-b border-[var(--border)] mb-1">Groups</div>
                      {['All', ...CATALOG.map(g => g.group)].map(group => (
                        <button
                          key={group}
                          className="canvas-menu-item"
                          onClick={() => { setActiveGroupFilter(group); setShowFilterDropdown(false); }}
                          style={{
                            background: activeGroupFilter === group ? 'var(--accent)' : 'transparent',
                            color: activeGroupFilter === group ? '#fff' : 'var(--text)',
                          }}
                        >
                          {group === 'All' ? 'All Groups' : group}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setPaletteViewMode(m => m === 'list' ? 'grid' : 'list')}
                  style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}
                  title={paletteViewMode === 'list' ? 'Switch to Grid View' : 'Switch to List View'}
                >
                  {paletteViewMode === 'list' ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor" /><rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor" /><rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor" /><rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" /></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="2" rx="1" fill="currentColor" /><rect x="1" y="7" width="14" height="2" rx="1" fill="currentColor" /><rect x="1" y="12" width="14" height="2" rx="1" fill="currentColor" /></svg>
                  )}
                </button>
              </div>

              {/* Upload ZIP + Create Component */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                <input type="file" ref={componentZipInputRef} onChange={handleUploadZip} accept=".zip" style={{ display: 'none' }} />
                <button
                  onClick={() => componentZipInputRef.current.click()}
                  style={{ flex: 1, padding: '7px 4px', borderRadius: 6, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5l3-4 3 4M1 9v1a1 1 0 001 1h8a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
                  Upload ZIP
                </button>
                <button
                  onClick={openComponentEditor}
                  style={{ flex: 1, padding: '7px 4px', borderRadius: 6, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontWeight: 600 }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  Create
                </button>
              </div>

              {/* Favourites section */}
              <div style={{ marginBottom: 6, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', overflow: 'hidden' }}>
                <button
                  onClick={() => setShowFavorites(f => !f)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: 'var(--bg3)', border: 'none', borderBottom: showFavorites ? '1px solid var(--border)' : 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1l1.5 3H11l-2.5 1.8.9 3L6 7.2 3.6 9.8l.9-3L2 5h3.5z" fill="#f59e0b" stroke="#f59e0b" strokeWidth="0.5" /></svg>
                    Favourites {favoriteComponents.size > 0 ? `(${favoriteComponents.size})` : ''}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    {showFavorites
                      ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 7l3-4 3 4" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      : <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3l3 4 3-4" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    }
                  </span>
                </button>
                {showFavorites && (
                  <div style={{ padding: '6px 8px 8px' }}>
                    {favoriteItemsGrid}
                  </div>
                )}
              </div>
            </div>

            {/* Scrollable component list */}
            <div className="palette-scroll" style={{
              flex: 1, overflowY: 'auto',
              display: paletteViewMode === 'grid' ? 'block' : 'flex',
              flexDirection: 'column', gap: paletteViewMode === 'list' ? 2 : 0,
              padding: '4px 8px 8px',
            }}>
            {catalogItemsGrid}
              <div key="palette-tip" className="mt-auto px-2 py-2.5 text-[11px] text-[var(--text3)] leading-relaxed">
                Click or drag → drop to place · Del removes selected
              </div>
            </div>
          </div>
      </aside>

      {/* Palette right-click context menu */}
      {paletteContextMenu && (() => {
        const menuH = 175;
        const adjustedY = paletteContextMenu.y + menuH > window.innerHeight
          ? paletteContextMenu.y - menuH
          : paletteContextMenu.y;
        return (
          <div
            className="canvas-menu"
            onMouseDown={e => e.stopPropagation()}
            onMouseLeave={() => { setPaletteContextMenu(null); setIsPaletteHovered(false); }}
            style={{
              position: 'fixed',
              left: paletteContextMenu.x,
              top: adjustedY,
              zIndex: 10000,
              background: theme === 'light' ? 'rgba(248, 250, 252, 0.8)' : 'rgba(13, 21, 37, 0.75)',
              backdropFilter: 'blur(16px) saturate(1.4)',
              WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
              border: theme === 'light' ? '1px solid rgba(203, 213, 225, 0.6)' : '1px solid rgba(30, 45, 71, 0.6)',
              borderRadius: 12,
              boxShadow: theme === 'light' ? '0 8px 32px rgba(0, 0, 0, 0.08)' : '0 10px 40px rgba(0,0,0,0.5)',
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
            <div style={{ padding: '7px 12px 6px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{paletteContextMenu.item.label}</div>
            {[
              {
                icon: favoriteComponents.has(paletteContextMenu.item.type) ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>,
                label: favoriteComponents.has(paletteContextMenu.item.type) ? 'Remove from Favourites' : 'Add to Favourites',
                color: '#f59e0b',
                action: () => { toggleFavorite(paletteContextMenu.item.type); setPaletteContextMenu(null); setIsPaletteHovered(false); }
              },
              {
                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>,
                label: 'Component Documentation',
                color: 'var(--text)',
                action: () => {
                  const doc = COMPONENT_REGISTRY[paletteContextMenu.item.type]?.doc;
                  if (doc) {
                    const b = new Blob([doc], { type: 'text/html' });
                    window.open(URL.createObjectURL(b), '_blank');
                  } else {
                    window.open(`https://wokwi.com/docs/parts/${paletteContextMenu.item.type}`, '_blank');
                  }
                  setPaletteContextMenu(null); setIsPaletteHovered(false);
                }
              },
              {
                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
                label: 'Edit a Copy',
                color: 'var(--text)',
                action: () => {
                  const item = paletteContextMenu.item;
                  const registryInfo = COMPONENT_REGISTRY[item.type];
                  const editCopyData = {
                    manifest: registryInfo?.manifest || item,
                    logic: buildLogicSourceFromRegistry(registryInfo, item.type),
                    ui: buildUiSourceFromRegistry(registryInfo, item.type),
                    validation: buildValidationSourceFromRegistry(registryInfo),
                    index: buildIndexSourceFromRegistry(registryInfo, item.type),
                    docs: registryInfo?.docRaw || registryInfo?.doc || '',
                  };

                  const writeResult = writeEditCopyPayload(editCopyData);
                  if (!writeResult.ok) {
                    alert(`Unable to prepare Edit a Copy payload. ${writeResult.error?.message || 'Please clear browser storage and retry.'}`);
                    setPaletteContextMenu(null);
                    setIsPaletteHovered(false);
                    return;
                  }

                  openComponentEditor();
                  setPaletteContextMenu(null);
                  setIsPaletteHovered(false);
                }
              },
            ].map(({ icon, label, color, action }) => (
              <button
                key={label}
                className="canvas-menu-item"
                onClick={action}
                style={{ color }}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        );
      })()}
    </>
  );
});

export default PalettePanel;
