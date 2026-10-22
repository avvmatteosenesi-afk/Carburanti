(() => {
  'use strict';

  function appReady() {
    return window.CarburantiApp?.state?.map && window.CarburantiApp?.state?.loaded;
  }

  function emphasizeUserPane() {
    const app = window.CarburantiApp;
    const pane = app?.state?.map?.getPane?.('userPane');
    if (pane) {
      pane.style.zIndex = '900';
      pane.style.pointerEvents = 'none';
    }
  }

  function redrawUserDot() {
    const app = window.CarburantiApp;
    const pos = app?.getUserPosition?.();
    const layer = app?.state?.userLayer;
    if (!pos || !layer || !window.L) return false;

    layer.clearLayers();
    const icon = L.divIcon({
      className: '',
      html: '<div class="user-location"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    L.marker([pos.lat, pos.lon], {
      pane: 'userPane',
      icon,
      zIndexOffset: 10000,
      interactive: false
    }).addTo(layer);
    L.circle([pos.lat, pos.lon], {
      pane: 'userPane',
      radius: 10000,
      interactive: false,
      weight: 1,
      opacity: 0.38,
      fillOpacity: 0.025
    }).addTo(layer);
    emphasizeUserPane();
    return true;
  }

  function ensureLocation() {
    const app = window.CarburantiApp;
    if (!appReady()) return false;
    emphasizeUserPane();
    if (app.getUserPosition?.()) {
      redrawUserDot();
    } else if (!app.state.locating) {
      app.locateUser?.(false, { quiet: true });
    }
    return true;
  }

  document.addEventListener('DOMContentLoaded', () => {
    let checks = 0;
    const timer = setInterval(() => {
      checks += 1;
      if (ensureLocation() || checks > 100) clearInterval(timer);
    }, 100);

    window.addEventListener('carburanti:location', () => {
      emphasizeUserPane();
      redrawUserDot();
      const app = window.CarburantiApp;
      const zone = document.getElementById('zoneSelect')?.value;
      if (zone === 'position') {
        const pos = app?.getUserPosition?.();
        if (pos && Number.isFinite(pos.lat) && Number.isFinite(pos.lon)) {
          app.state.programmaticMove = true;
          app.state.map.invalidateSize(false);
          app.state.map.setView([pos.lat, pos.lon], 13, { animate: false });
          setTimeout(redrawUserDot, 50);
          setTimeout(redrawUserDot, 300);
        }
      }
    });

    document.getElementById('zoneSelect')?.addEventListener('change', () => {
      setTimeout(() => {
        emphasizeUserPane();
        const app = window.CarburantiApp;
        if (app?.getUserPosition?.()) redrawUserDot();
        else if (!app?.state?.locating) app?.locateUser?.(false, { quiet: true });
      }, 120);
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) setTimeout(ensureLocation, 100);
    });
  });
})();