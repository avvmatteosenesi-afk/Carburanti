(() => {
  'use strict';

  const MAP_ID = 'tripMap';
  let lastTouchAt = 0;

  function findTripMap(container) {
    if (!container || !window.L) return null;
    for (const key of Object.keys(container)) {
      const value = container[key];
      if (value && typeof value.getCenter === 'function' && typeof value.setView === 'function' && value._container === container) return value;
    }
    return null;
  }

  function centerOnMarker(target) {
    const container = document.getElementById(MAP_ID);
    if (!container) return;
    const icon = target && target.closest ? target.closest('.leaflet-marker-icon') : null;
    if (!icon || !container.contains(icon)) return;

    const map = findTripMap(container);
    if (!map) return;

    const markerPoint = L.point(
      icon.offsetLeft + icon.offsetWidth / 2,
      icon.offsetTop + icon.offsetHeight / 2
    );
    const latlng = map.layerPointToLatLng(markerPoint);
    if (!latlng || !Number.isFinite(latlng.lat) || !Number.isFinite(latlng.lng)) return;

    const zoom = Math.max(map.getZoom(), 15);
    map.setView(latlng, Math.min(zoom, map.getMaxZoom()), { animate: true });
  }

  document.addEventListener('touchend', event => {
    const container = document.getElementById(MAP_ID);
    if (!container || !container.contains(event.target)) return;
    if (!event.target.closest?.('.price-marker-wrap, .price-marker')) return;
    lastTouchAt = Date.now();
    centerOnMarker(event.target);
  }, { passive: true, capture: true });

  document.addEventListener('click', event => {
    const container = document.getElementById(MAP_ID);
    if (!container || !container.contains(event.target)) return;
    if (!event.target.closest?.('.price-marker-wrap, .price-marker')) return;
    if (Date.now() - lastTouchAt < 500) return;
    centerOnMarker(event.target);
  }, true);
})();
