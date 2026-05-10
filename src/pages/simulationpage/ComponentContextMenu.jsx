import React, { useEffect, useRef, useState, useMemo } from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────
function normalizeBoardKind(source) {
  if (!source) return '';
  const s = String(source).toLowerCase();
  if (s.includes('arduino-uno') || s.includes('arduino_uno')) return 'arduino_uno';
  if (s.includes('arduino-mega') || s.includes('arduino_mega')) return 'arduino_mega';
  if (s.includes('arduino-nano') || s.includes('arduino_nano')) return 'arduino_nano';
  if (s.includes('esp32')) return 'esp32';
  if (s.includes('rp2040') || s.includes('pico')) return 'rp2040';
  if (s.includes('stm32')) return 'stm32';
  return s;
}

function resolveComponentAttrString(attrs, key, fallback = '') {
  if (!attrs) return fallback;
  const val = attrs[key];
  if (val === undefined || val === null) return fallback;
  return String(val);
}

function formatResistance(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  if (n >= 1000000) {
    const m = n / 1000000;
    return (m % 1 === 0 ? m : m.toFixed(1)) + 'M';
  }
  if (n >= 1000) {
    const k = n / 1000;
    return (k % 1 === 0 ? k : k.toFixed(1)) + 'k';
  }
  return String(n);
}

// Standard styling for small action panels (Rename, component-specific settings, etc.)
const actionPanelStyle = (theme) => ({
  background: theme === 'light' ? 'rgba(255, 255, 255, 0.98)' : 'rgba(15, 23, 42, 0.96)',
  backdropFilter: 'blur(20px) saturate(1.4)',
  WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
  padding: '4px',
  display: 'flex',
  gap: '4px',
});

export const ComponentContextMenu = ({ 
  x, y, comp, info, visible, onClose, theme,
  onRename, onPinMap, onRotate, onDelete, onDoc,
  updateComponentAttr, onValueEdit
}) => {
  const menuRef = useRef(null);
  const [showInfo, setShowInfo] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState(null); 
  const [activeNestedSubmenu, setActiveNestedSubmenu] = useState(null);

  const submenus = useMemo(() => {
    if (!comp) return [];
    const kind = normalizeBoardKind(comp.type);
    
    if (kind === 'rp2040') {
      const currentEnv = resolveComponentAttrString(comp?.attrs, 'env', 'native');
      const currentBuilder = resolveComponentAttrString(comp?.attrs, 'builder', 'arduino-pico');
      
      return [
        {
          label: 'Env',
          icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
          options: [
            { 
              label: 'None', 
              active: currentEnv === 'native' || currentEnv === 'ino', 
              onClick: () => updateComponentAttr?.(comp.id, 'env', 'native'),
              submenuHeader: 'BUILDER',
              submenu: [
                { label: 'Arduino (Earle Philhower)', active: currentBuilder === 'arduino-pico', onClick: () => updateComponentAttr?.(comp.id, 'builder', 'arduino-pico') },
                { label: 'Pico SDK', active: currentBuilder === 'pico-sdk', onClick: () => updateComponentAttr?.(comp.id, 'builder', 'pico-sdk') },
              ]
            },
            { label: 'MicroPython', active: currentEnv === 'micropython', onClick: () => updateComponentAttr?.(comp.id, 'env', 'micropython') },
            { label: 'CircuitPython', active: currentEnv === 'circuitpython', onClick: () => updateComponentAttr?.(comp.id, 'env', 'circuitpython') },
          ]
        }
      ];
    }

    if (comp.type === 'wokwi-led') {
      const currentColor = resolveComponentAttrString(comp?.attrs, 'color', 'red');
      const ledColors = [
        { label: 'Red', value: 'red', hex: '#ef4444' },
        { label: 'Green', value: 'green', hex: '#22c55e' },
        { label: 'Blue', value: 'blue', hex: '#3b82f6' },
        { label: 'Yellow', value: 'yellow', hex: '#eab308' },
        { label: 'Orange', value: 'orange', hex: '#f97316' },
        { label: 'White', value: 'white', hex: '#f1f5f9' },
      ];
      return [
        {
          label: 'Color',
          icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>,
          options: ledColors.map(c => ({
            label: c.label,
            active: currentColor === c.value,
            hoverBg: c.hex,
            onClick: () => updateComponentAttr?.(comp.id, 'color', c.value)
          }))
        }
      ];
    }

    if (comp.type === 'wokwi-neopixel-matrix') {
      const cols = resolveComponentAttrString(comp?.attrs, 'cols', '8');
      const rows = resolveComponentAttrString(comp?.attrs, 'rows', '8');
      return [
        {
          label: 'Config',
          icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="2" y1="14" x2="6" y2="14"/><line x1="10" y1="8" x2="14" y2="8"/><line x1="18" y1="16" x2="22" y2="16"/></svg>,
          options: [
            { 
              label: 'Rows', 
              valueDisplay: rows,
              submenu: true, // Marker for showing custom content
              customContent: (
                <ComponentCyclePicker 
                  value={rows} 
                  onChange={(v) => updateComponentAttr?.(comp.id, 'rows', v)} 
                  theme={theme} 
                />
              )
            },
            { 
              label: 'Cols', 
              valueDisplay: cols,
              submenu: true,
              customContent: (
                <ComponentCyclePicker 
                  value={cols} 
                  onChange={(v) => updateComponentAttr?.(comp.id, 'cols', v)} 
                  theme={theme} 
                />
              )
            },
          ]
        }
      ];
    }

    if (comp.type === 'wokwi-resistor') {
      const val = resolveComponentAttrString(comp?.attrs, 'value', '1000');
      return [
        {
          label: 'Value',
          icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7h-9m3 10H5"/><path d="M16 13l-4-4-4 4 4 4 4-4z"/></svg>,
          valueDisplay: formatResistance(val) + ' Ω',
          onClick: () => { onValueEdit?.(comp.id, 'value'); onClose(); }
        }
      ];
    }

    if (comp.type === 'wokwi-power-supply') {
      const val = resolveComponentAttrString(comp?.attrs, 'voltage', '5.0');
      return [
        {
          label: 'Voltage',
          icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
          valueDisplay: val + ' V',
          onClick: () => { onValueEdit?.(comp.id, 'voltage'); onClose(); }
        }
      ];
    }

    return [];
  }, [comp, updateComponentAttr, onValueEdit, onClose]);

  // Reset state when menu becomes invisible
  useEffect(() => {
    if (!visible) {
      setActiveSubmenu(null);
      setActiveNestedSubmenu(null);
      setShowInfo(false);
    }
  }, [visible]);

  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    if (visible) {
      document.addEventListener('mousedown', handleGlobalClick);
    }
    return () => document.removeEventListener('mousedown', handleGlobalClick);
  }, [visible, onClose]);

  if (!visible || !comp) return null;

  return (
    <div 
      ref={menuRef}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 10001,
        pointerEvents: 'auto',
      }}
      onMouseLeave={onClose}
    >
      <style>{`
        .context-menu-item {
          transition: background 0.13s ease, padding-left 0.13s ease !important;
        }
        .context-menu-item:hover {
          padding-left: 12px !important;
          background: var(--item-hover-bg, var(--bg3)) !important;
        }
        .context-menu-item:active {
          transform: scale(0.98);
        }
      `}</style>
      <div 
        className="canvas-menu"
        style={{
          background: theme === 'light' ? 'rgba(248, 250, 252, 0.95)' : 'rgba(13, 21, 37, 0.94)',
          backdropFilter: 'blur(16px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
          border: theme === 'light' ? '1px solid rgba(203, 213, 225, 0.8)' : '1px solid rgba(30, 45, 71, 0.8)',
          borderRadius: '10px',
          boxShadow: theme === 'light' ? '0 8px 32px rgba(0, 0, 0, 0.08)' : '0 10px 40px rgba(0,0,0,0.5)',
          minWidth: '135px',
          padding: '4px',
          fontFamily: "'Space Grotesk', sans-serif",
          position: 'relative'
        }}
      >
        <div style={{ padding: '4px 8px 3px', fontSize: '9px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, opacity: 0.6 }}>
          {comp.id}
        </div>
        
        <button className="canvas-menu-item context-menu-item" style={{ fontSize: '11.5px', padding: '4px 8px', gap: '6px' }} onClick={(e) => { e.stopPropagation(); onRename(); onClose(); }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          <span>Rename</span>
          <span style={{ marginLeft: 'auto', fontSize: '8.5px', opacity: 0.4, fontWeight: 700 }}>ID</span>
        </button>

        {submenus.map((sub, idx) => (
          <div key={`sub-${idx}`}>
            {sub.options ? (
              <div 
                className={`canvas-menu-item context-menu-item ${sub.disabled ? 'disabled' : ''}`}
                style={{ 
                  fontSize: '11.5px', padding: '4px 8px', gap: '6px', position: 'relative',
                  opacity: sub.disabled ? 0.4 : 1,
                  cursor: sub.disabled ? 'not-allowed' : 'default'
                }}
                onMouseEnter={() => { if (!sub.disabled) setActiveSubmenu(sub.label); setShowInfo(false); }}
                onMouseLeave={() => setActiveSubmenu(null)}
              >
                {sub.icon || (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                )}
                <span>{sub.label}</span>
                <svg style={{ marginLeft: 'auto', opacity: 0.4 }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>

                {activeSubmenu === sub.label && !sub.disabled && (
                  <div style={{
                    position: 'absolute',
                    left: 'calc(100% + 6px)',
                    top: '-4px',
                    ...actionPanelStyle(theme),
                    flexDirection: 'column',
                    minWidth: '140px',
                    padding: '4px',
                    zIndex: 10002,
                  }}>
                    <div style={{ position: 'absolute', left: '-8px', top: 0, bottom: 0, width: '8px', background: 'transparent' }} />
                    {sub.options.map((opt, oIdx) => (
                      <div key={oIdx} style={{ position: 'relative' }} onMouseEnter={() => { if (opt.submenu) setActiveNestedSubmenu(opt.label); else setActiveNestedSubmenu(null); }}>
                        <button
                          className={`canvas-menu-item context-menu-item ${opt.disabled ? 'disabled' : ''}`}
                          style={{ 
                            fontSize: '11px', padding: '4px 8px', gap: '6px', 
                            background: opt.active ? (opt.hoverBg ? `${opt.hoverBg}25` : 'var(--accent)15') : 'transparent',
                            color: opt.active ? 'var(--accent)' : (opt.disabled ? 'var(--text3)' : 'inherit'),
                            fontWeight: opt.active ? 700 : 500,
                            opacity: opt.disabled ? 0.5 : 1,
                            cursor: opt.disabled ? 'not-allowed' : 'pointer',
                            '--item-hover-bg': opt.hoverBg ? `${opt.hoverBg}26` : 'var(--bg3)',
                          }}
                          onClick={(e) => { if (opt.disabled) return; e.stopPropagation(); if (opt.onClick) { opt.onClick(); onClose(); } }}
                        >
                          {opt.label}
                          {opt.active && !opt.submenu && (
                            <svg style={{ marginLeft: 'auto' }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          )}
                          {opt.submenu && (
                            <svg style={{ marginLeft: 'auto', opacity: 0.4 }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                          )}
                        </button>

                        {opt.submenu && activeNestedSubmenu === opt.label && (
                          <div style={{ position: 'absolute', left: 'calc(100% + 6px)', top: '-4px', ...actionPanelStyle(theme), flexDirection: 'column', minWidth: opt.customContent ? 'auto' : '140px', padding: '4px', zIndex: 10003 }}>
                            <div style={{ position: 'absolute', left: '-8px', top: 0, bottom: 0, width: '8px', background: 'transparent' }} />
                            {opt.customContent ? opt.customContent : (
                              <>
                                {opt.submenuHeader && <div style={{ padding: '4px 8px 3px', fontSize: '9px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, opacity: 0.6 }}>{opt.submenuHeader}</div>}
                                {opt.submenu.map((nOpt, nIdx) => (
                                  <button key={nIdx} className="canvas-menu-item context-menu-item" style={{ fontSize: '11px', padding: '4px 8px', gap: '6px', background: nOpt.active ? (nOpt.hoverBg ? `${nOpt.hoverBg}25` : 'var(--accent)15') : 'transparent', color: nOpt.active ? 'var(--accent)' : 'inherit', fontWeight: nOpt.active ? 700 : 500, '--item-hover-bg': nOpt.hoverBg ? `${nOpt.hoverBg}26` : 'var(--bg3)' }} onClick={(e) => { e.stopPropagation(); nOpt.onClick(); onClose(); }}>
                                    {nOpt.label}
                                    {nOpt.active && <svg style={{ marginLeft: 'auto' }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                                  </button>
                                ))}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button 
                className={`canvas-menu-item context-menu-item ${sub.disabled ? 'disabled' : ''}`}
                style={{ fontSize: '11.5px', padding: '4px 8px', gap: '6px' }}
                onClick={(e) => { e.stopPropagation(); sub.onClick?.(); }}
              >
                {sub.icon}
                <span>{sub.label}</span>
                {sub.valueDisplay && (
                  <span style={{ marginLeft: 'auto', fontSize: '10px', opacity: 0.5, fontWeight: 700 }}>{sub.valueDisplay}</span>
                )}
              </button>
            )}
          </div>
        ))}

        <button className="canvas-menu-item context-menu-item" style={{ fontSize: '11.5px', padding: '4px 8px', gap: '6px' }} onClick={(e) => { e.stopPropagation(); onPinMap(); onClose(); }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" /></svg>
          <span>Pin Map</span>
        </button>
        
        <div 
          className="canvas-menu-item context-menu-item" 
          style={{ fontSize: '11.5px', padding: '4px 8px', gap: '6px', cursor: 'default', position: 'relative' }}
          onMouseEnter={() => { setShowInfo(true); setActiveSubmenu(null); }}
          onMouseLeave={() => setShowInfo(false)}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span>Info</span>
          <svg style={{ marginLeft: 'auto', opacity: 0.4 }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>

          {showInfo && info && (
            <div style={{
              position: 'absolute',
              left: 'calc(100% + 6px)',
              top: '-4px',
              ...actionPanelStyle(theme),
              flexDirection: 'column',
              minWidth: '200px',
              maxWidth: '260px',
              padding: '10px',
              gap: '6px',
              zIndex: 10002,
              pointerEvents: 'none'
            }}>
              {/* Bridge */}
              <div style={{ position: 'absolute', left: '-8px', top: 0, bottom: 0, width: '8px', background: 'transparent', pointerEvents: 'auto' }} />
              
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>{info.label}</div>
              <div style={{ display: 'inline-flex', padding: '2px 6px', background: 'var(--accent)15', border: '1px solid var(--accent)33', borderRadius: '4px', fontSize: '9px', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', width: 'fit-content' }}>
                {info.group}
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--text2)', lineHeight: 1.4, opacity: 0.8, fontWeight: 500 }}>
                {info.description || 'Interactive Simulator Component'}
              </div>
            </div>
          )}
        </div>

        {onDoc && (
          <button className="canvas-menu-item context-menu-item" style={{ fontSize: '11.5px', padding: '4px 8px', gap: '6px' }} onClick={(e) => { e.stopPropagation(); onDoc(); onClose(); }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            <span>Docs</span>
          </button>
        )}

        <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0', opacity: 0.4 }} />
        
        <button className="canvas-menu-item context-menu-item" style={{ fontSize: '11.5px', padding: '4px 8px', gap: '6px' }} onClick={(e) => { e.stopPropagation(); onRotate(); onClose(); }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          <span>Rotate</span>
          <span style={{ marginLeft: 'auto', fontSize: '8.5px', opacity: 0.4, fontWeight: 700 }}>{comp.rotation || 0}°</span>
        </button>
        
        <button 
          className="canvas-menu-item context-menu-item" 
          style={{ 
            fontSize: '11.5px', padding: '4px 8px', gap: '6px',
            color: 'var(--red)',
            '--item-hover-bg': 'rgba(255, 68, 68, 0.12)'
          }} 
          onClick={(e) => { e.stopPropagation(); onDelete(); onClose(); }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          <span>Delete</span>
        </button>
      </div>
    </div>
  );
};

/**
 * Focused Rename Panel for Component IDs - Small and Minimal
 */
export const ComponentRenamePanel = ({ 
  comp, x, y, visible, 
  onConfirm, onCancel, 
  theme 
}) => {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Close on lose focus (click outside)
  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onCancel();
      }
    };
    if (visible) {
      document.addEventListener('mousedown', handleGlobalClick);
    }
    return () => document.removeEventListener('mousedown', handleGlobalClick);
  }, [visible, onCancel]);

  useEffect(() => {
    if (visible && comp) {
      setValue(comp.id);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [visible, comp]);

  if (!visible || !comp) return null;

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (value.trim() && value.trim() !== comp.id) {
      onConfirm(value.trim());
    } else {
      onCancel();
    }
  };

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 10002,
        pointerEvents: 'auto',
        marginTop: '-12px',
        transition: 'none',
        // Move the core transform and animation here to avoid conflict with child
        animation: 'action-panel-mount 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        visibility: x === 0 ? 'hidden' : 'visible'
      }}
      onMouseDown={e => e.stopPropagation()}
      onMouseLeave={onCancel}
    >
      <style>{`
        @keyframes action-panel-mount {
          from { opacity: 0; transform: translate(-50%, -85%) scale(0.96); }
          to { opacity: 1; transform: translate(-50%, -100%) scale(1); }
        }
      `}</style>
      <form onSubmit={handleSubmit} style={actionPanelStyle(theme)}>
        
        <input 
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\s+/g, '_'))} 
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel();
          }}
          placeholder="New ID"
          style={{
            background: 'transparent',
            border: 'none',
            padding: '5px 8px',
            color: 'var(--text)',
            fontSize: '12px',
            fontWeight: '600',
            outline: 'none',
            fontFamily: 'JetBrains Mono, monospace',
            width: '110px',
          }}
        />
        <button 
          type="submit"
          style={{ 
            background: 'var(--accent)', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '6px', 
            padding: '0 8px',
            fontSize: '9px',
            fontWeight: '800',
            cursor: 'pointer',
            textTransform: 'uppercase',
            transition: 'opacity 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          OK
        </button>
      </form>
    </div>
  );
};

/**
 * Specialized Value Panel for Component Attributes (like Resistor Ohm value or Power Supply Voltage)
 */
export const ComponentValuePanel = ({ x, y, comp, attrKey = 'value', visible, onConfirm, onCancel, theme }) => {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const unit = attrKey === 'voltage' ? 'V' : 'Ω';

  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onCancel();
      }
    };
    if (visible) {
      document.addEventListener('mousedown', handleGlobalClick);
    }
    return () => document.removeEventListener('mousedown', handleGlobalClick);
  }, [visible, onCancel]);

  useEffect(() => {
    if (visible && comp) {
      setValue(comp.attrs?.[attrKey] || (attrKey === 'voltage' ? '5.0' : '1000'));
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [visible, comp, attrKey]);

  if (!visible || !comp) return null;

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (value.trim()) {
      onConfirm(value.trim());
    } else {
      onCancel();
    }
  };

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 10002,
        pointerEvents: 'auto',
        marginTop: '-12px',
        animation: 'action-panel-mount 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        visibility: x === 0 ? 'hidden' : 'visible'
      }}
      onMouseDown={e => e.stopPropagation()}
      onMouseLeave={onCancel}
    >
      <form onSubmit={handleSubmit} style={{ ...actionPanelStyle(theme), alignItems: 'center' }}>
        <span style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 800, paddingLeft: '8px' }}>{unit}</span>
        <input 
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9.kM]/g, ''))} 
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel();
          }}
          placeholder="Value"
          style={{
            background: 'transparent',
            border: 'none',
            padding: '5px 8px',
            color: 'var(--text)',
            fontSize: '12px',
            fontWeight: '600',
            outline: 'none',
            fontFamily: 'JetBrains Mono, monospace',
            width: '80px',
          }}
        />
        <button type="submit" style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '9px', fontWeight: '800', cursor: 'pointer', textTransform: 'uppercase' }}>
          SET
        </button>
      </form>
    </div>
  );
};

/**
 * Drum-style Cycle Picker for numeric attributes (Rows, Cols, etc.)
 */
export const ComponentCyclePicker = ({ value, onChange, min = 1, max = 24, theme }) => {
  const containerRef = useRef(null);
  const currentVal = parseInt(value) || min;

  const [isHovered, setIsHovered] = useState(false);
  const scrollAccRef = useRef(0);
  const SCROLL_THRESHOLD = 45; // Resistance threshold

  // Wheel isolation to prevent canvas scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      scrollAccRef.current += e.deltaY;
      
      if (Math.abs(scrollAccRef.current) >= SCROLL_THRESHOLD) {
        const steps = Math.sign(scrollAccRef.current);
        let next = currentVal + steps;
        const range = max - min + 1;
        while (next < min) next += range;
        while (next > max) next -= range;
        onChange(String(next));
        scrollAccRef.current = 0; // Reset after trigger
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [currentVal, min, max, onChange]);

  // Keyboard support
  useEffect(() => {
    if (!isHovered) return;
    const handleKey = (e) => {
      let delta = 0;
      if (e.key === 'ArrowUp' || e.key === 'PageUp') delta = -1;
      else if (e.key === 'ArrowDown' || e.key === 'PageDown') delta = 1;

      if (delta !== 0) {
        e.preventDefault();
        e.stopPropagation();
        let next = currentVal + delta;
        const range = max - min + 1;
        while (next < min) next += range;
        while (next > max) next -= range;
        onChange(String(next));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isHovered, currentVal, min, max, onChange]);

  const items = [];
  // Show 5 items: [val-2, val-1, VAL, val+1, val+2]
  for (let i = -2; i <= 2; i++) {
    let v = currentVal + i;
    while (v < min) v += (max - min + 1);
    while (v > max) v -= (max - min + 1);
    items.push(v);
  }

  return (
    <div 
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
        padding: '8px 4px',
        userSelect: 'none',
        cursor: 'ns-resize',
        width: '40px',
      }}
    >
      {items.map((v, i) => {
        const isCenter = i === 2;
        const isEdge = i === 0 || i === 4;
        return (
          <div
            key={`${v}-${i}`}
            onClick={(e) => { e.stopPropagation(); onChange(String(v)); }}
            style={{
              fontSize: isCenter ? '14px' : '11px',
              fontWeight: isCenter ? '800' : '500',
              color: isCenter ? 'var(--accent)' : 'var(--text3)',
              opacity: isEdge ? 0.2 : (isCenter ? 1 : 0.5),
              height: '22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
              transform: isCenter ? 'scale(1.2)' : 'scale(1)',
            }}
          >
            {v}
          </div>
        );
      })}
    </div>
  );
};
