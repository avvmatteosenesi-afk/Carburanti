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

  function popupAtPoint(x, y) {
    const popup = document.querySelector('.leaflet-popup');
    if (!popup) return null;
    const r = popup.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom ? popup : null;
  }

  function mapsLinkAtPoint(x, y) {
    const link = document.querySelector('.leaflet-popup a');
    if (!link) return null;
    const r = link.getBoundingClientRect();
    const pad = 14;
    return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad ? link : null;
  }

  function googleDestination(link) {
    try {
      return new URL(link.href, location.href).searchParams.get('destination');
    } catch (_) {
      return null;
    }
  }

  function navigateGoogleMaps(link, ev) {
    const destination = googleDestination(link);
    if (!destination) return false;
    stop(ev);
    // HTTPS Google Maps directions URL is the reliable iOS/PWA hand-off.
    // The real problem was the map stealing the popup touch before the anchor
    // received it; coordinate hit-testing above prevents that.
    window.location.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
    return true;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    // Popup pane must sit above marker/map hit targets and accept touch input.
    const popupPane = document.querySelector('.leaflet-popup-pane');
    if (popupPane) {
      popupPane.style.zIndex = '900';
      popupPane.style.pointerEvents = 'auto';
    }

    mapEl.addEventListener('touchstart', ev => {
      const t = ev.changedTouches?.[0];
      if (!t) return;
      if (popupAtPoint(t.clientX, t.clientY)) {
        touchStart = null;
        // Do not let Leaflet start a map gesture underneath an open popup.
        ev.stopPropagation();
        return;
      }
      touchStart = { x: t.clientX, y: t.clientY };
    }, { capture: true, passive: true });

    mapEl.addEventListener('touchend', ev => {
      const t = ev.changedTouches?.[0];
      if (!t) return;

      const link = mapsLinkAtPoint(t.clientX, t.clientY);
      if (link) {
        touchStart = null;
        navigateGoogleMaps(link, ev);
        return;
      }

      if (popupAtPoint(t.clientX, t.clientY)) {
        touchStart = null;
        stop(ev);
        return;
      }

      if (!touchStart) return;
      const moved = Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y);
      touchStart = null;
      if (moved > 14) return;
      const marker = nearest(t.clientX, t.clientY);
      if (marker) open(marker, ev);
    }, { capture: true, passive: false });

    mapEl.addEventListener('click', ev => {
      const link = ev.target?.closest?.('.leaflet-popup a');
      if (link) {
        navigateGoogleMaps(link, ev);
        return;
      }
      if (ev.target?.closest?.('.leaflet-popup')) {
        stop(ev);
        return;
      }
      if (Date.now() - lastTouchAt < 1200) {
        stop(ev);
        return;
      }
      const marker = nearest(ev.clientX, ev.clientY);
      if (marker) open(marker, ev);
    }, true);
  });
})();