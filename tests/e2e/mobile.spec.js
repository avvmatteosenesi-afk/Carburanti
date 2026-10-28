const { test, expect } = require('@playwright/test');

async function waitForMap(page) {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#map')).toBeVisible();
  await expect(page.locator('#map .price-marker').first()).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(1200);
}

async function tapStableVisiblePriceMarker(page, mapSelector = '#map') {
  await expect(page.locator(`${mapSelector} .price-marker`).first()).toBeVisible({ timeout: 30000 });
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const tapped = await page.evaluate((selector) => {
      const map = document.querySelector(selector);
      if (!map) return false;
      const mapRect = map.getBoundingClientRect();
      const marker = Array.from(map.querySelectorAll('.price-marker')).find(el => {
        const r = el.getBoundingClientRect(), style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0 || r.width < 1 || r.height < 1) return false;
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        return cx >= mapRect.left + 4 && cx <= mapRect.right - 4 && cy >= mapRect.top + 4 && cy <= mapRect.bottom - 4;
      });
      if (!marker) return false;
      const r = marker.getBoundingClientRect(), target = marker.closest('.leaflet-marker-icon') || marker;
      const eventInit = { bubbles: true, cancelable: true, composed: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0, buttons: 1 };
      if (window.PointerEvent) {
        target.dispatchEvent(new PointerEvent('pointerdown', { ...eventInit, pointerId: 1, pointerType: 'touch', isPrimary: true }));
        target.dispatchEvent(new PointerEvent('pointerup', { ...eventInit, pointerId: 1, pointerType: 'touch', isPrimary: true, buttons: 0 }));
      }
      target.dispatchEvent(new MouseEvent('mousedown', eventInit));
      target.dispatchEvent(new MouseEvent('mouseup', { ...eventInit, buttons: 0 }));
      target.dispatchEvent(new MouseEvent('click', { ...eventInit, buttons: 0 }));
      return true;
    }, mapSelector);
    if (tapped) {
      try {
        await expect(page.locator(`${mapSelector} .leaflet-popup`).last()).toBeVisible({ timeout: 3000 });
        return;
      } catch (_) {}
    }
    await page.waitForTimeout(400);
  }
  throw new Error(`No visible price marker opened a popup in ${mapSelector}`);
}

test('app loads and Mia zona exposes fuel markers', async ({ page }) => {
  await waitForMap(page);
  await expect(page.locator('#dataStatus')).not.toContainText('Errore');
  await expect(page.locator('#map .price-marker')).not.toHaveCount(0);
});

test('first tap on a price opens a persistent popup', async ({ page }) => {
  await waitForMap(page);
  await tapStableVisiblePriceMarker(page);
  await expect(page.locator('#map .leaflet-popup').last()).toBeVisible();
  await page.waitForTimeout(700);
  await expect(page.locator('#map .leaflet-popup').last()).toBeVisible();
});

test('Google Maps control is present in station popup', async ({ page }) => {
  await waitForMap(page);
  await tapStableVisiblePriceMarker(page);
  const mapsLink = page.locator('#map .leaflet-popup a[href*="google.com/maps"], #map .leaflet-popup a[href*="maps.google"], #map .leaflet-popup a[href*="maps.apple.com"]').last();
  await expect(mapsLink).toBeVisible();
  await expect(mapsLink).toHaveAttribute('href', /maps/);
});

test('favorite action persists and marker receives favorite styling', async ({ page }) => {
  await waitForMap(page);
  await tapStableVisiblePriceMarker(page);
  await expect.poll(async () => page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('#map .leaflet-popup .fav-btn')).find(el => {
      const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
    });
    if (!btn) return false;
    btn.click();
    return true;
  }), { timeout: 8000 }).toBeTruthy();
  await expect.poll(async () => page.evaluate(() => Object.keys(localStorage).some(key => /fav/i.test(key) && Boolean(localStorage.getItem(key)))), { timeout: 8000 }).toBeTruthy();
  await expect.poll(async () => page.locator('#map .favorite-station-price').count(), { timeout: 8000 }).toBeGreaterThan(0);
  await expect(page.locator('#map .favorite-station-price').first()).toBeVisible({ timeout: 8000 });
});

test('zone selector switches among quick zone, province, Tuscany and free mode', async ({ page }) => {
  await waitForMap(page);
  for (const value of ['quick:pistoia-prato', 'province:PO', 'tuscany', 'free']) {
    await page.locator('#zoneSelect').selectOption(value);
    await page.waitForTimeout(800);
    await expect(page.locator('#map')).toBeVisible();
  }
});

test('Viaggio panel opens and route form remains usable on mobile', async ({ page }) => {
  await waitForMap(page);
  await page.locator('#tripOpenBtn').tap();
  await expect(page.locator('#tripPanel')).toBeVisible();
  await expect(page.locator('#tripFrom')).toBeVisible();
  await expect(page.locator('#tripTo')).toBeVisible();
  await expect(page.locator('#tripGoBtn')).toBeVisible();
  await expect(page.locator('#tripCloseBtn')).toBeVisible();
});

test('simulated geolocation centers Mia zona coherently', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 43.9022, longitude: 11.0069, accuracy: 20 });
  await page.addInitScript(() => localStorage.removeItem('carburanti:last-position:v1'));
  await waitForMap(page);
  await page.locator('#zoneSelect').selectOption('position');
  await page.locator('#locateBtn').tap();
  await expect.poll(() => page.evaluate(() => window.CarburantiApp?.getUserPosition?.() || null), { timeout: 15000 }).not.toBeNull();
  const pos = await page.evaluate(() => window.CarburantiApp.getUserPosition());
  expect(Math.abs(pos.lat - 43.9022)).toBeLessThan(0.01);
  expect(Math.abs(pos.lon - 11.0069)).toBeLessThan(0.01);
  const center = await page.evaluate(() => { const c = window.CarburantiApp?.getMap?.()?.getCenter?.(); return c ? { lat: c.lat, lon: c.lng } : null; });
  if (center) {
    expect(Math.abs(center.lat - 43.9022)).toBeLessThan(0.12);
    expect(Math.abs(center.lon - 11.0069)).toBeLessThan(0.12);
  }
  await expect(page.locator('#zoneSelect')).toHaveValue('position');
});

test('fuel switch recalculates valid price colours in the displayed zone', async ({ page }) => {
  await waitForMap(page);
  await page.locator('#zoneSelect').selectOption('quick:pistoia-prato');
  await page.waitForTimeout(900);
  for (const fuel of ['benzina', 'gasolio']) {
    await page.locator(`.fuel-tab[data-fuel="${fuel}"]`).tap();
    await expect(page.locator(`.fuel-tab[data-fuel="${fuel}"]`)).toHaveClass(/active/);
    await expect(page.locator('#map .price-marker').first()).toBeVisible({ timeout: 10000 });
    const classes = await page.locator('#map .price-marker').evaluateAll(nodes => nodes.map(n => [...n.classList].find(c => ['best','near','good','normal'].includes(c))).filter(Boolean));
    expect(classes.length).toBeGreaterThan(0);
    expect(classes.every(c => ['best','near','good','normal'].includes(c))).toBeTruthy();
    expect(classes).toContain('best');
  }
});

test('Viaggio calculates, fits and classifies a motorway route on mobile', async ({ page }) => {
  await page.route('**/search?**', async route => {
    const u = new URL(route.request().url());
    const q = (u.searchParams.get('city') || u.searchParams.get('q') || '').toLowerCase();
    const hit = q.includes('lucca') ? { lat: '43.8430', lon: '10.5079', display_name: 'Lucca, Toscana, Italia', name: 'Lucca', address: { city: 'Lucca' } } : { lat: '43.9022', lon: '11.0069', display_name: 'Agliana, Toscana, Italia', name: 'Agliana', address: { town: 'Agliana' } };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([hit]) });
  });
  await page.route('**/route/v1/driving/**', async route => {
    const coords = [[11.0069,43.9022],[10.90,43.89],[10.75,43.87],[10.60,43.85],[10.5079,43.8430]];
    const payload = { code: 'Ok', routes: [{ distance: 52000, duration: 3000, geometry: { type: 'LineString', coordinates: coords }, legs: [{ steps: [{ name: 'A11 Autostrada Firenze-Mare', ref: 'A11', distance: 44000, geometry: { coordinates: coords.slice(0,4) } }, { name: 'Viabilità urbana', ref: '', distance: 8000, geometry: { coordinates: coords.slice(3) } }] }] }] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
  await waitForMap(page);
  await page.locator('#tripOpenBtn').tap();
  await page.locator('#tripFrom').fill('Agliana');
  await page.locator('#tripTo').fill('Lucca');
  await page.locator('#tripGoBtn').tap();
  await expect(page.locator('#tripSummary')).toBeVisible({ timeout: 30000 });
  const distanceKm = Number(((await page.locator('#tripDistance').innerText()).match(/[\d.,]+/) || ['0'])[0].replace(',', '.'));
  expect(distanceKm).toBeGreaterThan(45);
  expect(distanceKm).toBeLessThan(70);
  await expect(page.locator('#tripMessage')).toContainText('autostrad', { ignoreCase: true });
  await expect(page.locator('#tripMap')).toBeVisible();
  await expect.poll(async () => page.evaluate(() => {
    const map = window.__carburantiTripMap;
    if (!map || !window.L) return 0;
    let polylines = 0;
    map.eachLayer(layer => { if (layer instanceof L.Polyline) polylines += 1; });
    return polylines;
  }), { timeout: 10000 }).toBeGreaterThan(0);
});

test('geographic data guard excludes province-incompatible PO coordinates from Prato view', async ({ page }) => {
  await waitForMap(page);
  await page.locator('#zoneSelect').selectOption('province:PO');
  await page.waitForTimeout(900);
  const bad = await page.evaluate(async () => {
    const p = await fetch('data/stations.json?e2e-geoguard=1', { cache: 'no-store' }).then(r => r.json());
    return p.stations.filter(s => s.province === 'PO' && (s.lat < 43.55 || s.lat > 44.30 || s.lon < 10.60 || s.lon > 11.55)).map(s => ({ id: s.id, lat: s.lat, lon: s.lon, city: s.city }));
  });
  expect(bad).toEqual([]);
});

test('PWA iPhone assets and manifest are publishable', async ({ page, request }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  await expect(page.locator('link[rel="apple-touch-icon"][sizes="180x180"]')).toHaveCount(1);
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifestResponse = await request.get(new URL(manifestHref, page.url()).toString());
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe('Carburanti');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.some(i => i.sizes === '192x192')).toBeTruthy();
  expect(manifest.icons.some(i => i.sizes === '512x512')).toBeTruthy();
  for (const icon of ['carburanti-green-180.png', 'carburanti-green-192.png', 'carburanti-green-512.png']) {
    const r = await request.get(new URL(icon, page.url()).toString());
    expect(r.ok()).toBeTruthy();
    const body = await r.body();
    expect(body.length).toBeGreaterThan(256);
    expect([...body.slice(0, 8)]).toEqual([137,80,78,71,13,10,26,10]);
  }
  const swState = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { registrations: [] };
    const regs = await navigator.serviceWorker.getRegistrations();
    return { registrations: regs.map(r => ({ scope: r.scope, scriptURL: r.active?.scriptURL || r.waiting?.scriptURL || r.installing?.scriptURL || null })) };
  });
  const appOrigin = new URL(page.url()).origin;
  for (const reg of swState.registrations) {
    expect(new URL(reg.scope).origin).toBe(appOrigin);
    if (reg.scriptURL) expect(new URL(reg.scriptURL).origin).toBe(appOrigin);
  }
});
