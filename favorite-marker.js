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
    const ll = marker?.getLatLng?.();
    if (!ll) return false;

    // Match by coordinates against both the Tuscany and national datasets,
    // then test every matching station ID. This remains reliable even when
    // the two datasets use different objects/IDs for the same installation.
    return stations.some(s =>
      ids.has(String(s.id)) &&
      Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lon)) &&
      Math.abs(Number(s.lat) - ll.lat) < 1e-5 &&
      Math.abs(Number(s.lon) - ll.lng) < 1e-5
    );
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

  function queueApply() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(apply);
  }

  async function loadStations() {
    const urls = ['data/stations.json?v=20261025-fav3', 'data/stations-it.json?v=20261025-fav3'];
    const all = [];
    await Promise.all(urls.map(async url => {
      try {
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        if (Array.isArray(j.stations)) all.push(...j.stations);
      } catch (_) {}
    }));
    stations = all;
    queueApply();
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadStations();
    const observer = new MutationObserver(queueApply);
    MAP_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el, { childList: true, subtree: true });
    });

    document.addEventListener('click', e => {
      if (e.target?.closest?.('.fav-btn')) {
        setTimeout(queueApply, 20);
        setTimeout(queueApply, 120);
        setTimeout(queueApply, 350);
      }
    }, true);
    window.addEventListener('storage', e => { if (e.key === FKEY) queueApply(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) queueApply(); });
    setInterval(queueApply, 1200);
  });
})();
