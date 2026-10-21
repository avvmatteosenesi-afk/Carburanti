(() => {
  'use strict';

  const HIT_RADIUS = 38;
  let touchStart = null;
  let lastTouchOpen = 0;

  function isPopupInteraction(target) {
    return Boolean(target?.closest?.('.leaflet-popup, .leaflet-popup-pane, .leaflet-control'));
  }

  function stopEvent(ev) {
    if (ev?.cancelable) ev.preventDefault();
    ev?.stopPropagation?.();
    ev?.stopImmediatePropagation?.();
  }

  function openMarker(marker, ev) {
    if (!marker?.getPopup?.()) return false;
    stopEvent(ev);
    try {
      // Do not pan the map here. In this app every moveend re-renders all
      // station markers; panInside therefore destroyed the marker whose popup
      // had just opened, producing the first-tap flash/close behaviour.
      marker.openPopup();
      return true;
    } catch (_) { return false; }
  }

  function priceMarkers() {
    const registry = window.CarburantiApp?.state?.markerById;
    if (!registry?.values) return [];
    return Array.from(registry.values()).filter(marker => marker?._map && marker.getPopup?.());
  }

  function nearestMarker(clientX, clientY) {
    let best = null;
    let bestDistance = Infinity;
    for (const marker of priceMarkers()) {
      const icon = marker.getElement?.() || marker._icon;
      if (!icon) continue;
      const r = icon.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const d = Math.hypot(clientX - cx, clientY - cy);
      if (d < bestDistance) { bestDistance = d; best = marker; }
    }
    return bestDistance <= HIT_RADIUS ? best : null;
  }

  function bindMarker(marker) {
    const icon = marker?.getElement?.() || marker?._icon;
    if (!icon || !icon.classList?.contains('price-marker-wrap') || !marker.getPopup?.()) return;
    icon.style.pointerEvents = 'auto';
    icon.style.cursor = 'pointer';
    icon.setAttribute('role', 'button');
    icon.setAttribute('tabindex', '0');
    if (icon.__carburantiTapV19) return;
    icon.__carburantiTapV19 = true;
    icon.addEventListener('click', ev => {
      if (Date.now() - lastTouchOpen < 1000) { stopEvent(ev); return; }
      openMarker(marker, ev);
    }, true);
    icon.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' || ev.key === ' ') openMarker(marker, ev);
    });
  }

  function bindAllMarkers() { priceMarkers().forEach(bindMarker); }

  function googleMapsUrl(link) {
    const href = link?.getAttribute?.('href') || '';
    try {
      const url = new URL(href, location.href);
      const destination = url.searchParams.get('destination');
      if (destination) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
    } catch (_) {}
    return href;
  }

  function popupLinkFromEvent(ev) {
    const link = ev.target?.closest?.('.leaflet-popup a');
    return link || null;
  }

  function navigatePopupLink(ev) {
    const link = popupLinkFromEvent(ev);
    if (!link) return false;
    stopEvent(ev);
    const url = googleMapsUrl(link);
    if (!url) return true;
    // Navigation occurs synchronously inside the user's gesture. This is
    // required by iOS/PWA and avoids Leaflet receiving the event first.
    window.location.assign(url);
    return true;
  }

  function installPopupLinkDelegation() {
    const mapEl = document.getElementById('map');
    if (!mapEl || mapEl.__carburantiPopupLinksV19) return;
    mapEl.__carburantiPopupLinksV19 = true;

    mapEl.addEventListener('touchstart', ev => {
      if (popupLinkFromEvent(ev)) {
        ev.stopPropagation();
        ev.stopImmediatePropagation?.();
      }
    }, { capture: true, passive: true });

    mapEl.addEventListener('touchend', ev => {
      if (navigatePopupLink(ev)) return;
    }, { capture: true, passive: false });

    mapEl.addEventListener('click', ev => {
      if (navigatePopupLink(ev)) return;
    }, true);
  }

  function installMapHitTesting() {
    const mapEl = document.getElementById('map');
    if (!mapEl || mapEl.__carburantiHitTestV19) return;
    mapEl.__carburantiHitTestV19 = true;

    mapEl.addEventListener('touchstart', ev => {
      if (isPopupInteraction(ev.target)) { touchStart = null; return; }
      const t = ev.changedTouches?.[0];
      touchStart = t ? { x: t.clientX, y: t.clientY } : null;
    }, { passive: true, capture: true });

    mapEl.addEventListener('touchend', ev => {
      if (isPopupInteraction(ev.target)) { touchStart = null; return; }
      const t = ev.changedTouches?.[0];
      if (!t || !touchStart) return;
      const moved = Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y);
      touchStart = null;
      if (moved > 14) return;
      const marker = nearestMarker(t.clientX, t.clientY);
      if (!marker) return;
      lastTouchOpen = Date.now();
      openMarker(marker, ev);
    }, { passive: false, capture: true });

    mapEl.addEventListener('click', ev => {
      if (isPopupInteraction(ev.target)) return;
      if (Date.now() - lastTouchOpen < 1000) {
        stopEvent(ev);
        return;
      }
      const marker = nearestMarker(ev.clientX, ev.clientY);
      if (marker) openMarker(marker, ev);
    }, true);
  }

  function installMarkerHook() {
    if (!window.L?.Marker) return;
    const proto = L.Marker.prototype;
    if (proto.__carburantiTapV19) return;
    const originalOnAdd = proto.onAdd;
    proto.onAdd = function(map) {
      const result = originalOnAdd.call(this, map);
      bindMarker(this);
      return result;
    };
    proto.__carburantiTapV19 = true;
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
    installMarkerHook();
    installPopupLinkDelegation();
    installMapHitTesting();
    const refresh = () => setTimeout(() => { bindAllMarkers(); recolorHomeMarkers(); }, 80);
    document.getElementById('zoneSelect')?.addEventListener('change', refresh);
    document.querySelectorAll('.fuel-tab').forEach(btn => btn.addEventListener('click', refresh));
    const best = document.getElementById('bestPrice');
    if (best) new MutationObserver(refresh).observe(best, { childList: true, subtree: true });
    let passes = 0;
    const timer = setInterval(() => {
      bindAllMarkers();
      if (++passes >= 40) clearInterval(timer);
    }, 250);
    setTimeout(recolorHomeMarkers, 700);
  });
})();