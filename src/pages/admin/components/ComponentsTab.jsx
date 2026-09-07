import React from 'react';
import AdminCard from './AdminCard';
import { Upload, Download, Trash2, Package, PlusCircle, Box, Database } from 'lucide-react';

const ComponentsTab = ({ installedComponents, onImport, onBackup, onDelete }) => {
    return (
        <div className="ad-space-y-6 ad-fade-in">
            {/* Action Bar */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={onImport} className="ad-btn ad-btn-primary" style={{ fontSize: 13 }}>
                    <Upload style={{ width: 14, height: 14 }} />
                    Import Components
                </button>
                <button onClick={onBackup} className="ad-btn ad-btn-ghost" style={{ fontSize: 13 }}>
                    <Download style={{ width: 14, height: 14 }} />
                    Backup Repository
                </button>
            </div>

            {/* Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                {installedComponents.map((comp) => (
                    <AdminCard key={comp.id} className="p-0">
                        <div className="ad-card-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                                <div className="ad-stat-icon blue">
                                    <Package />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, color: 'var(--ad-text)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {comp.manifest?.label || comp.id}
                                    </div>
                                    <div style={{ fontSize: 9, color: 'var(--ad-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginTop: 1 }}>
                                        {comp.manifest?.type || 'Component'}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => onDelete(comp.id)}
                                className="ad-btn-icon"
                                style={{ width: 28, height: 28, flexShrink: 0 }}
                                title="Delete component"
                            >
                                <Trash2 style={{ width: 12, height: 12, color: 'var(--ad-red)' }} />
                            </button>
                        </div>
                        <div className="ad-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                                <span style={{ color: 'var(--ad-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>Build</span>
                                <span style={{ color: 'var(--ad-text-2)', fontWeight: 700 }}>v{comp.manifest?.version || '1.0.0'}</span>
                            </div>
                            <div className="ad-mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ad-accent)', display: 'block' }}>
                                {comp.id}
                            </div>
                        </div>
                    </AdminCard>
                ))}

                {installedComponents.length === 0 && (
                    <div style={{
                        gridColumn: '1/-1', padding: '48px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                        border: '2px dashed var(--ad-border)', borderRadius: 14, backgroundColor: 'var(--ad-surface-2)',
                    }}>
                        <Box style={{ width: 40, height: 40, color: 'var(--ad-border)' }} />
                        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ad-text-3)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                            No components installed
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ComponentsTab;
