(() => {
  'use strict';

  function parsePrice(text) {
    const n = Number(String(text || '').replace(',', '.').replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  function recolorHomeMarkers() {
    const min = parsePrice(document.getElementById('bestPrice')?.textContent);
    if (!Number.isFinite(min)) return;
    const zone = document.getElementById('zoneSelect')?.value || '';
    const wide = zone.startsWith('province:') || zone === 'tuscany';
    const nearLimit = wide ? 0.1005 : 0.0505;
    const goodLimit = wide ? 0.2005 : 0.1005;
    document.querySelectorAll('#map .price-marker').forEach(el => {
      const price = parsePrice(el.textContent);
      if (!Number.isFinite(price)) return;
      const d = price - min;
      const cls = d <= 0.0005 ? 'best' : d <= nearLimit ? 'near' : d <= goodLimit ? 'good' : 'normal';
      ['best','near','good','normal'].forEach(c => el.classList.toggle(c, c === cls));
    });
  }

  function findLeafletMarker(icon) {
    const map = window.__carburantiMap || null;
    if (map?._layers) {
      for (const layer of Object.values(map._layers)) {
        if (layer instanceof L.Marker && (layer.getElement?.() === icon || layer._icon === icon)) return layer;
      }
    }
    for (const key of Object.keys(icon || {})) {
      const value = icon[key];
      if (value instanceof L.Marker) return value;
    }
    return null;
  }

  function openFromTarget(target, ev) {
    const icon = target?.closest?.('.price-marker-wrap');
    if (!icon || !icon.closest('#map')) return;
    const marker = findLeafletMarker(icon);
    if (!marker?.getPopup?.()) return;
    if (ev?.cancelable) ev.preventDefault();
    ev?.stopPropagation?.();
    marker.openPopup();
  }

  // Capture before Leaflet's map handlers. This is intentionally delegated so it
  // survives every renderStations()/clearLayers() cycle and works in iOS PWAs.
  ['pointerup', 'touchend', 'click'].forEach(type => {
    document.addEventListener(type, ev => openFromTarget(ev.target, ev), { capture: true, passive: false });
  });

  if (window.L?.Marker) {
    const proto = L.Marker.prototype;
    if (!proto.__carburantiDirectPopupV6) {
      const originalOnAdd = proto.onAdd;
      proto.onAdd = function(map) {
        const result = originalOnAdd.call(this, map);
        const icon = this.getElement?.() || this._icon;
        if (icon?.classList?.contains('price-marker-wrap') && this.getPopup?.()) {
          icon.style.pointerEvents = 'auto';
          icon.style.touchAction = 'manipulation';
          icon.style.cursor = 'pointer';
          icon.__carburantiMarker = this;
          icon.setAttribute('role', 'button');
          icon.setAttribute('tabindex', '0');
          icon.setAttribute('aria-label', `Prezzo carburante ${icon.textContent?.trim() || ''}. Apri dettagli distributore`);
          icon.addEventListener('keydown', ev => {
            if (ev.key === 'Enter' || ev.key === ' ') {
              ev.preventDefault();
              this.openPopup();
            }
          });
        }
        setTimeout(recolorHomeMarkers, 0);
        return result;
      };
      proto.__carburantiDirectPopupV6 = true;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('zoneSelect')?.addEventListener('change', () => setTimeout(recolorHomeMarkers, 50));
    const best = document.getElementById('bestPrice');
    if (best) new MutationObserver(() => setTimeout(recolorHomeMarkers, 0)).observe(best, { childList: true, subtree: true });
    setTimeout(recolorHomeMarkers, 700);
  });
})();
