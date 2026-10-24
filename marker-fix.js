(() => {
  'use strict';

  let suppressClickUntil = 0;
  let centerToken = 0;

  function protectPopup(popup) {
    const root = popup?.getElement?.();
    if (!root || root.__carburantiProtectedV26) return;
    root.__carburantiProtectedV26 = true;
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

  function markerId(marker) {
    const registry = window.CarburantiApp?.state?.markerById;
    if (!registry?.entries) return null;
    const found = Array.from(registry.entries()).find(([, m]) => m === marker);
    return found ? found[0] : null;
  }

  function isCentered(map, latlng) {
    try {
      const c = map.getCenter();
      return Math.abs(c.lat - latlng.lat) < 1e-7 && Math.abs(c.lng - latlng.lng) < 1e-7;
    } catch (_) {
      return false;
    }
  }

  function openMarkerById(id, fallbackMarker) {
    const state = window.CarburantiApp?.state;
    const marker = id && state?.markerById?.get ? (state.markerById.get(id) || fallbackMarker) : fallbackMarker;
    if (!marker) return;
    const popup = preparePopup(marker);
    try { marker._map?.closePopup(); } catch (_) {}
    marker.openPopup();
    protectPopup(popup);
  }

  function centerThenOpen(marker) {
    const app = window.CarburantiApp;
    const state = app?.state;
    const map = marker?._map || state?.map;
    const latlng = marker?.getLatLng?.();
    if (!map || !latlng) {
      openMarkerById(markerId(marker), marker);
      return;
    }

    const id = markerId(marker);
    const token = ++centerToken;
    const zoom = map.getZoom();

    // Esegui il movimento dopo che Leaflet ha terminato pointerup/touchend.
    setTimeout(() => {
      if (token !== centerToken) return;
      try { map.stop(); } catch (_) {}
      if (state) state.programmaticMove = true;
      try { map.setView(latlng, zoom, { animate: false, reset: true }); } catch (_) {}

      // Su iOS un gesto appena concluso può ancora applicare inerzia: verifica e
      // ribadisci il centro una volta, poi apri il popup sul marker rigenerato.
      setTimeout(() => {
        if (token !== centerToken) return;
        try { map.stop(); } catch (_) {}
        if (!isCentered(map, latlng)) {
          if (state) state.programmaticMove = true;
          try { map.setView(latlng, zoom, { animate: false, reset: true }); } catch (_) {}
        }
        requestAnimationFrame(() => {
          if (token !== centerToken) return;
          openMarkerById(id, marker);
        });
      }, 70);
    }, 0);
  }

  function openFromPriceElement(target, ev) {
    const marker = markerForElement(target);
    if (!marker) return false;
    if (ev?.cancelable) ev.preventDefault();
    ev?.stopPropagation?.();
    ev?.stopImmediatePropagation?.();
    suppressClickUntil = Date.now() + 1400;
    centerThenOpen(marker);
    return true;
  }

  function prepareAllMarkers() {
    const registry = window.CarburantiApp?.state?.markerById;
    if (!registry?.values) return;
    for (const marker of registry.values()) preparePopup(marker);
  }

  function attachToMap() {
    const map = window.CarburantiApp?.state?.map;
    if (!map) return false;
    map.options.closePopupOnClick = false;
    const popupPane = map.getPane?.('popupPane');
    if (popupPane) {
      popupPane.style.zIndex = '1000';
      popupPane.style.pointerEvents = 'auto';
    }
    const stationPane = map.getPane?.('stationPane');
    if (stationPane) stationPane.style.pointerEvents = 'auto';
    const userPane = map.getPane?.('userPane');
    if (userPane) {
      userPane.style.zIndex = '800';
      userPane.style.pointerEvents = 'none';
    }
    if (!map.__carburantiPopupV26) {
      map.__carburantiPopupV26 = true;
      map.on('popupopen', e => protectPopup(e.popup));
    }
    return true;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    const refresh = () => {
      attachToMap();
      prepareAllMarkers();
    };
    const timer = setInterval(refresh, 250);
    window.addEventListener('beforeunload', () => clearInterval(timer), { once: true });

    const observer = new MutationObserver(refresh);
    observer.observe(mapEl, { childList: true, subtree: true });
    window.addEventListener('carburanti:location', () => {
      requestAnimationFrame(refresh);
      setTimeout(refresh, 100);
      setTimeout(refresh, 350);
    });
    document.getElementById('zoneSelect')?.addEventListener('change', () => {
      requestAnimationFrame(refresh);
      setTimeout(refresh, 100);
      setTimeout(refresh, 350);
    });

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