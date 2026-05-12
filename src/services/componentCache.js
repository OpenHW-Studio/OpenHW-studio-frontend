/**
 * componentCache.js
 *
 * IndexedDB cache for backend-installed custom components.
 *
 * Strategy:
 *  1. On every page load, read the cache and inject components immediately (no network).
 *  2. Call GET /api/components/version (tiny ~40-byte response).
 *  3. If the server hash matches the cached hash → done, cache is fresh.
 *  4. If hashes differ → fetch full sources, transpile with Babel, update cache.
 *
 * This means Babel transpilation only runs when an admin actually changes something.
 */

const DB_NAME = 'openhw-components';
const DB_VERSION = 1;
const COMPONENTS_STORE = 'componentCache';
const META_STORE = 'cacheMetadata';

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(COMPONENTS_STORE)) {
        db.createObjectStore(COMPONENTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
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

/**
 * Returns all cached components from IndexedDB.
 * Each entry has: { id, manifest, uiRaw, logicRaw, validationRaw, indexRaw,
 *                   transpiledUI, transpiledLogic, serverHash }
 * @returns {Promise<Array>}
 */
export async function getCachedComponents() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction(COMPONENTS_STORE, 'readonly');
      const req = t.objectStore(COMPONENTS_STORE).getAll();
      req.onsuccess = (e) => resolve(e.target.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (e) {
    return [];
  }
}

/**
 * Returns the server hash that was active when the cache was last populated.
 * @returns {Promise<string|null>}
 */
export async function getCachedServerHash() {
  try {
    const row = await tx(META_STORE, 'readonly', s => s.get('serverHash'));
    return row?.value ?? null;
  } catch (e) {
    return null;
  }
}

/**
 * Persists a batch of transpiled components and records the server hash.
 * Replaces the entire store — atomically clears old entries and writes new ones.
 * @param {Array} components - Array of component objects with transpiled fields
 * @param {string} serverHash - Hash returned by GET /api/components/version
 */
export async function setCachedComponents(components, serverHash) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const t = db.transaction([COMPONENTS_STORE, META_STORE], 'readwrite');
      t.oncomplete = resolve;
      t.onerror = (e) => reject(e.target.error);

      // Clear old component entries
      t.objectStore(COMPONENTS_STORE).clear();

      // Write all new components
      const store = t.objectStore(COMPONENTS_STORE);
      for (const comp of components) {
        store.put({ ...comp, cachedAt: Date.now() });
      }

      // Update the hash metadata
      t.objectStore(META_STORE).put({ key: 'serverHash', value: serverHash, updatedAt: Date.now() });
    });
  } catch (err) {
    console.warn('[ComponentCache] Failed to persist cache:', err);
  }
}

/**
 * Clears all cached components and the stored hash.
 * Called when the server signals no components exist (count === 0).
 */
export async function clearComponentCache() {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const t = db.transaction([COMPONENTS_STORE, META_STORE], 'readwrite');
      t.oncomplete = resolve;
      t.onerror = (e) => reject(e.target.error);
      t.objectStore(COMPONENTS_STORE).clear();
      t.objectStore(META_STORE).clear();
    });
  } catch (err) {
    console.warn('[ComponentCache] Failed to clear cache:', err);
  }
}
