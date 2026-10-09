/**
 * TMDB -> Postgres ingest. TMDB-only (no external rating sources).
 *
 * Stages:
 *   1. genres   - upsert the TMDB genre list
 *   2. pool     - pull /discover slices, upsert movies + movie_genres
 *   3. metadata - fetch keywords + production companies (facet lexicon)
 *   4. providers - CA streaming availability: new titles, plus re-checks (weekly for
 *                  unavailable/recent titles, monthly for the rest)
 *   5. stats    - report C (vote-weighted mean)
 *
 * Usage:
 *   npm run ingest
 *   npm run ingest -- --limit 200        # cap movies pulled
 *   npm run ingest -- --skip-metadata
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql, inArray } from 'drizzle-orm';
import * as fs from 'node:fs';
import * as schema from '../src/db/schema';
import type { TMDBMovie, TMDBMovieDetail, TMDBRegionProviders, TMDBWatchProvider, TMDBWatchProvidersResponse } from '../src/lib/tmdb';
import { genres, movieCompanies, movieGenres, movieKeywords, movieWatchProviders, movies, keywords, productionCompanies, watchProviders } from '../src/db/schema';

// ---------- env ----------
function loadEnv(path = '.env') {
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const val = m[2].replace(/^["']|["']$/g, '');
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}
loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;
const TMDB_KEY = process.env.TMDB_API_KEY;
if (!DATABASE_URL || !TMDB_KEY) {
  console.error('Missing DATABASE_URL or TMDB_API_KEY');
  process.exit(1);
}

const client = postgres(DATABASE_URL, { prepare: false, max: 5 });
const db = drizzle(client, { schema });

// ---------- args ----------
const args = process.argv.slice(2);
const argVal = (name: string, def: number) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? parseInt(args[i + 1], 10) : def;
};
const LIMIT = argVal('--limit', 0);            // 0 = no cap
const PAGES = argVal('--pages', 0);            // 0 = per-slice defaults
const SKIP_METADATA = args.includes('--skip-metadata');
const SKIP_PROVIDERS = args.includes('--skip-providers');

const TMDB = 'https://api.themoviedb.org/3';

type MovieWithKeywords = TMDBMovieDetail & { keywords?: { keywords: { id: number; name: string }[] } };

async function tmdbGet<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const qs = new URLSearchParams({ api_key: TMDB_KEY!, language: 'en-US' });
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${TMDB}${path}?${qs}`);
      if (!res.ok) throw new Error(`TMDB ${res.status}`);
      return (await res.json()) as T;
    } catch (e) {
      if (attempt === 2) throw e;
      await sleep(600 * (attempt + 1));
    }
  }
  throw new Error('unreachable');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// ---------- stage 1: genres ----------
async function ingestGenres() {
  const data = await tmdbGet<{ genres: { id: number; name: string }[] }>('/genre/movie/list');
  await db
    .insert(genres)
    .values(data.genres.map((g) => ({ tmdbId: g.id, name: g.name })))
    .onConflictDoUpdate({ target: genres.tmdbId, set: { name: sql`excluded.name` } });
  console.log(`[genres] upserted ${data.genres.length}`);
}

// ---------- stage 2: pool ----------
const SLICES: { label: string; params: Record<string, string | number>; pages: number }[] = [
  { label: 'vote_average.desc', params: { sort_by: 'vote_average.desc', 'vote_count.gte': 200 }, pages: 20 },
  { label: 'vote_count.desc', params: { sort_by: 'vote_count.desc' }, pages: 12 },
  // Well-established acclaim: catches well-loved films (e.g. Paddington 2) that rank below the
  // overall top-rated cut but aren't among the most-voted either.
  { label: 'acclaimed', params: { sort_by: 'vote_average.desc', 'vote_count.gte': 1500 }, pages: 50 },
  { label: 'popularity.desc', params: { sort_by: 'popularity.desc' }, pages: 10 },
  { label: 'release.desc', params: { sort_by: 'primary_release_date.desc', 'vote_count.gte': 200 }, pages: 12 },
];

// Per-genre + facet-keyword slices so every genre/filter has breadth, not just
// the highest-rated films.
// TMDB genres to pull (TV Movie, 10770, is deliberately excluded).
const GENRE_IDS = [28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 53, 10752, 37];
const GENRE_PAGES = argVal('--genre-pages', 15);
const GENRE_VOTE_PAGES = argVal('--genre-vote-pages', 10);
const FACET_KEYWORDS = [
  'found footage', 'slasher', 'psychological horror', 'supernatural', 'superhero',
  'dystopia', 'space', 'cyberpunk', 'serial killer', 'dark comedy',
  'psychological thriller',
];

async function buildSlices(): Promise<{ label: string; params: Record<string, string | number>; pages: number }[]> {
  const list = [...SLICES];
  for (const g of GENRE_IDS) {
    list.push({
      label: `genre ${g} rating`,
      params: { with_genres: g, sort_by: 'vote_average.desc', 'vote_count.gte': 200 },
      pages: GENRE_PAGES,
    });
    list.push({
      label: `genre ${g} votes`,
      params: { with_genres: g, sort_by: 'vote_count.desc' },
      pages: GENRE_VOTE_PAGES,
    });
  }
  // targeted slices for the taxonomy's facet keywords (pulls in the canon)
  const kwRows = await db.select({ tmdbId: keywords.tmdbId, name: keywords.name }).from(keywords);
  const want = new Set(FACET_KEYWORDS);
  for (const k of kwRows) {
    if (want.has(k.name.toLowerCase())) {
      list.push({
        label: `keyword ${k.name}`,
        params: { with_keywords: k.tmdbId, sort_by: 'vote_count.desc' },
        pages: 5,
      });
    }
  }
  return list;
}

async function ingestPool() {
  const slices = await buildSlices();
  const seen = new Map<number, TMDBMovie>();
  for (const slice of slices) {
    const pages = LIMIT ? Math.min(slice.pages, Math.ceil(LIMIT / 20)) : (PAGES || slice.pages);
    for (let p = 1; p <= pages; p++) {
      const d = await tmdbGet<{ results?: TMDBMovie[] }>('/discover/movie', {
        ...slice.params, page: p, include_adult: 'false',
      });
      for (const m of d.results ?? []) seen.set(m.id, m);
      await sleep(40);
    }
    console.log(`[pool] ${slice.label}: cumulative unique ${seen.size}`);
  }

  let rows = [...seen.values()].map((m) => ({
    tmdbId: m.id,
    title: m.title ?? '',
    overview: m.overview ?? null,
    posterPath: m.poster_path ?? null,
    backdropPath: m.backdrop_path ?? null,
    releaseDate: m.release_date ?? null,
    voteAverage: typeof m.vote_average === 'number' ? m.vote_average : null,
    voteCount: typeof m.vote_count === 'number' ? m.vote_count : null,
    popularity: typeof m.popularity === 'number' ? m.popularity : null,
    adult: !!m.adult,
    originalLanguage: m.original_language ?? null,
    originalTitle: m.original_title ?? null,
    video: !!m.video,
    updatedAt: new Date(),
  }));
  if (LIMIT) rows = rows.slice(0, LIMIT);
  console.log(`[pool] upserting ${rows.length} movies`);

  const idByTmdb = new Map<number, number>();
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const returned = await db
      .insert(movies)
      .values(chunk)
      .onConflictDoUpdate({
        target: movies.tmdbId,
        set: {
          title: sql`excluded.title`,
          overview: sql`excluded.overview`,
          posterPath: sql`excluded.poster_path`,
          backdropPath: sql`excluded.backdrop_path`,
          releaseDate: sql`excluded.release_date`,
          voteAverage: sql`excluded.vote_average`,
          voteCount: sql`excluded.vote_count`,
          popularity: sql`excluded.popularity`,
          adult: sql`excluded.adult`,
          originalLanguage: sql`excluded.original_language`,
          originalTitle: sql`excluded.original_title`,
          video: sql`excluded.video`,
          updatedAt: new Date(),
        },
      })
      .returning({ id: movies.id, tmdbId: movies.tmdbId });
    for (const r of returned) idByTmdb.set(r.tmdbId, r.id);
  }

  // map genre tmdbId -> local id
  const genreRows = await db.select({ id: genres.id, tmdbId: genres.tmdbId }).from(genres);
  const genreId = new Map(genreRows.map((g) => [g.tmdbId, g.id]));

  // rebuild movie_genres for the ingested movies
  const movieIds = [...idByTmdb.values()];
  await db.delete(movieGenres).where(inArray(movieGenres.movieId, movieIds));
  const rels: { movieId: number; genreId: number }[] = [];
  for (const m of seen.values()) {
    const mid = idByTmdb.get(m.id);
    if (!mid) continue;
    for (const g of m.genre_ids ?? []) {
      const gid = genreId.get(g);
      if (gid) rels.push({ movieId: mid, genreId: gid });
    }
  }
  for (let i = 0; i < rels.length; i += 1000) {
    await db.insert(movieGenres).values(rels.slice(i, i + 1000));
  }
  console.log(`[pool] linked ${rels.length} movie-genre rows`);
}

// ---------- stage 2b: keywords + companies (facet lexicon) ----------
async function ingestMetadata() {
  const METADATA_LIMIT = argVal('--metadata-limit', 0);
  const todo = await db.execute<{ id: number; tmdb_id: number }>(sql`
    select m.id, m.tmdb_id from ${movies} m
    where m.metadata_fetched_at is null
       or m.runtime is null -- one-time backfill: runtime/IMDb id weren't stored before
    order by m.vote_count desc nulls last
    ${METADATA_LIMIT ? sql`limit ${METADATA_LIMIT}` : sql``}
  `);
  const rows = todo as unknown as { id: number; tmdb_id: number }[];
  console.log(`[metadata] ${rows.length} movies to fetch`);
  if (!rows.length) return;

  const BATCH = 100;
  for (let start = 0; start < rows.length; start += BATCH) {
    const batch = rows.slice(start, start + BATCH);
    const kwMap = new Map<number, string>();
    const coMap = new Map<number, TMDBMovieDetail['production_companies'][number]>();
    const perMovie: { movieId: number; keywordIds: number[]; companyIds: number[] }[] = [];
    const details: { movieId: number; runtime: number; imdbId: string | null }[] = [];

    const results = await mapLimit(batch, 8, async (r) => ({
      r, det: await tmdbGet<MovieWithKeywords>(`/movie/${r.tmdb_id}`, { append_to_response: 'keywords' }),
    }));
    for (const { r, det } of results) {
      const kws = det.keywords?.keywords ?? [];
      const cos = det.production_companies ?? [];
      for (const k of kws) kwMap.set(k.id, k.name);
      for (const c of cos) coMap.set(c.id, c);
      perMovie.push({
        movieId: r.id,
        keywordIds: kws.map((k) => k.id),
        companyIds: cos.map((c) => c.id),
      });
      details.push({ movieId: r.id, runtime: det.runtime ?? 0, imdbId: det.imdb_id ?? null }); // 0 = unknown
    }

    if (kwMap.size) {
      await db
        .insert(keywords)
        .values([...kwMap.entries()].map(([id, name]) => ({ tmdbId: id, name })))
        .onConflictDoNothing({ target: keywords.tmdbId });
    }
    if (coMap.size) {
      await db
        .insert(productionCompanies)
        .values([...coMap.values()].map((c) => ({
          tmdbId: c.id, name: c.name ?? '', logoPath: c.logo_path ?? null,
          originCountry: c.origin_country ?? null,
        })))
        .onConflictDoUpdate({
          target: productionCompanies.tmdbId,
          set: {
            name: sql`excluded.name`, logoPath: sql`excluded.logo_path`,
            originCountry: sql`excluded.origin_country`,
          },
        });
    }

    const kwIds = [...kwMap.keys()];
    const coIds = [...coMap.keys()];
    const kwLocal = kwIds.length
      ? await db.select({ id: keywords.id, tmdbId: keywords.tmdbId }).from(keywords).where(inArray(keywords.tmdbId, kwIds))
      : [];
    const coLocal = coIds.length
      ? await db.select({ id: productionCompanies.id, tmdbId: productionCompanies.tmdbId }).from(productionCompanies).where(inArray(productionCompanies.tmdbId, coIds))
      : [];
    const kwIdMap = new Map(kwLocal.map((k) => [k.tmdbId, k.id]));
    const coIdMap = new Map(coLocal.map((c) => [c.tmdbId, c.id]));

    const movieIds = perMovie.map((p) => p.movieId);
    await db.delete(movieKeywords).where(inArray(movieKeywords.movieId, movieIds));
    await db.delete(movieCompanies).where(inArray(movieCompanies.movieId, movieIds));

    const kwRels: { movieId: number; keywordId: number }[] = [];
    const coRels: { movieId: number; companyId: number }[] = [];
    for (const p of perMovie) {
      for (const k of p.keywordIds) { const lid = kwIdMap.get(k); if (lid) kwRels.push({ movieId: p.movieId, keywordId: lid }); }
      for (const c of p.companyIds) { const lid = coIdMap.get(c); if (lid) coRels.push({ movieId: p.movieId, companyId: lid }); }
    }
    if (kwRels.length) await db.insert(movieKeywords).values(kwRels);
    if (coRels.length) await db.insert(movieCompanies).values(coRels);

    await db.update(movies).set({ metadataFetchedAt: new Date() }).where(inArray(movies.id, movieIds));
    if (details.length) {
      // One statement per batch: update ... from (values ...).
      const values = sql.join(details.map((d) => sql`(${d.movieId}::int, ${d.runtime}::int, ${d.imdbId}::varchar)`), sql`, `);
      await db.execute(sql`
        update ${movies} set runtime = v.runtime, imdb_id = v.imdb_id
        from (values ${values}) as v(id, runtime, imdb_id)
        where ${movies.id} = v.id
      `);
    }
    console.log(`[metadata] ${Math.min(start + BATCH, rows.length)}/${rows.length} (kw ${kwRels.length}, co ${coRels.length})`);
  }
}

// ---------- stage 3b: streaming availability (CA) ----------
const PROVIDER_TYPES = ['flatrate', 'free', 'ads', 'rent', 'buy'] as const satisfies readonly (keyof TMDBRegionProviders)[];

// Availability drifts (theatrical → streaming, titles leaving services), so re-check on a schedule:
// titles that are unavailable or recent change most often; everything else is re-checked monthly.
const RECHECK_VOLATILE_DAYS = 7;
const RECHECK_ALL_DAYS = 30;
const RECENT_YEARS = 2;

async function ingestProviders() {
  const LIMIT = argVal('--providers-limit', 0);
  const todo = await db.execute<{ id: number; tmdb_id: number }>(sql`
    select id, tmdb_id from ${movies}
    where providers_fetched_at is null
       or providers_fetched_at < now() - make_interval(days => ${RECHECK_ALL_DAYS})
       or (
         providers_fetched_at < now() - make_interval(days => ${RECHECK_VOLATILE_DAYS})
         and (not available_anywhere
              or release_date >= to_char(current_date - make_interval(years => ${RECENT_YEARS}), 'YYYY-MM-DD'))
       )
    order by providers_fetched_at asc nulls first, vote_count desc nulls last
    ${LIMIT ? sql`limit ${LIMIT}` : sql``}
  `);
  const rows = todo as unknown as { id: number; tmdb_id: number }[];
  console.log(`[providers] ${rows.length} movies to check`);
  if (!rows.length) return;

  const BATCH = 200;
  for (let start = 0; start < rows.length; start += BATCH) {
    const batch = rows.slice(start, start + BATCH);
    const results = await mapLimit(batch, 8, async (r) => {
      const d = await tmdbGet<TMDBWatchProvidersResponse>(`/movie/${r.tmdb_id}/watch/providers`);
      return { r, regions: d.results ?? {} };
    });

    const provMap = new Map<number, TMDBWatchProvider>();
    const perMovie: { movieId: number; entries: { tmdbId: number; type: string }[]; available: boolean }[] = [];
    for (const { r, regions } of results) {
      const entries: { tmdbId: number; type: string }[] = [];
      const seen = new Set<string>();
      const ca = regions.CA;
      if (ca) {
        for (const type of PROVIDER_TYPES) {
          for (const p of ca[type] ?? []) {
            provMap.set(p.provider_id, p);
            const key = `${p.provider_id}:${type}`;
            if (!seen.has(key)) { seen.add(key); entries.push({ tmdbId: p.provider_id, type }); }
          }
        }
      }
      // "Released / watchable somewhere" = any region offers any of the types.
      const available = Object.values(regions).some((reg) =>
        PROVIDER_TYPES.some((t) => (reg?.[t]?.length ?? 0) > 0)
      );
      perMovie.push({ movieId: r.id, entries, available });
    }

    if (provMap.size) {
      await db
        .insert(watchProviders)
        .values([...provMap.values()].map((p) => ({
          tmdbId: p.provider_id, providerName: p.provider_name,
          logoPath: p.logo_path ?? null, displayPriority: p.display_priority ?? null,
        })))
        .onConflictDoUpdate({
          target: watchProviders.tmdbId,
          set: {
            providerName: sql`excluded.provider_name`,
            logoPath: sql`excluded.logo_path`,
            displayPriority: sql`excluded.display_priority`,
          },
        });
    }

    const provIds = [...provMap.keys()];
    const provLocal = provIds.length
      ? await db.select({ id: watchProviders.id, tmdbId: watchProviders.tmdbId }).from(watchProviders).where(inArray(watchProviders.tmdbId, provIds))
      : [];
    const provIdMap = new Map(provLocal.map((p) => [p.tmdbId, p.id]));

    const movieIds = perMovie.map((p) => p.movieId);
    await db.delete(movieWatchProviders).where(inArray(movieWatchProviders.movieId, movieIds));
    const rels: { movieId: number; watchProviderId: number; region: string; providerType: string }[] = [];
    for (const p of perMovie) {
      for (const e of p.entries) {
        const pid = provIdMap.get(e.tmdbId);
        if (pid) rels.push({ movieId: p.movieId, watchProviderId: pid, region: 'CA', providerType: e.type });
      }
    }
    if (rels.length) await db.insert(movieWatchProviders).values(rels);

    const availIds = perMovie.filter((p) => p.available).map((p) => p.movieId);
    const unavailIds = perMovie.filter((p) => !p.available).map((p) => p.movieId);
    if (availIds.length) {
      await db.update(movies).set({ providersFetchedAt: new Date(), availableAnywhere: true }).where(inArray(movies.id, availIds));
    }
    if (unavailIds.length) {
      await db.update(movies).set({ providersFetchedAt: new Date(), availableAnywhere: false }).where(inArray(movies.id, unavailIds));
    }
    console.log(`[providers] ${Math.min(start + BATCH, rows.length)}/${rows.length} (rels ${rels.length}, available ${availIds.length})`);
  }
}

// ---------- stage 4: stats ----------
async function reportStats() {
  const c = await db.execute<{ c: number; n: number; votes: number }>(sql`
    select sum(vote_average * vote_count) / nullif(sum(vote_count), 0) as c,
           count(*)::int as n, sum(vote_count)::bigint as votes
    from ${movies} where vote_count > 0 and vote_average is not null
  `);
  const row = (c as unknown as { c: number; n: number; votes: number }[])[0];
  console.log(`\n[stats] C (vote-weighted) = ${Number(row.c).toFixed(3)} over ${row.n} movies`);
  const counts = await db.execute<{ n: number }>(sql`select count(*)::int as n from ${movies}`);
  console.log(`[stats] movies=${(counts as unknown as { n: number }[])[0].n}`);
}

// ---------- run ----------
(async () => {
  console.time('ingest');
  await ingestGenres();
  await ingestPool();
  if (!SKIP_METADATA) await ingestMetadata();
  if (!SKIP_PROVIDERS) await ingestProviders();
  await reportStats();
  console.timeEnd('ingest');
  await client.end();
})().catch(async (e) => {
  console.error('INGEST FAILED:', e);
  await client.end();
  process.exit(1);
});
