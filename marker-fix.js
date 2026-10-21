(() => {
  'use strict';

  const markerRegistry = new Map();
  let sequence = 0;

  function registerMarker(marker) {
    const icon = marker?.getElement?.() || marker?._icon;
    if (!icon || !icon.classList?.contains('price-marker-wrap') || !marker.getPopup?.()) return;
    let id = icon.dataset.carburantiMarkerId;
    if (!id) {
      id = `fuel-${++sequence}`;
      icon.dataset.carburantiMarkerId = id;
    }
    markerRegistry.set(id, marker);
    icon.style.pointerEvents = 'auto';
    icon.style.touchAction = 'manipulation';
    icon.style.cursor = 'pointer';
    icon.setAttribute('role', 'button');
    icon.setAttribute('tabindex', '0');
  }

  function markerFromTarget(target) {
    const icon = target?.closest?.('.price-marker-wrap');
    if (!icon) return null;
    return markerRegistry.get(icon.dataset.carburantiMarkerId) || null;
  }

  function activate(ev) {
    const marker = markerFromTarget(ev.target);
    if (!marker) return;
    if (ev.type === 'keydown' && ev.key !== 'Enter' && ev.key !== ' ') return;

    // Important: open only on the final click, never on touchstart/pointerdown.
    // Opening at gesture start and then letting Leaflet receive the generated click
    // toggled the same popup closed again on iOS.
    if (ev.cancelable) ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation?.();
    try { marker.openPopup(); } catch (_) {}
  }

  function installActivation() {
    if (document.__carburantiActivationV11) return;
    document.__carburantiActivationV11 = true;
    document.addEventListener('click', activate, true);
    document.addEventListener('keydown', activate, true);
  }

  function installRegistration() {
    if (!window.L?.Marker) return;
    const proto = L.Marker.prototype;
    if (proto.__carburantiRegistrationV11) return;
    const originalOnAdd = proto.onAdd;
    const originalOnRemove = proto.onRemove;
    proto.onAdd = function(map) {
      const result = originalOnAdd.call(this, map);
      registerMarker(this);
      return result;
    };
    proto.onRemove = function(map) {
      const icon = this.getElement?.() || this._icon;
      const id = icon?.dataset?.carburantiMarkerId;
      if (id) markerRegistry.delete(id);
      return originalOnRemove.call(this, map);
    };
    proto.__carburantiRegistrationV11 = true;
  }

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

  installActivation();
  installRegistration();
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('zoneSelect')?.addEventListener('change', () => setTimeout(recolorHomeMarkers, 50));
    const best = document.getElementById('bestPrice');
    if (best) new MutationObserver(() => setTimeout(recolorHomeMarkers, 0)).observe(best, { childList: true, subtree: true });
    setTimeout(recolorHomeMarkers, 700);
  });
})();
