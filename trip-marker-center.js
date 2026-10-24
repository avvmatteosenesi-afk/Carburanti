(() => {
  'use strict';

  const MAP_ID = 'tripMap';
  let lastTouchAt = 0;

  function findTripMap(container) {
    if (!container || !window.L) return null;
    for (const key of Object.keys(container)) {
      const value = container[key];
      if (value && typeof value.getCenter === 'function' && typeof value.setView === 'function' && value._container === container) return value;
    }
    return null;
  }

  function protectPopup(map, popup) {
    const root = popup?.getElement?.();
    if (!root) return;
    root.style.pointerEvents = 'auto';
    try { L.DomEvent.disableClickPropagation(root); } catch (_) {}
    try { L.DomEvent.disableScrollPropagation(root); } catch (_) {}

    let close = root.querySelector('.leaflet-popup-close-button');
    if (!close) {
      close = document.createElement('button');
      close.type = 'button';
      close.className = 'leaflet-popup-close-button trip-popup-close';
      root.appendChild(close);
    }
    close.classList.add('trip-popup-close');
    close.textContent = '×';
    close.setAttribute('aria-label', 'Chiudi popup');
    close.setAttribute('title', 'Chiudi');
    close.style.pointerEvents = 'auto';
    close.style.touchAction = 'manipulation';
    close.style.zIndex = '20';

    if (!close.__tripCloseBound) {
      close.__tripCloseBound = true;
      ['pointerdown','pointerup','touchstart','touchend','mousedown','mouseup'].forEach(type => {
        close.addEventListener(type, ev => ev.stopPropagation(), { passive: true });
      });
      close.addEventListener('click', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation?.();
        try { map.closePopup(popup); } catch (_) { try { map.closePopup(); } catch (_) {} }
      });
    }

    root.querySelectorAll('a').forEach(link => {
      link.style.pointerEvents = 'auto';
      link.style.touchAction = 'manipulation';
      if (link.__tripProtected) return;
      link.__tripProtected = true;
      ['pointerdown','pointerup','touchstart','touchend','mousedown','mouseup','click'].forEach(type => {
        link.addEventListener(type, ev => ev.stopPropagation());
      });
    });
  }

  function centerOnMarker(target) {
    const container = document.getElementById(MAP_ID);
    if (!container) return;
    const icon = target && target.closest ? target.closest('.leaflet-marker-icon') : null;
    if (!icon || !container.contains(icon)) return;

    const map = findTripMap(container);
    if (!map) return;

    let marker = null;
    map.eachLayer(layer => {
      if (marker || typeof layer?.getLatLng !== 'function' || typeof layer?.getElement !== 'function') return;
      if ((layer.getElement?.() || layer._icon) === icon) marker = layer;
    });
    if (!marker) return;

    const latlng = marker.getLatLng();
    if (!latlng || !Number.isFinite(latlng.lat) || !Number.isFinite(latlng.lng)) return;

    const popup = marker.getPopup?.();
    if (popup) {
      popup.options.autoPan = false;
      popup.options.keepInView = false;
      popup.options.closeOnClick = false;
      popup.options.closeButton = true;
    }
    map.options.closePopupOnClick = false;

    const zoom = Math.min(Math.max(map.getZoom(), 15), map.getMaxZoom());
    try { map.stop(); } catch (_) {}
    map.setView(latlng, zoom, { animate: true });

    const open = () => {
      try { marker.openPopup(); } catch (_) {}
      requestAnimationFrame(() => protectPopup(map, marker.getPopup?.()));
    };
    try { map.once('moveend', open); } catch (_) {}
    setTimeout(open, 360);
  }

  function attachPopupProtection() {
    const container = document.getElementById(MAP_ID);
    const map = findTripMap(container);
    if (!map || map.__tripPopupProtection) return false;
    map.__tripPopupProtection = true;
    map.options.closePopupOnClick = false;
    const pane = map.getPane?.('popupPane');
    if (pane) {
      pane.style.zIndex = '1000';
      pane.style.pointerEvents = 'auto';
    }
    map.on('popupopen', event => protectPopup(map, event.popup));
    return true;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const timer = setInterval(() => {
      if (attachPopupProtection()) clearInterval(timer);
    }, 200);
    setTimeout(() => clearInterval(timer), 30000);
  });

  document.addEventListener('touchend', event => {
    const container = document.getElementById(MAP_ID);
    if (!container || !container.contains(event.target)) return;
    if (event.target.closest?.('.leaflet-popup')) return;
    if (!event.target.closest?.('.price-marker-wrap, .price-marker')) return;
    lastTouchAt = Date.now();
    centerOnMarker(event.target);
  }, { passive: true, capture: true });

  document.addEventListener('click', event => {
    const container = document.getElementById(MAP_ID);
    if (!container || !container.contains(event.target)) return;
    if (event.target.closest?.('.leaflet-popup')) return;
    if (!event.target.closest?.('.price-marker-wrap, .price-marker')) return;
    if (Date.now() - lastTouchAt < 500) return;
    centerOnMarker(event.target);
  }, true);
})();