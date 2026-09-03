import React from 'react';
import { Terminal, Download, Play, CheckCircle2, XCircle, Package } from 'lucide-react';
import AdminCard from './AdminCard';

const ApprovalsTab = ({ pendingComponents, onPreview, onDownload, onTest, onApprove, onReject }) => {
    return (
        <div className="ad-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))', gap: 16 }}>
            {pendingComponents.map((comp) => (
                <AdminCard key={comp.id} className="p-0">
                    <div className="ad-card-header">
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="ad-card-title" style={{ fontSize: 14, fontWeight: 800 }}>
                                {comp.manifest.label}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--ad-text-3)', fontFamily: 'monospace', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {comp.id}
                            </div>
                        </div>
                        <span className="ad-badge blue">{comp.manifest.type || 'Custom'}</span>
                    </div>

                    <div className="ad-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Meta rows */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {[
                                { label: 'Group', value: comp.manifest.group || '—' },
                                { label: 'Submitted', value: comp.timestamp ? new Date(comp.timestamp).toLocaleDateString() : 'Unknown' },
                            ].map(row => (
                                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                                    <span style={{ color: 'var(--ad-text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>{row.label}</span>
                                    <span style={{ color: 'var(--ad-text)', fontWeight: 700 }}>{row.value}</span>
                                </div>
                            ))}
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                            {[
                                { label: 'Transpile', icon: Terminal,    color: 'var(--ad-accent)',   onClick: () => onPreview(comp) },
                                { label: 'ZIP',       icon: Download,    color: 'var(--ad-emerald)',  onClick: () => onDownload(comp) },
                                { label: 'Test',      icon: Play,        color: 'var(--ad-amber)',    onClick: () => onTest(comp) },
                            ].map(btn => (
                                <button
                                    key={btn.label}
                                    onClick={btn.onClick}
                                    style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                        padding: '10px 4px', borderRadius: 9, border: '1px solid var(--ad-border)',
                                        background: 'var(--ad-surface-2)', cursor: 'pointer', transition: 'all 0.15s',
                                        fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                                        color: 'var(--ad-text-2)',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--ad-surface-3)'; e.currentTarget.style.borderColor = 'var(--ad-border-2)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--ad-surface-2)'; e.currentTarget.style.borderColor = 'var(--ad-border)'; }}
                                >
                                    <btn.icon style={{ width: 16, height: 16, color: btn.color }} />
                                    {btn.label}
                                </button>
                            ))}

                            {/* Approve / Reject */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <button
                                    onClick={() => onApprove(comp)}
                                    style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: 'none', background: 'var(--ad-emerald)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <CheckCircle2 style={{ width: 15, height: 15 }} />
                                </button>
                                <button
                                    onClick={() => onReject(comp)}
                                    style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: 'none', background: 'var(--ad-red)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <XCircle style={{ width: 15, height: 15 }} />
                                </button>
                            </div>
                        </div>
                    </div>
                </AdminCard>
            ))}

            {pendingComponents.length === 0 && (
                <div style={{
                    gridColumn: '1/-1', padding: '64px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                    border: '2px dashed var(--ad-border)', borderRadius: 16, backgroundColor: 'var(--ad-surface-2)',
                }}>
                    <Package style={{ width: 48, height: 48, color: 'var(--ad-border)', opacity: 0.5 }} />
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ad-text-3)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                        No components awaiting approval
                    </p>
                </div>
            )}
        </div>
    );
};

export default ApprovalsTab;
