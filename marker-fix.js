(() => {
  'use strict';

  function markerForIcon(icon) {
    if (!icon || !window.L) return null;
    const leafletId = icon._leaflet_id || L.Util.stamp(icon);
    const homeMap = window.CarburantiApp?.state?.map;
    const tripMap = window.CarburantiTrip?.map;
    return homeMap?._targets?.[leafletId] || tripMap?._targets?.[leafletId] || null;
  }

  function activate(target, ev) {
    const icon = target?.closest?.('.price-marker-wrap');
    if (!icon) return;
    const marker = markerForIcon(icon);
    if (!marker?.getPopup?.()) return;
    const now = Date.now();
    if (marker.__carburantiTapAt && now - marker.__carburantiTapAt < 300) return;
    marker.__carburantiTapAt = now;
    if (ev?.cancelable) ev.preventDefault();
    ev?.stopPropagation?.();
    try { marker.openPopup(); } catch (_) {}
  }

  function bind(container) {
    if (!container || container.__carburantiDelegatedTap) return;
    container.__carburantiDelegatedTap = true;
    const handler = ev => activate(ev.target, ev);
    container.addEventListener('pointerup', handler, true);
    container.addEventListener('touchend', handler, { capture: true, passive: false });
    container.addEventListener('click', handler, true);
  }

  function bindAll() {
    bind(document.getElementById('map'));
    bind(document.getElementById('tripMap'));
  }

  document.addEventListener('DOMContentLoaded', bindAll);
  window.addEventListener('load', bindAll);
  setTimeout(bindAll, 1000);
})();
