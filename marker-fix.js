(() => {
  'use strict';

  let suppressClickUntil = 0;

  function protectPopup(popup) {
    const root = popup?.getElement?.();
    if (!root || root.__carburantiProtectedV21) return;
    root.__carburantiProtectedV21 = true;
    root.style.pointerEvents = 'auto';
    try { L.DomEvent.disableClickPropagation(root); } catch (_) {}
    try { L.DomEvent.disableScrollPropagation(root); } catch (_) {}
    root.querySelectorAll('a').forEach(link => {
      link.style.pointerEvents = 'auto';
      link.style.touchAction = 'manipulation';
      ['pointerdown','pointerup','touchstart','touchend','mousedown','mouseup','click'].forEach(type => {
        link.addEventListener(type, ev => ev.stopPropagation());
      });
    });
  }

  function openFromPriceElement(target, ev) {
    const price = target?.closest?.('.price-marker');
    if (!price) return false;
    const wrap = price.closest('.leaflet-marker-icon');
    if (!wrap) return false;
    const registry = window.CarburantiApp?.state?.markerById;
    if (!registry?.values) return false;
    const marker = Array.from(registry.values()).find(m => (m.getElement?.() || m._icon) === wrap);
    if (!marker) return false;

    if (ev?.cancelable) ev.preventDefault();
    ev?.stopPropagation?.();
    ev?.stopImmediatePropagation?.();
    suppressClickUntil = Date.now() + 1200;

    // Open synchronously on the actual price marker. No nearest-marker fallback,
    // no delayed timer and no second Leaflet tap is allowed to toggle it closed.
    try { marker._map?.closePopup(); } catch (_) {}
    marker.openPopup();
    protectPopup(marker.getPopup?.());
    return true;
  }

  function attachToMap() {
    const map = window.CarburantiApp?.state?.map;
    if (!map || map.__carburantiPopupV21) return Boolean(map);
    map.__carburantiPopupV21 = true;
    map.options.closePopupOnClick = false;
    const popupPane = map.getPane?.('popupPane');
    if (popupPane) {
      popupPane.style.zIndex = '1000';
      popupPane.style.pointerEvents = 'auto';
    }
    const stationPane = map.getPane?.('stationPane');
    if (stationPane) stationPane.style.pointerEvents = 'auto';
    const userPane = map.getPane?.('userPane');
    if (userPane) userPane.style.zIndex = '500';
    map.on('popupopen', e => protectPopup(e.popup));
    return true;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    let tries = 0;
    const timer = setInterval(() => {
      if (attachToMap() || ++tries > 100) clearInterval(timer);
    }, 100);

    // iOS Safari/PWA: pointerup is the authoritative single-tap event.
    mapEl.addEventListener('pointerup', ev => {
      if (ev.target?.closest?.('.leaflet-popup')) return;
      openFromPriceElement(ev.target, ev);
    }, { capture: true, passive: false });

    // Fallback for older WebKit without reliable Pointer Events.
    mapEl.addEventListener('touchend', ev => {
      if (ev.target?.closest?.('.leaflet-popup')) return;
      openFromPriceElement(ev.target, ev);
    }, { capture: true, passive: false });

    // Swallow the compatibility click generated after the touch/pointer event.
    mapEl.addEventListener('click', ev => {
      if (ev.target?.closest?.('.leaflet-popup')) return;
      if (Date.now() < suppressClickUntil) {
        if (ev.cancelable) ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation?.();
        return;
      }
      openFromPriceElement(ev.target, ev);
    }, true);
  });
})();