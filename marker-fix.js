(() => {
  'use strict';

  function openPriceMarker(target, ev) {
    const icon = target?.closest?.('.price-marker-wrap');
    if (!icon) return false;
    const markerId = icon.dataset.stationId;
    const app = window.CarburantiApp;
    const marker = markerId && app?.state?.markerById?.get?.(String(markerId));
    if (!marker) return false;
    if (ev?.cancelable) ev.preventDefault();
    ev?.stopPropagation?.();
    try { marker.openPopup(); } catch (_) { return false; }
    return true;
  }

  function bindDelegation() {
    const map = document.getElementById('map');
    if (!map || map.__carburantiDelegatedTap) return;
    map.__carburantiDelegatedTap = true;
    const handler = ev => openPriceMarker(ev.target, ev);
    map.addEventListener('click', handler, true);
    map.addEventListener('pointerup', handler, true);
    map.addEventListener('touchend', handler, { capture: true, passive: false });
  }

  function patchDivIcon() {
    if (!window.L?.Marker || L.Marker.prototype.__carburantiStationIdPatch) return;
    const proto = L.Marker.prototype;
    const originalOnAdd = proto.onAdd;
    proto.onAdd = function(map) {
      const result = originalOnAdd.call(this, map);
      const icon = this._icon;
      if (icon && (icon.classList.contains('price-marker-wrap') || icon.querySelector('.price-marker'))) {
        const app = window.CarburantiApp;
        const entries = app?.state?.markerById;
        if (entries) {
          for (const [id, marker] of entries.entries()) {
            if (marker === this) { icon.dataset.stationId = id; break; }
          }
        }
        icon.style.pointerEvents = 'auto';
        icon.style.touchAction = 'manipulation';
      }
      return result;
    };
    proto.__carburantiStationIdPatch = true;
  }

  patchDivIcon();
  document.addEventListener('DOMContentLoaded', bindDelegation);
  window.addEventListener('load', bindDelegation);
})();
