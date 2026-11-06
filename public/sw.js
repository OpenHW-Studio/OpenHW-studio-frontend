/**
 * OpenHW Studio - Offline PWA Service Worker
 *
 * Provides offline caching for static assets, JavaScript bundles, Web Workers,
 * WASM binaries, and local Wokwi custom elements.
 *
 * Board-engine offline support: the Vite build emits /engine-precache.json
 * (hashed simulation.worker / avr-runner / rp2040-runner / execute / logic
 * / emulatorLoader / render+network workers / raw emulator sources / wasm).
 * At install we fetch that manifest and precache the whole engine, so the
 * simulator can boot and run fully offline after one online visit.
 *
 * NOTE: the engine lives in Cache Storage, not IndexedDB. JS chunks cannot
 * execute from IndexedDB (would need blob-URL rewriting, breaks worker
 * static imports + CSP). IndexedDB stays for data: projects, components,
 * compiled hex.
 */

const CACHE_NAME = 'openhw-studio-v2';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/wokwi-elements.bundle.js',
  '/title-logo.png',
  '/favicon.ico',
];

// Install Event - Pre-cache core shell + board engine resources
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      console.log('[SW] Pre-caching core app shell assets...');
      await cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache partial failure (non-fatal):', err);
      });
      // Board engine: resolve hashed filenames via the build manifest.
      try {
        const res = await fetch('/engine-precache.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const manifest = await res.json();
        const files = Array.isArray(manifest.files) ? manifest.files : [];
        if (files.length) {
          console.log(`[SW] Pre-caching board engine (${files.length} files)...`);
          await cache.addAll(files).catch((err) => {
            console.warn('[SW] Engine pre-cache partial failure (non-fatal):', err);
          });
        } else {
          console.warn('[SW] engine-precache.json empty — engine will cache on first use.');
        }
      } catch (err) {
        // Offline at first install or old deployment without the manifest:
        // engine chunks still get cached on first use via the fetch handler.
        console.warn('[SW] Engine manifest fetch failed (non-fatal):', err?.message || err);
      }
    })()
  );
});

// Activate Event - Clean up stale cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting old cache version:', key);
            return caches.delete(key);
          }
          return null;
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch Event - Serve from Cache with Network Fallback
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Bypass non-GET requests, development modules, dynamic API, version checks, and page navigations
  if (
    req.method !== 'GET' ||
    req.mode === 'navigate' ||
    url.pathname === '/version.json' ||
    url.pathname === '/index.html' ||
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/ws') ||
    url.pathname.startsWith('/@') ||
    url.pathname.includes('node_modules') ||
    url.protocol === 'ws:' ||
    url.protocol === 'wss:'
  ) {
    return;
  }

  // Strategy: Cache-First for static JS, CSS, WASM, Web Workers, Images, Fonts
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh version in background for next reload (Stale-While-Revalidate)
        fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              caches.open(CACHE_NAME).then((cache) => cache.put(req, networkResponse.clone()));
            }
          })
          .catch(() => {/* Offline fallback */});
        return cachedResponse;
      }

      // Network Fallback with Cache Put
      return fetch(req)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, responseToCache));
          return networkResponse;
        })
        .catch(async () => {
          // If offline and requesting navigation (HTML page), return cached index.html
          if (req.mode === 'navigate') {
            const cachedHtml = (await caches.match('/index.html')) || (await caches.match('/'));
            if (cachedHtml) return cachedHtml;
          }
          return new Response('Network error occurred', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' },
          });
        });
    })
  );
});
