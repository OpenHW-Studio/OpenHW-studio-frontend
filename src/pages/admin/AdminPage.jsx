import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import * as Babel from '@babel/standalone';
import {
    LayoutDashboard,
    Library,
    Puzzle,
    Package,
    Terminal,
    LogOut,
    Plus,
    Search,
    Trash2,
    RefreshCw,
    Download,
    Play,
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle,
    ChevronRight,
    Activity,
    UploadCloud,
    History
} from 'lucide-react';
import {
    fetchInstalledLibraries,
    uninstallLibrary,
    searchLibraries,
    installLibrary,
    approveCustomComponent,
    fetchPendingComponents,
    rejectCustomComponent,
    getInstalledComponents,
    deleteInstalledComponent,
    backupInstalledComponents,
    submitCustomComponent,
    fetchPendingDeployments,
    approveDeploymentAction,
    rollbackDeploymentAction
} from '../../services/simulatorService.js';
import { useAuth } from '../../context/AuthContext';

export default function AdminPage() {
    const navigate = useNavigate();
    const { adminLogout } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [libraries, setLibraries] = useState([]);
    const [pendingComponents, setPendingComponents] = useState([]);
    const [installedComponents, setInstalledComponents] = useState([]);
    const [deployments, setDeployments] = useState([]);
    const [logs, setLogs] = useState([]);
    const [transpileModal, setTranspileModal] = useState(null);
    const [libraryModal, setLibraryModal] = useState(false);
    const [libSearchQuery, setLibSearchQuery] = useState('');
    const [libSearchResults, setLibSearchResults] = useState([]);
    const [isSearchingLibs, setIsSearchingLibs] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const restoreInputRef = useRef(null);

    // Stats calculation
    const stats = [
        { label: 'Libraries', value: libraries.length, icon: <Library className="w-5 h-5" />, color: 'text-blue-500' },
        { label: 'Pending', value: pendingComponents.length, icon: <Clock className="w-5 h-5" />, color: 'text-amber-500' },
        { label: 'Installed', value: installedComponents.length, icon: <Puzzle className="w-5 h-5" />, color: 'text-emerald-500' },
        { label: 'Deployments', value: deployments.filter(d => d.status === 'waiting').length, icon: <Activity className="w-5 h-5" />, color: 'text-purple-500' },
    ];

    const loadData = async () => {
        try {
            const [libs, pending, installed, deps] = await Promise.all([
                fetchInstalledLibraries(),
                fetchPendingComponents(),
                getInstalledComponents(),
                fetchPendingDeployments()
            ]);
            setLibraries(libs);
            setPendingComponents(pending);
            setInstalledComponents(installed);
            setDeployments(deps);
        } catch (e) {
            addLog(`Error loading data: ${e.message}`, 'error');
        }
    };

    useEffect(() => {
        loadData();
        const poll = setInterval(async () => {
            try {
                const comps = await fetchPendingComponents();
                setPendingComponents(comps);
            } catch (_) { }
        }, 15000);
        return () => clearInterval(poll);
    }, []);

    const addLog = (msg, type = 'info') => {
        setLogs(prev => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev].slice(0, 100));
    };

    const handleLogout = () => {
        adminLogout();
        navigate('/admin');
    };

    const handleSearchLibraries = async () => {
        if (!libSearchQuery.trim()) return;
        setIsSearchingLibs(true);
        addLog(`Searching registry for "${libSearchQuery}"...`);
        try {
            const results = await searchLibraries(libSearchQuery);
            setLibSearchResults(results);
            addLog(`Found ${results.length} libraries.`);
        } catch (e) {
            addLog(`Search failed: ${e.message}`, 'error');
        } finally {
            setIsSearchingLibs(false);
        }
    };

    const handleInstallLib = async (libName) => {
        addLog(`Installing ${libName}...`);
        try {
            await installLibrary(libName);
            addLog(`Successfully installed ${libName}`, 'success');
            loadData();
        } catch (e) {
            addLog(`Installation failed: ${e.message}`, 'error');
        }
    };

    // --- Actions ---
    const handleApproveDeployment = async (dep) => {
        addLog(`Approving deployment for ${dep.repo}...`);
        try {
            await approveDeploymentAction(dep.id, dep.repo, 'production');
            addLog(`Successfully approved deployment for ${dep.repo}`, 'success');
            loadData();
        } catch (e) {
            addLog(`Failed to approve deployment: ${e.message}`, 'error');
        }
    };

    const handleRollback = async (repo) => {
        addLog(`Triggering rollback for ${repo}...`);
        try {
            await rollbackDeploymentAction(repo);
            addLog(`Successfully triggered rollback for ${repo}`, 'success');
        } catch (e) {
            addLog(`Failed to trigger rollback: ${e.message}`, 'error');
        }
    };

    const handlePreviewComponent = (comp) => {
        addLog(`Running transpile check on ${comp.id}...`);
        const results = [];
        const tryTranspile = (src, filename, preset) => {
            if (!src) return { file: filename, ok: false, lines: 0, error: 'No source code found.' };
            try {
                const out = Babel.transform(src, { filename, presets: preset }).code;
                return { file: filename, ok: true, lines: out.split('\n').length, error: null };
            } catch (e) {
                return { file: filename, ok: false, lines: 0, error: e.message };
            }
        };
        results.push(tryTranspile(comp.uiRaw, 'ui.tsx', ['react', 'typescript', 'env']));
        results.push(tryTranspile(comp.logicRaw, 'logic.ts', ['typescript', 'env']));
        results.push(tryTranspile(comp.validationRaw, 'validation.ts', ['typescript', 'env']));
        results.push(tryTranspile(comp.indexRaw, 'index.ts', ['typescript', 'env']));

        const allOk = results.every(r => r.ok);
        addLog(allOk ? `✅ ${comp.id}: Transpile successful` : `❌ ${comp.id}: Transpile errors`, allOk ? 'success' : 'error');
        setTranspileModal({ id: comp.id, label: comp.manifest.label, results });
    };

    const handleDownloadZIP = async (comp) => {
        try {
            const zip = new JSZip();
            const folder = zip.folder(comp.id);
            folder.file('manifest.json', JSON.stringify(comp.manifest, null, 2));
            if (comp.uiRaw) folder.file('ui.tsx', comp.uiRaw);
            if (comp.logicRaw) folder.file('logic.ts', comp.logicRaw);
            if (comp.validationRaw) folder.file('validation.ts', comp.validationRaw);
            if (comp.indexRaw) folder.file('index.ts', comp.indexRaw);
            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${comp.id}.zip`;
            a.click();
            URL.revokeObjectURL(url);
            addLog(`Downloaded ${comp.id}.zip`, 'success');
        } catch (e) {
            addLog(`Download failed: ${e.message}`, 'error');
        }
    };

    const handleTestInSimulator = (comp) => {
        const previewKey = `simulatorPreview_${comp.id}_${Date.now()}`;
        sessionStorage.setItem(previewKey, JSON.stringify({ ...comp }));
        sessionStorage.setItem('pendingPreviewKey', previewKey);
        window.open('/simulator', '_blank');
        addLog(`Opened simulator preview for ${comp.id}`);
    };

    const handleApproveComponent = async (comp) => {
        addLog(`Merging ${comp.id} into backend...`);
        try {
            await approveCustomComponent({
                submissionId: comp.submissionId,
                id: comp.id,
                manifest: comp.manifest,
                ui: comp.uiRaw,
                logic: comp.logicRaw,
                validation: comp.validationRaw,
                index: comp.indexRaw
            });
            addLog(`Merged ${comp.id} successfully!`, 'success');
            loadData();
        } catch (e) {
            addLog(`Approval failed: ${e.message}`, 'error');
        }
    };

    const handleRejectComponent = async (comp) => {
        try {
            await rejectCustomComponent(comp.submissionId || comp.id);
            addLog(`Rejected ${comp.id}`, 'success');
            loadData();
        } catch (e) {
            addLog(`Rejection failed: ${e.message}`, 'error');
        }
    };

    const handleDeleteInstalled = async (id) => {
        try {
            await deleteInstalledComponent(id);
            addLog(`Deleted ${id}`, 'success');
            loadData();
        } catch (e) {
            addLog(`Deletion failed: ${e.message}`, 'error');
        }
    };

    const handleRestoreFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        addLog(`Restoring components from ${file.name}...`);
        // ... (Restore logic simplified for brevity here, keeping it same as original but using loadData)
        // Original logic from AdminPage.jsx line 248-322
        try {
            const zip = new JSZip();
            const loadedZip = await zip.loadAsync(file);
            const manifestPaths = [];
            loadedZip.forEach((rel, entry) => { if (rel.endsWith('manifest.json')) manifestPaths.push(rel); });
            for (const path of manifestPaths) {
                const dir = path.replace('manifest.json', '');
                const manifest = JSON.parse(await loadedZip.file(path).async('string'));
                const payload = {
                    id: manifest.id || dir.split('/')[0],
                    manifest,
                    ui: await loadedZip.file(dir + 'ui.tsx').async('string'),
                    logic: await loadedZip.file(dir + 'logic.ts').async('string'),
                    index: await loadedZip.file(dir + 'index.ts').async('string'),
                    validation: loadedZip.file(dir + 'validation.ts') ? await loadedZip.file(dir + 'validation.ts').async('string') : null
                };
                await submitCustomComponent(payload);
            }
            addLog(`Restored components from ${file.name}`, 'success');
            loadData();
        } catch (err) { addLog(`Restore failed: ${err.message}`, 'error'); }
        e.target.value = null;
    };

    // --- Render Helpers ---


    return (
        <div className="flex h-screen bg-[#070b14] text-slate-100 font-sans overflow-hidden">
            {/* Sidebar */}
            <aside className="w-72 bg-[#0d1525] border-r border-white/5 flex flex-col p-8 z-20">
                <div className="flex items-center gap-4 px-2 mb-12">
                    <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                        <Activity className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-2xl font-black tracking-tighter uppercase">Admin<span className="text-blue-500">Hub</span></span>
                </div>

                <nav className="flex-1 space-y-3">
                    {[
                        { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
                        { id: 'libraries', icon: Library, label: 'Libraries' },
                        { id: 'approval', icon: Clock, label: 'Approvals' },
                        { id: 'installed', icon: Puzzle, label: 'Components' },
                        { id: 'deployments', icon: UploadCloud, label: 'CI/CD' },
                        { id: 'logs', icon: Terminal, label: 'System Logs' },
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all font-bold ${
                                activeTab === item.id 
                                ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' 
                                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                            }`}
                        >
                            <item.icon className="w-5 h-5" />
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="mt-auto pt-8 border-t border-white/5">
                    <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all font-bold"
                    >
                        <LogOut className="w-5 h-5" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-12 lg:p-16 custom-scrollbar relative">
                <header className="flex justify-between items-end mb-16">
                    <div>
                        <h1 className="text-4xl font-black capitalize tracking-tight text-white mb-2">
                            {activeTab.replace('-', ' ')}
                        </h1>
                        <p className="text-slate-400 text-lg font-medium">Management and Monitoring Portal</p>
                    </div>
                    <button 
                        onClick={loadData}
                        className="p-4 bg-slate-800/50 hover:bg-slate-800 rounded-2xl transition-all text-slate-300 border border-white/5"
                        title="Refresh Data"
                    >
                        <RefreshCw className="w-6 h-6" />
                    </button>
                </header>

                {/* Tab Content */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {activeTab === 'overview' && (
                        <div className="space-y-8">
                            {/* Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                                {stats.map((stat, i) => (
                                    <div key={i} className="admin-glass-card p-8 rounded-[2rem] border border-white/5 transition-all hover:translate-y-[-4px]">
                                        <div className={`p-4 rounded-2xl bg-slate-900 w-fit mb-6 shadow-inner ${stat.color}`}>
                                            {stat.icon}
                                        </div>
                                        <div className="text-4xl font-black mb-2 text-white">{stat.value}</div>
                                        <div className="text-slate-500 text-sm font-bold uppercase tracking-widest">{stat.label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Recent Activity Mock/Logs */}
                            <div className="admin-glass-card rounded-[2rem] border border-white/5 overflow-hidden">
                                <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
                                    <h3 className="text-xl font-bold text-white tracking-tight">System Events</h3>
                                    <Terminal className="w-5 h-5 text-slate-500" />
                                </div>
                                <div className="p-8 space-y-4 max-h-[400px] overflow-y-auto font-mono text-sm custom-scrollbar">
                                    {logs.slice(0, 10).map((log, i) => (
                                        <div key={i} className="flex gap-6 items-start group">
                                            <span className="text-slate-600 shrink-0 font-bold">[{log.time}]</span>
                                            <span className={`leading-relaxed ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-emerald-400' : 'text-slate-400'}`}>
                                                {log.msg}
                                            </span>
                                        </div>
                                    ))}
                                    {logs.length === 0 && <div className="text-slate-600 text-center py-20 italic font-medium">No recent events recorded in the current stream</div>}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'libraries' && (
                        <div className="bg-[#0d1525] rounded-2xl border border-slate-800 p-6">
                            <div className="flex gap-4 mb-6">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input 
                                        type="text" 
                                        placeholder="Search installed libraries..." 
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <button 
                                    onClick={() => setLibraryModal(true)}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20"
                                >
                                    <Plus className="w-4 h-4" /> Add New Library
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {libraries
                                    .filter(l => l.library.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                    .map((lib, i) => (
                                    <div key={i} className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex justify-between items-center group">
                                        <div>
                                            <div className="font-bold">{lib.library.name}</div>
                                            <div className="text-xs text-slate-500 font-medium">v{lib.library.version}</div>
                                        </div>
                                        <button 
                                            onClick={() => uninstallLibrary(lib.library.name)}
                                            className="p-2 text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'approval' && (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            {pendingComponents.map((comp) => (
                                <div key={comp.id} className="bg-[#0d1525] border border-slate-800 rounded-2xl p-6 flex flex-col">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h3 className="text-lg font-black">{comp.manifest.label}</h3>
                                            <p className="text-xs text-slate-500 mt-1 font-mono">{comp.id}</p>
                                        </div>
                                        <span className="bg-blue-500/10 text-blue-400 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
                                            {comp.manifest.type || 'Custom'}
                                        </span>
                                    </div>
                                    
                                    <div className="flex-1 space-y-4 mb-8">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-500">Group</span>
                                            <span className="text-slate-300 font-medium">{comp.manifest.group || '—'}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-500">Submitted</span>
                                            <span className="text-slate-300 font-medium">
                                                {comp.timestamp ? new Date(comp.timestamp).toLocaleDateString() : 'Unknown'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        <button onClick={() => handlePreviewComponent(comp)} className="flex flex-col items-center gap-1.5 p-2 bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors text-[10px] font-bold uppercase tracking-tight">
                                            <Terminal className="w-4 h-4 text-blue-500" /> Transpile
                                        </button>
                                        <button onClick={() => handleDownloadZIP(comp)} className="flex flex-col items-center gap-1.5 p-2 bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors text-[10px] font-bold uppercase tracking-tight">
                                            <Download className="w-4 h-4 text-emerald-500" /> ZIP
                                        </button>
                                        <button onClick={() => handleTestInSimulator(comp)} className="flex flex-col items-center gap-1.5 p-2 bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors text-[10px] font-bold uppercase tracking-tight">
                                            <Play className="w-4 h-4 text-amber-500" /> Test
                                        </button>
                                        <div className="flex gap-1">
                                            <button onClick={() => handleApproveComponent(comp)} className="flex-1 p-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors flex items-center justify-center">
                                                <CheckCircle2 className="w-4 h-4 text-white" />
                                            </button>
                                            <button onClick={() => handleRejectComponent(comp)} className="flex-1 p-2 bg-red-600 hover:bg-red-500 rounded-lg transition-colors flex items-center justify-center">
                                                <XCircle className="w-4 h-4 text-white" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {pendingComponents.length === 0 && (
                                <div className="col-span-full py-20 bg-[#0d1525]/30 border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center text-slate-500">
                                    <Package className="w-12 h-12 mb-4 opacity-20" />
                                    <p className="font-medium">No components awaiting approval</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'installed' && (
                        <div className="space-y-6">
                            <div className="flex gap-4">
                                <button 
                                    onClick={() => restoreInputRef.current.click()}
                                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold flex items-center gap-2 transition-all border border-slate-700"
                                >
                                    <Plus className="w-5 h-5 text-blue-500" /> Import components
                                </button>
                                <button 
                                    onClick={backupInstalledComponents}
                                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold flex items-center gap-2 transition-all border border-slate-700"
                                >
                                    <Download className="w-5 h-5 text-emerald-500" /> Backup Repository
                                </button>
                                <input type="file" ref={restoreInputRef} onChange={handleRestoreFile} className="hidden" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                                {installedComponents.map(comp => (
                                    <div key={comp.id} className="admin-glass-card p-8 rounded-[2rem] border border-white/5 flex justify-between items-start group transition-all hover:bg-white/[0.08]">
                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="font-bold text-xl text-white tracking-tight">{comp.manifest.label}</h4>
                                                <p className="text-xs text-slate-500 font-mono mt-1 uppercase tracking-widest">{comp.id}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] px-3 py-1.5 bg-slate-900 rounded-full border border-white/5 text-slate-400 font-black uppercase tracking-widest">
                                                    Build v{comp.manifest.version || '1.0.0'}
                                                </span>
                                                <span className="text-[10px] px-3 py-1.5 bg-blue-500/10 rounded-full border border-blue-500/20 text-blue-400 font-black uppercase tracking-widest">
                                                    {comp.manifest.type || 'Standard'}
                                                </span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleDeleteInstalled(comp.id)}
                                            className="p-3 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'deployments' && (
                        <div className="space-y-4">
                            {deployments.map(dep => (
                                <div key={dep.id} className="bg-[#0d1525] border border-slate-800 rounded-2xl p-6">
                                    <div className="flex flex-col md:flex-row justify-between gap-6">
                                        <div className="flex-1 space-y-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-3 h-3 rounded-full ${dep.status === 'waiting' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                                                <h3 className="text-xl font-black">{dep.name} <span className="text-slate-500 text-sm font-medium ml-2">{dep.repo}</span></h3>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                                                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Branch</span>
                                                    <span className="text-sm font-mono text-blue-400">{dep.head_branch}</span>
                                                </div>
                                                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                                                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Commit</span>
                                                    <span className="text-sm font-mono text-slate-300">{dep.head_commit?.slice(0, 7)}</span>
                                                </div>
                                            </div>
                                            
                                            {dep.jobs && (
                                                <div className="flex flex-wrap gap-2">
                                                    {dep.jobs.map((job, idx) => (
                                                        <a key={idx} href={job.html_url} target="_blank" rel="noreferrer" 
                                                           className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all ${
                                                                job.conclusion === 'success' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10' : 
                                                                job.conclusion === 'failure' ? 'border-red-500/30 text-red-400 bg-red-500/5 hover:bg-red-500/10' : 
                                                                'border-slate-700 text-slate-500 hover:border-slate-500'
                                                            }`}>
                                                            {job.name}: {job.conclusion || job.status}
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-row md:flex-col gap-3 min-w-[200px]">
                                            {dep.status === 'waiting' && (
                                                <button 
                                                    onClick={() => handleApproveDeployment(dep)}
                                                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
                                                >
                                                    <CheckCircle2 className="w-5 h-5" /> Deploy to Prod
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => handleRollback(dep.repo)}
                                                className="flex-1 bg-slate-800 hover:bg-red-600/10 hover:text-red-500 text-slate-300 font-bold py-3 rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-all"
                                            >
                                                <History className="w-5 h-5" /> Rollback
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'logs' && (
                        <div className="bg-[#0d1525] rounded-2xl border border-slate-800 flex flex-col h-[calc(100vh-250px)]">
                            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                    <span className="text-sm font-bold text-slate-400">Live System Console</span>
                                </div>
                                <button 
                                    onClick={() => setLogs([])}
                                    className="text-xs text-slate-500 hover:text-slate-300 font-bold uppercase tracking-wider transition-colors"
                                >
                                    Clear Stream
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 font-mono text-sm space-y-2 bg-[#070b14]/50 custom-scrollbar">
                                {logs.map((log, i) => (
                                    <div key={i} className="flex gap-4 group">
                                        <span className="text-slate-600 shrink-0 w-24">[{log.time}]</span>
                                        <span className={`w-4 h-4 mt-0.5 shrink-0 ${log.type === 'error' ? 'text-red-500' : log.type === 'success' ? 'text-emerald-500' : 'text-blue-500'}`}>
                                            {log.type === 'error' ? <XCircle className="w-4 h-4" /> : log.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                        </span>
                                        <span className={`break-all ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-emerald-400' : 'text-slate-300'}`}>
                                            {log.msg}
                                        </span>
                                    </div>
                                ))}
                                {logs.length === 0 && <div className="text-slate-700 text-center py-20 italic">Awaiting system events...</div>}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Library Search Modal */}
            {libraryModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-[#0d1525] border border-white/5 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
                        <div className="p-10 border-b border-white/5 flex justify-between items-center bg-white/5">
                            <div>
                                <h2 className="text-2xl font-black tracking-tight text-white">Library Registry</h2>
                                <p className="text-sm text-slate-400 mt-1 uppercase tracking-widest font-bold">Arduino Library Manager</p>
                            </div>
                            <button onClick={() => { setLibraryModal(false); setLibSearchResults([]); }} className="p-3 hover:bg-white/5 rounded-full transition-colors text-slate-500">
                                <XCircle className="w-8 h-8" />
                            </button>
                        </div>
                        
                        <div className="p-10 flex flex-col flex-1 overflow-hidden">
                            <div className="flex gap-4 mb-8">
                                <div className="relative flex-1">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                    <input 
                                        type="text" 
                                        placeholder="Search Arduino registry (e.g. Servo, WiFi, DHT)..." 
                                        className="w-full bg-slate-900 border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                        value={libSearchQuery}
                                        onChange={(e) => setLibSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearchLibraries()}
                                    />
                                </div>
                                <button 
                                    onClick={handleSearchLibraries}
                                    disabled={isSearchingLibs}
                                    className="px-8 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-2xl font-bold transition-all shadow-lg shadow-blue-900/20"
                                >
                                    {isSearchingLibs ? <RefreshCw className="w-6 h-6 animate-spin" /> : 'Search'}
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                                {libSearchResults.length > 0 ? (
                                    <div className="space-y-4">
                                        {libSearchResults.map((lib, idx) => {
                                            const isInstalled = libraries.some(l => l.library.name === lib.name);
                                            return (
                                                <div key={idx} className="admin-glass-card p-6 rounded-2xl border border-white/5 flex justify-between items-center group transition-all hover:bg-white/5">
                                                    <div>
                                                        <h4 className="font-bold text-lg text-white">{lib.name}</h4>
                                                        <p className="text-sm text-slate-400 line-clamp-1 max-w-xs">{lib.sentence || 'No description available'}</p>
                                                        <div className="flex items-center gap-3 mt-2">
                                                            <span className="text-[10px] px-2 py-0.5 bg-slate-900 rounded-md border border-white/5 text-slate-500 font-black uppercase tracking-widest">
                                                                v{lib.version}
                                                            </span>
                                                            <span className="text-[10px] text-slate-600 font-bold italic">by {lib.author}</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleInstallLib(lib.name)}
                                                        disabled={isInstalled}
                                                        className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
                                                            isInstalled 
                                                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                                                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20'
                                                        }`}
                                                    >
                                                        {isInstalled ? 'Installed' : 'Install'}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4 opacity-50">
                                        <Library className="w-16 h-16" />
                                        <p className="font-bold tracking-widest uppercase">Search for official libraries</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Transpile Modal */}
            {transpileModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-[#0d1525] border border-white/5 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
                        <div className="p-10 border-b border-white/5 flex justify-between items-center bg-white/5">
                            <div>
                                <h2 className="text-2xl font-black tracking-tight text-white">Transpile Verification</h2>
                                <p className="text-sm text-slate-400 mt-1 uppercase tracking-widest font-bold">{transpileModal.label}</p>
                            </div>
                            <button onClick={() => setTranspileModal(null)} className="p-3 hover:bg-white/5 rounded-full transition-colors text-slate-500">
                                <XCircle className="w-8 h-8" />
                            </button>
                        </div>
                        <div className="p-10 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                            {transpileModal.results.map((r, i) => (
                                <div key={i} className={`p-6 rounded-2xl border transition-all ${r.ok ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="font-mono text-sm font-bold text-slate-200">{r.file}</span>
                                        {r.ok ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
                                    </div>
                                    {!r.ok && <pre className="text-xs text-red-400 bg-black/30 p-4 rounded-xl overflow-x-auto whitespace-pre-wrap border border-red-500/10">{r.error}</pre>}
                                    {r.ok && <div className="text-[10px] text-emerald-500 font-black uppercase tracking-[0.2em]">{r.lines} lines transpiled successfully</div>}
                                </div>
                            ))}
                        </div>
                        <div className="p-10 bg-white/5 flex justify-end">
                            <button 
                                onClick={() => setTranspileModal(null)}
                                className="px-10 py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl font-bold transition-all border border-white/5 text-white shadow-xl"
                            >
                                Close Report
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

