(() => {
  'use strict';

  const HIT_RADIUS = 40;
  let touchStart = null;
  let lastTouchAt = 0;
  let openTimer = null;

  function isPopupTarget(target) {
    return Boolean(target?.closest?.('.leaflet-popup'));
  }

  function stopMapEvent(ev) {
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

  function openMarker(marker, ev) {
    if (!marker) return;
    stopMapEvent(ev);
    lastTouchAt = Date.now();

    // On iOS/Leaflet the same physical tap can still finish Leaflet's internal
    // close cycle after our capture listener. Open only after that event cycle:
    // this prevents the first tap from opening and immediately closing the popup.
    if (openTimer) clearTimeout(openTimer);
    openTimer = setTimeout(() => {
      if (!marker?._map) return;
      marker.openPopup();
      protectPopup(marker.getPopup?.());
      openTimer = null;
    }, 0);
  }

  function protectPopup(popup) {
    const root = popup?.getElement?.();
    if (!root || root.__carburantiProtectedV19) return;
    root.__carburantiProtectedV19 = true;
    root.style.pointerEvents = 'auto';
    root.style.zIndex = '1';
    try { L.DomEvent.disableClickPropagation(root); } catch (_) {}
    try { L.DomEvent.disableScrollPropagation(root); } catch (_) {}

    root.querySelectorAll('a').forEach(link => {
      link.style.pointerEvents = 'auto';
      link.style.touchAction = 'manipulation';
      ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'click'].forEach(type => {
        link.addEventListener(type, ev => ev.stopPropagation(), { passive: true });
      });
    });
  }

  function attachToMap() {
    const appMap = window.CarburantiApp?.state?.map;
    if (!appMap || appMap.__carburantiPopupV19) return Boolean(appMap);
    appMap.__carburantiPopupV19 = true;

    const popupPane = appMap.getPane?.('popupPane');
    if (popupPane) {
      popupPane.style.zIndex = '1000';
      popupPane.style.pointerEvents = 'auto';
    }
    const userPane = appMap.getPane?.('userPane');
    if (userPane) userPane.style.zIndex = '500';

    appMap.on('popupopen', ev => {
      const pane = appMap.getPane?.('popupPane');
      if (pane) {
        pane.style.zIndex = '1000';
        pane.style.pointerEvents = 'auto';
      }
      protectPopup(ev.popup);
    });
    return true;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    let tries = 0;
    const attachTimer = setInterval(() => {
      if (attachToMap() || ++tries > 40) clearInterval(attachTimer);
    }, 100);

    mapEl.addEventListener('touchstart', ev => {
      if (isPopupTarget(ev.target)) { touchStart = null; return; }
      const t = ev.changedTouches?.[0];
      touchStart = t ? { x: t.clientX, y: t.clientY } : null;
    }, { capture: true, passive: true });

    mapEl.addEventListener('touchend', ev => {
      if (isPopupTarget(ev.target)) { touchStart = null; return; }
      const t = ev.changedTouches?.[0];
      if (!t || !touchStart) return;
      const moved = Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y);
      touchStart = null;
      if (moved > 14) return;
      const marker = nearest(t.clientX, t.clientY);
      if (marker) openMarker(marker, ev);
    }, { capture: true, passive: false });

    mapEl.addEventListener('click', ev => {
      if (isPopupTarget(ev.target)) return;
      // iOS emits a synthetic click after touchend. Swallow it completely;
      // the deferred open above happens after Leaflet has finished the tap cycle.
      if (Date.now() - lastTouchAt < 1200) {
        stopMapEvent(ev);
        return;
      }
      const marker = nearest(ev.clientX, ev.clientY);
      if (marker) openMarker(marker, ev);
    }, true);
  });
})();