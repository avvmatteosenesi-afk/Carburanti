(() => {
  'use strict';

  const RETRY_DELAYS = [350, 900, 1800];
  const DATA_URL = 'data/stations.json';
  const RAW_URL = 'https://raw.githubusercontent.com/avvmatteosenesi-afk/Carburanti/main/data/stations.json';
  let recovered = false;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function validPayload(payload) {
    return payload && Array.isArray(payload.stations) && payload.stations.length >= 900;
  }

  function statusText(payload) {
    const meta = payload.metadata || {};
    const stamp = meta.generated_at ? new Date(meta.generated_at) : null;
    const dateText = stamp && !Number.isNaN(stamp.getTime())
      ? stamp.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : 'dato disponibile';
    return `${payload.stations.length.toLocaleString('it-IT')} impianti · agg. ${dateText}`;
  }

  async function fetchPayload(url) {
    const sep = url.includes('?') ? '&' : '?';
    const response = await fetch(`${url}${sep}startup=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!validPayload(payload)) throw new Error('Dataset incompleto');
    return payload;
  }

  function applyPayload(payload) {
    const app = window.CarburantiApp;
    if (!app?.state || recovered) return false;
    recovered = true;
    app.state.metadata = payload.metadata || {};
    app.state.stations = payload.stations;
    app.state.loaded = true;
    const status = document.getElementById('dataStatus');
    if (status) status.textContent = statusText(payload);
    try {
      document.querySelector('.fuel-tab.active')?.click();
      const zone = document.getElementById('zoneSelect');
      if (zone) zone.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}
    document.getElementById('mapNotice')?.classList.add('hidden');
    return true;
  }

  function hideTransientError() {
    const status = document.getElementById('dataStatus');
    if (status?.textContent?.trim() === 'Dati non disponibili') status.textContent = 'Caricamento prezzi MIMIT…';
    const notice = document.getElementById('mapNotice');
    if (notice?.textContent?.includes('Impossibile caricare i dati carburanti')) notice.classList.add('hidden');
  }

  async function recover() {
    hideTransientError();
    for (const delay of RETRY_DELAYS) {
      await sleep(delay);
      try {
        const payload = await fetchPayload(DATA_URL);
        if (applyPayload(payload)) return;
      } catch (_) {}
    }
    try {
      const payload = await fetchPayload(RAW_URL);
      if (applyPayload(payload)) return;
    } catch (_) {}
    const status = document.getElementById('dataStatus');
    if (status) status.textContent = 'Dati non disponibili';
    const notice = document.getElementById('mapNotice');
    if (notice) {
      notice.textContent = 'Impossibile caricare i dati carburanti';
      notice.classList.remove('hidden');
      setTimeout(() => notice.classList.add('hidden'), 5000);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const observer = new MutationObserver(() => {
      const status = document.getElementById('dataStatus');
      if (!recovered && status?.textContent?.trim() === 'Dati non disponibili') {
        observer.disconnect();
        recover();
      }
    });
    const status = document.getElementById('dataStatus');
    if (status) observer.observe(status, { childList: true, subtree: true, characterData: true });
  });
})();
