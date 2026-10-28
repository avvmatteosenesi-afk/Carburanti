(() => {
  'use strict';

  const ITALY_BOUNDS = L.latLngBounds([35.25, 6.05], [47.35, 18.85]);
  let lastRouteBounds = null;
  let pollTimer = null;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const getMap = () => window.__carburantiTripMap || null;

  function findRouteLine(map) {
    if (!map || !window.L) return null;
    try {
      return Object.values(map._layers || {}).find(layer => {
        if (!(layer instanceof L.Polyline) || layer instanceof L.Polygon) return false;
        const color = String(layer.options?.color || '').toLowerCase();
        return color === '#1267d6';
      }) || null;
    } catch (_) {
      return null;
    }
  }

  function fitBoundsBalanced(bounds, maxZoom = 14, liftRoute = false) {
    const map = getMap();
    if (!map || !bounds?.isValid?.()) return false;

    try { map.stop(); } catch (_) {}
    try { map.invalidateSize(false); } catch (_) {}

    const size = map.getSize();
    if (!size?.x || !size?.y) return false;

    const horizontal = clamp(Math.round(size.x * 0.075), 24, 52);
    const vertical = clamp(Math.round(size.y * 0.085), 30, 60);
    const padded = bounds.pad(0.018);

    try {
      map.fitBounds(padded, {
        paddingTopLeft: [horizontal, vertical],
        paddingBottomRight: [horizontal, vertical],
        maxZoom,
        animate: false
      });

      const zoom = map.getZoom();
      map.setView(bounds.getCenter(), zoom, { animate: false });

      // Dopo il calcolo del viaggio sposta sensibilmente il percorso verso
      // la parte alta della mappa, lasciando più spazio utile sotto.
      if (liftRoute) {
        const liftPx = clamp(Math.round(size.y * 0.18), 55, 105);
        map.panBy([0, liftPx], { animate: false });
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function fitCurrentRoute() {
    const map = getMap();
    if (!map) return false;
    const line = findRouteLine(map);
    if (!line) return false;
    const bounds = line.getBounds?.();
    if (!bounds?.isValid?.()) return false;
    lastRouteBounds = bounds;
    return fitBoundsBalanced(bounds, 14, true);
  }

  function settleRouteView() {
    [90, 240, 520].forEach(delay => setTimeout(() => {
      if (!document.getElementById('tripPanel')?.classList.contains('hidden')) fitCurrentRoute();
    }, delay));
  }

  function waitForRoute() {
    if (pollTimer) clearInterval(pollTimer);
    let attempts = 0;
    pollTimer = setInterval(() => {
      attempts += 1;
      if (fitCurrentRoute() || attempts >= 100) {
        clearInterval(pollTimer);
        pollTimer = null;
        if (lastRouteBounds) settleRouteView();
      }
    }, 120);
  }

  function fitInitialView() {
    const map = getMap();
    if (!map) return;
    const route = findRouteLine(map);
    if (route) {
      fitCurrentRoute();
      settleRouteView();
    } else {
      fitBoundsBalanced(ITALY_BOUNDS, 6);
      setTimeout(() => fitBoundsBalanced(ITALY_BOUNDS, 6), 220);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('tripOpenBtn')?.addEventListener('click', () => {
      setTimeout(fitInitialView, 70);
      setTimeout(fitInitialView, 300);
    });

    document.getElementById('tripGoBtn')?.addEventListener('click', () => {
      lastRouteBounds = null;
      waitForRoute();
    });

    const refit = () => {
      const panel = document.getElementById('tripPanel');
      if (!panel || panel.classList.contains('hidden')) return;
      if (lastRouteBounds) {
        fitBoundsBalanced(lastRouteBounds, 14, true);
      } else {
        fitInitialView();
      }
    };

    window.addEventListener('orientationchange', () => setTimeout(refit, 220));
    window.addEventListener('resize', () => setTimeout(refit, 120));
  });
})();