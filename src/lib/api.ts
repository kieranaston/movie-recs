import { viewerFromHeaders, type Viewer } from './auth';
import { allowRequest } from './rate-limit';
import { genreBySlug, type GenrePage } from './taxonomy';
import { yearOf } from './scoring';

/**
 * Helpers for the /api/v1 JSON API (consumed by the Android TV app).
 * Every route calls `requireUser()` first: requests must carry the user's own session
 * (bearer token from the TV sign-in, or the website's cookie). No shared secrets.
 */

/** The one card shape every list endpoint returns. Image paths are TMDB paths (client builds the URL). */
export interface ApiCard {
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  voteAverage: number | null;
}

export function toApiCard(m: {
  tmdbId: number;
  title: string;
  releaseDate: string | null;
  posterPath: string | null;
  voteAverage: number | null;
}): ApiCard {
  return { tmdbId: m.tmdbId, title: m.title, year: yearOf(m.releaseDate), posterPath: m.posterPath, voteAverage: m.voteAverage };
}

export const error = (status: number, message: string) => Response.json({ error: message }, { status });

/** Per-user API budget: generous for a TV remote, tight enough to stop scripted abuse. */
export const API_RATE_LIMIT = { max: 120, windowMs: 60_000 };

/** The signed-in user, or an error Response (401 not signed in, 429 over the rate limit). */
export async function requireUser(request: Request): Promise<Viewer | Response> {
  const viewer = await viewerFromHeaders(request.headers);
  if (!viewer) return error(401, 'Unauthorized');
  if (!(await allowRequest(`api:${viewer.id}`, API_RATE_LIMIT.max, API_RATE_LIMIT.windowMs))) {
    return error(429, 'Too many requests');
  }
  return viewer;
}

/** Parse a positive integer, or null. */
export function parseId(value: string | null | undefined): number | null {
  if (!value || !/^\d{1,10}$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function parseInt0(value: string | null, fallback: number, max: number): number {
  const n = value == null ? NaN : Number(value);
  return Number.isInteger(n) && n >= 0 ? Math.min(n, max) : fallback;
}

/** `?genre=` → genre page; missing → undefined (whole catalog); unknown → null (404). */
export function parseGenre(slug: string | null): GenrePage | undefined | null {
  if (!slug) return undefined;
  return genreBySlug(slug) ?? null;
}
