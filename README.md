# Movie Discovery

An intelligent movie-browsing app: browse by genre, filtered to films worth your time, with the underseen gems surfaced. Built with Next.js, Tailwind, Drizzle + PostgreSQL, and TMDB.

## Features

- **Genre tabs** with per-genre filters (e.g. Horror → Found Footage, Slasher; Animation → Disney, Pixar, Ghibli), opened from a hover dropdown in the header.
- **Quality-gated sections** — every page shows *Top Rated · Hidden Gems · Cult · Classics · Recent · Popular*, each with a different lens over the same catalog.
- **Smart scoring** (TMDB-only): a Bayesian weighted rating, a recency/confidence penalty, and an age-relative "underseen" score. A global gate hides low-quality titles; a relaxed, age-aware gate feeds the Cult row.
- **Streaming-aware** — unreleased / theatrical-only titles (nothing available anywhere) are hidden.
- **Accounts** — Google sign-in for an invite list of emails; everyone gets their own watchlist.
- **Android TV app** — sign in by scanning a QR code with your phone ([`android-tv/`](android-tv/README.md)).
- **Trailers** — play a movie's YouTube trailer from its page.
- **Fast** — cached catalog, slim card payloads, incremental section loading.

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19, TypeScript, Turbopack)
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **Auth**: [Better Auth](https://better-auth.com) — Google OAuth, sessions in Postgres, RFC 8628 device flow for the TV
- **Tests**: Vitest + PGlite (in-memory Postgres), Playwright
- **API**: TMDB (The Movie Database) — the only data source

## Getting Started

### Prerequisites

- Node.js 22+
- PostgreSQL (Neon recommended)
- TMDB API key ([themoviedb.org](https://www.themoviedb.org/settings/api))
- A Google OAuth client (see [Google sign-in](#google-sign-in))

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
| `BETTER_AUTH_SECRET` | Signs sessions/cookies — `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Public base URL, e.g. `http://localhost:3000` or your Vercel URL |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth client |
| `ALLOWED_EMAILS` | Comma-separated emails allowed to sign in; everyone else is refused |
| `DATABASE_POOL_MAX` | Optional connection-pool size (default 10) |
| `GITHUB_RELEASES_TOKEN` | Read-only GitHub token so `/tv` can serve the latest TV app (see [`android-tv/`](android-tv/README.md)) |

**Develop against a Neon branch, not production.** Put the branch's connection string in `.env.development.local`
(gitignored; Next.js prefers it over `.env` when running `npm run dev`).

### Google sign-in

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → **Create credentials → OAuth client ID → Web application**.
2. **Authorized redirect URIs** — add one per environment:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://movie-recs-tawny.vercel.app/api/auth/callback/google`
3. Copy the client ID and secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
4. On the **OAuth consent screen**, add yourself (and anyone on `ALLOWED_EMAILS`) as test users, or publish the app.

## Accounts & security

- **Sign-in:** Google only, restricted to `ALLOWED_EMAILS` (checked at sign-in, on every new session, and on every request —
  removing an email cuts off that person's existing sessions).
- **Website sessions:** httpOnly, `Secure` (production), `SameSite=Lax` cookies; 30-day sliding expiry; origin/CSRF checks on
  every state-changing request.
- **TV sign-in:** RFC 8628 device flow. The TV shows a QR code + short code; you approve it at `/activate`. Codes expire
  after 10 minutes, can only be approved by the account that opened them, and are single-use. Each TV gets its own session,
  listed (and revocable) at `/account`. **The app contains no secrets.**
- **API (`/api/v1`):** requires the caller's own session; every watchlist query is scoped to that user; per-user rate limit
  (120 req/min), plus Better Auth's limits on sign-in and device endpoints — all stored in Postgres so they hold on serverless.
- **Headers:** `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, strict referrer and permissions policies.
- **Secrets** live only in server env vars. `.env*` files are gitignored.

## Testing

```bash
npm test               # unit + integration (Vitest, in-memory Postgres via PGlite — no network or secrets)
npm run test:coverage  # same, with coverage
npm run test:e2e       # production build + Playwright, against a seeded in-memory Postgres
```

Integration tests run the real schema, Better Auth, and route handlers: the TV sign-in flow (approve/deny/replay/hijack/CSRF),
the allowlist, session revocation, per-user watchlist isolation, input validation and rate limits.
CI (`.github/workflows/ci.yml`) runs all of it plus the Android checks on every push and pull request; Dependabot keeps
dependencies current.

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

Streaming availability drifts, so the providers stage also **re-checks** titles: weekly for ones that are unavailable or
released in the last two years (theatrical → streaming), monthly for the rest. A full run takes about two minutes.

### Weekly refresh (GitHub Actions)

`.github/workflows/ingest.yml` runs the ingest against production every **Sunday 03:00 UTC** (and on demand from the
Actions tab → *Weekly TMDB Ingest* → *Run workflow*). It needs two repository secrets
(*Settings → Secrets and variables → Actions*):

| Secret | Value |
| --- | --- |
| `DATABASE_URL` | Production Neon **pooled** connection string |
| `TMDB_API_KEY` | Your TMDB key |

The site shows the new data within an hour (the catalog is cached for 60 minutes).

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
- Add the **Environment Variables** from the table above (`BETTER_AUTH_URL` = your production URL).
- Deploy. Vercel runs `next build` (already verified passing).

### Moving from the single shared watchlist

The pre-accounts watchlist lives in the old `watchlist` table. After deploying with accounts:

```bash
DATABASE_URL="<production>" npx drizzle-kit push              # adds the auth + user_watchlist tables (additive)
# sign in on the website once, then:
DATABASE_URL="<production>" npm run watchlist:claim -- you@example.com
```

### 5. Refresh

Handled weekly by GitHub Actions — see [Weekly refresh](#weekly-refresh-github-actions).

> **Env vars must never be committed.** `.env` is gitignored.

## Project Structure

```
src/
├── app/
│   ├── page.tsx                # Home — six sections over the whole catalog
│   ├── genre/[slug]/page.tsx   # Per-genre pages (sections or a flat filtered grid)
│   ├── watchlist/              # Your saved films (+ server actions)
│   ├── login/                  # Google sign-in
│   ├── activate/               # Approve a TV sign-in (QR code target)
│   ├── account/                # Your signed-in devices; revoke any of them
│   ├── api/auth/[...all]/      # Better Auth (OAuth, sessions, device flow)
│   ├── api/v1/                 # JSON API for the TV app
│   ├── movie/[id]/page.tsx     # Detail: overview, trailer, watchlist, streaming
│   ├── search/page.tsx         # TMDB title search
│   └── browse-actions.ts       # Server action: incremental section loading
├── components/                 # Header (tabs + hover filters), SectionRow, cards, …
├── lib/
│   ├── tmdb.ts                 # TMDB client
│   ├── scoring.ts              # WR / settled / obscurity / gates
│   ├── taxonomy.ts             # Genre pages + their filters + sections
│   ├── browse.ts               # Catalog load, scoring, section building
│   ├── auth.ts                 # Better Auth config + getViewer()
│   ├── allowlist.ts            # ALLOWED_EMAILS
│   ├── rate-limit.ts           # Postgres-backed API rate limiter
│   ├── api.ts                  # /api/v1 helpers (requireUser, validation)
│   └── watchlist.ts            # Per-user watchlist
└── db/
    ├── index.ts                # Drizzle connection
    └── schema.ts               # Tables
scripts/
├── ingest.ts                   # TMDB → Postgres ingest
└── claim-watchlist.ts          # One-time: old shared watchlist → an account
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

Streaming availability data provided by [JustWatch](https://www.justwatch.com).

## Notes

- **Scoring is TMDB-only** and tuned by taste, not fitted to ground truth.
- **Availability is a snapshot** — refresh the providers stage periodically.

## License

MIT
