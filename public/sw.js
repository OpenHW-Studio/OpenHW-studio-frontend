/*
 * Legacy cleanup service worker.
 *
 * This file intentionally unregisters itself and clears old caches so clients
 * that still have a prior SW registration recover from stale app-shell assets.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));

    const registrations = await self.registration.unregister();
    await self.clients.claim();

    if (registrations) {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach((client) => {
        client.navigate(client.url);
      });
    }
  })());
});
