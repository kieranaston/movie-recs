import { devices, expect, test, type Page } from '@playwright/test';

const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['iPhone 14'];
const iPhone = { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch };

const rows = (page: Page) => page.locator('section[aria-labelledby^="section-"] > div.grid');
const popup = (page: Page) => page.getByRole('dialog', { name: 'Movie details' });

/** Posters that are partly visible (cut off) at either edge of each row. */
const cutOffPosters = (page: Page) =>
  rows(page).evaluateAll((els) =>
    els.map((row) => {
      const r = row.getBoundingClientRect();
      return [...row.children]
        .map((c) => c.getBoundingClientRect())
        .filter((c) => c.right > r.left + 1 && c.left < r.right - 1 && (c.left < r.left - 1 || c.right > r.right + 1)).length;
    })
  );

const position = (page: Page) =>
  page.evaluate(() => ({ y: Math.round(scrollY), rowX: Math.round(document.querySelector('section[aria-labelledby^="section-"] > div.grid')!.scrollLeft) }));

for (const [size, use] of [['desktop', { viewport: { width: 1280, height: 800 } }], ['phone', iPhone]] as const) {
  test.describe(`on ${size}`, () => {
    test.use(use);

    test('rows only ever show whole posters, also after scrolling', async ({ page }) => {
      await page.goto('/');
      await expect(rows(page).first()).toBeVisible();
      expect((await cutOffPosters(page)).every((n) => n === 0)).toBe(true);
      await page.getByRole('button', { name: /Scroll .* right/ }).first().click();
      await page.waitForTimeout(600); // smooth scroll + snap
      expect((await cutOffPosters(page)).every((n) => n === 0)).toBe(true);
    });

    test('a movie opens as a popup and closing it returns to the same place', async ({ page }) => {
      await page.goto('/');
      const row = rows(page).first();
      await row.evaluate((el) => (el.scrollLeft = el.clientWidth + 12)); // second "page" of the row
      await page.evaluate(() => window.scrollTo(0, 120));
      await page.waitForTimeout(300);
      const before = await position(page);

      // A real click on a visible poster; Playwright's .click() would first nudge it fully into view.
      await row.locator('a').nth(size === 'phone' ? 3 : 6).evaluate((el: HTMLElement) => el.click());
      await expect(popup(page)).toBeVisible();
      await expect(page).toHaveURL(/\/movie\/\d+$/);
      expect(await position(page)).toEqual(before);

      if (size === 'desktop') await page.mouse.click(8, 400); // outside the popup
      else await page.keyboard.press('Escape');
      await expect(popup(page)).toHaveCount(0);
      await expect(page).toHaveURL('/');
      expect(await position(page)).toEqual(before);
    });
  });
}

test('the popup also closes with Escape, the ✕ and the browser Back button', async ({ page }) => {
  await page.goto('/');
  const poster = rows(page).first().locator('a').first();
  for (const close of ['Escape', 'button', 'back'] as const) {
    await poster.click();
    await expect(popup(page)).toBeVisible();
    if (close === 'Escape') await page.keyboard.press('Escape');
    if (close === 'button') await popup(page).getByRole('button', { name: 'Close' }).click();
    if (close === 'back') await page.goBack();
    await expect(popup(page)).toHaveCount(0);
    await expect(page).toHaveURL('/');
  }
});

test('a shared movie link opens the full page, not a popup', async ({ page }) => {
  await page.goto('/movie/155');
  await expect(popup(page)).toHaveCount(0);
  await expect(page.locator('main article')).toBeVisible();
});
