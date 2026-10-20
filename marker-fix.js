(() => {
  'use strict';

  if (!window.L?.Marker || L.Marker.prototype.__carburantiEarlyTapFix) return;

  const proto = L.Marker.prototype;
  const originalOnAdd = proto.onAdd;

  proto.onAdd = function(map) {
    const result = originalOnAdd.call(this, map);
    const marker = this;
    const icon = marker._icon;
    if (!icon || icon.__carburantiEarlyTapBound) return result;
    icon.__carburantiEarlyTapBound = true;

    const isPriceMarker = () => icon.classList.contains('price-marker-wrap') || !!icon.querySelector('.price-marker');
    const activate = ev => {
      if (!isPriceMarker() || !marker.getPopup?.()) return;
      const now = Date.now();
      if (marker.__carburantiTapAt && now - marker.__carburantiTapAt < 300) return;
      marker.__carburantiTapAt = now;
      if (ev.cancelable) ev.preventDefault();
      ev.stopPropagation();
      try {
        marker.openPopup();
        setTimeout(() => {
          document.querySelectorAll('.leaflet-popup-content a[href*="google.com/maps"]').forEach(a => {
            a.textContent = 'Apri in Google Maps';
            a.classList.add('google-maps-btn');
            a.target = '_blank';
            a.rel = 'noopener';
          });
        }, 0);
      } catch (_) {}
    };

    icon.style.pointerEvents = 'auto';
    icon.style.touchAction = 'manipulation';
    icon.setAttribute('role', 'button');
    icon.setAttribute('tabindex', '0');
    icon.setAttribute('aria-label', 'Apri distributore e indicazioni');
    icon.addEventListener('pointerup', activate, true);
    icon.addEventListener('touchend', activate, { capture: true, passive: false });
    icon.addEventListener('click', activate, true);
    icon.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' || ev.key === ' ') activate(ev);
    }, true);
    return result;
  };

  proto.__carburantiEarlyTapFix = true;
})();
