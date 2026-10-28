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
  const markers = page.locator('#map .price-marker');
  await expect(markers.first()).toBeVisible({ timeout: 30000 });

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const count = await markers.count();
    for (let i = 0; i < Math.min(count, 30); i += 1) {
      const marker = markers.nth(i);
      try {
        const box = await marker.boundingBox();
        if (!box || box.width < 1 || box.height < 1) continue;
        const viewport = page.viewportSize();
        if (!viewport) continue;
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        if (cx < 8 || cy < 8 || cx > viewport.width - 8 || cy > viewport.height - 8) continue;

        await marker.scrollIntoViewIfNeeded();
        await marker.tap({ timeout: 2500 });
        const popup = page.locator('#map .leaflet-popup').last();
        await expect(popup).toBeVisible({ timeout: 3000 });
        return popup;
      } catch (_) {
        // A marker may have been detached/recreated by Leaflet. Re-query it.
      }
    }
    await page.waitForTimeout(400);
  }

  throw new Error('No stable visible price marker could be tapped');
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
  await fav.tap();
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
