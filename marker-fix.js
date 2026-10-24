(() => {
  'use strict';

  let suppressClickUntil = 0;
  let centerToken = 0;
  let lastMarkerTapId = null;
  let lastMarkerTapAt = 0;

  function protectPopup(popup) {
    const root = popup?.getElement?.();
    if (!root || root.__carburantiProtectedV28) return;
    root.__carburantiProtectedV28 = true;
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
    // Il nodo .price-marker ha pointer-events:none nei CSS: su iPhone il tap
    // arriva quindi al wrapper Leaflet esterno. Accetta entrambi i casi.
    const wrap = target?.closest?.('.price-marker-wrap, .leaflet-marker-icon');
    if (!wrap || !wrap.querySelector?.('.price-marker')) return null;
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
      const size = map.getSize();
      const point = map.latLngToContainerPoint(latlng);
      const cx = size.x / 2;
      const cy = size.y / 2;
      return Math.abs(point.x - cx) <= 1 && Math.abs(point.y - cy) <= 1;
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
    const state = window.CarburantiApp?.state;
    const map = marker?._map || state?.map;
    const latlng = marker?.getLatLng?.();
    if (!map || !latlng) {
      openMarkerById(markerId(marker), marker);
      return;
    }

    const id = markerId(marker);
    const token = ++centerToken;
    const wasLoaded = state?.loaded;
    const zoom = map.getZoom();
    let finalized = false;

    const finalize = () => {
      if (finalized || token !== centerToken) return;
      finalized = true;
      try { map.stop(); } catch (_) {}

      if (!isCentered(map, latlng)) {
        try {
          if (typeof map._resetView === 'function') map._resetView(latlng, zoom, true);
          else map.setView(latlng, zoom, { animate: false });
        } catch (_) {}
      }

      if (state) {
        state.loaded = wasLoaded;
        state.programmaticMove = false;
      }

      requestAnimationFrame(() => {
        if (token !== centerToken) return;
        openMarkerById(id, marker);
      });
    };

    setTimeout(() => {
      if (token !== centerToken) return;
      try { map.stop(); } catch (_) {}

      if (state) {
        state.loaded = false;
        state.programmaticMove = true;
      }

      try { map.once('moveend', finalize); } catch (_) {}
      try {
        // Sposta esattamente il punto del distributore al centro del riquadro.
        const size = map.getSize();
        const p = map.latLngToContainerPoint(latlng);
        const dx = p.x - size.x / 2;
        const dy = p.y - size.y / 2;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          map.panBy([dx, dy], { animate: true, duration: 0.22, easeLinearity: 0.25 });
        } else {
          finalize();
          return;
        }
      } catch (_) {
        try { map.setView(latlng, zoom, { animate: false }); } catch (_) {}
      }

      setTimeout(finalize, 360);
    }, 0);
  }

  function openFromPriceElement(target, ev) {
    const marker = markerForElement(target);
    if (!marker) return false;
    const id = markerId(marker);
    const now = Date.now();

    if (ev?.cancelable) ev.preventDefault();
    ev?.stopPropagation?.();
    ev?.stopImmediatePropagation?.();

    if (id && id === lastMarkerTapId && now - lastMarkerTapAt < 320) {
      suppressClickUntil = now + 1400;
      return true;
    }
    lastMarkerTapId = id;
    lastMarkerTapAt = now;
    suppressClickUntil = now + 1400;
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
    if (!map.__carburantiPopupV28) {
      map.__carburantiPopupV28 = true;
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