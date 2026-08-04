/**
 * projectStore.js
 *
 * Two-tier project persistence for OpenHW Studio:
 *   1. IndexedDB (local) — works offline, for all users
 *   2. Backend / MongoDB (cloud) — for authenticated users via API
 *   3. Multi-Tab Broadcast Sync — real-time synchronization across browser tabs
 *
 * Every project is associated with an owner string:
 *   - Authenticated users  → owner = user.email
 *   - Guest / anonymous     → owner = 'guest'
 */

import {
  saveProjectToCloud,
  listProjectsFromCloud,
  getProjectFromCloud,
  deleteProjectFromCloud,
  renameProjectOnCloud,
} from './projectService.js';

const DB_NAME = 'openhw-projects';
const DB_VERSION = 3;                        // bumped: adds pendingDeleteQueue store
const STORE = 'projects';
const QUEUE_STORE = 'pendingCloudQueue';
const DELETE_QUEUE_STORE = 'pendingDeleteQueue'; // FIX Bug 5

let _db = null;

// ─── Internal helpers ─────────────────────────────────────────────────────────

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('by_owner_ts', ['owner', 'savedAt'], { unique: false });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'projectId' });
      }
      // FIX Bug 5: new store for offline delete queue
      if (!db.objectStoreNames.contains(DELETE_QUEUE_STORE)) {
        db.createObjectStore(DELETE_QUEUE_STORE, { keyPath: 'projectId' });
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

function idbRequest(storeName, mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const store = t.objectStore(storeName);
        const req = fn(store);
        if (req && typeof req.onsuccess !== 'undefined') {
          req.onsuccess = (e) => resolve(e.target.result);
          req.onerror = (e) => reject(e.target.error);
        } else {
          t.oncomplete = () => resolve();
          t.onerror = (e) => reject(e.target.error);
        }
      })
  );
}

function isAuthenticated(owner) {
  return owner && owner !== 'guest';
}

// ─── Local-only project list (no cloud call) ─────────────────────────────────
// FIX Bug 3: used by ensureUniqueProjectName to avoid double cloud requests

async function listProjectsLocal(owner) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly');
    const req = t.objectStore(STORE).getAll();
    req.onsuccess = (e) => {
      const all = (e.target.result || []).filter((p) => p.owner === owner);
      all.sort((a, b) => b.savedAt - a.savedAt);
      resolve(all);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

// ─── Multi-Tab Broadcast Sync ────────────────────────────────────────────────

let _syncChannel = null;
const _listeners = new Set();

function getSyncChannel() {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return null;
  if (!_syncChannel) {
    _syncChannel = new BroadcastChannel('ohw_project_sync');
    _syncChannel.onmessage = (event) => {
      const data = event.data;
      if (!data || !data.type) return;
      console.log('[ProjectStore MultiTab] Received sync event:', data.type, data.projectId || '');
      _listeners.forEach((fn) => {
        try { fn(data); } catch (e) { console.warn(e); }
      });
    };
  }
  return _syncChannel;
}

function broadcastSyncEvent(type, payload) {
  const channel = getSyncChannel();
  if (channel) {
    try {
      channel.postMessage({ type, timestamp: Date.now(), ...payload });
    } catch (e) {
      console.warn('[ProjectStore MultiTab] Failed to broadcast event:', e);
    }
  }
}

/**
 * Subscribes to live project store events across browser tabs.
 * @param {Function} listener - Callback function (eventPayload) => void
 * @returns {Function} Unsubscribe function
 */
export function subscribeToProjectStoreChanges(listener) {
  _listeners.add(listener);
  getSyncChannel(); // ensure channel is initialized
  return () => _listeners.delete(listener);
}

// ─── Offline Save Queue ───────────────────────────────────────────────────────

export async function enqueuePendingCloudProject(payload) {
  try {
    await idbRequest(QUEUE_STORE, 'readwrite', (store) => store.put(payload));
    console.log(`[ProjectStore] Queued project ${payload.projectId} for offline cloud sync.`);
  } catch (err) {
    console.warn('[ProjectStore] Failed to enqueue project save:', err);
  }
}

export async function removePendingCloudProject(projectId) {
  try {
    await idbRequest(QUEUE_STORE, 'readwrite', (store) => store.delete(projectId));
  } catch (err) {
    /* non-fatal */
  }
}

export async function flushPendingProjectsQueue() {
  try {
    const db = await openDB();
    const queuedItems = await new Promise((resolve) => {
      const t = db.transaction(QUEUE_STORE, 'readonly');
      const req = t.objectStore(QUEUE_STORE).getAll();
      req.onsuccess = (e) => resolve(e.target.result || []);
      req.onerror = () => resolve([]);
    });

    if (!queuedItems.length) return;

    console.log(`[ProjectStore] Draining ${queuedItems.length} queued offline project saves...`);
    for (const payload of queuedItems) {
      try {
        // FIX Bug 1: saveProjectToCloud returns the project directly (data.project already unwrapped)
        const cloudProject = await saveProjectToCloud(payload);
        await removePendingCloudProject(payload.projectId);
        console.log(`[ProjectStore] Auto-synced project ${payload.projectId} to cloud.`);
        broadcastSyncEvent('PROJECT_SAVED', {
          projectId: payload.projectId,
          owner: payload.owner,
          version: cloudProject?.version || payload.version,  // FIX Bug 1: was cloudRes?.project?.version
        });
      } catch (err) {
        console.warn(`[ProjectStore] Auto-sync retry failed for ${payload.projectId}:`, err.message);
        break; // Still offline or backend unreachable — stop draining
      }
    }
  } catch (err) {
    console.warn('[ProjectStore] Error draining project queue:', err);
  }
}

// ─── Offline Delete Queue (FIX Bug 5) ────────────────────────────────────────

async function enqueuePendingDeleteProject(projectId) {
  try {
    await idbRequest(DELETE_QUEUE_STORE, 'readwrite', (store) =>
      store.put({ projectId, queuedAt: Date.now() })
    );
    console.log(`[ProjectStore] Queued project ${projectId} for offline cloud delete.`);
  } catch (err) {
    console.warn('[ProjectStore] Failed to enqueue project delete:', err);
  }
}

async function removePendingDeleteProject(projectId) {
  try {
    await idbRequest(DELETE_QUEUE_STORE, 'readwrite', (store) => store.delete(projectId));
  } catch (err) {
    /* non-fatal */
  }
}

async function flushPendingDeleteQueue() {
  try {
    const db = await openDB();
    const queuedItems = await new Promise((resolve) => {
      const t = db.transaction(DELETE_QUEUE_STORE, 'readonly');
      const req = t.objectStore(DELETE_QUEUE_STORE).getAll();
      req.onsuccess = (e) => resolve(e.target.result || []);
      req.onerror = () => resolve([]);
    });

    if (!queuedItems.length) return;

    console.log(`[ProjectStore] Draining ${queuedItems.length} queued offline project deletes...`);
    for (const { projectId } of queuedItems) {
      try {
        await deleteProjectFromCloud(projectId);
        await removePendingDeleteProject(projectId);
        console.log(`[ProjectStore] Auto-deleted project ${projectId} from cloud.`);
        broadcastSyncEvent('PROJECT_DELETED', { projectId });
      } catch (err) {
        console.warn(`[ProjectStore] Auto-delete retry failed for ${projectId}:`, err.message);
        break;
      }
    }
  } catch (err) {
    console.warn('[ProjectStore] Error draining delete queue:', err);
  }
}

// ─── Online event: flush both queues ─────────────────────────────────────────

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[ProjectStore] Connectivity restored. Auto-syncing pending changes...');
    flushPendingProjectsQueue();
    flushPendingDeleteQueue(); // FIX Bug 5
  });
}

// ─── ID generation ────────────────────────────────────────────────────────────

export function generateProjectId() {
  const rand = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  return `proj_${rand}_${Date.now().toString(36)}`;
}

// ─── Unique name helper (local-only — FIX Bug 3) ──────────────────────────────

async function ensureUniqueProjectName(baseName, owner, currentId) {
  const name = (baseName || 'Untitled').trim();
  // FIX Bug 3: use local-only lookup — avoids extra cloud call on every save
  const projects = await listProjectsLocal(owner);

  const otherProjects = projects.filter((p) => p.id !== currentId);
  const existingNames = new Set(otherProjects.map((p) => (p.name || '').trim()));

  if (!existingNames.has(name)) return name;

  let counter = 1;
  let candidateName = `${name} (${counter})`;
  while (existingNames.has(candidateName)) {
    counter++;
    candidateName = `${name} (${counter})`;
  }
  return candidateName;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function saveProject(project) {
  const uniqueName = await ensureUniqueProjectName(project.name, project.owner, project.id);
  const record = {
    ...project,
    name: uniqueName,
    version: (project.version || 0) + 1,
    savedAt: Date.now(),
  };
  await idbRequest(STORE, 'readwrite', (store) => store.put(record));

  if (isAuthenticated(project.owner)) {
    const cloudPayload = {
      projectId: project.id,
      name: uniqueName,
      board: project.board,
      components: project.components,
      connections: project.connections,
      wires: project.wires,
      code: project.code,
      blocklyXml: project.blocklyXml,
      blocklyGeneratedCode: project.blocklyGeneratedCode,
      useBlocklyCode: project.useBlocklyCode,
      projectFiles: project.projectFiles,
      openCodeTabs: project.openCodeTabs,
      activeCodeFileId: project.activeCodeFileId,
      thumbnail: project.thumbnail,
      version: record.version,
      savedAt: record.savedAt,
    };
    try {
      // FIX Bug 1: saveProjectToCloud returns data.project directly (already unwrapped)
      const cloudProject = await saveProjectToCloud(cloudPayload);
      if (cloudProject?.version) {
        record.version = cloudProject.version;  // FIX Bug 1: was cloudRes?.project?.version
        await idbRequest(STORE, 'readwrite', (store) => store.put(record));
      }
      await removePendingCloudProject(project.id);
    } catch (err) {
      console.warn('[ProjectStore] Cloud save failed (offline?):', err.message);
      await enqueuePendingCloudProject(cloudPayload);
    }
  }

  broadcastSyncEvent('PROJECT_SAVED', {
    projectId: project.id,
    name: uniqueName,
    owner: project.owner,
    version: record.version,
    savedAt: record.savedAt,
  });

  return uniqueName;
}

export async function loadProject(id) {
  return idbRequest(STORE, 'readonly', (store) => store.get(id));
}

export async function listProjects(owner) {
  const local = await listProjectsLocal(owner);

  if (isAuthenticated(owner)) {
    try {
      const cloudProjects = await listProjectsFromCloud();
      if (cloudProjects) {
        const merged = new Map();
        for (const p of local) {
          merged.set(p.id, p);
        }
        for (const p of cloudProjects) {
          const existing = merged.get(p.projectId);
          const cloudVersion = p.version || 0;
          const localVersion = existing?.version || 0;
          const isCloudNewer =
            !existing ||
            cloudVersion > localVersion ||
            (cloudVersion === localVersion && (p.savedAt || 0) > (existing.savedAt || 0));

          if (isCloudNewer) {
            merged.set(p.projectId, {
              ...p,
              id: p.projectId,
              owner,
              version: cloudVersion,
              connections: p.connections || p.wires || [],
              wires: p.wires || [],
            });
          }
        }
        const result = Array.from(merged.values());
        result.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
        return result;
      }
    } catch (err) {
      console.warn('[ProjectStore] Cloud list failed (offline?):', err.message);
    }
  }
  return local;
}

export async function deleteProject(id, owner) {
  await idbRequest(STORE, 'readwrite', (store) => store.delete(id));
  if (isAuthenticated(owner)) {
    try {
      await deleteProjectFromCloud(id);
      await removePendingDeleteProject(id); // clean up any stale queue entry
    } catch (err) {
      console.warn('[ProjectStore] Cloud delete failed (offline?). Queuing:', err.message);
      await enqueuePendingDeleteProject(id); // FIX Bug 5
    }
  }
  broadcastSyncEvent('PROJECT_DELETED', { projectId: id, owner });
}

export async function renameProject(id, newName, owner) {
  if (!id) {
    console.warn('[ProjectStore] Cannot rename project: missing ID');
    return Promise.resolve('');
  }
  const existing = await loadProject(id);
  if (!existing) return Promise.resolve('');

  const uniqueName = await ensureUniqueProjectName(newName, existing.owner || owner, id);
  const record = {
    ...existing,
    name: uniqueName,
    version: (existing.version || 0) + 1,
    savedAt: Date.now(),
  };
  await idbRequest(STORE, 'readwrite', (store) => store.put(record));

  if (isAuthenticated(existing.owner || owner)) {
    try {
      await renameProjectOnCloud(id, uniqueName);
      await removePendingCloudProject(id); // clear any stale save queue entry
    } catch (err) {
      console.warn('[ProjectStore] Cloud rename failed (offline?). Queuing full save:', err.message);
      // FIX Bug 4: enqueue a full save on cloud rename failure so changes sync on reconnect
      await enqueuePendingCloudProject({
        projectId: id,
        name: uniqueName,
        board: existing.board,
        components: existing.components,
        connections: existing.connections,
        wires: existing.wires,
        code: existing.code,
        blocklyXml: existing.blocklyXml,
        blocklyGeneratedCode: existing.blocklyGeneratedCode,
        useBlocklyCode: existing.useBlocklyCode,
        projectFiles: existing.projectFiles,
        openCodeTabs: existing.openCodeTabs,
        activeCodeFileId: existing.activeCodeFileId,
        thumbnail: existing.thumbnail,
        version: record.version,
        savedAt: record.savedAt,
        owner: existing.owner || owner,
      });
    }
  }
  broadcastSyncEvent('PROJECT_RENAMED', {
    projectId: id,
    newName: uniqueName,
    owner: existing.owner || owner,
  });
  return uniqueName;
}

export function formatProjectDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const time = d.toTimeString().slice(0, 5);
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isToday) return `Today ${time}`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ` ${time}`;
}
