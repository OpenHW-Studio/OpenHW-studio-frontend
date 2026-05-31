import React, { useMemo, useState } from 'react';
import { getTelemetryParamsForComponent } from '../utils/telemetryRegistry';

function ComponentTelemetrySelectModalBase({
  isOpen,
  onClose,
  components = [],
  selectedIds = [],
  onChangeSelectedIds,
  watchedParamsMap = {},
  onChangeWatchedParamsMap,
}) {
  const [expandedMenuId, setExpandedMenuId] = useState(null);

  const validComponents = useMemo(() => {
    return Array.isArray(components) ? components.filter(c => c && c.id) : [];
  }, [components]);

  const selectedSet = useMemo(() => new Set(selectedIds || []), [selectedIds]);

  if (!isOpen) return null;

  const handleToggle = (id) => {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChangeSelectedIds?.(Array.from(next));
  };

  const handleSelectAll = () => {
    onChangeSelectedIds?.(validComponents.map(c => c.id));
  };

  const handleDeselectAll = () => {
    onChangeSelectedIds?.([]);
  };

  const handleParamToggle = (compId, param) => {
    const current = watchedParamsMap?.[compId] || ['all'];
    let next;
    if (param === 'all') {
      next = ['all'];
    } else {
      const set = new Set(current.filter(p => p !== 'all'));
      if (set.has(param)) set.delete(param);
      else set.add(param);
      next = set.size === 0 ? ['all'] : Array.from(set);
    }
    onChangeWatchedParamsMap?.({
      ...watchedParamsMap,
      [compId]: next,
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 24,
      }}
      onClick={onClose}
      onWheelCapture={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        style={{
          backgroundColor: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '28px 32px',
          width: '100%',
          maxWidth: 580,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 70px rgba(0, 0, 0, 0.55)',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 18, borderBottom: '1px solid var(--border)', marginBottom: 20, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>Select Telemetry Components</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Filter components and customize watched parameters for Delta mode</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid transparent',
              color: 'var(--text3)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--card)'; e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text3)'; }}
            title="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexShrink: 0 }}>
          <button
            onClick={handleSelectAll}
            style={{
              padding: '6px 16px',
              fontSize: 12,
              fontWeight: 700,
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text2)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)'; }}
          >
            Select All
          </button>
          <button
            onClick={handleDeselectAll}
            style={{
              padding: '6px 16px',
              fontSize: 12,
              fontWeight: 700,
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text2)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)'; }}
          >
            Deselect All
          </button>
          <div style={{
            marginLeft: 'auto',
            padding: '4px 14px',
            backgroundColor: 'rgba(0, 212, 255, 0.1)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            borderRadius: 100,
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--accent)',
            boxShadow: '0 2px 8px rgba(0, 212, 255, 0.15)',
          }}>
            {selectedSet.size} / {validComponents.length} Selected
          </div>
        </div>

        <div
          className="custom-scrollbar"
          style={{
            flex: 1,
            overflowY: 'auto',
            paddingRight: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            minHeight: 180,
            maxHeight: 328,
          }}
          onWheelCapture={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {validComponents.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--text3)', fontStyle: 'italic', padding: '32px 0' }}>
              No active components found on the canvas.
            </div>
          ) : (
            validComponents.map((comp) => {
              const isSelected = selectedSet.has(comp.id);
              const isExpanded = expandedMenuId === comp.id;
              const activeParams = watchedParamsMap?.[comp.id] || ['all'];
              const availableParams = getTelemetryParamsForComponent(comp.type);

              return (
                <div
                  key={comp.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 8,
                    border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                    backgroundColor: isSelected ? 'var(--card)' : 'var(--bg)',
                    boxShadow: isSelected ? '0 4px 16px rgba(0, 212, 255, 0.12)' : 'none',
                    transition: 'all 0.2s ease',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '11px 18px',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'rgba(0, 212, 255, 0.03)' : 'transparent',
                    }}
                    onClick={() => handleToggle(comp.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        border: isSelected ? '1px solid var(--accent)' : '1px solid var(--text3)',
                        backgroundColor: isSelected ? 'var(--accent)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        transition: 'all 0.2s',
                      }}>
                        {isSelected && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: 'var(--text)' }}>{comp.id}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{comp.type}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} onClick={(e) => e.stopPropagation()}>
                      <div style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: 6,
                        letterSpacing: '0.04em',
                        backgroundColor: isSelected ? 'rgba(0, 212, 255, 0.15)' : 'var(--bg2)',
                        border: isSelected ? '1px solid rgba(0, 212, 255, 0.4)' : '1px solid var(--border)',
                        color: isSelected ? 'var(--accent)' : 'var(--text3)',
                      }}>
                        {isSelected ? 'MONITORING' : 'MUTED'}
                      </div>
                      <button
                        onClick={() => setExpandedMenuId(isExpanded ? null : comp.id)}
                        style={{
                          background: isExpanded ? 'var(--card2)' : 'transparent',
                          border: '1px solid transparent',
                          padding: 6,
                          borderRadius: 6,
                          color: isExpanded ? 'var(--text)' : 'var(--text2)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg2)'; e.currentTarget.style.color = 'var(--text)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isExpanded ? 'var(--card2)' : 'transparent'; e.currentTarget.style.color = isExpanded ? 'var(--text)' : 'var(--text2)'; }}
                        title="Customize Watched Parameters"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                          }}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{
                      padding: '14px 18px',
                      borderTop: '1px solid var(--border)',
                      backgroundColor: 'var(--bg2)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Watched Parameters (Delta Mode Filter)
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <button
                          onClick={() => handleParamToggle(comp.id, 'all')}
                          style={{
                            padding: '6px 14px',
                            fontSize: 11,
                            fontWeight: 600,
                            borderRadius: 6,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            border: activeParams.includes('all') ? '1px solid var(--accent)' : '1px solid var(--border)',
                            backgroundColor: activeParams.includes('all') ? 'var(--accent)' : 'var(--card)',
                            color: activeParams.includes('all') ? 'white' : 'var(--text2)',
                            boxShadow: activeParams.includes('all') ? '0 2px 8px rgba(0, 212, 255, 0.3)' : 'none',
                          }}
                          onMouseEnter={(e) => { if (!activeParams.includes('all')) { e.currentTarget.style.borderColor = 'var(--text3)'; e.currentTarget.style.color = 'var(--text)'; } }}
                          onMouseLeave={(e) => { if (!activeParams.includes('all')) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)'; } }}
                        >
                          All (Default)
                        </button>
                        {availableParams.map((param) => {
                          const isParamActive = !activeParams.includes('all') && activeParams.includes(param);
                          return (
                            <button
                              key={param}
                              onClick={() => handleParamToggle(comp.id, param)}
                              style={{
                                padding: '6px 14px',
                                fontSize: 11,
                                fontWeight: 600,
                                borderRadius: 6,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                border: isParamActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                                backgroundColor: isParamActive ? 'var(--accent)' : 'var(--card)',
                                color: isParamActive ? 'white' : 'var(--text2)',
                                boxShadow: isParamActive ? '0 2px 8px rgba(0, 212, 255, 0.3)' : 'none',
                              }}
                              onMouseEnter={(e) => { if (!isParamActive) { e.currentTarget.style.borderColor = 'var(--text3)'; e.currentTarget.style.color = 'var(--text)'; } }}
                              onMouseLeave={(e) => { if (!isParamActive) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)'; } }}
                            >
                              {param}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div style={{
          paddingTop: 20,
          borderTop: '1px solid var(--border)',
          marginTop: 20,
          display: 'flex',
          justifyContent: 'flex-end',
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 28px',
              fontSize: 13,
              fontWeight: 700,
              backgroundColor: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 14px rgba(0, 212, 255, 0.3)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = 0.9; e.currentTarget.style.transform = 'translate(0, -1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.transform = 'translate(0, 0)'; }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export const ComponentTelemetrySelectModal = React.memo(ComponentTelemetrySelectModalBase);
