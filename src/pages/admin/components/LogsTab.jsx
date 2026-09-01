import React from 'react';
import { XCircle, CheckCircle2, AlertCircle, Download, Trash2, Terminal } from 'lucide-react';

const LOG_ICONS = {
    error:   <XCircle   style={{ width: 14, height: 14, color: 'var(--ad-red)'     }} />,
    success: <CheckCircle2 style={{ width: 14, height: 14, color: 'var(--ad-emerald)' }} />,
    info:    <AlertCircle  style={{ width: 14, height: 14, color: 'var(--ad-accent)' }} />,
};

const LOG_COLORS = {
    error:   'var(--ad-red)',
    success: 'var(--ad-emerald)',
    info:    'var(--ad-text-2)',
};

const LogsTab = ({ logs, onClear }) => {
    const systemLogs = logs.filter(l =>
        !l.msg.toLowerCase().includes('docker') &&
        !l.msg.toLowerCase().includes('container') &&
        !l.msg.toLowerCase().includes('image') &&
        !l.msg.toLowerCase().includes('compose') &&
        l.type !== 'docker'
    );

    const handleDownload = () => {
        const content = systemLogs.map(l => `[${l.time}] [${l.type.toUpperCase()}] ${l.msg}`).join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const a = Object.assign(document.createElement('a'), {
            href: URL.createObjectURL(blob),
            download: `system_logs_${new Date().toISOString().split('T')[0]}.log`,
        });
        a.click();
        URL.revokeObjectURL(a.href);
    };

    return (
        <div className="ad-card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
            {/* Header */}
            <div className="ad-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="ad-stat-icon blue">
                        <Terminal />
                    </div>
                    <div>
                        <div className="ad-card-title">Management Console</div>
                        <div className="ad-card-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="ad-status-dot live" />
                            Live Monitoring Active
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="ad-btn ad-btn-ghost" onClick={handleDownload}>
                        <Download style={{ width: 13, height: 13 }} />
                        Export
                    </button>
                    <button className="ad-btn ad-btn-danger" onClick={onClear}>
                        <Trash2 style={{ width: 13, height: 13 }} />
                        Clear
                    </button>
                </div>
            </div>

            {/* Log Stream */}
            <div style={{
                flex: 1, overflowY: 'auto', padding: '16px 20px',
                fontFamily: '"JetBrains Mono","Fira Code","Consolas",monospace', fontSize: 12,
                backgroundColor: 'var(--ad-bg)', display: 'flex', flexDirection: 'column', gap: 2,
            }}>
                {systemLogs.length > 0 ? systemLogs.map((log, i) => (
                    <div key={i} style={{
                        display: 'flex', gap: 12, alignItems: 'flex-start', padding: '5px 6px',
                        borderBottom: '1px solid var(--ad-border)', transition: 'background 0.1s',
                    }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--ad-surface-2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        <span style={{ color: 'var(--ad-text-3)', flexShrink: 0, fontSize: 10, fontWeight: 600, minWidth: 70, lineHeight: '20px' }}>
                            {log.time.includes(':') ? log.time : new Date(log.time).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span style={{ flexShrink: 0, lineHeight: 1 }}>
                            {LOG_ICONS[log.type] || LOG_ICONS.info}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ color: LOG_COLORS[log.type] || 'var(--ad-text-2)', wordBreak: 'break-words', lineHeight: 1.5 }}>
                                {log.msg}
                            </span>
                            {log.details && (
                                <pre style={{
                                    marginTop: 6, padding: '8px 12px', backgroundColor: 'var(--ad-surface-2)',
                                    border: '1px solid var(--ad-border)', borderRadius: 8, fontSize: 10,
                                    color: 'var(--ad-text-3)', overflowX: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'inherit',
                                }}>
                                    {log.details}
                                </pre>
                            )}
                        </div>
                    </div>
                )) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, opacity: 0.3 }}>
                        <Terminal style={{ width: 48, height: 48, color: 'var(--ad-text-3)' }} />
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3em', color: 'var(--ad-text-3)' }}>
                            Awaiting System Events
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LogsTab;
