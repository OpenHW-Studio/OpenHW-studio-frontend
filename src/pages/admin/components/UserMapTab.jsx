import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Globe, Users, Activity, MapPin, Search, Clock, Calendar,
    TrendingUp, Copy, Check, Compass, Radio, Sparkles, Shield, Crosshair, X
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

    const [selectedTimeRange, setSelectedTimeRange] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [copiedIp, setCopiedIp] = useState(null);
    const [loading, setLoading] = useState(!stats);

    const activeSessions   = stats?.activeSessions   || 0;
    const todayVisitors    = stats?.todayVisitors     ?? (stats?.activeSessions || 0);
    const weekVisitors     = stats?.weekVisitors      ?? (stats?.activeSessions || 0);
    const monthVisitors    = stats?.monthVisitors     ?? (stats?.activeSessions || 0);
    const allTimeVisitors  = stats?.allTimeVisitors   ?? (stats?.visitorList?.length || 0);

    const rawVisitors  = useMemo(() => stats?.visitorList  || [], [stats]);
    const topCountries = useMemo(() => stats?.topCountries || [], [stats]);
    const topCities    = useMemo(() => stats?.topCities    || [], [stats]);

    useEffect(() => { if (stats) setLoading(false); }, [stats]);

    const formatIp = (ip) => {
        if (!ip) return '127.0.0.1';
        const trimmed = String(ip).trim();
        return /^([0-9]{1,3}\.){3}[0-9]{1,3}$|^[a-fA-F0-9:]+$/.test(trimmed) ? trimmed : '127.0.0.1';
    };

    const formatLocation = (v) => {
        if (v.locationStr && v.locationStr !== 'Unknown Location') return v.locationStr;
        if (v.city || v.country) return [v.city, v.country].filter(Boolean).join(', ');
        if (v.ip && !/^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(v.ip)) return v.ip;
        return 'Local Node';
    };

    const getRelativeTime = (dateStr) => {
        if (!dateStr) return 'N/A';
        const diffMins  = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays  = Math.floor(diffHours / 24);
        if (diffMins  < 1)  return 'Just now';
        if (diffMins  < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays  === 1)return 'Yesterday';
        if (diffDays  < 30) return `${diffDays}d ago`;
        return new Date(dateStr).toLocaleDateString();
    };

    const filteredVisitors = useMemo(() => {
        const now = Date.now();
        return rawVisitors.filter(v => {
            const time = v.lastSeen ? new Date(v.lastSeen).getTime() : 0;
            if (selectedTimeRange === 'live' && time < now - 15 * 60 * 1000)      return false;
            if (selectedTimeRange === '24h'  && time < now - 24 * 60 * 60 * 1000) return false;
            if (selectedTimeRange === '7d'   && time < now - 7  * 24 * 60 * 60 * 1000) return false;
            if (selectedTimeRange === '30d'  && time < now - 30 * 24 * 60 * 60 * 1000) return false;
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return String(v.ip || '').toLowerCase().includes(q)
                || String(v.city || '').toLowerCase().includes(q)
                || String(v.country || '').toLowerCase().includes(q)
                || String(v.locationStr || '').toLowerCase().includes(q);
        });
    }, [rawVisitors, selectedTimeRange, searchQuery]);

    // Initialize Leaflet map
    useEffect(() => {
        if (!mapContainerRef.current || mapInstanceRef.current) return;

        const map = L.map(mapContainerRef.current, {
            center: [20, 0], zoom: 2, minZoom: 1.5, maxZoom: 18,
            zoomControl: false, worldCopyJump: true, attributionControl: false
        });

        L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
            { maxZoom: 16, noWrap: false }
        ).addTo(map);

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        const markersLayer = L.layerGroup().addTo(map);
        markersLayerRef.current = markersLayer;
        mapInstanceRef.current = map;

        const handleResize = () => map.invalidateSize();
        window.addEventListener('resize', handleResize);
        const timer = setTimeout(handleResize, 400);

        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(timer);
            if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
        };
    }, []);

    // Update map markers
    useEffect(() => {
        if (!markersLayerRef.current || !mapInstanceRef.current) return;
        const markersLayer = markersLayerRef.current;
        markersLayer.clearLayers();

        const coordsMap = new Map();
        filteredVisitors.forEach(v => {
            const lat = Number(v.lat), lng = Number(v.lng);
            if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
                const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
                if (!coordsMap.has(key)) {
                    coordsMap.set(key, { lat, lng, location: formatLocation(v), ips: [formatIp(v.ip)], count: v.hitCount || 1, isLive: v.isLive, lastSeen: v.lastSeen });
                } else {
                    const item = coordsMap.get(key);
                    item.count += (v.hitCount || 1);
                    const cleanIp = formatIp(v.ip);
                    if (!item.ips.includes(cleanIp)) item.ips.push(cleanIp);
                    if (v.isLive) item.isLive = true;
                    if (new Date(v.lastSeen) > new Date(item.lastSeen)) item.lastSeen = v.lastSeen;
                }
            }
        });

        coordsMap.forEach(point => {
            const isLive = point.isLive;
            const color  = isLive ? '#06b6d4' : '#3b82f6';
            const glow   = isLive ? '#06b6d4' : '#3b82f6';

            const customIcon = L.divIcon({
                className: 'custom-map-pin',
                html: `
                    <div style="position:relative;display:flex;align-items:center;justify-content:center;width:32px;height:32px;transform:translate(-50%,-50%);cursor:pointer;">
                        <div style="position:absolute;inset:0;border-radius:50%;background:${color}25;${isLive ? 'animation:adPulse 2s infinite;' : ''}"></div>
                        <div style="position:relative;width:14px;height:14px;border-radius:50%;background:${color};box-shadow:0 0 10px ${glow};border:2px solid rgba(255,255,255,0.3);">
                        </div>
                    </div>
                `,
                iconSize: [32, 32],
                iconAnchor: [16, 16],
            });

            const marker = L.marker([point.lat, point.lng], { icon: customIcon });

            const popupContent = `
                <div style="padding:12px 14px;min-width:200px;font-family:Inter,system-ui,sans-serif;background:var(--ad-surface);color:var(--ad-text);">
                    <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:8px;border-bottom:1px solid var(--ad-border);margin-bottom:8px;">
                        <span style="display:flex;align-items:center;gap:5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:${isLive ? '#06b6d4' : '#64748b'};">
                            <span style="width:6px;height:6px;border-radius:50%;background:${isLive ? '#06b6d4' : '#64748b'};"></span>
                            ${isLive ? 'LIVE' : 'Offline'}
                        </span>
                        <span style="font-size:10px;padding:2px 6px;border-radius:5px;background:var(--ad-surface-2);color:var(--ad-text-2);font-weight:600;border:1px solid var(--ad-border);">
                            ${point.count} ${point.count === 1 ? 'Session' : 'Sessions'}
                        </span>
                    </div>
                    <div style="font-size:12px;font-weight:600;color:var(--ad-text);margin-bottom:6px;">📍 ${point.location}</div>
                    <div style="font-family:monospace;font-size:11px;color:#06b6d4;background:var(--ad-surface-2);padding:4px 8px;border-radius:6px;border:1px solid var(--ad-border);margin-bottom:6px;">
                        ${point.ips[0]}${point.ips.length > 1 ? ` <span style="color:var(--ad-text-3);">(+${point.ips.length - 1})</span>` : ''}
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--ad-text-3);">
                        <span>${point.lat.toFixed(2)}, ${point.lng.toFixed(2)}</span>
                        <span>${getRelativeTime(point.lastSeen)}</span>
                    </div>
                </div>
            `;

            marker.bindPopup(popupContent, { closeButton: true, offset: [0, -8] });
            marker.addTo(markersLayer);
        });
    }, [filteredVisitors]);

    const handleFlyToVisitor = (visitor) => {
        if (!mapInstanceRef.current || visitor.lat == null) return;
        mapInstanceRef.current.flyTo([Number(visitor.lat), Number(visitor.lng)], 7, { animate: true, duration: 1.5 });
        mapContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const handleResetMap = () => {
        if (mapInstanceRef.current) mapInstanceRef.current.setView([20, 0], 2);
    };

    const handleCopyIp = (ip) => {
        navigator.clipboard.writeText(ip);
        setCopiedIp(ip);
        setTimeout(() => setCopiedIp(null), 2000);
    };

    const STATS = [
        { label: 'Live Now',    value: activeSessions,  sub: 'Active in last 15 min', color: 'cyan',    icon: Radio,      live: true },
        { label: 'Today (24h)', value: todayVisitors,   sub: 'Unique visitors today',  color: 'blue',    icon: Clock },
        { label: '7-Day',       value: weekVisitors,    sub: 'Weekly active users',    color: 'indigo',  icon: Calendar },
        { label: '30-Day',      value: monthVisitors,   sub: 'Monthly total',          color: 'purple',  icon: TrendingUp },
        { label: 'Global Reach',value: topCountries.length > 0 ? `${topCountries.length}` : '—',
            sub: `${allTimeVisitors} total recorded`, color: 'emerald', icon: Globe,
            unit: topCountries.length > 0 ? 'Countries' : '' },
    ];

    return (
        <div className="ad-space-y-6 ad-fade-in">
            {/* ── 1. STAT CARDS ────────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                {STATS.map((s, i) => (
                    <div key={i} className={`ad-stat-card ${s.color === 'indigo' ? '' : s.color}`}
                        style={s.color === 'indigo' ? { borderColor: 'color-mix(in srgb, var(--ad-indigo) 30%, transparent)' } : {}}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span className="ad-stat-label" style={{ color: `var(--ad-${s.color === 'blue' ? 'accent' : s.color === 'indigo' ? 'indigo' : s.color})` }}>
                                {s.live && (
                                    <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--ad-cyan)', marginRight: 5, animation: 'adPulse 2s infinite', verticalAlign: 'middle' }} />
                                )}
                                {s.label}
                            </span>
                            <div className={`ad-stat-icon ${s.color === 'indigo' ? 'indigo' : s.color}`}>
                                <s.icon />
                            </div>
                        </div>
                        <div>
                            <div className="ad-stat-value" style={{ fontSize: 24 }}>{s.value}{s.unit ? ` ${s.unit}` : ''}</div>
                            <div className="ad-stat-sub" style={{ marginTop: 4 }}>{s.sub}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── 2. MAP + HOTSPOTS ─────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 288px', gap: 16, alignItems: 'start' }}>
                {/* MAP */}
                <AdminCard className="p-0" style={{ overflow: 'hidden', minHeight: 500, display: 'flex', flexDirection: 'column' }}>
                    {/* Map header */}
                    <div className="ad-card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
                        <div>
                            <div className="ad-card-title">
                                <Globe style={{ color: 'var(--ad-cyan)' }} />
                                Interactive World Telemetry Map
                            </div>
                            <div className="ad-card-subtitle">Live coordinates, IP distribution & global node activity</div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {/* Timeframe */}
                            <div className="ad-segmented">
                                {[
                                    { id: 'all', label: 'All' },
                                    { id: 'live', label: 'Live' },
                                    { id: '24h', label: '24h' },
                                    { id: '7d', label: '7d' },
                                    { id: '30d', label: '30d' },
                                ].map(t => (
                                    <button
                                        key={t.id}
                                        className={`ad-segment-btn ${selectedTimeRange === t.id ? 'active' : ''}`}
                                        onClick={() => setSelectedTimeRange(t.id)}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>

                            <button className="ad-btn ad-btn-ghost" onClick={handleResetMap} title="Reset view">
                                <Compass style={{ width: 13, height: 13, color: 'var(--ad-cyan)' }} />
                                Reset
                            </button>
                        </div>
                    </div>

                    {/* Map canvas */}
                    <div style={{ flex: 1, position: 'relative', minHeight: 440 }}>
                        <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

                        {/* Node counter badge */}
                        <div style={{
                            position: 'absolute', top: 12, left: 12, zIndex: 10, pointerEvents: 'none',
                            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                            backgroundColor: 'var(--ad-surface)', border: '1px solid var(--ad-border-2)',
                            borderRadius: 8, boxShadow: 'var(--ad-shadow)', fontSize: 11, fontWeight: 700,
                            color: 'var(--ad-text)'
                        }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: 'var(--ad-cyan)', flexShrink: 0 }} />
                            {filteredVisitors.length} Active Node Records
                        </div>

                        {loading && (
                            <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
                                <Activity style={{ width: 28, height: 28, color: 'var(--ad-cyan)', marginBottom: 10 }} className="ad-spin" />
                                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ad-text-2)' }}>
                                    Synchronizing Telemetry Nodes...
                                </p>
                            </div>
                        )}
                    </div>
                </AdminCard>

                {/* HOTSPOTS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Countries */}
                    <AdminCard className="p-0">
                        <div className="ad-card-header">
                            <div className="ad-card-title">
                                <MapPin style={{ color: 'var(--ad-cyan)' }} />
                                Geographic Hotspots
                            </div>
                        </div>
                        <div className="ad-card-body ad-space-y-3" style={{ maxHeight: 300, overflowY: 'auto' }}>
                            {topCountries.length > 0 ? topCountries.map((c, i) => (
                                <div key={i}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                                        <span style={{ color: 'var(--ad-text)', display: 'flex', alignItems: 'center', gap: 7 }}>
                                            <span style={{ width: 18, height: 18, borderRadius: 5, background: 'var(--ad-accent-glow)', border: '1px solid var(--ad-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: 'var(--ad-accent)', flexShrink: 0 }}>
                                                {i + 1}
                                            </span>
                                            {c.name || 'Unknown'}
                                        </span>
                                        <span style={{ color: 'var(--ad-text-2)', fontFamily: 'monospace', fontWeight: 600 }}>{c.count}</span>
                                    </div>
                                    <div className="ad-progress">
                                        <div className="ad-progress-bar" style={{ width: `${Math.max((c.count / (allTimeVisitors || 1)) * 100, 8)}%` }} />
                                    </div>
                                </div>
                            )) : (
                                <p className="ad-text-muted" style={{ fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
                                    No country data yet.
                                </p>
                            )}
                        </div>
                    </AdminCard>

                    {/* City chips */}
                    {topCities.length > 0 && (
                        <AdminCard className="p-0">
                            <div className="ad-card-header">
                                <div className="ad-card-title">
                                    <Sparkles style={{ color: 'var(--ad-accent)' }} />
                                    Active Cities
                                </div>
                            </div>
                            <div className="ad-card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {topCities.slice(0, 8).map((city, idx) => (
                                    <span key={idx} className="ad-badge blue" style={{ gap: 5 }}>
                                        <span className="ad-badge-dot" />
                                        {city.name}
                                        <strong style={{ fontFamily: 'monospace' }}>({city.count})</strong>
                                    </span>
                                ))}
                            </div>
                        </AdminCard>
                    )}
                </div>
            </div>

            {/* ── 3. VISITOR TABLE ─────────────────────────────────────────── */}
            <AdminCard className="p-0">
                <div className="ad-card-header">
                    <div>
                        <div className="ad-card-title">
                            <Shield style={{ color: 'var(--ad-accent)' }} />
                            Visitor Intelligence & IP Logs
                        </div>
                        <div className="ad-card-subtitle">Real-time session records, geographic tracking, and IP history</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {/* Search */}
                        <div className="ad-input-icon" style={{ width: 240 }}>
                            <Search style={{ width: 14, height: 14 }} />
                            <input
                                type="text"
                                className="ad-input"
                                placeholder="Search IP, city, country..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ad-text-3)', display: 'flex', alignItems: 'center' }}
                                >
                                    <X style={{ width: 12, height: 12 }} />
                                </button>
                            )}
                        </div>

                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ad-text-3)', background: 'var(--ad-surface-2)', border: '1px solid var(--ad-border)', padding: '5px 10px', borderRadius: 8, whiteSpace: 'nowrap' }}>
                            {filteredVisitors.length} / {rawVisitors.length}
                        </span>
                    </div>
                </div>

                {/* Table */}
                <div className="ad-table-wrap">
                    <table className="ad-table" style={{ minWidth: 800 }}>
                        <thead>
                            <tr>
                                <th>Status</th>
                                <th>IP Address</th>
                                <th>Location</th>
                                <th>Coordinates</th>
                                <th style={{ textAlign: 'center' }}>Hits</th>
                                <th>First Seen</th>
                                <th>Last Active</th>
                                <th style={{ textAlign: 'right' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredVisitors.length > 0 ? (
                                filteredVisitors.map((v, i) => {
                                    const cleanIp  = formatIp(v.ip);
                                    const cleanLoc = formatLocation(v);
                                    return (
                                        <tr key={v.id || v.sessionId || i}>
                                            <td>
                                                {v.isLive ? (
                                                    <span className="ad-badge live">
                                                        <span className="ad-badge-dot pulse" />
                                                        LIVE
                                                    </span>
                                                ) : (
                                                    <span className="ad-badge offline">
                                                        <span className="ad-badge-dot" />
                                                        Offline
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span className="ad-mono">{cleanIp}</span>
                                                    <button
                                                        onClick={() => handleCopyIp(cleanIp)}
                                                        className="ad-btn-icon"
                                                        style={{ width: 26, height: 26, padding: 4 }}
                                                        title="Copy IP"
                                                    >
                                                        {copiedIp === cleanIp
                                                            ? <Check style={{ width: 11, height: 11, color: 'var(--ad-emerald)' }} />
                                                            : <Copy style={{ width: 11, height: 11 }} />}
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="primary">
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <MapPin style={{ width: 13, height: 13, color: 'var(--ad-cyan)', flexShrink: 0 }} />
                                                    {cleanLoc}
                                                </span>
                                            </td>
                                            <td>
                                                {v.lat != null && v.lng != null
                                                    ? <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--ad-text-2)' }}>{Number(v.lat).toFixed(2)}, {Number(v.lng).toFixed(2)}</span>
                                                    : <span style={{ color: 'var(--ad-text-3)' }}>—</span>}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className="ad-badge blue" style={{ fontFamily: 'monospace', fontWeight: 700 }}>{v.hitCount || 1}</span>
                                            </td>
                                            <td>{v.firstSeen ? new Date(v.firstSeen).toLocaleDateString() : 'N/A'}</td>
                                            <td className="primary">{getRelativeTime(v.lastSeen)}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                {v.lat != null && v.lng != null ? (
                                                    <button
                                                        onClick={() => handleFlyToVisitor(v)}
                                                        className="ad-btn ad-btn-ghost"
                                                        style={{ fontSize: 11 }}
                                                    >
                                                        <Crosshair style={{ width: 12, height: 12, color: 'var(--ad-accent)' }} />
                                                        Locate
                                                    </button>
                                                ) : (
                                                    <span style={{ color: 'var(--ad-text-3)', fontSize: 11 }}>—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px 0' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                            <Globe style={{ width: 36, height: 36, color: 'var(--ad-border)' }} />
                                            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ad-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                No visitors matching current filters
                                            </p>
                                            <p style={{ fontSize: 11, color: 'var(--ad-text-3)' }}>
                                                Try changing the timeframe or clearing the search.
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
