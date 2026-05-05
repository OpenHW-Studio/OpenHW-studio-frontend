import React, { useState } from 'react';
import { ShieldCheck, Search, Filter, Calendar, User, Activity, Clock, ShieldAlert } from 'lucide-react';
import AdminCard from './AdminCard';

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

    const getActionColor = (action) => {
        if (action.includes('login')) return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
        if (action.includes('restart') || action.includes('delete')) return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
        if (action.includes('error')) return 'text-red-400 bg-red-400/10 border-red-400/20';
        return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    };

    const getActionIcon = (action) => {
        if (action.includes('login')) return User;
        if (action.includes('restart')) return Activity;
        if (action.includes('delete') || action.includes('reject')) return ShieldAlert;
        return ShieldCheck;
    };

    const today = new Date().toLocaleDateString();
    const loginsToday = logs.filter(l => 
        l.action.toLowerCase().includes('login') && 
        new Date(l.timestamp).toLocaleDateString() === today
    ).length;

    const securityAlerts = logs.filter(l => 
        l.action.toLowerCase().includes('error') || 
        l.action.toLowerCase().includes('failed')
    ).length;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header / Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <AdminCard className="bg-emerald-600/10 border-emerald-500/20">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/60">Logins Today</p>
                            <p className="text-4xl font-black text-white italic tracking-tighter">{loginsToday}</p>
                        </div>
                        <div className="p-3 bg-emerald-500/20 rounded-2xl text-emerald-400">
                            <User className="w-6 h-6" />
                        </div>
                    </div>
                </AdminCard>
                <AdminCard className="bg-blue-600/10 border-blue-500/20">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500/60">Actions Executed</p>
                            <p className="text-4xl font-black text-white italic tracking-tighter">{logs.length}</p>
                        </div>
                        <div className="p-3 bg-blue-500/20 rounded-2xl text-blue-400">
                            <Activity className="w-6 h-6" />
                        </div>
                    </div>
                </AdminCard>
                <AdminCard className="bg-amber-600/10 border-amber-500/20">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500/60">Security Alerts</p>
                            <p className="text-4xl font-black text-white italic tracking-tighter">{securityAlerts}</p>
                        </div>
                        <div className="p-3 bg-amber-500/20 rounded-2xl text-amber-400">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                    </div>
                </AdminCard>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Search audit logs (email, action, details)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#0a0f1a] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white font-bold placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-all shadow-2xl"
                    />
                </div>
                <div className="flex gap-2 bg-[#0a0f1a] p-1.5 rounded-2xl border border-white/5 shadow-2xl">
                    {['all', 'login', 'approve', 'restart'].map(type => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                filterType === type 
                                ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]' 
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>
            </div>

            {/* Log Table */}
            <AdminCard className="overflow-hidden border-white/5 p-0 bg-[#0a0f1a]/50">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.02]">
                                <th className="text-left px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Timestamp</th>
                                <th className="text-left px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Admin Entity</th>
                                <th className="text-left px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Action Type</th>
                                <th className="text-left px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Log Details</th>
                                <th className="text-right px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Network IP</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredLogs.map((log, i) => {
                                const Icon = getActionIcon(log.action);
                                return (
                                    <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <Calendar className="w-4 h-4 text-slate-500" />
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-200">
                                                        {new Date(log.timestamp).toLocaleDateString()}
                                                    </span>
                                                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">
                                                        {new Date(log.timestamp).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 font-black text-xs">
                                                    {log.adminEmail[0].toUpperCase()}
                                                </div>
                                                <span className="text-sm font-black text-slate-300">{log.adminEmail}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${getActionColor(log.action)}`}>
                                                <Icon className="w-3.5 h-3.5" />
                                                {log.action}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <p className="text-sm font-medium text-slate-400 group-hover:text-slate-200 transition-colors italic">
                                                {log.details}
                                            </p>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <span className="text-xs font-mono font-bold text-slate-600 group-hover:text-slate-400 transition-colors">
                                                {log.ip || '127.0.0.1'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {filteredLogs.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 space-y-4 opacity-30">
                        <ShieldCheck className="w-16 h-16 text-slate-500" />
                        <p className="text-slate-500 font-black uppercase tracking-widest text-xs italic">
                            No security logs found matching criteria
                        </p>
                    </div>
                )}
            </AdminCard>
        </div>
    );
};

export default HistoryTab;
