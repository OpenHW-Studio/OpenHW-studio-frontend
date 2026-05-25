import React from 'react';

export const SerialTabBar = ({
  activeBoard,
  otherActiveBoard,
  setBoard,
  isPaused,
  onTogglePause,
  autoscroll,
  onToggleAutoscroll,
  onClear,
  onToggleSplit,
  isSplit,
  boardOptions,
  boardColors,
  boardLabels,
  boardKinds
}) => {
  const boards = (boardOptions || []).filter(id => id !== 'all');
  const tabsRef = React.useRef(null);
  const [canScroll, setCanScroll] = React.useState({ left: false, right: false });
  const [isHovered, setIsHovered] = React.useState(false);

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
    const amount = 150;
    tabsRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth'
    });
  };

  React.useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll, boards.length]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '4px 8px 0',
        background: 'var(--bg2)',
        borderBottom: '1px solid var(--border)',
        height: 36,
        flexShrink: 0,
        position: 'relative'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        {isHovered && canScroll.left && (
          <button
            onClick={() => scrollTabs('left')}
            style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: 28,
              background: 'linear-gradient(to right, var(--bg2) 60%, transparent)',
              display: 'flex', alignItems: 'center', paddingLeft: 4, zIndex: 10,
              border: 'none', cursor: 'pointer', color: 'var(--accent)',
              animation: 'fadeIn 0.2s'
            }}
            className="hover:scale-110 transition-transform"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
        )}

        <div
          ref={tabsRef}
          onScroll={checkScroll}
          style={{ display: 'flex', gap: 2, flex: 1, overflowX: 'auto', scrollbarWidth: 'none' }}
          className="hide-scrollbar"
        >
          {boards.map(id => {
            const isActive = activeBoard === id;
            const isDisabled = otherActiveBoard === id;
            const boardColor = boardColors[id] || '#64748b';
            const kind = boardKinds?.[id] || 'arduino_uno';

            return (
              <button
                key={id}
                onClick={() => !isDisabled && setBoard(id)}
                disabled={isDisabled}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  fontSize: 11,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--accent)' : isDisabled ? 'var(--text4)' : 'var(--text2)',
                  background: isActive ? 'rgba(0,255,255,0.08)' : 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                  opacity: isDisabled ? 0.4 : 1,
                  fontFamily: 'JetBrains Mono, monospace'
                }}
              >
                <span style={{
                  width: 7,
                  height: 7,
                  borderRadius: kind === 'rp2040' ? '1px' : '50%',
                  background: boardColor,
                  boxShadow: isActive ? `0 0 6px ${boardColor}` : 'none'
                }} />
                {boardLabels?.[id] || id}
              </button>
            );
          })}
        </div>

        {isHovered && canScroll.right && (
          <button
            onClick={() => scrollTabs('right')}
            style={{
              position: 'absolute', right: 0, top: 0, bottom: 0, width: 28,
              background: 'linear-gradient(to left, var(--bg2) 60%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 4, zIndex: 10,
              border: 'none', cursor: 'pointer', color: 'var(--accent)',
              animation: 'fadeIn 0.2s'
            }}
            className="hover:scale-110 transition-transform"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 8, borderLeft: '1px solid var(--border)', marginLeft: 2 }}>
        <button
          onClick={() => onToggleAutoscroll(!autoscroll)}
          style={{
            background: autoscroll ? 'rgba(0, 255, 255, 0.08)' : 'transparent',
            border: `1px solid ${autoscroll ? 'var(--accent)' : 'var(--border)'}`,
            color: autoscroll ? 'var(--accent)' : 'var(--text3)',
            padding: '3px 8px',
            borderRadius: 4,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            transition: 'all 0.2s',
            userSelect: 'none',
            marginRight: 4
          }}
          className="hover:border-[var(--accent)]"
        >
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Autoscroll</span>
        </button>

        <button
          onClick={onTogglePause}
          title={isPaused ? 'Resume' : 'Pause'}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, borderRadius: 4,
            color: isPaused ? 'var(--orange)' : 'var(--text3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          className="hover:bg-white/5"
        >
          {isPaused ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
          )}
        </button>

        <button
          onClick={onClear}
          title="Clear Output"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, borderRadius: 4,
            color: 'var(--red)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          className="hover:bg-[rgba(255,68,68,0.1)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </button>

        <button
          onClick={onToggleSplit}
          title={isSplit ? 'Single View' : 'Split View'}
          style={{
            background: isSplit ? 'rgba(0,255,255,0.1)' : 'transparent',
            border: `1px solid ${isSplit ? 'var(--accent)' : 'transparent'}`,
            cursor: 'pointer', padding: 2, borderRadius: 4,
            color: isSplit ? 'var(--accent)' : 'var(--text3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          className="hover:bg-white/5"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="3" y1="12" x2="21" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export const SerialOutputPane = ({ boardId, history, outputRef, isPaused, boardColors, isRunning }) => {
  const filtered = boardId === 'all' ? history : history.filter(e => e.boardId === boardId);

  return (
    <div ref={outputRef} className="flex-1 overflow-y-auto py-1.5 flex flex-col panel-scroll" style={{ background: 'var(--bg)' }}>
      {filtered.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 12, padding: '40px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 24, opacity: 0.5 }}>📡</span>
          {isRunning ? `Waiting for serial output from ${boardId}...` : 'Start simulation to see serial output.'}
        </div>
      ) : (
        filtered.map((entry, i) => {
          const badgeColor = entry.dir === 'rx' ? '#2ecc71' : entry.dir === 'tx' ? '#3498db' : '#888';
          const badgeBg = entry.dir === 'rx' ? 'rgba(46,204,113,0.12)' : entry.dir === 'tx' ? 'rgba(52,152,219,0.12)' : 'rgba(128,128,128,0.12)';
          const boardColor = boardColors[entry.boardId] || '#64748b';
          return (
            <div key={i} className="flex items-start gap-2 px-3 py-0.5 text-[11px] font-mono border-b border-[var(--border)] hover:bg-white/[0.02] transition-colors">
              <span className="text-[var(--text3)] text-[10px] min-w-[84px] shrink-0 pt-[1px]" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: boardColor }} />
                {entry.ts || ''}
              </span>
              <span className="inline-block text-[8px] font-bold rounded-[3px] px-1 py-[0px] shrink-0 mt-[2px] leading-tight" style={{ color: badgeColor, background: badgeBg, border: `1px solid ${badgeColor}40` }}>
                {entry.dir?.toUpperCase() || 'RX'}
              </span>
              <span style={{ flex: 1, color: entry.dir === 'tx' ? '#3498db' : entry.dir === 'sys' ? 'var(--text3)' : 'var(--green)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {entry.text}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
};

export const BaudRateSelector = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = React.useRef(null);
  const options = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 74880, 115200, 230400, 250000, 500000, 1000000, 2000000];

  React.useEffect(() => {
    const handleClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6,
          padding: '6px 10px', fontSize: 11, color: 'var(--text2)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s', minWidth: 80,
          fontFamily: 'JetBrains Mono, monospace'
        }}
        className="hover:border-[var(--accent)]"
      >
        <span style={{ flex: 1, textAlign: 'left' }}>{value}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {isOpen && (
        <div style={{
          position: 'absolute', bottom: '100%', right: 0, marginBottom: 8, width: 100,
          background: 'rgba(20, 20, 25, 0.85)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 8,
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 1000, overflow: 'hidden'
        }}>
          {options.map(opt => (
            <div
              key={opt}
              onClick={() => { onChange(opt); setIsOpen(false); }}
              style={{
                padding: '8px 12px', fontSize: 11, color: value === opt ? 'var(--accent)' : 'var(--text2)',
                cursor: 'pointer', background: value === opt ? 'rgba(0,255,255,0.08)' : 'transparent',
                fontFamily: 'JetBrains Mono, monospace'
              }}
              className="hover:bg-white/5"
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const LineEndingSelector = ({ value, onChange, theme }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [hoveredIdx, setHoveredIdx] = React.useState(null);
  const menuRef = React.useRef(null);

  const options = [
    { label: 'No line ending', value: 'none' },
    { label: 'Newline', value: 'nl' },
    { label: 'Carriage return', value: 'cr' },
    { label: 'Both NL & CR', value: 'crlf' }
  ];

  const currentOption = options.find(o => o.value === value) || options[1];

  React.useEffect(() => {
    const handleDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handleDown);
    return () => document.removeEventListener('mousedown', handleDown);
  }, [isOpen]);

  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          color: 'var(--text2)',
          padding: '6px 14px',
          fontSize: 10,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          borderRadius: 20,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 0.2s',
          fontFamily: "'Space Grotesk', sans-serif"
        }}
        className="hover:text-[var(--accent)] hover:border-[var(--accent)]"
      >
        {currentOption.label}
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 8px)',
          right: 0,
          background: theme === 'light' ? 'rgba(248, 250, 252, 0.95)' : 'rgba(13, 21, 37, 0.94)',
          backdropFilter: 'blur(16px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
          border: theme === 'light' ? '1px solid rgba(203, 213, 225, 0.8)' : '1px solid rgba(30, 45, 71, 0.8)',
          borderRadius: 12,
          boxShadow: theme === 'light' ? '0 8px 32px rgba(0, 0, 0, 0.08)' : '0 10px 40px rgba(0,0,0,0.5)',
          zIndex: 1000,
          minWidth: 160,
          overflow: 'hidden',
          padding: '5px',
          fontFamily: "'Space Grotesk', sans-serif",
          animation: 'serialMenuIn 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transformOrigin: 'bottom right'
        }}>
          {options.map((opt, idx) => (
            <div
              key={opt.value}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                padding: '8px 14px',
                fontSize: 12,
                fontWeight: value === opt.value ? 600 : 500,
                color: value === opt.value ? 'var(--text)' : 'var(--text2)',
                background: hoveredIdx === idx ? 'var(--bg3)' : (value === opt.value ? 'rgba(52, 152, 219, 0.1)' : 'transparent'),
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: 8,
                margin: '1px 0'
              }}
            >
              {opt.label}
              {value === opt.value && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
              )}
            </div>
          ))}
        </div>
      )}
      <style>{`
        @keyframes serialMenuIn {
          from { opacity: 0; transform: translateY(10px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};

export const SerialSendRow = ({
  boardId, input, setInput, onSend, isRunning, hardwareConnected,
  serialLineEnding, setSerialLineEnding, serialBaudRate, setSerialBaudRate,
  boardLabels, theme
}) => {
  return (
    <div style={{ display: 'flex', gap: 6, padding: '8px 10px', borderTop: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg2)', alignItems: 'center' }}>
      <input
        className="bg-[var(--card)] border border-[var(--border)] text-[var(--text)] outline-none font-inherit"
        style={{
          flex: 1,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          transition: 'border-color 0.2s',
          borderRadius: 6,
          padding: '6px 14px'
        }}
        placeholder={`Send to ${boardLabels?.[boardId] || boardId}...`}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') onSend(boardId, input, serialLineEnding, serialBaudRate);
        }}
        disabled={!isRunning && !hardwareConnected}
      />
      <LineEndingSelector value={serialLineEnding} onChange={setSerialLineEnding} theme={theme} />
      <BaudRateSelector value={serialBaudRate} onChange={setSerialBaudRate} />
      <button
        onClick={() => onSend(boardId, input, serialLineEnding, serialBaudRate)}
        disabled={!isRunning && !hardwareConnected}
        style={{
          background: (isRunning || hardwareConnected) ? 'var(--accent)' : 'var(--bg3)',
          color: (isRunning || hardwareConnected) ? '#000' : 'var(--text4)',
          border: 'none',
          cursor: (isRunning || hardwareConnected) ? 'pointer' : 'not-allowed',
          padding: '6px 20px',
          borderRadius: 10,
          fontSize: 11,
          fontWeight: 800,
          transition: 'all 0.2s',
          fontFamily: "'Space Grotesk', sans-serif",
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}
        className="hover:opacity-90 active:scale-95"
      >
        Send
      </button>
    </div>
  );
};
