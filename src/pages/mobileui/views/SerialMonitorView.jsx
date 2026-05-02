import React from 'react';

export default function SerialMonitorView(props) {
  const {
    serialPaused,
    setSerialPaused,
    isRunning,
    serialHistory,
    setSerialHistory,
    serialOutputRef,
    serialInput,
    setSerialInput,
    sendSerialInput,
    clearSerialMonitor,
    serialViewMode,
    setSerialViewMode,
    serialBoardFilter,
    setSerialBoardFilter,
    serialBoardOptions,
    serialBoardLabels,
    serialBaudRate,
    setSerialBaudRate,
    serialBaudOptions,
    serialLineEnding,
    setSerialLineEnding,
    hardwareConnected,
    plotterPaused,
    setPlotterPaused,
    plotData,
    setPlotData,
    selectedPlotPins,
    setSelectedPlotPins,
    plotterCanvasRef,
    serialPlotLabelsRef,
    theme,
    serialBoardKinds,
    serialBoardSourceModes,
    serialSendTarget,
    setSerialSendTarget,
    showSendTargetMenu,
    setShowSendTargetMenu,
    sendMenuRef
  } = props;

  const filteredSerialHistory = React.useMemo(() => {
    return serialBoardFilter === 'all'
      ? serialHistory
      : serialHistory.filter((entry) => entry.boardId === serialBoardFilter);
  }, [serialBoardFilter, serialHistory]);

  const boardColors = React.useMemo(() => {
    const palette = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#14b8a6', '#eab308', '#06b6d4', '#8b5cf6'];
    const map = { all: '#94a3b8' };
    (serialBoardOptions || []).filter((id) => id !== 'all').forEach((id, idx) => {
      map[id] = palette[idx % palette.length];
    });
    return map;
  }, [serialBoardOptions]);

  const UNO_BASE_PINS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
  const PICO_BASE_PINS = Array.from({ length: 29 }, (_, idx) => `GP${idx}`);
  const getBasePinsForKind = (kind) => (kind === 'rp2040' ? PICO_BASE_PINS : UNO_BASE_PINS);

  const activeKinds = React.useMemo(() => {
    if (serialBoardFilter && serialBoardFilter !== 'all') {
      return [serialBoardKinds?.[serialBoardFilter] || 'arduino_uno'];
    }
    const kinds = new Set();
    (serialBoardOptions || []).forEach((id) => {
      if (id === 'all') return;
      kinds.add(serialBoardKinds?.[id] || 'arduino_uno');
    });
    if (kinds.size === 0) kinds.add('arduino_uno');
    return Array.from(kinds);
  }, [serialBoardFilter, serialBoardOptions, serialBoardKinds]);

  const basePins = React.useMemo(() => {
    const allPins = new Set();
    activeKinds.forEach((kind) => {
      getBasePinsForKind(kind).forEach((pin) => allPins.add(pin));
    });
    return Array.from(allPins);
  }, [activeKinds]);

  const serialOnlyLabels = (serialPlotLabelsRef.current || []).filter(l => !basePins.includes(l));
  const availablePins = [...basePins, ...serialOnlyLabels];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'var(--bg)', overflow: 'hidden' }}>
      {/* Serial panel toolbar */}
      <div className="px-2.5 py-1.5 border-b border-[var(--border)] bg-[var(--bg2)] shrink-0" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            width: 168,
            height: 26,
            borderRadius: 999,
            border: '1px solid var(--border)',
            background: 'var(--card)',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              top: 1,
              left: serialViewMode === 'monitor' ? 1 : '50%',
              width: 'calc(50% - 2px)',
              height: 22,
              borderRadius: 999,
              background: 'var(--accent)',
              transition: 'left .2s ease',
            }} />
            {['monitor', 'plotter'].map((mode) => (
              <button
                key={mode}
                onClick={() => setSerialViewMode(mode)}
                style={{
                  position: 'relative',
                  zIndex: 1,
                  border: 'none',
                  background: 'transparent',
                  color: serialViewMode === mode ? '#fff' : 'var(--text2)',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {mode}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Board</span>
          <select
            value={serialBoardFilter}
            onChange={(e) => setSerialBoardFilter(e.target.value)}
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--text2)',
              borderRadius: 6,
              padding: '2px 6px',
              fontSize: 11,
              cursor: 'pointer'
            }}
          >
            {serialBoardOptions.map((id) => (
              <option key={id} value={id}>
                {serialBoardLabels?.[id] || (id === 'all' ? 'All Boards' : id)}
              </option>
            ))}
          </select>

          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Baud</span>
          <select
            value={serialBaudRate}
            onChange={(e) => setSerialBaudRate(e.target.value)}
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--text2)',
              borderRadius: 6,
              padding: '2px 6px',
              fontSize: 11,
              cursor: 'pointer'
            }}
          >
            {(serialBaudOptions && serialBaudOptions.length ? serialBaudOptions : ['9600', '19200', '38400', '57600', '115200']).map((baud) => (
              <option key={baud} value={baud}>{baud}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
            color: (serialViewMode === 'monitor' ? serialPaused : plotterPaused) ? 'var(--text3)' : 'var(--green)'
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: (serialViewMode === 'monitor' ? serialPaused : plotterPaused) ? 'var(--text3)' : 'var(--green)',
              flexShrink: 0
            }} />
            {(serialViewMode === 'monitor' ? serialPaused : plotterPaused) ? 'Paused' : (isRunning || hardwareConnected) ? 'Live' : 'Idle'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace' }}>
            {serialViewMode === 'monitor' ? `${filteredSerialHistory.length} lines` : `${plotData.length} samples`}
          </span>
          <div style={{ flex: 1 }} />
          <button
            className="bg-transparent border border-[var(--border)] text-[var(--text2)] rounded-md px-2 py-0.5 text-[11px] cursor-pointer font-inherit whitespace-nowrap"
            onClick={() => serialViewMode === 'monitor' ? setSerialPaused(p => !p) : setPlotterPaused(p => !p)}
          >
            {(serialViewMode === 'monitor' ? serialPaused : plotterPaused) ? '▶ Resume' : '⏸ Pause'}
          </button>
          {serialViewMode === 'monitor' && (
            <select
              value={serialLineEnding || 'nl'}
              onChange={(e) => setSerialLineEnding(e.target.value)}
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                color: 'var(--text2)',
                borderRadius: 6,
                padding: '2px 6px',
                fontSize: 11,
                cursor: 'pointer'
              }}
            >
              <option value="nl">\n</option>
              <option value="crlf">\r\n</option>
              <option value="cr">\r</option>
              <option value="none">None</option>
            </select>
          )}
          <button
            className="bg-transparent border border-[var(--border)] text-[var(--text2)] rounded-md px-2 py-0.5 text-[11px] cursor-pointer font-inherit whitespace-nowrap" style={{ color: 'var(--red)', borderColor: 'rgba(255,68,68,0.3)' }}
            onClick={() => serialViewMode === 'monitor' ? (clearSerialMonitor ? clearSerialMonitor() : setSerialHistory([])) : setPlotData([])}
          >
            🗑 Clear
          </button>
        </div>
      </div>
      {serialViewMode === 'monitor' ? (
        <>
          <div ref={serialOutputRef} className="flex-1 overflow-y-auto py-1.5 flex flex-col panel-scroll" >
            {filteredSerialHistory.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 12, padding: '20px 0', textAlign: 'center' }}>
                {isRunning ? 'Waiting for serial output...' : 'Run the simulator to see serial output.'}
              </div>
            ) : (
              filteredSerialHistory.map((entry, i) => {
                const badgeColor = entry.dir === 'rx' ? '#2ecc71' : entry.dir === 'tx' ? '#3498db' : '#888';
                const badgeBg = entry.dir === 'rx' ? 'rgba(46,204,113,0.12)' : entry.dir === 'tx' ? 'rgba(52,152,219,0.12)' : 'rgba(128,128,128,0.12)';
                const boardColor = boardColors[entry.boardId] || '#64748b';
                return (
                  <div key={i} className="flex items-start gap-2 px-3 py-0.5 text-[11px] font-mono border-b border-[var(--border)]">
                    <span className="text-[var(--text3)] text-[10px] min-w-[84px] shrink-0 pt-[1px]" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: boardColor }} />
                      {entry.ts || ''}
                    </span>
                    <span className="inline-block text-[9px] font-bold rounded-[3px] px-1 py-[1px] shrink-0 mt-[1px]" style={{ color: badgeColor, background: badgeBg, border: `1px solid ${badgeColor}40` }}>
                      {entry.dir?.toUpperCase() || 'RX'}
                    </span>
                    <span style={{ flex: 1, color: entry.dir === 'tx' ? '#3498db' : entry.dir === 'sys' ? 'var(--text3)' : 'var(--green)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {entry.text}
                    </span>
                    <span style={{ color: 'var(--text3)', fontSize: 10, minWidth: 90, textAlign: 'right' }}>
                      {entry.boardId || '-'}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, padding: '8px 10px', borderTop: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg2)' }}>
            <input
              className="bg-[var(--card)] border border-[var(--border)] text-[var(--text)] px-2.5 py-1.5 rounded-lg text-xs outline-none font-inherit" style={{ flex: 1, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}
              placeholder="Send message to Arduino..."
              value={serialInput}
              onChange={e => setSerialInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  sendSerialInput(serialBoardFilter === 'all' ? serialSendTarget : serialBoardFilter);
                }
              }}
              disabled={!isRunning && !hardwareConnected}
            />
            <div ref={sendMenuRef} style={{ position: 'relative', display: 'inline-flex' }}>
              <button
                onClick={() => sendSerialInput(serialBoardFilter === 'all' ? serialSendTarget : serialBoardFilter)}
                disabled={(!isRunning && !hardwareConnected) || !serialInput.trim()}
                style={{
                  background: ((isRunning || hardwareConnected) && serialInput.trim()) ? 'var(--accent)' : 'transparent',
                  border: '1px solid var(--accent)',
                  borderRight: serialBoardFilter === 'all' ? 'none' : '1px solid var(--accent)',
                  color: ((isRunning || hardwareConnected) && serialInput.trim()) ? '#fff' : 'var(--text3)',
                  borderRadius: serialBoardFilter === 'all' ? '8px 0 0 8px' : '8px',
                  padding: '6px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: ((isRunning || hardwareConnected) && serialInput.trim()) ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                  transition: 'all .15s',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: boardColors[serialBoardFilter === 'all' ? serialSendTarget : serialBoardFilter] || '#94a3b8' }} />
                Send
              </button>

              {serialBoardFilter === 'all' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSendTargetMenu((v) => !v);
                  }}
                  disabled={!isRunning && !hardwareConnected}
                  style={{
                    background: ((isRunning || hardwareConnected) && serialInput.trim()) ? 'var(--accent)' : 'transparent',
                    border: '1px solid var(--accent)',
                    color: ((isRunning || hardwareConnected) && serialInput.trim()) ? '#fff' : 'var(--text3)',
                    borderRadius: '0 8px 8px 0',
                    padding: '6px 7px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: (!isRunning && !hardwareConnected) ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all .15s',
                    whiteSpace: 'nowrap'
                  }}
                >
                  ▾
                </button>
              )}

              {serialBoardFilter === 'all' && showSendTargetMenu && (
                <div 
                  className="canvas-menu"
                  onMouseLeave={() => setShowSendTargetMenu(false)}
                  style={{
                    position: 'absolute',
                    right: 0,
                    bottom: 'calc(100% + 6px)',
                    minWidth: 180,
                    background: theme === 'light' ? 'rgba(248, 250, 252, 1)' : 'rgba(13, 21, 37, 1)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                    padding: '5px',
                    zIndex: 10000,
                    fontFamily: "'Space Grotesk', sans-serif"
                  }}
                >
                  {(serialBoardOptions || []).filter((id) => id !== 'all').map((id) => {
                    const active = serialSendTarget === id;
                    return (
                      <button
                        key={`send-target-${id}`}
                        className="canvas-menu-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSerialSendTarget(id);
                          setShowSendTargetMenu(false);
                        }}
                        style={{
                          background: active ? 'rgba(0,255,255,0.08)' : 'transparent',
                          color: active ? 'var(--accent)' : 'var(--text2)',
                        }}
                      >
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: boardColors[id] || '#94a3b8' }} />
                        <span>{serialBoardLabels?.[id] || id}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>Pins:</span>
            {availablePins.map((pin, i) => {
              const isSel = selectedPlotPins.includes(pin);
              const isAna = pin.startsWith('A');
              const isLogic = basePins.includes(pin);
              let br = isAna ? '#3498db' : '#2ecc71';
              if (!isLogic) {
                const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c'];
                br = colors[i % colors.length];
              }
              return (
                <button
                  key={pin}
                  onClick={() => setSelectedPlotPins(prev => {
                    if (prev.includes(pin)) return prev.filter(p => p !== pin);
                    if (prev.length >= 8) return [...prev.slice(1), pin];
                    return [...prev, pin];
                  })}
                  style={{
                    background: isSel ? `${br}33` : 'transparent',
                    border: `1px solid ${isSel ? br : 'var(--border)'}`,
                    color: isSel ? br : 'var(--text3)',
                    borderRadius: 4, padding: '1px 5px', fontSize: 10, cursor: 'pointer'
                  }}
                >{pin}</button>
              );
            })}
          </div>

          {selectedPlotPins.length > 0 && (
            <div className="flex flex-wrap gap-y-1 gap-x-4 px-2.5 py-1 border-b border-[var(--border)] shrink-0">
              {selectedPlotPins.map((pin, i) => {
                let bg = pin.startsWith('A') ? '#3498db' : '#2ecc71';
                let lbl = `Pin ${pin}`;
                if (isNaN(parseInt(pin)) && !pin.startsWith('A')) {
                  const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c'];
                  const serialVars = selectedPlotPins.filter(p => isNaN(parseInt(p)) && !p.startsWith('A'));
                  bg = colors[serialVars.indexOf(pin) % colors.length];
                  lbl = pin;
                }
                return (
                  <span key={pin} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, cursor: 'pointer' }}
                    onClick={() => setSelectedPlotPins(prev => prev.filter(p => p !== pin))}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: bg, flexShrink: 0 }} />
                    <span style={{ color: 'var(--text2)', fontFamily: 'JetBrains Mono, monospace' }}>{lbl}</span>
                  </span>
                );
              })}
            </div>
          )}

          <div style={{ flex: 1, position: 'relative' }}>
            {!isRunning && plotData.length === 0 ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', gap: 8, fontSize: 13 }}>
                <span style={{ fontSize: 28 }}>📈</span>
                Run simulator to trace signals.
              </div>
            ) : (
              <canvas
                ref={plotterCanvasRef}
                width={800}
                height={600}
                style={{ position: 'absolute', width: '100%', height: '100%', background: '#070b14' }}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
