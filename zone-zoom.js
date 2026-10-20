(() => {
  'use strict';

  const LOCAL_ZOOM = 13;
  const TUSCANY = { center: [43.42, 11.10], zoom: 9 };

  const PROVINCES = {
    AR: { center: [43.51, 11.765], zoom: 11 },
    FI: { center: [43.805, 11.195], zoom: 10 },
    GR: { center: [42.73, 11.155], zoom: 10 },
    LI: { center: [43.16, 10.21], zoom: 10 },
    LU: { center: [44.00, 10.43], zoom: 11 },
    MS: { center: [44.235, 10.07], zoom: 11 },
    PI: { center: [43.60, 10.63], zoom: 11 },
    PO: { center: [43.96, 11.08], zoom: 12 },
    PT: { center: [43.99, 10.83], zoom: 11 },
    SI: { center: [43.235, 11.31], zoom: 10 }
  };

  const QUICK = {
    'pistoia-firenze': { center: [43.85, 11.08], zoom: 11 },
    'pistoia-prato': { center: [43.91, 11.00], zoom: 12 },
    'prato-firenze': { center: [43.82, 11.185], zoom: 12 },
    'pistoia-agliana': { center: [43.92, 10.93], zoom: 13 },
    'agliana-prato': { center: [43.885, 11.05], zoom: 13 }
  };

  function applyZoneZoom() {
    const app = window.CarburantiApp;
    const map = app?.state?.map;
    const select = document.getElementById('zoneSelect');
    if (!map || !select) return false;

    const zone = select.value;
    let target = null;

    if (zone === 'position') {
      const pos = app.getUserPosition?.();
      if (!pos || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lon)) return false;
      target = { center: [pos.lat, pos.lon], zoom: LOCAL_ZOOM };
    } else if (zone === 'tuscany') {
      target = TUSCANY;
    } else if (zone.startsWith('province:')) {
      target = PROVINCES[zone.split(':')[1]] || null;
    } else if (zone.startsWith('quick:')) {
      target = QUICK[zone.split(':')[1]] || null;
    } else {
      return false;
    }

    if (!target) return false;
    app.state.programmaticMove = true;
    map.invalidateSize(false);
    map.setView(target.center, target.zoom, { animate: false });

    // Un secondo rendering mantiene prezzi e statistiche riferiti alla zona completa.
    setTimeout(() => {
      try { document.querySelector('.fuel-tab.active')?.click(); } catch (_) {}
    }, 40);
    return true;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('zoneSelect');
    select?.addEventListener('change', () => setTimeout(applyZoneZoom, 80));

    window.addEventListener('carburanti:location', () => setTimeout(applyZoneZoom, 40));

    let checks = 0;
    const timer = setInterval(() => {
      checks += 1;
      if (window.CarburantiApp?.state?.loaded && applyZoneZoom()) {
        clearInterval(timer);
      } else if (checks >= 80) {
        clearInterval(timer);
      }
    }, 100);
  });
})();
