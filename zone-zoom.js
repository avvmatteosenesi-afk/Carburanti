(() => {
  'use strict';

  const LOCAL_ZOOM = 14;
  const TUSCANY_BOUNDS = [[42.20, 9.72], [44.53, 12.22]];

  const PROVINCES = {
    AR: { center:[43.46,11.88], zoom:10 },
    FI: { center:[43.78,11.25], zoom:10 },
    GR: { center:[42.76,11.11], zoom:9 },
    LI: { center:[43.30,10.49], zoom:9 },
    LU: { center:[44.03,10.50], zoom:10 },
    MS: { center:[44.12,10.05], zoom:10 },
    PI: { center:[43.55,10.68], zoom:10 },
    PO: { center:[43.89,11.10], zoom:11 },
    PT: { center:[43.97,10.86], zoom:10 },
    SI: { center:[43.20,11.40], zoom:9 }
  };

  const QUICK = {
    'pistoia-firenze': { bounds: [[43.71, 10.82], [43.99, 11.34]], maxZoom: 11 },
    'pistoia-prato': { bounds: [[43.82, 10.82], [44.00, 11.18]], maxZoom: 12 },
    'prato-firenze': { bounds: [[43.70, 11.02], [43.94, 11.35]], maxZoom: 12 },
    'pistoia-agliana': { bounds: [[43.86, 10.84], [43.98, 11.02]], maxZoom: 13 },
    'agliana-prato': { bounds: [[43.84, 10.96], [43.93, 11.14]], maxZoom: 13 }
  };

  function stationBoundsForZone(app, zone) {
    const stations = app?.state?.stations;
    if (!Array.isArray(stations) || !stations.length) return null;
    let list = [];
    if (zone.startsWith('province:')) {
      const code = zone.split(':')[1];
      list = stations.filter(s => s.province === code && Number.isFinite(s.lat) && Number.isFinite(s.lon));
    } else if (zone.startsWith('quick:')) {
      const q = QUICK[zone.split(':')[1]];
      if (!q) return null;
      const area = L.latLngBounds(q.bounds);
      list = stations.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lon) && area.contains([s.lat, s.lon]));
    }
    if (!list.length) return null;
    return L.latLngBounds(list.map(s => [s.lat, s.lon]));
  }

  function fit(map, bounds, maxZoom, padding = [22, 22], tighten = false) {
    const b = L.latLngBounds(bounds);
    if (!b.isValid()) return false;
    map.invalidateSize(false);
    map.fitBounds(b, { padding, maxZoom, animate: false });
    if (tighten && map.getZoom() < maxZoom) map.setZoom(Math.min(maxZoom, map.getZoom() + 1), { animate: false });
    return true;
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

    if (zone === 'tuscany') return fit(map, TUSCANY_BOUNDS, 9, [22,22], false);

    if (zone.startsWith('province:')) {
      const code = zone.split(':')[1];
      const p = PROVINCES[code];
      if (!p) return false;
      const stationBounds = stationBoundsForZone(app, zone);
      if (stationBounds?.isValid()) return fit(map, stationBounds.pad(0.04), p.zoom, [24,24], false);
      map.invalidateSize(false);
      map.setView(p.center, p.zoom, { animate:false });
      return true;
    }

    if (zone.startsWith('quick:')) {
      const q = QUICK[zone.split(':')[1]];
      if (!q) return false;
      const stationBounds = stationBoundsForZone(app, zone);
      return fit(map, stationBounds?.isValid() ? stationBounds.pad(0.06) : q.bounds, q.maxZoom, [24,24], false);
    }

    if (zone === 'free') {
      map.invalidateSize(false);
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