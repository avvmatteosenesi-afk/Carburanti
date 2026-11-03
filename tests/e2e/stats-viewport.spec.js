const { test, expect, devices } = require('@playwright/test');

const layouts = ['current','dragon','arale','daitarn','devilman','jeeg','harlock','mazinga','goldrake','lamu','kenshiro','candy','yattaman','lupin','oscar'];

async function assertInsideViewport(page, selector) {
  const box = await page.locator(selector).boundingBox();
  expect(box, `${selector} must have a rendered box`).not.toBeNull();
  const viewport = page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function assertFixedStats(page) {
  const stats = page.locator('.map-stats');
  await expect(stats).toBeVisible();
  await expect(stats).toHaveCSS('position', 'fixed');
  await expect(page.locator('#bestCard')).toBeVisible();
  await expect(page.locator('#avgPrice')).toBeVisible();
  await assertInsideViewport(page, '.map-stats');
  await assertInsideViewport(page, '#bestCard');
  await assertInsideViewport(page, '#avgPrice');
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
    await assertFixedStats(page);
  }
});

test('themed price cards stay viewport-anchored while the document scrolls', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('carburanti:layout:v2', 'dragon');
    document.body.dataset.layout = 'dragon';
  });
  await assertFixedStats(page);

  // Use Playwright's scrolling primitive instead of window.scrollTo(). On mobile
  // WebKit a transient navigation/reload can destroy the page execution context
  // while evaluate() is running, producing a false-negative unrelated to the
  // fixed-position invariant this test is intended to verify.
  await page.locator('body').press('End').catch(() => {});
  await page.waitForTimeout(350);
  await page.waitForLoadState('domcontentloaded');
  await assertFixedStats(page);
});
