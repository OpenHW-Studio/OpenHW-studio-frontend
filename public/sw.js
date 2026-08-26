/**
 * OpenHW Studio - Offline PWA Service Worker
 *
 * Provides offline caching for static assets, JavaScript bundles, Web Workers,
 * WASM binaries, and local Wokwi custom elements.
 */

const CACHE_NAME = 'openhw-studio-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/wokwi-elements.bundle.js',
  '/title-logo.png',
  '/favicon.ico',
];

// Install Event - Pre-cache core shell resources
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching core app shell assets...');
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache partial failure (non-fatal):', err);
      });
    })
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

  // Bypass non-GET requests, development modules, and dynamic API / auth / websocket calls
  if (
    req.method !== 'GET' ||
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
