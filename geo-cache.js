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

  navigator.geolocation.getCurrentPosition = (success, error, options) => {
    const forceFresh = window.__carburantiForceFreshGeo === true;
    if (forceFresh) window.__carburantiForceFreshGeo = false;

    // All'avvio riutilizza per pochi secondi l'ultima posizione già autorizzata:
    // niente nuova richiesta/lampeggio. Un tap su "Mia posizione" forza invece il GPS.
    if (!forceFresh && Date.now() < startupUntil) {
      setTimeout(() => {
        try { success?.(cachedPosition()); } catch (_) {}
      }, 0);
      return;
    }

    return realGetCurrentPosition(success, error, options);
  };
})();
