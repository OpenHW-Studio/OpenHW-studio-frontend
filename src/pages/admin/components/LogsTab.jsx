import React from 'react';
import { XCircle, CheckCircle2, AlertCircle, Download, Trash2, Terminal } from 'lucide-react';

const LogsTab = ({ logs, onClear }) => {
    // Filter out Docker/Infrastructure logs to keep System Logs clean
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
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `system_logs_${new Date().toISOString().split('T')[0]}.log`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="bg-[#0d1525] rounded-xl md:rounded-2xl border border-white/5 flex flex-col h-[calc(100vh-200px)] md:h-[calc(100vh-250px)] shadow-2xl overflow-hidden">
            <div className="p-4 md:p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-blue-600/20 rounded-lg text-blue-500">
                        <Terminal className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-sm md:text-base font-black text-white uppercase tracking-tight">Management Console</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Live Monitoring Active</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-2 md:gap-4">
                    <button 
                        onClick={handleDownload}
                        className="p-2 md:px-4 md:py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg md:rounded-xl transition-all border border-white/5 flex items-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-widest"
                        title="Download Logs"
                    >
                        <Download className="w-4 h-4" />
                        <span className="hidden md:inline">Export</span>
                    </button>
                    <button 
                        onClick={onClear}
                        className="p-2 md:px-4 md:py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg md:rounded-xl transition-all border border-red-500/20 flex items-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-widest"
                        title="Clear Console"
                    >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden md:inline">Clear</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-10 font-mono text-[11px] md:text-sm space-y-3 bg-[#070b14]/80 custom-scrollbar">
                {systemLogs.map((log, i) => (
                    <div key={i} className="flex gap-4 md:gap-6 group border-b border-white/[0.02] pb-2 last:border-0 hover:bg-white/[0.02] transition-all">
                        <span className="text-slate-600 shrink-0 font-bold tabular-nums">
                            {log.time.includes(':') ? log.time : new Date(log.time).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className={`shrink-0 ${log.type === 'error' ? 'text-red-500' : log.type === 'success' ? 'text-emerald-500' : 'text-blue-500'}`}>
                            {log.type === 'error' ? <XCircle className="w-4 h-4" /> : log.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        </span>
                        <div className="flex-1 min-w-0">
                            <span className={`break-words font-medium leading-relaxed ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-emerald-400' : 'text-slate-300'}`}>
                                {log.msg}
                            </span>
                            {log.details && (
                                <pre className="mt-2 p-4 bg-black/40 rounded-lg border border-white/5 text-[10px] text-slate-500 overflow-x-auto whitespace-pre-wrap font-mono leading-normal">
                                    {log.details}
                                </pre>
                            )}
                        </div>
                    </div>
                ))}
                {systemLogs.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center space-y-6 opacity-20">
                        <Terminal className="w-16 h-16 text-slate-500" />
                        <div className="text-slate-500 text-center italic font-black uppercase tracking-[0.4em]">
                            Awaiting System Events
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LogsTab;
