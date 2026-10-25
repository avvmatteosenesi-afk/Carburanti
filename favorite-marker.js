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

  function stationForMarker(marker) {
    const ll = marker?.getLatLng?.();
    if (!ll) return null;
    return stations.find(s => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lon)) && Math.abs(Number(s.lat) - ll.lat) < 1e-5 && Math.abs(Number(s.lon) - ll.lng) < 1e-5) || null;
  }

  function mainMarkerIdForElement(el) {
    const registry = window.CarburantiApp?.state?.markerById;
    if (!registry?.entries) return null;
    for (const [id, marker] of registry.entries()) {
      if ((marker.getElement?.() || marker._icon) === el) return String(id);
    }
    return null;
  }

  function markerFromElement(el) {
    const container = el?.closest?.('#map, #tripMap');
    if (!container || !window.L) return null;

    if (container.id === 'map') {
      const registry = window.CarburantiApp?.state?.markerById;
      if (registry?.values) {
        const found = Array.from(registry.values()).find(m => (m.getElement?.() || m._icon) === el);
        if (found) return found;
      }
    }

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

  function setFavoriteStyle(price, isFavorite) {
    price.classList.toggle('favorite-station-price', isFavorite);
    if (isFavorite) {
      price.style.setProperty('border-color', GOLD, 'important');
      price.style.setProperty('border-width', '3px', 'important');
      price.style.setProperty('box-shadow', '0 0 0 2px #fff, 0 0 0 5px #d4af37, 0 2px 7px rgba(0,0,0,.28)', 'important');
    } else {
      price.style.removeProperty('border-color');
      price.style.removeProperty('border-width');
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
        if (!price) return;

        // Main map: use the exact markerById registry. This avoids relying on
        // coordinates and on the independently refreshed national dataset.
        let stationId = mapId === 'map' ? mainMarkerIdForElement(wrap) : null;
        if (!stationId) {
          const marker = markerFromElement(wrap);
          const station = stationForMarker(marker);
          stationId = station ? String(station.id) : null;
        }
        setFavoriteStyle(price, Boolean(stationId && ids.has(stationId)));
      });
    }
  }

  function queueApply() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(apply);
  }

  async function loadStations() {
    try {
      const r = await fetch('data/stations-it.json?v=20261025-fav2', { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json();
        stations = Array.isArray(j.stations) ? j.stations : [];
      }
    } catch (_) {}
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
        setTimeout(queueApply, 0);
        setTimeout(queueApply, 80);
        setTimeout(queueApply, 250);
      }
    }, true);
    window.addEventListener('storage', e => { if (e.key === FKEY) queueApply(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) queueApply(); });
    setInterval(queueApply, 1500);
  });
})();
