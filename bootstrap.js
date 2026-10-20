(() => {
  'use strict';

  const RAW_BASE = 'https://raw.githubusercontent.com/avvmatteosenesi-afk/Carburanti/main/data/';
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const match = url.match(/data\/(stations(?:-it)?\.json)(?:\?|$)/);
    if (!match || url.startsWith(RAW_BASE)) return nativeFetch(input, init);

    try {
      const response = await nativeFetch(input, init);
      if (response.ok) return response;
    } catch (_) {}

    return nativeFetch(`${RAW_BASE}${match[1]}?fallback=${Date.now()}`, { ...init, cache: 'no-store' });
  };

  let nativeGeo = null;
  let geoArmed = false;
  let pendingGeo = null;

  try {
    if (navigator.geolocation && typeof navigator.geolocation.getCurrentPosition === 'function') {
      nativeGeo = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition = (success, error, options) => {
        if (!geoArmed) {
          pendingGeo = { success, error, options };
          return;
        }
        return nativeGeo(success, error, options);
      };
    }
  } catch (_) {
    nativeGeo = navigator.geolocation?.getCurrentPosition?.bind(navigator.geolocation) || null;
  }

  function style() {
    const node = document.createElement('style');
    node.textContent = `
      .geo-consent-backdrop{position:fixed;inset:0;z-index:4000;background:rgba(20,28,36,.50);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center;padding:8px}
      .geo-consent-backdrop.hidden{display:none!important}
      .geo-consent-card{width:min(100%,520px);background:#fff;border-radius:20px;padding:16px;box-shadow:0 15px 50px rgba(0,0,0,.26);display:grid;gap:11px;padding-bottom:max(16px,env(safe-area-inset-bottom));font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#17212b}
      .geo-consent-icon{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:#eaf2ff;color:#0d6efd;font-size:1.75rem;font-weight:800;margin:0 auto}
      .geo-consent-card h2{margin:0;text-align:center;font-size:1.25rem}
      .geo-consent-card p{margin:0;text-align:center;color:#5f6b77;font-size:.86rem;line-height:1.4}
      .geo-consent-primary,.geo-consent-secondary{min-height:46px;border-radius:13px;font:inherit;font-weight:800;cursor:pointer}
      .geo-consent-primary{border:0;background:#0d6efd;color:#fff}
      .geo-consent-secondary{border:1px solid #dfe5ea;background:#fff;color:#17212b}
      .geo-consent-note{font-size:.72rem!important;color:#7a8490!important}
    `;
    document.head.appendChild(node);
  }

  function buildPrompt() {
    if (document.getElementById('geoConsent')) return document.getElementById('geoConsent');
    style();
    const wrap = document.createElement('div');
    wrap.id = 'geoConsent';
    wrap.className = 'geo-consent-backdrop hidden';
    wrap.innerHTML = `
      <section class="geo-consent-card" role="dialog" aria-modal="true" aria-labelledby="geoConsentTitle">
        <div class="geo-consent-icon" aria-hidden="true">⌖</div>
        <h2 id="geoConsentTitle">Consenti la posizione</h2>
        <p id="geoConsentText">Per mostrarti i distributori entro 10 km, Carburanti deve accedere alla tua posizione.</p>
        <button id="geoConsentAllow" class="geo-consent-primary" type="button">Consenti posizione</button>
        <button id="geoConsentSkip" class="geo-consent-secondary" type="button">Continua senza posizione</button>
        <p class="geo-consent-note">La posizione viene usata solo per calcolare la zona visualizzata nell’app.</p>
      </section>`;
    document.body.appendChild(wrap);
    return wrap;
  }

  function closePrompt() {
    document.getElementById('geoConsent')?.classList.add('hidden');
  }

  function showPrompt() {
    const wrap = buildPrompt();
    const allow = document.getElementById('geoConsentAllow');
    const skip = document.getElementById('geoConsentSkip');
    const text = document.getElementById('geoConsentText');

    allow.onclick = () => {
      allow.disabled = true;
      allow.textContent = 'Attendo autorizzazione…';
      text.textContent = 'Conferma la richiesta di posizione del browser.';
      geoArmed = true;

      if (pendingGeo && nativeGeo) {
        const req = pendingGeo;
        pendingGeo = null;
        nativeGeo(req.success, req.error, req.options);
      } else if (window.CarburantiApp?.locateUser) {
        window.CarburantiApp.locateUser(true);
      } else if (nativeGeo) {
        nativeGeo(() => {}, () => {}, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
      }

      let checks = 0;
      const timer = setInterval(() => {
        checks += 1;
        const pos = window.CarburantiApp?.getUserPosition?.();
        if (pos) {
          clearInterval(timer);
          closePrompt();
          return;
        }
        if (checks >= 40) {
          clearInterval(timer);
          allow.disabled = false;
          allow.textContent = 'Riprova';
          text.textContent = 'La posizione non è stata autorizzata o non è disponibile. Tocca “Riprova” oppure abilita la posizione nelle impostazioni del browser.';
        }
      }, 500);
    };

    skip.onclick = () => {
      if (pendingGeo?.error) {
        try { pendingGeo.error({ code: 1, message: 'Autorizzazione rinviata' }); } catch (_) {}
      }
      pendingGeo = null;
      if (window.CarburantiApp?.state) window.CarburantiApp.state.locating = false;
      closePrompt();
      const zone = document.getElementById('zoneSelect');
      if (zone && zone.value === 'position') {
        zone.value = 'tuscany';
        zone.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };

    wrap.classList.remove('hidden');
  }

  document.addEventListener('DOMContentLoaded', () => {
    buildPrompt();
    const zone = document.getElementById('zoneSelect');
    const current = window.CarburantiApp?.getUserPosition?.();
    if (zone?.value === 'position' && !current) showPrompt();

    zone?.addEventListener('change', () => {
      if (zone.value === 'position' && !window.CarburantiApp?.getUserPosition?.()) showPrompt();
    });
  });
})();
