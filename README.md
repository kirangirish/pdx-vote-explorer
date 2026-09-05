# PDX Vote Explorer

A dashboard for exploring Portland City Council votes: council members grouped by district, recent decisions, AI-generated plain-language summaries, and per-member vote breakdowns. Council data is populated by a Python scraper in `scraper/` (see `scraper/PLAN.md` for its roadmap).

## Prerequisites

- Node.js 20+ (developed against v26)
- Python 3.11+ — only needed if you want to re-run the scraper; the repo ships with a seeded database so you can skip this for local frontend work

## Getting started

```bash
git clone <repo-url>
cd pdx-vote-explorer
npm install
cp .env.example .env
npx prisma generate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The repo ships with `prisma/dev.db` already seeded (12 council members with real district assignments and headshots, a couple of decisions with vote records), so the dashboard should show real data immediately — no migration or seeding step required.

**Why the explicit `npx prisma generate` step:** newer npm versions (11+) gate package install scripts behind an `allowScripts` allowlist, so `@prisma/client`'s normal postinstall generation step gets silently skipped — `npm install` will print `npm warn install-scripts` for a few packages but won't error. Always run `npx prisma generate` after `npm install` (or after pulling a change to `prisma/schema.prisma`) to be safe.

## Environment variables

Copy `.env.example` to `.env` and fill in:

- `DATABASE_URL` — sqlite file path, defaults to `file:./prisma/dev.db`. Leave as-is unless you know you want a different database file.
- `GEMINI_API_KEY` — only used by `scraper/summarizer.py` and the scraper's AI enrichment step (not yet wired into `seed_db.py`, see `scraper/PLAN.md` Phase 4). The Next.js app itself never touches this key, so a placeholder value is fine unless you're working on the scraper.

## Prisma 7 gotcha

This project uses Prisma 7, which **requires an explicit driver adapter** — `new PrismaClient()` with no arguments throws `PrismaClientInitializationError: PrismaClient was instantiated without any options`. This is already wired up correctly in `src/lib/prisma.ts` via `@prisma/adapter-better-sqlite3`; if you ever see that error, it means that wiring got reverted or `DATABASE_URL` is unset.

## Running the scraper (optional)

Only needed if you want to refresh the seeded data from the live `portland.gov/council/votes` page:

```bash
cd scraper
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python seed_db.py
```

This hits the live site and writes directly to `prisma/dev.db`. See `scraper/PLAN.md` for what's implemented versus planned (parsing is currently fragile — read it before relying on scraper output for anything beyond local dev).

## Project structure

```
src/app/                      Next.js routes (App Router)
src/app/page.tsx              Homepage: latest decision + member grid by district
src/app/documents/[docNumber] Document detail page: summary + vote breakdown
src/components/               Shared UI (MemberAvatar)
src/lib/prisma.ts             Prisma client singleton (driver adapter wiring)
prisma/schema.prisma           Data model: CouncilMember, CouncilDocument, MemberVote
prisma/dev.db                  Seeded sqlite database, committed for convenience
scraper/                       Python scraper prototype — see scraper/PLAN.md
public/members/                Council member headshots
```

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `PrismaClientInitializationError` on any page load | `src/lib/prisma.ts` isn't passing a driver adapter, or `DATABASE_URL` is unset — see "Prisma 7 gotcha" above |
| Member avatars show initials instead of photos | `public/members/*.png` missing — check `git status`, they should be committed |
| `EADDRINUSE` / port 3000 already in use | Another `next dev` is running — `pkill -f "next dev"` or run `next dev -p 3001` |
| Dashboard shows no members/decisions | `DATABASE_URL` is pointing somewhere other than `prisma/dev.db` (e.g. a stale local override) |
| Console warning about a hydration mismatch mentioning an unfamiliar attribute on `<body>` (e.g. `cz-shortcut-listen`) | A browser extension (ColorZilla and similar tools do this) is injecting attributes into the DOM before React hydrates. Harmless and unrelated to this app's code — confirm by reloading in an incognito window with extensions disabled |
