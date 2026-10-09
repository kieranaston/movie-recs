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
  /** Minutes; 0/null = unknown. */
  runtime: number | null;
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

/** IMDb votes needed before its rating replaces TMDB's (≈98% of the catalog qualifies). */
export const IMDB_MIN_VOTES = 1000;

/**
 * The rating used for ranking and shown on cards: IMDb's when it has enough votes (it has ~30× more
 * voters, so fan-inflated TMDB scores get corrected), otherwise TMDB's. Vote *counts* stay TMDB's,
 * since every threshold (gates, "underseen") is tuned to TMDB numbers.
 */
export function qualityRating(tmdb: number, imdb: number | null | undefined, imdbVotes: number | null | undefined): number {
  return imdb != null && (imdbVotes ?? 0) >= IMDB_MIN_VOTES ? imdb : tmdb;
}

/** Whole catalog, cached across requests (it only changes on ingest). */
const loadCatalog = unstable_cache(
  async (): Promise<CatalogMovie[]> => {
    const [mRows, gRows, kRows, cRows] = await Promise.all([
      db.select({
        id: movies.id, tmdbId: movies.tmdbId, title: movies.title, releaseDate: movies.releaseDate,
        voteAverage: movies.voteAverage, voteCount: movies.voteCount, popularity: movies.popularity,
        posterPath: movies.posterPath, backdropPath: movies.backdropPath, originalLanguage: movies.originalLanguage,
        availableAnywhere: movies.availableAnywhere, runtime: movies.runtime,
        imdbRating: movies.imdbRating, imdbVotes: movies.imdbVotes,
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
        voteAverage: qualityRating(m.voteAverage as number, m.imdbRating, m.imdbVotes),
        voteCount: m.voteCount as number,
        popularity: m.popularity ?? 0,
        posterPath: m.posterPath,
        backdropPath: m.backdropPath,
        originalLanguage: m.originalLanguage,
        genreTmdbIds: gMap.get(m.id) ?? [],
        keywordTmdbIds: kMap.get(m.id) ?? [],
        companyTmdbIds: cMap.get(m.id) ?? [],
        available: m.availableAnywhere,
        runtime: m.runtime,
      }));
  },
  ['catalog-v5'],
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
const TV_MOVIE_GENRE = 10770;
const MIN_RUNTIME = 60; // minutes; shorts and specials are hidden (unknown runtime is allowed)
/** Feature films only: no TV movies, no shorts. */
const isFeature = (m: CatalogMovie) => !m.genreTmdbIds.includes(TV_MOVIE_GENRE) && !(m.runtime && m.runtime < MIN_RUNTIME);
const GHIBLI_COMPANY = 10342; // Studio Ghibli
const isAnime = (m: CatalogMovie) => m.genreTmdbIds.includes(ANIMATION_GENRE) && m.originalLanguage === 'ja';
const isGhibli = (m: CatalogMovie) => m.companyTmdbIds.includes(GHIBLI_COMPANY);

// The first screen of each row shows distinct films, claimed in this order. Hidden Gems only takes
// genuinely underseen films, so claiming before Top Rated keeps it stocked in small genres while
// well-known greats (which Top Rated ranks first anyway) still land in Top Rated.
const PRIORITY: SectionId[] = ['recent', 'classics', 'hidden_gems', 'top_rated', 'under_radar', 'popular'];

/** Cards per row on first load, and per "load more" page. */
export const SECTION_CARDS = 20;
const SECTION_PAGE = 20;

/**
 * Build every row's full ranked list. Rows are unlimited (they scroll through everything that fits
 * the lens, so no eligible film is unreachable); only the first screen is kept free of repeats.
 */
async function compute(genreId?: number, filter?: GenreFilter) {
  const catalog = await getCatalog();
  const target = filter ? await resolveFilterTarget(filter) : [];

  const base: ScoredMovie[] = catalog
    .filter((m) => (genreId == null || m.genreTmdbIds.includes(genreId)))
    .filter((m) => matchesFilter(m, filter, target))
    .filter((m) => S.yearInRange(m.releaseDate))
    .filter((m) => m.available) // drop unreleased / theatrical-only titles
    .filter((m) => !isAnime(m) || isGhibli(m))
    .filter(isFeature)
    .map((m) => {
      const wrVal = S.wr(m.voteAverage, m.voteCount, m.releaseDate);
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
    // Older films with a following that just miss the main quality bar.
    under_radar: sortBy(base.filter((m) => S.passesCultGate(m) && !S.passesGate(m)), (m) => m.wr),
    top_rated: sortBy(strict, (m) => m.settled),
    popular: sortBy(strict, (m) => m.voteCount),
  };

  // First screen: distinct films across rows, claimed in PRIORITY order.
  const used = new Set<number>();
  const head = {} as Record<SectionId, ScoredMovie[]>;
  for (const id of PRIORITY) {
    head[id] = cand[id].filter((m) => !used.has(m.id)).slice(0, SECTION_CARDS);
    for (const m of head[id]) used.add(m.id);
  }
  // A row whose first screen is full continues through its whole ranking (repeats allowed past it).
  // A shorter row just ends: it only runs short when everything that fits it is already on the page.
  const full = {} as Record<SectionId, ScoredMovie[]>;
  for (const id of PRIORITY) {
    const inHead = new Set(head[id].map((m) => m.id));
    full[id] = head[id].length < SECTION_CARDS ? head[id] : [...head[id], ...cand[id].filter((m) => !inHead.has(m.id))];
  }

  const matched = new Map<number, ScoredMovie>();
  for (const m of strict) matched.set(m.id, m);
  for (const m of base) if (S.passesCultGate(m) && !S.passesGate(m)) matched.set(m.id, m);

  return { full, matched };
}


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
