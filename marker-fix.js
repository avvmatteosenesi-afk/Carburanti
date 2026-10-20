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
    const spans = document.querySelectorAll('.controls-card .legend span');
    if (spans[1]) spans[1].lastChild.textContent = wide ? ' entro 10 cent' : ' entro 5 cent';
    if (spans[2]) spans[2].lastChild.textContent = wide ? ' entro 20 cent' : ' entro 10 cent';
  }

  if (window.L?.Marker) {
    const proto = L.Marker.prototype;
    if (!proto.__carburantiDirectPopupV5) {
      const originalOnAdd = proto.onAdd;
      proto.onAdd = function(map) {
        const result = originalOnAdd.call(this, map);
        const icon = this.getElement?.() || this._icon;
        if (!icon || !icon.classList?.contains('price-marker-wrap') || !this.getPopup?.()) return result;
        icon.style.pointerEvents = 'auto';
        icon.style.touchAction = 'manipulation';
        icon.setAttribute('role', 'button');
        icon.setAttribute('tabindex', '0');
        icon.setAttribute('aria-label', `Prezzo carburante ${icon.textContent?.trim() || ''}. Apri dettagli distributore`);
        if (!icon.__carburantiPopupBound) {
          icon.__carburantiPopupBound = true;
          const marker = this;
          let lastOpen = 0;
          const open = ev => {
            const now = Date.now();
            if (now - lastOpen < 250) return;
            lastOpen = now;
            if (ev?.cancelable) ev.preventDefault();
            ev?.stopPropagation?.();
            marker.openPopup();
          };
          icon.addEventListener('pointerup', open, { passive: false });
          icon.addEventListener('touchend', open, { passive: false });
          icon.addEventListener('click', open, false);
          icon.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') open(ev); });
        }
        setTimeout(recolorHomeMarkers, 0);
        return result;
      };
      proto.__carburantiDirectPopupV5 = true;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('zoneSelect')?.addEventListener('change', () => setTimeout(recolorHomeMarkers, 50));
    const best = document.getElementById('bestPrice');
    if (best) new MutationObserver(() => setTimeout(recolorHomeMarkers, 0)).observe(best, { childList: true, subtree: true });
    setTimeout(recolorHomeMarkers, 700);
  });
})();
