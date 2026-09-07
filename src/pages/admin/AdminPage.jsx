import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import * as Babel from '@babel/standalone';
import './admin.css';

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
    rollbackDeploymentAction,
    fetchInfrastructureStatus,
    restartInfrastructureService,
    fetchUsageAnalytics,
    fetchAuditHistory,
    fetchMaintenanceStatus,
    toggleMaintenanceMode,
    fetchDeploymentNotifications,
    triggerDeploymentBuild,
    dismissDeploymentNotification,
    rejectDeploymentAction,
    fetchLibraryConfig,
    uploadLibraryConfig,
    fetchLibraryCache,
    clearLibraryCache
} from '../../services/simulatorService.js';
import { useAuth } from '../../context/AuthContext';
import OverviewTab from './components/OverviewTab';
import HistoryTab from './components/HistoryTab';
import { Bell, CheckCircle, AlertCircle, X } from 'lucide-react';

// Components
import Sidebar from './components/Sidebar';
import AdminHeader from './components/AdminHeader';
import LibrariesTab from './components/LibrariesTab';
import ApprovalsTab from './components/ApprovalsTab';
import ComponentsTab from './components/ComponentsTab';
import DeploymentsTab from './components/DeploymentsTab';
import DockerTab from './components/DockerTab';
import LogsTab from './components/LogsTab';
import UserMapTab from './components/UserMapTab';
import AnalyticsTab from './components/AnalyticsTab';
import ResourcesTab from './components/ResourcesTab';
import AdminAdventureContentTab from './components/AdminAdventureContentTab';
import UserManagerTab from './components/UserManagerTab';
import { LibrarySearchModal, TranspileModal } from './components/Modals';

export default function AdminPage() {
    const navigate = useNavigate();
    const { adminLogout } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [libraries, setLibraries] = useState([]);
    const [libraryConfig, setLibraryConfig] = useState([]);
    const [libraryCache, setLibraryCache] = useState([]);
    const [pendingComponents, setPendingComponents] = useState([]);
    const [installedComponents, setInstalledComponents] = useState([]);
    const [deployments, setDeployments] = useState([]);
    const [infraStatus, setInfraStatus] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [auditLogs, setAuditLogs] = useState([]);
    const [maintenanceMode, setMaintenanceMode] = useState(localStorage.getItem('admin_maintenance_mode') === 'true');
    const [notifications, setNotifications] = useState([]);
    const [toasts, setToasts] = useState([]);
    const [logs, setLogs] = useState([]);
    const [transpileModal, setTranspileModal] = useState(null);
    const [libraryModal, setLibraryModal] = useState(false);
    const [libSearchQuery, setLibSearchQuery] = useState('');
    const [libSearchResults, setLibSearchResults] = useState([]);
    const [isSearchingLibs, setIsSearchingLibs] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [theme, setTheme] = useState(() => localStorage.getItem('admin_theme') || 'dark');
    const restoreInputRef = useRef(null);

    const handleToggleTheme = (newTheme) => {
        setTheme(newTheme);
        localStorage.setItem('admin_theme', newTheme);
    };

    const lastToggleTime = useRef(0);
    const loadData = async () => {
        const wrap = async (fn, fallback = []) => {
            try { return await fn(); } catch (e) { console.error(e); return fallback; }
        };

        const [libs, libConf, libCache, pending, installed, deps, infra, stats, history, maint, notes] = await Promise.all([
            wrap(fetchInstalledLibraries),
            wrap(fetchLibraryConfig),
            wrap(fetchLibraryCache),
            wrap(fetchPendingComponents),
            wrap(getInstalledComponents),
            wrap(fetchPendingDeployments),
            wrap(fetchInfrastructureStatus),
            wrap(fetchUsageAnalytics, null),
            wrap(fetchAuditHistory),
            wrap(fetchMaintenanceStatus, false),
            wrap(fetchDeploymentNotifications)
        ]);
        
        setLibraries(libs);
        setLibraryConfig(libConf);
        setLibraryCache(libCache);
        setPendingComponents(pending);
        setInstalledComponents(installed);
        setDeployments(deps);
        setInfraStatus(infra);
        setAnalytics(stats);
        setAuditLogs(history);
        if (Date.now() - lastToggleTime.current > 5000) {
            setMaintenanceMode(maint);
            localStorage.setItem('admin_maintenance_mode', maint);
        }
        setNotifications(notes);
    };

    useEffect(() => {
        loadData();
        const poll = setInterval(async () => {
            const wrap = async (fn, fallback = []) => {
                try { return await fn(); } catch (e) { return fallback; }
            };
            const [comps, deps, infra, maint, notes] = await Promise.all([
                wrap(fetchPendingComponents),
                wrap(fetchPendingDeployments),
                wrap(fetchInfrastructureStatus),
                wrap(fetchMaintenanceStatus, false),
                wrap(fetchDeploymentNotifications)
            ]);
            setPendingComponents(comps);
            setDeployments(deps);
            setInfraStatus(infra);
            if (Date.now() - lastToggleTime.current > 5000) {
                setMaintenanceMode(maint);
                localStorage.setItem('admin_maintenance_mode', maint);
            }
            setNotifications(notes);
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

    const handleDismissNotification = async (id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        try {
            await dismissDeploymentNotification(id);
        } catch (e) {
            console.error('Failed to dismiss notification:', e);
        }
    };

    // Debounced Library Search
    useEffect(() => {
        if (!libSearchQuery || libSearchQuery.length < 2) {
            setLibSearchResults([]);
            return;
        }

        const timer = setTimeout(() => {
            handleSearchLibraries();
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [libSearchQuery]);

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

    const handleApproveDeployment = async (dep) => {
        // Optimistic UI Update
        setDeployments(prev => prev.filter(d => d.id !== dep.id));
        try {
            await approveDeploymentAction(dep.id, dep.repo, 'production');
            addLog(`Approved deployment for ${dep.repo}`, 'info');
            loadData();
        } catch (e) {
            addLog(`Failed to approve deployment: ${e.message}`, 'error');
            loadData(); // Revert on failure
        }
    };

    const handleRejectDeployment = async (dep) => {
        // Optimistic UI Update
        setDeployments(prev => prev.filter(d => d.id !== dep.id));
        try {
            await rejectDeploymentAction(dep.id, dep.repo, 'production');
            addLog(`Rejected deployment for ${dep.repo}`, 'info');
            loadData();
        } catch (e) {
            addLog(`Failed to reject deployment: ${e.message}`, 'error');
            loadData(); // Revert on failure
        }
    };

    const showToast = useCallback((message, type = 'success') => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    }, []);

    const handleRestartService = async (serviceName) => {
        addLog(`Restarting ${serviceName}...`, 'info');
        showToast(`Initiating restart for ${serviceName}...`, 'info');
        try {
            await restartInfrastructureService(serviceName);
            addLog(`${serviceName} restarted successfully.`, 'success');
            showToast(`${serviceName} restarted successfully!`);
            loadData();
        } catch (e) {
            addLog(`Failed to restart ${serviceName}: ${e.message}`, 'error');
            showToast(`Restart failed: ${e.message}`, 'error');
        }
    };

    const handleRollback = async (repo) => {
        addLog(`Triggering rollback for ${repo}...`);
        try {
            await rollbackDeploymentAction(repo);
            addLog(`Successfully triggered rollback for ${repo}`, 'success');
            loadData();
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
        addLog(allOk ? `${comp.id}: Transpile successful` : `${comp.id}: Transpile errors`, allOk ? 'success' : 'error');
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
        // SECURITY: Mark this data as untrusted so the simulator can sandbox it
        sessionStorage.setItem(previewKey, JSON.stringify({ 
            ...comp, 
            isUntrusted: true,
            previewMode: 'admin_audit' 
        }));
        sessionStorage.setItem('pendingPreviewKey', previewKey);
        window.open('/simulator', '_blank');
        addLog(`Opened SECURE simulator preview for ${comp.id}. Administrative APIs disabled for this session.`, 'warning');
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
            showToast(`Deletion failed: ${e.message}`, 'error');
        }
    };

    const handleToggleMaintenance = async (enabled) => {
        addLog(`${enabled ? 'Enabling' : 'Disabling'} Maintenance Mode...`, 'warning');
        lastToggleTime.current = Date.now();
        setMaintenanceMode(enabled);
        localStorage.setItem('admin_maintenance_mode', enabled);
        
        try {
            await toggleMaintenanceMode(enabled);
            showToast(`System is now in ${enabled ? 'Maintenance' : 'Live'} mode`);
        } catch (e) {
            addLog(`Failed to toggle maintenance: ${e.message}`, 'error');
            showToast(`Action failed: ${e.message}`, 'error');
            // Revert on failure
            setMaintenanceMode(!enabled);
            localStorage.setItem('admin_maintenance_mode', !enabled);
        }
    };

    const handleTriggerBuild = async (repo, noteId = null) => {
        addLog(`Triggering build for ${repo}...`, 'info');
        try {
            await triggerDeploymentBuild(repo, noteId);
            addLog(`Build for ${repo} triggered successfully.`, 'success');
            showToast(`Build for ${repo} has been queued!`);
            loadData();
        } catch (e) {
            addLog(`Failed to trigger build: ${e.message}`, 'error');
        }
    };

    const handleRestoreFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        addLog(`Restoring components from ${file.name}...`);
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

    const handleClearLibraryCache = async (name = null) => {
        try {
            await clearLibraryCache(name);
            showToast(name ? `Cleared cache for ${name}` : 'Cleared all library cache');
            loadData();
        } catch (e) {
            showToast('Failed to clear library cache', 'error');
        }
    };

    const handleUploadLibraryConfig = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = JSON.parse(event.target.result);
                if (!json.permanent) throw new Error('Invalid format: missing "permanent" array');
                await uploadLibraryConfig(json.permanent);
                showToast('Library configuration uploaded and sync started.');
                loadData();
            } catch (err) {
                showToast(`Failed to upload config: ${err.message}`, 'error');
            }
            e.target.value = null; // reset
        };
        reader.readAsText(file);
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return <OverviewTab stats={analytics} />;
            case 'map':
                return <UserMapTab stats={analytics} />;
            case 'analytics':
                return <AnalyticsTab stats={analytics} />;
            case 'libraries':
                return <LibrariesTab 
                    libraries={libraries}
                    libraryConfig={libraryConfig}
                    libraryCache={libraryCache}
                    searchQuery={libSearchQuery}
                    setSearchQuery={setLibSearchQuery}
                    onAddLibrary={() => setLibraryModal(true)}
                    onUninstall={async (name) => {
                        try {
                            await uninstallLibrary(name);
                            showToast(`Successfully uninstalled ${name}`);
                        } catch (e) {
                            showToast(`Failed to uninstall: ${e.message}`, 'error');
                        }
                        loadData();
                    }}
                    onClearCache={handleClearLibraryCache}
                    onUploadConfig={handleUploadLibraryConfig}
                    onMakePermanent={async (name) => {
                        try {
                            await installLibrary(name);
                            showToast(`Successfully moved ${name} to permanent`);
                            loadData();
                        } catch (e) {
                            showToast(`Failed to make ${name} permanent: ${e.message}`, 'error');
                        }
                    }}
                    onRefresh={loadData} 
                    addLog={addLog}
                />;
            case 'adventure-content':
                return <AdminAdventureContentTab />;
            case 'users':
                return <UserManagerTab showToast={showToast} />;
            case 'approval':
                return <ApprovalsTab 
                    pendingComponents={pendingComponents} 
                    onRefresh={loadData}
                    onPreview={handlePreviewComponent}
                    onDownload={handleDownloadZIP}
                    onTest={handleTestInSimulator}
                    onApprove={handleApproveComponent}
                    onReject={handleRejectComponent}
                />;
            case 'components':
            case 'installed':
                return <ComponentsTab 
                    installedComponents={installedComponents} 
                    onRefresh={loadData}
                    onDelete={handleDeleteInstalled}
                    onImport={() => restoreInputRef.current.click()}
                    onBackup={backupInstalledComponents}
                />;
            case 'deployments':
                return <DeploymentsTab 
                    deployments={deployments} 
                    notifications={notifications}
                    onApprove={handleApproveDeployment}
                    onReject={handleRejectDeployment}
                    onRollback={handleRollback}
                    onTriggerBuild={handleTriggerBuild}
                    onDismissNotification={handleDismissNotification}
                />;
            case 'docker':
                return <DockerTab 
                    infraStatus={infraStatus}
                    onRestart={handleRestartService}
                />;
            case 'resources':
                return <ResourcesTab />;
            case 'history':
                return <HistoryTab logs={auditLogs} />;
            case 'logs':
                return <LogsTab 
                    logs={logs} 
                    onClear={() => setLogs([])} 
                />;
            default:
                return null;
        }
    };

    return (
        <div className="ad-root" data-admin-theme={theme}>
            {/* Sidebar */}
            <Sidebar 
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                activeTab={activeTab} 
                setActiveTab={(tab) => {
                    setActiveTab(tab);
                    setIsSidebarOpen(false);
                }} 
                onLogout={handleLogout} 
                maintenanceMode={maintenanceMode}
                onToggleMaintenance={handleToggleMaintenance}
                pendingCount={pendingComponents?.length || 0}
            />

            {/* Mobile Overlay */}
            <div 
                className={`ad-overlay ${isSidebarOpen ? 'visible' : ''}`}
                onClick={() => setIsSidebarOpen(false)}
            />

            {/* Main Content */}
            <main className="ad-main">
                <AdminHeader 
                    activeTab={activeTab} 
                    onRefresh={loadData} 
                    onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                    theme={theme}
                    onToggleTheme={handleToggleTheme}
                />

                <div className="ad-content ad-fade-in">
                    {renderTabContent()}
                </div>

                {/* Hidden input for restore */}
                <input type="file" ref={restoreInputRef} onChange={handleRestoreFile} className="hidden" />
            </main>

            <LibrarySearchModal 
                isOpen={libraryModal} 
                onClose={() => { setLibraryModal(false); setLibSearchResults([]); }}
                libSearchQuery={libSearchQuery}
                setLibSearchQuery={setLibSearchQuery}
                isSearchingLibs={isSearchingLibs}
                onSearch={handleSearchLibraries}
                libSearchResults={libSearchResults}
                installedLibraries={libraries}
                onInstall={handleInstallLib}
            />

            <TranspileModal 
                data={transpileModal} 
                onClose={() => setTranspileModal(null)} 
            />
        </div>
    );
}
