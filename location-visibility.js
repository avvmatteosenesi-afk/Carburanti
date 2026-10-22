(() => {
  'use strict';

  function appReady() {
    return window.CarburantiApp?.state?.map && window.CarburantiApp?.state?.loaded;
  }

  function emphasizeUserPane() {
    const app = window.CarburantiApp;
    const pane = app?.state?.map?.getPane?.('userPane');
    if (pane) pane.style.zIndex = '700';
  }

  function ensureLocation() {
    const app = window.CarburantiApp;
    if (!appReady()) return false;
    emphasizeUserPane();
    if (!app.getUserPosition?.() && !app.state.locating) app.locateUser?.(false, { quiet: true });
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
      const app = window.CarburantiApp;
      const zone = document.getElementById('zoneSelect')?.value;
      if (zone === 'position') {
        const pos = app?.getUserPosition?.();
        if (pos && Number.isFinite(pos.lat) && Number.isFinite(pos.lon)) {
          app.state.programmaticMove = true;
          app.state.map.invalidateSize(false);
          app.state.map.setView([pos.lat, pos.lon], 13, { animate: false });
        }
      }
    });

    document.getElementById('zoneSelect')?.addEventListener('change', () => {
      setTimeout(() => {
        emphasizeUserPane();
        const app = window.CarburantiApp;
        if (!app?.getUserPosition?.() && !app?.state?.locating) app?.locateUser?.(false, { quiet: true });
      }, 120);
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) setTimeout(ensureLocation, 100);
    });
  });
})();