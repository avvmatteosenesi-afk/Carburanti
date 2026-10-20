const CACHE_VERSION = 'carburanti-shell-20261020-2';
const SHELL = [
  './',
  './index.html',
  './style.css?v=20261020-2',
  './app.js?v=20261020-2',
  './trip.js?v=20261020-2',
  './manifest.webmanifest?v=20261020-2',
  './icon.svg?v=20261020-2',
  './favicon.svg?v=20261020-2',
  './icon-192.png?v=20261020-2',
  './icon-512.png?v=20261020-2',
  './apple-touch-icon.png?v=20261020-2'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.pathname.endsWith('/data/stations.json') || url.pathname.endsWith('/data/stations-it.json')) {
    event.respondWith(fetch(req, { cache: 'no-store' }).catch(() => new Response(JSON.stringify({ metadata: {}, stations: [] }), {
      status: 503, headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_VERSION);
        cache.put(req, fresh.clone()).catch(() => {});
        return fresh;
      } catch {
        return (await caches.match(req)) || (await caches.match('./index.html'));
      }
    })());
  }
});
