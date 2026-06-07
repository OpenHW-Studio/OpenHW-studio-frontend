import React from 'react';
import { XCircle, Search, RefreshCw, Library, CheckCircle2 } from 'lucide-react';

export const LibrarySearchModal = ({ 
    isOpen, 
    onClose, 
    libSearchQuery, 
    setLibSearchQuery, 
    isSearchingLibs, 
    onSearch, 
    libSearchResults, 
    installedLibraries, 
    onInstall 
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-2 sm:p-6 animate-in fade-in duration-300">
            <div className="bg-[#0d1525] border border-white/5 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[85vh]">
                <div className="p-6 sm:p-10 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">Registry</h2>
                        <p className="text-[10px] sm:text-sm text-slate-400 mt-1 uppercase tracking-widest font-bold">Arduino Manager</p>
                    </div>
                    <button onClick={onClose} className="p-2 sm:p-3 hover:bg-white/5 rounded-full transition-colors text-slate-500">
                        <XCircle className="w-6 h-6 sm:w-8 h-8" />
                    </button>
                </div>
                
                <div className="p-6 sm:p-10 flex flex-col flex-1 overflow-hidden">
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-8">
                        <div className="relative flex-1 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors z-10" />
                            <input 
                                type="text" 
                                placeholder="Search registry..." 
                                className="w-full bg-[#050a15] border border-white/5 rounded-xl py-4 pl-12 pr-6 text-lg text-white focus:outline-none focus:border-blue-500/50 transition-all font-bold shadow-inner"
                                value={libSearchQuery}
                                onChange={(e) => setLibSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                            />
                        </div>
                        <button 
                            onClick={onSearch}
                            disabled={isSearchingLibs}
                            className="px-10 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-900/20 text-white flex justify-center items-center min-w-[140px]"
                        >
                            {isSearchingLibs ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Search'}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                        {libSearchResults.length > 0 ? (
                            <div className="space-y-4">
                                {libSearchResults.map((lib, idx) => {
                                    const details = lib.latest || {};
                                    const isInstalled = installedLibraries.some(l => l.library.name === lib.name);
                                    return (
                                        <div key={idx} className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 group hover:bg-white/[0.05] hover:border-blue-500/20 transition-all">
                                            <div className="flex-1 min-w-0 space-y-2">
                                                <div className="flex items-center gap-3">
                                                    <h4 className="font-black text-xl text-white truncate tracking-tight">{lib.name}</h4>
                                                    <span className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-md border border-blue-500/20 font-black uppercase tracking-widest shrink-0">
                                                        v{details.version || '1.0.0'}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-400 font-medium leading-relaxed">
                                                    {details.sentence || details.paragraph || 'Official hardware abstraction layer for specialized component interaction.'}
                                                </p>
                                                <div className="flex flex-wrap items-center gap-4 pt-1">
                                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5">
                                                        <div className="w-1 h-1 rounded-full bg-slate-600"></div>
                                                        by {details.author || details.maintainer || 'Arduino Registry'}
                                                    </span>
                                                    {details.website && (
                                                        <a 
                                                            href={details.website} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="text-[10px] text-blue-500 font-black uppercase tracking-widest hover:text-blue-400 transition-colors flex items-center gap-1"
                                                        >
                                                            Visit Website
                                                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => onInstall(lib.name)}
                                                disabled={isInstalled}
                                                className={`w-full sm:w-auto px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all whitespace-nowrap shadow-xl ${
                                                    isInstalled 
                                                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5' 
                                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'
                                                }`}
                                            >
                                                {isInstalled ? 'Installed' : 'Install'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4 opacity-50">
                                <Library className="w-12 h-12 sm:w-16 h-16" />
                                <p className="font-bold text-xs sm:text-sm tracking-widest uppercase">Search for official libraries</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const TranspileModal = ({ data, onClose }) => {
    if (!data) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-2 sm:p-6 animate-in fade-in duration-300">
            <div className="bg-[#0d1525] border border-white/5 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[85vh]">
                <div className="p-6 sm:p-10 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">Verification</h2>
                        <p className="text-[10px] sm:text-sm text-slate-400 mt-1 uppercase tracking-widest font-bold">{data.label}</p>
                    </div>
                    <button onClick={onClose} className="p-2 sm:p-3 hover:bg-white/5 rounded-full transition-colors text-slate-500">
                        <XCircle className="w-6 h-6 sm:w-8 h-8" />
                    </button>
                </div>
                <div className="p-6 sm:p-10 space-y-3 sm:space-y-4 overflow-y-auto custom-scrollbar flex-1">
                    {data.results.map((r, i) => (
                        <div key={i} className={`p-4 sm:p-6 rounded-xl border transition-all ${r.ok ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                            <div className="flex justify-between items-center mb-3 sm:mb-4">
                                <span className="font-mono text-xs sm:text-sm font-bold text-slate-200">{r.file}</span>
                                {r.ok ? <CheckCircle2 className="w-4 h-4 sm:w-5 h-5 text-emerald-500" /> : <XCircle className="w-4 h-4 sm:w-5 h-5 text-red-500" />}
                            </div>
                            {!r.ok && <pre className="text-[10px] sm:text-xs text-red-400 bg-black/30 p-3 sm:p-4 rounded-xl overflow-x-auto whitespace-pre-wrap border border-red-500/10 font-mono">{r.error}</pre>}
                            {r.ok && <div className="text-[10px] text-emerald-500 font-black uppercase tracking-[0.2em]">{r.lines} lines OK</div>}
                        </div>
                    ))}
                </div>
                <div className="p-6 sm:p-10 bg-white/5 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="w-full sm:w-auto px-8 py-3 sm:py-4 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold transition-all border border-white/5 text-white shadow-xl"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
