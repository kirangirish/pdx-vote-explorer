# Scraper Implementation Plan

## Current state

The `scraper/` folder is a set of exploration scripts, not a pipeline:

- `verify_access.py`, `inspect_html.py` — one-off scripts used to confirm `portland.gov/council/votes` is reachable and see its raw HTML. Debug-only, not part of the pipeline.
- `main.py` — first working parser: regexes a doc number out of each `<th>`, reads title/member/vote from the following `<td>`s.
- `summarizer.py` — same parser plus a real Gemini prompt that produces a resident-facing summary, but only ever run against `data[0]` for a smoke test. Never wired into persistence.
- `seed_db.py` — the only script that writes to `prisma/dev.db`. It re-implements the parser a third time and inserts with `INSERT OR IGNORE`.

Gaps found while reading `seed_db.py` against `prisma/schema.prisma`:

- `vote_date` is hardcoded to `'2026-01-01'` for every row — never read from the page.
- `district` is hardcoded to `0` for every member (visible now on localhost — every card reads "District: 0").
- `member_id` is the raw scraped name (`"Dan Ryan"`). Any whitespace/typo variant scraped later creates a duplicate member instead of matching.
- `ai_headline`, `ai_summary`, `category_tags`, `photo_url`, `bio_summary` — all columns exist in the schema but nothing ever populates them; `seed_db.py` doesn't call the Gemini summarizer at all.
- `INSERT OR IGNORE` means a re-run never updates anything — if a title gets cleaned up or a vote was mis-scraped, running the scraper again won't fix it.
- Only one page of the votes table is fetched — no check for pagination/date range, so this is likely a small recent slice of the real voting history.
- No retries, no rate limiting, no fixture-based tests — every parser change has to be checked by re-hitting the live site.

## Plan

**Phase 0 — Consolidate**
Move `verify_access.py` / `inspect_html.py` into `scraper/debug/` (manual tools, not run by the pipeline). Add a `requirements.txt` pinning what's actually used (`requests`, `beautifulsoup4`, `python-dotenv`, `google-genai`) instead of relying on the ad hoc venv. Delete the duplicate parsing logic in `main.py`/`summarizer.py`/`seed_db.py` in favor of one shared parser module.

**Phase 1 — Fetch layer**
One `fetch(url)` helper: fixed UA, timeout, retry with backoff, raises on non-200 instead of printing and returning `[]`. Check whether `/council/votes` paginates (page param, or a per-meeting/date-range URL) — right now the scraper almost certainly only sees the latest page, not full history.

**Phase 2 — Parsing layer**
Save a real page snapshot to `scraper/fixtures/` and write parsing against the fixture so logic can be tested without hitting the network. Replace the `re.search(r'\d{4}-\d+', ...)` guess with an explicit row parser that also pulls the real vote date (there's a date heading somewhere above each table — needs inspecting) instead of hardcoding it. Maintain a small static roster (13 councilors + mayor → district, since districts are fixed public knowledge, not something the votes page will ever expose) and map scraped names to it via a canonical slug, so name variants collapse onto one member instead of creating duplicates.

**Phase 3 — Persistence layer**
Replace `INSERT OR IGNORE` with real upserts (`ON CONFLICT DO UPDATE`) matching the Prisma column names, so re-running the scraper corrects existing rows instead of only ever adding new ones.

**Phase 4 — AI enrichment**
Wire `summarizer.py`'s real prompt into the pipeline (not the one-liner currently duplicated in `seed_db.py`), populating `aiHeadline`/`aiSummary`/`categoryTags`. Only summarize documents that are new or whose title changed, to avoid re-spending Gemini calls on unchanged rows. Add a `--no-ai` flag for fast local runs.

Spec, decided 2026-09-04:

- **Headline**: ≤ 60 characters, newspaper-style (states the action, not the doc number).
- **Summary**: 2-3 sentences, ~8th-grade reading level. States what changed and who it affects. No jargon, no doc-number references, no procedural filler ("Council voted to approve...") — lead with the substance.
- **Neutrality (non-negotiable)**: the model must describe what changed and who voted how — never characterize a vote as good, bad, controversial, or partisan. No adjectives implying judgment. This app is meant to help residents hold current officials accountable, including right before contested elections (see Multnomah County Chair race, Nov 3 2026) — any perceived editorializing undermines that entirely. Every generated summary is displayed with a visible "AI-generated" label linking back to the source document, never presented as unsourced fact.
- **Category tags**: exactly 1-2 tags per document, chosen by the model from a **fixed taxonomy** (not freeform) so the eventual browse/filter UI has a stable set of categories to work with:
  1. Housing & Development
  2. Transportation & Infrastructure
  3. Budget & Finance
  4. Public Safety
  5. Parks & Environment
  6. Contracts & Procurement
  7. Government Operations
  8. Other
  Stored as a comma-separated string in `categoryTags`, matching the schema's existing comment. The prompt should list these eight verbatim and instruct the model to pick only from the list.

**Phase 5 — Orchestration**
Single `scraper/run.py` entrypoint: fetch → parse → upsert → enrich, with `--dry-run`, `--no-ai`, `--since DATE` flags.

Cadence, decided 2026-09-04: **daily cron** (via launchd on macOS, or a plain crontab line — `0 6 * * * cd /path/to/pdx-vote-explorer/scraper && ./venv/bin/python run.py`). Reasoning: council votes only post after meetings (roughly weekly), so anything more frequent than daily just re-checks an unchanged page and burns Gemini calls on the enrichment step; anything less frequent (on-demand only) risks the dashboard silently going stale. Revisit only if Phase 1's pagination work reveals votes post on a tighter cycle than assumed.

**Phase 6 — Validation**
Each run prints a short report: new documents, new votes, members still missing a district, and any row that failed to parse (logged with the raw HTML so bad data never silently lands in the DB).

## Suggested order of attack
1. Phase 2 first (fixture + real parser + real date) — everything downstream depends on parsing being correct, and it's what's most broken right now.
2. Phase 3 (upserts) so iterating on Phase 2 doesn't require wiping the DB each time.
3. Phase 1 (pagination) once single-page parsing is solid, to get full history rather than a recent slice.
4. Phase 4 (AI enrichment) — currently built but unused; smallest lift.
5. Phase 0/5/6 (cleanup, entrypoint, reporting) last, once the pipeline actually works.
