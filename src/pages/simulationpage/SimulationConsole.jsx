import React, { useCallback, useEffect, useMemo, useRef, useState, startTransition } from 'react';

const MAX_CONSOLE_ENTRIES = 1500;
const CONSOLE_OPEN_KEY = 'sim.console.open';
const CONSOLE_HEIGHT_KEY = 'sim.console.height';

function stringifyArg(arg) {
  if (typeof arg === 'string') return arg;
  if (arg === null) return 'null';
  if (arg === undefined) return 'undefined';

  if (arg instanceof Error) {
    return `Error: ${arg.name}: ${arg.message}\nStack: ${arg.stack}`;
  }
  
  if (typeof arg === 'object') {
    if ('message' in arg && 'filename' in arg) {
       return `ErrorEvent: ${arg.message} at ${arg.filename}:${arg.lineno}:${arg.colno}`;
    }
    
    if (arg instanceof Event || (arg.type && 'isTrusted' in arg)) {
       return `Event: ${arg.type} (target: ${arg.target?.constructor?.name || 'unknown'})`;
    }

    try {
      return JSON.stringify(arg, (key, value) => {
        if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
        if (value instanceof Event) return { type: value.type, isTrusted: value.isTrusted };
        return value;
      }, 2);
    } catch (e) {
      return `[Object: ${arg.constructor?.name || 'Object'}]`;
    }
  }

  return String(arg);
}

function normalizeMessage(args) {
  if (!Array.isArray(args) || args.length === 0) return '';
  return args.map(stringifyArg).join(' ');
}

function shouldSkipEntry(message) {
  const text = String(message || '').toLowerCase();
  if (!text) return true;

  if (text.includes('serial monitor')) return true;
  if (text.includes('serialhistory')) return true;
  if (text.includes('serial_input')) return true;
  if (text.includes('pushserialrxchunk')) return true;
  if (text.includes('[latency trace]')) return true;
  if (text.includes('[worker] received interact')) return true;
  if (text.includes('emit_trace')) return true;
  if (text.includes('fps browser')) return true;
  if (text.includes('lag ')) return true;

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
  const pendingEntriesRef = useRef([]);
  const flushTimerRef = useRef(null);
  const [isConsoleOpen, setIsConsoleOpen] = useState(() => {
    try {
      return localStorage.getItem(CONSOLE_OPEN_KEY) === '1';
    } catch (e) {
      return false;
    }
  });
  const [consoleHeight, setConsoleHeight] = useState(() => {
    try {
      const v = Number(localStorage.getItem(CONSOLE_HEIGHT_KEY));
      if (Number.isFinite(v)) return Math.max(140, Math.min(540, v));
      return 220;
    } catch (e) {
      return 220;
    }
  });

  const appendConsoleEntry = useCallback((level, message, source = 'app', details = null, compId = null, compType = null) => {
    const normalized = String(message || '').trim();
    if (!normalized || shouldSkipEntry(normalized)) return;
    if (source === 'debug' && !isConsoleOpen) return;

    const now = new Date();
    const ts = `${now.toTimeString().slice(0, 8)}.${String(now.getMilliseconds()).padStart(3, '0')}`;
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts,
      level: level || 'info',
      source,
      message: normalized,
      details,
      compId,
      compType,
    };

    pendingEntriesRef.current.push(entry);
    if (flushTimerRef.current !== null) return;

    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      const pending = pendingEntriesRef.current;
      if (pending.length === 0) return;
      pendingEntriesRef.current = [];
      
      // Limit batch size to avoid dropping frames on heavy logs
      const batch = pending.length > 500 ? pending.slice(-500) : pending;
      
      startTransition(() => {
        setConsoleEntries((prev) => {
          const next = [...prev, ...batch];
          if (next.length > MAX_CONSOLE_ENTRIES) {
            return next.slice(next.length - MAX_CONSOLE_ENTRIES);
          }
          return next;
        });
      });
    }, 100);
  }, [isConsoleOpen]);

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
    } catch (e) {
      // Ignore storage failures
    }
  }, [isConsoleOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(CONSOLE_HEIGHT_KEY, String(consoleHeight));
    } catch (e) {
      // Ignore storage failures
    }
  }, [consoleHeight]);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current !== null) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    };
  }, []);

  const clearConsoleEntries = useCallback((tab) => {
    if (tab === 'console') {
      setConsoleEntries(prev => prev.filter(e => e.source === 'telemetry'));
    } else if (tab === 'telemetry') {
      setConsoleEntries(prev => prev.filter(e => e.source !== 'telemetry'));
    } else {
      setConsoleEntries([]);
    }
  }, []);

  const downloadConsoleLog = useCallback((tab, protocolLogs = [], telemetryMode = 'detail', format = 'json') => {
    const allEntries = [...consoleEntries, ...pendingEntriesRef.current];
    const now = new Date();
    const stamp = now.toISOString().replace(/[.:]/g, '-');

    if (tab === 'telemetry' && format === 'log') {
      const telemetryEntries = allEntries.filter(e => e.source === 'telemetry');
      const content = telemetryEntries.map(e => `${e.ts} ${e.compId || e.compType || 'COMP'} ${e.message.replace('[Telemetry] ', '')}`).join('\n');
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `simulation-telemetry-${stamp}.log`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } else if (tab === 'telemetry') {
      const telemetryEntries = allEntries.filter(e => e.source === 'telemetry').map(e => ({
        id: e.id,
        timestamp: e.ts,
        summary: e.message.replace('[Telemetry] ', ''),
        details: e.details
      }));

      const payload = {
        timestamp: now.toISOString(),
        telemetryMode,
        totalTelemetryEntries: telemetryEntries.length,
        totalProtocolLogs: protocolLogs.length,
        protocolLogs,
        telemetryEntries
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `simulation-telemetry-protocol-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } else {
      const systemEntries = allEntries.filter(e => e.source !== 'telemetry');
      const content = systemEntries.map(formatDownloadLine).join('\n');
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `simulation-console-${stamp}.log`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
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
  entries = [],
  activeTab = 'console',
  onTabChange,
  protocolLogs = [],
  componentTelemetryEnabled,
  setComponentTelemetryEnabled,
  telemetryMode = 'detail',
  setTelemetryMode,
  telemetrySampleInterval = 250,
  setTelemetrySampleInterval,
  selectedTelemetryComponentIds = [],
  onOpenTelemetryModal,
  onResizeStart,
  onClose,
  onClear,
  onDownload,
  onDownloadLog,
}) {
  const bodyRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const [filterLevel, setFilterLevel] = useState('all'); // all | error | warn
  const [expandedDetails, setExpandedDetails] = useState({});
  const [showBusTraffic, setShowBusTraffic] = useState(false);

  const toggleDetail = (id) => {
    setExpandedDetails(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const counts = useMemo(() => {
    return entries.reduce((acc, entry) => {
      if (entry.level === 'error') acc.error += 1;
      if (entry.level === 'warn') acc.warn += 1;
      acc.all += 1;
      return acc;
    }, { all: 0, warn: 0, error: 0 });
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (filterLevel === 'all') return entries.filter(e => e.source !== 'telemetry');
    return entries.filter((entry) => entry.level === filterLevel && entry.source !== 'telemetry');
  }, [entries, filterLevel]);

  const telemetryEntries = useMemo(() => {
    return entries.filter(e => e.source === 'telemetry');
  }, [entries]);

  useEffect(() => {
    if (!isOpen || !bodyRef.current) return;
    if (!shouldAutoScrollRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [entries, protocolLogs, isOpen, activeTab]);

  const handleScroll = useCallback(() => {
    if (!bodyRef.current) return;
    const el = bodyRef.current;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 40;
  }, []);

  const emptyState = useMemo(() => {
    if (activeTab === 'telemetry') {
      return (
        <div style={{ color: 'var(--text3)', fontSize: 12, padding: '14px 16px' }}>
          No protocol bus traffic or component telemetry available. Enable telemetry and select components, or trigger bus activity to begin monitoring.
        </div>
      );
    }
    return (
      <div style={{ color: 'var(--text3)', fontSize: 12, padding: '14px 16px' }}>
        No logs yet. Actions like ZIP upload, compile, flashing, and Web Serial status will appear here.
      </div>
    );
  }, [activeTab]);

  if (!isOpen) return null;

  return (
    <div
      data-export-ignore="true"
      data-simulation-console="true"
      onWheelCapture={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 56,
        height: `var(--console-height, ${height}px)`,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }} onMouseDown={e => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TerminalIcon size={14} />
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text)' }}>
              Console
            </span>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg)', padding: 2, borderRadius: 8, border: '1px solid var(--border)' }}>
            {[
              { key: 'console', label: 'System Logs' },
              { key: 'telemetry', label: 'Telemetry & Protocol' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => startTransition(() => onTabChange?.(tab.key))}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: activeTab === tab.key ? 700 : 500,
                  background: activeTab === tab.key ? 'var(--card)' : 'transparent',
                  color: activeTab === tab.key ? 'var(--text)' : 'var(--text3)',
                  border: activeTab === tab.key ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab-specific sub-toolbars */}
          {activeTab === 'console' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {[
                { key: 'all', label: 'All', count: counts.all, color: 'var(--text2)' },
                { key: 'warn', label: 'Warnings', count: counts.warn, color: '#fbbf24' },
                { key: 'error', label: 'Errors', count: counts.error, color: '#f87171' },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setFilterLevel(item.key)}
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
                >
                  <span>{item.label}</span>
                  <span style={{ color: 'var(--text3)' }}>{item.count}</span>
                </button>
              ))}
            </div>
          )}

          {activeTab === 'telemetry' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text2)' }}>
                <span>Mode:</span>
                <select
                  value={telemetryMode}
                  onChange={(e) => setTelemetryMode?.(e.target.value)}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    borderRadius: 6,
                    padding: '2px 6px',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  <option value="simple">Simple</option>
                  <option value="detail">Detail</option>
                  <option value="delta">Delta</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text2)' }}>
                <span>Interval:</span>
                <select
                  value={telemetrySampleInterval}
                  onChange={(e) => setTelemetrySampleInterval?.(Number(e.target.value))}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    borderRadius: 6,
                    padding: '2px 6px',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  <option value={100}>100ms</option>
                  <option value={250}>250ms</option>
                  <option value={500}>500ms</option>
                  <option value={1000}>1000ms</option>
                </select>
              </div>

              <button
                onClick={onOpenTelemetryModal}
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  borderRadius: 6,
                  padding: '2px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                className="hover:border-[var(--accent)] transition-colors"
              >
                <span>+ Add Component Telemetry</span>
                <span style={{ background: 'var(--accent)', color: 'white', padding: '0 5px', borderRadius: 10, fontSize: 10 }}>
                  {selectedTelemetryComponentIds?.length || 0}
                </span>
              </button>

              <button
                onClick={() => setShowBusTraffic(!showBusTraffic)}
                style={{
                  background: showBusTraffic ? '#facc15' : 'var(--card)',
                  color: showBusTraffic ? '#422006' : 'var(--text3)',
                  border: showBusTraffic ? '1px solid #eab308' : '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '2px 8px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                Show Bus Traffic: {showBusTraffic ? 'ON' : 'OFF'}
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onMouseDown={e => e.stopPropagation()}>
          {activeTab === 'telemetry' && (
            <button
              onClick={onDownloadLog}
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                color: 'var(--text2)',
                cursor: 'pointer',
                borderRadius: 6,
                padding: '4px 6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Download telemetry lines (.log)"
              className="hover:border-[var(--accent)] hover:text-[var(--text)] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <polyline points="9 15 12 18 15 15" />
              </svg>
            </button>
          )}
          <button
            onClick={onDownload}
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--text2)',
              cursor: 'pointer',
              borderRadius: 6,
              padding: '4px 6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={activeTab === 'telemetry' ? "Download telemetry report (.json)" : "Download system logs (.log)"}
            className="hover:border-[var(--accent)] hover:text-[var(--text)] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          <button
            onClick={onClear}
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--text2)',
              cursor: 'pointer',
              borderRadius: 6,
              padding: '4px 6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Clear console"
            className="hover:border-[var(--accent)] hover:text-[var(--text)] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
          <button
            onClick={onClose}
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
            }}
            title="Close console"
            className="hover:bg-[var(--card)] hover:text-[var(--text)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,10.4834761 L7.83557664,6.31871006 C7.41207382,5.89517239 6.73224519,5.89425872 6.31350312,6.31303524 C5.89184166,6.7347314 5.89730155,7.41332336 6.31917747,7.83523399 L10.4836008,12 L6.31917747,16.164766 C5.89730155,16.5866766 5.89184166,17.2652686 6.31350312,17.6869648 C6.73224519,18.1057413 7.41207382,18.1048276 7.83557664,17.6812899 L12,13.5165239 L16.1644234,17.6812899 C16.5879262,18.1048276 17.2677548,18.1057413 17.6864969,17.6869648 C18.1081583,17.2652686 18.1026985,16.5866766 17.6808225,16.164766 L13.5163992,12 L17.6808225,7.83523399 C18.1026985,7.41332336 18.1081583,6.7347314 17.6864969,6.31303524 C17.2677548,5.89425872 16.5879262,5.89517239 16.1644234,6.31871006 L12,10.4834761 L12,10.4834761 Z" />
            </svg>
          </button>
        </div>
      </div>

      <div
        ref={bodyRef}
        className="custom-scrollbar hide-horizontal-scrollbar"
        onScroll={handleScroll}
        onWheel={(e) => e.stopPropagation()}
        style={{
          overflowY: 'auto',
          overflowX: 'auto',
          position: 'relative',
          willChange: 'scroll-position',
          flex: 1,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 12,
          background: 'var(--bg)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
          <tbody>
            {activeTab === 'console' && (
              filteredEntries.length === 0 ? (
                <tr><td style={{ padding: 20 }}>{emptyState}</td></tr>
              ) : filteredEntries.slice(-200).map((entry) => (
                <tr
                  key={entry.id}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    color: 'var(--text2)',
                    verticalAlign: 'top',
                  }}
                >
                  <td 
                    style={{ 
                      padding: '6px 10px',
                      position: 'sticky', 
                      left: 0, 
                      background: 'var(--bg)', 
                      zIndex: 2,
                      whiteSpace: 'nowrap',
                      width: 190,
                      willChange: 'transform',
                      transform: 'translate3d(0, 0, 0)',
                    }}
                  >
                    <span style={{ color: 'var(--text3)', display: 'inline-block', width: 110 }}>{entry.ts}</span>
                    <span style={{ color: levelColor(entry.level), textTransform: 'uppercase', display: 'inline-block', width: 60, marginLeft: 10 }}>[{entry.level}]</span>
                  </td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', color: 'var(--text)', width: '100%' }}>
                    {entry.message}
                  </td>
                </tr>
              ))
            )}

            {activeTab === 'telemetry' && (
              protocolLogs.length === 0 && telemetryEntries.length === 0 ? (
                <tr><td style={{ padding: 20 }}>{emptyState}</td></tr>
              ) : (
                <>
                  {showBusTraffic && protocolLogs.map((log, i) => {
                    const busName = log.startsWith('I2C') ? 'I2C Bus' : log.startsWith('SPI') ? 'SPI Bus' : 'Bus Traffic';
                    return (
                      <tr
                        key={`proto-${i}`}
                        style={{
                          borderBottom: '1px solid rgba(250, 204, 21, 0.3)',
                          background: 'rgba(250, 204, 21, 0.15)',
                          color: 'var(--text)',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: 11,
                        }}
                      >
                        <td
                          style={{
                            padding: '8px 12px',
                            position: 'sticky',
                            left: 0,
                            background: '#151923',
                            zIndex: 2,
                            whiteSpace: 'nowrap',
                            width: 190,
                            willChange: 'transform',
                            transform: 'translate3d(0, 0, 0)',
                          }}
                        >
                          <span
                            title={busName}
                            style={{
                              background: 'var(--card)',
                              border: '1px solid rgba(250, 204, 21, 0.5)',
                              padding: '2px 8px',
                              borderRadius: 6,
                              color: '#ca8a04',
                              fontWeight: 700,
                              fontSize: 11,
                              width: 90,
                              maxWidth: 90,
                              textAlign: 'center',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'inline-block',
                              boxSizing: 'border-box',
                            }}
                          >
                            {busName}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 600, whiteSpace: 'nowrap', width: '100%' }}>
                          {log}
                        </td>
                      </tr>
                    );
                  })}

                  {telemetryEntries.slice(-200).map((entry) => {
                    const isExpanded = !!expandedDetails[entry.id];
                    const io = entry.details?.metrics?.ioThroughput;
                    const hasIo = showBusTraffic && io && (io.i2cTransactions > 0 || io.spiTransactions > 0);
                    const compDisplayName = entry.compId || 'COMP';
                    return (
                      <React.Fragment key={entry.id}>
                        <tr
                          style={{
                            borderBottom: (hasIo || (isExpanded && entry.details)) ? 'none' : '1px solid var(--border)',
                            background: 'var(--bg)',
                            verticalAlign: 'top',
                          }}
                        >
                          <td 
                            style={{ 
                              padding: '8px 12px',
                              position: 'sticky', 
                              left: 0, 
                              background: 'var(--bg)', 
                              zIndex: 2, 
                              whiteSpace: 'nowrap',
                              width: 190,
                              willChange: 'transform',
                              transform: 'translate3d(0, 0, 0)',
                            }}
                          >
                            <span style={{ color: 'var(--text3)', fontSize: 11, display: 'inline-block', width: 80 }}>{entry.ts}</span>
                            <span
                              title={`${compDisplayName} (Click to ${isExpanded ? 'collapse' : 'expand'})`}
                              onClick={() => toggleDetail(entry.id)}
                              style={{
                                background: 'var(--card)',
                                border: '1px solid var(--border)',
                                padding: '2px 8px',
                                borderRadius: 6,
                                color: 'var(--accent)',
                                fontWeight: 700,
                                fontSize: 11,
                                width: 90,
                                maxWidth: 90,
                                textAlign: 'center',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'inline-block',
                                boxSizing: 'border-box',
                                cursor: 'pointer',
                                marginLeft: 10,
                              }}
                              className="hover:border-[var(--accent)] transition-colors"
                            >
                              {compDisplayName}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', color: 'var(--text)', fontWeight: 600, whiteSpace: 'nowrap', width: '100%' }}>
                            {entry.message.replace('[Telemetry] ', '')}
                          </td>
                        </tr>

                        {(hasIo || (isExpanded && entry.details)) && (
                          <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                            <td 
                              style={{ 
                                padding: '0 12px 8px 12px',
                                position: 'sticky', 
                                left: 0, 
                                background: 'var(--bg)', 
                                zIndex: 2,
                                willChange: 'transform',
                                transform: 'translate3d(0, 0, 0)',
                              }}
                            ></td>
                            <td style={{ padding: '0 12px 8px 12px', width: '100%' }}>
                              {hasIo && (
                                <div style={{ background: 'rgba(250, 204, 21, 0.08)', border: '1px solid rgba(250, 204, 21, 0.25)', borderRadius: 8, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>
                                    <span style={{ color: '#ca8a04' }}>🏷️ I/O Throughput</span>
                                    {io.i2cTransactions > 0 && (
                                      <span>I2C: {io.i2cTransactions} tx ({io.i2cBytes || 0} bytes)</span>
                                    )}
                                    {io.spiTransactions > 0 && (
                                      <span>SPI: {io.spiTransactions} tx ({io.spiBytes || 0} bytes)</span>
                                    )}
                                  </div>
                                  {(io.recentI2c?.length > 0 || io.recentSpi?.length > 0) && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text2)', background: 'rgba(250, 204, 21, 0.12)', padding: '4px 8px', borderRadius: 4, overflowX: 'auto', border: '1px solid rgba(250, 204, 21, 0.15)' }}>
                                      <span style={{ color: '#ca8a04', fontWeight: 700 }}>Recent Buffers:</span>
                                      {io.recentI2c?.length > 0 && (
                                        <span>I2C [{io.recentI2c.map(b => `0x${b.toString(16).padStart(2, '0').toUpperCase()}`).join(' ')}]</span>
                                      )}
                                      {io.recentSpi?.length > 0 && (
                                        <span>SPI [{io.recentSpi.map(b => `0x${b.toString(16).padStart(2, '0').toUpperCase()}`).join(' ')}]</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}

                              {isExpanded && entry.details && (
                                <div style={{ background: 'var(--bg2)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', marginTop: hasIo ? 4 : 0, fontSize: 11, color: 'var(--text2)', overflowX: 'auto' }}>
                                  <pre style={{ margin: 0, fontFamily: 'JetBrains Mono, monospace' }}>
                                    {JSON.stringify(entry.details, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
