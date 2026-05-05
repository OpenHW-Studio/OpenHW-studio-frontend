import React, { useState, useEffect } from 'react';
import { Globe, Users, Activity, MapPin } from 'lucide-react';
import AdminCard from './AdminCard';

const UserMapTab = ({ stats }) => {
    const [points, setPoints] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (stats && stats.regions) {
            setPoints(stats.regions);
            setLoading(false);
        } else if (stats) {
            setPoints([]);
            setLoading(false);
        }
    }, [stats]);

    // Simple projection function for SVG map (mercator-ish)
    const project = (lat, lng) => {
        const x = (lng + 180) * (800 / 360);
        const y = (90 - lat) * (400 / 180);
        return { x, y };
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Map View */}
                <AdminCard className="lg:col-span-2 bg-[#0a0f1a]/60 border-white/5 p-0 overflow-hidden min-h-[500px] flex flex-col">
                    <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
                        <div className="space-y-1">
                            <h3 className="text-xl font-black text-white uppercase tracking-tight">Global User Traffic</h3>
                            <p className="text-xs text-slate-500 font-bold">Live simulation distribution across the world</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 rounded-xl border border-blue-500/20">
                                <Users className="w-4 h-4 text-blue-400" />
                                <span className="text-xs font-black text-white">{stats?.activeSessions || 0} Online</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 relative bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
                        {/* SVG World Map Placeholder */}
                        <svg viewBox="0 0 800 400" className="w-full h-full opacity-20">
                            <path fill="#1e293b" d="M150,100 L160,100 L160,110 L150,110 Z M300,200 L310,200 L310,210 L300,210 Z M500,150 L510,150 L510,160 L500,160 Z" />
                            {/* Simple continents outline - Very simplified for demo */}
                            <path fill="currentColor" className="text-slate-800" d="M120,80 Q150,50 200,80 T300,100 T400,150 T450,250 T300,350 T150,300 T120,200 Z" />
                            <path fill="currentColor" className="text-slate-800" d="M500,100 Q600,50 700,100 T750,200 T700,300 T600,350 T500,300 Z" />
                        </svg>

                        {/* Pulse Points */}
                        {!loading && points.map(point => {
                            const { x, y } = project(point.lat, point.lng);
                            return (
                                <div 
                                    key={point.id}
                                    className="absolute group cursor-pointer"
                                    style={{ left: `${(x / 800) * 100}%`, top: `${(y / 400) * 100}%` }}
                                >
                                    <div className="relative">
                                        <div className="absolute -inset-4 bg-blue-500/20 rounded-full animate-ping"></div>
                                        <div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-lg relative z-10"></div>
                                        
                                        {/* Tooltip */}
                                        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50">
                                            <div className="bg-white text-black px-4 py-2 rounded-xl shadow-2xl whitespace-nowrap border border-slate-200">
                                                <p className="text-[10px] font-black uppercase text-slate-400 leading-none mb-1">Location</p>
                                                <p className="text-xs font-black">{point.label}</p>
                                                <div className="h-px bg-slate-100 my-1.5"></div>
                                                <p className="text-[10px] font-black text-blue-600">{point.count} Active Sessions</p>
                                            </div>
                                            <div className="w-2 h-2 bg-white rotate-45 mx-auto -mt-1 border-r border-b border-slate-200"></div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {loading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <Activity className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">Mapping Nodes...</p>
                            </div>
                        )}

                        {!loading && points.length === 0 && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <Globe className="w-12 h-12 text-slate-800 mb-4 opacity-20" />
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-700 italic">No live nodes detected</p>
                            </div>
                        )}
                    </div>
                </AdminCard>

                {/* Info Panel */}
                <div className="space-y-6">
                    <AdminCard className="bg-blue-600/10 border-blue-500/20">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-600/20 rounded-xl text-blue-500">
                                <Globe className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-black tracking-widest text-blue-400 opacity-60">Global Reach</p>
                                <h3 className="text-xl font-black text-white">{points.length > 0 ? points.length : 'N/A'} Regions</h3>
                            </div>
                        </div>
                    </AdminCard>

                    <AdminCard className="border-white/5 bg-[#0a0f1a]/40 p-6 flex-1">
                        <h4 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-blue-500" />
                            Hotspots
                        </h4>
                        <div className="space-y-4">
                            {points.length > 0 ? points.map((p, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                                        <span className="text-xs font-black text-slate-300">{p.label}</span>
                                    </div>
                                    <span className="text-xs font-black text-white italic">{p.count}</span>
                                </div>
                            )) : (
                                <div className="text-center py-10">
                                    <p className="text-[10px] font-black uppercase text-slate-600 italic tracking-widest">N/A</p>
                                </div>
                            )}
                        </div>
                    </AdminCard>
                </div>
            </div>
        </div>
    );
};

export default UserMapTab;
