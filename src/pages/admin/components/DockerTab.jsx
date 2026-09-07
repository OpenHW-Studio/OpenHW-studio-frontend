import React, { useState, useEffect, useRef } from 'react';
import { Box, Download, Trash2, Search, RefreshCw, Activity, Layers, Zap, X } from 'lucide-react';
import AdminCard from './AdminCard';
import { fetchSystemLogs } from '../../../services/simulatorService.js';

const LOG_COLORS = {
    error:  'var(--ad-red)',
    docker: 'var(--ad-accent)',
    info:   'var(--ad-accent)',
};

const getDisplayName = (name) => {
    const names = {
        backend: 'Backend Main', frontend: 'Frontend Client', mongodb: 'Database (MongoDB)',
        'esp32-worker': 'ESP32 Worker', 'stm32-worker': 'STM32 Worker', 'health-agent': 'Health Agent',
    };
    return names[name] || name;
};

const DockerTab = ({ infraStatus, onRestart }) => {
    const [logs, setLogs] = useState([]);
    const [targetService, setTargetService] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [restarting, setRestarting] = useState(new Set());
    const pollRef = useRef(null);
    const seenTimestamps = useRef(new Set());

    useEffect(() => {
        seenTimestamps.current = new Set();
        setLogs([]);
        const poll = async () => {
            try {
                const fetched = await fetchSystemLogs();
                const filtered = targetService === 'all' ? fetched : fetched.filter(l => l.type === targetService || l.type === 'error');
                const newEntries = filtered.filter(l => !seenTimestamps.current.has(l.time + l.msg));
                if (newEntries.length > 0) {
                    newEntries.forEach(l => seenTimestamps.current.add(l.time + l.msg));
                    setLogs(prev => [...newEntries, ...prev].slice(0, 500));
                }
            } catch { /* silent */ }
        };
        poll();
        pollRef.current = setInterval(poll, 4000);
        return () => clearInterval(pollRef.current);
    }, [targetService]);

    const handleRestart = async (name) => {
        setRestarting(prev => new Set(prev).add(name));
        try { await onRestart(name); }
        finally { setRestarting(prev => { const n = new Set(prev); n.delete(name); return n; }); }
    };

    const dockerLogs = logs.filter(l =>
        l.type === 'docker' || l.type === 'error' ||
        ['docker', 'container', 'image', 'active', 'infrastructure'].some(k => l.msg.toLowerCase().includes(k))
    ).filter(l =>
        l.msg.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.details && l.details.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const handleDownload = () => {
        const content = dockerLogs.map(l => `[${l.time}] [${l.type.toUpperCase()}] ${l.msg}${l.details ? '\n' + l.details : ''}`).join('\n\n');
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([content], { type: 'text/plain' })), download: `docker_logs_${new Date().toISOString().split('T')[0]}.log` });
        a.click(); URL.revokeObjectURL(a.href);
    };

    return (
        <div className="ad-space-y-6 ad-fade-in">
            {/* ── Core Services ─────────────────────────────────────────── */}
            <div>
                <div className="ad-card-title" style={{ marginBottom: 12 }}>
                    <Box style={{ color: 'var(--ad-accent)' }} />
                    Core Services
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                    {infraStatus.map((service, i) => (
                        <AdminCard key={i} className="p-0">
                            <div className="ad-card-header">
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--ad-text)' }}>{getDisplayName(service.name)}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                        <span className={`ad-status-dot ${service.status === 'running' ? 'live' : 'offline'}`} />
                                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ad-text-3)' }}>{service.status}</span>
                                    </div>
                                </div>
                                <span className="ad-badge success">{service.uptime}</span>
                            </div>

                            <div className="ad-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {/* Version + Hash */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    {[
                                        { label: 'Image', value: service.version, mono: true, color: 'var(--ad-accent)' },
                                        { label: 'Hash', value: service.hash?.slice(0, 8), mono: true },
                                    ].map(f => (
                                        <div key={f.label} style={{ padding: '8px 10px', borderRadius: 8, backgroundColor: 'var(--ad-surface-2)', border: '1px solid var(--ad-border)' }}>
                                            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ad-text-3)', marginBottom: 4 }}>{f.label}</div>
                                            <div style={{ fontSize: 12, fontWeight: 700, fontFamily: f.mono ? 'monospace' : 'inherit', color: f.color || 'var(--ad-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.value}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Resource pulse */}
                                <div style={{ paddingTop: 8, borderTop: '1px solid var(--ad-border)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ad-text-3)' }}>
                                            <Zap style={{ width: 12, height: 12, color: 'var(--ad-accent)' }} /> Resource Pulse
                                        </span>
                                        <div style={{ display: 'flex', gap: 12 }}>
                                            {[
                                                { k: 'CPU', v: service.resources?.cpu || '0%' },
                                                { k: 'RAM', v: service.resources?.mem ? service.resources.mem.split(' / ')[0].replace('MiB', 'MB') : '0MB' },
                                                { k: 'Load', v: service.resources?.load || '0.00' },
                                            ].map(r => (
                                                <div key={r.k} style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ad-text-3)' }}>{r.k}</div>
                                                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ad-text)' }}>{r.v}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="ad-progress">
                                        <div className="ad-progress-bar" style={{ width: service.resources?.cpu || '0%' }} />
                                    </div>
                                </div>

                                {/* Buttons */}
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                        disabled={restarting.has(service.name)}
                                        onClick={() => handleRestart(service.name)}
                                        className="ad-btn ad-btn-ghost"
                                        style={{ flex: 1, justifyContent: 'center', opacity: restarting.has(service.name) ? 0.5 : 1 }}
                                    >
                                        <RefreshCw style={{ width: 13, height: 13, animation: restarting.has(service.name) ? 'spin 1s linear infinite' : 'none' }} />
                                        {restarting.has(service.name) ? 'Restarting...' : 'Restart'}
                                    </button>
                                    <button
                                        onClick={() => setTargetService(service.name)}
                                        className="ad-btn ad-btn-ghost"
                                        style={{ flex: 1, justifyContent: 'center', color: 'var(--ad-accent)', borderColor: 'color-mix(in srgb, var(--ad-accent) 25%, transparent)' }}
                                    >
                                        <Activity style={{ width: 13, height: 13 }} />
                                        Logs
                                    </button>
                                </div>
                            </div>
                        </AdminCard>
                    ))}
                </div>
            </div>

            {/* ── Log Stream ─────────────────────────────────────────────── */}
            <AdminCard className="p-0" style={{ display: 'flex', flexDirection: 'column', height: 480 }}>
                <div className="ad-card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
                    <div className="ad-card-title">
                        <Layers style={{ color: 'var(--ad-accent)' }} />
                        Infrastructure Log Stream
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        {/* Search */}
                        <div className="ad-input-icon" style={{ width: 200 }}>
                            <Search style={{ width: 13, height: 13 }} />
                            <input className="ad-input" type="text" placeholder="Filter logs..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>

                        {/* Service picker */}
                        <select
                            value={targetService}
                            onChange={e => { setTargetService(e.target.value); setLogs([]); }}
                            className="ad-input"
                            style={{ width: 'auto', padding: '0 10px', height: 36, fontSize: 11 }}
                        >
                            <option value="all">All Services</option>
                            <option value="frontend">Frontend</option>
                            <option value="backend">Backend</option>
                            <option value="mongodb">MongoDB</option>
                            <option value="esp32-worker">ESP32 Worker</option>
                            <option value="stm32-worker">STM32 Worker</option>
                            <option value="health-agent">Health Agent</option>
                        </select>

                        <button className="ad-btn ad-btn-ghost" onClick={handleDownload}>
                            <Download style={{ width: 13, height: 13 }} /> Export
                        </button>
                        <button className="ad-btn ad-btn-danger" onClick={() => setLogs([])}>
                            <Trash2 style={{ width: 13, height: 13 }} /> Clear
                        </button>
                    </div>
                </div>

                <div style={{
                    flex: 1, overflowY: 'auto', padding: '12px 16px', fontFamily: '"JetBrains Mono","Fira Code",monospace',
                    fontSize: 11, backgroundColor: 'var(--ad-bg)', display: 'flex', flexDirection: 'column', gap: 2,
                }}>
                    {dockerLogs.length > 0 ? dockerLogs.map((log, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '4px 6px', borderBottom: '1px solid var(--ad-border)' }}>
                            <span style={{ color: 'var(--ad-text-3)', flexShrink: 0, fontSize: 10, minWidth: 65, lineHeight: '18px' }}>
                                [{log.time.includes(':') ? log.time : new Date(log.time).toLocaleTimeString([], { hour12: false })}]
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <span className={`ad-badge ${log.type === 'error' ? 'error' : 'blue'}`} style={{ marginRight: 6, fontSize: 8 }}>
                                    {log.type === 'error' ? 'Error' : log.type === 'docker' || log.type === 'info' ? 'System' : getDisplayName(log.type)}
                                </span>
                                <span style={{ color: 'var(--ad-text-2)', wordBreak: 'break-all', lineHeight: 1.5 }}>{log.msg}</span>
                                {log.details && (
                                    <pre style={{ marginTop: 4, paddingLeft: 12, fontSize: 10, color: 'var(--ad-text-3)', borderLeft: '2px solid var(--ad-border)', whiteSpace: 'pre-wrap' }}>
                                        {log.details}
                                    </pre>
                                )}
                            </div>
                        </div>
                    )) : (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: 0.3 }}>
                            <Box style={{ width: 40, height: 40, color: 'var(--ad-text-3)' }} />
                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--ad-text-3)' }}>No infrastructure events</span>
                        </div>
                    )}
                </div>
            </AdminCard>
        </div>
    );
};

export default DockerTab;
