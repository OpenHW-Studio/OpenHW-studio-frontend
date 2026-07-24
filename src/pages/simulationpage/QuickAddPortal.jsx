import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { isComponentHidden, getComponentWarning } from './utils/componentVisibilityConfig';

/**
 * QuickAddPortal — the double-click-on-canvas component search popup.
 *
 * Rendered into document.body via createPortal so it lives OUTSIDE the
 * SimulatorPage React tree. This means opening the panel does NOT trigger
 * a re-render of the 12 000-line SimulatorPage component or its canvas,
 * eliminating the perceived delay between double-click and panel appearance.
 *
 * SimulatorPage fires a 'quick-add-open' CustomEvent on window with:
 *   { detail: { screenX, screenY, canvasX, canvasY } }
 *
 * The `onAddComponent(item, canvasX, canvasY)` callback is passed as a
 * stable ref so the portal never needs to re-render due to prop changes.
 *
 * Theme: all colours use CSS custom properties so the panel automatically
 * follows light / dark mode without needing a theme prop.
 */
const QuickAddPortal = React.memo(function QuickAddPortal({ catalog, onAddComponentRef, isPaletteItemLocked, showLockToast }) {
  const [quickAdd, setQuickAdd] = useState(null); // { screenX, screenY, canvasX, canvasY }
  const [search, setSearch]     = useState('');
  const [selIdx, setSelIdx]     = useState(0);
  const inputRef                = useRef(null);

  // ── Read & watch the document theme (light / dark) ──────────────────────
  const [isLight, setIsLight] = useState(
    () => document.documentElement.dataset.theme === 'light'
  );
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsLight(document.documentElement.dataset.theme === 'light');
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  // Glassmorphism background — semi-transparent so blur shows through
  const panelBg  = isLight ? 'rgba(248, 250, 252, 0.82)' : 'rgba(13, 21, 37, 0.80)';
  const inputBg  = isLight ? 'rgba(255, 255, 255, 0.60)' : 'rgba(0, 0, 0, 0.25)';
  const divider  = isLight ? '1px solid rgba(203,213,225,0.7)' : '1px solid var(--border)';

  // ── Listen for open events from the canvas ──────────────────────────────
  useEffect(() => {
    const open = (e) => {
      setQuickAdd(e.detail);
      setSearch('');
      setSelIdx(0);
    };
    window.addEventListener('quick-add-open', open);
    return () => window.removeEventListener('quick-add-open', open);
  }, []);

  // ── Auto-focus input when panel opens ───────────────────────────────────
  useEffect(() => {
    if (quickAdd && inputRef.current) {
      inputRef.current.focus();
    }
  }, [quickAdd]);

  // ── Close on outside mousedown ──────────────────────────────────────────
  useEffect(() => {
    if (!quickAdd) return;
    const handler = (e) => {
      if (e.target.closest && !e.target.closest('[data-quickadd="true"]')) setQuickAdd(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [quickAdd]);

  if (!quickAdd) return null;

  // ── Search ───────────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const results = [];
  if (q) {
    outer: for (const group of catalog) {
      for (const item of group.items) {
        if (isComponentHidden(item.type)) continue;
        const searchLabel = (item.label || item.name || '').toLowerCase();
        const searchType = (item.type || '').toLowerCase();
        if (searchLabel.includes(q) || searchType.includes(q)) {
          results.push(item);
          if (results.length >= 6) break outer;
        }
      }
    }
  }
  const clampedIdx = Math.max(0, Math.min(selIdx, results.length - 1));

  // ── Position (stay inside viewport) ─────────────────────────────────────
  const menuW = 240;
  const approxH = 56 + results.length * 38 + (results.length === 0 ? 38 : 0);
  const VW = window.innerWidth, VH = window.innerHeight;
  const left = quickAdd.screenX + menuW > VW ? quickAdd.screenX - menuW - 4 : quickAdd.screenX + 4;
  const top  = quickAdd.screenY + approxH > VH ? quickAdd.screenY - approxH - 4 : quickAdd.screenY + 4;

  const addItem = (item) => {
    const locked = isPaletteItemLocked?.(item.type);
    if (locked) {
      showLockToast?.(item.label || item.name, null);
      setQuickAdd(null);
      return;
    }
    onAddComponentRef.current?.(item, quickAdd.canvasX, quickAdd.canvasY);
    setQuickAdd(null);
  };

  const panel = (
    <div
      className="canvas-menu"
      data-quickadd="true"
      onMouseDown={e => e.stopPropagation()}
      onDoubleClick={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        left,
        top,
        zIndex: 10000,
        width: menuW,
        /* Theme-aware glassmorphism — CSS vars auto-follow light/dark mode */
        background: panelBg,
        backdropFilter: 'blur(16px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 10px 40px rgba(0,0,0,0.35)',
        padding: '5px',
        animation: 'canvasMenuIn 0.08s cubic-bezier(0.16, 1, 0.3, 1)',
        transformOrigin: 'top left',
        fontFamily: "'Space Grotesk', sans-serif",
        willChange: 'transform, opacity',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
      }}
    >
      {/* Search input */}
      <div style={{ padding: '8px 10px', borderBottom: results.length > 0 ? divider : 'none' }}>
        <input
          ref={inputRef}
          data-quickadd="true"
          value={search}
          onChange={e => { setSearch(e.target.value); setSelIdx(0); }}
          onKeyDown={e => {
            if (e.key === 'Escape') { e.preventDefault(); setQuickAdd(null); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); setSelIdx(i => Math.min(i + 1, results.length - 1)); }
            else if (e.key === 'ArrowUp')   { e.preventDefault(); setSelIdx(i => Math.max(i - 1, 0)); }
            else if (e.key === 'Enter' && results.length > 0) { e.preventDefault(); addItem(results[clampedIdx]); }
          }}
          placeholder="Search component…"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: inputBg,
            border: '1px solid var(--border)',
            color: 'var(--text)',
            padding: '9px 13px',
            borderRadius: 9,
            fontFamily: 'inherit',
            fontSize: 14,
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onBlur={e  => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        />
      </div>

      {/* Results */}
      {results.map((item, i) => {
        const locked = isPaletteItemLocked?.(item.type) ?? false;
        const warning = getComponentWarning(item.type);
        return (
          <div
            key={`${item.type}-${i}`}
            className="canvas-menu-item"
            data-quickadd="true"
            onMouseEnter={() => setSelIdx(i)}
            onMouseDown={e => { e.preventDefault(); addItem(item); }}
            title={warning ? `⚠️ ${warning}` : undefined}
            style={{
              background: i === clampedIdx ? (locked ? 'rgba(239,68,68,0.15)' : (warning ? '#f59e0b22' : 'var(--accent)')) : 'transparent',
              color:      i === clampedIdx ? (locked ? '#ef4444' : (warning ? '#f59e0b' : '#fff')) : (locked ? 'var(--text3)' : (warning ? '#f59e0b' : 'var(--text)')),
              borderRadius: 8,
              margin: '2px 5px',
              width: 'calc(100% - 10px)',
              userSelect: 'none',
              opacity: locked ? 0.65 : 1,
            }}
          >
            <span style={{ fontWeight: i === clampedIdx ? 700 : 500, flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              {item.label}
              {warning && <span style={{ fontSize: 10, opacity: 0.8 }}>(Not Working)</span>}
            </span>
            {warning && (
              <span style={{ marginRight: 4, display: 'inline-flex', alignItems: 'center' }} title={warning}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" fill="rgba(245, 158, 11, 0.25)" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
            )}
            {locked && <span style={{ fontSize: 11 }}>🔒</span>}
            {!locked && i === clampedIdx && <span style={{ fontSize: 10, opacity: 0.75 }}>↵</span>}
          </div>
        );
      })}

      {/* Empty / hint states */}
      {q && results.length === 0 && (
        <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text3)' }}>No components found</div>
      )}
      {!q && (
        <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text3)' }}>Type to search components…</div>
      )}
    </div>
  );

  return ReactDOM.createPortal(panel, document.body);
});

export default QuickAddPortal;
