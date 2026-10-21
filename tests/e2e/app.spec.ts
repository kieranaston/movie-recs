import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type APIRequestContext } from '@playwright/test';

const tokens = () => JSON.parse(readFileSync(path.join(__dirname, '.fixtures.json'), 'utf8')) as { alice: string; bob: string };
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Better Auth's signed session cookie value: `token.HMAC-SHA256(token)` with the e2e secret. */
async function signedSessionCookie(token: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('e2e-secret-e2e-secret-e2e-secret-e2e-secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(token))).toString('base64');
  return encodeURIComponent(`${token}.${sig}`);
}

test.describe('signed out', () => {
  test('browses the catalog without watchlist controls', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Discover Movies' })).toBeAttached(); // for screen readers only
    await expect(page.getByText('The Dark Knight').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add to watchlist' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Open menu' }).click();
    const menu = page.getByRole('dialog', { name: 'Menu' });
    await expect(menu.getByRole('link', { name: 'Sign in' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Watchlist' })).toHaveCount(0);
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

  test('protects private pages', async ({ page }) => {
    for (const [from, next] of [['/watchlist', '/watchlist'], ['/account', '/account'], ['/activate?user_code=ABCD1234', '/activate?user_code=ABCD1234']]) {
      await page.goto(from);
      await expect(page).toHaveURL(`/login?next=${encodeURIComponent(next)}`);
      await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    }
  });

  test('explains invite-only sign-in errors', async ({ page }) => {
    await page.goto('/login?error=not_allowed');
    await expect(page.getByRole('alert').filter({ hasText: 'invite list' })).toHaveText('That Google account isn’t on the invite list.');
  });

  test('locks the JSON API', async ({ request }) => {
    for (const p of ['/api/v1/genres', '/api/v1/browse', '/api/v1/watchlist', '/api/v1/me']) {
      expect((await request.get(p)).status(), p).toBe(401);
    }
  });
});

test.describe('signed in', () => {

  test('keeps a personal watchlist', async ({ browser }) => {
    const context = await browser.newContext({ extraHTTPHeaders: bearer(tokens().alice) });
    const page = await context.newPage();

    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: /alice@example.com/ })).toBeVisible();
    await page.keyboard.press('Escape');

    // Saving happens on the movie page, not the poster.
    await page.goto('/movie/27205');
    const save = page.getByRole('button', { name: 'Add to watchlist' });
    // The button flips instantly (optimistic); wait for the save itself before leaving the page.
    const saved = page.waitForResponse((r) => r.request().method() === 'POST' && r.ok());
    await save.click();
    await expect(page.getByRole('button', { name: 'Remove from watchlist' })).toBeVisible();
    await saved;

    await page.goto('/watchlist');
    await expect(page.getByText('Inception')).toBeVisible();

    // Bob's watchlist is separate.
    const bob = await context.request.get('/api/v1/watchlist', { headers: bearer(tokens().bob) });
    expect((await bob.json()).movies).toEqual([]);

    await page.goto('/movie/27205');
    const removed = page.waitForResponse((r) => r.request().method() === 'POST' && r.ok());
    await page.getByRole('button', { name: 'Remove from watchlist' }).click();
    await removed;
    await page.goto('/watchlist');
    await expect(page.getByText('Nothing saved yet')).toBeVisible();
    await context.close();
  });
});

/** Acts as the TV: asks for a code, then polls for the token like the app does. */
async function startTvSignIn(request: APIRequestContext) {
  const res = await request.post('/api/auth/device/code', { data: { client_id: 'movie-recs-tv' } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as { device_code: string; user_code: string; verification_uri_complete: string; interval: number };
}
async function pollTv(request: APIRequestContext, deviceCode: string) {
  const res = await request.post('/api/auth/device/token', {
    headers: { 'user-agent': 'MovieRecsTV/1.0 (E2E TV)' },
    data: { grant_type: 'urn:ietf:params:oauth:grant-type:device_code', device_code: deviceCode, client_id: 'movie-recs-tv' },
  });
  return { status: res.status(), body: await res.json() };
}

test.describe('TV sign-in', () => {
  test('approve on the phone, then manage the TV from the account page', async ({ browser, request }) => {
    const code = await startTvSignIn(request);
    expect((await pollTv(request, code.device_code)).body.error).toBe('authorization_pending');

    const phone = await browser.newContext({ extraHTTPHeaders: bearer(tokens().alice) });
    const page = await phone.newPage();
    await page.goto(new URL(code.verification_uri_complete).pathname + new URL(code.verification_uri_complete).search);
    await expect(page.getByTestId('user-code')).toHaveText(`${code.user_code.slice(0, 4)}-${code.user_code.slice(4)}`);
    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText('Your TV is signed in.')).toBeVisible();

    await new Promise((r) => setTimeout(r, code.interval * 1000 + 500)); // respect the polling interval
    const grant = await pollTv(request, code.device_code);
    expect(grant.status).toBe(200);
    const tvToken = grant.body.access_token as string;

    const me = await request.get('/api/v1/me', { headers: bearer(tvToken) });
    expect(await me.json()).toEqual({ email: 'alice@example.com', name: 'alice' });

    await page.goto('/account');
    const tvRow = page.getByRole('listitem').filter({ hasText: 'TV · E2E TV' });
    await expect(tvRow).toBeVisible();
    await tvRow.getByRole('button', { name: 'Sign out' }).click();
    await expect(tvRow).toHaveCount(0);

    expect((await request.get('/api/v1/me', { headers: bearer(tvToken) })).status()).toBe(401);
    await phone.close();
  });

  test('deny leaves the TV signed out', async ({ browser, request }) => {
    const code = await startTvSignIn(request);
    const phone = await browser.newContext({ extraHTTPHeaders: bearer(tokens().alice) });
    const page = await phone.newPage();
    await page.goto(`/activate?user_code=${code.user_code}`);
    await page.getByRole('button', { name: 'Deny' }).click();
    await expect(page.getByText('Request denied.')).toBeVisible();
    await new Promise((r) => setTimeout(r, code.interval * 1000 + 500));
    expect((await pollTv(request, code.device_code)).body.error).toBe('access_denied');
    await phone.close();
  });

  test('typing the code by hand works too', async ({ browser, request }) => {
    const code = await startTvSignIn(request);
    const phone = await browser.newContext({ extraHTTPHeaders: bearer(tokens().alice) });
    const page = await phone.newPage();
    await page.goto('/activate');
    await page.getByLabel('Code from your TV').fill(`${code.user_code.slice(0, 4).toLowerCase()}-${code.user_code.slice(4)}`);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
    await phone.close();
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

  test('signed out: offers sign-in instead of the watchlist button', async ({ page }) => {
    await page.goto('/movie/155');
    await expect(page.getByRole('link', { name: 'Sign in to save' })).toHaveAttribute('href', '/login?next=%2Fmovie%2F155');
    await expect(page.getByRole('button', { name: 'Add to watchlist' })).toHaveCount(0);
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

  test('signed in: adds to and removes from the watchlist', async ({ browser, request }) => {
    // A real browser session cookie (as after Google sign-in), so server actions behave as they do for users.
    const context = await browser.newContext();
    await context.addCookies([{ name: '__Secure-better-auth.session_token', value: await signedSessionCookie(tokens().alice), domain: 'localhost', path: '/', secure: true, httpOnly: true, sameSite: 'Lax' }]);
    const page = await context.newPage();
    const ids = async () => {
      const res = await request.get('/api/v1/watchlist', { headers: bearer(tokens().alice) });
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

    done = saved();
    await remove.click();
    await expect(page.getByRole('button', { name: 'Add to watchlist' })).toHaveText('Add to Watchlist');
    await done;
    expect(await ids()).not.toContain(27205);
    await context.close();
  });
});
