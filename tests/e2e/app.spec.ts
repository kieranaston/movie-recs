import { createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';

/** Sign in as the owner by setting the login cookie directly (the login form is covered in its own test). */
const ownerToken = createHmac('sha256', 'e2e-password').update('movie-recs-owner').digest('hex');
const signIn = (context: import('@playwright/test').BrowserContext) =>
  context.addCookies([{ name: 'owner', value: ownerToken, url: 'http://localhost:3100' }]);


test.describe('catalog', () => {
  test('browses movies', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Discover Movies' })).toBeAttached(); // for screen readers only
    await expect(page.getByText('The Dark Knight').first()).toBeVisible();
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: 'Watchlist' })).toBeVisible();
  });

  test('sends security headers', async ({ request }) => {
    const res = await request.get('/');
    const h = res.headers();
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(h['x-powered-by']).toBeUndefined();
  });

  test('serves the JSON API without a credential', async ({ request }) => {
    for (const p of ['/api/v1/genres', '/api/v1/browse', '/api/v1/watchlist']) {
      expect((await request.get(p)).status(), p).toBe(200);
    }
  });
});

test.describe('movie page', () => {
  test('lists the cast and director', async ({ page }) => {
    await page.goto('/movie/155');
    const cast = page.getByRole('region', { name: 'Cast' });
    await expect(cast.getByText('Christian Bale')).toBeVisible();
    await expect(cast.getByText('Joker')).toBeVisible();
    await expect(page.getByText('Directed by')).toContainText('Christopher Nolan');
  });

  test('clips a long overview behind a Read more toggle', async ({ page }) => {
    await page.goto('/movie/155');
    const section = page.locator('section[aria-labelledby="overview-heading"]');
    const overview = () => section.locator('div.relative > p').first().boundingBox();
    const readMore = section.getByRole('button', { name: 'Read more' });

    await expect(readMore).toBeVisible();
    const clipped = await overview();
    await readMore.click();
    await expect(section.getByRole('button', { name: 'Show less' })).toBeVisible();
    const expanded = await overview();
    expect(expanded!.height).toBeGreaterThan(clipped!.height);

    await section.getByRole('button', { name: 'Show less' }).click();
    await expect(readMore).toBeVisible();
    expect((await overview())!.height).toBeCloseTo(clipped!.height, 0);
  });

  test('adds to and removes from the watchlist', async ({ page, request, context }) => {
    await signIn(context);
    const ids = async () => {
      const res = await request.get('/api/v1/watchlist');
      expect(res.status(), await res.text()).toBe(200);
      return ((await res.json()) as { movies: { tmdbId: number }[] }).movies.map((m) => m.tmdbId);
    };

    await page.goto('/movie/27205');
    const add = page.getByRole('button', { name: 'Add to watchlist' });
    await expect(add).toHaveText('Add to Watchlist');
    // Wait for each save to finish before checking (the test database serves one query at a time).
    const saved = () => page.waitForResponse((r) => r.request().method() === 'POST' && r.ok());
    let done = saved();
    await add.click();
    const remove = page.getByRole('button', { name: 'Remove from watchlist' });
    await expect(remove).toHaveText('In Watchlist');
    await done;
    expect(await ids()).toContain(27205);

    await page.goto('/watchlist');
    await expect(page.getByText('Inception')).toBeVisible();

    await page.goto('/movie/27205');
    done = saved();
    await page.getByRole('button', { name: 'Remove from watchlist' }).click();
    await expect(page.getByRole('button', { name: 'Add to watchlist' })).toHaveText('Add to Watchlist');
    await done;
    expect(await ids()).not.toContain(27205);
  });

  test('marks a movie watched and rates it', async ({ page, context }) => {
    await signIn(context);
    const saved = () => page.waitForResponse((r) => r.request().method() === 'POST' && r.ok());

    await page.goto('/movie/27205');
    let done = saved();
    await page.getByRole('button', { name: 'Mark as watched' }).click();
    await expect(page.getByRole('button', { name: 'Remove from watched' })).toBeVisible();
    await done;

    done = saved();
    const slider = page.getByRole('slider', { name: 'Your rating out of 10' });
    await slider.focus();
    await slider.press('ArrowRight'); // 5.0 → 5.1, saving a decimal rating
    await expect(slider).toHaveValue('5.1');
    await done;

    await page.goto('/watched');
    await expect(page.getByText('Inception')).toBeVisible();
    await expect(page.getByText('5.1')).toBeVisible();
  });
});

test.describe('owner login', () => {
  test('rejects a wrong password, then signs in and out', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Password').fill('nope');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Wrong password.')).toBeVisible();

    await page.getByLabel('Password').fill('e2e-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => url.pathname === '/'); // the login redirects home once the cookie is set
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Signed in' })).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.waitForURL((url) => url.pathname === '/');
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('the API refuses writes without a token', async ({ request }) => {
    expect((await request.put('/api/v1/watchlist/27205')).status()).toBe(401);
  });
});
