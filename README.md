# Movie Discovery

An intelligent movie-browsing app: browse by genre, filtered to films worth your time, with the underseen gems surfaced. Built with Next.js, Tailwind, Drizzle + PostgreSQL, and TMDB.

## Features

- **Genre tabs** with per-genre filters (e.g. Horror → Found Footage, Slasher; Animation → Disney, Pixar, Ghibli), opened from a hover dropdown in the header.
- **Quality-gated sections** — every page shows *Top Rated · Hidden Gems · Cult · Classics · Recent · Popular*, each with a different lens over the same catalog.
- **Smart scoring** (TMDB-only): a Bayesian weighted rating, a recency/confidence penalty, and an age-relative "underseen" score. A global gate hides low-quality titles; a relaxed, age-aware gate feeds the Cult row.
- **Streaming-aware** — unreleased / theatrical-only titles (nothing available anywhere) are hidden.
- **Watchlist** — save any film; stored in Postgres.
- **Trailers** — play a movie's YouTube trailer from its page.
- **Fast** — cached catalog, slim card payloads, incremental section loading.

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19, TypeScript, Turbopack)
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **Database**: PostgreSQL with Drizzle ORM
- **API**: TMDB (The Movie Database) — the only data source

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL
- TMDB API key ([themoviedb.org](https://www.themoviedb.org/settings/api))

### Setup

```bash
npm install
cp .env.example .env      # then fill in DATABASE_URL + TMDB_API_KEY
npm run db:push           # create the schema
npm run ingest            # populate the catalog (TMDB)
npm run dev               # http://localhost:3000
```

`.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/movie_recs"
TMDB_API_KEY="your_tmdb_api_key_here"
```

## Data ingest

`npm run ingest` populates the database from TMDB (it is the app's "backend" — nothing is fetched from TMDB at request time except movie details/search). Stages, in order:

1. **genres** — upsert the TMDB genre list
2. **pool** — pull `/discover` slices (per-genre + facet keywords) → `movies`, `movie_genres`
3. **metadata** — keywords + production companies → `keywords`, `movie_companies`, …
4. **providers** — CA watch providers + an `available_anywhere` flag per film
5. **stats** — report the vote-weighted mean

It is **resumable**: movies already enriched (`metadata_fetched_at` / `providers_fetched_at`) are skipped. Useful flags:

```bash
npm run ingest -- --limit 200          # cap movies pulled
npm run ingest -- --genre-pages 20     # widen per-genre depth
npm run ingest -- --skip-metadata      # skip the keyword/company stage
npm run ingest -- --skip-providers     # skip the watch-provider stage
npm run ingest -- --providers-limit N  # cap provider lookups this run
```

Streaming availability drifts over time; re-run the **providers** stage periodically (clear `providers_fetched_at` to force a refresh).

## Deployment

The app is **server-rendered with a database and server actions**, so it needs a Node host — GitHub Pages (static-only) will not work. Recommended: **Vercel + Neon**.

### 1. Database (Neon)

Create a project at [neon.tech](https://neon.tech) and copy the **pooled** connection string (serverless-friendly; the client already uses `prepare: false`).

### 2. Create the schema

Point `DATABASE_URL` at the production database and push the schema:

```bash
DATABASE_URL="postgresql://...neon.tech/..." npx drizzle-kit push
```

### 3. Populate the data

Run the ingest against production (needs your TMDB key):

```bash
DATABASE_URL="postgresql://...neon.tech/..." TMDB_API_KEY="..." npm run ingest
```

### 4. Deploy to Vercel

- Import the repository at [vercel.com/new](https://vercel.com/new) (framework auto-detected).
- Add **Environment Variables**:
  - `DATABASE_URL` — the Neon **pooled** string
  - `TMDB_API_KEY`
- Deploy. Vercel runs `next build` (already verified passing).

### 5. Refresh

Availability and catalog data go stale. Periodically re-run the ingest against the production DB (a Vercel Cron, GitHub Action, or manual run) — starting with the providers stage.

> **Env vars must never be committed.** `.env` is gitignored.

## Project Structure

```
src/
├── app/
│   ├── page.tsx                # Home — six sections over the whole catalog
│   ├── genre/[slug]/page.tsx   # Per-genre pages (sections or a flat filtered grid)
│   ├── watchlist/page.tsx      # Saved films
│   ├── movie/[id]/page.tsx     # Detail: overview, trailer, watchlist, streaming
│   ├── search/page.tsx         # TMDB title search
│   └── browse-actions.ts       # Server action: incremental section loading
├── components/                 # Header (tabs + hover filters), SectionRow, cards, …
├── lib/
│   ├── tmdb.ts                 # TMDB client
│   ├── scoring.ts              # WR / settled / obscurity / gates
│   ├── taxonomy.ts             # Genre pages + their filters + sections
│   ├── browse.ts               # Catalog load, scoring, section building
│   └── watchlist.ts            # Watchlist reads
└── db/
    ├── index.ts                # Drizzle connection
    └── schema.ts               # Tables
scripts/
└── ingest.ts                   # TMDB → Postgres ingest
```

## Available Scripts

```bash
npm run dev        # Development server
npm run build      # Production build
npm run start      # Production server
npm run lint       # ESLint
npm run db:push    # Push schema to the database
npm run db:studio  # Drizzle Studio
npm run ingest     # Populate/refresh the catalog from TMDB
```

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.

Streaming availability data provided by [JustWatch](https://www.justwatch.com).

## Notes

- **Single-user watchlist** — no accounts; one shared list.
- **Scoring is TMDB-only** and tuned by taste, not fitted to ground truth.
- **Availability is a snapshot** — refresh the providers stage periodically.

## License

MIT
