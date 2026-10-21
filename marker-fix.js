(() => {
  'use strict';

  if (window.L?.Popup?.prototype?.options) {
    L.Popup.prototype.options.autoPan = false;
  }

  const HIT_RADIUS = 40;
  let touchStart = null;
  let lastTouchAt = 0;

  function stop(ev) {
    if (ev?.cancelable) ev.preventDefault();
    ev?.stopPropagation?.();
    ev?.stopImmediatePropagation?.();
  }

  function markers() {
    const registry = window.CarburantiApp?.state?.markerById;
    return registry?.values ? Array.from(registry.values()).filter(m => m?._map && m.getPopup?.()) : [];
  }

  function nearest(x, y) {
    let found = null;
    let distance = Infinity;
    for (const marker of markers()) {
      const icon = marker.getElement?.() || marker._icon;
      if (!icon) continue;
      const r = icon.getBoundingClientRect();
      const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
      if (d < distance) { distance = d; found = marker; }
    }
    return distance <= HIT_RADIUS ? found : null;
  }

  function open(marker, ev) {
    if (!marker) return;
    stop(ev);
    lastTouchAt = Date.now();
    marker.openPopup();
  }

  function googleDestination(link) {
    try {
      return new URL(link.href, location.href).searchParams.get('destination');
    } catch (_) {
      return null;
    }
  }

  function openGoogleMaps(ev) {
    const link = ev.target?.closest?.('.leaflet-popup a');
    if (!link) return false;
    const destination = googleDestination(link);
    if (!destination) return false;
    stop(ev);
    // Direct Google Maps iOS URL scheme: avoids standalone-PWA handling of
    // universal HTTPS links, which can remain trapped in the web app.
    window.location.href = `comgooglemaps://?daddr=${encodeURIComponent(destination)}&directionsmode=driving`;
    return true;
  }

  document.addEventListener('touchend', ev => {
    openGoogleMaps(ev);
  }, { capture: true, passive: false });

  document.addEventListener('click', ev => {
    openGoogleMaps(ev);
  }, true);

  document.addEventListener('DOMContentLoaded', () => {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    mapEl.addEventListener('touchstart', ev => {
      if (ev.target?.closest?.('.leaflet-popup')) { touchStart = null; return; }
      const t = ev.changedTouches?.[0];
      touchStart = t ? { x: t.clientX, y: t.clientY } : null;
    }, { capture: true, passive: true });

    mapEl.addEventListener('touchend', ev => {
      if (ev.target?.closest?.('.leaflet-popup')) { touchStart = null; return; }
      const t = ev.changedTouches?.[0];
      if (!t || !touchStart) return;
      const moved = Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y);
      touchStart = null;
      if (moved > 14) return;
      const marker = nearest(t.clientX, t.clientY);
      if (marker) open(marker, ev);
    }, { capture: true, passive: false });

    mapEl.addEventListener('click', ev => {
      if (ev.target?.closest?.('.leaflet-popup')) return;
      if (Date.now() - lastTouchAt < 1200) {
        stop(ev);
        return;
      }
      const marker = nearest(ev.clientX, ev.clientY);
      if (marker) open(marker, ev);
    }, true);
  });
})();