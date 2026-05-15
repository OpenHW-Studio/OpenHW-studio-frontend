import React from 'react';
import { Btn } from '../Btn';
import PlotterCanvas from '../PlotterCanvas';

const PLOTTER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c'];

export const PlotterToolbar = ({ onAddChannel, isPaused, onTogglePause, onClear, timeDiv, setTimeDiv }) => {
  return (
    <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', background: 'var(--bg2)', flexShrink: 0 }}>
      <button
        onClick={onAddChannel}
        style={{
          background: 'var(--accent)',
          color: '#000',
          border: 'none',
          borderRadius: 6,
          padding: '4px 12px',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}
        className="hover:brightness-110 active:scale-95 transition-all"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        Add Channel
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
        <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>Window:</span>
        <select
          value={timeDiv}
          onChange={(e) => setTimeDiv(Number(e.target.value))}
          style={{
            background: 'var(--bg3)',
            border: '1px solid var(--border)',
            color: 'var(--text2)',
            borderRadius: 4,
            fontSize: 10,
            padding: '2px 4px',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value={1}>1ms</option>
          <option value={10}>10ms</option>
          <option value={100}>100ms</option>
          <option value={500}>500ms</option>
          <option value={1000}>1000ms</option>
          <option value={2000}>2000ms</option>
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 10, borderLeft: '1px solid var(--border)' }}>
        <button
          onClick={onTogglePause}
          title={isPaused ? 'Resume' : 'Pause'}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isPaused ? 'var(--orange)' : 'var(--text3)', padding: 2, display: 'flex', alignItems: 'center' }}
        >
          {isPaused ? <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>}
        </button>
        <button
          onClick={onClear}
          title="Clear Plot"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 2, display: 'flex', alignItems: 'center' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
        </button>
      </div>
    </div>
  );
};

export const AddChannelPanel = ({ boardOptions, boardLabels, boardKinds, boardColors, selectedPins, setSelectedPins, onClose }) => {
  const boards = (boardOptions || []).filter(id => id !== 'all');
  const [selectedBoardId, setSelectedBoardId] = React.useState(boards[0] || null);

  const tabsRef = React.useRef(null);
  const [canScroll, setCanScroll] = React.useState({ left: false, right: false });

  const checkScroll = React.useCallback(() => {
    if (!tabsRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current;
    setCanScroll({
      left: scrollLeft > 2,
      right: scrollLeft + clientWidth < scrollWidth - 2
    });
  }, []);

  const scrollTabs = (direction) => {
    if (!tabsRef.current) return;
    const amount = 120;
    tabsRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth'
    });
  };

  const panelRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [onClose]);

  React.useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll, boards.length]);

  const UNO_BASE_PINS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
  const PICO_BASE_PINS = Array.from({ length: 29 }, (_, idx) => `GP${idx}`);

  const activeBoardId = selectedBoardId || boards[0];
  const activeKind = boardKinds[activeBoardId] || 'arduino_uno';
  const activePins = activeKind === 'rp2040' ? PICO_BASE_PINS : UNO_BASE_PINS;
  const activeBoardColor = boardColors[activeBoardId] || 'var(--accent)';

  return (
    <div ref={panelRef} style={{
      position: 'absolute', top: 42, left: 12, right: 12,
      maxHeight: 'calc(100% - 60px)',
      background: 'var(--bg1)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      zIndex: 150,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      animation: 'slideInPlotter 0.2s cubic-bezier(0,0,0.2,1)',
      backdropFilter: 'blur(20px)',
      boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)'
    }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg3)' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}><path d="M12 20v-6M6 20V10M18 20V4" /></svg>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text1)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Add Channel</span>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16 }} className="hover:text-[var(--red)] transition-colors">✕</button>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg2)',
        borderBottom: '1px solid var(--border)',
        height: 38,
        position: 'relative',
        padding: '0 4px'
      }}>
        {canScroll.left && (
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 24, zIndex: 2, background: 'linear-gradient(90deg, var(--bg2) 40%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
            <button onClick={() => scrollTabs('left')} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
          </div>
        )}

        <div
          ref={tabsRef}
          onScroll={checkScroll}
          className="panel-scroll"
          style={{
            display: 'flex',
            flex: 1,
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            padding: '4px 0'
          }}
        >
          {boards.map(id => (
            <button
              key={id}
              onClick={() => setSelectedBoardId(id)}
              style={{
                flexShrink: 0,
                padding: '4px 12px',
                margin: '0 2px',
                fontSize: 11,
                fontWeight: 700,
                color: activeBoardId === id ? 'var(--accent)' : 'var(--text3)',
                background: activeBoardId === id ? 'rgba(0,255,255,0.08)' : 'transparent',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              }}
            >
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: boardColors[id] || 'var(--text4)',
                boxShadow: activeBoardId === id ? `0 0 6px ${boardColors[id] || 'var(--text4)'}` : 'none'
              }} />
              {boardLabels[id] || id}
            </button>
          ))}
        </div>

        {canScroll.right && (
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 24, zIndex: 2, background: 'linear-gradient(-90deg, var(--bg2) 40%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <button onClick={() => scrollTabs('right')} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }} className="panel-scroll">
        {!activeBoardId ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
            No boards detected in circuit.
          </div>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(42px, 1fr))', gap: 6 }}>
              {activePins.map(pin => {
                const pinIdx = selectedPins.findIndex(p => p.boardId === activeBoardId && p.pinId === pin);
                const isSelected = pinIdx >= 0;

                const selectedColor = isSelected ? PLOTTER_COLORS[pinIdx % PLOTTER_COLORS.length] : 'var(--accent)';

                return (
                  <button
                    key={pin}
                    onClick={() => {
                      setSelectedPins(prev => {
                        if (isSelected) return prev.filter(p => p.boardId !== activeBoardId || p.pinId !== pin);
                        if (prev.length >= 12) return prev; // Limit channels
                        return [...prev, { boardId: activeBoardId, pinId: pin }];
                      });
                    }}
                    style={{
                      padding: '8px 2px',
                      fontSize: 10,
                      fontWeight: 700,
                      background: isSelected ? `${selectedColor}25` : 'rgba(255,255,255,0.02)',
                      color: isSelected ? selectedColor : 'var(--text3)',
                      border: `1px solid ${isSelected ? selectedColor : 'var(--border)'}`,
                      borderRadius: 6,
                      cursor: 'pointer',
                      transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: isSelected ? `inset 0 0 10px ${selectedColor}15` : 'none'
                    }}
                    className={isSelected ? '' : 'hover:border-[var(--text4)] hover:bg-white/5'}
                  >{pin}</button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInPlotter { from { opacity: 0; transform: translateY(-8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </div>
  );
};

export const PlotterManager = ({
  showAddChannel, setShowAddChannel,
  plotterPaused, setPlotterPaused,
  plotDataRef, selectedPlotPins, setSelectedPlotPins,
  plotterTimeDiv, setPlotterTimeDiv,
  serialBoardOptions, serialBoardLabels, serialBoardKinds,
  boardColors, theme, isRunning
}) => {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      <PlotterToolbar
        onAddChannel={() => setShowAddChannel(!showAddChannel)}
        isPaused={plotterPaused}
        onTogglePause={() => setPlotterPaused(!plotterPaused)}
        onClear={() => { if (plotDataRef.current) plotDataRef.current = []; }}
        timeDiv={plotterTimeDiv}
        setTimeDiv={setPlotterTimeDiv}
      />

      {showAddChannel && (
        <AddChannelPanel
          boardOptions={serialBoardOptions}
          boardLabels={serialBoardLabels}
          boardKinds={serialBoardKinds}
          boardColors={boardColors}
          selectedPins={selectedPlotPins}
          setSelectedPins={setSelectedPlotPins}
          onClose={() => setShowAddChannel(false)}
        />
      )}

      <div className="panel-scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
        <div style={{ display: 'flex', minHeight: '100%', width: '100%' }}>
          {selectedPlotPins.length > 0 && (
            <div style={{
              width: 65,
              background: 'var(--bg2)',
              borderRight: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
              zIndex: 2
            }}>
              {selectedPlotPins.map((chan, i) => {
                const color = PLOTTER_COLORS[i % PLOTTER_COLORS.length];
                const boardLabel = serialBoardLabels[chan.boardId] || chan.boardId;
                return (
                  <div key={`${chan.boardId}:${chan.pinId}`} style={{
                    height: 80,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderBottom: '1px solid var(--border)',
                    padding: '4px 2px',
                    gap: 3,
                    position: 'relative',
                    background: i % 2 === 1 ? 'rgba(255,255,255,0.01)' : 'transparent',
                    boxSizing: 'border-box'
                  }}>
                    <span style={{ fontSize: 9, color: 'var(--text4)', textTransform: 'lowercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'center' }} title={boardLabel}>
                      {boardLabel}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: color, fontFamily: 'JetBrains Mono, monospace' }}>
                      {chan.pinId}
                    </span>
                    <button
                      onClick={() => setSelectedPlotPins(prev => prev.filter(p => p.boardId !== chan.boardId || p.pinId !== chan.pinId))}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text4)', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                      className="hover:text-[var(--red)] transition-colors"
                      title="Remove channel"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <PlotterCanvas
            plotDataRef={plotDataRef}
            selectedPlotPins={selectedPlotPins}
            plotterPaused={plotterPaused}
            plotterTimeDiv={plotterTimeDiv}
            theme={theme}
            isRunning={isRunning}
          />
        </div>
      </div>
    </div>
  );
};
