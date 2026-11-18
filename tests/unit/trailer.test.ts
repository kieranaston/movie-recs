import { describe, expect, it } from 'vitest';
import { getTrailerKey, type TMDBMovieDetail, type TMDBVideo } from '@/lib/tmdb';

const video = (key: string, extra: Partial<TMDBVideo> = {}): TMDBVideo => ({
  id: key, key, name: key, site: 'YouTube', type: 'Trailer', official: true, ...extra,
});
const movie = (...results: TMDBVideo[]) => ({ videos: { results } }) as TMDBMovieDetail;

describe('getTrailerKey', () => {
  it('prefers the highest resolution official trailer', () => {
    expect(getTrailerKey(movie(video('sd', { size: 480 }), video('hd', { size: 1080 }), video('mid', { size: 720 })))).toBe('hd');
  });

  it('breaks resolution ties with the newest upload', () => {
    expect(getTrailerKey(movie(
      video('old', { size: 1080, published_at: '2020-01-01T00:00:00.000Z' }),
      video('new', { size: 1080, published_at: '2021-01-01T00:00:00.000Z' }),
    ))).toBe('new');
  });

  it('an official trailer beats a higher-resolution unofficial one', () => {
    expect(getTrailerKey(movie(video('fan', { official: false, size: 2160 }), video('studio', { size: 720 })))).toBe('studio');
  });

  it('falls back to a teaser, ignores non-YouTube, and returns null with nothing', () => {
    expect(getTrailerKey(movie(video('tease', { type: 'Teaser' }), video('vimeo', { site: 'Vimeo', size: 2160 })))).toBe('tease');
    expect(getTrailerKey(movie())).toBeNull();
  });
});
