import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db';
import { apiRateLimit } from '@/db/schema';
import { API_RATE_LIMIT } from '@/lib/api';
import { getMovieDetail } from '@/lib/tmdb';
import * as genresRoute from '@/app/api/v1/genres/route';
import * as browseRoute from '@/app/api/v1/browse/route';
import * as sectionRoute from '@/app/api/v1/browse/section/route';
import * as searchRoute from '@/app/api/v1/search/route';
import * as movieRoute from '@/app/api/v1/movies/[id]/route';
import * as watchlistRoute from '@/app/api/v1/watchlist/route';
import * as watchlistItemRoute from '@/app/api/v1/watchlist/[id]/route';
import { resetDb, type TestDb } from '../helpers/test-db';
import { seedCatalog } from '../helpers/fixtures';

// TMDB is never called for real in tests.
vi.mock('@/lib/tmdb', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/tmdb')>()),
  getMovieDetail: vi.fn(async () => {
    throw new Error('TMDB 404');
  }),
  searchMovies: vi.fn(async () => ({
    page: 1, total_pages: 1, total_results: 1,
    results: [{ id: 329865, title: 'Arrival', release_date: '2016-11-10', poster_path: '/a.jpg', vote_average: 7.6 }],
  })),
}));

const BASE = 'http://localhost:3000/api/v1';
const req = (path: string, method = 'GET', ip?: string) =>
  new Request(`${BASE}${path}`, { method, headers: ip ? { 'x-forwarded-for': ip } : {} });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as never;

beforeEach(async () => {
  await resetDb(db as unknown as TestDb);
  await seedCatalog(db as unknown as TestDb);
});

describe('open API', () => {
  it('serves reads without any credential', async () => {
    expect((await genresRoute.GET(req('/genres'))).status).toBe(200);
    expect((await browseRoute.GET(req('/browse'))).status).toBe(200);
    expect((await watchlistRoute.GET(req('/watchlist'))).status).toBe(200);
  });
});

describe('watchlist', () => {
  it('adds, lists, and removes titles', async () => {
    expect((await watchlistItemRoute.PUT(req('/watchlist/155', 'PUT'), ctx('155'))).status).toBe(204);
    expect((await watchlistItemRoute.PUT(req('/watchlist/155', 'PUT'), ctx('155'))).status).toBe(204); // idempotent

    const list = await (await watchlistRoute.GET(req('/watchlist'))).json();
    expect(list.movies).toEqual([{ tmdbId: 155, title: 'The Dark Knight', year: 2008, posterPath: '/p155.jpg', voteAverage: 8.5 }]);

    expect((await watchlistItemRoute.DELETE(req('/watchlist/155', 'DELETE'), ctx('155'))).status).toBe(204);
    expect((await (await watchlistRoute.GET(req('/watchlist'))).json()).movies).toEqual([]);
  });

  it.each(['abc', '0', '-1', '1.5', '99999999999', '1e3'])('rejects id %s', async (id) => {
    expect((await watchlistItemRoute.PUT(req(`/watchlist/${id}`, 'PUT'), ctx(id))).status).toBe(404);
  });

  it('refuses movies that do not exist', async () => {
    expect((await watchlistItemRoute.PUT(req('/watchlist/424242', 'PUT'), ctx('424242'))).status).toBe(404);
  });
});

describe('browse and search', () => {
  it('returns sections of slim cards', async () => {
    const body = await (await browseRoute.GET(req('/browse?limit=5'))).json();
    expect(body.mode).toBe('sections');
    const all = body.sections.flatMap((s: { movies: { tmdbId: number }[] }) => s.movies.map((m) => m.tmdbId));
    expect(all.sort()).toEqual([155, 27205, 496243].sort());
    expect(Object.keys(body.sections[0].movies[0]).sort()).toEqual(['posterPath', 'title', 'tmdbId', 'voteAverage', 'year']);
  });

  it('validates genre, filter and section', async () => {
    expect((await browseRoute.GET(req('/browse?genre=nope'))).status).toBe(404);
    expect((await browseRoute.GET(req('/browse?genre=action&filter=Nope'))).status).toBe(404);
    expect((await sectionRoute.GET(req('/browse/section?section=nope'))).status).toBe(404);
    expect((await sectionRoute.GET(req('/browse/section?section=top_rated&genre=action'))).status).toBe(200);
  });

  it('searches through the server-side TMDB client', async () => {
    const body = await (await searchRoute.GET(req('/search?q=arrival'))).json();
    expect(body.movies[0]).toEqual({ tmdbId: 329865, title: 'Arrival', year: 2016, posterPath: '/a.jpg', voteAverage: 7.6 });
    expect(await (await searchRoute.GET(req('/search?q=%20'))).json()).toEqual({ movies: [], page: 1, totalPages: 0 });
  });

  it('returns details with directors and top-billed cast', async () => {
    vi.mocked(getMovieDetail).mockResolvedValueOnce({
      id: 155, title: 'The Dark Knight', overview: 'Batman', release_date: '2008-07-16', runtime: 152,
      vote_average: 8.5, vote_count: 30000, genres: [{ id: 28, name: 'Action' }], poster_path: '/p.jpg', backdrop_path: null,
      videos: { results: [{ key: 'EXeTwQWrcwY', site: 'YouTube', type: 'Trailer', official: true }] },
      credits: {
        cast: [
          { id: 2, name: 'Heath Ledger', character: 'Joker', profile_path: '/h.jpg', order: 1 },
          { id: 1, name: 'Christian Bale', character: 'Bruce Wayne', profile_path: null, order: 0 },
        ],
        crew: [{ id: 3, name: 'Christopher Nolan', job: 'Director' }, { id: 4, name: 'Hans Zimmer', job: 'Original Music Composer' }],
      },
    } as never);
    const body = await (await movieRoute.GET(req('/movies/155'), ctx('155'))).json();
    expect(body.trailerKey).toBe('EXeTwQWrcwY');
    expect(body.directors).toEqual(['Christopher Nolan']);
    expect(body.cast).toEqual([
      { name: 'Christian Bale', character: 'Bruce Wayne', profilePath: null },
      { name: 'Heath Ledger', character: 'Joker', profilePath: '/h.jpg' },
    ]);
  });

  it('reports unavailable details as 404', async () => {
    expect((await movieRoute.GET(req('/movies/155'), ctx('155'))).status).toBe(404);
  });
});

describe('rate limiting', () => {
  it('returns 429 once an IP exceeds the per-minute budget', async () => {
    const windowStart = Math.floor(Date.now() / API_RATE_LIMIT.windowMs) * API_RATE_LIMIT.windowMs;
    await db.insert(apiRateLimit).values({ key: 'api:203.0.113.7', windowStart, count: API_RATE_LIMIT.max });
    expect((await genresRoute.GET(req('/genres', 'GET', '203.0.113.7'))).status).toBe(429);
  });
});
