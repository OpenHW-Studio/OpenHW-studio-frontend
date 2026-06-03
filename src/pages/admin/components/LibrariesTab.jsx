import React, { useRef } from 'react';
import AdminCard from './AdminCard';
import { Download, Upload, Trash2, Database, Box, PlusCircle } from 'lucide-react';

const LibrariesTab = ({ libraries, libraryConfig, libraryCache, searchQuery, setSearchQuery, onAddLibrary, onUninstall, onClearCache, onUploadConfig, onMakePermanent }) => {
    const handleDownloadConfig = () => {
        const data = { 
            permanent: libraryConfig?.permanent || [],
            cached: libraryCache.map(c => c.name) // Add cached libraries to the downloaded file for visibility
        };
        const blob = new Blob([JSON.stringify(data, null, 4)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'libraries.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-8">
        <AdminCard className="shadow-2xl relative">
            <div className="absolute top-0 right-0 p-6 flex gap-3 z-10">
                <button onClick={handleDownloadConfig} className="p-3 bg-white/5 hover:bg-white/10 rounded-lg text-slate-300 transition-all flex items-center gap-2 font-bold text-xs" title="Download libraries.json">
                    <Download className="w-4 h-4" /> Download Config
                </button>
                <label className="p-3 bg-white/5 hover:bg-white/10 rounded-lg text-slate-300 transition-all cursor-pointer flex items-center gap-2 font-bold text-xs" title="Upload libraries.json">
                    <Upload className="w-4 h-4" /> Upload Config
                    <input type="file" accept=".json" className="hidden" onChange={onUploadConfig} />
                </label>
            </div>
            
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-black text-white flex items-center gap-3">
                        <Database className="w-6 h-6 text-blue-500" />
                        Permanent Libraries
                    </h2>
                    <p className="text-sm text-slate-400 mt-2">These libraries are permanently installed on the server and defined in libraries.json.</p>
                </div>
                {libraryConfig?.totalSize > 0 && (
                    <div className="text-right">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Disk Usage</div>
                        <div className="text-xl font-black text-blue-400 bg-blue-500/10 px-4 py-1.5 rounded-lg border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                            {(libraryConfig.totalSize / 1024 / 1024).toFixed(2)} MB
                        </div>
                    </div>
                )}
            </div>

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
                            title="Uninstall Library"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                        </button>
                    </div>
                ))}
            </div>
        </AdminCard>

        <AdminCard className="shadow-2xl border-purple-500/10">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-2xl font-black text-white flex items-center gap-3">
                        <Box className="w-6 h-6 text-purple-500" />
                        Cached Libraries
                    </h2>
                    <p className="text-sm text-slate-400 mt-2">Dynamically downloaded libraries used for specific compilation tasks.</p>
                </div>
                {libraryCache && libraryCache.length > 0 && (
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Cache Size</div>
                            <div className="text-xl font-black text-purple-400 bg-purple-500/10 px-4 py-1.5 rounded-lg border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                                {(libraryCache.reduce((acc, curr) => acc + curr.size, 0) / 1024 / 1024).toFixed(2)} MB
                            </div>
                        </div>
                        <button 
                            onClick={() => onClearCache()}
                            className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-bold transition-all flex items-center gap-2 h-fit"
                            title="Clear all cached libraries"
                        >
                            <Trash2 className="w-4 h-4" /> Clear All Cache
                        </button>
                    </div>
                )}
            </div>

            {(!libraryCache || libraryCache.length === 0) ? (
                <div className="p-8 text-center border-2 border-dashed border-white/5 rounded-xl text-slate-500 font-bold">
                    No cached libraries currently stored.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {libraryCache.map((cacheLib, idx) => (
                        <div key={idx} className="bg-slate-900/40 border border-white/5 p-4 rounded-lg flex justify-between items-center group hover:border-purple-500/30 transition-all">
                            <div>
                                <div className="font-bold text-white">{cacheLib.name}</div>
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">
                                    Size: {(cacheLib.size / 1024 / 1024).toFixed(2)} MB
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => onMakePermanent(cacheLib.name)}
                                    className="p-2 text-slate-600 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all"
                                    title={`Move ${cacheLib.name} to permanent`}
                                >
                                    <PlusCircle className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => onClearCache(cacheLib.name)}
                                    className="p-2 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                    title={`Delete ${cacheLib.name} from cache`}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </AdminCard>
        </div>
    );
};

export default LibrariesTab;
