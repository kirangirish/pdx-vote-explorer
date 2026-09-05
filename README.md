# PDX Vote Explorer

A dashboard for exploring Portland City Council votes: council members grouped by district, recent decisions, AI-generated plain-language summaries, and per-member vote breakdowns. Council data is populated by a Python scraper in `scraper/` (see `scraper/PLAN.md` for its roadmap).

## Prerequisites

- Node.js 20+ (developed against v26)
- Python 3.11+ — required to populate real data; see "Database" below for why

## Getting started

```bash
git clone <repo-url>
cd pdx-vote-explorer
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate deploy   # creates an empty prisma/dev.db with the schema applied
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the dashboard will be empty until you run the scraper (below) to populate real data. This is intentional; see "Database" for why.

**Why the explicit `npx prisma generate` step:** newer npm versions (11+) gate package install scripts behind an `allowScripts` allowlist recorded in `package.json`. This repo's `package.json` now pre-approves the packages that need it (`prisma`, `@prisma/engines`, `better-sqlite3`, `unrs-resolver`), so a plain `npm install` should build/generate everything correctly on npm 11+. Run `npx prisma generate` anyway after pulling a change to `prisma/schema.prisma`, or if you're on an npm version where this mechanism behaves differently, to be safe.

**If `npm install` still doesn't build the native SQLite binding** (symptom: `Module not found: Can't resolve 'better-sqlite3'`, or a `node-gyp` error) — `better-sqlite3` is a native module. It tries to download a prebuilt binary matching your OS/architecture first, falling back to compiling locally via `node-gyp`, which needs Python 3 and a C++ toolchain (Xcode Command Line Tools on macOS, `build-essential` on Linux, the "Desktop development with C++" workload on Windows). If it's still missing after `npm install`, force it with `npm rebuild better-sqlite3`, then restart `next dev` (a stale `.next`/Turbopack cache can also show this error right after reinstalling — delete `.next` if a restart alone doesn't clear it).

## Environment variables

Copy `.env.example` to `.env` and fill in:

- `DATABASE_URL` — sqlite file path, defaults to `file:./prisma/dev.db`. Leave as-is unless you know you want a different database file.
- `GEMINI_API_KEY` — only used by `scraper/summarizer.py` and the scraper's AI enrichment step (not yet wired into `seed_db.py`, see `scraper/PLAN.md` Phase 4). The Next.js app itself never touches this key, so a placeholder value is fine unless you're working on the scraper.

## Database

`prisma/dev.db` (SQLite) is **not committed to git** and is gitignored — each developer generates their own locally via `npx prisma migrate deploy` + the scraper (below). This was a deliberate call, not an oversight: a binary sqlite file that changes on every scraper run doesn't diff meaningfully in git, two people running the scraper at different times get an unresolvable merge conflict, and most real hosts have an ephemeral/read-only filesystem a committed file can't reflect anyway. SQLite-as-a-local-file is a fine choice for now (zero setup, fast), but it's explicitly a dev-only story — a real deployment will need a hosted database (e.g. Postgres) with the scraper writing to it via a scheduled job rather than a local file. See `scraper/PLAN.md` for the scraper's own roadmap.

The tradeoff of this choice: a fresh clone no longer gets real data for free (earlier versions of this README shipped a pre-seeded `dev.db`). Run the scraper once after `prisma migrate deploy` to get a working dashboard.

## Prisma 7 gotcha

This project uses Prisma 7, which **requires an explicit driver adapter** — `new PrismaClient()` with no arguments throws `PrismaClientInitializationError: PrismaClient was instantiated without any options`. This is already wired up correctly in `src/lib/prisma.ts` via `@prisma/adapter-better-sqlite3`; if you ever see that error, it means that wiring got reverted or `DATABASE_URL` is unset.

## Running the scraper (required for real data)

```bash
cd scraper
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python run.py --pages 30   # most recent 30 pages (~60 documents); omit --pages for just the latest page
```

Writes real vote records — real dates, real districts, real member names pulled straight from the page's own links — directly into `prisma/dev.db` via idempotent upserts (safe to re-run, safe to run repeatedly to pull more history). `python test_parser.py` runs a regression test against a saved fixture (`scraper/fixtures/`) without touching the network. AI summary/headline/category-tag generation isn't wired in yet — see `scraper/PLAN.md` Phase 4.

## Project structure

```
src/app/                      Next.js routes (App Router)
src/app/page.tsx              Homepage: latest decision + member grid by district
src/app/documents/[docNumber] Document detail page: summary + vote breakdown
src/components/               Shared UI (MemberAvatar)
src/lib/prisma.ts             Prisma client singleton (driver adapter wiring)
prisma/schema.prisma           Data model: CouncilMember, CouncilDocument, MemberVote
prisma/dev.db                  Local sqlite database, gitignored -- generate your own, see "Database"
scraper/                       Python scraper -- see scraper/PLAN.md
public/members/                Council member headshots
```

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `PrismaClientInitializationError` on any page load | `src/lib/prisma.ts` isn't passing a driver adapter, or `DATABASE_URL` is unset — see "Prisma 7 gotcha" above |
| Member avatars show initials instead of photos | `public/members/*.png` missing — check `git status`, they should be committed |
| `EADDRINUSE` / port 3000 already in use | Another `next dev` is running — `pkill -f "next dev"` or run `next dev -p 3001` |
| Dashboard shows no members/decisions | Most likely you haven't run the scraper yet — `prisma/dev.db` is gitignored and starts empty after `prisma migrate deploy`, see "Database". If you have run it, check `DATABASE_URL` isn't pointing somewhere else |
| `Module not found: Can't resolve 'better-sqlite3'`, or dev server won't start at all | The native SQLite binding didn't build — see the native binding note above. Try `npm rebuild better-sqlite3`, then delete `.next` and restart `next dev` |
| Console warning about a hydration mismatch mentioning an unfamiliar attribute on `<body>` (e.g. `cz-shortcut-listen`) | A browser extension (ColorZilla and similar tools do this) is injecting attributes into the DOM before React hydrates. Harmless and unrelated to this app's code — confirm by reloading in an incognito window with extensions disabled |
