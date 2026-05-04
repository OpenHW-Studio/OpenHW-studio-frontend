import React from 'react';
import AdminCard from './AdminCard';

const LibrariesTab = ({ libraries, searchQuery, setSearchQuery, onAddLibrary, onUninstall }) => {
    return (
        <AdminCard className="shadow-2xl">
            {/* Search Bar Section with deep bottom margin */}
            <div className="flex flex-col lg:flex-row gap-6 mb-12">
                <div className="relative flex-1">
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input 
                        type="text" 
                        placeholder="Filter installed libraries..." 
                        className="w-full bg-slate-900/50 border border-white/10 rounded-lg py-5 pl-12 pr-4 text-base text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <button 
                    onClick={onAddLibrary}
                    className="px-8 py-5 bg-blue-600 hover:bg-blue-500 rounded-lg text-base font-black transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-900/20 text-white"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg> Add New Library
                </button>
            </div>

            {/* Libraries Grid with increased gap */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
                {libraries
                    .filter(l => {
                        const name = l?.library?.name || "";
                        const query = searchQuery || "";
                        return name.toLowerCase().includes(query.toLowerCase());
                    })
                    .map((lib, i) => (
                    <div key={i} className="bg-slate-900/50 border border-white/5 p-6 rounded-lg flex justify-between items-center group hover:border-blue-500/30 transition-all hover:bg-white/[0.04]">
                        <div className="flex items-center gap-5 min-w-0 flex-1">
                            <div className="p-4 bg-blue-600/10 rounded-lg shrink-0">
                                <svg className="w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m16 6 4 14" /><path d="M12 6v14" /><path d="M8 8v12" /><path d="M4 4v16" />
                                </svg>
                            </div>
                            <div className="min-w-0">
                                <div className="font-black text-lg text-white truncate mb-1">{lib.library.name}</div>
                                <div className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">Version {lib.library.version}</div>
                            </div>
                        </div>
                        <button 
                            onClick={() => onUninstall(lib.library.name)}
                            className="p-3 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all ml-4"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                        </button>
                    </div>
                ))}
            </div>
        </AdminCard>
    );
};

export default LibrariesTab;
