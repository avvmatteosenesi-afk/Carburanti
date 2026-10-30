const { test, expect, devices } = require('@playwright/test');

const layouts = ['current','dragon','arale','daitarn','devilman','jeeg','harlock','mazinga','goldrake','lamu'];

async function assertInsideViewport(page, selector) {
  const box = await page.locator(selector).boundingBox();
  expect(box, `${selector} must have a rendered box`).not.toBeNull();
  const viewport = page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

test.use({ ...devices['iPhone 14'] });

test('minimum and average cards remain visible inside iPhone viewport in every layout', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#map')).toBeVisible();
  await expect(page.locator('#bestCard')).toBeVisible();
  await expect(page.locator('#avgPrice')).toBeVisible();

  for (const layout of layouts) {
    await page.evaluate((id) => {
      const key = 'carburanti:layout:v2';
      localStorage.setItem(key, id);
      if (id === 'current') document.body.removeAttribute('data-layout');
      else document.body.dataset.layout = id;
    }, layout);
    await page.waitForTimeout(150);
    await expect(page.locator('.map-stats')).toBeVisible();
    await expect(page.locator('#bestCard')).toBeVisible();
    await expect(page.locator('#avgPrice')).toBeVisible();
    await assertInsideViewport(page, '.map-stats');
    await assertInsideViewport(page, '#bestCard');
    await assertInsideViewport(page, '#avgPrice');
  }
});

test('price cards stay viewport-anchored while the document scrolls', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.map-stats')).toBeVisible();
  const before = await page.locator('.map-stats').boundingBox();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(150);
  const after = await page.locator('.map-stats').boundingBox();
  expect(after).not.toBeNull();
  expect(Math.abs(after.y - before.y)).toBeLessThan(3);
  await assertInsideViewport(page, '.map-stats');
});
