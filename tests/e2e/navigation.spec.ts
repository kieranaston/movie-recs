import { devices, expect, test } from '@playwright/test';
import { GENRE_PAGES } from '../../src/lib/taxonomy';

// iPhone screen, touch and user agent, on the Chromium engine the suite already uses.
const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['iPhone 14'];
const iPhone = { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch };

test.describe('navigation on desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('Genres opens a panel by click, with filters, and closes with Escape', async ({ page }) => {
    await page.goto('/');
    const genres = page.getByRole('button', { name: 'Genres' });
    await expect(genres).toHaveAttribute('aria-expanded', 'false');
    await genres.click();
    await expect(page.locator('#genres-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#genres-panel')).toBeHidden();

    await genres.click();
    await page.locator('#genres-panel').getByRole('link', { name: 'Pixar' }).click();
    await expect(page).toHaveURL('/genre/animation?filter=Pixar');
    await expect(page.locator('#genres-panel')).toBeHidden();
  });
});

test.describe('navigation on a phone', () => {
  test.use(iPhone);

  test('the menu lists every genre and navigates', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Genres' })).toBeHidden(); // desktop nav is hidden
    await page.getByRole('button', { name: 'Open menu' }).click();
    const menu = page.locator('#mobile-menu');
    await expect(menu.getByRole('link')).toHaveCount(2 + GENRE_PAGES.length); // Home, Sign in, every genre
    await menu.getByRole('link', { name: 'Action' }).click();
    await expect(page).toHaveURL('/genre/action');
    await expect(menu).toBeHidden();
  });

  test('search opens from the header', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByRole('searchbox').fill('arrival');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/search?q=arrival');
  });
});

test('genre filters are chips on the page', async ({ page }) => {
  await page.goto('/genre/animation');
  const filters = page.getByRole('navigation', { name: 'Animation filters' });
  await expect(filters.getByRole('link', { name: 'All' })).toHaveAttribute('aria-current', 'page');
  await filters.getByRole('link', { name: 'Ghibli' }).click();
  await expect(page).toHaveURL('/genre/animation?filter=Ghibli');
  await expect(filters.getByRole('link', { name: 'Ghibli' })).toHaveAttribute('aria-current', 'page');
});
