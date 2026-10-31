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

  function centerOnUser(zoom = 14) {
    const app = window.CarburantiApp;
    const pos = app?.getUserPosition?.();
    const map = app?.state?.map;
    if (!pos || !map || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lon)) return false;
    app.state.programmaticMove = true;
    map.invalidateSize(false);
    map.setView([pos.lat, pos.lon], zoom, { animate: false });
    requestAnimationFrame(() => {
      map.invalidateSize(false);
      map.panTo([pos.lat, pos.lon], { animate: false });
      redrawUserDot();
    });
    setTimeout(() => {
      map.invalidateSize(false);
      map.panTo([pos.lat, pos.lon], { animate: false });
      redrawUserDot();
    }, 180);
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
      const zone = document.getElementById('zoneSelect')?.value;
      if (zone === 'position') centerOnUser(14);
    });

    document.getElementById('zoneSelect')?.addEventListener('change', () => {
      setTimeout(() => {
        emphasizeUserPane();
        const app = window.CarburantiApp;
        const zone = document.getElementById('zoneSelect')?.value;
        if (app?.getUserPosition?.()) {
          redrawUserDot();
          if (zone === 'position') centerOnUser(14);
        } else if (!app?.state?.locating) app?.locateUser?.(false, { quiet: true });
      }, 120);
    });

    document.getElementById('locateBtn')?.addEventListener('click', () => {
      setTimeout(() => {
        const app = window.CarburantiApp;
        if (app?.getUserPosition?.()) centerOnUser(14);
      }, 220);
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) setTimeout(ensureLocation, 100);
    });
  });
})();