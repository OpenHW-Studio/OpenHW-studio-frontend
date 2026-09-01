import React, { useState, useMemo } from 'react';
import { 
    Activity, 
    TrendingUp, 
    Users, 
    Zap, 
    Clock, 
    Globe, 
    Smartphone, 
    Monitor, 
    Cpu, 
    PieChart as PieIcon, 
    Layers,
    CheckCircle,
    XCircle,
    BarChart3,
    GraduationCap,
    BookOpen,
    UserCheck,
    Shield,
    Calendar,
    Award
} from 'lucide-react';
import AdminCard from './AdminCard';
import { 
    AreaChart, 
    Area, 
    BarChart, 
    Bar, 
    PieChart, 
    Pie, 
    Cell, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer,
    Legend
} from 'recharts';

const ROLE_COLORS = {
    student: '#06b6d4', // Cyan
    teacher: '#a855f7', // Purple
    user: '#3b82f6',    // Blue
    admin: '#f59e0b'    // Amber
};

const DEVICE_COLORS = ['#3b82f6', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b'];

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="p-3 bg-[#0a0f1d] border border-white/20 rounded-xl shadow-2xl text-xs">
                <p className="font-black text-slate-300 mb-1">{label}</p>
                {payload.map((entry, index) => (
                    <p key={index} style={{ color: entry.color }} className="font-bold flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                        {entry.name}: <span className="font-mono text-white">{entry.value}</span>
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const AnalyticsTab = ({ stats }) => {
    const [userTimeframe, setUserTimeframe] = useState('allTime'); // 'allTime', 'month', 'week', 'today'

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

    // Current timeframe user data
    const activeUserData = registeredUsers[userTimeframe] || registeredUsers.allTime;

    // Role Pie Chart Data
    const rolePieData = useMemo(() => {
        const roles = [
            { name: 'Students', value: activeUserData.student || 0, color: ROLE_COLORS.student },
            { name: 'Teachers', value: activeUserData.teacher || 0, color: ROLE_COLORS.teacher },
            { name: 'General Users', value: activeUserData.user || 0, color: ROLE_COLORS.user },
            { name: 'Admins', value: activeUserData.admin || 0, color: ROLE_COLORS.admin }
        ].filter(r => r.value > 0);

        if (roles.length === 0) {
            return [{ name: 'No registered users', value: 1, color: '#334155' }];
        }
        return roles;
    }, [activeUserData]);

    // Registration Timeline Data
    const regTimelineData = useMemo(() => {
        if (registeredUsers.timeline && registeredUsers.timeline.length > 0) {
            return registeredUsers.timeline.map(item => ({
                date: item.date ? item.date.slice(5) : '', // "MM-DD"
                Students: item.student || 0,
                Teachers: item.teacher || 0,
                Users: item.user || 0,
                Total: item.total || 0
            }));
        }
        return [];
    }, [registeredUsers]);

    // Traffic timeline
    const trafficTimelineData = useMemo(() => {
        if (rawTimeline.length > 0) {
            return rawTimeline.map(item => ({
                date: item.date ? item.date.slice(5) : '',
                visitors: item.visitors || 0,
                hits: item.hits || 0
            }));
        }
        return [];
    }, [rawTimeline]);

    // Compilation history
    const compileData = useMemo(() => {
        if (compilationHistory.length > 0) {
            return compilationHistory.map(item => ({
                date: item.date ? item.date.slice(5) : '',
                success: item.success || 0,
                fail: item.fail || 0
            }));
        }
        return [];
    }, [compilationHistory]);

    // Device breakdown
    const deviceData = useMemo(() => {
        const total = (deviceStats.desktop + deviceStats.mobile + deviceStats.tablet) || 1;
        return [
            { name: 'Desktop', value: deviceStats.desktop || (total === 1 ? 85 : 0) },
            { name: 'Mobile', value: deviceStats.mobile || (total === 1 ? 12 : 0) },
            { name: 'Tablet', value: deviceStats.tablet || (total === 1 ? 3 : 0) }
        ].filter(d => d.value > 0);
    }, [deviceStats]);

    const activeSessions = stats?.activeSessions || 0;
    const totalSimulations = stats?.totalSimulations ?? 0;
    const avgCompileTime = stats?.avgCompileTime ?? '1.2s';

    return (
        <div className="space-y-8 animate-in fade-in duration-500 text-slate-100 w-full">
            {/* ─── 1. USER REGISTRATION & ROLE ANALYTICS ─────────────────────── */}
            <AdminCard className="bg-[#0b101e] border-white/10 p-6 md:p-8 shadow-2xl">
                {/* Header with Timeframe Filter */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-white/10 mb-6">
                    <div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2.5">
                            <UserCheck className="w-6 h-6 text-cyan-400" />
                            Registered User Analytics & Roles
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Breakdown of student, teacher, and general user registrations
                        </p>
                    </div>

                    {/* Timeframe Buttons */}
                    <div className="flex items-center bg-black/60 p-1.5 rounded-xl border border-white/15 gap-1">
                        {[
                            { id: 'allTime', label: 'All Time' },
                            { id: 'month', label: 'This Month' },
                            { id: 'week', label: 'This Week' },
                            { id: 'today', label: 'Today (24h)' },
                        ].map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setUserTimeframe(t.id)}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    userTimeframe === t.id
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Role Metric Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {/* Total Users */}
                    <div className="p-5 rounded-2xl bg-[#111728] border border-white/10 shadow-lg">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Users</span>
                            <Users className="w-5 h-5 text-slate-300" />
                        </div>
                        <div className="text-3xl font-black text-white">{activeUserData.total || 0}</div>
                        <p className="text-[11px] text-slate-400 font-medium mt-1">
                            {userTimeframe === 'allTime' ? 'All-time registered' : `New ${userTimeframe} accounts`}
                        </p>
                    </div>

                    {/* Students */}
                    <div className="p-5 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 shadow-lg">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Students</span>
                            <GraduationCap className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div className="text-3xl font-black text-cyan-300">{activeUserData.student || 0}</div>
                        <p className="text-[11px] text-slate-400 font-medium mt-1">
                            {activeUserData.total > 0 ? `${Math.round(((activeUserData.student || 0) / activeUserData.total) * 100)}% of total` : '0%'}
                        </p>
                    </div>

                    {/* Teachers */}
                    <div className="p-5 rounded-2xl bg-purple-950/30 border border-purple-500/30 shadow-lg">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Teachers</span>
                            <BookOpen className="w-5 h-5 text-purple-400" />
                        </div>
                        <div className="text-3xl font-black text-purple-300">{activeUserData.teacher || 0}</div>
                        <p className="text-[11px] text-slate-400 font-medium mt-1">
                            {activeUserData.total > 0 ? `${Math.round(((activeUserData.teacher || 0) / activeUserData.total) * 100)}% of total` : '0%'}
                        </p>
                    </div>

                    {/* General Users / Hobbyists */}
                    <div className="p-5 rounded-2xl bg-blue-950/30 border border-blue-500/30 shadow-lg">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">General Users</span>
                            <Award className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="text-3xl font-black text-blue-300">{activeUserData.user || 0}</div>
                        <p className="text-[11px] text-slate-400 font-medium mt-1">
                            {activeUserData.total > 0 ? `${Math.round(((activeUserData.user || 0) / activeUserData.total) * 100)}% of total` : '0%'}
                        </p>
                    </div>
                </div>

                {/* Registration Graphs Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                    {/* 14-Day Registration Trend Chart */}
                    <div className="lg:col-span-2">
                        <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-cyan-400" />
                            Daily Registration Timeline (Last 14 Days)
                        </h4>
                        <div className="h-[260px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={regTimelineData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                                    <Bar dataKey="Students" stackId="a" fill={ROLE_COLORS.student} radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="Teachers" stackId="a" fill={ROLE_COLORS.teacher} radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="Users" stackId="a" fill={ROLE_COLORS.user} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Role Distribution Donut Chart */}
                    <div className="flex flex-col items-center justify-center p-4 bg-[#111728] rounded-2xl border border-white/5">
                        <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider mb-2">
                            Role Ratio ({userTimeframe === 'allTime' ? 'All Time' : userTimeframe})
                        </h4>
                        <div className="h-[180px] w-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={rolePieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={45}
                                        outerRadius={70}
                                        paddingAngle={4}
                                        dataKey="value"
                                    >
                                        {rolePieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-xl font-black text-white">{activeUserData.total || 0}</span>
                                <span className="text-[9px] font-black uppercase text-slate-400">Users</span>
                            </div>
                        </div>

                        {/* Legend Chips */}
                        <div className="flex flex-wrap justify-center gap-2 mt-2">
                            <span className="flex items-center gap-1.5 text-[11px] text-slate-300">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ROLE_COLORS.student }}></span>
                                Students ({activeUserData.student || 0})
                            </span>
                            <span className="flex items-center gap-1.5 text-[11px] text-slate-300">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ROLE_COLORS.teacher }}></span>
                                Teachers ({activeUserData.teacher || 0})
                            </span>
                            <span className="flex items-center gap-1.5 text-[11px] text-slate-300">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ROLE_COLORS.user }}></span>
                                Users ({activeUserData.user || 0})
                            </span>
                        </div>
                    </div>
                </div>
            </AdminCard>

            {/* ─── 2. VISITOR TRAFFIC & PLATFORM TELEMETRY ────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Traffic Trend Over Time */}
                <AdminCard className="lg:col-span-2 bg-[#0b101e] border-white/10 p-6 shadow-2xl">
                    <div className="flex items-center justify-between mb-6 pb-3 border-b border-white/10">
                        <div>
                            <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-cyan-400" />
                                Visitor Traffic & Session Growth
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">Daily visitor footprint and interactive simulation requests</p>
                        </div>
                    </div>

                    <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trafficTimelineData}>
                                <defs>
                                    <linearGradient id="visitorGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0}/>
                                    </linearGradient>
                                    <linearGradient id="hitsGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                                <Area type="monotone" dataKey="visitors" name="Unique Visitors" stroke="#06b6d4" strokeWidth={2.5} fillOpacity={1} fill="url(#visitorGradient)" />
                                <Area type="monotone" dataKey="hits" name="Session Hits" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#hitsGradient)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </AdminCard>

                {/* Device & Client Platforms */}
                <AdminCard className="bg-[#0b101e] border-white/10 p-6 shadow-2xl flex flex-col justify-between">
                    <div>
                        <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2 mb-1">
                            <Monitor className="w-5 h-5 text-purple-400" />
                            Client Devices & Hardware
                        </h3>
                        <p className="text-xs text-slate-400 mb-4 pb-3 border-b border-white/10">Device footprint based on user agents</p>
                    </div>

                    <div className="h-[180px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={deviceData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={45}
                                    outerRadius={68}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {deviceData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={DEVICE_COLORS[index % DEVICE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <Smartphone className="w-5 h-5 text-slate-400 mb-0.5" />
                            <span className="text-[10px] font-black uppercase text-slate-400">Devices</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/10 text-center">
                        <div className="p-2 bg-white/5 rounded-xl">
                            <span className="text-[10px] uppercase font-bold text-blue-400">Desktop</span>
                            <div className="text-sm font-black text-white mt-0.5">{deviceStats.desktop || 0}</div>
                        </div>
                        <div className="p-2 bg-white/5 rounded-xl">
                            <span className="text-[10px] uppercase font-bold text-cyan-400">Mobile</span>
                            <div className="text-sm font-black text-white mt-0.5">{deviceStats.mobile || 0}</div>
                        </div>
                        <div className="p-2 bg-white/5 rounded-xl">
                            <span className="text-[10px] uppercase font-bold text-purple-400">Tablet</span>
                            <div className="text-sm font-black text-white mt-0.5">{deviceStats.tablet || 0}</div>
                        </div>
                    </div>
                </AdminCard>
            </div>

            {/* ─── 3. HARDWARE & COMPILATION TELEMETRY ───────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Microcontroller Hardware Usage */}
                <AdminCard className="bg-[#0b101e] border-white/10 p-6 shadow-2xl">
                    <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/10">
                        <div>
                            <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                                <Cpu className="w-5 h-5 text-blue-400" />
                                Hardware Board Popularity
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">Most simulated boards in projects</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {topLibraries.length > 0 ? (
                            topLibraries.map((lib, i) => (
                                <div key={i} className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs font-bold">
                                        <span className="text-slate-200 flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-md bg-blue-500/10 text-blue-400 flex items-center justify-center font-mono text-[10px] border border-blue-500/20">
                                                #{i + 1}
                                            </span>
                                            {lib.name}
                                        </span>
                                        <span className="text-white font-mono">{lib.count} projects</span>
                                    </div>
                                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"
                                            style={{ width: `${Math.min((lib.count / (topLibraries[0]?.count || 1)) * 100, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 text-slate-500 text-xs">
                                No board simulation telemetry recorded yet.
                            </div>
                        )}
                    </div>
                </AdminCard>

                {/* Compilation Reliability Telemetry */}
                <AdminCard className="bg-[#0b101e] border-white/10 p-6 shadow-2xl">
                    <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/10">
                        <div>
                            <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                                <Activity className="w-5 h-5 text-emerald-400" />
                                Compilation Reliability & Latency
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">7-day build reliability metrics (Avg: {avgCompileTime})</p>
                        </div>
                    </div>

                    <div className="h-[220px] w-full">
                        {compileData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={compileData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                                    <Bar dataKey="success" name="Successful Compiles" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="fail" name="Failed Compiles" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs">
                                <Activity className="w-8 h-8 text-slate-700 mb-2 opacity-50" />
                                No compilation events recorded in the last 7 days.
                            </div>
                        )}
                    </div>
                </AdminCard>
            </div>
        </div>
    );
};

export default AnalyticsTab;
