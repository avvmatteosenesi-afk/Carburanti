const CACHE_VERSION = 'carburanti-shell-20261026-2';
const DATA_CACHE = 'carburanti-data-v2';
const SHELL = [
  './', './index.html',
  './style.css?v=20261020-9', './home-ui.css?v=20261021-1',
  './marker-fix.js?v=20261021-1', './geo-cache.js?v=20261020-1', './bootstrap.js?v=20261020-8',
  './app.js?v=20261026-2', './trip.js?v=20261020-3',
  './zone-zoom.js?v=20261020-1', './home-ui.js?v=20261020-4',
  './manifest.webmanifest?v=20261020-3', './icon.svg?v=20261020-3',
  './favicon.svg?v=20261020-3', './icon-192.png?v=20261020-3',
  './icon-512.png?v=20261020-3', './apple-touch-icon.png?v=20261020-3'
];
self.addEventListener('install', event => { self.skipWaiting(); event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(SHELL).catch(() => {}))); });
self.addEventListener('activate', event => { event.waitUntil((async () => { const keys = await caches.keys(); await Promise.all(keys.filter(k => k !== CACHE_VERSION && k !== DATA_CACHE).map(k => caches.delete(k))); await self.clients.claim(); })()); });
self.addEventListener('fetch', event => {
  const req = event.request; if (req.method !== 'GET') return; const url = new URL(req.url);
  if (url.pathname.endsWith('/data/stations.json') || url.pathname.endsWith('/data/stations-it.json')) {
    event.respondWith((async () => { const cache = await caches.open(DATA_CACHE); const cacheKey = new Request(`${url.origin}${url.pathname}`); try { const fresh = await fetch(req, {cache:'no-store'}); if (fresh.ok) { cache.put(cacheKey, fresh.clone()).catch(()=>{}); return fresh; } const cached = await cache.match(cacheKey); if (cached) return cached; return fresh; } catch { const cached = await cache.match(cacheKey); if (cached) return cached; return new Response(JSON.stringify({metadata:{},stations:[]}), {status:503,headers:{'Content-Type':'application/json'}}); } })()); return;
  }
  if (url.origin === self.location.origin) event.respondWith((async () => { try { const fresh = await fetch(req,{cache:'no-store'}); const cache = await caches.open(CACHE_VERSION); cache.put(req,fresh.clone()).catch(()=>{}); return fresh; } catch { return (await caches.match(req)) || (await caches.match('./index.html')); } })());
});
