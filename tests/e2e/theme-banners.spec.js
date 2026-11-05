const { test, expect } = require('@playwright/test');

test('all theme banners load panoramically and header controls stay usable', async ({ page, request }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#map')).toBeVisible();

  const cssResponse = await request.get(new URL('layout-themes.css', page.url()).toString());
  expect(cssResponse.ok()).toBeTruthy();
  const css = await cssResponse.text();
  const names = [...new Set([...css.matchAll(/theme-banners\/([a-z0-9-]+)\.webp/g)].map(match => match[1]))];
  expect(names).toHaveLength(13);

  for (const name of names) {
    const response = await request.get(new URL(`theme-banners/${name}.webp`, page.url()).toString());
    expect(response.ok(), name).toBeTruthy();
    const bytes = await response.body();
    expect(bytes.subarray(0, 4).toString(), name).toBe('RIFF');
    expect(bytes.subarray(8, 12).toString(), name).toBe('WEBP');
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
  const smartHead = page.locator('#smartHead');
  if (await smartHead.count()) {
    await expect(refresh).toHaveAttribute('aria-label', /Ricarica i dati prezzi pubblicati/);
    expect(await refresh.evaluate(button => button.parentElement?.id)).toBe('smartHead');
    await expect(page.getByText('Scelte rapide', { exact: true })).toHaveCount(0);
  }

  await settings.click();
  await expect(page.locator('#settingsPanel')).toBeVisible();
  await page.locator('#settingsPanel').click({ position: { x: 2, y: 2 } });
  await expect(page.locator('#settingsPanel')).toBeHidden();
  await trip.click();
  await expect(page.locator('#tripPanel')).toBeVisible();
  await expect(page.locator('#tripFrom')).toBeVisible();
});
