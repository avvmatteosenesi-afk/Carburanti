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
    const smartHead = document.getElementById('smartHead');
    if (!smartHead || document.getElementById('refreshPricesBtn')) return false;

    const btn = document.createElement('button');
    btn.id = 'refreshPricesBtn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Ricarica i dati prezzi pubblicati');
    btn.title = 'Ricarica i dati già pubblicati. I prezzi vengono aggiornati automaticamente dal servizio MIMIT; questo pulsante non avvia una nuova interrogazione.';
    btn.textContent = '↻';
    btn.style.cssText = 'border:1px solid #d9e0e6;background:#fff;border-radius:9px;width:32px;min-width:32px;height:32px;padding:0;font-size:20px;line-height:1;cursor:pointer;color:#17212b;display:inline-grid;place-items:center';
    smartHead.appendChild(btn);

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = '…';
      btn.title = 'Ricarico i dati prezzi già pubblicati…';
      try { sessionStorage.setItem(KEY, String(Date.now())); } catch (_) {}
      await reloadFresh('refresh');
    });

    let lastAutoReload = Date.now();
    setInterval(() => {
      if (document.hidden) return;
      if (Date.now() - lastAutoReload < 60 * 60 * 1000) return;
      lastAutoReload = Date.now();
      reloadFresh('autoRefresh');
    }, 60 * 1000);
    return true;
  }

  function mountRefreshButton() {
    if (addRefreshButton()) return;
    const observer = new MutationObserver(() => {
      if (addRefreshButton()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 15000);
  }

  document.addEventListener('DOMContentLoaded', mountRefreshButton);
})();
