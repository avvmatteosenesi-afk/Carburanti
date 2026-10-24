(() => {
  'use strict';

  const MAP_ID = 'tripMap';
  let lastTouchAt = 0;
  let tripMap = null;

  // Registra in modo affidabile la mappa Viaggio quando Leaflet la crea.
  // Il precedente tentativo di ricavarla scandendo le proprietà del DIV non è
  // affidabile su Leaflet/iOS perché l'istanza Map non viene esposta lì.
  try {
    if (window.L?.Map?.addInitHook) {
      L.Map.addInitHook(function () {
        try {
          if (this?._container?.id === MAP_ID) {
            tripMap = this;
            window.__carburantiTripMap = this;
          }
        } catch (_) {}
      });
    }
  } catch (_) {}

  function findTripMap(container) {
    if (!container || !window.L) return null;
    const known = tripMap || window.__carburantiTripMap;
    if (known && known._container === container) return known;
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

  function markerFromIcon(map, icon) {
    if (!map || !icon) return null;
    let marker = null;
    try {
      for (const layer of Object.values(map._layers || {})) {
        if (marker || typeof layer?.getLatLng !== 'function') continue;
        if ((layer.getElement?.() || layer._icon) === icon) marker = layer;
      }
    } catch (_) {}
    return marker;
  }

  function centerOnMarker(target) {
    const container = document.getElementById(MAP_ID);
    if (!container) return;
    const icon = target && target.closest ? target.closest('.leaflet-marker-icon') : null;
    if (!icon || !container.contains(icon) || !icon.querySelector?.('.price-marker')) return;

    const map = findTripMap(container);
    if (!map) return;

    const marker = markerFromIcon(map, icon);
    if (!marker) return;

    const latlng = marker.getLatLng?.();
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
    let opened = false;
    const open = () => {
      if (opened) return;
      opened = true;
      try { marker.openPopup(); } catch (_) {}
      requestAnimationFrame(() => protectPopup(map, marker.getPopup?.()));
    };

    try { map.stop(); } catch (_) {}
    try { map.once('moveend', open); } catch (_) {}

    try {
      // Il distributore selezionato deve diventare il centro geometrico della
      // mappa Viaggio. setView è più affidabile di panBy su Safari/iOS.
      map.setView(latlng, zoom, { animate: true });
    } catch (_) {
      try { map.setView(latlng, zoom, { animate: false }); } catch (_) {}
    }

    // Fallback se moveend non viene emesso (es. punto già centrato).
    setTimeout(open, 420);
  }

  function attachPopupProtection() {
    const container = document.getElementById(MAP_ID);
    const map = findTripMap(container);
    if (!map) return false;
    if (map.__tripPopupProtection) return true;
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
      attachPopupProtection();
    }, 250);
    window.addEventListener('beforeunload', () => clearInterval(timer), { once: true });
  });

  document.addEventListener('touchend', event => {
    const container = document.getElementById(MAP_ID);
    if (!container || !container.contains(event.target)) return;
    if (event.target.closest?.('.leaflet-popup')) return;
    if (!event.target.closest?.('.price-marker-wrap, .price-marker, .leaflet-marker-icon')) return;
    const markerIcon = event.target.closest?.('.leaflet-marker-icon');
    if (!markerIcon?.querySelector?.('.price-marker')) return;
    lastTouchAt = Date.now();
    centerOnMarker(event.target);
  }, { passive: true, capture: true });

  document.addEventListener('click', event => {
    const container = document.getElementById(MAP_ID);
    if (!container || !container.contains(event.target)) return;
    if (event.target.closest?.('.leaflet-popup')) return;
    if (!event.target.closest?.('.price-marker-wrap, .price-marker, .leaflet-marker-icon')) return;
    const markerIcon = event.target.closest?.('.leaflet-marker-icon');
    if (!markerIcon?.querySelector?.('.price-marker')) return;
    if (Date.now() - lastTouchAt < 500) return;
    centerOnMarker(event.target);
  }, true);
})();
