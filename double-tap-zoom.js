(() => {
  'use strict';

  function enableDoubleTapZoom(map, container) {
    if (!map || !container || container.dataset.doubleTapZoom === '1') return;
    container.dataset.doubleTapZoom = '1';

    // Leaflet already handles mouse double-click. This adds a reliable
    // two-tap gesture for touch/PWA use without interfering with markers,
    // popups, dragging or pinch zoom.
    let lastTapAt = 0;
    let lastTapPoint = null;
    let moved = false;
    let touchCount = 0;

    container.addEventListener('touchstart', event => {
      touchCount = event.touches.length;
      moved = false;
    }, { passive: true });

    container.addEventListener('touchmove', () => {
      moved = true;
    }, { passive: true });

    container.addEventListener('touchend', event => {
      if (moved || touchCount !== 1 || event.changedTouches.length !== 1) {
        lastTapAt = 0;
        lastTapPoint = null;
        return;
      }

      const target = event.target;
      if (target && target.closest && target.closest('.leaflet-marker-icon, .leaflet-popup, .leaflet-control, button, a, input, select')) {
        lastTapAt = 0;
        lastTapPoint = null;
        return;
      }

      const touch = event.changedTouches[0];
      const now = Date.now();
      const point = { x: touch.clientX, y: touch.clientY };
      const closeEnough = lastTapPoint && Math.hypot(point.x - lastTapPoint.x, point.y - lastTapPoint.y) <= 36;

      if (lastTapAt && now - lastTapAt <= 360 && closeEnough) {
        event.preventDefault();
        const rect = container.getBoundingClientRect();
        const containerPoint = L.point(point.x - rect.left, point.y - rect.top);
        const latlng = map.containerPointToLatLng(containerPoint);
        map.setView(latlng, Math.min(map.getZoom() + 1, map.getMaxZoom()), { animate: true });
        lastTapAt = 0;
        lastTapPoint = null;
        return;
      }

      lastTapAt = now;
      lastTapPoint = point;
    }, { passive: false });
  }

  function attachMainMap() {
    const app = window.CarburantiApp;
    const map = app && app.state && app.state.map;
    const container = document.getElementById('map');
    if (map && container) enableDoubleTapZoom(map, container);
  }

  document.addEventListener('DOMContentLoaded', () => {
    let attempts = 0;
    const timer = setInterval(() => {
      attachMainMap();
      attempts += 1;
      if ((window.CarburantiApp && window.CarburantiApp.state && window.CarburantiApp.state.map) || attempts >= 40) clearInterval(timer);
    }, 100);
  });
})();
