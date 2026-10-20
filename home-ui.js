(() => {
  'use strict';

  function recenterCurrentPosition() {
    const app = window.CarburantiApp;
    const state = app?.state;
    const map = state?.map;
    const current = app?.getUserPosition?.();
    const zone = document.getElementById('zoneSelect');

    if (state) {
      state.zone = 'position';
      state.locating = false;
      state.programmaticMove = true;
    }
    if (zone) zone.value = 'position';
    document.getElementById('freeModeBadge')?.classList.add('hidden');

    // Risposta immediata: torna subito sull'ultima posizione valida, se disponibile.
    if (map && current && Number.isFinite(current.lat) && Number.isFinite(current.lon)) {
      try {
        map.invalidateSize(false);
        map.setView([current.lat, current.lon], 13, { animate: true });
      } catch (_) {}
      setTimeout(() => {
        try { document.querySelector('.fuel-tab.active')?.click(); } catch (_) {}
      }, 80);
    }

    const notice = document.getElementById('mapNotice');
    if (notice) {
      notice.textContent = 'Aggiorno la posizione…';
      notice.classList.remove('hidden');
    }

    // Poi richiede una posizione nuova al telefono e ricentra di nuovo sul risultato.
    try {
      app?.locateUser?.(true);
    } catch (_) {}
  }

  function enhanceHome() {
    const tripBtn = document.getElementById('tripOpenBtn');
    const topbar = document.querySelector('.topbar');
    const controls = document.querySelector('.controls-card');
    const mapCard = document.querySelector('.map-card');
    const stats = document.querySelector('.stats-grid');
    const locateBtn = document.getElementById('locateBtn');

    if (tripBtn && topbar && controls) {
      tripBtn.className = 'trip-cta';
      tripBtn.setAttribute('aria-label', 'Viaggio: cerca distributori lungo un percorso');
      tripBtn.title = 'Cerca distributori e prezzi lungo un percorso specifico';
      tripBtn.innerHTML = `
        <span class="trip-cta-icon" aria-hidden="true">↗</span>
        <span class="trip-cta-copy">
          <strong>Viaggio</strong>
          <small>Cerca distributori e prezzi lungo un percorso specifico</small>
        </span>
        <span class="trip-cta-arrow" aria-hidden="true">›</span>`;
      topbar.insertAdjacentElement('afterend', tripBtn);
    }

    if (stats && mapCard) {
      stats.classList.remove('bottom-stats');
      stats.classList.add('map-stats');
      mapCard.appendChild(stats);
    }

    if (locateBtn) {
      locateBtn.textContent = '⌖ Mia posizione';
      locateBtn.setAttribute('aria-label', 'Verifica e torna alla mia posizione');
      locateBtn.title = 'Verifica la posizione corrente e ricentra la mappa';
      locateBtn.addEventListener('click', ev => {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        recenterCurrentPosition();
      }, true);
    }

    // Leaflet può aver calcolato la dimensione prima dello spostamento degli elementi.
    setTimeout(() => {
      try { window.CarburantiApp?.state?.map?.invalidateSize(false); } catch (_) {}
    }, 80);
  }

  document.addEventListener('DOMContentLoaded', enhanceHome);
})();
