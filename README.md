# Movie Discovery

### 🎬 [**Live site → mrecs.vercel.app**](https://mrecs.vercel.app)

A personal movie-browsing app: browse by genre, filtered to films worth your time, with underseen gems surfaced.
Next.js, Tailwind, Drizzle + PostgreSQL, TMDB. There's also an [Android TV app](android-tv/README.md).

## Features

- **Genre pages** with sub-filters (Horror → Found Footage, Slasher; Animation → Disney, Pixar, Ghibli).
- **Six rows everywhere** — Top Rated · Hidden Gems · Fun · Classics · Recent · Popular — ranked by a Bayesian rating
  with recency and "underseen" adjustments. Low-quality and unreleased titles are hidden.
- **Watchlist, watched list and 0.5–10 ratings**, shared by the site and the TV.
- **Trailers** and a TMDB search.

## Run it locally

Needs Node 22+, a Postgres database ([Neon](https://neon.tech) works well) and a [TMDB API key](https://www.themoviedb.org/settings/api).

```bash
npm install
cp .env.example .env      # fill in the variables below
npm run db:push           # create the tables
npm run ingest            # fill the catalog from TMDB (~2 min, resumable)
npm run dev               # http://localhost:3000
```

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (Neon **pooled**) |
| `TMDB_API_KEY` | TMDB v3 key (server-side only) |
| `SITE_PASSWORD` | Owner password. Without it, nobody can edit |
| `DATABASE_POOL_MAX` | Optional pool size (default 10) |

Develop against a Neon branch, not production: put its connection string in `.env.development.local` (gitignored).

## Who can edit

Anyone can browse. Only the owner can change the watchlist, watched list and ratings.

- **Website:** sign in at `/login`. Visitors who try to edit are sent there with a "locked" notice.
- **TV app / API:** `POST /api/v1/login {"password": "..."}` returns a token; send it as `Authorization: Bearer <token>`
  on writes. The TV app does this from its About tab.
- Cookies and tokens are derived from the password, never the password itself. Logins and API calls are rate-limited per IP.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Develop, build, serve |
| `npm run lint` / `typecheck` | ESLint, TypeScript |
| `npm test` | Unit + integration tests (in-memory Postgres, no network) |
| `npm run test:e2e` | Production build + Playwright |
| `npm run db:push` / `db:studio` | Push the schema / browse the database |
| `npm run ingest` | Refresh the catalog (`-- --limit 200`, `--genre-pages 20`, `--skip-metadata`, `--skip-imdb`) |

CI (`.github/workflows/ci.yml`) runs lint, types, tests, build, e2e and the Android checks on every push.

## Deploy

Needs a Node host (not GitHub Pages). Vercel + Neon works:

1. Create a Neon project and copy the pooled connection string.
2. `DATABASE_URL="..." npx drizzle-kit push`, then `DATABASE_URL="..." TMDB_API_KEY="..." npm run ingest`.
3. Import the repo at [vercel.com/new](https://vercel.com/new) and set the variables above.

`.github/workflows/ingest.yml` refreshes the catalog every Sunday 03:00 UTC. It needs the repo secrets
`DATABASE_URL` and `TMDB_API_KEY`. The site picks up new data within an hour.

## Layout

```
src/app/      pages, server actions, /api/v1 (used by the TV app)
src/lib/      tmdb client, scoring, browse (catalog + sections), watchlist, watched, auth, rate limit
src/db/       Drizzle schema + connection
scripts/      ingest.ts (TMDB → Postgres)
tests/        unit, integration (Vitest), e2e (Playwright)
android-tv/   Android TV app
```

## Credits

This product uses the TMDB API but is not endorsed or certified by TMDB.
Ratings courtesy of [IMDb](https://www.imdb.com) (public datasets, personal non-commercial use).

MIT licensed.
