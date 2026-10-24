(() => {
  'use strict';

  let suppressClickUntil = 0;

  function protectPopup(popup) {
    const root = popup?.getElement?.();
    if (!root || root.__carburantiProtectedV25) return;
    root.__carburantiProtectedV25 = true;
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

  function centerOnMarker(marker) {
    const app = window.CarburantiApp;
    const state = app?.state;
    const map = marker?._map || state?.map;
    const latlng = marker?.getLatLng?.();
    if (!map || !latlng) return marker;

    const id = markerId(marker);
    try {
      const center = map.getCenter();
      const needsMove = !center || Math.abs(center.lat - latlng.lat) > 1e-7 || Math.abs(center.lng - latlng.lng) > 1e-7;
      if (needsMove) {
        if (state) state.programmaticMove = true;
        map.setView(latlng, map.getZoom(), { animate: false });
      }
    } catch (_) {}

    return id && state?.markerById?.get ? (state.markerById.get(id) || marker) : marker;
  }

  function openFromPriceElement(target, ev) {
    let marker = markerForElement(target);
    if (!marker) return false;
    if (ev?.cancelable) ev.preventDefault();
    ev?.stopPropagation?.();
    ev?.stopImmediatePropagation?.();
    suppressClickUntil = Date.now() + 1200;

    // Centra prima la mappa sul distributore. Il setView può rigenerare i marker
    // tramite il normale moveend dell'app, quindi recuperiamo poi il marker attivo.
    marker = centerOnMarker(marker);
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
      // Keep the GPS dot above price markers, but never let it steal taps from them.
      userPane.style.zIndex = '800';
      userPane.style.pointerEvents = 'none';
    }
    if (!map.__carburantiPopupV25) {
      map.__carburantiPopupV25 = true;
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