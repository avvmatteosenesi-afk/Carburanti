(() => {
  'use strict';

  const LOCAL_ZOOM = 13;
  const TUSCANY_BOUNDS = [[42.20, 9.72], [44.53, 12.22]];

  const QUICK = {
    'pistoia-firenze': { bounds: [[43.71, 10.82], [43.99, 11.34]], maxZoom: 10 },
    'pistoia-prato': { bounds: [[43.82, 10.82], [44.00, 11.18]], maxZoom: 11 },
    'prato-firenze': { bounds: [[43.70, 11.02], [43.94, 11.35]], maxZoom: 11 },
    'pistoia-agliana': { bounds: [[43.86, 10.84], [43.98, 11.02]], maxZoom: 12 },
    'agliana-prato': { bounds: [[43.84, 10.96], [43.93, 11.14]], maxZoom: 12 }
  };

  function fit(map, bounds, maxZoom, padding = [28, 28]) {
    const b = L.latLngBounds(bounds);
    if (!b.isValid()) return false;
    map.invalidateSize(false);
    map.fitBounds(b, { padding, maxZoom, animate: false });
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

    if (zone === 'tuscany') return fit(map, TUSCANY_BOUNDS, 9, [24, 24]);

    if (zone.startsWith('province:')) {
      const code = zone.split(':')[1];
      const points = provinceBounds(app, code);
      if (!points) return false;
      return fit(map, points, code === 'PO' ? 11 : 10, [34, 34]);
    }

    if (zone.startsWith('quick:')) {
      const q = QUICK[zone.split(':')[1]];
      return q ? fit(map, q.bounds, q.maxZoom, [30, 30]) : false;
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
