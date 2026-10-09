import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  genres,
  keywords,
  movieCompanies,
  movieGenres,
  movieKeywords,
  movies,
  productionCompanies,
} from '@/db/schema';
import * as S from './scoring';
import { GenreFilter, SECTIONS, SectionId } from './taxonomy';

export interface CatalogMovie {
  id: number;
  tmdbId: number;
  title: string;
  releaseDate: string | null;
  year: number | null;
  voteAverage: number;
  voteCount: number;
  popularity: number;
  posterPath: string | null;
  backdropPath: string | null;
  originalLanguage: string | null;
  genreTmdbIds: number[];
  keywordTmdbIds: number[];
  companyTmdbIds: number[];
  available: boolean;
}

/** What a poster card actually needs — kept tiny so it's cheap to serialize to the client. */
export interface CardMovie {
  id: number;
  tmdbId: number;
  title: string;
  releaseDate: string | null;
  year: number | null;
  posterPath: string | null;
  voteAverage: number;
}

export function toCard(m: CatalogMovie): CardMovie {
  return {
    id: m.id,
    tmdbId: m.tmdbId,
    title: m.title,
    releaseDate: m.releaseDate,
    year: m.year,
    posterPath: m.posterPath,
    voteAverage: m.voteAverage,
  };
}

export interface SectionResult {
  id: SectionId;
  label: string;
  blurb: string;
  total: number;
  movies: CardMovie[];
}

interface ScoredMovie extends CatalogMovie {
  wr: number;
  settled: number;
  age: number | null;
}

const push = <T>(map: Map<number, T[]>, key: number, value: T) => {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
};

/** Whole catalog, cached across requests (it only changes on ingest). */
const loadCatalog = unstable_cache(
  async (): Promise<CatalogMovie[]> => {
    const [mRows, gRows, kRows, cRows] = await Promise.all([
      db.select({
        id: movies.id, tmdbId: movies.tmdbId, title: movies.title, releaseDate: movies.releaseDate,
        voteAverage: movies.voteAverage, voteCount: movies.voteCount, popularity: movies.popularity,
        posterPath: movies.posterPath, backdropPath: movies.backdropPath, originalLanguage: movies.originalLanguage,
        availableAnywhere: movies.availableAnywhere,
      }).from(movies),
      db.select({ movieId: movieGenres.movieId, tmdbId: genres.tmdbId })
        .from(movieGenres).innerJoin(genres, eq(genres.id, movieGenres.genreId)),
      db.select({ movieId: movieKeywords.movieId, tmdbId: keywords.tmdbId })
        .from(movieKeywords).innerJoin(keywords, eq(keywords.id, movieKeywords.keywordId)),
      db.select({ movieId: movieCompanies.movieId, tmdbId: productionCompanies.tmdbId })
        .from(movieCompanies).innerJoin(productionCompanies, eq(productionCompanies.id, movieCompanies.companyId)),
    ]);

    const gMap = new Map<number, number[]>();
    const kMap = new Map<number, number[]>();
    const cMap = new Map<number, number[]>();
    for (const r of gRows) push(gMap, r.movieId, r.tmdbId);
    for (const r of kRows) push(kMap, r.movieId, r.tmdbId);
    for (const r of cRows) push(cMap, r.movieId, r.tmdbId);

    return mRows
      .filter((m) => m.voteAverage != null && m.voteCount != null)
      .map((m) => ({
        id: m.id,
        tmdbId: m.tmdbId,
        title: m.title,
        releaseDate: m.releaseDate,
        year: S.yearOf(m.releaseDate),
        voteAverage: m.voteAverage as number,
        voteCount: m.voteCount as number,
        popularity: m.popularity ?? 0,
        posterPath: m.posterPath,
        backdropPath: m.backdropPath,
        originalLanguage: m.originalLanguage,
        genreTmdbIds: gMap.get(m.id) ?? [],
        keywordTmdbIds: kMap.get(m.id) ?? [],
        companyTmdbIds: cMap.get(m.id) ?? [],
        available: m.availableAnywhere,
      }));
  },
  ['catalog-v3'],
  { revalidate: 3600, tags: ['catalog'] }
);

export const getCatalog = cache(loadCatalog);

async function resolveFilterTarget(filter: GenreFilter): Promise<number[] | string> {
  const names = Array.isArray(filter.value) ? filter.value : [filter.value];
  if (filter.kind === 'company') {
    const rows = await db.select({ tmdbId: productionCompanies.tmdbId })
      .from(productionCompanies).where(inArray(productionCompanies.name, names));
    return rows.map((r) => r.tmdbId);
  }
  if (filter.kind === 'keyword') {
    const rows = await db.select({ tmdbId: keywords.tmdbId })
      .from(keywords).where(inArray(keywords.name, names));
    return rows.map((r) => r.tmdbId);
  }
  return names[0]; // language code
}

function matchesFilter(m: CatalogMovie, filter: GenreFilter | undefined, target: number[] | string): boolean {
  if (!filter) return true;
  if (filter.kind === 'company') return (target as number[]).some((id) => m.companyTmdbIds.includes(id));
  if (filter.kind === 'keyword') return (target as number[]).some((id) => m.keywordTmdbIds.includes(id));
  return m.originalLanguage === target;
}

const ANIMATION_GENRE = 16;
const GHIBLI_COMPANY = 10342; // Studio Ghibli
const isAnime = (m: CatalogMovie) => m.genreTmdbIds.includes(ANIMATION_GENRE) && m.originalLanguage === 'ja';
const isGhibli = (m: CatalogMovie) => m.companyTmdbIds.includes(GHIBLI_COMPANY);

// Rows claim films in this order (each film shows in one row per page). Hidden Gems only takes
// genuinely underseen films, so claiming before Top Rated keeps it stocked in small genres while
// well-known greats (which Top Rated ranks first anyway) still land in Top Rated.
const PRIORITY: SectionId[] = ['recent', 'classics', 'hidden_gems', 'top_rated', 'cult', 'popular'];

/** Max films per row: Home draws on the whole catalog; genre pages are smaller, so no row may swallow the rest. */
const SECTION_MAX_HOME = 300;
const SECTION_MAX_GENRE = 60;

/** Build every section's full, deduped candidate list (uncapped — callers slice it). */
async function compute(genreId?: number, filter?: GenreFilter) {
  const catalog = await getCatalog();
  const target = filter ? await resolveFilterTarget(filter) : [];

  const base: ScoredMovie[] = catalog
    .filter((m) => (genreId == null || m.genreTmdbIds.includes(genreId)))
    .filter((m) => matchesFilter(m, filter, target))
    .filter((m) => S.yearInRange(m.releaseDate))
    .filter((m) => m.available) // drop unreleased / theatrical-only titles
    .filter((m) => !isAnime(m) || isGhibli(m))
    .map((m) => {
      const wrVal = S.wr(m.voteAverage, m.voteCount);
      return { ...m, wr: wrVal, settled: S.settled(wrVal, m.voteCount), age: S.ageOf(m.releaseDate) };
    })
    .filter((m) => m.age != null) as ScoredMovie[];

  const strict = base.filter((m) => S.passesGate(m));
  const medians = S.computeEraMedians(strict.map((m) => ({ age: m.age as number, votes: m.voteCount })));
  const voteTarget = (m: ScoredMovie) => S.eraTarget(S.medianForAge(medians, m.age as number));
  const gemScore = (m: ScoredMovie) => m.settled * S.obscurity(m.voteCount, voteTarget(m));
  // "Underseen": fewer votes than is typical for a well-regarded film of its age.
  const underseen = (m: ScoredMovie) => m.voteCount < voteTarget(m);

  const sortBy = (rows: ScoredMovie[], key: (m: ScoredMovie) => number) => [...rows].sort((a, b) => key(b) - key(a));

  const cand: Record<SectionId, ScoredMovie[]> = {
    recent: sortBy(strict.filter((m) => (m.age as number) <= S.RECENT_MAX_AGE), (m) => m.settled),
    classics: sortBy(strict.filter((m) => (m.age as number) >= S.CLASSIC_MIN_AGE), (m) => m.wr),
    hidden_gems: sortBy(strict.filter(underseen), gemScore),
    cult: sortBy(base.filter((m) => S.passesCultGate(m) && !S.passesGate(m)), (m) => m.wr),
    top_rated: sortBy(strict, (m) => m.settled),
    popular: sortBy(strict, (m) => m.voteCount),
  };

  // Each film appears in only one row per page, claimed in PRIORITY order and capped per row.
  const SECTION_MAX = genreId == null && !filter ? SECTION_MAX_HOME : SECTION_MAX_GENRE;
  const used = new Set<number>();
  const full = {} as Record<SectionId, ScoredMovie[]>;
  for (const id of PRIORITY) {
    const list: ScoredMovie[] = [];
    for (const m of cand[id]) {
      if (used.has(m.id)) continue;
      used.add(m.id);
      list.push(m);
      if (list.length >= SECTION_MAX) break;
    }
    full[id] = list;
  }

  const matched = new Map<number, ScoredMovie>();
  for (const m of strict) matched.set(m.id, m);
  for (const m of base) if (S.passesCultGate(m) && !S.passesGate(m)) matched.set(m.id, m);

  return { full, matched };
}

/** Cards rendered per section before any "load more". */
export const SECTION_CARDS = 20;
const SECTION_PAGE = 20;

export interface BrowseResult {
  mode: 'sections' | 'list';
  sections: SectionResult[];
  movies: CardMovie[];
  total: number;
}

export async function getBrowsePage(opts: {
  genreId?: number;
  filter?: GenreFilter;
  limit?: number;
} = {}): Promise<BrowseResult> {
  const { genreId, filter, limit = SECTION_CARDS } = opts;
  const { full, matched } = await compute(genreId, filter);
  const total = matched.size;

  if (filter) {
    const movies = [...matched.values()].sort((a, b) => b.settled - a.settled).map(toCard);
    return { mode: 'list', sections: [], movies, total };
  }

  const sections: SectionResult[] = SECTIONS.map((s) => ({
    id: s.id,
    label: s.label,
    blurb: s.blurb,
    total: full[s.id].length,
    movies: full[s.id].slice(0, limit).map(toCard),
  }));

  return { mode: 'sections', sections, movies: [], total };
}

/** Next page of one section — used by the client's "load more". */
export async function getSectionMovies(opts: {
  genreId?: number;
  sectionId: SectionId;
  offset: number;
  limit?: number;
}): Promise<{ movies: CardMovie[]; total: number }> {
  const { genreId, sectionId, offset, limit = SECTION_PAGE } = opts;
  const { full } = await compute(genreId, undefined);
  const rows = full[sectionId] ?? [];
  return { movies: rows.slice(offset, offset + limit).map(toCard), total: rows.length };
}
