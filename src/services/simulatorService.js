import axios from 'axios';
import { getAdminToken, getToken } from './authService.js';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}` : (import.meta.env.DEV ? 'http://localhost:5001/api' : '/api');
const COMPILER_URL = API_BASE_URL;
const API_ORIGIN = COMPILER_URL.replace(/\/api$/, '');

// ─── Frontend IndexedDB Compile Cache for Uno & Pico ───────────────────────
const DB_NAME = 'OpenHW_Compile_Cache';
const DB_VERSION = 1;
const STORE_NAME = 'compile_results';

function getIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function getLocalCompileCache(hash) {
    try {
        const db = await getIndexedDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(hash);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    } catch {
        return null;
    }
}

async function setLocalCompileCache(hash, data) {
    try {
        const db = await getIndexedDB();
        
        // Save the current item with a timestamp for LRU tracking
        const entry = { ...data, timestamp: Date.now() };
        
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(entry, hash);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });

        // Prune database: keep only the 10 most recently used entries
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        const allKeysRequest = store.getAllKeys();
        allKeysRequest.onsuccess = () => {
            const keys = allKeysRequest.result;
            const allItemsRequest = store.getAll();
            allItemsRequest.onsuccess = () => {
                const items = allItemsRequest.result;
                const entries = keys.map((key, i) => ({ key, timestamp: items[i].timestamp || 0 }));
                
                if (entries.length > 10) {
                    entries.sort((a, b) => a.timestamp - b.timestamp); // oldest first
                    const toDelete = entries.slice(0, entries.length - 10);
                    for (const item of toDelete) {
                        store.delete(item.key);
                    }
                    console.log(`[Compile Cache] 🧹 Pruned ${toDelete.length} oldest entries from client-side IndexedDB.`);
                }
            };
        };
    } catch (err) {
        console.warn('[Compile Cache] IndexedDB error:', err);
    }
}

async function computePayloadHash(payload) {
    const data = {
        code: payload.code || '',
        files: Array.isArray(payload.files)
            ? payload.files.map(f => ({ name: f.name, content: f.content })).sort((a, b) => a.name.localeCompare(b.name))
            : [],
        fqbn: payload.fqbn || 'arduino:avr:uno',
        builder: payload.builder || 'arduino-cli',
        libraries_txt: payload.libraries_txt || ''
    };
    const str = JSON.stringify(data);
    const msgUint8 = new TextEncoder().encode(str);
    const hashBuffer = await window.crypto.subtle.digest('SHA-1', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
// ─────────────────────────────────────────────────────────────────────────────

const getUserAuthConfig = () => {
    const token = getToken();
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

const getAdminAuthConfig = () => {
    const adminToken = getAdminToken();
    const userToken = getToken();
    console.log("[SimulatorService] Auth Tokens - Admin:", !!adminToken, "User:", !!userToken);
    const token = adminToken || userToken;
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

/**
 * Sends Arduino C++ code to the backend compiler.
 */
export async function compileCode(input) {
    const payload = typeof input === 'string' ? { code: input } : (input || {});
    const targetFqbn = String(payload.fqbn || '').trim();
    const isUnoOrPico = targetFqbn.includes('avr') || targetFqbn.includes('rp2040') || payload.target === 'uno' || payload.target === 'pico';

    let hash = '';
    if (isUnoOrPico) {
        try {
            hash = await computePayloadHash(payload);
            const cachedResult = await getLocalCompileCache(hash);
            if (cachedResult) {
                console.log(`[Compile Cache] 🟢 client-side IndexedDB cache hit! Bypassing compile network request.`);
                
                // Touch timestamp in background to keep LRU fresh
                setTimeout(() => setLocalCompileCache(hash, cachedResult), 50);
                
                return cachedResult;
            }
        } catch (e) {
            console.warn('[Compile Cache] Client cache lookup error:', e);
        }
    }

    try {
        const response = await axios.post(`${COMPILER_URL}/compile`, payload, getUserAuthConfig());
        if (response.data && (response.data.hex || response.data.buildId)) {
            if (isUnoOrPico && hash) {
                try {
                    await setLocalCompileCache(hash, response.data);
                    console.log(`[Compile Cache] 💾 Saved compile result to client-side IndexedDB cache.`);
                } catch (e) {
                    console.warn('[Compile Cache] Client cache write error:', e);
                }
            }
            return response.data;
        }
        throw new Error('No hex returned from compiler');
    } catch (error) {
        if (error.response && error.response.data && error.response.data.diagnostics) {
            const diagnostics = error.response.data.diagnostics || {};
            const stage = diagnostics.stage ? ` stage=${diagnostics.stage}` : '';
            const category = diagnostics.category ? ` category=${diagnostics.category}` : '';
            const highlights = Array.isArray(diagnostics.highlights) ? diagnostics.highlights.slice(0, 6).join('\n') : '';
            const hint = diagnostics.hint ? `\nHint: ${diagnostics.hint}` : '';
            const details = (error.response.data.details || '').trim();
            const body = highlights || details || error.response.data.error || 'Unknown compile failure';
            throw new Error(`Compilation Failed:${stage}${category}\n${body}${hint}`);
        }
        throw error;
    }
}

/**
 * Boots the ESP32 emulator using a precompiled base64 binary.
 */
export async function runBinaryCode(firmware_b64) {
    try {
        const response = await axios.post(`${COMPILER_URL}/compile/esp32/run-binary`, { firmware_b64, target: 'esp32' }, getUserAuthConfig());
        if (response.data && response.data.buildId) {
            return response.data;
        }
        throw new Error('No buildId returned from runBinaryCode');
    } catch (error) {
        throw error;
    }
}

export async function stopSession(buildId, target = 'esp32') {
    const config = getUserAuthConfig();
    try {
        const endpoint = target === 'stm32' ? `compile/stm32/stop/${buildId}` : `compile/esp32/stop/${buildId}`;
        const response = await axios.post(`${COMPILER_URL}/${endpoint}`, {}, config);
        return response.data;
    } catch (error) {
        console.error(`[SimulatorService] Failed to stop session ${buildId}:`, error.message);
        throw error;
    }
}

/**
 * Flash firmware to a physical board.
 */
export async function flashFirmware({ port, fqbn, hex, baudRate, resetMethod }) {
    const response = await axios.post(`${COMPILER_URL}/compile/flash`, { port, fqbn, hex, baudRate, resetMethod }, getUserAuthConfig());
    return response.data;
}

export async function listHardwarePorts(showAll = false) {
    const response = await axios.get(`${COMPILER_URL}/compile/ports`, {
        params: { showAll: showAll ? 'true' : 'false' },
        ...(getUserAuthConfig()),
    });
    return response.data?.ports || [];
}

/**
 * Library Management
 */
export async function fetchInstalledLibraries() {
    const response = await axios.get(`${COMPILER_URL}/lib-list`, getUserAuthConfig());
    return response.data.libraries || [];
}

export async function searchLibraries(query) {
    const response = await axios.get(`${COMPILER_URL}/lib-search?q=${encodeURIComponent(query)}`, getUserAuthConfig());
    return response.data.libraries || [];
}

export async function installLibrary(name) {
    const response = await axios.post(`${COMPILER_URL}/lib-install`, { name }, getAdminAuthConfig());
    return response.data;
}

export async function uninstallLibrary(name) {
    const response = await axios.post(`${COMPILER_URL}/lib-uninstall`, { name }, getAdminAuthConfig());
    return response.data;
}

export async function fetchLibrariesInfo(names) {
    const response = await axios.get(`${COMPILER_URL}/lib-info?names=${encodeURIComponent(names.join(','))}`, getUserAuthConfig());
    return response.data.libraries || {};
}

/**
 * Custom Components
 */
export async function approveCustomComponent(payload) {
    const response = await axios.post(`${COMPILER_URL}/admin/components/approve`, payload, getAdminAuthConfig());
    return response.data;
}

export async function rejectCustomComponent(submissionId) {
    const response = await axios.delete(`${COMPILER_URL}/admin/components/reject/${submissionId}`, getAdminAuthConfig());
    return response.data;
}

export async function fetchPendingComponents() {
    const response = await axios.get(`${COMPILER_URL}/admin/components/pending`, getAdminAuthConfig());
    return response.data.components || [];
}

export async function submitCustomComponent(payload) {
    const response = await axios.post(`${COMPILER_URL}/components/submit`, payload, getUserAuthConfig());
    return response.data;
}

export async function getInstalledComponents() {
    const response = await axios.get(`${COMPILER_URL}/admin/components/installed`, getAdminAuthConfig());
    return response.data.components || [];
}

export async function deleteInstalledComponent(id) {
    const response = await axios.delete(`${COMPILER_URL}/admin/components/installed/${id}`, getAdminAuthConfig());
    return response.data;
}

export async function fetchPublicInstalledComponents() {
    const response = await axios.get(`${COMPILER_URL}/components/public-installed`);
    return response.data.components || [];
}

export async function fetchComponentsVersion() {
    try {
        const response = await axios.get(`${COMPILER_URL}/components/version`);
        return response.data?.version ?? null;
    } catch (e) {
        return null;
    }
}

export async function backupInstalledComponents() {
    const response = await axios.get(`${COMPILER_URL}/admin/components/backup`, getAdminAuthConfig());
    return response.data.components || [];
}

export async function fetchInstalledComponentsWithFiles() {
    return backupInstalledComponents();
}

/**
 * Sharing & Live Sessions
 */
export async function createSharedSimulation(payload) {
    const config = getAdminAuthConfig();
    console.log("[SimulatorService] createSharedSimulation auth config:", config);
    const response = await axios.post(`${COMPILER_URL}/simulations/share`, payload, config);
    return response.data;
}

export async function fetchSharedSimulation(shareId) {
    const response = await axios.get(`${COMPILER_URL}/simulations/share/${shareId}`, getAdminAuthConfig());
    return response.data?.project || null;
}

export async function createLiveSimulationSession(payload) {
    const response = await axios.post(`${COMPILER_URL}/live-simulations`, payload, getAdminAuthConfig());
    return response.data?.session || null;
}

export async function fetchLiveSimulationSession(sessionCode) {
    const response = await axios.get(`${COMPILER_URL}/live-simulations/${encodeURIComponent(sessionCode)}`, getAdminAuthConfig());
    return response.data?.session || null;
}

export function buildLiveSimulationWsUrl(sessionCode, role = 'student') {
    const token = getToken();
    const wsOrigin = API_ORIGIN.replace(/^http/i, 'ws');
    const url = new URL('/api/live-simulations/ws', `${wsOrigin}/`);
    url.searchParams.set('sessionCode', sessionCode);
    url.searchParams.set('role', role);
    if (token) {
        url.searchParams.set('token', token);
    }
    return url.toString();
}

/**
 * CI/CD & Infrastructure
 */
export async function fetchPendingDeployments() {
    const response = await axios.get(`${COMPILER_URL}/admin/deployments/pending`, getAdminAuthConfig());
    return response.data.pending || [];
}

export async function approveDeploymentAction(runId, repo, env) {
    const response = await axios.post(`${COMPILER_URL}/admin/deployments/approve`, { run_id: runId, repo, environment: env }, getAdminAuthConfig());
    return response.data;
}

export async function rollbackDeploymentAction(repo, branch = 'develop') {
    const response = await axios.post(`${COMPILER_URL}/admin/deployments/rollback`, { repo, branch }, getAdminAuthConfig());
    return response.data;
}

export async function fetchDeploymentNotifications() {
    const response = await axios.get(`${COMPILER_URL}/admin/deployments/notifications`, getAdminAuthConfig());
    return response.data.notifications || [];
}

export async function triggerDeploymentBuild(repo, notificationId = null) {
    const response = await axios.post(`${COMPILER_URL}/admin/deployments/trigger`, { target_repo: repo, notification_id: notificationId }, getAdminAuthConfig());
    return response.data;
}

export async function fetchInfrastructureStatus() {
    try {
        const response = await axios.get(`${COMPILER_URL}/admin/infrastructure/status`, getAdminAuthConfig());
        return response.data.services || [];
    } catch (e) {
        return [];
    }
}

export async function restartInfrastructureService(name) {
    const response = await axios.post(`${COMPILER_URL}/admin/infrastructure/restart`, { name }, getAdminAuthConfig());
    return response.data;
}

export async function fetchSystemLogs() {
    const response = await axios.get(`${COMPILER_URL}/admin/system-logs`, getAdminAuthConfig());
    return response.data.logs || [];
}

export async function fetchWorkflowLogs(repo, runId) {
    const response = await axios.get(`${COMPILER_URL}/admin/deployments/logs`, {
        params: { repo, run_id: runId },
        ...getAdminAuthConfig()
    });
    return response.data.logs || [];
}

export async function fetchUsageAnalytics() {
    const response = await axios.get(`${COMPILER_URL}/admin/usage-analytics`, getAdminAuthConfig());
    return response.data.stats || null;
}

export async function fetchAuditHistory() {
    const response = await axios.get(`${COMPILER_URL}/admin/audit-history`, getAdminAuthConfig());
    return response.data.logs || [];
}

export async function fetchPublicSystemStatus() {
    const response = await axios.get(`${COMPILER_URL}/public/system-status`);
    return response.data.status || null;
}

export async function fetchMaintenanceStatus() {
    try {
        const response = await axios.get(`${COMPILER_URL}/public/maintenance-status`);
        return response.data.enabled || false;
    } catch (e) {
        // If connection fails (e.g. backend down), consider it maintenance/offline
        return true; 
    }
}

export async function toggleMaintenanceMode(enabled) {
    const response = await axios.post(`${COMPILER_URL}/admin/maintenance/toggle`, { enabled }, getAdminAuthConfig());
    return response.data;
}

export async function fetchResourceStatus() {
    const response = await axios.get(`${COMPILER_URL}/admin/resource-status`, getAdminAuthConfig());
    return response.data;
}

export async function triggerRecalibrate() {
    const response = await axios.post(`${COMPILER_URL}/admin/recalibrate`, {}, getAdminAuthConfig());
    return response.data;
}

