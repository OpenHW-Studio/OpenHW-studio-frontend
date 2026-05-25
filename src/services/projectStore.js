/**
 * projectStore.js
 *
 * IndexedDB-backed project persistence for OpenHW Studio.
 *
 * Works for ALL users — both authenticated and guests. Every project is
 * associated with an owner string:
 *   - Authenticated users  → owner = user.email
 *   - Guest / anonymous     → owner = 'guest'
 *
 * This means:
 *  • Guest users never lose work across page refreshes or browser restarts.
 *  • Each authenticated user only sees their own saved projects.
 *  • No network connection is ever required for project persistence.
 *
 * IndexedDB database layout:
 *   DB name  : 'openhw-projects'
 *   Version  : 1
 *   Stores   : 'projects'  (keyPath: 'id')
 *     Indexes : 'by_owner_ts' (owner, savedAt)  — efficient listing per user
 */

const DB_NAME = 'openhw-projects';
const DB_VERSION = 1;
const STORE = 'projects';

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
        // Compound index for fast per-owner listings sorted by recency
        store.createIndex('by_owner_ts', ['owner', 'savedAt'], { unique: false });
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

// ─── ID generation ────────────────────────────────────────────────────────────

/**
 * Generates a compact random ID (no external library required).
 * @returns {string} e.g.  "proj_3f9a2c1d"
 */
export function generateProjectId() {
  const rand = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  return `proj_${rand}_${Date.now().toString(36)}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Ensures a project name is unique for a given owner by appending (1), (2), etc. if needed.
 * Ignores the current project ID being saved/renamed.
 */
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

/**
 * Save or update a project.
 *
 * @param {object} project
 * @param {string}  project.id          Unique project ID (from generateProjectId)
 * @param {string}  project.name        Human-readable project name
 * @param {string}  project.board       Board type ('arduino_uno' | 'pico' | 'esp-32')
 * @param {Array}   project.components  Canvas components array
 * @param {Array}   project.connections Wires array
 * @param {string}  project.code        Arduino C++ sketch source
 * @param {string}  project.owner       'guest' or user.email
 * @param {number}  [project.savedAt]   Unix ms timestamp (auto-set if omitted)
 * @returns {Promise<string>}           Returns the unique project name assigned
 */
export async function saveProject(project) {
  const uniqueName = await ensureUniqueProjectName(project.name, project.owner, project.id);
  const record = {
    ...project,
    name: uniqueName,
    savedAt: Date.now(),
  };
  await idbRequest(STORE, 'readwrite', (store) => store.put(record));
  return uniqueName;
}

/**
 * Load a single project by its ID.
 *
 * @param {string} id
 * @returns {Promise<object|undefined>}
 */
export async function loadProject(id) {
  return idbRequest(STORE, 'readonly', (store) => store.get(id));
}

/**
 * List all projects owned by a given user, newest first.
 *
 * @param {string} owner  'guest' or user.email
 * @returns {Promise<Array>}
 */
export async function listProjects(owner) {
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

/**
 * Delete a project by ID.
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteProject(id) {
  return idbRequest(STORE, 'readwrite', (store) => store.delete(id));
}

/**
 * Rename an existing project.
 *
 * @param {string} id
 * @param {string} newName
 * @returns {Promise<string>}  Returns the unique project name assigned
 */
export async function renameProject(id, newName) {
  if (!id) {
    console.warn('[ProjectStore] Cannot rename project: missing ID');
    return Promise.resolve('');
  }
  const existing = await loadProject(id);
  if (!existing) return Promise.resolve('');

  const uniqueName = await ensureUniqueProjectName(newName, existing.owner, id);
  const record = { ...existing, name: uniqueName, savedAt: Date.now() };
  await idbRequest(STORE, 'readwrite', (store) => store.put(record));
  return uniqueName;
}

/**
 * Format a savedAt timestamp to a human-readable string.
 * e.g. "Today 14:32" or "Mar 5, 14:32"
 *
 * @param {number} ts  Unix ms timestamp
 * @returns {string}
 */
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
