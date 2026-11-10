import { genres, movieGenres, movies } from '@/db/schema';
import type { TestDb } from './test-db';

export const SEED_MOVIES = [
  { tmdbId: 155, title: 'The Dark Knight', releaseDate: '2008-07-16' },
  { tmdbId: 27205, title: 'Inception', releaseDate: '2010-07-15' },
  { tmdbId: 496243, title: 'Parasite', releaseDate: '2019-05-30' },
];

/** A tiny catalog whose films clear the quality gates (rating 8.5, 20k votes). */
export async function seedCatalog(db: TestDb) {
  const [action] = await db.insert(genres).values({ tmdbId: 28, name: 'Action' }).returning();
  const rows = await db
    .insert(movies)
    .values(SEED_MOVIES.map((m) => ({ ...m, voteAverage: 8.5, voteCount: 20_000, popularity: 100, posterPath: `/p${m.tmdbId}.jpg` })))
    .returning();
  await db.insert(movieGenres).values(rows.map((r) => ({ movieId: r.id, genreId: action.id })));
  return rows;
}
