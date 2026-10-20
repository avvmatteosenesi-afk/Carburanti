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

  function markerFromIcon(icon) {
    return icon?.__carburantiMarker || null;
  }

  function activate(icon, ev) {
    const marker = markerFromIcon(icon);
    if (!marker?.getPopup?.()) return;
    if (ev?.cancelable) ev.preventDefault();
    ev?.stopPropagation?.();
    marker.openPopup();
  }

  if (window.L?.Marker) {
    const proto = L.Marker.prototype;
    if (!proto.__carburantiDirectPopupV7) {
      const originalOnAdd = proto.onAdd;
      proto.onAdd = function(map) {
        const result = originalOnAdd.call(this, map);
        const icon = this.getElement?.() || this._icon;
        if (!icon?.classList?.contains('price-marker-wrap') || !this.getPopup?.()) return result;

        icon.__carburantiMarker = this;
        icon.style.pointerEvents = 'auto';
        icon.style.touchAction = 'manipulation';
        icon.style.cursor = 'pointer';
        icon.setAttribute('role', 'button');
        icon.setAttribute('tabindex', '0');
        icon.setAttribute('aria-label', `Prezzo carburante ${icon.textContent?.trim() || ''}. Apri dettagli distributore`);

        // Bind directly to every Leaflet marker. This avoids ambiguous hit-testing
        // when price labels overlap: the visually topmost marker receives the tap.
        if (!icon.__carburantiBoundV7) {
          icon.__carburantiBoundV7 = true;
          let touchHandledAt = 0;
          icon.addEventListener('touchend', ev => {
            touchHandledAt = Date.now();
            activate(icon, ev);
          }, { passive: false });
          icon.addEventListener('pointerup', ev => {
            if (ev.pointerType === 'touch') return;
            activate(icon, ev);
          }, { passive: false });
          icon.addEventListener('click', ev => {
            if (Date.now() - touchHandledAt < 600) {
              ev.preventDefault(); ev.stopPropagation(); return;
            }
            activate(icon, ev);
          }, false);
          icon.addEventListener('keydown', ev => {
            if (ev.key === 'Enter' || ev.key === ' ') activate(icon, ev);
          });
        }
        setTimeout(recolorHomeMarkers, 0);
        return result;
      };
      proto.__carburantiDirectPopupV7 = true;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('zoneSelect')?.addEventListener('change', () => setTimeout(recolorHomeMarkers, 50));
    const best = document.getElementById('bestPrice');
    if (best) new MutationObserver(() => setTimeout(recolorHomeMarkers, 0)).observe(best, { childList: true, subtree: true });
    setTimeout(recolorHomeMarkers, 700);
  });
})();
