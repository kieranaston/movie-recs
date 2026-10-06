import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serializeSignedCookie } from 'better-call';
import { db } from '@/db';
import { auth, TV_CLIENT_ID, viewerFromHeaders } from '@/lib/auth';
import { GET as getMe } from '@/app/api/v1/me/route';
import { resetDb, type TestDb } from '../helpers/test-db';
import { createUserWithSession } from '../helpers/fixtures';

const ORIGIN = 'http://localhost:3000';

/** Call Better Auth's real HTTP handler, as the TV or a browser would. */
async function call(path: string, init: { method?: string; body?: unknown; token?: string; cookie?: string; origin?: string } = {}) {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (init.token) headers.set('authorization', `Bearer ${init.token}`);
  if (init.cookie) headers.set('cookie', init.cookie);
  if (init.origin) headers.set('origin', init.origin);
  const res = await auth.handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method: init.method ?? (init.body ? 'POST' : 'GET'),
      headers,
      body: init.body ? JSON.stringify(init.body) : undefined,
    })
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const requestCode = () => call('/device/code', { body: { client_id: TV_CLIENT_ID } });
const poll = (deviceCode: string, clientId = TV_CLIENT_ID) =>
  call('/device/token', { body: { grant_type: 'urn:ietf:params:oauth:grant-type:device_code', device_code: deviceCode, client_id: clientId } });
/** What /activate does: open the code (claims it for this user), then approve or deny. */
const review = (userCode: string, token: string) => call(`/device?user_code=${userCode}`, { token });
const decide = (userCode: string, token: string, approve: boolean, origin = ORIGIN) =>
  call(approve ? '/device/approve' : '/device/deny', { body: { userCode }, token, origin });

/** The browser's signed session cookie for a token, exactly as Better Auth would set it. */
async function sessionCookie(token: string) {
  const serialized = await serializeSignedCookie('better-auth.session_token', token, process.env.BETTER_AUTH_SECRET!);
  return serialized.split(';')[0];
}

/** Let more than the 5-second polling interval pass. */
const waitForNextPoll = () => vi.setSystemTime(Date.now() + 6_000);

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  await resetDb(db as unknown as TestDb);
});
afterEach(() => vi.useRealTimers());

describe('TV sign-in (device authorization)', () => {
  it('signs the TV in as the approving user, with its own session', async () => {
    const alice = await createUserWithSession('alice@example.com');
    const { body: code } = await requestCode();
    expect(code).toMatchObject({ interval: 5, expires_in: 600 });
    expect(code.user_code).toMatch(/^[A-Z0-9]{8}$/);
    expect(code.device_code.length).toBeGreaterThanOrEqual(40);
    expect(code.verification_uri_complete).toBe(`${ORIGIN}/activate?user_code=${code.user_code}`);

    expect((await poll(code.device_code)).body.error).toBe('authorization_pending');

    expect((await review(code.user_code, alice.token)).body.status).toBe('pending');
    expect((await decide(code.user_code, alice.token, true)).status).toBe(200);

    waitForNextPoll();
    const { body: grant } = await poll(code.device_code);
    expect(grant.token_type).toBe('Bearer');
    expect(grant.access_token).not.toBe(alice.token); // a separate, separately revocable session

    const me = await getMe(new Request(`${ORIGIN}/api/v1/me`, { headers: { authorization: `Bearer ${grant.access_token}` } }));
    expect(await me.json()).toEqual({ email: 'alice@example.com', name: 'alice' });
  });

  it('hands out a token only once', async () => {
    const alice = await createUserWithSession('alice@example.com');
    const { body: code } = await requestCode();
    await review(code.user_code, alice.token);
    await decide(code.user_code, alice.token, true);
    expect((await poll(code.device_code)).status).toBe(200);
    const replay = await poll(code.device_code);
    expect(replay.status).toBe(400);
    expect(replay.body.error).toBe('invalid_grant');
  });

  it('tells a TV that polls too fast to slow down', async () => {
    const { body: code } = await requestCode();
    await poll(code.device_code);
    expect((await poll(code.device_code)).body.error).toBe('slow_down');
  });

  it('refuses tokens when the user denies the request', async () => {
    const alice = await createUserWithSession('alice@example.com');
    const { body: code } = await requestCode();
    await review(code.user_code, alice.token);
    expect((await decide(code.user_code, alice.token, false)).status).toBe(200);
    expect((await poll(code.device_code)).body.error).toBe('access_denied');
  });

  it('only lets the user who opened the code approve it', async () => {
    const alice = await createUserWithSession('alice@example.com');
    const bob = await createUserWithSession('bob@example.com');
    const { body: code } = await requestCode();
    await review(code.user_code, alice.token);

    expect((await review(code.user_code, bob.token)).body.client_id).toBeUndefined(); // no details leak to Bob
    const hijack = await decide(code.user_code, bob.token, true);
    expect(hijack.status).toBe(403);
    expect((await poll(code.device_code)).body.error).toBe('authorization_pending');
  });

  it('rejects cookie-authenticated approvals posted from another site (CSRF)', async () => {
    const alice = await createUserWithSession('alice@example.com');
    const cookie = await sessionCookie(alice.token);
    const { body: code } = await requestCode();
    await review(code.user_code, alice.token);

    const approve = (origin: string) => call('/device/approve', { body: { userCode: code.user_code }, cookie, origin });
    expect((await approve('https://evil.example')).status).toBe(403);
    expect((await poll(code.device_code)).body.error).toBe('authorization_pending');

    expect((await approve(ORIGIN)).status).toBe(200); // same cookie from our own site works
  });

  it('requires sign-in to approve', async () => {
    const { body: code } = await requestCode();
    expect((await call('/device/approve', { body: { userCode: code.user_code }, origin: ORIGIN })).status).toBe(401);
  });

  it('only accepts the TV app as a client', async () => {
    const res = await call('/device/code', { body: { client_id: 'some-other-app' } });
    expect(res.body.error).toBe('invalid_client');
    const { body: code } = await requestCode();
    expect((await poll(code.device_code, 'some-other-app')).body.error).toBe('invalid_grant');
  });

  it('rejects unknown and expired codes', async () => {
    const alice = await createUserWithSession('alice@example.com');
    expect((await review('ZZZZZZZZ', alice.token)).body.error).toBe('invalid_request');
    expect((await poll('not-a-real-device-code')).body.error).toBe('invalid_grant');
  });
});

describe('allowlist', () => {
  const gate = (email: string, emailVerified = true) =>
    auth.options.user!.validateUserInfo!({ user: { email, emailVerified }, source: { action: 'sign-in', method: 'oauth' } } as never);

  it('lets only listed, verified Google accounts sign in', async () => {
    expect(await gate('alice@example.com')).toBeUndefined();
    expect(await gate('mallory@example.com')).toMatchObject({ error: 'not_allowed' });
    expect(await gate('alice@example.com', false)).toMatchObject({ error: 'not_allowed' });
  });

  it('refuses sessions for emails not on the list', async () => {
    await expect(createUserWithSession('mallory@example.com')).rejects.toThrow();
  });

  it('matches emails case-insensitively', async () => {
    await expect(createUserWithSession('BOB@example.com')).resolves.toBeTruthy();
  });

  it('cuts off existing sessions when an email is removed from the list', async () => {
    const alice = await createUserWithSession('alice@example.com');
    const headers = new Headers({ authorization: `Bearer ${alice.token}` });
    expect(await viewerFromHeaders(headers)).toMatchObject({ email: 'alice@example.com' });

    const saved = process.env.ALLOWED_EMAILS;
    process.env.ALLOWED_EMAILS = 'bob@example.com';
    try {
      expect(await viewerFromHeaders(headers)).toBeNull();
    } finally {
      process.env.ALLOWED_EMAILS = saved;
    }
  });
});

describe('sessions', () => {
  it('rejects revoked and made-up tokens', async () => {
    const alice = await createUserWithSession('alice@example.com');
    const headers = new Headers({ authorization: `Bearer ${alice.token}` });
    await auth.api.revokeSession({ body: { token: alice.token }, headers });
    expect(await viewerFromHeaders(headers)).toBeNull();
    expect(await viewerFromHeaders(new Headers({ authorization: 'Bearer made-up' }))).toBeNull();
    expect(await viewerFromHeaders(new Headers())).toBeNull();
  });
});
