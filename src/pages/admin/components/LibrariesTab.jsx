import React from 'react';
import AdminCard from './AdminCard';
import { Download, Upload, Trash2, Database, Box, Plus, Search } from 'lucide-react';

const LibrariesTab = ({ libraries, libraryConfig, libraryCache, searchQuery, setSearchQuery, onAddLibrary, onUninstall, onClearCache, onUploadConfig, onMakePermanent }) => {
    const handleDownloadConfig = () => {
        const data = { permanent: libraryConfig?.permanent || [], cached: libraryCache.map(c => c.name) };
        const blob = new Blob([JSON.stringify(data, null, 4)], { type: 'application/json' });
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'libraries.json' });
        a.click();
        URL.revokeObjectURL(a.href);
    };

    const filteredLibs = (libraries || []).filter(l => {
        const name = l?.library?.name || '';
        return name.toLowerCase().includes((searchQuery || '').toLowerCase());
    });

    const cacheTotal = (libraryCache || []).reduce((a, c) => a + c.size, 0);

    return (
        <div className="ad-space-y-6 ad-fade-in">
            {/* ── Permanent Libraries ─────────────────────────────────── */}
            <AdminCard className="p-0">
                <div className="ad-card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
                    <div>
                        <div className="ad-card-title">
                            <Database style={{ color: 'var(--ad-accent)' }} />
                            Permanent Libraries
                        </div>
                        <div className="ad-card-subtitle">Permanently installed on the server, defined in libraries.json</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {libraryConfig?.totalSize > 0 && (
                            <span className="ad-badge blue" style={{ fontSize: 11, fontWeight: 700 }}>
                                {(libraryConfig.totalSize / 1024 / 1024).toFixed(2)} MB used
                            </span>
                        )}
                        <button onClick={handleDownloadConfig} className="ad-btn ad-btn-ghost">
                            <Download style={{ width: 13, height: 13 }} /> Config
                        </button>
                        <label className="ad-btn ad-btn-ghost" style={{ cursor: 'pointer' }}>
                            <Upload style={{ width: 13, height: 13 }} /> Upload
                            <input type="file" accept=".json" className="hidden" onChange={onUploadConfig} style={{ display: 'none' }} />
                        </label>
                        <button onClick={onAddLibrary} className="ad-btn ad-btn-primary">
                            <Plus style={{ width: 13, height: 13 }} /> Add Library
                        </button>
                    </div>
                </div>

                <div className="ad-card-body" style={{ paddingTop: 12 }}>
                    {/* Search */}
                    <div className="ad-input-icon" style={{ marginBottom: 14 }}>
                        <Search style={{ width: 14, height: 14 }} />
                        <input
                            type="text"
                            className="ad-input"
                            placeholder="Filter libraries..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                        {filteredLibs.map((lib, i) => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                                padding: '10px 14px', borderRadius: 10, border: '1px solid var(--ad-border)',
                                backgroundColor: 'var(--ad-surface-2)', transition: 'border-color 0.15s',
                            }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--ad-accent)'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--ad-border)'}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                                    <div className="ad-stat-icon blue" style={{ width: 30, height: 30, flexShrink: 0 }}>
                                        <Database style={{ width: 13, height: 13 }} />
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, color: 'var(--ad-text)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {lib.library.name}
                                        </div>
                                        <div style={{ fontSize: 10, color: 'var(--ad-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                                            v{lib.library.version}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onUninstall(lib.library.name)}
                                    className="ad-btn-icon" style={{ width: 28, height: 28, flexShrink: 0 }}
                                    title="Uninstall"
                                >
                                    <Trash2 style={{ width: 12, height: 12, color: 'var(--ad-red)' }} />
                                </button>
                            </div>
                        ))}
                        {filteredLibs.length === 0 && (
                            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '24px 0', color: 'var(--ad-text-3)', fontSize: 12 }}>
                                No libraries found.
                            </div>
                        )}
                    </div>
                </div>
            </AdminCard>

            {/* ── Cached Libraries ────────────────────────────────────── */}
            <AdminCard className="p-0">
                <div className="ad-card-header">
                    <div>
                        <div className="ad-card-title">
                            <Box style={{ color: 'var(--ad-purple)' }} />
                            Cached Libraries
                        </div>
                        <div className="ad-card-subtitle">Dynamically downloaded libraries for specific compilation tasks</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {cacheTotal > 0 && (
                            <span className="ad-badge purple">
                                {(cacheTotal / 1024 / 1024).toFixed(2)} MB
                            </span>
                        )}
                        {libraryCache?.length > 0 && (
                            <button onClick={() => onClearCache()} className="ad-btn ad-btn-danger">
                                <Trash2 style={{ width: 13, height: 13 }} />
                                Clear All
                            </button>
                        )}
                    </div>
                </div>

                <div className="ad-card-body">
                    {(!libraryCache || libraryCache.length === 0) ? (
                        <div style={{ textAlign: 'center', padding: '24px 0', border: '2px dashed var(--ad-border)', borderRadius: 10, color: 'var(--ad-text-3)', fontSize: 12, fontWeight: 600 }}>
                            No cached libraries currently stored.
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                            {libraryCache.map((cacheLib, idx) => (
                                <div key={idx} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                                    padding: '10px 12px', borderRadius: 10, border: '1px solid var(--ad-border)',
                                    backgroundColor: 'var(--ad-surface-2)',
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 600, color: 'var(--ad-text)', fontSize: 13 }}>{cacheLib.name}</div>
                                        <div style={{ fontSize: 10, color: 'var(--ad-text-3)', marginTop: 2 }}>
                                            {(cacheLib.size / 1024 / 1024).toFixed(2)} MB
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <button onClick={() => onMakePermanent(cacheLib.name)} className="ad-btn-icon" title="Make permanent" style={{ width: 28, height: 28 }}>
                                            <Plus style={{ width: 12, height: 12, color: 'var(--ad-accent)' }} />
                                        </button>
                                        <button onClick={() => onClearCache(cacheLib.name)} className="ad-btn-icon" title="Delete from cache" style={{ width: 28, height: 28 }}>
                                            <Trash2 style={{ width: 12, height: 12, color: 'var(--ad-red)' }} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </AdminCard>
        </div>
    );
};

export default LibrariesTab;
