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

  function googleHref(link) {
    const href = link?.href || link?.getAttribute?.('href') || '';
    try {
      const u = new URL(href, location.href);
      const destination = u.searchParams.get('destination');
      if (destination) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
    } catch (_) {}
    return href;
  }

  // Handle the Google Maps action at document capture level, before Leaflet
  // receives the gesture. On iOS/PWA the navigation must happen directly in
  // the user gesture; waiting for a later synthetic click is unreliable.
  function handlePopupNavigation(ev) {
    const link = ev.target?.closest?.('.leaflet-popup a');
    if (!link) return false;
    const href = googleHref(link);
    if (!href) return false;
    stop(ev);
    window.location.assign(href);
    return true;
  }

  document.addEventListener('touchend', ev => {
    if (handlePopupNavigation(ev)) return;
  }, { capture: true, passive: false });

  document.addEventListener('pointerup', ev => {
    if (ev.pointerType !== 'touch') handlePopupNavigation(ev);
  }, { capture: true, passive: false });

  document.addEventListener('click', ev => {
    if (handlePopupNavigation(ev)) return;
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

    // Consume iOS's synthetic click generated after our handled touchend.
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