import { pgTable, serial, varchar, text, timestamp, integer, real, boolean, bigint, index, uniqueIndex } from 'drizzle-orm/pg-core';

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

// ---------- Auth (Better Auth; columns mirror its model definitions) ----------

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
}, (t) => [index('session_user_id_idx').on(t.userId)]);

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').notNull(),
}, (t) => [index('account_user_id_idx').on(t.userId)]);

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('verification_identifier_idx').on(t.identifier)]);

/** TV sign-in requests (RFC 8628 device authorization). */
export const deviceCode = pgTable('device_code', {
  id: text('id').primaryKey(),
  deviceCode: text('device_code').notNull().unique(),
  userCode: text('user_code').notNull().unique(),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  status: text('status').notNull(),
  lastPolledAt: timestamp('last_polled_at'),
  pollingInterval: integer('polling_interval'),
  clientId: text('client_id'),
  scope: text('scope'),
});

/** Better Auth's own rate limiter (shared across serverless instances). */
export const rateLimit = pgTable('rate_limit', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});

// ---------- App data ----------

/** Each user's saved titles. Title/poster are a snapshot so the list renders without TMDB calls. */
export const userWatchlist = pgTable('user_watchlist', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  tmdbId: integer('tmdb_id').notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  posterPath: varchar('poster_path', { length: 500 }),
  releaseDate: varchar('release_date', { length: 20 }),
  voteAverage: real('vote_average'),
  addedAt: timestamp('added_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('user_watchlist_user_movie_idx').on(t.userId, t.tmdbId),
  index('user_watchlist_user_added_idx').on(t.userId, t.addedAt),
]);

/** Fixed-window request counters for the JSON API, keyed by user or IP. */
export const apiRateLimit = pgTable('api_rate_limit', {
  key: text('key').primaryKey(),
  windowStart: bigint('window_start', { mode: 'number' }).notNull(),
  count: integer('count').notNull(),
});

/**
 * @deprecated Pre-accounts single-user watchlist. Kept only so `npm run watchlist:claim`
 * can copy it into a user's account; drop it once that has run in production.
 */
export const legacyWatchlist = pgTable('watchlist', {
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
export type WatchlistItem = typeof userWatchlist.$inferSelect;
export type User = typeof user.$inferSelect;