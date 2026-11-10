import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db';
import { userWatchlist, userWatched } from '@/db/schema';
import { allowRequest } from '@/lib/rate-limit';
import { addToWatchlist, removeFromWatchlist } from '@/app/watchlist/actions';
import { setRating, setWatched } from '@/app/watched/actions';
import { resetDb, type TestDb } from '../helpers/test-db';
import { seedCatalog } from '../helpers/fixtures';

beforeEach(async () => {
  await resetDb(db as unknown as TestDb);
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
  it('saves and removes a title', async () => {
    await seedCatalog(db as unknown as TestDb);
    await addToWatchlist(155);
    const rows = await db.select().from(userWatchlist);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ tmdbId: 155, title: 'The Dark Knight' });

    await removeFromWatchlist(155);
    expect(await db.select().from(userWatchlist)).toHaveLength(0);
  });
});

describe('watched server actions', () => {
  it('records watched + rating', async () => {
    await seedCatalog(db as unknown as TestDb);

    await setWatched(155, true);

    const watched = await db.select().from(userWatched);
    expect(watched).toHaveLength(1);
    expect(watched[0]).toMatchObject({ tmdbId: 155, title: 'The Dark Knight', rating: null });

    await setRating(155, 7.8);
    expect((await db.select().from(userWatched))[0].rating).toBeCloseTo(7.8, 5);

    await expect(setRating(155, 10.5)).rejects.toThrow('Invalid rating'); // out of range
    await expect(setRating(155, 7.85)).rejects.toThrow('Invalid rating'); // more than one decimal
    expect((await db.select().from(userWatched))[0].rating).toBeCloseTo(7.8, 5);

    await setWatched(155, false);
    expect(await db.select().from(userWatched)).toHaveLength(0);
  });
});
