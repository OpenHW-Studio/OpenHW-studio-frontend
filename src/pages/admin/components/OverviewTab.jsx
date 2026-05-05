import React from 'react';
import { 
    Activity, Users, Zap, Database, TrendingUp, 
    ArrowUpRight, ArrowDownRight, Clock, Box 
} from 'lucide-react';
import AdminCard from './AdminCard';

const OverviewTab = ({ stats }) => {
    if (!stats) return (
        <div className="flex flex-col items-center justify-center py-40 animate-pulse">
            <Activity className="w-12 h-12 text-slate-700 mb-4" />
            <p className="text-slate-600 font-black uppercase tracking-[0.3em]">Loading Analytics...</p>
        </div>
    );

    const mainStats = [
        { label: 'Total Simulations', value: stats.totalSimulations ?? 'N/A', icon: Zap, color: 'blue', change: stats.totalSimulations ? '+12%' : '0%', up: true },
        { label: 'Active Sessions', value: stats.activeSessions ?? 'N/A', icon: Users, color: 'emerald', change: stats.activeSessions ? '+5%' : '0%', up: true },
        { label: 'Avg Compile Time', value: stats.avgCompileTime ?? 'N/A', icon: Clock, color: 'amber', change: stats.avgCompileTime ? '-2s' : '0s', up: true },
        { label: 'Cloud Storage', value: stats.storageUsed ?? 'N/A', icon: Database, color: 'purple', change: stats.storageUsed ? '+1.2G' : '0G', up: false },
    ];

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {mainStats.map((item, i) => (
                    <AdminCard key={i} className="hover:bg-white/[0.04] transition-all border-white/5 relative overflow-hidden group">
                        <div className="flex justify-between items-start relative z-10">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                                <p className="text-4xl font-black text-white italic tracking-tighter">{item.value}</p>
                            </div>
                            <div className={`p-3 bg-${item.color}-500/10 rounded-2xl text-${item.color}-500 group-hover:scale-110 transition-transform`}>
                                <item.icon className="w-6 h-6" />
                            </div>
                        </div>
                        <div className="mt-6 flex items-center gap-2">
                            <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${item.up ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                {item.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                {item.change}
                            </div>
                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">since last week</span>
                        </div>
                    </AdminCard>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Main Graph Area */}
                <AdminCard className="xl:col-span-2 border-white/5 bg-[#0a0f1a]/40 p-8">
                    <div className="flex items-center justify-between mb-12">
                        <div className="space-y-1">
                            <h3 className="text-xl font-black text-white uppercase tracking-tight">Compilation Success Rate</h3>
                            <p className="text-xs text-slate-500 font-bold">Daily performance tracking of the backend compiler</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Success</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Failed</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-64 flex items-end justify-between gap-4 px-2 relative">
                        {stats.compilationHistory && stats.compilationHistory.length > 0 ? (
                            stats.compilationHistory.map((day, i) => {
                                const total = day.success + day.fail;
                                const successHeight = (day.success / 600) * 100;
                                const failHeight = (day.fail / 600) * 100;
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-3 group/bar">
                                        <div className="w-full relative flex flex-col justify-end gap-1 h-full min-h-[10px]">
                                            {/* Fail Segment */}
                                            <div 
                                                style={{ height: `${failHeight}%` }} 
                                                className="w-full bg-red-500/30 group-hover/bar:bg-red-500/50 rounded-t-sm transition-all relative"
                                            ></div>
                                            {/* Success Segment */}
                                            <div 
                                                style={{ height: `${successHeight}%` }} 
                                                className="w-full bg-blue-600/60 group-hover/bar:bg-blue-600/80 rounded-t-sm transition-all shadow-[0_0_15px_rgba(37,99,235,0.2)]"
                                            ></div>
                                            
                                            {/* Tooltip */}
                                            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 bg-white text-black p-3 rounded-xl opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none z-50 shadow-2xl min-w-[120px]">
                                                <p className="text-[9px] font-black uppercase text-slate-400 mb-1">{day.date}</p>
                                                <p className="text-xs font-black">✅ {day.success} Success</p>
                                                <p className="text-xs font-black text-red-500">❌ {day.fail} Failed</p>
                                            </div>
                                        </div>
                                        <span className="text-[9px] font-black text-slate-500 uppercase group-hover/bar:text-slate-300 transition-colors">
                                            {day.date.split('-').slice(1).join('/')}
                                        </span>
                                    </div>
                                )
                            })
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-700">No telemetry data available</p>
                            </div>
                        )}
                    </div>
                </AdminCard>

                {/* Top Libraries Ranking */}
                <AdminCard className="border-white/5 bg-[#0a0f1a]/40 p-8">
                    <div className="space-y-1 mb-10">
                        <h3 className="text-xl font-black text-white uppercase tracking-tight">Top Libraries</h3>
                        <p className="text-xs text-slate-500 font-bold">Most frequently installed assets</p>
                    </div>
                    <div className="space-y-6">
                        {stats.topLibraries && stats.topLibraries.length > 0 ? (
                            stats.topLibraries.map((lib, i) => (
                                <div key={i} className="space-y-2">
                                    <div className="flex justify-between items-end">
                                        <span className="text-sm font-black text-slate-200">{lib.name}</span>
                                        <span className="text-xs font-black text-blue-500">{lib.count} installs</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div 
                                            style={{ width: `${(lib.count / stats.topLibraries[0].count) * 100}%` }}
                                            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full"
                                        ></div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-10 text-center">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 italic">No usage data found</p>
                            </div>
                        )}
                    </div>
                    <button className="w-full mt-12 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 transition-all border border-white/5">
                        View Full Registry Reports
                    </button>
                </AdminCard>
            </div>
        </div>
    );
};

export default OverviewTab;
