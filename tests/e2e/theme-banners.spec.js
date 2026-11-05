const { test, expect } = require('@playwright/test');

test('all theme banners load panoramically and header controls stay usable', async ({ page, request }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#map')).toBeVisible();

  const cssResponse = await request.get(new URL('layout-themes.css', page.url()).toString());
  expect(cssResponse.ok()).toBeTruthy();
  const css = await cssResponse.text();
  const names = [...new Set([...css.matchAll(/theme-banners\/([a-z0-9-]+)\.webp/g)].map(match => match[1]))];
  expect(names).toHaveLength(13);

  const dimensions = await page.evaluate(async names => Promise.all(names.map(async name => {
    const response = await fetch(new URL(`theme-banners/${name}.webp`, location.href), { cache: 'no-store' });
    if (!response.ok) throw new Error(`${name}.webp returned HTTP ${response.status}`);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const result = { name, width: bitmap.width, height: bitmap.height, type: blob.type };
    bitmap.close();
    return result;
  })), names);
  for (const image of dimensions) {
    expect(image.width, image.name).toBeGreaterThanOrEqual(image.height * 2.2);
  }

  expect(css).toContain('body[data-layout="dragon"]');

  const trip = page.locator('#tripOpenBtn');
  const settings = page.locator('#settingsBtn');
  const refresh = page.locator('#refreshPricesBtn');
  await expect(trip).toBeVisible();
  await expect(trip).toBeEnabled();
  await expect(settings).toBeVisible();
  await expect(settings).toBeEnabled();
  await expect(refresh).toBeVisible();
  await expect(refresh).toBeEnabled();
  const refreshHelp = page.locator('#refreshHelp');
  if (await refreshHelp.count()) {
    await expect(refresh).toHaveAttribute('aria-label', /Ricarica i dati prezzi pubblicati/);
    await expect(refresh).toHaveAttribute('aria-describedby', 'refreshHelp');
    await expect(refreshHelp).toContainText('aggiornamento prezzi automatico');
  }

  await settings.click();
  await expect(page.locator('#settingsPanel')).toBeVisible();
  await page.locator('#settingsCloseBtn').click();
  await expect(page.locator('#settingsPanel')).toBeHidden();
  await trip.click();
  await expect(page.locator('#tripPanel')).toBeVisible();
  await expect(page.locator('#tripFrom')).toBeVisible();
});
