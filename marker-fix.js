(() => {
  'use strict';

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

  function bindMarker(marker) {
    const icon = marker?.getElement?.() || marker?._icon;
    if (!icon || !icon.classList?.contains('price-marker-wrap') || !marker.getPopup?.()) return;
    if (icon.__carburantiNativeTapV14) return;
    icon.__carburantiNativeTapV14 = true;
    icon.style.pointerEvents = 'auto';
    icon.style.touchAction = 'manipulation';
    icon.style.cursor = 'pointer';
    icon.setAttribute('role', 'button');
    icon.setAttribute('tabindex', '0');
    icon.setAttribute('aria-label', `Apri dettagli distributore, prezzo ${icon.textContent?.trim() || ''}`);
    try { L.DomEvent.disableClickPropagation(icon); } catch (_) {}
    try { L.DomEvent.disableScrollPropagation(icon); } catch (_) {}

    let lastTouch = 0;
    const activate = ev => {
      if (ev.type === 'click' && Date.now() - lastTouch < 700) {
        ev.preventDefault?.(); ev.stopPropagation?.(); return false;
      }
      if (ev.type === 'touchend') lastTouch = Date.now();
      return openMarker(marker, ev);
    };
    icon.addEventListener('touchend', activate, { passive: false });
    icon.addEventListener('click', activate, false);
    icon.addEventListener('pointerup', ev => { if (ev.pointerType !== 'touch') activate(ev); }, false);
    icon.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') activate(ev); });
  }

  function bindAllExistingMarkers() {
    const app = window.CarburantiApp;
    const registry = app?.state?.markerById;
    if (registry?.forEach) registry.forEach(marker => bindMarker(marker));
    const map = app?.state?.map;
    if (map?.eachLayer) map.eachLayer(layer => {
      if (layer instanceof L.Marker) bindMarker(layer);
    });
  }

  function installDirectBinding() {
    if (!window.L?.Marker) return;
    const proto = L.Marker.prototype;
    if (!proto.__carburantiDirectBindingV14) {
      const originalOnAdd = proto.onAdd;
      proto.onAdd = function(map) {
        const result = originalOnAdd.call(this, map);
        bindMarker(this);
        return result;
      };
      proto.__carburantiDirectBindingV14 = true;
    }
    // app.js creates many markers after marker-fix.js has loaded. Re-scan the
    // actual marker registry so every rendered price gets the native handlers,
    // including markers that escaped the onAdd hook during startup/re-render.
    let passes = 0;
    const timer = setInterval(() => {
      bindAllExistingMarkers();
      if (++passes >= 30) clearInterval(timer);
    }, 250);
    document.addEventListener('click', () => setTimeout(bindAllExistingMarkers, 0), true);
    document.getElementById('zoneSelect')?.addEventListener('change', () => setTimeout(bindAllExistingMarkers, 100));
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

  document.addEventListener('DOMContentLoaded', () => {
    installDirectBinding();
    document.getElementById('zoneSelect')?.addEventListener('change', () => setTimeout(recolorHomeMarkers, 80));
    const best = document.getElementById('bestPrice');
    if (best) new MutationObserver(() => {
      setTimeout(recolorHomeMarkers, 0);
      setTimeout(bindAllExistingMarkers, 0);
    }).observe(best, { childList: true, subtree: true });
    setTimeout(recolorHomeMarkers, 700);
    setTimeout(bindAllExistingMarkers, 700);
  });
})();
