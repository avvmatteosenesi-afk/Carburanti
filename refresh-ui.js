(() => {
  'use strict';
  const KEY = 'carburanti:last-manual-refresh';

  async function purgeDataCaches() {
    if (!('caches' in window)) return;
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k.startsWith('carburanti-data-')).map(k => caches.delete(k)));
    } catch (_) {}
  }

  async function reloadFresh(param) {
    await purgeDataCaches();
    const url = new URL(location.href);
    url.searchParams.set(param, Date.now());
    location.replace(url.toString());
  }

  function addRefreshButton() {
    if (document.getElementById('refreshPricesBtn')) return;
    const status = document.getElementById('dataStatus');
    const header = status?.parentElement;
    if (!header) return;

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:7px;flex-wrap:wrap';
    if (status.parentNode === header) header.insertBefore(row, status);
    row.appendChild(status);

    const btn = document.createElement('button');
    btn.id = 'refreshPricesBtn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Ricarica i dati prezzi pubblicati');
    btn.title = 'Ricarica il dataset pubblicato. I prezzi vengono aggiornati automaticamente dal servizio MIMIT; questo pulsante non avvia una nuova interrogazione.';
    btn.textContent = '↻';
    btn.style.cssText = 'border:1px solid #d9e0e6;background:#fff;border-radius:9px;min-width:30px;height:30px;padding:0 7px;font-size:19px;line-height:1;cursor:pointer;color:#17212b';
    row.appendChild(btn);
    const help = document.createElement('span');
    help.id = 'refreshHelp';
    help.textContent = 'Ricarica dati pubblicati · aggiornamento prezzi automatico';
    help.style.cssText = 'flex-basis:100%;font-size:10px;line-height:1.15;opacity:.86';
    btn.setAttribute('aria-describedby', help.id);
    row.appendChild(help);

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = '…';
      btn.title = 'Ricarico i dati prezzi già pubblicati…';
      help.textContent = 'Ricarico i dati prezzi già pubblicati…';
      try { sessionStorage.setItem(KEY, String(Date.now())); } catch (_) {}
      await reloadFresh('refresh');
    });

    let lastAutoReload = Date.now();
    // If the app remains open, reload once per hour so it picks up the latest
    // hourly MIMIT deployment without requiring user action.
    setInterval(() => {
      if (document.hidden) return;
      if (Date.now() - lastAutoReload < 60 * 60 * 1000) return;
      lastAutoReload = Date.now();
      reloadFresh('autoRefresh');
    }, 60 * 1000);
  }

  document.addEventListener('DOMContentLoaded', addRefreshButton);
})();
