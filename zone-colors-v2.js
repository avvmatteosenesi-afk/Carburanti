(() => {
  'use strict';

  const ADAPTIVE_QUICK_BOUNDS = {
    'quick:pistoia-firenze': [[43.71, 10.82], [43.99, 11.34]],
    'quick:pistoia-prato': [[43.82, 10.82], [44.00, 11.18]],
    'quick:prato-firenze': [[43.70, 11.02], [43.94, 11.35]]
  };

  function parsePrice(text) {
    const n = Number(String(text || '').replace(',', '.').replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  function currentZone() {
    return document.getElementById('zoneSelect')?.value || '';
  }

  function isAdaptiveQuickZone(zone = currentZone()) {
    return Boolean(ADAPTIVE_QUICK_BOUNDS[zone]);
  }

  function wideZone(zone = currentZone()) {
    return zone.startsWith('province:') || zone === 'tuscany' || isAdaptiveQuickZone(zone);
  }

  function stationPrice(station, fuel) {
    const n = Number(station?.prices?.[fuel]?.price);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function insideBounds(station, bounds) {
    if (!station || !bounds || !Number.isFinite(station.lat) || !Number.isFinite(station.lon)) return false;
    return station.lat >= bounds[0][0] && station.lat <= bounds[1][0] &&
      station.lon >= bounds[0][1] && station.lon <= bounds[1][1];
  }

  function quantile(sorted, q) {
    if (!sorted.length) return null;
    if (sorted.length === 1) return sorted[0];
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    const next = sorted[base + 1];
    return Number.isFinite(next) ? sorted[base] + rest * (next - sorted[base]) : sorted[base];
  }

  function adaptiveLimits(zone) {
    const bounds = ADAPTIVE_QUICK_BOUNDS[zone];
    const state = window.CarburantiApp?.state;
    if (!bounds || !state?.loaded || !Array.isArray(state.stations)) return null;
    const fuel = state.fuel || 'benzina';
    const prices = state.stations
      .filter(station => insideBounds(station, bounds))
      .map(station => stationPrice(station, fuel))
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    if (prices.length < 6) return null;
    return {
      min: prices[0],
      lower: quantile(prices, 0.35),
      middle: quantile(prices, 0.70)
    };
  }

  function setClass(el, cls) {
    ['best', 'near', 'good', 'normal'].forEach(c => el.classList.toggle(c, c === cls));
  }

  function updateLegend(mode) {
    const legend = document.querySelector('.controls-card .legend');
    if (!legend) return;
    const spans = legend.querySelectorAll('span');
    if (spans[0]) spans[0].lastChild.textContent = ' minimo';
    if (mode === 'adaptive') {
      if (spans[1]) spans[1].lastChild.textContent = ' più bassi';
      if (spans[2]) spans[2].lastChild.textContent = ' intermedi';
      if (spans[3]) spans[3].lastChild.textContent = ' più alti';
      return;
    }
    if (mode === 'wide') {
      if (spans[1]) spans[1].lastChild.textContent = ' entro 10 cent';
      if (spans[2]) spans[2].lastChild.textContent = ' entro 20 cent';
      if (spans[3]) spans[3].lastChild.textContent = ' altri';
      return;
    }
    if (spans[1]) spans[1].lastChild.textContent = ' entro 5 cent';
    if (spans[2]) spans[2].lastChild.textContent = ' entro 10 cent';
    if (spans[3]) spans[3].lastChild.textContent = ' altri';
  }

  function recolor() {
    const markers = Array.from(document.querySelectorAll('#map .price-marker'));
    if (!markers.length) return;

    const zone = currentZone();
    const markerPrices = markers.map(el => parsePrice(el.textContent)).filter(Number.isFinite);
    const cardMin = parsePrice(document.getElementById('bestPrice')?.textContent);
    const fallbackMin = markerPrices.length ? Math.min(...markerPrices) : null;
    const min = Number.isFinite(cardMin) ? cardMin : fallbackMin;
    if (!Number.isFinite(min)) return;

    const adaptive = adaptiveLimits(zone);
    if (adaptive && Number.isFinite(adaptive.lower) && Number.isFinite(adaptive.middle)) {
      markers.forEach(el => {
        const price = parsePrice(el.textContent);
        if (!Number.isFinite(price)) return;
        const cls = price <= adaptive.min + 0.0005 ? 'best'
          : price <= adaptive.lower + 0.0005 ? 'near'
          : price <= adaptive.middle + 0.0005 ? 'good'
          : 'normal';
        setClass(el, cls);
      });
      updateLegend('adaptive');
      return;
    }

    const wide = wideZone(zone);
    const nearLimit = wide ? 0.1005 : 0.0505;
    const goodLimit = wide ? 0.2005 : 0.1005;
    markers.forEach(el => {
      const price = parsePrice(el.textContent);
      if (!Number.isFinite(price)) return;
      const d = price - min;
      const cls = d <= 0.0005 ? 'best' : d <= nearLimit ? 'near' : d <= goodLimit ? 'good' : 'normal';
      setClass(el, cls);
    });
    updateLegend(wide ? 'wide' : 'standard');
  }

  let queued = false;
  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; recolor(); });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('zoneSelect')?.addEventListener('change', () => {
      setTimeout(queue, 0);
      setTimeout(queue, 150);
      setTimeout(queue, 500);
    });
    document.querySelectorAll('.fuel-tab').forEach(btn => btn.addEventListener('click', () => {
      setTimeout(queue, 0);
      setTimeout(queue, 200);
      setTimeout(queue, 600);
    }));
    new MutationObserver(queue).observe(document.getElementById('map'), { childList: true, subtree: true });
    new MutationObserver(queue).observe(document.getElementById('bestPrice'), { childList: true, characterData: true, subtree: true });
    setTimeout(queue, 500);
    setTimeout(queue, 1200);
  });
})();