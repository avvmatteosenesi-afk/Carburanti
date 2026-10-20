(() => {
  'use strict';

  const GEO_CONSENT_KEY = 'carburanti:geo-consent:v2';
  const LAST_POSITION_KEY = 'carburanti:last-position:v1';
  let nativeGeo = null;
  let geoArmed = false;
  let pendingGeo = null;
  let interceptionActive = false;

  try {
    if (navigator.geolocation && typeof navigator.geolocation.getCurrentPosition === 'function') {
      nativeGeo = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      const queuedGetCurrentPosition = (success, error, options) => {
        const req = { success, error, options };
        if (!geoArmed) {
          pendingGeo = req;
          return;
        }
        return invokeNative(req);
      };
      navigator.geolocation.getCurrentPosition = queuedGetCurrentPosition;
      interceptionActive = navigator.geolocation.getCurrentPosition === queuedGetCurrentPosition;
    }
  } catch (_) {
    nativeGeo = navigator.geolocation?.getCurrentPosition?.bind(navigator.geolocation) || null;
  }

  function rememberConsent() {
    try { localStorage.setItem(GEO_CONSENT_KEY, '1'); } catch (_) {}
  }

  function savePosition(pos) {
    try {
      localStorage.setItem(LAST_POSITION_KEY, JSON.stringify({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        savedAt: Date.now()
      }));
    } catch (_) {}
  }

  function buildUi() {
    if (document.getElementById('geoConsent')) return;
    const style = document.createElement('style');
    style.textContent = `
      .geo-consent-backdrop{position:fixed;inset:0;z-index:5000;background:rgba(20,28,36,.52);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);display:flex;align-items:flex-end;justify-content:center;padding:8px}
      .geo-consent-backdrop.hidden{display:none!important}
      .geo-consent-card{width:min(100%,520px);background:#fff;border-radius:20px;padding:16px;box-shadow:0 15px 50px rgba(0,0,0,.26);display:grid;gap:11px;padding-bottom:max(16px,env(safe-area-inset-bottom));font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#17212b}
      .geo-consent-icon{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;background:#eaf2ff;color:#0d6efd;font-size:1.8rem;font-weight:900;margin:0 auto}
      .geo-consent-card h2{margin:0;text-align:center;font-size:1.25rem}
      .geo-consent-card p{margin:0;text-align:center;color:#5f6b77;font-size:.86rem;line-height:1.42}
      .geo-consent-primary,.geo-consent-secondary{min-height:46px;border-radius:13px;font:inherit;font-weight:800;cursor:pointer}
      .geo-consent-primary{border:0;background:#0d6efd;color:#fff}
      .geo-consent-secondary{border:1px solid #dfe5ea;background:#fff;color:#17212b}
      .geo-consent-note{font-size:.71rem!important;color:#7a8490!important}
      .geo-map-wait{position:absolute;inset:4px;z-index:739;display:grid;place-items:center;border-radius:13px;background:rgba(238,242,245,.88);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);padding:18px}
      .geo-map-wait.hidden{display:none!important}
      .geo-map-wait>div{width:min(100%,360px);background:rgba(255,255,255,.97);border:1px solid #dfe5ea;border-radius:16px;box-shadow:0 8px 24px rgba(22,34,48,.10);padding:15px;text-align:center;color:#52606c;font:700 .84rem/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
    `;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.id = 'geoConsent';
    wrap.className = 'geo-consent-backdrop hidden';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = `
      <section class="geo-consent-card" role="dialog" aria-modal="true" aria-labelledby="geoConsentTitle">
        <div class="geo-consent-icon" aria-hidden="true">⌖</div>
        <h2 id="geoConsentTitle">Usa la tua posizione</h2>
        <p id="geoConsentText">Per mostrarti i distributori entro 10 km, consenti a Carburanti di usare la tua posizione.</p>
        <button id="geoConsentAllow" class="geo-consent-primary" type="button">Consenti posizione</button>
        <button id="geoConsentSkip" class="geo-consent-secondary" type="button">Continua senza posizione</button>
        <p class="geo-consent-note">La posizione viene usata solo per individuare i distributori vicini.</p>
      </section>`;
    document.body.appendChild(wrap);

    const mapCard = document.querySelector('.map-card');
    if (mapCard && !document.getElementById('geoMapWait')) {
      const wait = document.createElement('div');
      wait.id = 'geoMapWait';
      wait.className = 'geo-map-wait hidden';
      wait.innerHTML = '<div id="geoMapWaitText">Autorizza la posizione per vedere i distributori entro 10 km</div>';
      mapCard.appendChild(wait);
    }
  }

  function setWait(text, visible = true) {
    const wait = document.getElementById('geoMapWait');
    const label = document.getElementById('geoMapWaitText');
    if (label && text) label.textContent = text;
    wait?.classList.toggle('hidden', !visible);
  }

  function showPrompt(message, buttonText = 'Consenti posizione') {
    buildUi();
    const wrap = document.getElementById('geoConsent');
    const text = document.getElementById('geoConsentText');
    const allow = document.getElementById('geoConsentAllow');
    if (text && message) text.textContent = message;
    if (allow) {
      allow.disabled = false;
      allow.textContent = buttonText;
    }
    wrap?.classList.remove('hidden');
    wrap?.setAttribute('aria-hidden', 'false');
    setWait('Autorizza la posizione per vedere i distributori entro 10 km', true);
  }

  function closePrompt() {
    const wrap = document.getElementById('geoConsent');
    wrap?.classList.add('hidden');
    wrap?.setAttribute('aria-hidden', 'true');
  }

  function permissionMessage(err) {
    if (err?.code === 1) return 'La posizione è bloccata. Abilita l’accesso alla posizione nelle impostazioni del browser o del telefono, poi tocca “Riprova”.';
    if (err?.code === 2) return 'La posizione non è disponibile. Verifica che i servizi di localizzazione siano attivi e tocca “Riprova”.';
    if (err?.code === 3) return 'Il rilevamento della posizione ha impiegato troppo tempo. Tocca “Riprova”.';
    return 'Non riesco a ottenere la posizione. Tocca “Riprova”.';
  }

  function applyPosition(pos, updateApp = false) {
    rememberConsent();
    savePosition(pos);
    closePrompt();
    setWait('', false);

    if (!updateApp) return;
    const app = window.CarburantiApp;
    if (app?.state) {
      app.state.userPos = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        provisional: false
      };
      app.state.locating = false;
    }

    const zone = document.getElementById('zoneSelect');
    if (zone) {
      zone.value = 'position';
      zone.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function invokeNative(req) {
    if (!nativeGeo) {
      showPrompt('La geolocalizzazione non è disponibile su questo dispositivo.', 'Riprova');
      return;
    }

    const options = { enableHighAccuracy: true, timeout: 30000, maximumAge: 0, ...(req?.options || {}) };
    nativeGeo(pos => {
      const hasAppCallback = typeof req?.success === 'function';
      try { req?.success?.(pos); } catch (_) {}
      applyPosition(pos, !hasAppCallback);
    }, err => {
      try { req?.error?.(err); } catch (_) {}
      if (window.CarburantiApp?.state) window.CarburantiApp.state.locating = false;
      showPrompt(permissionMessage(err), 'Riprova');
      setWait('Posizione necessaria per mostrare i distributori entro 10 km', true);
    }, options);
  }

  function armAndRequest() {
    geoArmed = true;
    const allow = document.getElementById('geoConsentAllow');
    const text = document.getElementById('geoConsentText');
    if (allow) {
      allow.disabled = true;
      allow.textContent = 'Rilevamento…';
    }
    if (text) text.textContent = 'Conferma la richiesta di posizione del browser.';
    setWait('Rilevamento della posizione in corso…', true);

    if (pendingGeo) {
      const req = pendingGeo;
      pendingGeo = null;
      invokeNative(req);
    } else {
      invokeNative({
        success: () => {},
        error: () => {},
        options: { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
      });
    }
  }

  async function permissionState() {
    try {
      if (!navigator.permissions?.query) return 'unknown';
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return result?.state || 'unknown';
    } catch (_) {
      return 'unknown';
    }
  }

  async function prepareGeo() {
    buildUi();
    const zone = document.getElementById('zoneSelect');
    if (!zone || zone.value !== 'position') return;

    const state = await permissionState();
    if (window.CarburantiApp?.getUserPosition?.()) {
      rememberConsent();
      closePrompt();
      setWait('', false);
      return;
    }
    if (state === 'granted') {
      geoArmed = true;
      closePrompt();
      setWait('Rilevamento della posizione in corso…', true);
      if (pendingGeo) {
        const req = pendingGeo;
        pendingGeo = null;
        invokeNative(req);
      }
      return;
    }

    if (state === 'denied') {
      showPrompt('La posizione risulta bloccata. Abilitala nelle impostazioni del browser o del telefono, poi tocca “Riprova”.', 'Riprova');
      return;
    }

    showPrompt('Per mostrarti i distributori entro 10 km, consenti a Carburanti di usare la tua posizione.');
  }

  document.addEventListener('DOMContentLoaded', () => {
    buildUi();

    const allow = document.getElementById('geoConsentAllow');
    const skip = document.getElementById('geoConsentSkip');
    const zone = document.getElementById('zoneSelect');

    allow?.addEventListener('click', armAndRequest);
    skip?.addEventListener('click', () => {
      closePrompt();
      setWait('', false);
      if (pendingGeo?.error) {
        try { pendingGeo.error({ code: 1, message: 'Autorizzazione rinviata' }); } catch (_) {}
      }
      pendingGeo = null;
      if (window.CarburantiApp?.state) window.CarburantiApp.state.locating = false;
      if (zone) {
        zone.value = 'tuscany';
        zone.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    zone?.addEventListener('change', () => {
      if (zone.value === 'position' && !window.CarburantiApp?.getUserPosition?.()) {
        prepareGeo();
      } else {
        closePrompt();
        setWait('', false);
      }
    });

    prepareGeo();

    let positionChecks = 0;
    const positionTimer = setInterval(() => {
      positionChecks += 1;
      if (window.CarburantiApp?.getUserPosition?.()) {
        rememberConsent();
        closePrompt();
        setWait('', false);
        clearInterval(positionTimer);
      } else if (positionChecks >= 60) {
        clearInterval(positionTimer);
      }
    }, 500);

    if (!interceptionActive && zone?.value === 'position') {
      // On browsers where the Geolocation method cannot be wrapped, the explicit
      // button still performs the native request. The overlay prevents a misleading
      // empty map while authorization is pending.
      setWait('Autorizza la posizione per vedere i distributori entro 10 km', true);
    }
  });
})();
