/**
 * SerialMonitor.jsx  —  src/esp32/components/SerialMonitor.jsx
 *
 * Self-contained serial monitor panel for ESP32 QEMU sessions.
 *
 * Props:
 *   history   {Array}     Array of { dir:'rx'|'sys'|'err'|'tx', text, ts }
 *   onSend    {function}  Called with a string when the user hits Send/Enter
 *   isRunning {boolean}   Whether a session is active (enables input)
 *   onClear   {function}  Called when the Clear button is clicked
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';

const DIR_STYLES = {
  rx:  { color: '#e2e8f0' },
  sys: { color: '#94a3b8', fontStyle: 'italic' },
  err: { color: '#f87171' },
  tx:  { color: '#34d399' },
};

export default function SerialMonitor({ history = [], onSend, isRunning = false, onClear }) {
  const bottomRef = useRef(null);
  const [input, setInput]         = useState('');
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll on new output
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history, autoScroll]);

  const handleSend = useCallback(() => {
    if (!isRunning || !input.trim()) return;
    onSend?.(input);
    setInput('');
  }, [isRunning, input, onSend]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#0d1117',
      borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.08)',
      overflow: 'hidden',
      fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
      fontSize: 12,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        background: '#161b22',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span style={{ color: '#94a3b8', fontWeight: 600, letterSpacing: 0.5, fontSize: 11 }}>
          📡 Serial Monitor
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setAutoScroll(v => !v)}
            title="Toggle auto-scroll"
            style={{
              background: autoScroll ? 'rgba(0,212,255,0.15)' : 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4,
              color: autoScroll ? '#00d4ff' : '#64748b',
              cursor: 'pointer',
              fontSize: 10,
              padding: '2px 6px',
            }}
          >
            ↕ Auto
          </button>
          <button
            onClick={onClear}
            title="Clear output"
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4,
              color: '#64748b',
              cursor: 'pointer',
              fontSize: 10,
              padding: '2px 6px',
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Output */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 12px',
          userSelect: 'text',
        }}
      >
        {history.map((entry, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 1 }}>
            <span style={{ color: '#334155', minWidth: 72, flexShrink: 0 }}>{entry.ts}</span>
            <span style={DIR_STYLES[entry.dir] || DIR_STYLES.rx}>
              {entry.dir === 'tx' && <span style={{ color: '#34d399', marginRight: 4 }}>{'>'}</span>}
              {entry.dir === 'err' && <span style={{ color: '#f87171', marginRight: 4 }}>✗</span>}
              {entry.text}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div style={{
        display: 'flex',
        gap: 6,
        padding: '6px 10px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: '#161b22',
      }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!isRunning}
          placeholder={isRunning ? 'Type and press Enter to send...' : 'Start a session to enable input'}
          style={{
            flex: 1,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4,
            color: '#e2e8f0',
            fontSize: 12,
            padding: '4px 8px',
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!isRunning}
          style={{
            background: isRunning ? '#00d4ff22' : 'transparent',
            border: '1px solid rgba(0,212,255,0.3)',
            borderRadius: 4,
            color: isRunning ? '#00d4ff' : '#334155',
            cursor: isRunning ? 'pointer' : 'not-allowed',
            fontSize: 11,
            padding: '4px 12px',
            fontFamily: 'inherit',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
