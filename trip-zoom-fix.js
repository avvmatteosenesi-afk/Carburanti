(() => {
  'use strict';
  if (!window.L?.map || L.__carburantiTripZoomPatched) return;
  L.__carburantiTripZoomPatched = true;

  const originalMap = L.map;
  L.map = function(target, options) {
    const map = originalMap.call(this, target, options);
    const id = typeof target === 'string' ? target : target?.id;
    if (id !== 'tripMap') return map;

    const originalSetView = map.setView.bind(map);
    const originalFitBounds = map.fitBounds.bind(map);
    let firstView = true;

    map.setView = function(center, zoom, opts) {
      if (firstView) {
        firstView = false;
        zoom = Number.isFinite(zoom) ? Math.min(18, zoom + 1) : zoom;
      }
      return originalSetView(center, zoom, opts);
    };

    map.fitBounds = function(bounds, opts = {}) {
      const result = originalFitBounds(bounds, opts);
      const cap = Number.isFinite(opts.maxZoom) ? opts.maxZoom : 18;
      const z = map.getZoom();
      if (Number.isFinite(z) && z < cap) map.setZoom(Math.min(cap, z + 1), { animate: false });
      return result;
    };

    return map;
  };
})();
