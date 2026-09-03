import React, { useState, useEffect } from 'react';
import AdminCard from './AdminCard';
import { Cpu, RotateCw, Download, Layers, ShieldCheck, Activity, Code, Terminal } from 'lucide-react';
import { fetchResourceStatus, fetchHostStatus, triggerRecalibrate, downloadCalibrationScripts, uploadCalibrationScripts } from '../../../services/simulatorService';

export default function ResourcesTab() {
    const [status, setStatus] = useState(null);
    const [hostStatus, setHostStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [calibrating, setCalibrating] = useState(false);

    const loadStatus = async () => {
        setLoading(true);
        try {
            const [data, hostData] = await Promise.all([fetchResourceStatus(), fetchHostStatus().catch(() => null)]);
            if (data?.success) setStatus(data);
            if (hostData?.success) setHostStatus(hostData.host);
        } catch (e) {
            console.error('Failed to load resource status:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStatus();
        const interval = setInterval(loadStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleRecalibrate = async () => {
        if (!window.confirm('Warning: Triggering recalibration will execute a compilation stress test on the server. Active compilations/simulations might queue up. Do you want to continue?')) return;
        setCalibrating(true);
        try {
            const res = await triggerRecalibrate();
            alert(res.success ? 'Recalibration started in background. Config updates in 1-2 minutes.' : `Failed: ${res.error || 'Unknown error'}`);
        } catch (e) { alert(`Error: ${e.message}`); }
        finally { setCalibrating(false); loadStatus(); }
    };

    const handleDownloadBudget = () => {
        if (!status?.budget) return;
        const a = Object.assign(document.createElement('a'), {
            href: 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(status.budget, null, 4)),
            download: 'calibrated_budget.json',
        });
        document.body.appendChild(a); a.click(); a.remove();
    };

    const handleDownloadScripts = async () => {
        try {
            const blob = await downloadCalibrationScripts();
            const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'calibration_scripts.json' });
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
        } catch (e) { alert('Failed to download: ' + e.message); }
    };

    const handleUploadScripts = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const res = await uploadCalibrationScripts(file);
            alert(res.success ? 'Scripts updated!' : 'Failed: ' + res.error);
        } catch (err) { alert('Error: ' + err.message); }
        e.target.value = null;
    };

    if (loading && !status) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 64, gap: 12, color: 'var(--ad-text-3)' }}>
            <RotateCw style={{ width: 22, height: 22, color: 'var(--ad-accent)' }} className="ad-spin" />
            Loading resource allocation telemetry...
        </div>
    );

    const { totalPoints = 0, activePoints = 0, availablePoints = 0, waitingCount = 0, budget = {}, allocations = [] } = status || {};
    const usedPercentage = totalPoints > 0 ? Math.min(100, Math.round((activePoints / totalPoints) * 100)) : 0;
    const activeCompilations = allocations.filter(a => a.tag?.includes('_compile')).length;
    const activeSimulations  = allocations.filter(a => a.tag?.includes('_sim')).length;

    const STAT_CARDS = [
        { label: 'Active Points',   value: `${activePoints} MB`,   icon: Activity,    color: 'blue' },
        { label: 'Available',       value: `${availablePoints} MB`, icon: Cpu,         color: 'emerald' },
        { label: 'Total Pool',      value: `${totalPoints} MB`,    icon: Layers,      color: 'blue' },
        { label: 'Waiting Queue',   value: waitingCount,            icon: ShieldCheck, color: waitingCount > 0 ? 'amber' : 'blue' },
        { label: 'Active Compiles', value: activeCompilations,      icon: Code,        color: 'purple' },
        { label: 'Active Sims',     value: activeSimulations,       icon: Terminal,    color: 'emerald' },
    ];

    const gaugeColor = usedPercentage > 85 ? 'var(--ad-red)' : usedPercentage > 60 ? 'var(--ad-amber)' : 'var(--ad-accent)';

    return (
        <div className="ad-space-y-6 ad-fade-in">
            {/* ── Stat Cards ─────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
                {STAT_CARDS.map((s, i) => (
                    <div key={i} className={`ad-stat-card ${s.color}`}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="ad-stat-label">{s.label}</span>
                            <div className={`ad-stat-icon ${s.color}`}><s.icon /></div>
                        </div>
                        <div className="ad-stat-value">{s.value}</div>
                    </div>
                ))}
            </div>

            {/* ── Resource Pool Gauge ─────────────────────────────────── */}
            <AdminCard className="p-0">
                <div className="ad-card-header">
                    <div>
                        <div className="ad-card-title">Resource Pool Consumption</div>
                        <div className="ad-card-subtitle">System reserve (2000 MB) excluded to guarantee host OS stability</div>
                    </div>
                    <span className="ad-stat-value" style={{ color: gaugeColor, fontSize: 22 }}>{usedPercentage}%</span>
                </div>
                <div className="ad-card-body">
                    <div className="ad-progress" style={{ height: 10 }}>
                        <div className="ad-progress-bar" style={{ width: `${usedPercentage}%`, backgroundColor: gaugeColor }} />
                    </div>
                </div>
            </AdminCard>

            {/* ── Host VM Status ──────────────────────────────────────── */}
            {hostStatus && (
                <AdminCard className="p-0" style={{ borderLeft: '3px solid var(--ad-purple)' }}>
                    <div className="ad-card-header">
                        <div>
                            <div className="ad-card-title">Host VM Status (Hardware)</div>
                            <div className="ad-card-subtitle">Live via Health Agent</div>
                        </div>
                        <span className="ad-badge purple">Live</span>
                    </div>
                    <div className="ad-card-body">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                            {[
                                { label: 'CPU Load Avg', value: hostStatus.load_avg },
                                { label: 'True Host RAM', value: `${hostStatus.used_mem} / ${hostStatus.total_mem} MB (${hostStatus.mem_pct}%)` },
                                { label: 'Storage Usage', value: `${(hostStatus.total_disk - hostStatus.free_disk).toFixed(1)} / ${hostStatus.total_disk} GB` },
                                { label: 'System Uptime', value: hostStatus.uptime },
                            ].map(f => (
                                <div key={f.label}>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ad-text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{f.label}</div>
                                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ad-text)' }}>{f.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </AdminCard>
            )}

            {/* ── Allocations + Calibration ───────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
                {/* Active Allocations */}
                <AdminCard className="p-0">
                    <div className="ad-card-header">
                        <div className="ad-card-title">Active Allocations</div>
                        <button onClick={loadStatus} className="ad-btn-icon" title="Refresh">
                            <RotateCw style={{ width: 14, height: 14 }} />
                        </button>
                    </div>
                    <div className="ad-table-wrap">
                        <table className="ad-table">
                            <thead>
                                <tr>
                                    <th>Allocation ID</th>
                                    <th>Service / Tag</th>
                                    <th>Memory</th>
                                    <th>Uptime</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allocations.length > 0 ? allocations.map((alloc) => {
                                    const uptimeSec = Math.round((Date.now() - alloc.timestamp) / 1000);
                                    const uptimeStr = uptimeSec > 60 ? `${Math.floor(uptimeSec / 60)}m ${uptimeSec % 60}s` : `${uptimeSec}s`;
                                    return (
                                        <tr key={alloc.id}>
                                            <td><span className="ad-mono">{alloc.id}</span></td>
                                            <td className="primary">{alloc.tag}</td>
                                            <td>{alloc.points} MB</td>
                                            <td style={{ color: 'var(--ad-text-3)' }}>{uptimeStr}</td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan={4} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--ad-text-3)', fontSize: 12 }}>
                                            No active points being consumed.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </AdminCard>

                {/* Calibration */}
                <div className="ad-space-y-4">
                    <AdminCard className="p-0">
                        <div className="ad-card-header">
                            <div className="ad-card-title">Calibration Config</div>
                        </div>
                        <div className="ad-card-body ad-space-y-3">
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--ad-border)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ad-text-3)' }}>
                                <span>Target</span>
                                <span>Cost (MB)</span>
                            </div>
                            {Object.entries(budget).map(([key, val]) => (
                                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                    <span className="ad-mono" style={{ color: 'var(--ad-text-2)' }}>{key}</span>
                                    <span style={{ fontWeight: 700, color: 'var(--ad-text)' }}>{val} MB</span>
                                </div>
                            ))}

                            <div style={{ paddingTop: 12, borderTop: '1px solid var(--ad-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <button onClick={handleRecalibrate} disabled={calibrating} className="ad-btn ad-btn-primary" style={{ justifyContent: 'center', opacity: calibrating ? 0.6 : 1 }}>
                                    <RotateCw style={{ width: 14, height: 14, animation: calibrating ? 'spin 1s linear infinite' : 'none' }} />
                                    {calibrating ? 'Calibrating...' : 'Recalibrate Budget'}
                                </button>
                                <button onClick={handleDownloadBudget} className="ad-btn ad-btn-ghost" style={{ justifyContent: 'center' }}>
                                    <Download style={{ width: 14, height: 14 }} /> Download Config
                                </button>
                            </div>
                        </div>
                    </AdminCard>

                    <AdminCard className="p-0">
                        <div className="ad-card-header">
                            <div className="ad-card-title">Calibration Scripts</div>
                        </div>
                        <div className="ad-card-body ad-space-y-3">
                            <p style={{ fontSize: 12, color: 'var(--ad-text-3)', lineHeight: 1.5 }}>
                                Update the JSON file containing the test C++ scripts used during the recalibration process.
                            </p>
                            <button onClick={handleDownloadScripts} className="ad-btn ad-btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>
                                <Download style={{ width: 14, height: 14, color: 'var(--ad-emerald)' }} /> Download Current Scripts
                            </button>
                            <label className="ad-btn ad-btn-ghost" style={{ width: '100%', justifyContent: 'center', cursor: 'pointer' }}>
                                <RotateCw style={{ width: 14, height: 14, color: 'var(--ad-amber)' }} /> Upload New Scripts (JSON)
                                <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleUploadScripts} />
                            </label>
                        </div>
                    </AdminCard>
                </div>
            </div>
        </div>
    );
}
