(() => {
  'use strict';

  const LOCAL_ZOOM = 14;
  const TUSCANY_BOUNDS = [[42.20, 9.72], [44.53, 12.22]];

  const QUICK = {
    'pistoia-firenze': { bounds: [[43.71, 10.82], [43.99, 11.34]], maxZoom: 11 },
    'pistoia-prato': { bounds: [[43.82, 10.82], [44.00, 11.18]], maxZoom: 12 },
    'prato-firenze': { bounds: [[43.70, 11.02], [43.94, 11.35]], maxZoom: 12 },
    'pistoia-agliana': { bounds: [[43.86, 10.84], [43.98, 11.02]], maxZoom: 13 },
    'agliana-prato': { bounds: [[43.84, 10.96], [43.93, 11.14]], maxZoom: 13 }
  };

  function fit(map, bounds, maxZoom, padding = [18, 18], tighten = true) {
    const b = L.latLngBounds(bounds);
    if (!b.isValid()) return false;
    map.invalidateSize(false);
    map.fitBounds(b, { padding, maxZoom, animate: false });
    if (tighten && map.getZoom() < maxZoom) {
      map.setZoom(Math.min(maxZoom, map.getZoom() + 1), { animate: false });
    }
    return true;
  }

  function provinceBounds(app, code) {
    const stations = app?.state?.stations || [];
    const points = stations
      .filter(s => s.province === code && Number.isFinite(s.lat) && Number.isFinite(s.lon))
      .map(s => [s.lat, s.lon]);
    return points.length ? points : null;
  }

  function applyZoneZoom() {
    const app = window.CarburantiApp;
    const map = app?.state?.map;
    const select = document.getElementById('zoneSelect');
    if (!map || !select) return false;

    const zone = select.value;
    app.state.programmaticMove = true;

    if (zone === 'position') {
      const pos = app.getUserPosition?.();
      if (!pos || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lon)) return false;
      map.invalidateSize(false);
      map.setView([pos.lat, pos.lon], LOCAL_ZOOM, { animate: false });
      return true;
    }

    if (zone === 'tuscany') return fit(map, TUSCANY_BOUNDS, 10, [16, 16]);

    if (zone.startsWith('province:')) {
      const code = zone.split(':')[1];
      const points = provinceBounds(app, code);
      if (!points) return false;
      return fit(map, points, code === 'PO' ? 12 : 11, [18, 18]);
    }

    if (zone.startsWith('quick:')) {
      const q = QUICK[zone.split(':')[1]];
      return q ? fit(map, q.bounds, q.maxZoom, [18, 18]) : false;
    }

    // In Libera keep the user's current center, but start one level closer
    // when the mode is selected from another preset.
    if (zone === 'free') {
      map.invalidateSize(false);
      if (map.getZoom() < 15) map.setZoom(map.getZoom() + 1, { animate: false });
      return true;
    }

    return false;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('zoneSelect');
    select?.addEventListener('change', () => setTimeout(applyZoneZoom, 100));
    window.addEventListener('carburanti:location', () => setTimeout(applyZoneZoom, 50));

    let checks = 0;
    const timer = setInterval(() => {
      checks += 1;
      if (window.CarburantiApp?.state?.loaded && applyZoneZoom()) clearInterval(timer);
      else if (checks >= 80) clearInterval(timer);
    }, 100);
  });
})();
