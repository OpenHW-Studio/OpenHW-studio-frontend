import React, { useState } from 'react';
import { Box, Download, Trash2, Terminal, Search, Info, CheckCircle, RefreshCw, Activity, Layers, Zap } from 'lucide-react';
import AdminCard from './AdminCard';

const DockerTab = ({ logs, infraStatus, onRestart, onClear }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [restarting, setRestarting] = useState(new Set());
    
    const handleRestart = async (name) => {
        setRestarting(prev => new Set(prev).add(name));
        try {
            await onRestart(name);
        } finally {
            setRestarting(prev => {
                const next = new Set(prev);
                next.delete(name);
                return next;
            });
        }
    };

    // Filter logs that look like Docker logs
    const dockerLogs = logs.filter(l => 
        l.type === 'docker' ||
        l.type === 'error' ||
        l.msg.toLowerCase().includes('docker') || 
        l.msg.toLowerCase().includes('container') || 
        l.msg.toLowerCase().includes('image') ||
        l.msg.toLowerCase().includes('active') ||
        l.msg.toLowerCase().includes('infrastructure')
    ).filter(l => 
        l.msg.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.details && l.details.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const handleDownload = () => {
        const content = dockerLogs.map(l => `[${l.time}] [${l.type.toUpperCase()}] ${l.msg}${l.details ? '\n' + l.details : ''}`).join('\n\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `docker_infrastructure_logs_${new Date().toISOString().split('T')[0]}.log`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-12 animate-in fade-in duration-500 pb-20">
            {/* Core Services Section */}
            <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-blue-600/20 rounded-lg text-blue-500">
                            <Box className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">Core Services</h2>
                    </div>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {infraStatus.map((service, i) => (
                        <AdminCard key={i} className="hover:bg-white/[0.04] transition-all border border-white/5 shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Layers className="w-32 h-32 rotate-12" />
                            </div>
                            <div className="space-y-8 relative z-10">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-2">
                                        <h3 className="text-3xl font-black text-white capitalize tracking-tighter">{service.name}</h3>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2.5 h-2.5 rounded-full ${service.status === 'running' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-red-500'} animate-pulse`}></div>
                                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{service.status}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <span className="text-[10px] font-black px-4 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 uppercase tracking-widest italic">
                                            {service.uptime}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-1 min-w-0">
                                        <p className="text-[10px] uppercase font-black tracking-widest text-slate-600">Image Version</p>
                                        <p className="text-lg font-black text-blue-400 font-mono truncate" title={service.version}>{service.version}</p>
                                    </div>
                                    <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-1 min-w-0">
                                        <p className="text-[10px] uppercase font-black tracking-widest text-slate-600">Short Hash</p>
                                        <p className="text-lg font-mono font-bold text-slate-300 truncate" title={service.hash}>{service.hash?.slice(0, 8)}</p>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button 
                                        disabled={restarting.has(service.name)}
                                        onClick={() => handleRestart(service.name)}
                                        className="flex-1 flex items-center justify-center gap-3 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-300 transition-all border border-white/5 disabled:opacity-30"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${restarting.has(service.name) ? 'animate-spin' : ''}`} />
                                        {restarting.has(service.name) ? 'Restarting...' : 'Restart'}
                                    </button>
                                    <button 
                                        onClick={() => setSearchQuery(service.name)}
                                        className="flex-1 flex items-center justify-center gap-3 py-4 bg-blue-600/10 hover:bg-blue-600/20 rounded-2xl text-xs font-black uppercase tracking-widest text-blue-400 transition-all border border-blue-500/10"
                                    >
                                        <Activity className="w-4 h-4" /> Logs
                                    </button>
                                </div>

                                {/* Resource Pulse Section */}
                                <div className="pt-6 border-t border-white/5 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <Zap className="w-3.5 h-3.5 text-blue-500" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Resource Pulse</span>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[8px] font-black uppercase text-slate-600">CPU</span>
                                                <span className="text-xs font-black text-white">{service.resources?.cpu || '0%'}</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-[8px] font-black uppercase text-slate-600">RAM</span>
                                                <span className="text-xs font-black text-white">{service.resources?.memPerc || '0%'}</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-[8px] font-black uppercase text-slate-600">Load</span>
                                                <span className="text-xs font-black text-white">{service.resources?.load || '0.00'}</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-[8px] font-black uppercase text-slate-600">Storage</span>
                                                <span className="text-xs font-black text-white">{service.resources?.storage || '0B'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden flex">
                                        <div 
                                            style={{ width: service.resources?.cpu || '0%' }} 
                                            className="h-full bg-blue-500 transition-all duration-1000"
                                        ></div>
                                        <div 
                                            style={{ width: service.resources?.memPerc || '0%' }} 
                                            className="h-full bg-indigo-500 transition-all duration-1000 opacity-50"
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </AdminCard>
                    ))}
                </div>
            </div>

            {/* Header / Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <AdminCard className="bg-blue-600/10 border-blue-500/20">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600/20 rounded-xl text-blue-500">
                            <Box className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-black tracking-widest text-blue-400 opacity-60">Status</p>
                            <h3 className="text-xl font-black text-white">Running</h3>
                        </div>
                    </div>
                </AdminCard>
                <AdminCard className="bg-emerald-600/10 border-emerald-500/20">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-600/20 rounded-xl text-emerald-500">
                            <CheckCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-black tracking-widest text-emerald-400 opacity-60">Health</p>
                            <h3 className="text-xl font-black text-white">Healthy</h3>
                        </div>
                    </div>
                </AdminCard>
                <AdminCard className="bg-amber-600/10 border-amber-500/20">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-600/20 rounded-xl text-amber-500">
                            <Info className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-black tracking-widest text-amber-400 opacity-60">Events</p>
                            <h3 className="text-xl font-black text-white">{dockerLogs.length} Records</h3>
                        </div>
                    </div>
                </AdminCard>
            </div>

            <div className="bg-[#0d1525] rounded-3xl border border-white/5 flex flex-col h-[calc(100vh-400px)] shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/5">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative flex-1 md:w-80">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input 
                                type="text" 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Filter infrastructure logs..."
                                className="w-full bg-[#070b14] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-all font-bold"
                            />
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button 
                            onClick={handleDownload}
                            className="flex-1 md:flex-none px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-white/5 flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest"
                        >
                            <Download className="w-4 h-4" /> Export
                        </button>
                        <button 
                            onClick={onClear}
                            className="flex-1 md:flex-none px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all border border-red-500/20 flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest"
                        >
                            <Trash2 className="w-4 h-4" /> Clear
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 font-mono text-sm space-y-4 bg-[#070b14]/80 custom-scrollbar">
                    {dockerLogs.map((log, i) => (
                        <div key={i} className="flex gap-6 group border-b border-white/[0.02] pb-4 last:border-0 hover:bg-white/[0.02] transition-all">
                            <span className="text-slate-600 shrink-0 font-bold tabular-nums">
                                [{log.time.includes(':') ? log.time : new Date(log.time).toLocaleTimeString([], { hour12: false })}]
                            </span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-widest ${
                                        log.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                                    }`}>
                                        Docker
                                    </span>
                                    <span className="text-slate-200 font-bold leading-relaxed truncate">{log.msg}</span>
                                </div>
                                {log.details && (
                                    <div className="mt-3 relative">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600/30 rounded-full"></div>
                                        <pre className="pl-6 py-2 text-[11px] text-slate-500 overflow-x-auto whitespace-pre-wrap font-mono leading-normal">
                                            {log.details}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {dockerLogs.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center space-y-6 opacity-20 py-20">
                            <Box className="w-16 h-16 text-slate-500" />
                            <div className="text-slate-500 text-center italic font-black uppercase tracking-[0.4em]">
                                No infrastructure events found
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DockerTab;
