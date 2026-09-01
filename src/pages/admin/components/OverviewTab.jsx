import React from 'react';
import { Activity, Users, Zap, Database, TrendingUp, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import AdminCard from './AdminCard';

const OverviewTab = ({ stats }) => {
    if (!stats) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
            <Activity style={{ width: 40, height: 40, color: 'var(--ad-border)', marginBottom: 16 }} className="ad-spin" />
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--ad-text-3)' }}>Loading Analytics...</p>
        </div>
    );

    const mainStats = [
        { label: 'Total Simulations', value: stats.totalSimulations ?? '—', icon: Zap,      color: 'blue',    change: '+12%', up: true },
        { label: 'Active Sessions',   value: stats.activeSessions   ?? '—', icon: Users,     color: 'emerald', change: '+5%',  up: true },
        { label: 'Avg Compile Time',  value: stats.avgCompileTime   ?? '—', icon: Clock,     color: 'amber',   change: '-2s',  up: true },
        { label: 'Cloud Storage',     value: stats.storageUsed      ?? '—', icon: Database,  color: 'purple',  change: '+1.2G', up: false },
    ];

    const COLOR_MAP = { blue: 'var(--ad-accent)', emerald: 'var(--ad-emerald)', amber: 'var(--ad-amber)', purple: 'var(--ad-purple)' };

    return (
        <div className="ad-space-y-6 ad-fade-in">
            {/* ── Stat Cards ────────────────────────────────────────────── */}
            <div className="ad-grid-4">
                {mainStats.map((item, i) => (
                    <div key={i} className={`ad-stat-card ${item.color}`}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span className="ad-stat-label">{item.label}</span>
                            <div className={`ad-stat-icon ${item.color}`}>
                                <item.icon />
                            </div>
                        </div>
                        <div>
                            <div className="ad-stat-value" style={{ color: COLOR_MAP[item.color] }}>
                                {item.value}
                            </div>
                            <span className={`ad-badge ${item.up ? 'success' : 'error'}`} style={{ marginTop: 8, display: 'inline-flex' }}>
                                {item.up ? <ArrowUpRight style={{ width: 10, height: 10 }} /> : <ArrowDownRight style={{ width: 10, height: 10 }} />}
                                {item.change} vs last week
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Charts Row ────────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
                {/* Compilation chart */}
                <AdminCard className="p-0">
                    <div className="ad-card-header">
                        <div>
                            <div className="ad-card-title">
                                <TrendingUp style={{ color: 'var(--ad-accent)' }} />
                                Compilation Success Rate
                            </div>
                            <div className="ad-card-subtitle">Daily backend compiler performance</div>
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            {[{ color: 'var(--ad-accent)', label: 'Success' }, { color: 'var(--ad-red)', label: 'Failed' }].map(l => (
                                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: l.color }} />
                                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ad-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{l.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="ad-card-body">
                        <div style={{ height: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6, padding: '0 4px' }}>
                            {stats.compilationHistory?.length > 0 ? (
                                stats.compilationHistory.map((day, i) => {
                                    const successH = (day.success / 600) * 100;
                                    const failH    = (day.fail / 600) * 100;
                                    return (
                                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 2, height: 160, minHeight: 4, position: 'relative' }}>
                                                <div style={{ height: `${failH}%`, width: '100%', backgroundColor: 'var(--ad-red)', opacity: 0.6, borderRadius: '4px 4px 0 0', minHeight: failH > 0 ? 2 : 0 }} />
                                                <div style={{ height: `${successH}%`, width: '100%', backgroundColor: 'var(--ad-accent)', borderRadius: '4px 4px 0 0', minHeight: successH > 0 ? 2 : 0 }} />
                                            </div>
                                            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--ad-text-3)', textTransform: 'uppercase' }}>
                                                {day.date ? day.date.split('-').slice(1).join('/') : ''}
                                            </span>
                                        </div>
                                    );
                                })
                            ) : (
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <p style={{ fontSize: 11, color: 'var(--ad-text-3)', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700 }}>
                                        No telemetry data available
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </AdminCard>

                {/* Top Libraries */}
                <AdminCard className="p-0">
                    <div className="ad-card-header">
                        <div>
                            <div className="ad-card-title">Top Libraries</div>
                            <div className="ad-card-subtitle">Most frequently installed packages</div>
                        </div>
                    </div>
                    <div className="ad-card-body ad-space-y-3">
                        {stats.topLibraries?.length > 0 ? (
                            stats.topLibraries.map((lib, i) => (
                                <div key={i}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                                        <span style={{ color: 'var(--ad-text)', fontWeight: 600 }}>{lib.name}</span>
                                        <span style={{ color: 'var(--ad-accent)', fontFamily: 'monospace', fontWeight: 700 }}>{lib.count} installs</span>
                                    </div>
                                    <div className="ad-progress">
                                        <div className="ad-progress-bar" style={{ width: `${(lib.count / stats.topLibraries[0].count) * 100}%` }} />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p style={{ fontSize: 11, textAlign: 'center', padding: '24px 0', color: 'var(--ad-text-3)', fontStyle: 'italic' }}>
                                No usage data found.
                            </p>
                        )}
                    </div>
                </AdminCard>
            </div>
        </div>
    );
};

export default OverviewTab;
