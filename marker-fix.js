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

  function markerFromElement(target) {
    const icon = target?.closest?.('.price-marker-wrap');
    if (!icon) return null;
    return markerRegistry.get(icon.dataset.carburantiMarkerId) || null;
  }

  function markerNearPoint(x, y) {
    const direct = document.elementFromPoint(x, y);
    const directMarker = markerFromElement(direct);
    if (directMarker) return directMarker;

    let best = null;
    let bestDistance = 42;
    document.querySelectorAll('#map .price-marker-wrap').forEach(icon => {
      const r = icon.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const d = Math.hypot(cx - x, cy - y);
      if (d < bestDistance) {
        const marker = markerRegistry.get(icon.dataset.carburantiMarkerId);
        if (marker) { best = marker; bestDistance = d; }
      }
    });
    return best;
  }

  function openMarker(marker, ev) {
    if (!marker) return false;
    if (ev?.cancelable) ev.preventDefault();
    ev?.stopPropagation?.();
    ev?.stopImmediatePropagation?.();
    try {
      marker.openPopup();
      const map = marker._map;
      if (map) map.panInside(marker.getLatLng(), { padding: [45, 90], animate: true });
      return true;
    } catch (_) { return false; }
  }

  function onClick(ev) {
    const marker = markerFromElement(ev.target) || markerNearPoint(ev.clientX, ev.clientY);
    openMarker(marker, ev);
  }

  function onTouchEnd(ev) {
    const t = ev.changedTouches?.[0];
    if (!t) return;
    const marker = markerFromElement(ev.target) || markerNearPoint(t.clientX, t.clientY);
    if (!marker) return;
    openMarker(marker, ev);
    window.__carburantiLastTouch = Date.now();
  }

  function onPointerUp(ev) {
    if (ev.pointerType === 'touch') return;
    const marker = markerFromElement(ev.target) || markerNearPoint(ev.clientX, ev.clientY);
    openMarker(marker, ev);
  }

  function onKeyDown(ev) {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    openMarker(markerFromElement(ev.target), ev);
  }

  function installActivation() {
    if (document.__carburantiActivationV12) return;
    document.__carburantiActivationV12 = true;
    document.addEventListener('touchend', onTouchEnd, { capture: true, passive: false });
    document.addEventListener('click', ev => {
      if (Date.now() - (window.__carburantiLastTouch || 0) < 650) {
        const marker = markerFromElement(ev.target);
        if (marker) { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation?.(); }
        return;
      }
      onClick(ev);
    }, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('keydown', onKeyDown, true);
  }

  function installRegistration() {
    if (!window.L?.Marker) return;
    const proto = L.Marker.prototype;
    if (proto.__carburantiRegistrationV12) return;
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
    proto.__carburantiRegistrationV12 = true;
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
    document.getElementById('zoneSelect')?.addEventListener('change', () => setTimeout(recolorHomeMarkers, 80));
    const best = document.getElementById('bestPrice');
    if (best) new MutationObserver(() => setTimeout(recolorHomeMarkers, 0)).observe(best, { childList: true, subtree: true });
    setTimeout(recolorHomeMarkers, 700);
  });
})();
