// Self-destructing service worker.
//
// Earlier builds of this app registered a service worker (cache name "vt-v1")
// that served stale app assets and tried to cache large Whisper model files.
// On iOS that caching exceeds Safari's storage quota and fails, causing the
// model to re-download on every load (an endless "preparing" loop), while the
// stale app shell keeps old code running so fixes never take effect.
//
// The current app no longer uses a service worker. This file exists only to
// evict any old worker still installed on a device. Browsers always fetch the
// SW script from the network on navigation, so deploying this reaches trapped
// devices and removes the worker for good.

self.addEventListener('install', () => {
  // Activate immediately, replacing the old worker without waiting.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop every cache the old worker created (stale app shell + any
      // partial/broken model files). transformers.js will re-cache the model
      // correctly once no service worker is intercepting requests.
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch {
        /* ignore */
      }

      // Remove this worker so the page is served straight from the network.
      try {
        await self.registration.unregister();
      } catch {
        /* ignore */
      }

      // Reload any open tabs so they pick up the fresh, un-intercepted app.
      try {
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach((client) => client.navigate(client.url));
      } catch {
        /* ignore */
      }
    })(),
  );
});

// Pass through any fetches that occur before activation completes — never
// serve from cache.
self.addEventListener('fetch', () => {});
