import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Globe, 
    Users, 
    Activity, 
    MapPin, 
    Search, 
    Clock, 
    Calendar, 
    TrendingUp, 
    Copy, 
    Check, 
    Compass, 
    Radio, 
    Sparkles,
    Shield,
    Crosshair
} from 'lucide-react';
import AdminCard from './AdminCard';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker icons in bundle
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const UserMapTab = ({ stats }) => {
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersLayerRef = useRef(null);

    const [selectedTimeRange, setSelectedTimeRange] = useState('all'); // 'live', '24h', '7d', '30d', 'all'
    const [searchQuery, setSearchQuery] = useState('');
    const [copiedIp, setCopiedIp] = useState(null);
    const [selectedVisitor, setSelectedVisitor] = useState(null);
    const [loading, setLoading] = useState(!stats);

    // Extract metrics from stats
    const activeSessions = stats?.activeSessions || 0;
    const todayVisitors = stats?.todayVisitors ?? (stats?.activeSessions || 0);
    const weekVisitors = stats?.weekVisitors ?? (stats?.activeSessions || 0);
    const monthVisitors = stats?.monthVisitors ?? (stats?.activeSessions || 0);
    const allTimeVisitors = stats?.allTimeVisitors ?? (stats?.visitorList?.length || 0);

    const rawVisitors = useMemo(() => stats?.visitorList || [], [stats]);
    const topCountries = useMemo(() => stats?.topCountries || [], [stats]);
    const topCities = useMemo(() => stats?.topCities || [], [stats]);

    useEffect(() => {
        if (stats) setLoading(false);
    }, [stats]);

    // Helpers to clean up IP & Location
    const formatIp = (ip) => {
        if (!ip) return '127.0.0.1';
        const trimmed = String(ip).trim();
        const isIp = /^([0-9]{1,3}\.){3}[0-9]{1,3}$|^[a-fA-F0-9:]+$/.test(trimmed);
        return isIp ? trimmed : '127.0.0.1';
    };

    const formatLocation = (v) => {
        if (v.locationStr && v.locationStr !== 'Unknown Location') return v.locationStr;
        if (v.city || v.country) return [v.city, v.country].filter(Boolean).join(', ');
        if (v.ip && !/^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(v.ip)) return v.ip;
        return 'Local Node';
    };

    // Format relative time helper
    const getRelativeTime = (dateStr) => {
        if (!dateStr) return 'N/A';
        const now = Date.now();
        const diffMs = now - new Date(dateStr).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 30) return `${diffDays}d ago`;
        return new Date(dateStr).toLocaleDateString();
    };

    // Filter visitors based on timeframe and search query
    const filteredVisitors = useMemo(() => {
        const now = Date.now();
        const fifteenMinAgo = now - 15 * 60 * 1000;
        const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

        return rawVisitors.filter(v => {
            const time = v.lastSeen ? new Date(v.lastSeen).getTime() : 0;

            // Time filter
            if (selectedTimeRange === 'live' && time < fifteenMinAgo) return false;
            if (selectedTimeRange === '24h' && time < twentyFourHoursAgo) return false;
            if (selectedTimeRange === '7d' && time < sevenDaysAgo) return false;
            if (selectedTimeRange === '30d' && time < thirtyDaysAgo) return false;

            // Search query filter
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase().trim();
                const ipStr = formatIp(v.ip).toLowerCase();
                const locStr = formatLocation(v).toLowerCase();
                return ipStr.includes(query) || locStr.includes(query);
            }

            return true;
        });
    }, [rawVisitors, selectedTimeRange, searchQuery]);

    // Initialize Leaflet Map with ESRI Dark Gray Canvas (Completely Free, No Watermark, No API Key)
    useEffect(() => {
        if (!mapContainerRef.current) return;

        if (!mapInstanceRef.current) {
            const map = L.map(mapContainerRef.current, {
                center: [22, 10],
                zoom: 2,
                minZoom: 1.5,
                maxZoom: 16,
                zoomControl: false,
                worldCopyJump: true,
                attributionControl: false
            });

            // ESRI World Dark Gray Canvas - Clean, dark, watermark-free
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 16,
                attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
            }).addTo(map);

            // Zoom control
            L.control.zoom({ position: 'topright' }).addTo(map);

            const markersLayer = L.layerGroup().addTo(map);
            markersLayerRef.current = markersLayer;
            mapInstanceRef.current = map;
        }

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    // Update map markers when filtered visitors change
    useEffect(() => {
        if (!mapInstanceRef.current || !markersLayerRef.current) return;

        const markersLayer = markersLayerRef.current;
        markersLayer.clearLayers();

        const coordsMap = new Map();

        filteredVisitors.forEach(v => {
            if (v.lat != null && v.lng != null && !isNaN(v.lat) && !isNaN(v.lng)) {
                const key = `${Number(v.lat).toFixed(2)},${Number(v.lng).toFixed(2)}`;
                const cleanIp = formatIp(v.ip);
                const cleanLoc = formatLocation(v);

                if (!coordsMap.has(key)) {
                    coordsMap.set(key, {
                        lat: Number(v.lat),
                        lng: Number(v.lng),
                        location: cleanLoc,
                        ips: [cleanIp],
                        count: 1,
                        isLive: v.isLive,
                        lastSeen: v.lastSeen
                    });
                } else {
                    const item = coordsMap.get(key);
                    item.count += 1;
                    if (!item.ips.includes(cleanIp)) item.ips.push(cleanIp);
                    if (v.isLive) item.isLive = true;
                    if (new Date(v.lastSeen) > new Date(item.lastSeen)) {
                        item.lastSeen = v.lastSeen;
                    }
                }
            }
        });

        coordsMap.forEach((point) => {
            const isLive = point.isLive;
            
            const customIcon = L.divIcon({
                className: 'custom-map-pin',
                html: `
                    <div class="relative flex items-center justify-center w-8 h-8 -translate-x-1/2 -translate-y-1/2 cursor-pointer group">
                        <div class="absolute inset-0 rounded-full ${isLive ? 'bg-cyan-500/40 animate-ping' : 'bg-blue-500/25'}"></div>
                        <div class="relative w-4 h-4 rounded-full ${isLive ? 'bg-cyan-400 ring-4 ring-cyan-500/50 shadow-[0_0_14px_#22d3ee]' : 'bg-blue-500 ring-2 ring-blue-400/40 shadow-[0_0_8px_#3b82f6]'} flex items-center justify-center text-[8px] font-black text-white">
                        </div>
                    </div>
                `,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });

            const marker = L.marker([point.lat, point.lng], { icon: customIcon });

            const popupContent = `
                <div class="p-4 bg-[#0a0f1d] text-white rounded-2xl border border-white/15 shadow-2xl min-w-[220px] font-sans">
                    <div class="flex items-center justify-between pb-2 border-b border-white/10 mb-2.5">
                        <span class="text-[10px] font-black uppercase tracking-wider ${isLive ? 'text-cyan-400' : 'text-slate-400'} flex items-center gap-1">
                            <span class="w-1.5 h-1.5 rounded-full ${isLive ? 'bg-cyan-400 animate-pulse' : 'bg-slate-500'}"></span>
                            ${isLive ? 'Live Active Node' : 'Node History'}
                        </span>
                        <span class="text-[10px] px-2 py-0.5 rounded-md bg-white/10 font-bold text-slate-300">
                            ${point.count} ${point.count === 1 ? 'Session' : 'Sessions'}
                        </span>
                    </div>
                    <div class="text-sm font-bold text-white mb-1.5">
                        📍 ${point.location}
                    </div>
                    <div class="text-xs font-mono text-slate-300 mb-2.5 bg-black/50 px-2.5 py-1.5 rounded-lg border border-white/10">
                        IP: <strong class="text-cyan-300">${point.ips[0]}</strong>
                        ${point.ips.length > 1 ? ` <span class="text-slate-400">(+${point.ips.length - 1} more)</span>` : ''}
                    </div>
                    <div class="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/5">
                        <span>${point.lat.toFixed(2)}, ${point.lng.toFixed(2)}</span>
                        <span class="text-slate-300 font-medium">${getRelativeTime(point.lastSeen)}</span>
                    </div>
                </div>
            `;

            marker.bindPopup(popupContent, {
                className: 'custom-dark-leaflet-popup',
                closeButton: true,
                offset: [0, -10]
            });

            marker.addTo(markersLayer);
        });
    }, [filteredVisitors]);

    // Fly to specific visitor
    const handleFlyToVisitor = (visitor) => {
        if (!mapInstanceRef.current || visitor.lat == null || visitor.lng == null) return;

        setSelectedVisitor(visitor);
        mapInstanceRef.current.flyTo([Number(visitor.lat), Number(visitor.lng)], 7, {
            duration: 1.5
        });

        mapContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    // Reset Map View
    const handleResetMap = () => {
        setSelectedVisitor(null);
        if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([22, 10], 2, { duration: 1.2 });
        }
    };

    // Copy IP with feedback
    const handleCopyIp = (ip) => {
        const clean = formatIp(ip);
        navigator.clipboard.writeText(clean);
        setCopiedIp(clean);
        setTimeout(() => setCopiedIp(null), 2000);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 text-slate-100 w-full">
            {/* Scoped CSS for Leaflet & Popups */}
            <style>{`
                .custom-dark-leaflet-popup .leaflet-popup-content-wrapper {
                    background: #0a0f1d !important;
                    color: #fff !important;
                    border: 1px solid rgba(255, 255, 255, 0.18) !important;
                    border-radius: 16px !important;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8) !important;
                    padding: 0 !important;
                }
                .custom-dark-leaflet-popup .leaflet-popup-content {
                    margin: 0 !important;
                    line-height: 1.4 !important;
                }
                .custom-dark-leaflet-popup .leaflet-popup-tip {
                    background: #0a0f1d !important;
                    border: 1px solid rgba(255, 255, 255, 0.18) !important;
                }
                .custom-dark-leaflet-popup .leaflet-popup-close-button {
                    color: #94a3b8 !important;
                    top: 10px !important;
                    right: 10px !important;
                }
                .leaflet-container {
                    background: #0a0e17 !important;
                    font-family: inherit !important;
                }
            `}</style>

            {/* ─── 1. TOP STATS CARDS ────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {/* Live Online */}
                <div className="p-5 rounded-xl bg-gradient-to-br from-[#0c162d] to-[#070d1a] border border-cyan-500/30 flex flex-col justify-between shadow-lg">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
                            </span>
                            Live Now
                        </span>
                        <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                    </div>
                    <div className="mt-3">
                        <div className="text-3xl font-black text-white tracking-tight">{activeSessions}</div>
                        <p className="text-xs text-slate-400 font-medium mt-1">Active in last 15 min</p>
                    </div>
                </div>

                {/* Today 24h */}
                <div className="p-5 rounded-xl bg-[#0b101e] border border-white/10 flex flex-col justify-between shadow-lg">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Today (24h)</span>
                        <Clock className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="mt-3">
                        <div className="text-3xl font-black text-white tracking-tight">{todayVisitors}</div>
                        <p className="text-xs text-slate-400 font-medium mt-1">Unique visitors today</p>
                    </div>
                </div>

                {/* 7 Days */}
                <div className="p-5 rounded-xl bg-[#0b101e] border border-white/10 flex flex-col justify-between shadow-lg">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">7-Day Traffic</span>
                        <Calendar className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="mt-3">
                        <div className="text-3xl font-black text-white tracking-tight">{weekVisitors}</div>
                        <p className="text-xs text-slate-400 font-medium mt-1">Weekly active users</p>
                    </div>
                </div>

                {/* 30 Days */}
                <div className="p-5 rounded-xl bg-[#0b101e] border border-white/10 flex flex-col justify-between shadow-lg">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-purple-400">30-Day Reach</span>
                        <TrendingUp className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="mt-3">
                        <div className="text-3xl font-black text-white tracking-tight">{monthVisitors}</div>
                        <p className="text-xs text-slate-400 font-medium mt-1">Monthly total visitors</p>
                    </div>
                </div>

                {/* Global Reach */}
                <div className="p-5 rounded-xl bg-[#0b101e] border border-white/10 flex flex-col justify-between shadow-lg">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Global Reach</span>
                        <Globe className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="mt-3">
                        <div className="text-3xl font-black text-white tracking-tight">
                            {topCountries.length > 0 ? `${topCountries.length} Countries` : 'Global'}
                        </div>
                        <p className="text-xs text-slate-400 font-medium mt-1">{allTimeVisitors} total recorded</p>
                    </div>
                </div>
            </div>

            {/* ─── 2. MAP & HOTSPOTS GRID ───────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* World Map Section */}
                <AdminCard className="lg:col-span-2 bg-[#0b101e] border-white/10 p-0 overflow-hidden min-h-[500px] flex flex-col shadow-xl">
                    {/* Header */}
                    <div className="p-5 border-b border-white/10 flex flex-wrap gap-3 justify-between items-center bg-white/[0.02]">
                        <div>
                            <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                                <Globe className="w-4 h-4 text-cyan-400" />
                                Interactive World Telemetry Map
                            </h3>
                            <p className="text-xs text-slate-400">Live coordinates, IP distribution & global node activity</p>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-2">
                            <div className="flex items-center bg-black/60 p-1 rounded-lg border border-white/15 gap-1">
                                {[
                                    { id: 'all', label: 'All' },
                                    { id: 'live', label: 'Live' },
                                    { id: '24h', label: '24h' },
                                    { id: '7d', label: '7d' },
                                    { id: '30d', label: '30d' },
                                ].map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => setSelectedTimeRange(t.id)}
                                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                            selectedTimeRange === t.id
                                                ? 'bg-blue-600 text-white shadow-md'
                                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                                        }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={handleResetMap}
                                className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg border border-white/15 transition-all cursor-pointer"
                            >
                                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                                Reset
                            </button>
                        </div>
                    </div>

                    {/* Map Area */}
                    <div className="flex-1 relative min-h-[440px] w-full isolate">
                        <div 
                            ref={mapContainerRef} 
                            className="absolute inset-0 w-full h-full z-0" 
                            style={{ minHeight: '440px' }}
                        />

                        <div className="absolute top-4 left-4 z-10 pointer-events-none">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-black/85 backdrop-blur-md rounded-lg border border-white/20 shadow-xl text-xs font-bold text-slate-200">
                                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                                <span>{filteredVisitors.length} Active Node Records</span>
                            </div>
                        </div>

                        {loading && (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm">
                                <Activity className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
                                <p className="text-xs font-black uppercase tracking-widest text-slate-300">Synchronizing Telemetry Nodes...</p>
                            </div>
                        )}
                    </div>
                </AdminCard>

                {/* Hotspots Section */}
                <div className="space-y-6">
                    <AdminCard className="border-white/10 bg-[#0b101e] p-5 shadow-xl">
                        <h4 className="text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2 pb-2.5 border-b border-white/10">
                            <MapPin className="w-4 h-4 text-cyan-400" />
                            Top Geographic Hotspots
                        </h4>

                        <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                            {topCountries.length > 0 ? (
                                topCountries.map((c, i) => (
                                    <div key={i} className="space-y-1.5">
                                        <div className="flex items-center justify-between text-xs font-bold">
                                            <span className="text-slate-200 flex items-center gap-2">
                                                <span className="w-4 h-4 rounded bg-white/10 border border-white/10 flex items-center justify-center text-[10px] text-cyan-400 font-black">
                                                    {i + 1}
                                                </span>
                                                {c.name || 'Unknown Location'}
                                            </span>
                                            <span className="text-white font-mono">{c.count} sessions</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-700"
                                                style={{ width: `${Math.max(c.percentage || (c.count / (allTimeVisitors || 1)) * 100, 8)}%` }}
                                            />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 text-slate-500 text-xs italic">
                                    No country traffic aggregated yet.
                                </div>
                            )}
                        </div>
                    </AdminCard>

                    {topCities.length > 0 && (
                        <AdminCard className="border-white/10 bg-[#0b101e] p-5 shadow-xl">
                            <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                                Active Hubs & Cities
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {topCities.slice(0, 6).map((city, idx) => (
                                    <span 
                                        key={idx}
                                        className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors"
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                                        {city.name}
                                        <strong className="text-white font-mono text-xs">({city.count})</strong>
                                    </span>
                                ))}
                            </div>
                        </AdminCard>
                    )}
                </div>
            </div>

            {/* ─── 3. VISITOR INTELLIGENCE & IP LOGS TABLE ─────────────────────── */}
            <AdminCard className="bg-[#0b101e] border-white/10 p-0 overflow-hidden shadow-xl">
                {/* Header */}
                <div className="p-5 md:p-6 border-b border-white/10 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white/[0.02]">
                    <div>
                        <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                            <Shield className="w-4 h-4 text-blue-400" />
                            Visitor Intelligence & IP Logs
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Real-time session records, geographic tracking, and IP history
                        </p>
                    </div>

                    {/* Search Toolbar */}
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-72">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Search by IP, city, or country..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-8 py-2 bg-[#121829] border border-white/15 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all shadow-inner"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-slate-300 shrink-0">
                            {filteredVisitors.length} of {rawVisitors.length} Visitors
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/[0.02] text-xs font-bold uppercase tracking-wider text-slate-400">
                                <th className="py-3.5 px-5">Status</th>
                                <th className="py-3.5 px-5">IP Address</th>
                                <th className="py-3.5 px-5">Location</th>
                                <th className="py-3.5 px-5">Coordinates</th>
                                <th className="py-3.5 px-5 text-center">Hits</th>
                                <th className="py-3.5 px-5">First Seen</th>
                                <th className="py-3.5 px-5">Last Active</th>
                                <th className="py-3.5 px-5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-xs">
                            {filteredVisitors.length > 0 ? (
                                filteredVisitors.map((v, i) => {
                                    const cleanIp = formatIp(v.ip);
                                    const cleanLocation = formatLocation(v);

                                    return (
                                        <tr 
                                            key={v.id || v.sessionId || i}
                                            className="hover:bg-white/[0.04] transition-colors"
                                        >
                                            {/* Status */}
                                            <td className="py-3.5 px-5">
                                                {v.isLive ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                                                        LIVE
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-slate-400 border border-white/10">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                                                        Offline
                                                    </span>
                                                )}
                                            </td>

                                            {/* IP Address */}
                                            <td className="py-3.5 px-5">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono text-white font-bold bg-[#141b2d] px-2 py-0.5 rounded border border-white/10 text-xs">
                                                        {cleanIp}
                                                    </span>
                                                    <button
                                                        onClick={() => handleCopyIp(cleanIp)}
                                                        title="Copy IP Address"
                                                        className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                                                    >
                                                        {copiedIp === cleanIp ? (
                                                            <Check className="w-3 h-3 text-emerald-400" />
                                                        ) : (
                                                            <Copy className="w-3 h-3" />
                                                        )}
                                                    </button>
                                                </div>
                                            </td>

                                            {/* Location */}
                                            <td className="py-3.5 px-5">
                                                <div className="flex items-center gap-1.5">
                                                    <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                                    <span className="font-medium text-slate-200">
                                                        {cleanLocation}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Coordinates */}
                                            <td className="py-3.5 px-5 font-mono text-slate-300 text-xs">
                                                {v.lat != null && v.lng != null ? (
                                                    <span>{Number(v.lat).toFixed(2)}, {Number(v.lng).toFixed(2)}</span>
                                                ) : (
                                                    <span className="text-slate-500 italic">—</span>
                                                )}
                                            </td>

                                            {/* Hits */}
                                            <td className="py-3.5 px-5 text-center">
                                                <span className="px-2.5 py-0.5 rounded bg-blue-600/15 text-blue-400 font-mono font-bold border border-blue-500/25 text-xs">
                                                    {v.hitCount || 1}
                                                </span>
                                            </td>

                                            {/* First Seen */}
                                            <td className="py-3.5 px-5 text-slate-300">
                                                {v.firstSeen ? new Date(v.firstSeen).toLocaleDateString() : 'N/A'}
                                            </td>

                                            {/* Last Active */}
                                            <td className="py-3.5 px-5">
                                                <span className="text-slate-200 font-medium">
                                                    {getRelativeTime(v.lastSeen)}
                                                </span>
                                            </td>

                                            {/* Action */}
                                            <td className="py-3.5 px-5 text-right">
                                                {v.lat != null && v.lng != null ? (
                                                    <button
                                                        onClick={() => handleFlyToVisitor(v)}
                                                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white rounded-lg border border-blue-500/30 transition-all text-xs font-bold cursor-pointer"
                                                    >
                                                        <Crosshair className="w-3 h-3" />
                                                        Locate
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-500 text-xs italic">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <Globe className="w-10 h-10 text-slate-700 mb-2 opacity-40" />
                                            <p className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                                No visitors matching current filters
                                            </p>
                                            <p className="text-[11px] text-slate-500 mt-0.5">
                                                Try changing the timeframe or clearing your search query.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </AdminCard>
        </div>
    );
};

export default UserMapTab;
