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

  function forceOpen(marker) {
    if (!marker?._map) return;
    const map = marker._map;
    try { map.closePopup(); } catch (_) {}
    marker.openPopup();
    protectPopup(marker.getPopup?.());
  }

  function openMarker(marker, ev) {
    if (!marker) return;
    stopMapEvent(ev);
    lastTouchAt = Date.now();
    if (openTimer) clearTimeout(openTimer);
    // Wait beyond iOS' synthetic-click phase, then open once. With
    // closePopupOnClick=false the map cannot immediately close this popup.
    openTimer = setTimeout(() => {
      forceOpen(marker);
      openTimer = null;
    }, 80);
  }

  function protectPopup(popup) {
    const root = popup?.getElement?.();
    if (!root || root.__carburantiProtectedV20) return;
    root.__carburantiProtectedV20 = true;
    root.style.pointerEvents = 'auto';
    root.style.zIndex = '1';
    try { L.DomEvent.disableClickPropagation(root); } catch (_) {}
    try { L.DomEvent.disableScrollPropagation(root); } catch (_) {}

    root.querySelectorAll('a').forEach(link => {
      link.style.pointerEvents = 'auto';
      link.style.touchAction = 'manipulation';
      ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'mouseup'].forEach(type => {
        link.addEventListener(type, ev => ev.stopPropagation(), { passive: true });
      });
      link.addEventListener('click', ev => ev.stopPropagation());
    });
  }

  function attachToMap() {
    const appMap = window.CarburantiApp?.state?.map;
    if (!appMap || appMap.__carburantiPopupV20) return Boolean(appMap);
    appMap.__carburantiPopupV20 = true;

    // Critical fix: a tap on the map must never close the popup opened by that
    // same physical touch. Popups still auto-close when another marker opens.
    appMap.options.closePopupOnClick = false;

    const popupPane = appMap.getPane?.('popupPane');
    if (popupPane) {
      popupPane.style.zIndex = '1000';
      popupPane.style.pointerEvents = 'auto';
    }
    const userPane = appMap.getPane?.('userPane');
    if (userPane) userPane.style.zIndex = '500';

    appMap.on('popupopen', ev => protectPopup(ev.popup));
    return true;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    let tries = 0;
    const attachTimer = setInterval(() => {
      if (attachToMap() || ++tries > 80) clearInterval(attachTimer);
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
      if (Date.now() - lastTouchAt < 1500) {
        stopMapEvent(ev);
        return;
      }
      const marker = nearest(ev.clientX, ev.clientY);
      if (marker) openMarker(marker, ev);
    }, true);
  });
})();