import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import * as Babel from '@babel/standalone';
import {
    fetchInstalledLibraries,
    uninstallLibrary,
    approveCustomComponent,
    fetchPendingComponents,
    rejectCustomComponent,
    getInstalledComponents,
    deleteInstalledComponent,
    backupInstalledComponents,
    submitCustomComponent
} from '../../services/simulatorService.js';
import { useAuth } from '../../context/AuthContext';

export default function AdminPage() {
    const navigate = useNavigate();
    const { adminLogout } = useAuth();
    const [libraries, setLibraries] = useState([]);
    const [pendingComponents, setPendingComponents] = useState([]);
    const [installedComponents, setInstalledComponents] = useState([]);
    const [logs, setLogs] = useState([]);
    const [transpileModal, setTranspileModal] = useState(null);
    const fileInputRef = useRef();
    const restoreInputRef = useRef(null);

    const loadLibrariesAndComponents = async () => {
        try {
            const libs = await fetchInstalledLibraries();
            setLibraries(libs);
            const comps = await fetchPendingComponents();
            setPendingComponents(comps);
            const instComps = await getInstalledComponents();
            setInstalledComponents(instComps);
        } catch (e) {
            addLog(`Error loading data: ${e.message}`, 'error');
        }
    };

    useEffect(() => {
        loadLibrariesAndComponents();

        const pollPending = setInterval(async () => {
            try {
                const comps = await fetchPendingComponents();
                setPendingComponents(comps);
            } catch (_) { }
        }, 15000);

        return () => clearInterval(pollPending);
    }, []);

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
        addLog(
            allOk
                ? `✅ ${comp.id}: All files transpile successfully.`
                : `❌ ${comp.id}: Transpile errors detected — see modal.`,
            allOk ? 'success' : 'error'
        );
        setTranspileModal({ id: comp.id, label: comp.manifest.label, results });
    };

    const handleDownloadComponentZip = async (comp) => {
        addLog(`Packaging ${comp.id} as ZIP...`);
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
        const payload = JSON.stringify({
            id: comp.id,
            manifest: comp.manifest,
            uiRaw: comp.uiRaw,
            logicRaw: comp.logicRaw,
            validationRaw: comp.validationRaw,
            indexRaw: comp.indexRaw,
        });
        sessionStorage.setItem(previewKey, payload);
        sessionStorage.setItem('pendingPreviewKey', previewKey);
        addLog(`Opening simulator preview for ${comp.id}...`, 'info');
        window.open('/simulator', '_blank');
    };

    const handleRejectBackend = async (comp) => {
        addLog(`Rejecting submission ${comp.submissionId || comp.id}...`);
        try {
            await rejectCustomComponent(comp.submissionId || comp.id);
            addLog(`Rejected submission of ${comp.id}`, 'success');
            setPendingComponents(prev => prev.filter(p => p.submissionId !== comp.submissionId));
        } catch (e) {
            addLog(`Rejection failed: ${e.message}`, 'error');
        }
    };

    const handleApproveBackend = async (comp) => {
        addLog(`Sending ${comp.id} to backend for permanent integration...`);
        try {
            const payload = {
                submissionId: comp.submissionId,
                id: comp.id,
                manifest: comp.manifest,
                ui: comp.uiRaw,
                logic: comp.logicRaw,
                validation: comp.validationRaw,
                index: comp.indexRaw
            };
            await approveCustomComponent(payload);
            addLog(`Successfully merged ${comp.id} into backend openhw-studio-emulator!`, 'success');
            setPendingComponents(prev => prev.filter(p => p.submissionId !== comp.submissionId));
            setInstalledComponents(prev => {
                if (prev.some(c => c.id === comp.id)) return prev;
                return [...prev, { id: comp.id, manifest: comp.manifest }];
            });
        } catch (e) {
            addLog(`Approval failed: ${e.message}`, 'error');
        }
    };

    const handleUninstallLibrary = async (libName) => {
        addLog(`Uninstalling library ${libName}...`);
        try {
            await uninstallLibrary(libName);
            addLog(`Uninstalled ${libName}`, 'success');
            loadLibrariesAndComponents();
        } catch (e) {
            addLog(`Failed to uninstall ${libName}: ${e.message}`, 'error');
        }
    };

    const handleDeleteInstalled = async (id) => {
        addLog(`Deleting installed component ${id}...`);
        try {
            await deleteInstalledComponent(id);
            addLog(`Deleted ${id}`, 'success');
            setInstalledComponents(prev => prev.filter(c => c.id !== id));
        } catch (e) {
            addLog(`Deletion failed: ${e.message}`, 'error');
        }
    };

    const handleBackupComponents = async () => {
        addLog(`Initiating backup of all installed components...`);
        try {
            const backupData = await backupInstalledComponents();
            if (backupData.length === 0) {
                addLog('No components to backup', 'info');
                return;
            }

            const zip = new JSZip();
            for (const comp of backupData) {
                const compFolder = zip.folder(comp.id);
                if (comp.files) {
                    for (const [filename, content] of Object.entries(comp.files)) {
                        compFolder.file(filename, content);
                    }
                }
            }

            const content = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'openhw-components-backup.zip';
            a.click();
            URL.revokeObjectURL(url);
            addLog('Backup saved successfully!', 'success');
        } catch (e) {
            addLog(`Backup failed: ${e.message}`, 'error');
        }
    };

    const handleRestoreFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        addLog(`Analyzing ${file.name} for components...`);
        try {
            const zip = new JSZip();
            const loadedZip = await zip.loadAsync(file);

            const manifestPaths = [];
            loadedZip.forEach((relativePath, zipEntry) => {
                if (!zipEntry.dir && relativePath.endsWith('manifest.json')) {
                    manifestPaths.push(relativePath);
                }
            });

            if (manifestPaths.length === 0) {
                addLog('No manifest.json found in the zip. Invalid component format.', 'error');
                return;
            }

            let importCount = 0;
            for (const manifestPath of manifestPaths) {
                const dirPath = manifestPath.substring(0, manifestPath.lastIndexOf('manifest.json'));

                try {
                    const manifestStr = await loadedZip.file(manifestPath).async('string');
                    const manifest = JSON.parse(manifestStr);

                    const uiFile = loadedZip.file(dirPath + 'ui.tsx');
                    const logicFile = loadedZip.file(dirPath + 'logic.ts');
                    const indexFile = loadedZip.file(dirPath + 'index.ts');

                    if (!uiFile || !logicFile || !indexFile) {
                        addLog(`Skipping ${manifest.id || 'unknown'}: Missing required tsx/ts files.`, 'error');
                        continue;
                    }

                    const uiStr = await uiFile.async('string');
                    const logicStr = await logicFile.async('string');
                    const indexStr = await indexFile.async('string');

                    const validationFile = loadedZip.file(dirPath + 'validation.ts');
                    const validationStr = validationFile ? await validationFile.async('string') : null;

                    const componentId = manifest.type || manifest.id || (manifestPath.includes('/') ? manifestPath.split('/')[0] : `comp-${Date.now()}`);

                    const payload = {
                        id: componentId,
                        manifest,
                        ui: uiStr,
                        logic: logicStr,
                        validation: validationStr,
                        index: indexStr
                    };

                    await submitCustomComponent(payload);
                    importCount++;
                    addLog(`Imported ${componentId} into Pending queue.`, 'success');
                } catch (err) {
                    addLog(`Error parsing component at ${manifestPath}: ${err.message}`, 'error');
                }
            }

            if (importCount > 0) {
                addLog(`Successfully restored ${importCount} components to the pending queue!`, 'success');
                const comps = await fetchPendingComponents();
                setPendingComponents(comps);
            }
        } catch (error) {
            addLog(`Failed to read ZIP file: ${error.message}`, 'error');
        } finally {
            if (e.target) e.target.value = null;
        }
    };

    const addLog = (msg, type = 'info') => {
        setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg, type }]);
    };

    const handleLogout = () => {
        adminLogout();
        navigate('/admin');
    };

    return (
        <div className="p-10 font-sans bg-slate-900 min-h-screen text-slate-100">
            <div className="flex justify-between items-center mb-2">
                <h1 className="text-3xl m-0">Admin Control Panel</h1>
                <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-red-500 text-white border-none rounded-md cursor-pointer font-bold hover:bg-red-600 transition-colors">
                    Logout System
                </button>
            </div>
            <p className="text-slate-400 mb-10">Manage C++ libraries and review community component submissions.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* ── Col 1: Library Manager ──────────────────────────────────── */}
                <section className="bg-slate-800 p-6 rounded-xl flex flex-col">
                    <h2 className="text-lg mb-4 mt-0">Library Manager</h2>
                    <div className="flex gap-2 mb-4">
                        <input placeholder="Search Arduino libraries..." className="flex-1 px-3 py-2 rounded-md border-none bg-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <button className="px-3.5 py-2 rounded-md border-none bg-blue-500 text-white cursor-pointer text-sm hover:bg-blue-600 transition-colors">Search</button>
                    </div>
                    <div className="panel-scroll flex-1 flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
                        {libraries.length === 0 && <div className="text-slate-500 text-sm text-center p-5">No libraries installed.</div>}
                        {libraries.map(lib => (
                            <div key={lib.library.name} className="flex justify-between items-center bg-slate-900 px-3 py-2.5 rounded-md">
                                <div>
                                    <div className="text-sm">{lib.library.name}</div>
                                    <div className="text-xs text-slate-500 mt-0.5">v{lib.library.version}</div>
                                </div>
                                <button onClick={() => handleUninstallLibrary(lib.library.name)} className="px-2 py-1 rounded bg-red-500 text-white border-none cursor-pointer text-xs hover:bg-red-600 transition-colors">Uninstall</button>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── Col 2: Pending Approval ─────────────────────────────────── */}
                <section className="bg-slate-800 p-6 rounded-xl flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg m-0">Pending Approval</h2>
                        {pendingComponents.length > 0 && (
                            <span className="bg-amber-500 text-black rounded-full px-2.5 py-0.5 text-xs font-bold">
                                {pendingComponents.length}
                            </span>
                        )}
                    </div>
                    <div className="panel-scroll flex-1 flex flex-col gap-2.5 max-h-[480px] overflow-y-auto pr-1">
                        {pendingComponents.length === 0 && (
                            <div className="text-slate-500 text-sm text-center p-5">No pending submissions.</div>
                        )}
                        {pendingComponents.map(comp => (
                            <div key={comp.submissionId || comp.id} className="bg-slate-900 p-3.5 rounded-lg border border-slate-700">
                                <div className="mb-1.5">
                                    <span className="font-bold text-sm">{comp.manifest.label}</span>
                                    <span className="text-xs text-slate-500 ml-1.5">({comp.id})</span>
                                </div>
                                <div className="text-xs text-slate-400 mb-2.5">
                                    Group: <strong className="text-slate-300">{comp.manifest.group || '—'}</strong>
                                    &nbsp;·&nbsp; Type: <strong className="text-slate-300">{comp.manifest.type || comp.id}</strong>
                                    {comp.timestamp && <div className="mt-1 text-slate-500">Submitted: {new Date(comp.timestamp).toLocaleString()}</div>}
                                </div>
                                <div className="flex gap-1.5 flex-wrap">
                                    <button onClick={() => handlePreviewComponent(comp)} title="Check all files transpile without errors" className="px-2.5 py-1 rounded bg-slate-700 text-white border-none cursor-pointer text-xs hover:bg-slate-600 transition-colors">Transpile</button>
                                    <button onClick={() => handleDownloadComponentZip(comp)} title="Download source as ZIP" className="px-2.5 py-1 rounded bg-sky-500 text-white border-none cursor-pointer text-xs hover:bg-sky-600 transition-colors">ZIP</button>
                                    <button onClick={() => handleTestInSimulator(comp)} title="Open in simulator for live testing" className="px-2.5 py-1 rounded bg-amber-500 text-black border-none cursor-pointer text-xs font-bold hover:bg-amber-600 transition-colors">Test</button>
                                    <button onClick={() => handleApproveBackend(comp)} className="px-2.5 py-1 rounded bg-emerald-500 text-white border-none cursor-pointer text-xs hover:bg-emerald-600 transition-colors">Approve</button>
                                    <button onClick={() => handleRejectBackend(comp)} className="px-2.5 py-1 rounded bg-red-500 text-white border-none cursor-pointer text-xs hover:bg-red-600 transition-colors">Reject</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── Col 3: Installed Components ─────────────────────────────── */}
                <section className="bg-slate-800 p-6 rounded-xl flex flex-col">
                    <div className="flex justify-between items-center mb-2.5">
                        <h2 className="text-lg m-0">Installed</h2>
                        {installedComponents.length > 0 && (
                            <span className="bg-emerald-500 text-white rounded-full px-2.5 py-0.5 text-xs font-bold">
                                {installedComponents.length}
                            </span>
                        )}
                    </div>
                    {/* Import / Backup actions — live above the installed list */}
                    <input
                        type="file"
                        accept=".zip"
                        ref={restoreInputRef}
                        className="hidden"
                        onChange={handleRestoreFileChange}
                    />
                    <div className="flex gap-2 mb-3.5">
                        <button onClick={() => restoreInputRef.current?.click()} className="flex-1 px-2.5 py-1.5 rounded-md bg-blue-500 text-white border-none cursor-pointer text-xs hover:bg-blue-600 transition-colors">Restore / Import ZIP</button>
                        <button onClick={handleBackupComponents} className="flex-1 px-2.5 py-1.5 rounded-md bg-violet-500 text-white border-none cursor-pointer text-xs hover:bg-violet-600 transition-colors">Backup All Installed</button>
                    </div>

                    <div className="panel-scroll flex-1 flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
                        {installedComponents.length === 0 && (
                            <div className="text-slate-500 text-sm text-center p-5">No installed custom components.</div>
                        )}
                        {installedComponents.map(comp => (
                            <div key={comp.id} className="bg-slate-900 px-3.5 py-3 rounded-lg border border-slate-700 flex justify-between items-center gap-2">
                                <div className="min-w-0 flex-1">
                                    <div className="font-bold text-sm whitespace-nowrap overflow-hidden text-ellipsis">{comp.manifest.label}</div>
                                    <div className="text-xs text-slate-500 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                                        {comp.id} · v{comp.manifest.version || '1.0.0'}
                                    </div>
                                </div>
                                <button onClick={() => handleDeleteInstalled(comp.id)} className="flex-shrink-0 px-2.5 py-1 rounded bg-red-500 text-white border-none cursor-pointer text-xs hover:bg-red-600 transition-colors">Delete</button>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── Admin Logs (full width) ──────────────────────────────────── */}
                <section className="panel-scroll col-span-1 md:col-span-3 bg-slate-900 border border-slate-800 p-4 rounded-lg font-mono h-[200px] overflow-y-auto">
                    <div className="text-slate-500 mb-2.5">-- System Event Logs --</div>
                    {logs.map((L, i) => (
                        <div key={i} className={`mb-1 text-sm ${L.type === 'error' ? 'text-red-500' : L.type === 'success' ? 'text-emerald-500' : 'text-slate-300'}`}>
                            <span className="text-slate-500">[{L.time}]</span> {L.msg}
                        </div>
                    ))}
                </section>

            </div>

            {/* ── Transpile Result Modal ─────────────────────────────────────────── */}
            {
                transpileModal && (
                    <div
                        onClick={() => setTranspileModal(null)}
                        className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] p-4"
                    >
                        <div
                            onClick={e => e.stopPropagation()}
                            className="bg-slate-800 border border-slate-700 rounded-xl p-8 min-w-[300px] sm:min-w-[480px] max-w-[640px] w-full"
                        >
                            <div className="flex justify-between items-center mb-5">
                                <h2 className="m-0 text-lg">Transpile Check: <span className="text-slate-400 font-normal">{transpileModal.label}</span></h2>
                                <button onClick={() => setTranspileModal(null)} className="bg-transparent border-none text-slate-400 text-xl cursor-pointer hover:text-white transition-colors">x</button>
                            </div>
                            <p className="text-sm text-slate-500 mb-4">
                                Each source file is passed through Babel (TypeScript + React presets) to detect syntax errors before approval.
                                If all files pass, the component is safe to inject into the simulator.
                            </p>
                            <div className="flex flex-col gap-2.5">
                                {transpileModal.results.map(r => (
                                    <div
                                        key={r.file}
                                        className={`bg-slate-900 px-4 py-3 rounded-lg border ${r.ok ? 'border-emerald-500' : 'border-red-500'}`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="font-mono text-sm text-slate-200">{r.file}</span>
                                            <span className={`font-bold text-sm ${r.ok ? 'text-emerald-500' : 'text-red-500'}`}>
                                                {r.ok ? `OK  (${r.lines} lines output)` : 'ERROR'}
                                            </span>
                                        </div>
                                        {!r.ok && <pre className="m-0 mt-2 text-xs text-red-300 whitespace-pre-wrap break-words">{r.error}</pre>}
                                    </div>
                                ))}
                            </div>
                            <div className="mt-5 text-right">
                                <button onClick={() => setTranspileModal(null)} className="px-5 py-2 bg-slate-700 text-white border-none rounded-md cursor-pointer hover:bg-slate-600 transition-colors">Close</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}
