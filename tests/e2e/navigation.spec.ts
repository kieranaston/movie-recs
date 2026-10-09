import { devices, expect, test, type Page } from '@playwright/test';
import { GENRE_PAGES } from '../../src/lib/taxonomy';

// iPhone screen, touch and user agent, on the Chromium engine the suite already uses.
const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['iPhone 14'];
const iPhone = { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch };

const drawer = (page: Page) => page.getByRole('dialog', { name: 'Menu' });
const openMenu = async (page: Page) => {
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(drawer(page)).toBeInViewport();
};

for (const [size, use] of [['desktop', { viewport: { width: 1280, height: 800 } }], ['phone', iPhone]] as const) {
  test.describe(`menu drawer on ${size}`, () => {
    test.use(use);

    test('slides in with every page stacked, and navigates', async ({ page }) => {
      await page.goto('/');
      await expect(drawer(page)).toBeHidden(); // closed: off-screen and hidden from assistive tech
      await openMenu(page);
      const nav = drawer(page).getByRole('navigation', { name: 'Pages' });
      for (const g of GENRE_PAGES) await expect(nav.getByRole('link', { name: g.name, exact: true })).toBeVisible();
      await nav.getByRole('link', { name: 'Comedy', exact: true }).click();
      await expect(page).toHaveURL('/genre/comedy');
      await expect(drawer(page)).toBeHidden();
    });

    test('expands a genre to show its filters', async ({ page }) => {
      await page.goto('/');
      await openMenu(page);
      await expect(drawer(page).getByRole('link', { name: 'Pixar' })).toHaveCount(0);
      await drawer(page).getByRole('button', { name: 'Show Animation filters' }).click();
      await drawer(page).getByRole('link', { name: 'Pixar' }).click();
      await expect(page).toHaveURL('/genre/animation?filter=Pixar');
    });

    test('closes with Escape and by tapping outside', async ({ page }) => {
      await page.goto('/');
      await openMenu(page);
      await page.keyboard.press('Escape');
      await expect(drawer(page)).toBeHidden();
      await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused(); // focus returns to the button
      await openMenu(page);
      await page.mouse.click(viewport.width - 10, viewport.height / 2); // the dimmed page
      await expect(drawer(page)).toBeHidden();
    });
  });
}

test.describe('on a genre page', () => {
  test('the drawer opens on the current page: filters showing, current one marked and in view', async ({ page }) => {
    await page.goto('/genre/horror?filter=Slasher');
    await openMenu(page);
    const current = drawer(page).getByRole('link', { name: 'Slasher' });
    await expect(current).toHaveAttribute('aria-current', 'page');
    await expect(current).toBeFocused();
    await expect(current).toBeInViewport();
  });

  test('pages have no header bar: content starts under the floating menu button', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header')).toHaveCount(0);
    const button = await page.getByRole('button', { name: 'Open menu' }).boundingBox();
    const firstRow = await page.getByRole('heading', { name: 'Top Rated' }).boundingBox();
    expect(firstRow!.y).toBeGreaterThan(button!.y + button!.height);
  });

  test('filters are also chips on the page', async ({ page }) => {
    await page.goto('/genre/animation');
    const filters = page.getByRole('navigation', { name: 'Animation filters' });
    await expect(filters.getByRole('link', { name: 'All' })).toHaveAttribute('aria-current', 'page');
    await filters.getByRole('link', { name: 'Ghibli' }).click();
    await expect(page).toHaveURL('/genre/animation?filter=Ghibli');
  });
});

test.describe('search on a phone', () => {
  test.use(iPhone);
  test('is at the top of the menu, without popping the keyboard on open', async ({ page }) => {
    await page.goto('/');
    await openMenu(page);
    const search = drawer(page).getByRole('searchbox');
    await expect(search).not.toBeFocused();
    await search.fill('arrival');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/search?q=arrival');
  });
});
