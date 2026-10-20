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

    // Questo tap è esplicito: forza un nuovo rilevamento GPS, senza usare la cache iniziale.
    window.__carburantiForceFreshGeo = true;
    try {
      app?.locateUser?.(true);
    } catch (_) {
      window.__carburantiForceFreshGeo = false;
    }
  }

  function enhanceHome() {
    const tripBtn = document.getElementById('tripOpenBtn');
    const topbar = document.querySelector('.topbar');
    const topActions = document.querySelector('.top-actions');
    const mapCard = document.querySelector('.map-card');
    const stats = document.querySelector('.stats-grid');
    const locateBtn = document.getElementById('locateBtn');

    if (tripBtn && topbar && topActions) {
      tripBtn.className = 'trip-top-btn';
      tripBtn.setAttribute('aria-label', 'Viaggio: cerca distributori lungo un percorso');
      tripBtn.title = 'Cerca distributori e prezzi lungo un percorso specifico';
      tripBtn.innerHTML = `
        <span class="trip-top-icon" aria-hidden="true">↗</span>
        <span class="trip-top-copy"><strong>Viaggio</strong><small>Percorso</small></span>`;
      if (tripBtn.parentElement !== topActions) topActions.insertBefore(tripBtn, topActions.firstChild);
    }

    if (stats && mapCard) {
      stats.classList.remove('bottom-stats');
      stats.classList.add('map-stats');
      if (stats.parentElement !== mapCard) mapCard.appendChild(stats);
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

    setTimeout(() => {
      try { window.CarburantiApp?.state?.map?.invalidateSize(false); } catch (_) {}
    }, 80);
  }

  document.addEventListener('DOMContentLoaded', enhanceHome);
})();
