import AdminCard from './AdminCard';
import { useState, useEffect, useRef } from 'react';
import { fetchWorkflowLogs } from '../../../services/simulatorService';
import { Terminal, X, Play, Loader2, UploadCloud, RefreshCw, Zap, Bell } from 'lucide-react';

const WorkflowLogViewer = ({ repo, runId, onClose }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const scrollRef = useRef(null);

    useEffect(() => {
        let isMounted = true;
        const fetchLogs = async () => {
            try {
                const data = await fetchWorkflowLogs(repo, runId);
                if (isMounted) {
                    setLogs(data);
                    setLoading(false);
                }
            } catch (e) {
                if (isMounted) setLoading(false);
            }
        };

        fetchLogs();
        const interval = setInterval(fetchLogs, 5000);
        return () => { isMounted = false; clearInterval(interval); };
    }, [repo, runId]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div className="mt-6 bg-black rounded-2xl border border-white/10 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-white/5 p-4 border-b border-white/10 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <Terminal className="w-4 h-4 text-blue-400" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Live Workflow Console</span>
                </div>
                <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>
            <div 
                ref={scrollRef}
                className="p-6 h-80 overflow-y-auto font-mono text-[11px] leading-relaxed custom-scrollbar bg-black/40"
            >
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-600">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Connecting to runner...</span>
                    </div>
                ) : logs.length > 0 ? (
                    logs.map((line, i) => (
                        <div key={i} className="flex gap-4 hover:bg-white/5 py-0.5 px-2 -mx-2 rounded transition-colors group">
                            <span className="text-slate-700 shrink-0 w-8 text-right select-none">{i + 1}</span>
                            <span className={`break-all ${
                                line.toLowerCase().includes('error') ? 'text-red-400' : 
                                line.toLowerCase().includes('warning') ? 'text-amber-400' : 
                                line.startsWith('>') ? 'text-blue-400 font-bold' : 'text-slate-300'
                            }`}>
                                {line}
                            </span>
                        </div>
                    ))
                ) : (
                    <div className="text-slate-700 italic text-center py-20 uppercase font-black tracking-widest opacity-30">
                        Initializing build pipeline...
                    </div>
                )}
            </div>
        </div>
    );
};

const DeploymentsTab = ({ deployments, notifications = [], onApprove, onRollback, onTriggerBuild }) => {
    const [processingIds, setProcessingIds] = useState(new Set());
    const [expandedIds, setExpandedIds] = useState(new Set());
    const [activeLog, setActiveLog] = useState(null); // { id: runId, repo: string }


    const toggleExpand = (id) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleAction = async (id, actionFn, arg) => {
        setProcessingIds(prev => new Set(prev).add(id));
        try {
            await actionFn(arg);
        } finally {
            setProcessingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };
    return (
        <div className="space-y-6">
            {/* Incoming Change Notifications Section */}
            {notifications && notifications.length > 0 && (
                <div className="space-y-4 mb-12 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-3 px-2">
                        <Bell className="w-5 h-5 text-amber-500 animate-bounce" />
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">Active Change Requests</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        {notifications.map((note) => (
                            <AdminCard key={note.id} className="bg-amber-500/5 border-amber-500/10 hover:bg-amber-500/10 transition-all">
                                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-amber-500/20 rounded-xl text-amber-500 mt-1">
                                            <RefreshCw className="w-5 h-5" />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-lg font-black text-white capitalize">{note.repo}</h3>
                                                <span className="text-[10px] font-black bg-amber-500 text-black px-2 py-0.5 rounded uppercase">Update Available</span>
                                            </div>
                                            <p className="text-slate-300 font-bold leading-relaxed">{note.prTitle}</p>
                                            {note.prDescription && (
                                                <p className="text-slate-500 text-xs line-clamp-2 mt-1">{note.prDescription}</p>
                                            )}
                                            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400/50 mt-1">
                                                <span>{new Date(note.timestamp).toLocaleString()}</span>
                                                {note.filesChanged && note.filesChanged.length > 0 && (
                                                    <span className="text-blue-400">{note.filesChanged.length} Files Modified</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                        disabled={processingIds.has(`build-${note.id}`)}
                                        onClick={() => handleAction(`build-${note.id}`, () => onTriggerBuild(note.repo, note.id))}
                                        className="w-full md:w-auto px-8 py-4 bg-amber-500 hover:bg-amber-400 text-black font-black text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-amber-900/20"
                                    >
                                        {processingIds.has(`build-${note.id}`) ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>
                                                <Zap className="w-5 h-5" />
                                                Trigger Build Pipeline
                                            </>
                                        )}
                                    </button>
                                </div>
                            </AdminCard>
                        ))}
                    </div>
                </div>
            )}

            {deployments.map(dep => (
                <AdminCard key={dep.id} className="hover:bg-white/[0.04] shadow-2xl">
                    <div className="flex flex-col xl:flex-row justify-between gap-8">
                        <div className="flex-1 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className={`w-4 h-4 rounded-full ${dep.status === 'waiting' ? 'bg-amber-500 animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.6)]' : 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.6)]'}`}></div>
                                <h3 className="text-xl font-black text-white tracking-tight">{dep.name} <span className="text-slate-500 text-xs font-bold ml-2 uppercase tracking-[0.2em]">{dep.repo}</span></h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5 space-y-2">
                                    <div className="flex items-center gap-2 text-slate-500">
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" />
                                        </svg>
                                        <span className="text-[10px] uppercase font-black tracking-[0.2em]">Target Branch</span>
                                    </div>
                                    <span className="text-lg font-black text-blue-400 block">{dep.head_branch}</span>
                                </div>
                                <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5 space-y-2">
                                    <div className="flex items-center gap-2 text-slate-500">
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
                                        </svg>
                                        <span className="text-[10px] uppercase font-black tracking-[0.2em]">Commit Version</span>
                                    </div>
                                    <span className="text-lg font-black text-slate-300 block font-mono truncate max-w-[200px]" title={dep.head_commit}>
                                        {dep.head_sha?.slice(0, 12) || (dep.head_commit?.length < 20 ? dep.head_commit : dep.head_commit?.slice(0, 12))}
                                    </span>
                                </div>
                            </div>

                            <div className="pt-6">
                                <button 
                                    onClick={() => toggleExpand(dep.id)}
                                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 hover:text-blue-300 transition-colors group mb-4"
                                >
                                    <svg 
                                        className={`w-4 h-4 transition-transform duration-300 ${expandedIds.has(dep.id) ? 'rotate-180' : ''}`} 
                                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                                    >
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                    {expandedIds.has(dep.id) ? 'Hide Details' : 'View Changes & Commits'}
                                </button>
                            </div>

                            {/* Collapsible Commit Messages Section */}
                            {expandedIds.has(dep.id) && (dep.commit_message || dep.commits) && (
                                <div className="bg-slate-900/40 border border-white/5 rounded-xl p-6 space-y-4 animate-in slide-in-from-top-2 duration-300">
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                                        </svg>
                                        <span className="text-[10px] uppercase font-black tracking-[0.2em]">Deployment Payload</span>
                                    </div>
                                    
                                    {dep.commits ? (
                                        <div className="space-y-4">
                                            {dep.commits.map((commit, idx) => (
                                                <div key={idx} className="flex gap-4 group">
                                                    <div className="flex flex-col items-center gap-1 mt-1.5">
                                                        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                                                        {idx !== dep.commits.length - 1 && <div className="w-px flex-1 bg-white/10"></div>}
                                                    </div>
                                                    <div className="flex-1 pb-4">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">Commit</span>
                                                            <p className="text-slate-200 text-sm font-medium leading-relaxed">{commit.message}</p>
                                                        </div>
                                                        <div className="flex items-center gap-3 mt-1.5">
                                                            <span className="text-[10px] font-mono text-slate-500 font-bold uppercase">{commit.sha?.slice(0, 7)}</span>
                                                            <span className="text-[10px] text-slate-600 font-bold italic">by {commit.author?.name || commit.author}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-slate-300 text-sm leading-relaxed font-medium bg-white/5 p-4 rounded-lg border border-white/5">
                                            {dep.commit_message}
                                        </p>
                                    )}

                                    {/* PR Section if available */}
                                    {dep.pr && (
                                        <div className="pt-4 border-t border-white/5 mt-4">
                                            <div className="flex items-center gap-2 text-emerald-400 mb-3">
                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" />
                                                </svg>
                                                <span className="text-[10px] uppercase font-black tracking-[0.2em]">Merged Pull Request</span>
                                            </div>
                                            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-4">
                                                <h4 className="text-white font-black text-sm mb-1">#{dep.pr.number}: {dep.pr.title}</h4>
                                                <p className="text-slate-400 text-xs line-clamp-2">{dep.pr.body}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {dep.jobs && (
                                <div className="flex flex-wrap gap-3 pt-4">
                                    {dep.jobs.map((job, idx) => (
                                        <div key={idx} className="flex items-center gap-1 group/job">
                                            <a href={job.html_url} target="_blank" rel="noreferrer" 
                                               className={`text-[9px] font-black px-4 py-2 rounded-full border transition-all uppercase tracking-widest ${
                                                    job.conclusion === 'success' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 
                                                    job.conclusion === 'failure' ? 'border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 
                                                    'border-slate-700 text-slate-500 hover:border-slate-500 bg-slate-900/80'
                                                }`}>
                                                {job.name}: {job.conclusion || job.status}
                                            </a>
                                            {job.status === 'in_progress' && (
                                                <button 
                                                    onClick={() => setActiveLog({ id: dep.id, repo: dep.repo })}
                                                    className="p-2 bg-blue-600/20 text-blue-400 rounded-full hover:bg-blue-600/40 transition-all"
                                                    title="View Live Logs"
                                                >
                                                    <Play className="w-3 h-3 fill-current" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeLog && activeLog.id === dep.id && (
                                <WorkflowLogViewer 
                                    repo={activeLog.repo} 
                                    runId={activeLog.id} 
                                    onClose={() => setActiveLog(null)} 
                                />
                            )}
                        </div>

                        <div className="flex flex-row xl:flex-col gap-3 min-w-[200px]">
                            {dep.status === 'waiting' && (
                                <button 
                                    disabled={processingIds.has(dep.id)}
                                    onClick={() => handleAction(dep.id, onApprove, dep)}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:opacity-50 text-white font-black text-sm py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-emerald-900/30"
                                >
                                    {processingIds.has(dep.id) ? (
                                        <>
                                            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                            </svg>
                                            Deploying...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                                            </svg> 
                                            Deploy to Prod
                                        </>
                                    )}
                                </button>
                            )}
                            <button 
                                disabled={processingIds.has(`rollback-${dep.repo}`)}
                                onClick={() => handleAction(`rollback-${dep.repo}`, onRollback, dep.repo)}
                                className="flex-1 bg-slate-800 hover:bg-red-600/10 hover:text-red-500 disabled:opacity-30 text-slate-200 font-black text-sm py-4 rounded-xl border border-white/10 flex items-center justify-center gap-2 transition-all"
                            >
                                {processingIds.has(`rollback-${dep.repo}`) ? (
                                    <>
                                        <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                        </svg>
                                        Rolling back...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
                                        </svg> 
                                        Rollback
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </AdminCard>
            ))}
            {deployments.length === 0 && (
                <div className="flex flex-col items-center justify-center py-32 space-y-6 opacity-20">
                    <UploadCloud className="w-20 h-20 text-slate-500" />
                    <div className="text-slate-500 text-center italic font-black uppercase tracking-[0.4em]">
                        No Pending Deployments
                    </div>
                </div>
            )}
        </div>
    );
};

export default DeploymentsTab;
