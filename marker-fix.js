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

  // Leaflet divIcon wrappers are the actual interactive elements. Make the whole
  // rendered price label the hit target and open the marker popup directly.
  function bindMarker(marker) {
    const icon = marker?.getElement?.() || marker?._icon;
    if (!icon || !marker.getPopup?.() || icon.__carburantiTapV9) return;
    icon.__carburantiTapV9 = true;
    icon.__carburantiMarker = marker;
    icon.style.pointerEvents = 'auto';
    icon.style.touchAction = 'manipulation';
    icon.style.cursor = 'pointer';
    icon.setAttribute('role', 'button');
    icon.setAttribute('tabindex', '0');

    const open = ev => {
      if (ev?.type === 'keydown' && ev.key !== 'Enter' && ev.key !== ' ') return;
      if (ev?.cancelable) ev.preventDefault();
      ev?.stopPropagation?.();
      marker.openPopup();
    };
    icon.addEventListener('click', open, false);
    icon.addEventListener('keydown', open, false);
  }

  if (window.L?.Marker) {
    const proto = L.Marker.prototype;
    if (!proto.__carburantiTapPatchV9) {
      const originalOnAdd = proto.onAdd;
      proto.onAdd = function(map) {
        const result = originalOnAdd.call(this, map);
        if ((this.getElement?.() || this._icon)?.classList?.contains('price-marker-wrap')) {
          requestAnimationFrame(() => bindMarker(this));
        }
        return result;
      };
      proto.__carburantiTapPatchV9 = true;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('zoneSelect')?.addEventListener('change', () => setTimeout(recolorHomeMarkers, 50));
    const best = document.getElementById('bestPrice');
    if (best) new MutationObserver(() => setTimeout(recolorHomeMarkers, 0)).observe(best, { childList: true, subtree: true });
    setTimeout(recolorHomeMarkers, 700);
  });
})();
