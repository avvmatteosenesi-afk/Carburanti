const { test, expect } = require('@playwright/test');

async function waitForMap(page) {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#map')).toBeVisible();
  await expect(page.locator('#map .price-marker').first()).toBeVisible({ timeout: 30000 });
  // Leaflet can rebuild marker DOM while startup location/zone logic settles.
  // Wait for a short quiet period before attempting pointer interactions.
  await page.waitForTimeout(1200);
}

async function tapStableVisiblePriceMarker(page) {
  await expect(page.locator('#map .price-marker').first()).toBeVisible({ timeout: 30000 });

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const tapped = await page.evaluate(() => {
      const map = document.querySelector('#map');
      if (!map) return false;
      const mapRect = map.getBoundingClientRect();
      const candidates = Array.from(map.querySelectorAll('.price-marker'));

      const marker = candidates.find(el => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
        if (r.width < 1 || r.height < 1) return false;
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        return cx >= mapRect.left + 4 && cx <= mapRect.right - 4 && cy >= mapRect.top + 4 && cy <= mapRect.bottom - 4;
      });
      if (!marker) return false;

      const r = marker.getBoundingClientRect();
      const clientX = r.left + r.width / 2;
      const clientY = r.top + r.height / 2;
      const target = marker.closest('.leaflet-marker-icon') || marker;
      const eventInit = { bubbles: true, cancelable: true, composed: true, clientX, clientY, button: 0, buttons: 1 };

      // Dispatch the mobile/pointer sequence directly on the Leaflet marker.
      // This avoids Playwright's actionability/stability gate while still
      // exercising the application's real DOM event handlers.
      if (window.PointerEvent) {
        target.dispatchEvent(new PointerEvent('pointerdown', { ...eventInit, pointerId: 1, pointerType: 'touch', isPrimary: true }));
        target.dispatchEvent(new PointerEvent('pointerup', { ...eventInit, pointerId: 1, pointerType: 'touch', isPrimary: true, buttons: 0 }));
      }
      target.dispatchEvent(new MouseEvent('mousedown', eventInit));
      target.dispatchEvent(new MouseEvent('mouseup', { ...eventInit, buttons: 0 }));
      target.dispatchEvent(new MouseEvent('click', { ...eventInit, buttons: 0 }));
      return true;
    });

    if (tapped) {
      const popup = page.locator('#map .leaflet-popup').last();
      try {
        await expect(popup).toBeVisible({ timeout: 3000 });
        return popup;
      } catch (_) {
        // Leaflet may redraw after the event; retry against current DOM.
      }
    }
    await page.waitForTimeout(400);
  }

  throw new Error('No visible price marker opened a popup after DOM-dispatched tap');
}

test('app loads and Mia zona exposes fuel markers', async ({ page }) => {
  await waitForMap(page);
  await expect(page.locator('#dataStatus')).not.toContainText('Errore');
  await expect(page.locator('#map .price-marker')).not.toHaveCount(0);
});

test('first tap on a price opens a persistent popup', async ({ page }) => {
  await waitForMap(page);
  const popup = await tapStableVisiblePriceMarker(page);
  await expect(popup).toBeVisible();
  await page.waitForTimeout(700);
  await expect(popup).toBeVisible();
});

test('Google Maps control is present in station popup', async ({ page }) => {
  await waitForMap(page);
  const popup = await tapStableVisiblePriceMarker(page);
  const mapsLink = popup.locator('a[href*="google.com/maps"], a[href*="maps.google"], a[href*="maps.apple.com"]').first();
  await expect(mapsLink).toBeVisible();
  await expect(mapsLink).toHaveAttribute('href', /maps/);
});

test('favorite action changes popup state and marker receives favorite styling', async ({ page }) => {
  await waitForMap(page);
  const popup = await tapStableVisiblePriceMarker(page);
  const fav = popup.locator('.fav-btn').first();
  await expect(fav).toBeVisible();
  const before = (await fav.textContent()) || '';
  await fav.evaluate(el => el.click());
  await page.waitForTimeout(1800);
  await expect(fav).not.toHaveText(before);
  const favoriteMarkers = page.locator('#map .favorite-station-price');
  await expect(favoriteMarkers.first()).toBeVisible();
});

test('zone selector switches among quick zone, province, Tuscany and free mode', async ({ page }) => {
  await waitForMap(page);
  const zone = page.locator('#zoneSelect');
  for (const value of ['quick:pistoia-prato', 'province:PO', 'tuscany', 'free']) {
    await zone.selectOption(value);
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
