import { allowRequest } from './rate-limit';
import { genreBySlug, type GenrePage } from './taxonomy';
import { yearOf } from './scoring';

/**
 * Helpers for the /api/v1 JSON API (consumed by the Android TV app).
 * Single-profile app: reads are open, writes need the owner token (see auth.ts). `guard()` keeps a per-IP budget
 * so a stray script can't burn the TMDB quota.
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

/** Catalog reads are the same for everyone and change only on ingest, so the CDN may keep them briefly. */
export const CACHEABLE = { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } };

export const error = (status: number, message: string) => Response.json({ error: message }, { status });

/** Per-IP API budget: generous for a TV remote, tight enough to stop scripted abuse. */
export const API_RATE_LIMIT = { max: 120, windowMs: 60_000 };

/** An error Response if this request is over budget (429), otherwise null. */
export async function guard(request: Request): Promise<Response | null> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!(await allowRequest(`api:${ip}`, API_RATE_LIMIT.max, API_RATE_LIMIT.windowMs))) {
    return error(429, 'Too many requests');
  }
  return null;
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
