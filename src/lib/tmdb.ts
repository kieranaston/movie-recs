const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  genre_ids: number[];
  adult: boolean;
  original_language: string;
  original_title: string;
  popularity: number;
  video: boolean;
  vote_count: number;
}

export interface TMDBSearchResponse {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

export interface TMDBVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

export interface TMDBMovieDetail extends TMDBMovie {
  genres: Array<{ id: number; name: string }>;
  runtime: number | null;
  status: string;
  tagline: string | null;
  homepage: string | null;
  imdb_id: string | null;
  production_companies: Array<{ id: number; name: string; logo_path: string | null; origin_country: string }>;
  production_countries: Array<{ iso_3166_1: string; name: string }>;
  spoken_languages: Array<{ english_name: string; iso_639_1: string; name: string }>;
  videos?: { results: TMDBVideo[] };
  'watch/providers'?: { results: TMDBWatchProvidersResponse['results'] };
}

export interface TMDBWatchProvider {
  display_priority: number;
  logo_path: string;
  provider_name: string;
  provider_id: number;
}

export interface TMDBRegionProviders {
  link: string;
  flatrate?: TMDBWatchProvider[];
  rent?: TMDBWatchProvider[];
  buy?: TMDBWatchProvider[];
  free?: TMDBWatchProvider[];
  ads?: TMDBWatchProvider[];
}

export interface TMDBWatchProvidersResponse {
  id: number;
  results: {
    [region: string]: TMDBRegionProviders | undefined;
  };
}

export interface TMDBGenre {
  id: number;
  name: string;
}

export interface TMDBGenresResponse {
  genres: TMDBGenre[];
}

function getApiKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error('TMDB_API_KEY environment variable is not set');
  }
  return key;
}

async function fetchTMDB<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = getApiKey();
  const searchParams = new URLSearchParams({
    api_key: apiKey,
    language: 'en-US',
    ...params,
  });

  const response = await fetch(`${TMDB_BASE_URL}${endpoint}?${searchParams.toString()}`, {
    headers: {
      accept: 'application/json',
    },
    next: { revalidate: 3600 }, // Cache for 1 hour
  });

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function getPopularMovies(page = 1): Promise<TMDBSearchResponse> {
  return fetchTMDB<TMDBSearchResponse>('/movie/popular', { page: page.toString() });
}

export async function searchMovies(query: string, page = 1): Promise<TMDBSearchResponse> {
  return fetchTMDB<TMDBSearchResponse>('/search/movie', { query, page: page.toString(), include_adult: 'false' });
}

export async function getMovieDetail(movieId: number): Promise<TMDBMovieDetail> {
  return fetchTMDB<TMDBMovieDetail>(`/movie/${movieId}`, { append_to_response: 'watch/providers,videos' });
}

/** Best available YouTube trailer/teaser key, or null. */
export function getTrailerKey(movie: TMDBMovieDetail): string | null {
  const vids = (movie.videos?.results ?? []).filter((v) => v.site === 'YouTube');
  const pick =
    vids.find((v) => v.type === 'Trailer' && v.official) ??
    vids.find((v) => v.type === 'Trailer') ??
    vids.find((v) => v.type === 'Teaser') ??
    vids[0];
  return pick?.key ?? null;
}

export async function getGenres(): Promise<TMDBGenresResponse> {
  return fetchTMDB<TMDBGenresResponse>('/genre/movie/list');
}

export function getPosterUrl(posterPath: string | null, size: 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w342'): string {
  if (!posterPath) {
    return '/placeholder-movie.png';
  }
  return `${TMDB_IMAGE_BASE_URL}/${size}${posterPath}`;
}

export function getBackdropUrl(backdropPath: string | null, size: 'w300' | 'w780' | 'w1280' | 'original' = 'w780'): string {
  if (!backdropPath) {
    return '/placeholder-backdrop.png';
  }
  return `${TMDB_IMAGE_BASE_URL}/${size}${backdropPath}`;
}

export function getProviderLogoUrl(logoPath: string): string {
  return `${TMDB_IMAGE_BASE_URL}/original${logoPath}`;
}

export function extractYear(releaseDate: string): string {
  return releaseDate?.split('-')[0] ?? 'Unknown';
}