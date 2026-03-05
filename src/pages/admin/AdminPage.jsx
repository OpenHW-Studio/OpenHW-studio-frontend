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
    const [transpileModal, setTranspileModal] = useState(null); // { id, results: [{file, ok, lines, error}] }
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

        // Auto-refresh pending components every 15s so uploads from the simulator
        // appear in the dashboard without a manual page refresh.
        const pollPending = setInterval(async () => {
            try {
                const comps = await fetchPendingComponents();
                setPendingComponents(comps);
            } catch (_) { /* silently skip when backend is unreachable */ }
        }, 15000);

        return () => clearInterval(pollPending); // cleanup on unmount
    }, []);

    // handleUploadZip was moved to SimulatorPage

    // "Test Transpile JSX" — runs Babel on both ui.tsx and logic.ts to check for syntax errors
    // before the admin commits to approving. Shows a detailed modal with line counts and any errors.
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

    // Download a pending component's source files as a ZIP
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

    // Open the pending component in a live simulator tab for functional testing.
    // The component is passed via sessionStorage — the SimulatorPage picks it up
    // on mount and injects it into the local registry (browser memory only, no backend).
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
        // Store the key name so the simulator tab knows which entry to read
        sessionStorage.setItem('pendingPreviewKey', previewKey);
        addLog(`Opening simulator preview for ${comp.id}...`, 'info');
        window.open('/simulator', '_blank');
    };

    const handleRejectBackend = async (comp) => {
        addLog(`Rejecting submission ${comp.submissionId || comp.id}...`);
        try {
            // Pass submissionId so only THIS specific upload is rejected,
            // not every pending entry that shares the same component id.
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
                id: comp.id,
                manifest: comp.manifest,
                ui: comp.uiRaw,
                logic: comp.logicRaw,
                validation: comp.validationRaw,
                index: comp.indexRaw
            };
            await approveCustomComponent(payload);
            addLog(`Successfully merged ${comp.id} into backend openhw-studio-emulator!`, 'success');
            // Optimistic UI: move component from pending → installed list instantly (no refresh)
            setPendingComponents(prev => prev.filter(p => p.id !== comp.id));
            setInstalledComponents(prev => {
                // Avoid duplicate if already in list
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
            loadLibraries();
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
        <div style={{ padding: 40, fontFamily: 'sans-serif', background: '#0f172a', minHeight: '100vh', color: '#f1f5f9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h1 style={{ fontSize: 32, margin: 0 }}>Admin Control Panel</h1>
                <button
                    onClick={handleLogout}
                    style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}>
                    Logout System
                </button>
            </div>
            <p style={{ color: '#94a3b8', marginBottom: 40 }}>Manage C++ libraries and review community component submissions.</p>


            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>

                {/* ── Col 1: Library Manager ──────────────────────────────────── */}
                <section style={{ background: '#1e293b', padding: 24, borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
                    <h2 style={{ fontSize: 18, marginBottom: 16, margin: '0 0 16px' }}>Library Manager</h2>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                        <input placeholder="Search Arduino libraries..." style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: 'none', background: '#334155', color: '#fff', fontSize: 13 }} />
                        <button style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: 13 }}>Search</button>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
                        {libraries.length === 0 && <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: 20 }}>No libraries installed.</div>}
                        {libraries.map(lib => (
                            <div key={lib.library.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '10px 12px', borderRadius: 6 }}>
                                <div>
                                    <div style={{ fontSize: 13 }}>{lib.library.name}</div>
                                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>v{lib.library.version}</div>
                                </div>
                                <button onClick={() => handleUninstallLibrary(lib.library.name)} style={{ padding: '3px 8px', borderRadius: 4, background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11 }}>Uninstall</button>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── Col 2: Pending Approval ─────────────────────────────────── */}
                <section style={{ background: '#1e293b', padding: 24, borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h2 style={{ fontSize: 18, margin: 0 }}>Pending Approval</h2>
                        {pendingComponents.length > 0 && (
                            <span style={{ background: '#f59e0b', color: '#000', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 'bold' }}>
                                {pendingComponents.length}
                            </span>
                        )}
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 480, overflowY: 'auto', paddingRight: 4 }}>
                        {pendingComponents.length === 0 && (
                            <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: 20 }}>No pending submissions.</div>
                        )}
                        {pendingComponents.map(comp => (
                            <div key={comp.submissionId || comp.id} style={{ background: '#0f172a', padding: 14, borderRadius: 8, border: '1px solid #334155' }}>
                                <div style={{ marginBottom: 6 }}>
                                    <span style={{ fontWeight: 'bold', fontSize: 14 }}>{comp.manifest.label}</span>
                                    <span style={{ fontSize: 11, color: '#64748b', marginLeft: 6 }}>({comp.id})</span>
                                </div>
                                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
                                    Group: <strong style={{ color: '#cbd5e1' }}>{comp.manifest.group || '—'}</strong>
                                    &nbsp;·&nbsp; Type: <strong style={{ color: '#cbd5e1' }}>{comp.manifest.type || comp.id}</strong>
                                    {comp.timestamp && <div style={{ marginTop: 3, color: '#64748b' }}>Submitted: {new Date(comp.timestamp).toLocaleString()}</div>}
                                </div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    <button onClick={() => handlePreviewComponent(comp)} title="Check all files transpile without errors" style={{ padding: '4px 9px', borderRadius: 4, background: '#334155', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12 }}>Transpile</button>
                                    <button onClick={() => handleDownloadComponentZip(comp)} title="Download source as ZIP" style={{ padding: '4px 9px', borderRadius: 4, background: '#0ea5e9', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12 }}>ZIP</button>
                                    <button onClick={() => handleTestInSimulator(comp)} title="Open in simulator for live testing" style={{ padding: '4px 9px', borderRadius: 4, background: '#f59e0b', color: '#000', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>Test</button>
                                    <button onClick={() => handleApproveBackend(comp)} style={{ padding: '4px 9px', borderRadius: 4, background: '#10b981', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12 }}>Approve</button>
                                    <button onClick={() => handleRejectBackend(comp)} style={{ padding: '4px 9px', borderRadius: 4, background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12 }}>Reject</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── Col 3: Installed Components ─────────────────────────────── */}
                <section style={{ background: '#1e293b', padding: 24, borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <h2 style={{ fontSize: 18, margin: 0 }}>Installed</h2>
                        {installedComponents.length > 0 && (
                            <span style={{ background: '#10b981', color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 'bold' }}>
                                {installedComponents.length}
                            </span>
                        )}
                    </div>
                    {/* Import / Backup actions — live above the installed list */}
                    <input
                        type="file"
                        accept=".zip"
                        ref={restoreInputRef}
                        style={{ display: 'none' }}
                        onChange={handleRestoreFileChange}
                    />
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                        <button onClick={() => restoreInputRef.current?.click()} style={{ flex: 1, padding: '6px 10px', borderRadius: 6, background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12 }}>Restore / Import ZIP</button>
                        <button onClick={handleBackupComponents} style={{ flex: 1, padding: '6px 10px', borderRadius: 6, background: '#8b5cf6', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12 }}>Backup All Installed</button>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
                        {installedComponents.length === 0 && (
                            <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: 20 }}>No installed custom components.</div>
                        )}
                        {installedComponents.map(comp => (
                            <div key={comp.id} style={{ background: '#0f172a', padding: '12px 14px', borderRadius: 8, border: '1px solid #1e3a5f', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 'bold', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{comp.manifest.label}</div>
                                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                        {comp.id} · v{comp.manifest.version || '1.0.0'}
                                    </div>
                                </div>
                                <button onClick={() => handleDeleteInstalled(comp.id)} style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 4, background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12 }}>Delete</button>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── Admin Logs (full width) ──────────────────────────────────── */}
                <section style={{ gridColumn: '1 / -1', background: '#0f172a', border: '1px solid #1e293b', padding: 16, borderRadius: 8, fontFamily: 'monospace', height: 200, overflowY: 'auto' }}>
                    <div style={{ color: '#64748b', marginBottom: 10 }}>-- System Event Logs --</div>
                    {logs.map((L, i) => (
                        <div key={i} style={{ color: L.type === 'error' ? '#ef4444' : L.type === 'success' ? '#10b981' : '#cbd5e1', marginBottom: 4, fontSize: 13 }}>
                            <span style={{ color: '#64748b' }}>[{L.time}]</span> {L.msg}
                        </div>
                    ))}
                </section>

            </div>


            {/* ── Transpile Result Modal ─────────────────────────────────────────── */}
            {
                transpileModal && (
                    <div
                        onClick={() => setTranspileModal(null)}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
                    >
                        <div
                            onClick={e => e.stopPropagation()}
                            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 32, minWidth: 480, maxWidth: 640 }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <h2 style={{ margin: 0, fontSize: 18 }}>Transpile Check: <span style={{ color: '#94a3b8', fontWeight: 'normal' }}>{transpileModal.label}</span></h2>
                                <button onClick={() => setTranspileModal(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 20, cursor: 'pointer' }}>x</button>
                            </div>
                            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
                                Each source file is passed through Babel (TypeScript + React presets) to detect syntax errors before approval.
                                If all files pass, the component is safe to inject into the simulator.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {transpileModal.results.map(r => (
                                    <div
                                        key={r.file}
                                        style={{ background: '#0f172a', padding: '12px 16px', borderRadius: 8, border: `1px solid ${r.ok ? '#10b981' : '#ef4444'}` }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontFamily: 'monospace', fontSize: 14, color: '#e2e8f0' }}>{r.file}</span>
                                            <span style={{ fontWeight: 'bold', color: r.ok ? '#10b981' : '#ef4444', fontSize: 14 }}>
                                                {r.ok ? `OK  (${r.lines} lines output)` : 'ERROR'}
                                            </span>
                                        </div>
                                        {!r.ok && <pre style={{ margin: '8px 0 0', fontSize: 11, color: '#fca5a5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{r.error}</pre>}
                                    </div>
                                ))}
                            </div>
                            <div style={{ marginTop: 20, textAlign: 'right' }}>
                                <button onClick={() => setTranspileModal(null)} style={{ padding: '8px 20px', background: '#334155', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Close</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}
