/**
 * offlineCache.js
 *
 * IndexedDB utility for two offline features:
 *  1. Compiled hex caching — survive page refreshes and internet outages.
 *  2. Pending ZIP component queue — submit to backend when back online.
 */

const DB_NAME = 'openhw-offline';
const DB_VERSION = 1;
const HEX_STORE = 'hexCache';
const QUEUE_STORE = 'componentQueue';

// Maximum cached entries before oldest are evicted
const HEX_CACHE_LIMIT = 50;

// ─── DB Bootstrap ─────────────────────────────────────────────────────────────

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(HEX_STORE)) {
        const store = db.createObjectStore(HEX_STORE, { keyPath: 'key' });
        store.createIndex('by_ts', 'ts', { unique: false });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'queueId', autoIncrement: true });
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

function tx(storeName, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const store = t.objectStore(storeName);
    const req = fn(store);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  }));
}

// ─── Hex Cache ────────────────────────────────────────────────────────────────

/**
 * Derives a stable string key from code + board.
 * Uses a fast non-cryptographic hash; collisions are acceptable (just recompile).
 */
function hexKey(code, board) {
  let h = 5381;
  const s = code + '\x00' + board;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0; // keep unsigned 32-bit
  }
  return board + '_' + h.toString(16);
}

/**
 * Look up a previously compiled hex result.
 * @returns {Promise<{hex:string, stdout:string}|null>}
 */
export async function getCachedHex(code, board) {
  try {
    const key = hexKey(code, board);
    const row = await tx(HEX_STORE, 'readonly', s => s.get(key));
    if (!row) return null;
    // Touch timestamp so it stays fresh
    await tx(HEX_STORE, 'readwrite', s => s.put({ ...row, ts: Date.now() }));
    return row.result;
  } catch {
    return null;
  }
}

/**
 * Save a compiled hex result persistently.
 * Evicts oldest entries when the store exceeds HEX_CACHE_LIMIT.
 */
export async function setCachedHex(code, board, result) {
  try {
    const key = hexKey(code, board);
    await tx(HEX_STORE, 'readwrite', s => s.put({ key, result, ts: Date.now() }));
    await _evictOldHex();
  } catch {
    // Non-fatal — in-memory ref still works as fallback
  }
}

async function _evictOldHex() {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const t = db.transaction(HEX_STORE, 'readwrite');
      const store = t.objectStore(HEX_STORE);
      const idx = store.index('by_ts');
      const allReq = idx.getAll();
      allReq.onsuccess = (e) => {
        const rows = e.target.result;
        if (rows.length <= HEX_CACHE_LIMIT) { resolve(); return; }
        rows.sort((a, b) => a.ts - b.ts);
        const toDelete = rows.slice(0, rows.length - HEX_CACHE_LIMIT);
        let pending = toDelete.length;
        if (pending === 0) { resolve(); return; }
        toDelete.forEach(row => {
          const r = store.delete(row.key);
          r.onsuccess = () => { if (--pending === 0) resolve(); };
          r.onerror = () => { if (--pending === 0) resolve(); };
        });
      };
      allReq.onerror = (e) => reject(e.target.error);
    });
  } catch {
    // Eviction failure is non-fatal
  }
}

// ─── Component Upload Queue ───────────────────────────────────────────────────

/**
 * Save a component payload to the offline queue.
 * @param {object} payload — same shape as submitCustomComponent expects
 */
export async function enqueueComponent(payload) {
  return tx(QUEUE_STORE, 'readwrite', s =>
    s.add({ payload, ts: Date.now() })
  );
}

/**
 * Return all queued component submissions.
 * @returns {Promise<Array<{queueId:number, payload:object, ts:number}>>}
 */
export async function getQueuedComponents() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction(QUEUE_STORE, 'readonly');
      const req = t.objectStore(QUEUE_STORE).getAll();
      req.onsuccess = (e) => resolve(e.target.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  } catch {
    return [];
  }
}

/**
 * Remove a successfully submitted entry from the queue.
 */
export async function dequeueComponent(queueId) {
  return tx(QUEUE_STORE, 'readwrite', s => s.delete(queueId));
}
