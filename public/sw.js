// Service worker — network-first for the app shell (so a redeploy is picked up
// immediately), cache-first for immutable hashed build assets. The cache name is
// versioned so activating a new worker purges any older cache.
const CACHE = 'forge-master-v2';
const ASSET_RE = /\/assets\//;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never intercept the API or websockets.
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) return;

  // Hashed build assets are content-addressed and immutable → cache-first.
  if (ASSET_RE.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(request);
      if (hit) return hit;
      const res = await fetch(request);
      if (res.ok) cache.put(request, res.clone());
      return res;
    })());
    return;
  }

  // App shell / navigations / everything else → network-first, cache fallback offline.
  event.respondWith((async () => {
    try {
      const res = await fetch(request);
      if (res.ok && request.mode !== 'no-cors') {
        const cache = await caches.open(CACHE);
        cache.put(request, res.clone());
      }
      return res;
    } catch {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(request);
      return hit || Response.error();
    }
  })());
});
