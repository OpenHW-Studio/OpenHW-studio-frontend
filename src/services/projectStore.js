/**
 * projectStore.js
 *
 * Two-tier project persistence for OpenHW Studio:
 *   1. IndexedDB (local) — works offline, for all users
 *   2. Backend / MongoDB (cloud) — for authenticated users via API
 *
 * Every project is associated with an owner string:
 *   - Authenticated users  → owner = user.email
 *   - Guest / anonymous     → owner = 'guest'
 *
 * IndexedDB database layout:
 *   DB name  : 'openhw-projects'
 *   Version  : 1
 *   Stores   : 'projects'  (keyPath: 'id')
 *     Indexes : 'by_owner_ts' (owner, savedAt)  — efficient listing per user
 */

import {
  saveProjectToCloud,
  listProjectsFromCloud,
  getProjectFromCloud,
  deleteProjectFromCloud,
  renameProjectOnCloud,
} from './projectService.js';

const DB_NAME = 'openhw-projects';
const DB_VERSION = 2;
const STORE = 'projects';
const QUEUE_STORE = 'pendingCloudQueue';

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

// ─── Offline Queue Helpers ───────────────────────────────────────────────────

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
        await saveProjectToCloud(payload);
        await removePendingCloudProject(payload.projectId);
        console.log(`[ProjectStore] Successfully auto-synced project ${payload.projectId} to cloud.`);
      } catch (err) {
        console.warn(`[ProjectStore] Auto-sync retry failed for ${payload.projectId}:`, err.message);
        break; // Still offline or backend unreachable
      }
    }
  } catch (err) {
    console.warn('[ProjectStore] Error draining project queue:', err);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[ProjectStore] Connectivity restored. Auto-syncing pending cloud projects...');
    flushPendingProjectsQueue();
  });
}

// ─── ID generation ────────────────────────────────────────────────────────────

export function generateProjectId() {
  const rand = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  return `proj_${rand}_${Date.now().toString(36)}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function ensureUniqueProjectName(baseName, owner, currentId) {
  const name = (baseName || 'Untitled').trim();
  const projects = await listProjects(owner);
  
  const otherProjects = projects.filter(p => p.id !== currentId);
  const existingNames = new Set(otherProjects.map(p => (p.name || '').trim()));

  if (!existingNames.has(name)) {
    return name;
  }

  let counter = 1;
  let candidateName = `${name} (${counter})`;
  while (existingNames.has(candidateName)) {
    counter++;
    candidateName = `${name} (${counter})`;
  }

  return candidateName;
}

export async function saveProject(project) {
  const uniqueName = await ensureUniqueProjectName(project.name, project.owner, project.id);
  const record = {
    ...project,
    name: uniqueName,
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
      savedAt: record.savedAt,
    };
    try {
      await saveProjectToCloud(cloudPayload);
      await removePendingCloudProject(project.id);
    } catch (err) {
      console.warn('[ProjectStore] Cloud save failed (offline?):', err.message);
      await enqueuePendingCloudProject(cloudPayload);
    }
  }
  return uniqueName;
}


export async function loadProject(id) {
  return idbRequest(STORE, 'readonly', (store) => store.get(id));
}

export async function listProjects(owner) {
  const db = await openDB();
  const local = await new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly');
    const req = t.objectStore(STORE).getAll();
    req.onsuccess = (e) => {
      const all = (e.target.result || []).filter((p) => p.owner === owner);
      all.sort((a, b) => b.savedAt - a.savedAt);
      resolve(all);
    };
    req.onerror = (e) => reject(e.target.error);
  });
  if (isAuthenticated(owner)) {
    try {
      const cloudProjects = await listProjectsFromCloud();
      if (cloudProjects) {
        const cloudMap = new Map(cloudProjects.map(p => [p.projectId, p]));
        const merged = new Map();
        for (const p of local) {
          merged.set(p.id, p);
        }
        for (const p of cloudProjects) {
          const existing = merged.get(p.projectId);
          if (!existing || (p.savedAt || 0) > (existing.savedAt || 0)) {
            merged.set(p.projectId, {
              ...p,
              id: p.projectId,
              owner,
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
    } catch (err) {
      console.warn('[ProjectStore] Cloud delete failed:', err.message);
    }
  }
}

export async function renameProject(id, newName, owner) {
  if (!id) {
    console.warn('[ProjectStore] Cannot rename project: missing ID');
    return Promise.resolve('');
  }
  const existing = await loadProject(id);
  if (!existing) return Promise.resolve('');

  const uniqueName = await ensureUniqueProjectName(newName, existing.owner || owner, id);
  const record = { ...existing, name: uniqueName, savedAt: Date.now() };
  await idbRequest(STORE, 'readwrite', (store) => store.put(record));
  
  if (isAuthenticated(existing.owner || owner)) {
    try {
      await renameProjectOnCloud(id, uniqueName);
    } catch (err) {
      console.warn('[ProjectStore] Cloud rename failed:', err.message);
    }
  }
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
