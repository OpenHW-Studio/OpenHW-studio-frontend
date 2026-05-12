import React from 'react';
import { Terminal, Download, Play, CheckCircle2, XCircle, Package } from 'lucide-react';
import AdminCard from './AdminCard';

const ApprovalsTab = ({ pendingComponents, onPreview, onDownload, onTest, onApprove, onReject }) => {
    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 md:gap-12">
            {pendingComponents.map((comp) => (
                <AdminCard key={comp.id} className="hover:bg-white/[0.04]">
                    <div className="flex justify-between items-start mb-8">
                        <div className="min-w-0 flex-1">
                            <h3 className="text-2xl font-black text-white truncate">{comp.manifest.label}</h3>
                            <p className="text-xs text-slate-500 mt-2 font-mono truncate uppercase tracking-widest">{comp.id}</p>
                        </div>
                        <span className="bg-blue-500/10 text-blue-400 text-xs font-bold px-3 py-1 rounded uppercase tracking-wider shrink-0 ml-4 border border-blue-500/20">
                            {comp.manifest.type || 'Custom'}
                        </span>
                    </div>
                    
                    <div className="flex-1 space-y-4 mb-10">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500 font-bold uppercase tracking-widest">Group</span>
                            <span className="text-slate-300 font-black">{comp.manifest.group || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500 font-bold uppercase tracking-widest">Submitted</span>
                            <span className="text-slate-300 font-black">
                                {comp.timestamp ? new Date(comp.timestamp).toLocaleDateString() : 'Unknown'}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <button onClick={() => onPreview(comp)} className="flex flex-col items-center gap-2 p-3 bg-slate-900/80 rounded-xl hover:bg-slate-800 transition-colors text-[10px] font-black uppercase tracking-widest text-slate-400 border border-white/5">
                            <Terminal className="w-5 h-5 text-blue-500" /> Transpile
                        </button>
                        <button onClick={() => onDownload(comp)} className="flex flex-col items-center gap-2 p-3 bg-slate-900/80 rounded-xl hover:bg-slate-800 transition-colors text-[10px] font-black uppercase tracking-widest text-slate-400 border border-white/5">
                            <Download className="w-5 h-5 text-emerald-500" /> ZIP
                        </button>
                        <button onClick={() => onTest(comp)} className="flex flex-col items-center gap-2 p-3 bg-slate-900/80 rounded-xl hover:bg-slate-800 transition-colors text-[10px] font-black uppercase tracking-widest text-slate-400 border border-white/5">
                            <Play className="w-5 h-5 text-amber-500" /> Test
                        </button>
                        <div className="flex gap-2">
                            <button onClick={() => onApprove(comp)} className="flex-1 p-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all flex items-center justify-center shadow-lg shadow-emerald-900/20">
                                <CheckCircle2 className="w-5 h-5 text-white" />
                            </button>
                            <button onClick={() => onReject(comp)} className="flex-1 p-3 bg-red-600 hover:bg-red-500 rounded-xl transition-all flex items-center justify-center shadow-lg shadow-red-900/20">
                                <XCircle className="w-5 h-5 text-white" />
                            </button>
                        </div>
                    </div>
                </AdminCard>
            ))}
            {pendingComponents.length === 0 && (
                <div className="col-span-full py-40 bg-[#0d1525]/30 border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center text-slate-500">
                    <Package className="w-16 h-16 mb-6 opacity-20" />
                    <p className="font-black text-xl uppercase tracking-[0.3em]">No components awaiting approval</p>
                </div>
            )}
        </div>
    );
};

export default ApprovalsTab;
