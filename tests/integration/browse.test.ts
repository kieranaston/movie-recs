import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db';
import { genres, movieGenres, movies } from '@/db/schema';
import { getBrowsePage } from '@/lib/browse';
import { resetDb, type TestDb } from '../helpers/test-db';

let nextId = 1;
/** Insert Action films; `votes` decides whether a film is famous or underseen. */
async function seed(films: { title: string; votes: number; year?: number; avg?: number }[]) {
  const [action] = await db.select().from(genres);
  const rows = await db
    .insert(movies)
    .values(films.map((f) => ({
      tmdbId: nextId++, title: f.title, releaseDate: `${f.year ?? 2012}-06-01`,
      voteAverage: f.avg ?? 8.2, voteCount: f.votes, popularity: 10, availableAnywhere: true,
    })))
    .returning();
  await db.insert(movieGenres).values(rows.map((r) => ({ movieId: r.id, genreId: action.id })));
}

const titles = (section: { movies: { title: string }[] } | undefined) => (section?.movies ?? []).map((m) => m.title);

beforeEach(async () => {
  await resetDb(db as unknown as TestDb);
  await db.insert(genres).values({ tmdbId: 28, name: 'Action' });
});

describe('genre sections', () => {
  it('puts underseen films in Hidden Gems and well-known ones in Top Rated', async () => {
    await seed([
      ...Array.from({ length: 8 }, (_, i) => ({ title: `Famous ${i}`, votes: 20_000 })),
      ...Array.from({ length: 4 }, (_, i) => ({ title: `Underseen ${i}`, votes: 400, avg: 7.8 })),
    ]);
    const page = await getBrowsePage({ genreId: 28, limit: 100 });
    const byId = Object.fromEntries(page.sections.map((s) => [s.id, s]));

    expect(titles(byId.hidden_gems).sort()).toEqual(['Underseen 0', 'Underseen 1', 'Underseen 2', 'Underseen 3']);
    expect(titles(byId.top_rated).every((t) => t.startsWith('Famous'))).toBe(true);
    expect(titles(byId.top_rated)).toHaveLength(8);
  });

  it('never shows a film twice on a page', async () => {
    await seed([
      ...Array.from({ length: 30 }, (_, i) => ({ title: `Famous ${i}`, votes: 15_000 + i * 100, year: 2005 + (i % 20) })),
      ...Array.from({ length: 30 }, (_, i) => ({ title: `Underseen ${i}`, votes: 300 + i * 10, avg: 7.9, year: 2000 + (i % 25) })),
    ]);
    const all = (await getBrowsePage({ genreId: 28, limit: 1000 })).sections.flatMap(titles);
    expect(new Set(all).size).toBe(all.length);
  });

  it('caps each genre row at 60 so one row cannot swallow the rest', async () => {
    await seed(Array.from({ length: 90 }, (_, i) => ({ title: `Famous ${i}`, votes: 20_000 + i })));
    const page = await getBrowsePage({ genreId: 28, limit: 1000 });
    const topRated = page.sections.find((s) => s.id === 'top_rated')!;
    expect(topRated.total).toBe(60);
    expect(page.sections.find((s) => s.id === 'popular')!.total).toBe(30); // the rest still get a row
  });
});
