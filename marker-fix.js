(() => {
  'use strict';

  // Leaflet normally auto-pans when a popup opens. In this app every map
  // moveend rebuilds all fuel markers, so auto-pan destroys the marker that
  // owns the popup and makes the popup flash closed. Disable popup auto-pan
  // globally before app.js creates any marker popups.
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

  // Let the popup's real anchor perform navigation itself. This keeps every
  // tap inside the iOS user gesture and avoids the touchend/click double-fire
  // that made only the first Google Maps navigation work in the PWA.
  function preparePopupLink(target) {
    const link = target?.closest?.('.leaflet-popup a');
    if (!link) return false;
    link.removeAttribute('target');
    link.removeAttribute('rel');
    return true;
  }

  document.addEventListener('touchstart', ev => {
    preparePopupLink(ev.target);
  }, { capture: true, passive: true });

  document.addEventListener('pointerdown', ev => {
    preparePopupLink(ev.target);
  }, true);

  document.addEventListener('click', ev => {
    preparePopupLink(ev.target);
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

    // Consume iOS's synthetic click generated after our handled marker touchend.
    // Popup links are explicitly excluded so their native navigation is never blocked.
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