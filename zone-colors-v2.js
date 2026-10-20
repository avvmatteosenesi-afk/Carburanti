(() => {
  'use strict';

  function parsePrice(text) {
    const n = Number(String(text || '').replace(',', '.').replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  function wideZone() {
    const zone = document.getElementById('zoneSelect')?.value || '';
    return zone.startsWith('province:') || zone === 'tuscany';
  }

  function recolor() {
    const min = parsePrice(document.getElementById('bestPrice')?.textContent);
    if (!Number.isFinite(min)) return;
    const wide = wideZone();
    const nearLimit = wide ? 0.1005 : 0.0505;
    const goodLimit = wide ? 0.2005 : 0.1005;
    document.querySelectorAll('#map .price-marker').forEach(el => {
      const price = parsePrice(el.textContent);
      if (!Number.isFinite(price)) return;
      const d = price - min;
      const cls = d <= 0.0005 ? 'best' : d <= nearLimit ? 'near' : d <= goodLimit ? 'good' : 'normal';
      ['best','near','good','normal'].forEach(c => el.classList.toggle(c, c === cls));
    });
    const legend = document.querySelector('.controls-card .legend');
    if (legend) {
      const spans = legend.querySelectorAll('span');
      if (spans[1]) spans[1].lastChild.textContent = wide ? ' entro 10 cent' : ' entro 5 cent';
      if (spans[2]) spans[2].lastChild.textContent = wide ? ' entro 20 cent' : ' entro 10 cent';
    }
  }

  let queued = false;
  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; recolor(); });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('zoneSelect')?.addEventListener('change', () => setTimeout(queue, 0));
    new MutationObserver(queue).observe(document.getElementById('map'), { childList: true, subtree: true });
    new MutationObserver(queue).observe(document.getElementById('bestPrice'), { childList: true, characterData: true, subtree: true });
    setTimeout(queue, 500);
  });
})();
