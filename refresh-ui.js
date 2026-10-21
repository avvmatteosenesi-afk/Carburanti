(() => {
  'use strict';
  const KEY = 'carburanti:last-manual-refresh';

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
    btn.setAttribute('aria-label', 'Aggiorna prezzi');
    btn.title = 'Aggiorna prezzi';
    btn.textContent = '↻';
    btn.style.cssText = 'border:1px solid #d9e0e6;background:#fff;border-radius:9px;min-width:30px;height:30px;padding:0 7px;font-size:19px;line-height:1;cursor:pointer;color:#17212b';
    row.appendChild(btn);

    btn.addEventListener('click', () => {
      btn.disabled = true;
      btn.textContent = '…';
      try { sessionStorage.setItem(KEY, String(Date.now())); } catch (_) {}
      const url = new URL(location.href);
      url.searchParams.set('refresh', Date.now());
      location.replace(url.toString());
    });

    let lastAutoReload = Date.now();
    // If the app remains open, reload once per hour so it picks up the latest
    // hourly MIMIT deployment without requiring user action.
    setInterval(() => {
      if (document.hidden) return;
      if (Date.now() - lastAutoReload < 60 * 60 * 1000) return;
      lastAutoReload = Date.now();
      const url = new URL(location.href);
      url.searchParams.set('autoRefresh', Date.now());
      location.replace(url.toString());
    }, 60 * 1000);
  }

  document.addEventListener('DOMContentLoaded', addRefreshButton);
})();