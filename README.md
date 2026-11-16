# Movie Discovery

A personal movie-browsing app: browse by genre, filtered to films worth your time, with the underseen gems surfaced. Built with Next.js, Tailwind, Drizzle + PostgreSQL, and TMDB.

**Live site: [mrecs.vercel.app](https://mrecs.vercel.app)**

## Features

- **Genre tabs** with per-genre filters (e.g. Horror → Found Footage, Slasher; Animation → Disney, Pixar, Ghibli).
- **Quality-gated sections** — every page shows *Top Rated · Hidden Gems · Fun · Classics · Recent · Popular*, each a different lens over the same catalog.
- **Smart scoring** (TMDB-only): a Bayesian weighted rating, a recency/confidence penalty, and an age-relative "underseen" score. A global gate hides low-quality titles; a relaxed, age-aware gate feeds the Fun row.
- **Unreleased titles hidden** — films that aren't out yet are dropped from every row.
- **One watchlist** — a single shared list for the site and the TV; no sign-in.
- **Android TV app** — a native Compose-for-TV client ([`android-tv/`](android-tv/README.md)).
- **Trailers** — play a movie's YouTube trailer from its page.
- **Fast** — cached catalog, slim card payloads, incremental section loading.

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19, TypeScript)
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **Tests**: Vitest + PGlite (in-memory Postgres), Playwright
- **API**: TMDB (The Movie Database) — the only data source

## Getting Started

### Prerequisites

- Node.js 22+
- PostgreSQL (Neon recommended)
- TMDB API key ([themoviedb.org](https://www.themoviedb.org/settings/api))

### Setup

```bash
npm install
cp .env.example .env      # then fill it in (see below)
npm run db:push           # create the schema
npm run ingest            # populate the catalog (TMDB)
npm run dev               # http://localhost:3000
```

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (Neon **pooled**) |
| `TMDB_API_KEY` | TMDB v3 key — server-side only |
| `DATABASE_POOL_MAX` | Optional connection-pool size (default 10) |

**Develop against a Neon branch, not production.** Put the branch's connection string in `.env.development.local`
(gitignored; Next.js prefers it over `.env` when running `npm run dev`).

## Single profile

This is a personal app, so there are no accounts: the watchlist and watched/ratings are one shared set of rows
(`user_watchlist`, `user_watched`). `/api/v1` is open but rate-limited per IP, so a stray script can't burn the TMDB quota.

- **Headers:** `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, strict referrer and permissions policies.
- **Secrets** live only in server env vars. `.env*` files are gitignored.

## Testing

```bash
npm test               # unit + integration (Vitest, in-memory Postgres via PGlite — no network or secrets)
npm run test:coverage  # same, with coverage
npm run test:e2e       # production build + Playwright, against a seeded in-memory Postgres
```

Integration tests run the real schema and route handlers: watchlist add/remove, validation, section building, and rate limits.
CI (`.github/workflows/ci.yml`) runs all of it plus the Android checks on every push and pull request.

## Data ingest

`npm run ingest` populates the database from TMDB. Stages, in order:

1. **genres** — upsert the TMDB genre list
2. **pool** — pull `/discover` slices (per-genre + facet keywords) → `movies`, `movie_genres`
3. **metadata** — keywords + production companies → `keywords`, `movie_companies`, …
4. **imdb** — IMDb's public ratings dataset → `movies.imdb_rating` / `imdb_votes`
5. **stats** — report the vote-weighted mean

It is **resumable**: movies already enriched (`metadata_fetched_at`) are skipped. Useful flags:

```bash
npm run ingest -- --limit 200          # cap movies pulled
npm run ingest -- --genre-pages 20     # widen per-genre depth
npm run ingest -- --skip-metadata      # skip the keyword/company stage
npm run ingest -- --skip-imdb          # skip the IMDb ratings stage
```

A full run takes about two minutes.

### Weekly refresh (GitHub Actions)

`.github/workflows/ingest.yml` runs the ingest against production every **Sunday 03:00 UTC** (and on demand from the
Actions tab). It needs two repository secrets (*Settings → Secrets and variables → Actions*):

| Secret | Value |
| --- | --- |
| `DATABASE_URL` | Production Neon **pooled** connection string |
| `TMDB_API_KEY` | Your TMDB key |

The site shows the new data within an hour (the catalog is cached for 60 minutes).

## Deployment

The app is **server-rendered with a database and server actions**, so it needs a Node host — GitHub Pages (static-only) will not work. Recommended: **Vercel + Neon**.

1. **Database** — create a project at [neon.tech](https://neon.tech) and copy the **pooled** connection string.
2. **Schema** — point `DATABASE_URL` at production and push:
   ```bash
   DATABASE_URL="postgresql://...neon.tech/..." npx drizzle-kit push
   ```
3. **Data** — run the ingest against production (needs your TMDB key):
   ```bash
   DATABASE_URL="postgresql://...neon.tech/..." TMDB_API_KEY="..." npm run ingest
   ```
4. **Deploy** — import the repo at [vercel.com/new](https://vercel.com/new) and add the environment variables above.

> **Env vars must never be committed.** `.env` is gitignored.

## Project Structure

```
src/
├── app/
│   ├── page.tsx                # Home — six sections over the whole catalog
│   ├── genre/[slug]/page.tsx   # Per-genre pages (sections or a flat filtered grid)
│   ├── watchlist/              # Saved films (+ server actions)
│   ├── watched/                # Watched + ratings (+ server actions)
│   ├── api/v1/                 # JSON API for the TV app
│   ├── movie/[id]/page.tsx     # Detail: overview, trailer, watchlist, watched/rating
│   ├── search/page.tsx         # TMDB title search
│   └── browse-actions.ts       # Server action: incremental section loading
├── components/                 # SectionRow, cards, movie details, …
├── lib/
│   ├── tmdb.ts                 # TMDB client
│   ├── scoring.ts              # WR / settled / obscurity / gates
│   ├── taxonomy.ts             # Genre pages + their filters + sections
│   ├── browse.ts               # Catalog load, scoring, section building
│   ├── rate-limit.ts           # Postgres-backed API rate limiter
│   ├── api.ts                  # /api/v1 helpers (guard, validation)
│   ├── watchlist.ts            # The watchlist
│   └── watched.ts              # Watched + ratings
└── db/
    ├── index.ts                # Drizzle connection
    └── schema.ts               # Tables
scripts/
└── ingest.ts                   # TMDB → Postgres ingest
tests/                          # unit/, integration/ (Vitest), e2e/ (Playwright), helpers/
android-tv/                     # Android TV app
```

## Available Scripts

```bash
npm run dev        # Development server
npm run build      # Production build
npm run start      # Production server
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm test           # Unit + integration tests
npm run test:e2e   # End-to-end tests
npm run db:push    # Push schema to the database
npm run db:studio  # Drizzle Studio
npm run ingest     # Populate/refresh the catalog from TMDB
```

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.

Ratings information courtesy of [IMDb](https://www.imdb.com). Used with permission. (IMDb's public datasets are licensed for personal, non-commercial use.)

## License

MIT
