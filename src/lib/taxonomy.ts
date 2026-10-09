/**
 * Taxonomy — per-genre pages and their single-select filters.
 *
 * A page = (genre) + optional one filter, rendering the fixed SECTION rows below.
 * Filters are mutually exclusive (pick one, or none) per the current design.
 */

export type FilterKind = 'company' | 'keyword' | 'language';

export interface GenreFilter {
  label: string;
  kind: FilterKind;
  /** One name, or several (a studio can span multiple company entities). */
  value: string | string[];
}

export type SectionId = 'top_rated' | 'hidden_gems' | 'under_radar' | 'classics' | 'recent' | 'popular';

export interface GenrePage {
  slug: string;
  name: string;
  tmdbId: number;
  filters: GenreFilter[];
}

export const SECTIONS: { id: SectionId; label: string; blurb: string }[] = [
  { id: 'top_rated', label: 'Top Rated', blurb: 'Best reviews overall' },
  { id: 'hidden_gems', label: 'Hidden Gems', blurb: 'Underseen but loved' },
  { id: 'under_radar', label: 'Under the Radar', blurb: 'Older films with a following that just miss the main lists' },
  { id: 'classics', label: 'Classics', blurb: '30+ years of staying power' },
  { id: 'recent', label: 'Recent', blurb: 'The last few years' },
  { id: 'popular', label: 'Popular', blurb: 'Most watched' },
];

export const GENRE_PAGES: GenrePage[] = [
  { slug: 'action', name: 'Action', tmdbId: 28, filters: [
    { label: 'Superhero', kind: 'keyword', value: 'superhero' },
  ] },
  { slug: 'adventure', name: 'Adventure', tmdbId: 12, filters: [] },
  { slug: 'animation', name: 'Animation', tmdbId: 16, filters: [
    { label: 'Disney', kind: 'company', value: [
      'Walt Disney Pictures', 'Walt Disney Animation Studios', 'Walt Disney Productions',
      'Walt Disney Feature Animation', 'DisneyToon Studios',
    ] },
    { label: 'Pixar', kind: 'company', value: 'Pixar' },
    { label: 'Ghibli', kind: 'company', value: 'Studio Ghibli' },
    { label: 'Superhero', kind: 'keyword', value: 'superhero' },
  ] },
  { slug: 'comedy', name: 'Comedy', tmdbId: 35, filters: [
    { label: 'Dark Comedy', kind: 'keyword', value: 'dark comedy' },
  ] },
  { slug: 'crime', name: 'Crime', tmdbId: 80, filters: [
    { label: 'Serial Killer', kind: 'keyword', value: 'serial killer' },
  ] },
  { slug: 'documentary', name: 'Documentary', tmdbId: 99, filters: [] },
  { slug: 'drama', name: 'Drama', tmdbId: 18, filters: [] },
  { slug: 'fantasy', name: 'Fantasy', tmdbId: 14, filters: [] },
  { slug: 'horror', name: 'Horror', tmdbId: 27, filters: [
    { label: 'Supernatural', kind: 'keyword', value: 'supernatural' },
    { label: 'Psychological', kind: 'keyword', value: 'psychological horror' },
    { label: 'Slasher', kind: 'keyword', value: 'slasher' },
    { label: 'Found Footage', kind: 'keyword', value: 'found footage' },
  ] },
  { slug: 'romance', name: 'Romance', tmdbId: 10749, filters: [] },
  { slug: 'science-fiction', name: 'Science Fiction', tmdbId: 878, filters: [
    { label: 'Dystopia', kind: 'keyword', value: 'dystopia' },
    { label: 'Space', kind: 'keyword', value: 'space' },
    { label: 'Cyberpunk', kind: 'keyword', value: 'cyberpunk' },
  ] },
  { slug: 'thriller', name: 'Thriller', tmdbId: 53, filters: [
    { label: 'Psychological', kind: 'keyword', value: 'psychological thriller' },
    { label: 'Serial Killer', kind: 'keyword', value: 'serial killer' },
  ] },
  { slug: 'war', name: 'War', tmdbId: 10752, filters: [] },
  { slug: 'western', name: 'Western', tmdbId: 37, filters: [] },
];

export function genreBySlug(slug: string): GenrePage | undefined {
  return GENRE_PAGES.find((g) => g.slug === slug);
}
