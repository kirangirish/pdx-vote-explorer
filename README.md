# PDX Vote Explorer

A dashboard for exploring Portland City Council votes: council members grouped by district, recent decisions, AI-generated plain-language summaries, and per-member vote breakdowns. Council data is populated by a Python scraper in `scraper/` (see `scraper/PLAN.md` for its roadmap).

## Prerequisites

- Node.js 20.19+ (developed against v26)
- Python 3.11+ — required to populate real data; see "Database" below for why

## Getting started

```bash
git clone <repo-url>
cd pdx-vote-explorer
cp .env.example .env        # fill in your Supabase connection strings, see below
npm install                 # also runs `prisma generate` (postinstall)
npm run db:migrate          # applies prisma/migrations to the database in DIRECT_URL
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dashboard will be empty until you run the scraper (below) against your database.

Use Node 20.19+ -- Prisma 7's install script refuses to run on older versions.

## Environment variables

Copy `.env.example` to `.env` and fill in:

- `DATABASE_URL` -- Supabase **transaction pooler** URL (port 6543, with `?pgbouncer=true`). Used by the Next.js app at runtime; the pooler is what makes this safe on serverless hosting, where every request can open a fresh connection.
- `DIRECT_URL` -- Supabase **session pooler** URL (port 5432). Used by `prisma migrate` (which needs a session connection) and by the scraper.
- `GEMINI_API_KEY` -- only used by the scraper's AI enrichment step (headline/summary/tags). The Next.js app never touches it. Without a valid key, documents still get scraped, just without AI summaries; the next run with a key fills them in.

Both URLs are on the project's Supabase dashboard under **Connect**. (The direct `db.<ref>.supabase.co` host is IPv6-only on the free tier, so use the pooler URLs.)

## Database

Production data lives in Postgres on Supabase (free tier). Prisma owns the schema: `prisma/schema.prisma` plus the SQL in `prisma/migrations/`, applied with `npm run db:migrate`. The `1_enable_rls` migration turns on Row Level Security with no policies, which locks the tables out of Supabase's public REST API; the app and scraper connect as `postgres`, which bypasses RLS.

For a throwaway local database, point both URLs at a local Postgres (e.g. `supabase start`, or `postgres.app`). The scraper can still write to a local sqlite file with `--db path/to/file.db` for parser work, but the app itself only speaks Postgres now.

## Prisma 7 gotcha

This project uses Prisma 7, which **requires an explicit driver adapter** -- `new PrismaClient()` with no arguments throws `PrismaClientInitializationError: PrismaClient was instantiated without any options`. This is already wired up in `src/lib/prisma.ts` via `@prisma/adapter-pg`; if you ever see that error, it means that wiring got reverted or `DATABASE_URL` is unset. Prisma CLI commands need `--config prisma7.config.ts` (the npm scripts already pass it).

## Deployment

- **App:** Vercel (Hobby, free). Import the GitHub repo, set `DATABASE_URL` (transaction pooler) and `DIRECT_URL` in the project's environment variables, and deploy -- `npm install` generates the Prisma client and `next build` does the rest. The homepage and county dashboard revalidate hourly, so new votes show up without a redeploy.
- **Database:** Supabase (free). Free projects pause after a week with no activity; the daily scraper run below keeps it awake.
- **Scraper:** `.github/workflows/scrape.yml` runs both scrapers daily on GitHub Actions (free for public repos). It needs the repo secrets `DIRECT_URL` and `GEMINI_API_KEY`, and can be run by hand from the Actions tab (**Run workflow**).
- **Schema changes:** edit `prisma/schema.prisma`, create a migration, then `npm run db:migrate` against production.

## Running the scraper (required for real data)

Two separate scrapers share the same venv/database — Portland City Council (HTML) and Multnomah County Board of Commissioners (PDF minutes). Both write to the same `governingBody`-tagged tables; see `scraper/PLAN.md` for how each one actually works.

```bash
cd scraper
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

python run.py --pages 30           # Portland: most recent 30 pages (~60 documents); omit --pages for just the latest
python multco_run.py --meetings 5  # Multnomah County: most recent 5 voting meetings; omit --meetings for just the latest
```

Writes real vote records — real dates, real districts, real member names pulled straight from the page's own links — into the Postgres database in `DATABASE_URL` from `../.env` (set it to your `DIRECT_URL`, or pass `--db <url>`) via idempotent upserts (safe to re-run, safe to run repeatedly to pull more history). `python test_parser.py` runs a regression test against a saved fixture (`scraper/fixtures/`) without touching the network. AI summary/headline/category-tag generation isn't wired in yet — see `scraper/PLAN.md` Phase 4.

## Project structure

```
src/app/                      Next.js routes (App Router)
src/app/page.tsx              Homepage: latest decision + member grid by district
src/app/documents/[docNumber] Document detail page: summary + vote breakdown
src/components/               Shared UI (MemberAvatar)
src/lib/prisma.ts             Prisma client singleton (driver adapter wiring)
prisma/schema.prisma           Data model: CouncilMember, CouncilDocument, MemberVote
prisma/migrations/             Postgres schema migrations, applied with `npm run db:migrate`
.github/workflows/scrape.yml   Daily scraper run against production
scraper/                       Python scraper -- see scraper/PLAN.md
public/members/                Council member headshots
```

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `prepared statement "s0" already exists` | `DATABASE_URL` is the transaction pooler (6543) without `?pgbouncer=true` |
| `PrismaClientInitializationError` on any page load | `src/lib/prisma.ts` isn't passing a driver adapter, or `DATABASE_URL` is unset — see "Prisma 7 gotcha" above |
| Member avatars show initials instead of photos | `public/members/*.png` missing — check `git status`, they should be committed |
| `EADDRINUSE` / port 3000 already in use | Another `next dev` is running — `pkill -f "next dev"` or run `next dev -p 3001` |
| Dashboard shows no members/decisions | Most likely you haven't run the scraper against this database yet — a freshly migrated database starts empty. If you have, check `DATABASE_URL` points at the same Supabase project the scraper wrote to |
| Console warning about a hydration mismatch mentioning an unfamiliar attribute on `<body>` (e.g. `cz-shortcut-listen`) | A browser extension (ColorZilla and similar tools do this) is injecting attributes into the DOM before React hydrates. Harmless and unrelated to this app's code — confirm by reloading in an incognito window with extensions disabled |
