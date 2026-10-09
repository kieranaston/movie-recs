import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { genres, movieGenres, movies } from '@/db/schema';
import { getBrowsePage, qualityRating } from '@/lib/browse';
import { resetDb, type TestDb } from '../helpers/test-db';

let nextId = 1;
/** Insert Action films; `votes` decides whether a film is famous or underseen. */
async function seed(films: { title: string; votes: number; year?: number; avg?: number; imdb?: number; imdbVotes?: number }[]) {
  const [action] = await db.select().from(genres);
  const rows = await db
    .insert(movies)
    .values(films.map((f) => ({
      tmdbId: nextId++, title: f.title, releaseDate: `${f.year ?? 2012}-06-01`,
      voteAverage: f.avg ?? 8.2, voteCount: f.votes, popularity: 10, availableAnywhere: true,
      imdbRating: f.imdb ?? null, imdbVotes: f.imdbVotes ?? null,
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

  it('keeps the first screen of every row free of repeats', async () => {
    await seed([
      ...Array.from({ length: 30 }, (_, i) => ({ title: `Famous ${i}`, votes: 15_000 + i * 100, year: 2005 + (i % 20) })),
      ...Array.from({ length: 30 }, (_, i) => ({ title: `Underseen ${i}`, votes: 300 + i * 10, avg: 7.9, year: 2000 + (i % 25) })),
    ]);
    const firstScreen = (await getBrowsePage({ genreId: 28 })).sections.flatMap(titles); // default: 20 per row
    expect(new Set(firstScreen).size).toBe(firstScreen.length);
  });

  it('does not cap rows: scrolling reaches every eligible film', async () => {
    await seed(Array.from({ length: 90 }, (_, i) => ({ title: `Famous ${i}`, votes: 20_000 + i })));
    const page = await getBrowsePage({ genreId: 28, limit: 1000 });
    expect(page.sections.find((s) => s.id === 'top_rated')!.total).toBe(90);
    const reachable = new Set(page.sections.flatMap(titles));
    expect(reachable.size).toBe(page.total);
  });

  it('pages through a row without gaps or repeats', async () => {
    await seed(Array.from({ length: 55 }, (_, i) => ({ title: `Famous ${i}`, votes: 20_000 + i })));
    const { getSectionMovies } = await import('@/lib/browse');
    const seen: string[] = [];
    for (let offset = 0; ; offset += 20) {
      const { movies, total } = await getSectionMovies({ genreId: 28, sectionId: 'popular', offset });
      seen.push(...movies.map((m) => m.title));
      if (offset + 20 >= total) break;
    }
    expect(seen).toHaveLength(55);
    expect(new Set(seen).size).toBe(55);
  });
});

describe('IMDb rating', () => {
  it('replaces the TMDB rating when IMDb has enough votes', () => {
    expect(qualityRating(8.4, 5.8, 4395)).toBe(5.8); // fan-inflated on TMDB
    expect(qualityRating(8.1, 7.8, 384_056)).toBe(7.8);
    expect(qualityRating(7.9, 6.0, 120)).toBe(7.9); // too few IMDb votes: keep TMDB
    expect(qualityRating(7.9, null, null)).toBe(7.9); // no IMDb data
  });

  it('keeps fan-inflated titles out while well-loved ones stay', async () => {
    await seed([
      { title: 'Fan Favourite', votes: 2_500, avg: 8.4, imdb: 5.8, imdbVotes: 4_400 },
      { title: 'Beloved Romance', votes: 9_000, avg: 8.1, imdb: 7.8, imdbVotes: 384_000 },
      { title: 'No IMDb Data', votes: 3_000, avg: 7.9 },
    ]);
    const page = await getBrowsePage({ genreId: 28, limit: 100 });
    const all = new Set(page.sections.flatMap(titles));
    expect(all.has('Fan Favourite')).toBe(false);
    expect(all.has('Beloved Romance')).toBe(true);
    expect(all.has('No IMDb Data')).toBe(true);
    // Cards show the rating that was used.
    const romance = page.sections.flatMap((s) => s.movies).find((m) => m.title === 'Beloved Romance')!;
    expect(romance.voteAverage).toBe(7.8);
  });
});

describe('feature films only', () => {
  it('hides TV movies and anything under an hour', async () => {
    const [tv] = await db.insert(genres).values({ tmdbId: 10770, name: 'TV Movie' }).returning();
    await seed([{ title: 'Feature', votes: 9_000 }, { title: 'Short', votes: 9_000 }, { title: 'TV Special', votes: 9_000 }]);
    const rows = await db.select().from(movies);
    await db.update(movies).set({ runtime: 110 }).where(eq(movies.title, 'Feature'));
    await db.update(movies).set({ runtime: 7 }).where(eq(movies.title, 'Short'));
    await db.insert(movieGenres).values({ movieId: rows.find((r) => r.title === 'TV Special')!.id, genreId: tv.id });
    const all = new Set((await getBrowsePage({ genreId: 28, limit: 100 })).sections.flatMap(titles));
    expect([...all]).toEqual(['Feature']);
  });
});
