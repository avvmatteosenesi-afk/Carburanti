(() => {
  'use strict';

  const FKEY = 'carburanti:favorites:v1';
  const GOLD = '#d4af37';
  const MAP_IDS = ['map', 'tripMap'];
  let stations = [];
  let refreshQueued = false;

  function favoriteIds() {
    try { return new Set((JSON.parse(localStorage.getItem(FKEY) || '[]') || []).map(String)); }
    catch (_) { return new Set(); }
  }

  function markerFromElement(el) {
    const container = el?.closest?.('#map, #tripMap');
    if (!container) return null;
    const map = container.id === 'tripMap' ? window.__carburantiTripMap : window.CarburantiApp?.state?.map;
    if (!map?.eachLayer) return null;
    let found = null;
    map.eachLayer(layer => {
      if (found) return;
      if ((layer.getElement?.() || layer._icon) === el && typeof layer.getLatLng === 'function') found = layer;
      else if (typeof layer.eachLayer === 'function') layer.eachLayer(child => {
        if (!found && (child.getElement?.() || child._icon) === el && typeof child.getLatLng === 'function') found = child;
      });
    });
    return found;
  }

  function isFavoriteMarker(wrap, ids) {
    const marker = markerFromElement(wrap);
    if (!marker) return false;
    const registry = window.CarburantiApp?.state?.markerById;
    if (registry?.entries) {
      const direct = Array.from(registry.entries()).find(([, m]) => m === marker);
      if (direct && ids.has(String(direct[0]))) return true;
    }
    const ll = marker.getLatLng?.();
    if (!ll) return false;
    return stations.some(s => ids.has(String(s.id)) && Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lon)) && Math.abs(Number(s.lat)-ll.lat)<1e-5 && Math.abs(Number(s.lon)-ll.lng)<1e-5);
  }

  function setFavoriteStyle(price, isFavorite) {
    price.classList.toggle('favorite-station-price', isFavorite);
    if (isFavorite) {
      price.style.setProperty('border', `3px solid ${GOLD}`, 'important');
      price.style.setProperty('box-shadow', `0 0 0 3px ${GOLD}, 0 2px 8px rgba(0,0,0,.35)`, 'important');
    } else {
      price.style.removeProperty('border');
      price.style.removeProperty('box-shadow');
    }
  }

  function apply() {
    refreshQueued = false;
    const ids = favoriteIds();
    for (const mapId of MAP_IDS) {
      const container = document.getElementById(mapId);
      if (!container) continue;
      container.querySelectorAll('.price-marker-wrap').forEach(wrap => {
        const price = wrap.querySelector('.price-marker');
        if (price) setFavoriteStyle(price, isFavoriteMarker(wrap, ids));
      });
    }
  }

  function applyDirect(id, favorite) {
    const marker = window.CarburantiApp?.state?.markerById?.get?.(String(id));
    const wrap = marker?.getElement?.() || marker?._icon;
    const price = wrap?.querySelector?.('.price-marker');
    if (price) setFavoriteStyle(price, favorite);
    queueApply();
  }

  function queueApply() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(apply);
  }

  async function loadStations() {
    try {
      const r = await fetch('data/stations.json?v=20261028-fav4', { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json();
        if (Array.isArray(j.stations)) stations = j.stations;
        queueApply();
      }
    } catch (_) {}
    try {
      const r = await fetch('data/stations-it.json?v=20261028-fav4', { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json();
        if (Array.isArray(j.stations)) stations.push(...j.stations);
        queueApply();
      }
    } catch (_) {}
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadStations();
    const observer = new MutationObserver(queueApply);
    MAP_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el, { childList: true, subtree: true });
    });
    window.addEventListener('carburanti:favorites-changed', e => applyDirect(e.detail?.id, Boolean(e.detail?.favorite)));
    document.addEventListener('click', e => { if (e.target?.closest?.('.fav-btn')) setTimeout(queueApply, 30); }, true);
    window.addEventListener('storage', e => { if (e.key === FKEY) queueApply(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) queueApply(); });
    setInterval(queueApply, 1200);
  });
})();