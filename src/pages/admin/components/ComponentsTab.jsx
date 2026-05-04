import React from 'react';
import AdminCard from './AdminCard';

const ComponentsTab = ({ installedComponents, onImport, onBackup, onDelete }) => {
    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <button 
                    onClick={onImport}
                    className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-base font-black transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-900/20 text-white"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3v12" /><path d="m8 11 4 4 4-4" /><path d="M8 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4" />
                    </svg> Import components
                </button>
                <button 
                    onClick={onBackup}
                    className="flex-1 px-6 py-4 bg-slate-800 hover:bg-slate-700 rounded-lg text-base font-black transition-all border border-white/10 flex items-center justify-center gap-2 text-slate-200"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                    </svg> Backup Repository
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {installedComponents.map((comp) => (
                    <AdminCard key={comp.id} className="hover:bg-white/[0.04]">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-4 min-w-0 flex-1">
                                <div className="p-3 bg-blue-600/10 rounded-lg shrink-0">
                                    <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M16 16h.01" /><path d="M12 16h.01" /><path d="M8 16h.01" /><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" /><polyline points="9 22 9 12 15 12 15 22" />
                                    </svg>
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-black text-lg text-white truncate mb-0.5">{comp.manifest?.label || comp.id}</h3>
                                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest truncate">{comp.manifest?.type || 'Component'}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => onDelete(comp.id)}
                                className="p-2 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all ml-2"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                </svg>
                            </button>
                        </div>
                        
                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                <span className="text-slate-600">Build</span>
                                <span className="text-slate-300">v{comp.manifest?.version || '1.0.0'}</span>
                            </div>
                            <div className="text-[9px] bg-slate-900/80 p-2 rounded border border-white/5 font-mono text-blue-400 truncate">
                                {comp.id}
                            </div>
                        </div>
                    </AdminCard>
                ))}
            </div>
        </div>
    );
};

export default ComponentsTab;
