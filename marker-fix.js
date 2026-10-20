(() => {
  'use strict';

  if (!window.L?.Marker) return;

  const proto = L.Marker.prototype;
  if (proto.__carburantiDirectPopupV4) return;
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

    if (icon.__carburantiPopupBound) return result;
    icon.__carburantiPopupBound = true;
    const marker = this;
    let lastOpen = 0;
    const open = ev => {
      const now = Date.now();
      if (now - lastOpen < 250) return;
      lastOpen = now;
      if (ev?.cancelable) ev.preventDefault();
      ev?.stopPropagation?.();
      L.DomEvent.stopPropagation(ev);
      marker.openPopup();
    };

    icon.addEventListener('pointerup', open, { passive: false });
    icon.addEventListener('touchend', open, { passive: false });
    icon.addEventListener('click', open, false);
    icon.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' || ev.key === ' ') open(ev);
    });
    return result;
  };

  proto.__carburantiDirectPopupV4 = true;
})();
