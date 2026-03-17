/**
 * OpenHW Studio — Service Worker
 *
 * Strategies:
 *  • App shell (HTML/JS/CSS)  → Cache-first, refresh in background (stale-while-revalidate)
 *  • API calls (/api/*)       → Network-only; fail fast so the app can show its own error
 *  • Compile endpoint         → Network-only (hex result is cached in IndexedDB by the app)
 *  • Navigation requests      → Network-first, fall back to cached index.html (SPA offline)
 *  • External scripts (CDN)   → Cache-first (e.g. wokwi-elements bundle)
 */

const CACHE_NAME = 'openhw-studio-v2';
const OFFLINE_PAGE = '/index.html';

// Assets to pre-cache on install.
// These ensure the app shell loads even without a network.
const PRECACHE_URLS = [
  '/',
  '/index.html',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()) // activate immediately
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim()) // take control of all open tabs
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Skip non-GET requests and browser-extension requests
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

  // 2. API calls — always go to network, never intercept.
  //    Hex caching is handled in IndexedDB by the app layer.
  if (url.pathname.startsWith('/api/')) return;

  // 3. SPA navigation — network first, fall back to index.html so the React
  //    router can take over even when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache a fresh copy of the page
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(OFFLINE_PAGE))
    );
    return;
  }

  // 4. Static assets and CDN resources — stale-while-revalidate.
  //    Return the cached version immediately and update the cache in background.
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.ok || response.type === 'opaque') {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => null);

        // Return cached immediately if we have it; otherwise wait for network
        return cached || networkFetch;
      })
    )
  );
});

// ─── Message handling ─────────────────────────────────────────────────────────
// Allow the app to explicitly clear the cache (e.g. after a new deploy)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME);
  }
});
