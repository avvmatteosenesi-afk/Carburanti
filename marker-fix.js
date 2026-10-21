(() => {
  'use strict';

  let suppressClickUntil = 0;

  function protectPopup(popup) {
    const root = popup?.getElement?.();
    if (!root || root.__carburantiProtectedV22) return;
    root.__carburantiProtectedV22 = true;
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

  function preparePopup(marker) {
    const popup = marker?.getPopup?.();
    if (!popup) return null;
    // Root cause of the first-tap close: Leaflet auto-pans the map when the
    // popup first opens; map moveend then calls renderStations(), which clears
    // the marker layer and destroys the just-opened popup. The second tap works
    // only because the map has already been panned. Disable that auto-pan.
    popup.options.autoPan = false;
    popup.options.keepInView = false;
    popup.options.closeOnClick = false;
    return popup;
  }

  function markerForElement(target) {
    const price = target?.closest?.('.price-marker');
    if (!price) return null;
    const wrap = price.closest('.leaflet-marker-icon');
    if (!wrap) return null;
    const registry = window.CarburantiApp?.state?.markerById;
    if (!registry?.values) return null;
    return Array.from(registry.values()).find(m => (m.getElement?.() || m._icon) === wrap) || null;
  }

  function openFromPriceElement(target, ev) {
    const marker = markerForElement(target);
    if (!marker) return false;
    if (ev?.cancelable) ev.preventDefault();
    ev?.stopPropagation?.();
    ev?.stopImmediatePropagation?.();
    suppressClickUntil = Date.now() + 1200;

    const popup = preparePopup(marker);
    try { marker._map?.closePopup(); } catch (_) {}
    marker.openPopup();
    protectPopup(popup);
    return true;
  }

  function prepareAllMarkers() {
    const registry = window.CarburantiApp?.state?.markerById;
    if (!registry?.values) return;
    for (const marker of registry.values()) preparePopup(marker);
  }

  function attachToMap() {
    const map = window.CarburantiApp?.state?.map;
    if (!map || map.__carburantiPopupV22) return Boolean(map);
    map.__carburantiPopupV22 = true;
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
      const attached = attachToMap();
      prepareAllMarkers();
      if ((attached && window.CarburantiApp?.state?.loaded) || ++tries > 100) clearInterval(timer);
    }, 100);

    // New markers are recreated after zoom/pan/fuel/zone changes; ensure their
    // popup options are corrected before any native Leaflet click can open them.
    const observer = new MutationObserver(() => prepareAllMarkers());
    observer.observe(mapEl, { childList: true, subtree: true });

    mapEl.addEventListener('pointerdown', ev => {
      const marker = markerForElement(ev.target);
      if (marker) preparePopup(marker);
    }, { capture: true, passive: true });

    mapEl.addEventListener('pointerup', ev => {
      if (ev.target?.closest?.('.leaflet-popup')) return;
      openFromPriceElement(ev.target, ev);
    }, { capture: true, passive: false });

    mapEl.addEventListener('touchstart', ev => {
      const marker = markerForElement(ev.target);
      if (marker) preparePopup(marker);
    }, { capture: true, passive: true });

    mapEl.addEventListener('touchend', ev => {
      if (ev.target?.closest?.('.leaflet-popup')) return;
      openFromPriceElement(ev.target, ev);
    }, { capture: true, passive: false });

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