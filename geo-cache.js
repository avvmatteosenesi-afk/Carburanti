(() => {
  'use strict';

  const CONSENT_KEY = 'carburanti:geo-consent:v3';
  const POSITION_KEY = 'carburanti:last-position:v1';
  const MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const STARTUP_CACHE_MS = 8000;

  let saved = null;
  try {
    if (localStorage.getItem(CONSENT_KEY) === '1') {
      const parsed = JSON.parse(localStorage.getItem(POSITION_KEY) || 'null');
      if (parsed && Number.isFinite(parsed.lat) && Number.isFinite(parsed.lon) &&
          Number.isFinite(parsed.savedAt) && Date.now() - parsed.savedAt <= MAX_AGE_MS) {
        saved = parsed;
      }
    }
  } catch (_) {}

  if (!saved || !navigator.geolocation || typeof navigator.geolocation.getCurrentPosition !== 'function') return;

  const realGetCurrentPosition = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
  const startupUntil = Date.now() + STARTUP_CACHE_MS;

  function cachedPosition() {
    return {
      coords: {
        latitude: saved.lat,
        longitude: saved.lon,
        accuracy: Number(saved.accuracy) || 100,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null
      },
      timestamp: saved.savedAt
    };
  }

  navigator.geolocation.getCurrentPosition = (success, error, options = {}) => {
    const forceFresh = window.__carburantiForceFreshGeo === true;
    if (forceFresh) window.__carburantiForceFreshGeo = false;

    // maximumAge: 0 significa esplicitamente "posizione fresca". In questo caso
    // non deve mai intervenire la cache d'avvio: il core usa già l'ultima
    // posizione come anteprima e poi deve sostituirla con il GPS reale.
    const explicitlyFresh = Number(options.maximumAge) === 0;
    if (forceFresh || explicitlyFresh || Date.now() >= startupUntil) {
      return realGetCurrentPosition(success, error, options);
    }

    // Solo chiamate che ammettono una posizione in cache possono ricevere per
    // pochi secondi l'ultima posizione autorizzata, evitando lampeggi all'avvio.
    setTimeout(() => {
      try { success?.(cachedPosition()); } catch (_) {}
    }, 0);
  };
})();
