import React, { useState } from 'react';
import { ShieldCheck, Search, Calendar, User, Activity, ShieldAlert } from 'lucide-react';
import AdminCard from './AdminCard';

const getActionBadgeClass = (action) => {
    if (action.includes('login'))  return 'success';
    if (action.includes('restart') || action.includes('delete')) return 'warning';
    if (action.includes('error'))  return 'error';
    return 'blue';
};

const getActionIcon = (action) => {
    if (action.includes('login'))  return User;
    if (action.includes('restart')) return Activity;
    if (action.includes('delete') || action.includes('reject')) return ShieldAlert;
    return ShieldCheck;
};

const HistoryTab = ({ logs }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all');

    const filteredLogs = logs.filter(log => {
        const matchesSearch =
            log.adminEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.details && log.details.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesType = filterType === 'all' || log.action.includes(filterType);
        return matchesSearch && matchesType;
    });

    const today = new Date().toLocaleDateString();
    const loginsToday    = logs.filter(l => l.action.toLowerCase().includes('login') && new Date(l.timestamp).toLocaleDateString() === today).length;
    const securityAlerts = logs.filter(l => l.action.toLowerCase().includes('error') || l.action.toLowerCase().includes('failed')).length;

    return (
        <div className="ad-space-y-6 ad-fade-in">
            {/* ── Summary Cards ─────────────────────────────────────────── */}
            <div className="ad-grid-3">
                {[
                    { label: 'Logins Today',      value: loginsToday,    icon: User,       color: 'emerald' },
                    { label: 'Actions Executed',  value: logs.length,    icon: Activity,   color: 'blue' },
                    { label: 'Security Alerts',   value: securityAlerts, icon: ShieldAlert, color: 'amber' },
                ].map((s, i) => (
                    <div key={i} className={`ad-stat-card ${s.color}`}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span className="ad-stat-label">{s.label}</span>
                            <div className={`ad-stat-icon ${s.color}`}><s.icon /></div>
                        </div>
                        <div className="ad-stat-value">{s.value}</div>
                    </div>
                ))}
            </div>

            {/* ── Search + Filter ───────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div className="ad-input-icon" style={{ flex: 1, minWidth: 240 }}>
                    <Search />
                    <input
                        type="text"
                        className="ad-input"
                        placeholder="Search audit logs (email, action, details)..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="ad-segmented">
                    {['all', 'login', 'approve', 'restart'].map(type => (
                        <button
                            key={type}
                            className={`ad-segment-btn ${filterType === type ? 'active' : ''}`}
                            onClick={() => setFilterType(type)}
                        >
                            {type}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Log Table ─────────────────────────────────────────────── */}
            <AdminCard className="p-0">
                <div className="ad-table-wrap">
                    <table className="ad-table">
                        <thead>
                            <tr>
                                <th>Timestamp</th>
                                <th>Admin Entity</th>
                                <th>Action Type</th>
                                <th>Log Details</th>
                                <th style={{ textAlign: 'right' }}>Network IP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.map((log, i) => {
                                const Icon = getActionIcon(log.action);
                                return (
                                    <tr key={i}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <Calendar style={{ width: 13, height: 13, color: 'var(--ad-text-3)', flexShrink: 0 }} />
                                                <div>
                                                    <div style={{ fontWeight: 600, color: 'var(--ad-text)', fontSize: 12 }}>
                                                        {new Date(log.timestamp).toLocaleDateString()}
                                                    </div>
                                                    <div style={{ fontSize: 10, color: 'var(--ad-text-3)' }}>
                                                        {new Date(log.timestamp).toLocaleTimeString()}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{
                                                    width: 28, height: 28, borderRadius: '50%', background: 'var(--ad-accent-glow)',
                                                    border: '1px solid var(--ad-border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 11, fontWeight: 800, color: 'var(--ad-accent)', flexShrink: 0,
                                                }}>
                                                    {log.adminEmail[0].toUpperCase()}
                                                </div>
                                                <span className="primary" style={{ fontSize: 12 }}>{log.adminEmail}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`ad-badge ${getActionBadgeClass(log.action)}`}>
                                                <Icon style={{ width: 10, height: 10 }} />
                                                {log.action}
                                            </span>
                                        </td>
                                        <td style={{ color: 'var(--ad-text-2)', fontSize: 12 }}>{log.details}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            <span className="ad-mono">{log.ip || '127.0.0.1'}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {filteredLogs.length === 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 12, opacity: 0.35 }}>
                            <ShieldCheck style={{ width: 40, height: 40, color: 'var(--ad-text-3)' }} />
                            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--ad-text-3)' }}>
                                No logs matching criteria
                            </p>
                        </div>
                    )}
                </div>
            </AdminCard>
        </div>
    );
};

export default HistoryTab;
