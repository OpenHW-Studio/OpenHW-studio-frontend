import React from 'react';

function ComponentInspectorPanelBase({
  selectedComponentInfo,
  showComponentDesc,
  setShowComponentDesc,
  selected,
  components,
  wires,
  COMPONENT_REGISTRY,
  GROUP_COLORS,
  LOCAL_PIN_DEFS,
  getPinCategory,
  hasCategoryIntersection,
  pendingPinColors,
  setPendingPinColors,
  updateWireColor,
  setWires,
  setWireStart,
  isPinMappingExpanded,
  setIsPinMappingExpanded,
}) {
  if (!showComponentDesc || !selectedComponentInfo) return null;

  return (
    <div
      data-export-ignore="true"
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onDoubleClick={e => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 90,
        width: 220,
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        overflow: 'hidden',
        maxHeight: 'calc(100vh - 130px)',
        display: 'flex',
        flexDirection: 'column',
      }}
      data-no-canvas-scroll="true"
    >
      <div style={{
        padding: '16px 16px 14px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: 'linear-gradient(to bottom, var(--bg2), var(--bg1))'
      }}>
        <div style={{
          fontSize: 15,
          fontWeight: 800,
          color: 'var(--text)',
          letterSpacing: '-0.02em',
          lineHeight: '1.1'
        }}>
          {selectedComponentInfo.label}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            height: 24,
            fontSize: 9,
            fontWeight: 800,
            color: GROUP_COLORS[selectedComponentInfo.group] || 'var(--accent)',
            background: `${GROUP_COLORS[selectedComponentInfo.group] || 'var(--accent)'}12`,
            borderRadius: 6,
            padding: '0 10px',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${GROUP_COLORS[selectedComponentInfo.group] || 'var(--accent)'}22`
          }}>
            {selectedComponentInfo.group}
          </div>

          <button
            onClick={() => {
              const doc = COMPONENT_REGISTRY[selectedComponentInfo.type]?.doc;
              if (doc) {
                const finalDoc = doc.replace(/http:\/\/localhost:5173/g, window.location.origin);
                const b = new Blob([finalDoc], { type: 'text/html' });
                window.open(URL.createObjectURL(b), '_blank');
              } else {
                window.open(`https://wokwi.com/docs/parts/${selectedComponentInfo.type}`, '_blank');
              }
            }}
            style={{
              height: 24,
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              padding: '0 12px',
              color: 'var(--text2)',
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderRadius: 6,
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--bg4)';
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.color = 'var(--accent)';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--bg3)';
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--text2)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            Documentation
          </button>
        </div>
      </div>

      <div className="panel-scroll" style={{ padding: '10px 12px', flex: 1, overflowY: 'auto' }}>
        <div
          onClick={() => setIsPinMappingExpanded(!isPinMappingExpanded)}
          style={{
            fontSize: 11,
            fontWeight: 'bold',
            color: 'var(--text3)',
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            userSelect: 'none',
            padding: '4px 0'
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text2)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}
        >
          <span>Pin Mapping</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)', transform: isPinMappingExpanded ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.6 }}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
        {isPinMappingExpanded && (() => {
          const compPins = LOCAL_PIN_DEFS[selectedComponentInfo.type] || [];
          if (compPins.length === 0) {
            return <div style={{ fontSize: 12, color: 'var(--text3)' }}>No pins exposed.</div>;
          }

          const validTargets = components.filter(c => c.id !== selected);
          const targetOptions = [];
          validTargets.forEach(b => {
            const bPins = LOCAL_PIN_DEFS[b.type] || [];
            bPins.forEach(p => targetOptions.push({
              id: `${b.id}:${p.id}`,
              label: `${b.label || b.id} : ${p.id}`,
              type: b.type,
              description: p.description,
            }));
          });

          return compPins.map(pin => {
            const pinIdStr = `${selected}:${pin.id}`;
            const currentPinCat = getPinCategory(pin.id, pin.description, selectedComponentInfo.type);
            const filteredOptions = targetOptions.filter(opt => {
              if (!currentPinCat) return true;
              const targetPinCat = getPinCategory(opt.id.split(':')[1], opt.description, opt.type);
              return hasCategoryIntersection(currentPinCat, targetPinCat);
            });

            const connectedWire = wires.find(w => w.from === pinIdStr || w.to === pinIdStr);
            let currentVal = '';
            if (connectedWire) {
              currentVal = connectedWire.from === pinIdStr ? connectedWire.to : connectedWire.from;
            }

            const pinPreferredColor = pendingPinColors[pinIdStr] || (connectedWire ? connectedWire.color : wireColor(pin.id));

            return (
              <div key={pin.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0, width: 44 }} title={pin.description || pin.id}>
                  {pin.id}
                </span>

                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    const picker = e.currentTarget.querySelector('input[type="color"]');
                    if (picker) picker.click();
                  }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: connectedWire ? 1 : 0.6, transition: 'all 0.2s ease', position: 'relative', padding: '0 4px', flexShrink: 0 }}
                  onMouseEnter={e => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.opacity = connectedWire ? '1' : '0.6';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  title={connectedWire ? 'Change wire color' : 'Set wire color before connecting'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={pinPreferredColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                  <input
                    type="color"
                    value={pinPreferredColor}
                    onChange={(e) => {
                      const newColor = e.target.value;
                      setPendingPinColors(prev => ({ ...prev, [pinIdStr]: newColor }));
                      if (connectedWire) {
                        updateWireColor(connectedWire.id, newColor);
                      }
                    }}
                    style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0, opacity: 0, padding: 0, border: 'none', pointerEvents: 'none' }}
                  />
                </div>

                <select
                  value={currentVal}
                  onChange={(e) => {
                    const selectedTarget = e.target.value;
                    setWires(prev => {
                      const toPinLabel = selectedTarget ? (selectedTarget.includes(':') ? selectedTarget.split(':').slice(1).join(':') : '') : '';
                      const finalColor = pendingPinColors[pinIdStr] || wireColor(toPinLabel);
                      const newWire = selectedTarget ? {
                        id: `w${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                        from: pinIdStr,
                        to: selectedTarget,
                        fromLabel: pin.id,
                        toLabel: toPinLabel,
                        color: finalColor,
                        waypoints: []
                      } : null;
                      const filtered = prev.filter(w => w.from !== pinIdStr && w.to !== pinIdStr);
                      setWireStart(null);
                      return newWire ? [...filtered, newWire] : filtered;
                    });
                  }}
                  style={{ flex: 1, minWidth: 0, padding: '3px 6px', background: 'var(--card)', border: '1px solid var(--border)', color: currentVal ? 'var(--accent)' : 'var(--text2)', borderRadius: 4, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer', outline: 'none' }}
                >
                  <option value="">Disconnected</option>
                  {filteredOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}

export const ComponentInspectorPanel = React.memo(ComponentInspectorPanelBase);