import React, { useState, useMemo } from 'react';
import { 
    Activity, TrendingUp, Users, Monitor, Cpu, BarChart3,
    GraduationCap, BookOpen, UserCheck, Award, Smartphone
} from 'lucide-react';
import AdminCard from './AdminCard';
import { 
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const ROLE_COLORS = { student: '#06b6d4', teacher: '#a855f7', user: '#3b82f6', admin: '#f59e0b' };
const DEVICE_COLORS = ['#3b82f6', '#06b6d4', '#8b5cf6'];

const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="ad-chart-tooltip">
            <p style={{ fontWeight: 700, marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid var(--ad-border)', color: 'var(--ad-text)' }}>{label}</p>
            {payload.map((entry, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginTop: 4 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ad-text-2)' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: entry.color, display: 'inline-block', flexShrink: 0 }} />
                        {entry.name}
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--ad-text)', fontFamily: 'monospace' }}>{entry.value}</span>
                </div>
            ))}
        </div>
    );
};

const StatCard = ({ label, value, sub, color = '', icon: Icon }) => (
    <div className={`ad-stat-card ${color}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="ad-stat-label">{label}</span>
            {Icon && (
                <div className={`ad-stat-icon ${color}`}>
                    <Icon />
                </div>
            )}
        </div>
        <div>
            <div className="ad-stat-value" style={{ color: color ? `var(--ad-${color === 'blue' ? 'accent' : color})` : 'var(--ad-text)' }}>{value ?? 0}</div>
            {sub && <div className="ad-stat-sub" style={{ marginTop: 4 }}>{sub}</div>}
        </div>
    </div>
);

const AnalyticsTab = ({ stats }) => {
    const [userTimeframe, setUserTimeframe] = useState('allTime');

    const rawTimeline = useMemo(() => stats?.visitorTimeline || [], [stats]);
    const compilationHistory = useMemo(() => stats?.compilationHistory || [], [stats]);
    const topLibraries = useMemo(() => stats?.topLibraries || [], [stats]);
    const deviceStats = useMemo(() => stats?.deviceStats || { desktop: 0, mobile: 0, tablet: 0 }, [stats]);
    const registeredUsers = useMemo(() => stats?.registeredUsers || {
        allTime: { student: 0, teacher: 0, user: 0, admin: 0, total: 0 },
        today: { student: 0, teacher: 0, user: 0, admin: 0, total: 0 },
        week: { student: 0, teacher: 0, user: 0, admin: 0, total: 0 },
        month: { student: 0, teacher: 0, user: 0, admin: 0, total: 0 },
        timeline: []
    }, [stats]);

    const activeUserData = registeredUsers[userTimeframe] || registeredUsers.allTime;

    const rolePieData = useMemo(() => {
        const roles = [
            { name: 'Students', value: activeUserData.student || 0, color: ROLE_COLORS.student },
            { name: 'Teachers', value: activeUserData.teacher || 0, color: ROLE_COLORS.teacher },
            { name: 'General Users', value: activeUserData.user || 0, color: ROLE_COLORS.user },
        ].filter(r => r.value > 0);
        return roles.length ? roles : [{ name: 'No data', value: 1, color: '#334155' }];
    }, [activeUserData]);

    const regTimelineData = useMemo(() =>
        (registeredUsers.timeline || []).map(item => ({
            date: item.date ? item.date.slice(5) : '',
            Students: item.student || 0,
            Teachers: item.teacher || 0,
            Users: item.user || 0,
        })), [registeredUsers]);

    const trafficData = useMemo(() =>
        rawTimeline.map(item => ({
            date: item.date ? item.date.slice(5) : '',
            visitors: item.visitors || 0,
            hits: item.hits || 0
        })), [rawTimeline]);

    const compileData = useMemo(() =>
        compilationHistory.map(item => ({
            date: item.date ? item.date.slice(5) : '',
            success: item.success || 0,
            fail: item.fail || 0
        })), [compilationHistory]);

    const deviceData = useMemo(() => {
        const list = [
            { name: 'Desktop', value: deviceStats.desktop || 0 },
            { name: 'Mobile', value: deviceStats.mobile || 0 },
            { name: 'Tablet', value: deviceStats.tablet || 0 },
        ].filter(d => d.value > 0);
        return list.length ? list : [{ name: 'No data', value: 1 }];
    }, [deviceStats]);

    const pct = (n) => activeUserData.total > 0 ? `${Math.round(((n || 0) / activeUserData.total) * 100)}%` : '—';

    return (
        <div className="ad-space-y-6 ad-fade-in">
            {/* ── SECTION 1: User Registration & Roles ─────────────────────── */}
            <div className="ad-section">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                    <div>
                        <h2 className="ad-section-title">
                            <UserCheck style={{ color: 'var(--ad-cyan)' }} />
                            Registered Community & Roles
                        </h2>
                        <p className="ad-section-subtitle">Account signups broken down by role</p>
                    </div>

                    {/* Segmented timeframe */}
                    <div className="ad-segmented">
                        {[
                            { id: 'allTime', label: 'All Time' },
                            { id: 'month', label: 'Month' },
                            { id: 'week', label: 'Week' },
                            { id: 'today', label: 'Today' },
                        ].map(t => (
                            <button
                                key={t.id}
                                className={`ad-segment-btn ${userTimeframe === t.id ? 'active' : ''}`}
                                onClick={() => setUserTimeframe(t.id)}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 4 Role metric cards */}
                <div className="ad-grid-4" style={{ marginBottom: 16 }}>
                    <StatCard label="Total Accounts" value={activeUserData.total || 0} sub={userTimeframe === 'allTime' ? 'All-time registered' : `New this ${userTimeframe}`} icon={Users} />
                    <StatCard label="Students" value={activeUserData.student || 0} sub={`${pct(activeUserData.student)} of total`} icon={GraduationCap} color="cyan" />
                    <StatCard label="Teachers" value={activeUserData.teacher || 0} sub={`${pct(activeUserData.teacher)} of total`} icon={BookOpen} color="purple" />
                    <StatCard label="General Users" value={activeUserData.user || 0} sub={`${pct(activeUserData.user)} of total`} icon={Award} color="blue" />
                </div>

                {/* Timeline + donut row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
                    {/* Stacked bar chart */}
                    <AdminCard className="p-0">
                        <div className="ad-card-header">
                            <div>
                                <div className="ad-card-title"><TrendingUp style={{ color: 'var(--ad-cyan)' }} /> Daily Account Signups (14 Days)</div>
                                <div className="ad-card-subtitle">Stacked breakdown by student, teacher and general users</div>
                            </div>
                        </div>
                        <div className="ad-card-body" style={{ paddingTop: 16 }}>
                            <div style={{ height: 240 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={regTimelineData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--ad-border)" vertical={false} />
                                        <XAxis dataKey="date" stroke="var(--ad-text-3)" fontSize={11} tickLine={false} />
                                        <YAxis stroke="var(--ad-text-3)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                                        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--ad-surface-2)' }} />
                                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                                        <Bar dataKey="Students" stackId="a" fill={ROLE_COLORS.student} />
                                        <Bar dataKey="Teachers" stackId="a" fill={ROLE_COLORS.teacher} />
                                        <Bar dataKey="Users" stackId="a" fill={ROLE_COLORS.user} radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </AdminCard>

                    {/* Role donut */}
                    <AdminCard className="p-0">
                        <div className="ad-card-header">
                            <div className="ad-card-title">Role Distribution</div>
                        </div>
                        <div className="ad-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ height: 180, position: 'relative' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={rolePieData} cx="50%" cy="50%" innerRadius={50} outerRadius={72} paddingAngle={4} dataKey="value">
                                            {rolePieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                        </Pie>
                                        <Tooltip content={<ChartTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                                    <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--ad-text)' }}>{activeUserData.total || 0}</span>
                                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ad-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Users</span>
                                </div>
                            </div>

                            {/* Legend chips */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, borderTop: '1px solid var(--ad-border)', paddingTop: 12 }}>
                                {[
                                    { label: 'Students', val: activeUserData.student || 0, color: ROLE_COLORS.student },
                                    { label: 'Teachers', val: activeUserData.teacher || 0, color: ROLE_COLORS.teacher },
                                    { label: 'Users', val: activeUserData.user || 0, color: ROLE_COLORS.user },
                                ].map(item => (
                                    <div key={item.label} style={{ textAlign: 'center', padding: '6px 4px', borderRadius: 8, backgroundColor: 'var(--ad-surface-2)', border: '1px solid var(--ad-border)' }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: item.color, marginBottom: 2 }}>{item.label}</div>
                                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ad-text)' }}>{item.val}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </AdminCard>
                </div>
            </div>

            {/* ── SECTION 2: Visitor Traffic ───────────────────────────────── */}
            <div className="ad-section">
                <h2 className="ad-section-title" style={{ marginBottom: 12 }}>
                    <TrendingUp style={{ color: 'var(--ad-cyan)' }} />
                    Visitor Traffic & Platform Telemetry
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
                    {/* Area chart */}
                    <AdminCard className="p-0">
                        <div className="ad-card-header">
                            <div>
                                <div className="ad-card-title"><TrendingUp style={{ color: 'var(--ad-cyan)' }} /> Visitor Traffic Growth (14 Days)</div>
                                <div className="ad-card-subtitle">Daily unique visitors and session simulation requests</div>
                            </div>
                        </div>
                        <div className="ad-card-body" style={{ paddingTop: 16 }}>
                            <div style={{ height: 250 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={trafficData}>
                                        <defs>
                                            <linearGradient id="vGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="var(--ad-cyan)" stopOpacity={0.35} />
                                                <stop offset="95%" stopColor="var(--ad-cyan)" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="hGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="var(--ad-accent)" stopOpacity={0.35} />
                                                <stop offset="95%" stopColor="var(--ad-accent)" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--ad-border)" vertical={false} />
                                        <XAxis dataKey="date" stroke="var(--ad-text-3)" fontSize={11} tickLine={false} />
                                        <YAxis stroke="var(--ad-text-3)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                                        <Area type="monotone" dataKey="visitors" name="Unique Visitors" stroke="var(--ad-cyan)" strokeWidth={2.5} fill="url(#vGrad)" />
                                        <Area type="monotone" dataKey="hits" name="Session Hits" stroke="var(--ad-accent)" strokeWidth={2} fill="url(#hGrad)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </AdminCard>

                    {/* Device donut */}
                    <AdminCard className="p-0">
                        <div className="ad-card-header">
                            <div>
                                <div className="ad-card-title"><Monitor style={{ color: 'var(--ad-purple)' }} /> Client Devices</div>
                                <div className="ad-card-subtitle">User agent device breakdown</div>
                            </div>
                        </div>
                        <div className="ad-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ height: 180, position: 'relative' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={deviceData} cx="50%" cy="50%" innerRadius={48} outerRadius={70} paddingAngle={5} dataKey="value">
                                            {deviceData.map((_, i) => <Cell key={i} fill={DEVICE_COLORS[i % DEVICE_COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip content={<ChartTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                                    <Smartphone style={{ width: 16, height: 16, color: 'var(--ad-text-3)', marginBottom: 2 }} />
                                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ad-text-3)', textTransform: 'uppercase' }}>Devices</span>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, borderTop: '1px solid var(--ad-border)', paddingTop: 12 }}>
                                {[
                                    { label: 'Desktop', val: deviceStats.desktop || 0, color: DEVICE_COLORS[0] },
                                    { label: 'Mobile', val: deviceStats.mobile || 0, color: DEVICE_COLORS[1] },
                                    { label: 'Tablet', val: deviceStats.tablet || 0, color: DEVICE_COLORS[2] },
                                ].map(item => (
                                    <div key={item.label} style={{ textAlign: 'center', padding: '6px 4px', borderRadius: 8, backgroundColor: 'var(--ad-surface-2)', border: '1px solid var(--ad-border)' }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: item.color, marginBottom: 2 }}>{item.label}</div>
                                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ad-text)' }}>{item.val}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </AdminCard>
                </div>
            </div>

            {/* ── SECTION 3: Hardware & Compilation ───────────────────────── */}
            <div className="ad-section">
                <h2 className="ad-section-title" style={{ marginBottom: 12 }}>
                    <Cpu style={{ color: 'var(--ad-accent)' }} />
                    Hardware & Compilation Telemetry
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {/* Board popularity */}
                    <AdminCard className="p-0">
                        <div className="ad-card-header">
                            <div>
                                <div className="ad-card-title"><Cpu style={{ color: 'var(--ad-accent)' }} /> Board Popularity</div>
                                <div className="ad-card-subtitle">Most simulated microcontroller boards</div>
                            </div>
                        </div>
                        <div className="ad-card-body ad-space-y-3">
                            {topLibraries.length > 0 ? topLibraries.map((lib, i) => (
                                <div key={i}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                                        <span style={{ color: 'var(--ad-text)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ width: 18, height: 18, borderRadius: 5, backgroundColor: 'var(--ad-surface-3)', border: '1px solid var(--ad-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--ad-accent)', flexShrink: 0 }}>
                                                {i + 1}
                                            </span>
                                            {lib.name}
                                        </span>
                                        <span style={{ color: 'var(--ad-text-2)', fontFamily: 'monospace', fontWeight: 600 }}>{lib.count}</span>
                                    </div>
                                    <div className="ad-progress">
                                        <div className="ad-progress-bar" style={{ width: `${Math.min((lib.count / (topLibraries[0]?.count || 1)) * 100, 100)}%` }} />
                                    </div>
                                </div>
                            )) : (
                                <p className="ad-text-muted" style={{ textAlign: 'center', padding: '24px 0', fontSize: 12 }}>
                                    No board telemetry recorded yet.
                                </p>
                            )}
                        </div>
                    </AdminCard>

                    {/* Compilation reliability */}
                    <AdminCard className="p-0">
                        <div className="ad-card-header">
                            <div>
                                <div className="ad-card-title"><Activity style={{ color: 'var(--ad-emerald)' }} /> Compilation Reliability</div>
                                <div className="ad-card-subtitle">7-day success vs. fail rates (Avg: {stats?.avgCompileTime ?? '—'})</div>
                            </div>
                        </div>
                        <div className="ad-card-body" style={{ paddingTop: 16 }}>
                            <div style={{ height: 210 }}>
                                {compileData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={compileData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--ad-border)" vertical={false} />
                                            <XAxis dataKey="date" stroke="var(--ad-text-3)" fontSize={11} tickLine={false} />
                                            <YAxis stroke="var(--ad-text-3)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                                            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--ad-surface-2)' }} />
                                            <Legend wrapperStyle={{ fontSize: 11 }} />
                                            <Bar dataKey="success" name="Success" fill="var(--ad-emerald)" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="fail" name="Failed" fill="var(--ad-red)" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                        <Activity style={{ width: 32, height: 32, color: 'var(--ad-border)' }} />
                                        <span className="ad-text-muted" style={{ fontSize: 12 }}>No compilation data in the last 7 days</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </AdminCard>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsTab;
