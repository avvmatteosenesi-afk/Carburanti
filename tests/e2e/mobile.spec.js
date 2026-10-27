const { test, expect } = require('@playwright/test');

async function waitForMap(page) {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#map')).toBeVisible();
  await expect(page.locator('#map .price-marker').first()).toBeVisible({ timeout: 30000 });
}

test('app loads and Mia zona exposes fuel markers', async ({ page }) => {
  await waitForMap(page);
  await expect(page.locator('#dataStatus')).not.toContainText('Errore');
  await expect(page.locator('#map .price-marker')).not.toHaveCount(0);
});

test('first tap on a price opens a persistent popup', async ({ page }) => {
  await waitForMap(page);
  const marker = page.locator('#map .price-marker').first();
  await marker.tap();
  const popup = page.locator('#map .leaflet-popup').last();
  await expect(popup).toBeVisible();
  await page.waitForTimeout(700);
  await expect(popup).toBeVisible();
});

test('Google Maps control is present in station popup', async ({ page }) => {
  await waitForMap(page);
  await page.locator('#map .price-marker').first().tap();
  const popup = page.locator('#map .leaflet-popup').last();
  const mapsLink = popup.locator('a[href*="google.com/maps"], a[href*="maps.google"], a[href*="maps.apple.com"]').first();
  await expect(mapsLink).toBeVisible();
  await expect(mapsLink).toHaveAttribute('href', /maps/);
});

test('favorite action changes popup state and marker receives favorite styling', async ({ page }) => {
  await waitForMap(page);
  const marker = page.locator('#map .price-marker').first();
  await marker.tap();
  const popup = page.locator('#map .leaflet-popup').last();
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
