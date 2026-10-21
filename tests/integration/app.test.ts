import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { legacyWatchlist, session, userWatchlist, userWatched } from '@/db/schema';
import { allowRequest } from '@/lib/rate-limit';
import { claimLegacyWatchlist } from '@/lib/legacy-watchlist';
import { addToWatchlist, removeFromWatchlist } from '@/app/watchlist/actions';
import { setRating, setWatched } from '@/app/watched/actions';
import { revokeDevice } from '@/app/account/actions';
import { resetDb, type TestDb } from '../helpers/test-db';
import { createSession, createUserWithSession, seedCatalog } from '../helpers/fixtures';
import { actAs } from '../helpers/next-stubs';

beforeEach(async () => {
  await resetDb(db as unknown as TestDb);
  actAs(null);
});

describe('allowRequest', () => {
  it('allows up to the limit per window, then resets', async () => {
    const t = 1_000_000_000_000;
    for (let i = 0; i < 3; i++) expect(await allowRequest('k', 3, 60_000, t)).toBe(true);
    expect(await allowRequest('k', 3, 60_000, t + 1_000)).toBe(false);
    expect(await allowRequest('k', 3, 60_000, t + 60_000)).toBe(true); // next window
  });

  it('keeps keys independent', async () => {
    expect(await allowRequest('a', 1, 60_000, 0)).toBe(true);
    expect(await allowRequest('a', 1, 60_000, 0)).toBe(false);
    expect(await allowRequest('b', 1, 60_000, 0)).toBe(true);
  });
});

describe('watchlist server actions', () => {
  it('require a signed-in user', async () => {
    await expect(addToWatchlist(155)).rejects.toThrow('Unauthorized');
    await expect(removeFromWatchlist(155)).rejects.toThrow('Unauthorized');
  });

  it('write only to the caller’s own list', async () => {
    await seedCatalog(db as unknown as TestDb);
    const alice = await createUserWithSession('alice@example.com');
    actAs(alice.token);
    await addToWatchlist(155);
    const rows = await db.select().from(userWatchlist);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: alice.user.id, tmdbId: 155, title: 'The Dark Knight' });
  });
});

describe('watched server actions', () => {
  it('require a signed-in user', async () => {
    await expect(setWatched(155, true)).rejects.toThrow('Unauthorized');
    await expect(setRating(155, 4)).rejects.toThrow('Unauthorized');
  });

  it('records watched + rating', async () => {
    await seedCatalog(db as unknown as TestDb);
    const alice = await createUserWithSession('alice@example.com');
    actAs(alice.token);

    await setWatched(155, true);

    const watched = await db.select().from(userWatched);
    expect(watched).toHaveLength(1);
    expect(watched[0]).toMatchObject({ userId: alice.user.id, tmdbId: 155, title: 'The Dark Knight', rating: null });

    await setRating(155, 7.8);
    expect((await db.select().from(userWatched))[0].rating).toBeCloseTo(7.8, 5);

    await expect(setRating(155, 10.5)).rejects.toThrow('Invalid rating'); // out of range
    await expect(setRating(155, 7.85)).rejects.toThrow('Invalid rating'); // more than one decimal
    expect((await db.select().from(userWatched))[0].rating).toBeCloseTo(7.8, 5);

    await setWatched(155, false);
    expect(await db.select().from(userWatched)).toHaveLength(0);
  });
});

describe('revokeDevice', () => {
  it('signs out another of your own devices', async () => {
    const alice = await createUserWithSession('alice@example.com');
    const tv = await createSession(alice.user.id, 'MovieRecsTV/1.0 (Chromecast)');
    actAs(alice.token);
    await revokeDevice(tv.sessionId);
    expect(await db.select().from(session).where(eq(session.id, tv.sessionId))).toEqual([]);
  });

  it('cannot touch someone else’s session', async () => {
    const alice = await createUserWithSession('alice@example.com');
    const bob = await createUserWithSession('bob@example.com');
    actAs(alice.token);
    await revokeDevice(bob.sessionId);
    expect(await db.select().from(session).where(eq(session.id, bob.sessionId))).toHaveLength(1);
  });

  it('requires a signed-in user', async () => {
    await expect(revokeDevice('anything')).rejects.toThrow('Unauthorized');
  });
});

describe('claimLegacyWatchlist', () => {
  it('copies the old shared list into one account, idempotently', async () => {
    const alice = await createUserWithSession('alice@example.com');
    await db.insert(legacyWatchlist).values([
      { tmdbId: 9016, title: 'Treasure Planet', releaseDate: '2002-11-26', voteAverage: 7.6 },
      { tmdbId: 155, title: 'The Dark Knight' },
    ]);
    expect(await claimLegacyWatchlist('ALICE@example.com')).toBe(2);
    expect(await claimLegacyWatchlist('alice@example.com')).toBe(2);
    const rows = await db.select().from(userWatchlist);
    expect(rows.map((r) => r.tmdbId).sort()).toEqual([155, 9016]);
    expect(rows.every((r) => r.userId === alice.user.id)).toBe(true);
  });

  it('requires the account to exist', async () => {
    await expect(claimLegacyWatchlist('nobody@example.com')).rejects.toThrow('No account');
  });
});

describe('session renewal', () => {
  it('keeps a day-old session signed in when it is renewed', async () => {
    const { auth } = await import('@/lib/auth');
    const { token, sessionId } = await createUserWithSession('alice@example.com');
    // Signed in two days ago: due for renewal (renewed at most once a day).
    await db.update(session).set({ expiresAt: new Date(Date.now() + 28 * 86_400_000) }).where(eq(session.id, sessionId));
    const headers = new Headers({ authorization: `Bearer ${token}` });

    expect((await auth.api.getSession({ headers }))?.user.email).toBe('alice@example.com');
    const [renewed] = await db.select().from(session).where(eq(session.id, sessionId));
    expect(renewed.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
    expect((await auth.api.getSession({ headers }))?.user.email).toBe('alice@example.com');
  });
});
