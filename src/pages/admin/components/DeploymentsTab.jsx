import AdminCard from './AdminCard';
import { useState, useEffect, useRef } from 'react';
import { fetchWorkflowLogs } from '../../../services/simulatorService';
import { Terminal, X, Play, Loader2, UploadCloud, RefreshCw, Zap, Bell, CheckCircle2, RotateCcw } from 'lucide-react';

/* ── Inline Log Viewer ──────────────────────────────────────────────── */
const WorkflowLogViewer = ({ repo, runId, onClose }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const scrollRef = useRef(null);

    useEffect(() => {
        let mounted = true;
        const fetch = async () => {
            try {
                const data = await fetchWorkflowLogs(repo, runId);
                if (mounted) { setLogs(data); setLoading(false); }
            } catch { if (mounted) setLoading(false); }
        };
        fetch();
        const iv = setInterval(fetch, 5000);
        return () => { mounted = false; clearInterval(iv); };
    }, [repo, runId]);

    useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [logs]);

    return (
        <div style={{ marginTop: 12, borderRadius: 12, border: '1px solid var(--ad-border)', overflow: 'hidden', backgroundColor: 'var(--ad-bg)' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--ad-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--ad-surface-2)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ad-text-2)' }}>
                    <Terminal style={{ width: 13, height: 13, color: 'var(--ad-accent)' }} />
                    Live Workflow Console
                </span>
                <button onClick={onClose} className="ad-btn-icon" style={{ width: 26, height: 26 }}>
                    <X style={{ width: 12, height: 12 }} />
                </button>
            </div>
            <div ref={scrollRef} style={{ height: 280, overflowY: 'auto', padding: '10px 14px', fontFamily: '"JetBrains Mono","Fira Code",monospace', fontSize: 11, lineHeight: 1.6, backgroundColor: 'var(--ad-bg)' }}>
                {loading ? (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--ad-text-3)' }}>
                        <Loader2 style={{ width: 24, height: 24 }} className="ad-spin" />
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Connecting to runner...</span>
                    </div>
                ) : logs.length > 0 ? logs.map((line, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '1px 0' }}>
                        <span style={{ color: 'var(--ad-text-3)', minWidth: 28, textAlign: 'right', flexShrink: 0, userSelect: 'none' }}>{i + 1}</span>
                        <span style={{ wordBreak: 'break-all', color: line.toLowerCase().includes('error') ? 'var(--ad-red)' : line.toLowerCase().includes('warning') ? 'var(--ad-amber)' : line.startsWith('>') ? 'var(--ad-accent)' : 'var(--ad-text-2)' }}>
                            {line}
                        </span>
                    </div>
                )) : (
                    <div style={{ color: 'var(--ad-text-3)', textAlign: 'center', padding: '60px 0', fontStyle: 'italic', opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10 }}>
                        Initializing build pipeline...
                    </div>
                )}
            </div>
        </div>
    );
};

/* ── Main Deployments Tab ───────────────────────────────────────────── */
const DeploymentsTab = ({ deployments, notifications = [], onApprove, onReject, onRollback, onTriggerBuild, onDismissNotification }) => {
    const [processingIds, setProcessingIds] = useState(new Set());
    const [processedIds, setProcessedIds] = useState(new Set());
    const [expandedIds, setExpandedIds] = useState(new Set());
    const [activeLog, setActiveLog] = useState(null);

    const toggleExpand = (id) => setExpandedIds(prev => {
        const n = new Set(prev);
        n.has(id) ? n.delete(id) : n.add(id);
        return n;
    });

    const handleAction = async (id, actionFn, arg) => {
        setProcessingIds(prev => new Set(prev).add(id));
        try {
            await actionFn(arg);
            setProcessedIds(prev => new Set(prev).add(arg.id));
        } finally {
            setProcessingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
        }
    };

    return (
        <div className="ad-space-y-6 ad-fade-in">
            {/* ── Change Requests ────────────────────────────────────── */}
            {notifications?.length > 0 && (
                <div className="ad-space-y-3">
                    <div className="ad-card-title">
                        <Bell style={{ color: 'var(--ad-amber)', animation: 'adPulse 2s infinite' }} />
                        Active Change Requests
                    </div>
                    {notifications.map(note => (
                        <AdminCard key={note.id} className="p-0" style={{ borderColor: 'color-mix(in srgb, var(--ad-amber) 25%, transparent)' }}>
                            <div className="ad-card-body" style={{ position: 'relative', paddingTop: 14 }}>
                                <button
                                    onClick={() => onDismissNotification?.(note.id)}
                                    className="ad-btn-icon"
                                    style={{ position: 'absolute', top: 10, right: 10, width: 26, height: 26 }}
                                >
                                    <X style={{ width: 12, height: 12 }} />
                                </button>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                                    <div className="ad-stat-icon amber" style={{ width: 36, height: 36, flexShrink: 0 }}>
                                        <RefreshCw />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 220 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--ad-text)', textTransform: 'capitalize' }}>{note.repo}</span>
                                            <span className="ad-badge warning">Update Available</span>
                                        </div>
                                        <p style={{ fontSize: 13, color: 'var(--ad-text-2)', marginBottom: 4 }}>{note.prTitle}</p>
                                        {note.prDescription && <p style={{ fontSize: 11, color: 'var(--ad-text-3)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{note.prDescription}</p>}
                                        <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 10, color: 'var(--ad-text-3)', fontWeight: 600 }}>
                                            <span>{new Date(note.timestamp).toLocaleString()}</span>
                                            {note.filesChanged?.length > 0 && <span style={{ color: 'var(--ad-accent)' }}>{note.filesChanged.length} Files Modified</span>}
                                        </div>
                                    </div>
                                    <button
                                        disabled={processingIds.has(`build-${note.id}`)}
                                        onClick={() => handleAction(`build-${note.id}`, () => onTriggerBuild(note.repo, note.id), { id: note.id })}
                                        className="ad-btn ad-btn-primary"
                                        style={{ backgroundColor: 'var(--ad-amber)', color: '#000', opacity: processingIds.has(`build-${note.id}`) ? 0.6 : 1 }}
                                    >
                                        {processingIds.has(`build-${note.id}`) ? <Loader2 style={{ width: 14, height: 14 }} className="ad-spin" /> : <Zap style={{ width: 14, height: 14 }} />}
                                        Trigger Build Pipeline
                                    </button>
                                </div>
                            </div>
                        </AdminCard>
                    ))}
                </div>
            )}

            {/* ── Deployment Cards ───────────────────────────────────── */}
            {deployments.filter(dep => !processedIds.has(dep.id)).map(dep => (
                <AdminCard key={dep.id} className="p-0" style={{ position: 'relative' }}>
                    {dep.status === 'waiting' && onReject && (
                        <button
                            disabled={processingIds.has(`reject-${dep.id}`)}
                            onClick={() => handleAction(`reject-${dep.id}`, onReject, dep)}
                            className="ad-btn-icon"
                            style={{ position: 'absolute', top: 10, right: 10, width: 28, height: 28, zIndex: 2 }}
                            title="Reject"
                        >
                            {processingIds.has(`reject-${dep.id}`) ? <Loader2 style={{ width: 13, height: 13, color: 'var(--ad-red)' }} className="ad-spin" /> : <X style={{ width: 13, height: 13 }} />}
                        </button>
                    )}

                    <div className="ad-card-body" style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                        {/* Left — info */}
                        <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {/* Header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{
                                    width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                                    backgroundColor: dep.status === 'waiting' ? 'var(--ad-amber)' : 'var(--ad-emerald)',
                                    boxShadow: dep.status === 'waiting' ? '0 0 10px var(--ad-amber)' : '0 0 10px var(--ad-emerald)',
                                    animation: dep.status === 'waiting' ? 'adPulse 2s infinite' : 'none',
                                }} />
                                <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--ad-text)' }}>{dep.name}</span>
                                <span className="ad-mono" style={{ fontSize: 10, color: 'var(--ad-text-3)' }}>{dep.repo}</span>
                            </div>

                            {/* Branch + Commit */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                {[
                                    { label: 'Target Branch', value: dep.head_branch, color: 'var(--ad-accent)' },
                                    { label: 'Commit Version', value: dep.head_sha?.slice(0, 12) || dep.head_commit?.slice(0, 12), mono: true },
                                ].map(f => (
                                    <div key={f.label} style={{ padding: '10px 12px', borderRadius: 10, backgroundColor: 'var(--ad-surface-2)', border: '1px solid var(--ad-border)' }}>
                                        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ad-text-3)', marginBottom: 5 }}>{f.label}</div>
                                        <div style={{ fontSize: 14, fontWeight: 800, color: f.color || 'var(--ad-text-2)', fontFamily: f.mono ? 'monospace' : 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.value}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Expand toggle */}
                            <button
                                onClick={() => toggleExpand(dep.id)}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--ad-accent)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            >
                                <svg style={{ width: 14, height: 14, transition: 'transform 0.2s', transform: expandedIds.has(dep.id) ? 'rotate(180deg)' : 'none' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                                {expandedIds.has(dep.id) ? 'Hide Details' : 'View Changes & Commits'}
                            </button>

                            {/* Expanded commits */}
                            {expandedIds.has(dep.id) && (dep.commit_message || dep.commits) && (
                                <div style={{ padding: 14, borderRadius: 10, backgroundColor: 'var(--ad-surface-2)', border: '1px solid var(--ad-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ad-text-3)' }}>Deployment Payload</span>
                                    {dep.commits ? dep.commits.map((commit, idx) => (
                                        <div key={idx} style={{ display: 'flex', gap: 10 }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, paddingTop: 4 }}>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--ad-accent)', boxShadow: '0 0 6px var(--ad-accent)', flexShrink: 0 }} />
                                                {idx !== dep.commits.length - 1 && <div style={{ width: 1, flex: 1, backgroundColor: 'var(--ad-border)' }} />}
                                            </div>
                                            <div style={{ flex: 1, paddingBottom: 10 }}>
                                                <span className="ad-badge blue" style={{ fontSize: 8, marginBottom: 4 }}>Commit</span>
                                                <p style={{ fontSize: 12, color: 'var(--ad-text-2)', margin: '4px 0' }}>{commit.message}</p>
                                                <div style={{ fontSize: 10, color: 'var(--ad-text-3)' }}>
                                                    <span className="ad-mono">{commit.sha?.slice(0, 7)}</span>
                                                    <span style={{ marginLeft: 8, fontStyle: 'italic' }}>by {commit.author?.name || commit.author}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )) : (
                                        <p style={{ fontSize: 12, color: 'var(--ad-text-2)', padding: '8px 10px', backgroundColor: 'var(--ad-surface)', borderRadius: 8, border: '1px solid var(--ad-border)' }}>
                                            {dep.commit_message}
                                        </p>
                                    )}
                                    {dep.pr && (
                                        <div style={{ paddingTop: 10, borderTop: '1px solid var(--ad-border)' }}>
                                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ad-emerald)', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                                                <CheckCircle2 style={{ width: 12, height: 12 }} /> Merged Pull Request
                                            </span>
                                            <div style={{ padding: '8px 12px', borderRadius: 8, backgroundColor: 'color-mix(in srgb, var(--ad-emerald) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--ad-emerald) 20%, transparent)' }}>
                                                <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--ad-text)' }}>#{dep.pr.number}: {dep.pr.title}</div>
                                                {dep.pr.body && <p style={{ fontSize: 11, color: 'var(--ad-text-3)', marginTop: 4 }}>{dep.pr.body}</p>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Job chips */}
                            {dep.jobs && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {dep.jobs.map((job, idx) => (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <a href={job.html_url} target="_blank" rel="noreferrer"
                                                className={`ad-badge ${job.conclusion === 'success' ? 'success' : job.conclusion === 'failure' ? 'error' : 'offline'}`}
                                                style={{ textDecoration: 'none', fontSize: 9 }}
                                            >
                                                {job.name}: {job.conclusion || job.status}
                                            </a>
                                            {job.status === 'in_progress' && (
                                                <button onClick={() => setActiveLog({ id: dep.id, repo: dep.repo })} className="ad-btn-icon" style={{ width: 22, height: 22 }} title="View live logs">
                                                    <Play style={{ width: 10, height: 10, fill: 'var(--ad-accent)', color: 'var(--ad-accent)' }} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Log viewer */}
                            {activeLog?.id === dep.id && (
                                <WorkflowLogViewer repo={activeLog.repo} runId={activeLog.id} onClose={() => setActiveLog(null)} />
                            )}
                        </div>

                        {/* Right — actions */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180, width: 180 }}>
                            {dep.status === 'waiting' && (
                                <button
                                    disabled={processingIds.has(dep.id)}
                                    onClick={() => handleAction(dep.id, onApprove, dep)}
                                    className="ad-btn ad-btn-primary"
                                    style={{ flex: 1, justifyContent: 'center', opacity: processingIds.has(dep.id) ? 0.6 : 1 }}
                                >
                                    {processingIds.has(dep.id) ? <Loader2 style={{ width: 14, height: 14 }} className="ad-spin" /> : <CheckCircle2 style={{ width: 14, height: 14 }} />}
                                    {processingIds.has(dep.id) ? 'Deploying...' : 'Deploy to Prod'}
                                </button>
                            )}
                            <button
                                disabled={processingIds.has(`rollback-${dep.repo}`)}
                                onClick={() => handleAction(`rollback-${dep.repo}`, onRollback, dep.repo)}
                                className="ad-btn ad-btn-ghost"
                                style={{ flex: 1, justifyContent: 'center', opacity: processingIds.has(`rollback-${dep.repo}`) ? 0.5 : 1 }}
                            >
                                {processingIds.has(`rollback-${dep.repo}`) ? <Loader2 style={{ width: 14, height: 14 }} className="ad-spin" /> : <RotateCcw style={{ width: 14, height: 14 }} />}
                                {processingIds.has(`rollback-${dep.repo}`) ? 'Rolling back...' : 'Rollback'}
                            </button>
                        </div>
                    </div>
                </AdminCard>
            ))}

            {deployments.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 12, opacity: 0.3 }}>
                    <UploadCloud style={{ width: 56, height: 56, color: 'var(--ad-text-3)' }} />
                    <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--ad-text-3)' }}>No Pending Deployments</p>
                </div>
            )}
        </div>
    );
};

export default DeploymentsTab;
