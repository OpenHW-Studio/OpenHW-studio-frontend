import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const MAX_CONSOLE_ENTRIES = 1500;
const CONSOLE_OPEN_KEY = 'sim.console.open';
const CONSOLE_HEIGHT_KEY = 'sim.console.height';

function stringifyArg(arg) {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return arg.stack || arg.message || String(arg);
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function normalizeMessage(args) {
  if (!Array.isArray(args) || args.length === 0) return '';
  return args.map(stringifyArg).join(' ');
}

function shouldSkipEntry(message) {
  const text = String(message || '').toLowerCase();
  if (!text) return true;

  // Keep serial monitor stream out of this console.
  if (text.includes('serial monitor')) return true;
  if (text.includes('serialhistory')) return true;
  if (text.includes('serial_input')) return true;
  if (text.includes('pushserialrxchunk')) return true;

  return false;
}

function formatDownloadLine(entry) {
  const source = entry.source ? `[${entry.source}]` : '';
  return `${entry.ts} [${entry.level.toUpperCase()}] ${source} ${entry.message}`.trim();
}

export function TerminalIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <g fillRule="nonzero">
        <path d="M3,5.99406028 L3,18.0059397 C3,19.1054862 3.8932319,20 4.99508929,20 L19.0049107,20 C20.1073772,20 21,19.1072288 21,18.0059397 L21,5.99406028 C21,4.89451376 20.1067681,4 19.0049107,4 L4.99508929,4 C3.8926228,4 3,4.8927712 3,5.99406028 Z M1,5.99406028 C1,3.78785482 2.7884002,2 4.99508929,2 L19.0049107,2 C21.210775,2 23,3.78938161 23,5.99406028 L23,18.0059397 C23,20.2121452 21.2115998,22 19.0049107,22 L4.99508929,22 C2.78922499,22 1,20.2106184 1,18.0059397 L1,5.99406028 Z M5.26674525,11.6980752 C4.91108492,11.3097909 4.91108492,10.6902091 5.26674525,10.3019248 C5.63548778,9.89935839 6.24389719,9.89935839 6.61263972,10.3019248 L10,14 L6.61263972,17.6980752 C6.24389719,18.1006416 5.63548778,18.1006416 5.26674525,17.6980752 C4.91108492,17.3097909 4.91108492,16.6902091 5.26674525,16.3019248 L7.37526073,14 L5.26674525,11.6980752 Z M11,17 C11,16.4477153 11.4530363,16 11.9970301,16 L18.0029699,16 C18.5536144,16 19,16.4438648 19,17 C19,17.5522847 18.5469637,18 18.0029699,18 L11.9970301,18 C11.4463856,18 11,17.5561352 11,17 Z M3,6 L22,6 L22,8 L3,8 L3,6 Z" />
      </g>
    </svg>
  );
}

export function useSimulationConsole() {
  const [consoleEntries, setConsoleEntries] = useState([]);
  const [isConsoleOpen, setIsConsoleOpen] = useState(() => {
    try {
      return localStorage.getItem(CONSOLE_OPEN_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [consoleHeight, setConsoleHeight] = useState(() => {
    try {
      const v = Number(localStorage.getItem(CONSOLE_HEIGHT_KEY));
      if (Number.isFinite(v)) return Math.max(140, Math.min(540, v));
      return 220;
    } catch {
      return 220;
    }
  });

  const appendConsoleEntry = useCallback((level, message, source = 'app') => {
    const normalized = String(message || '').trim();
    if (!normalized || shouldSkipEntry(normalized)) return;

    const now = new Date();
    const ts = `${now.toTimeString().slice(0, 8)}.${String(now.getMilliseconds()).padStart(3, '0')}`;
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts,
      level: level || 'info',
      source,
      message: normalized,
    };

    setConsoleEntries((prev) => {
      const next = [...prev, entry];
      if (next.length > MAX_CONSOLE_ENTRIES) {
        return next.slice(next.length - MAX_CONSOLE_ENTRIES);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = (...args) => {
      originalLog(...args);
      appendConsoleEntry('info', normalizeMessage(args), 'console');
    };

    console.warn = (...args) => {
      originalWarn(...args);
      appendConsoleEntry('warn', normalizeMessage(args), 'console');
    };

    console.error = (...args) => {
      originalError(...args);
      appendConsoleEntry('error', normalizeMessage(args), 'console');
    };

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, [appendConsoleEntry]);

  useEffect(() => {
    try {
      localStorage.setItem(CONSOLE_OPEN_KEY, isConsoleOpen ? '1' : '0');
    } catch {
      // Ignore storage failures (private mode/quota).
    }
  }, [isConsoleOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(CONSOLE_HEIGHT_KEY, String(consoleHeight));
    } catch {
      // Ignore storage failures (private mode/quota).
    }
  }, [consoleHeight]);

  const clearConsoleEntries = useCallback(() => {
    setConsoleEntries([]);
  }, []);

  const downloadConsoleLog = useCallback(() => {
    const content = consoleEntries.map(formatDownloadLine).join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date();
    const stamp = now.toISOString().replace(/[.:]/g, '-');
    a.download = `simulation-console-${stamp}.log`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [consoleEntries]);

  return {
    consoleEntries,
    isConsoleOpen,
    setIsConsoleOpen,
    consoleHeight,
    setConsoleHeight,
    appendConsoleEntry,
    clearConsoleEntries,
    downloadConsoleLog,
  };
}

function levelColor(level) {
  if (level === 'error') return '#f87171';
  if (level === 'warn') return '#fbbf24';
  return 'var(--text2)';
}

export function SimulationConsolePanel({
  isOpen,
  height,
  entries,
  onResizeStart,
  onClose,
  onClear,
  onDownload,
}) {
  const bodyRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const [filterLevel, setFilterLevel] = useState('all'); // all | error | warn

  const counts = useMemo(() => {
    return entries.reduce((acc, entry) => {
      if (entry.level === 'error') acc.error += 1;
      if (entry.level === 'warn') acc.warn += 1;
      acc.all += 1;
      return acc;
    }, { all: 0, warn: 0, error: 0 });
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (filterLevel === 'all') return entries;
    return entries.filter((entry) => entry.level === filterLevel);
  }, [entries, filterLevel]);

  useEffect(() => {
    if (!isOpen || !bodyRef.current) return;
    if (!shouldAutoScrollRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [entries, isOpen]);

  const handleScroll = useCallback(() => {
    if (!bodyRef.current) return;
    const el = bodyRef.current;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 40;
  }, []);

  const emptyState = useMemo(() => {
    return (
      <div style={{ color: 'var(--text3)', fontSize: 12, padding: '14px 16px' }}>
        No logs yet. Actions like ZIP upload, compile, flashing, and Web Serial status will appear here.
      </div>
    );
  }, []);

  if (!isOpen) return null;

  return (
    <div
      data-export-ignore="true"
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 56,
        height,
        zIndex: 95,
        border: '1px solid var(--border)',
        borderRadius: 10,
        background: 'var(--bg2)',
        boxShadow: '0 10px 28px rgba(0,0,0,0.42)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        onMouseDown={onResizeStart}
        title="Drag to resize"
        style={{
          padding: '6px 12px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexShrink: 0,
          cursor: 'ns-resize',
          background: 'linear-gradient(180deg, var(--bg2), rgba(0,0,0,0.05))',
        }}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)' }} onMouseDown={e => e.stopPropagation()}>
          <TerminalIcon size={14} />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Console
          </span>
          <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace' }}>
            {filteredEntries.length}/{entries.length}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6 }}>
            {[
              { key: 'all', label: 'All', count: counts.all, color: 'var(--text2)' },
              { key: 'warn', label: 'Warnings', count: counts.warn, color: '#fbbf24' },
              { key: 'error', label: 'Errors', count: counts.error, color: '#f87171' },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setFilterLevel(item.key)}
                onMouseDown={e => e.stopPropagation()}
                style={{
                  border: '1px solid var(--border)',
                  background: filterLevel === item.key ? 'var(--card)' : 'transparent',
                  color: item.color,
                  borderRadius: 999,
                  padding: '2px 8px',
                  fontSize: 10,
                  cursor: 'pointer',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
                title={`Show ${item.label.toLowerCase()}`}
              >
                <span>{item.label}</span>
                <span style={{ color: 'var(--text3)' }}>{item.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onMouseDown={e => e.stopPropagation()}>
          <button
            onClick={onDownload}
            onMouseDown={e => e.stopPropagation()}
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--text2)',
              cursor: 'pointer',
              borderRadius: 6,
              fontSize: 11,
              padding: '4px 8px',
            }}
            title="Download log"
          >
            Download
          </button>
          <button
            onClick={onClear}
            onMouseDown={e => e.stopPropagation()}
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--text2)',
              cursor: 'pointer',
              borderRadius: 6,
              fontSize: 11,
              padding: '4px 8px',
            }}
            title="Clear console"
          >
            Clear
          </button>
          <button
            onClick={onClose}
            onMouseDown={e => e.stopPropagation()}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text2)',
              cursor: 'pointer',
              borderRadius: 6,
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            title="Close console"
            className="hover:bg-[var(--card)] hover:text-[var(--text)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,10.4834761 L7.83557664,6.31871006 C7.41207382,5.89517239 6.73224519,5.89425872 6.31350312,6.31303524 C5.89184166,6.7347314 5.89730155,7.41332336 6.31917747,7.83523399 L10.4836008,12 L6.31917747,16.164766 C5.89730155,16.5866766 5.89184166,17.2652686 6.31350312,17.6869648 C6.73224519,18.1057413 7.41207382,18.1048276 7.83557664,17.6812899 L12,13.5165239 L16.1644234,17.6812899 C16.5879262,18.1048276 17.2677548,18.1057413 17.6864969,17.6869648 C18.1081583,17.2652686 18.1026985,16.5866766 17.6808225,16.164766 L13.5163992,12 L17.6808225,7.83523399 C18.1026985,7.41332336 18.1081583,6.7347314 17.6864969,6.31303524 C17.2677548,5.89425872 16.5879262,5.89517239 16.1644234,6.31871006 L12,10.4834761 L12,10.4834761 Z" />
            </svg>
          </button>
        </div>
      </div>

      <div
        ref={bodyRef}
        onScroll={handleScroll}
        style={{
          overflowY: 'auto',
          flex: 1,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 12,
          background: 'var(--bg)',
        }}
      >
        {filteredEntries.length === 0 ? emptyState : filteredEntries.map((entry) => (
          <div
            key={entry.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 70px 1fr',
              gap: 10,
              padding: '6px 10px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              color: 'var(--text2)',
              alignItems: 'start',
            }}
          >
            <span style={{ color: 'var(--text3)' }}>{entry.ts}</span>
            <span style={{ color: levelColor(entry.level), textTransform: 'uppercase' }}>[{entry.level}]</span>
            <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text)' }}>{entry.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
