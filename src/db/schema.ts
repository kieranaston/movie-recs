import { pgTable, serial, varchar, text, timestamp, integer, real, boolean } from 'drizzle-orm/pg-core';

export const movies = pgTable('movies', {
  id: serial('id').primaryKey(),
  tmdbId: integer('tmdb_id').unique().notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  overview: text('overview'),
  posterPath: varchar('poster_path', { length: 500 }),
  backdropPath: varchar('backdrop_path', { length: 500 }),
  releaseDate: varchar('release_date', { length: 20 }),
  voteAverage: real('vote_average'),
  voteCount: integer('vote_count'),
  popularity: real('popularity'),
  adult: boolean('adult').default(false),
  originalLanguage: varchar('original_language', { length: 10 }),
  originalTitle: varchar('original_title', { length: 500 }),
  video: boolean('video').default(false),
  status: varchar('status', { length: 50 }),
  tagline: text('tagline'),
  runtime: integer('runtime'),
  homepage: varchar('homepage', { length: 500 }),
  imdbId: varchar('imdb_id', { length: 20 }),
  metadataFetchedAt: timestamp('metadata_fetched_at'),
  providersFetchedAt: timestamp('providers_fetched_at'),
  availableAnywhere: boolean('available_anywhere').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const genres = pgTable('genres', {
  id: serial('id').primaryKey(),
  tmdbId: integer('tmdb_id').unique().notNull(),
  name: varchar('name', { length: 100 }).notNull(),
});

export const movieGenres = pgTable('movie_genres', {
  id: serial('id').primaryKey(),
  movieId: integer('movie_id').references(() => movies.id, { onDelete: 'cascade' }).notNull(),
  genreId: integer('genre_id').references(() => genres.id, { onDelete: 'cascade' }).notNull(),
});

// TMDB keywords — the lexicon behind per-genre facet options (superhero, found footage, ...)
export const keywords = pgTable('keywords', {
  id: serial('id').primaryKey(),
  tmdbId: integer('tmdb_id').unique().notNull(),
  name: varchar('name', { length: 200 }).notNull(),
});

export const movieKeywords = pgTable('movie_keywords', {
  id: serial('id').primaryKey(),
  movieId: integer('movie_id').references(() => movies.id, { onDelete: 'cascade' }).notNull(),
  keywordId: integer('keyword_id').references(() => keywords.id, { onDelete: 'cascade' }).notNull(),
});

// Production companies — studio facets (Disney, Pixar, Ghibli, A24, ...)
export const productionCompanies = pgTable('production_companies', {
  id: serial('id').primaryKey(),
  tmdbId: integer('tmdb_id').unique().notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  logoPath: varchar('logo_path', { length: 500 }),
  originCountry: varchar('origin_country', { length: 10 }),
});

export const movieCompanies = pgTable('movie_companies', {
  id: serial('id').primaryKey(),
  movieId: integer('movie_id').references(() => movies.id, { onDelete: 'cascade' }).notNull(),
  companyId: integer('company_id').references(() => productionCompanies.id, { onDelete: 'cascade' }).notNull(),
});

// Single-user watchlist (no accounts): one row per saved title.
export const watchlist = pgTable('watchlist', {
  id: serial('id').primaryKey(),
  tmdbId: integer('tmdb_id').unique().notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  posterPath: varchar('poster_path', { length: 500 }),
  releaseDate: varchar('release_date', { length: 20 }),
  voteAverage: real('vote_average'),
  addedAt: timestamp('added_at').defaultNow().notNull(),
});

export const watchProviders = pgTable('watch_providers', {
  id: serial('id').primaryKey(),
  tmdbId: integer('tmdb_id').unique().notNull(),
  providerName: varchar('provider_name', { length: 100 }).notNull(),
  logoPath: varchar('logo_path', { length: 500 }),
  displayPriority: integer('display_priority'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const movieWatchProviders = pgTable('movie_watch_providers', {
  id: serial('id').primaryKey(),
  movieId: integer('movie_id').references(() => movies.id, { onDelete: 'cascade' }).notNull(),
  watchProviderId: integer('watch_provider_id').references(() => watchProviders.id, { onDelete: 'cascade' }).notNull(),
  region: varchar('region', { length: 10 }).default('CA').notNull(),
  providerType: varchar('provider_type', { length: 20 }), // flatrate, free, ads, rent, buy
});

// External ratings (IMDb / Metacritic / Rotten Tomatoes) were removed — the app
// is TMDB-only. See git history for the OMDb divergence-gate experiment.

export type Movie = typeof movies.$inferSelect;
export type NewMovie = typeof movies.$inferInsert;
export type Genre = typeof genres.$inferSelect;
export type NewGenre = typeof genres.$inferInsert;
export type Keyword = typeof keywords.$inferSelect;
export type NewKeyword = typeof keywords.$inferInsert;
export type ProductionCompany = typeof productionCompanies.$inferSelect;
export type NewProductionCompany = typeof productionCompanies.$inferInsert;
export type WatchProvider = typeof watchProviders.$inferSelect;
export type NewWatchProvider = typeof watchProviders.$inferInsert;
export type WatchlistItem = typeof watchlist.$inferSelect;
export type NewWatchlistItem = typeof watchlist.$inferInsert;