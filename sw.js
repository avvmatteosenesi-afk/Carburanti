const CACHE_VERSION = 'carburanti-shell-20261113-initial-zoom-3';
const DATA_CACHE = 'carburanti-data-v2';
const SHELL = [
  "map-navigation.js?v=20261112-manual-pan-1",
  "manifest.webmanifest?v=20261024-green2",
  "carburanti-green-180.png?v=20261024-green2",
  "favicon.svg?v=20261024-green2",
  "style.css?v=20261028-12",
  "layout-themes.css?v=20261110-priorities-2",
  "home-ui.css?v=20261024-4",
  "ux-enhancements.css?v=20261110-priorities-2",
  "icon.svg?v=20261020-3",
  "marker-fix.js?v=20261030-32",
  "bootstrap.js?v=20261113-initial-zoom-3",
  "startup-data-guard.js?v=20261110-priorities-2",
  "province-data-guard.js?v=20261025-2",
  "app.js?v=20261113-initial-zoom-2",
  "startup-location.js?v=20261024-2",
  "double-tap-zoom.js?v=20261024-2",
  "data-health.js?v=20261110-priorities-2",
  "zone-colors-v2.js?v=20261110-priorities-2",
  "location-visibility.js?v=20261113-initial-zoom-3",
  "trip-geocode-fix.js?v=20261022-1",
  "trip-services.js?v=20261110-priorities-2",
  "trip.js?v=20261112-manual-pan-1",
  "trip-fit.js?v=20261112-manual-pan-1",
  "trip-detour.js?v=20261024-1",
  "zone-zoom.js?v=20261113-initial-zoom-1",
  "home-ui.js?v=20261113-initial-zoom-2",
  "refresh-ui.js?v=20261105-refresh-slot-1",
  "ux-enhancements.js?v=20261105-quick-head-1",
  "favorite-marker.js?v=20261028-4",
  "layout-themes.js?v=20261105-graphic-locked-1",
  "index.html",
  "./",
  "carburanti-green-192.png?v=20261024-2",
  "carburanti-green-512.png?v=20261024-2",
  "theme-banners/dragon.webp?v=20261105-banner-1",
  "theme-banners/arale.webp?v=20261105-banner-1",
  "theme-banners/daitarn.webp?v=20261105-banner-1",
  "theme-banners/jeeg.webp?v=20261105-banner-1",
  "theme-banners/harlock.webp?v=20261105-banner-1",
  "theme-banners/mazinga.webp?v=20261105-banner-1",
  "theme-banners/goldrake.webp?v=20261105-banner-1",
  "theme-banners/lamu.webp?v=20261105-banner-1",
  "theme-banners/kenshiro.webp?v=20261105-banner-1",
  "theme-banners/candy.webp?v=20261105-banner-1",
  "theme-banners/yattaman.webp?v=20261105-banner-1",
  "theme-banners/lupin.webp?v=20261105-banner-1",
  "theme-banners/oscar.webp?v=20261105-banner-1",
  "vendor/leaflet-1.9.4/leaflet.js",
  "vendor/leaflet-1.9.4/leaflet.css"
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await cache.addAll(SHELL);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('carburanti-') && k!==CACHE_VERSION && k!==DATA_CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
function offlineData(response) {
  const headers=new Headers(response.headers);headers.set('X-Carburanti-Offline','1');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
self.addEventListener('fetch', event => {
  const req=event.request;if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin===self.location.origin && /\/data\/stations(?:-it)?\.json$/.test(url.pathname)) {
    event.respondWith((async()=>{
      const cache=await caches.open(DATA_CACHE),key=new Request(url.origin+url.pathname);
      try {
        const fresh=await fetch(req,{cache:'no-store'});
        if(fresh.ok){await cache.put(key,fresh.clone()).catch(()=>{});return fresh;}
        const cached=await cache.match(key);return cached?offlineData(cached):fresh;
      } catch (_) {
        const cached=await cache.match(key);
        return cached?offlineData(cached):new Response(JSON.stringify({metadata:{},stations:[]}),{status:503,headers:{'Content-Type':'application/json'}});
      }
    })());return;
  }
  if(url.origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_VERSION);
    try {
      const fresh=await fetch(req,{cache:'no-store'});
      if(fresh.ok){await cache.put(req,fresh.clone()).catch(()=>{});return fresh;}
      const cached=await cache.match(req);return cached||fresh;
    } catch (_) {
      const cached=await cache.match(req);if(cached)return cached;
      if(req.mode==='navigate') {
        const home=await cache.match(new URL('index.html',self.registration.scope).href);
        if(home)return home;
      }
      return new Response('',{status:503,statusText:'Offline'});
    }
  })());
});
