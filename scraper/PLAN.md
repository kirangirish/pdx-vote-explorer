# Scraper Implementation Plan

## Current state (updated 2026-09-05)

The scraper is now a real, tested pipeline, not a set of one-off prototype scripts:

- `parser.py` — pure HTML parsing (no network I/O), tested against a fixture in `scraper/fixtures/`. Extracts doc number, title, doc URL, real vote date, member name, member slug, district, and vote — all straight from the page's own markup.
- `db.py` — idempotent `ON CONFLICT DO UPDATE` upserts for documents/members/votes, so re-running the scraper corrects existing rows instead of only adding new ones.
- `run.py` — the pipeline entrypoint: fetches N most-recent pages → parses → upserts, with `--pages`, `--dry-run`, `--db` flags and basic retry/backoff on fetch failures.
- `roster.py` — static district/photo lookup for the 12 councilors + the Mayor, used as a fallback when a row's own district link is missing.
- `test_parser.py` — regression test against the fixture (`python test_parser.py`), catches parsing regressions without hitting the network.
- `debug/` — the original one-off exploration scripts (`verify_access.py`, `inspect_html.py`, `inspect_html_body.py`), kept for manual debugging, not part of the pipeline.
- `summarizer.py` — the real Gemini prompt for AI summaries, written but not yet wired into `run.py` (Phase 4 below).

`main.py` and `seed_db.py` (the original hardcoded-date, hardcoded-district, `INSERT OR IGNORE` prototype) have been deleted — fully superseded by the above.

### A real gotcha worth documenting
portland.gov's server-rendered HTML never closes each row's `<th>` before its sibling `<td>`s — a real browser's HTML5 parser auto-closes it, but BeautifulSoup's default `html.parser` backend takes it literally and nests every `<td>` inside the `<th>`, corrupting every field (`doc_number` ends up containing the entire row's concatenated text). Parsing **must** use `BeautifulSoup(html, "html5lib")`, which implements the same browser auto-closing rules. `html.parser` will silently produce garbage — this bit the very first version of `parser.py` in this session and is now a regression-tested assertion in `test_parser.py`.

Also: `curl` gets a 403 from portland.gov's bot manager on *every* page (confirmed on both the votes page and image endpoints), but Python's `requests` library gets a clean 200 with the same content — apparently only curl's specific TLS/HTTP fingerprint is flagged. `run.py` using `requests` works fine in practice.

## Plan

**Phase 0 — Consolidate** ✅ Done. `debug/` holds the manual exploration scripts, `requirements.txt` pins real versions (including `html5lib`, added for the gotcha above), dead prototype code removed.

**Phase 1 — Fetch layer** ✅ Done for pagination discovery and basic retry/backoff. The votes page paginates via `?page=N`, confirmed up to page 651 (652 pages × ~2 documents/page — full history back to January 6, 2021 is available, but `run.py`'s default is 1 page; a real backfill run used `--pages 30` to seed ~60 documents / 720 votes as a working dataset. A full 652-page backfill is possible but not yet attempted — would need real rate-limiting consideration for portland.gov's servers beyond the current 1s-between-pages delay.

**Phase 2 — Parsing layer** ✅ Done. `parser.py` + `test_parser.py` + `fixtures/votes_page.html`. Pulls the real vote date from each date heading's `<time datetime="...">` (no more hardcoded `2026-01-01`), and gets district + a photo-matching slug for free from each vote row's `/council/districts/{d}/{slug}` link — no more guessing at name variants.

**Phase 3 — Persistence layer** ✅ Done. `db.py`'s upserts are real `ON CONFLICT DO UPDATE`, verified idempotent by running `run.py` twice back-to-back with identical results.

**Phase 4 — AI enrichment** — Not started. Wire `summarizer.py`'s real prompt into `run.py`, populating `aiHeadline`/`aiSummary`/`categoryTags`. Only summarize documents that are new or whose title changed, to avoid re-spending Gemini calls on unchanged rows. Add a `--no-ai` flag for fast local runs.

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

✅ Implemented in `scraper/enrich.py`, wired into `run.py`. Verified against live Gemini calls: correct neutral tone, tags always drawn from the taxonomy, headlines under the character limit. `run.py` only enriches documents that are new, retitled, or never successfully enriched (tracked in `db.py`'s `save_records`), and a failed call just leaves `ai_headline` null for automatic retry on the next run instead of crashing the whole scrape.

**A real constraint discovered doing the first backfill (2026-09-05): the free-tier Gemini API key has a hard 20 requests/day limit per model** (`generativelanguage.googleapis.com/generate_content_free_tier_requests`, resets daily). Backfilling all 60 seeded documents in one run got only 5 enriched before every subsequent call 429'd — the other 55 are sitting with `ai_headline = NULL` and will pick up automatically over the next several days as the scraper re-runs and the quota resets, at ~20/day. This is fine for **steady-state**: a normal day only adds a handful of new documents, well under 20. It's only the one-time historical backfill that doesn't fit in a day on the free tier. Options if faster backfill matters: upgrade to a paid Gemini tier, or just let it trickle in over the space of a few days — no code change either way, `run.py` already handles it correctly.

**Phase 5 — Orchestration** ✅ Done for the fetch→parse→upsert path (`run.py`). Remaining: `--since DATE` flag.

Cadence, decided 2026-09-04: **daily cron** (via launchd on macOS, or a plain crontab line — `0 6 * * * cd /path/to/pdx-vote-explorer/scraper && ./venv/bin/python run.py`). Reasoning: council votes only post after meetings (roughly weekly), so anything more frequent than daily just re-checks an unchanged page and burns Gemini calls on the enrichment step; anything less frequent (on-demand only) risks the dashboard silently going stale. Confirmed compatible with the free-tier quota above for ongoing operation, just not for the initial backfill.

**Phase 6 — Validation** — Partially done. `run.py` prints a summary (documents/members/votes upserted, pages that failed to fetch) but doesn't yet report per-row parse failures with the offending raw HTML, or flag members still missing a district. Worth adding once Phase 4 lands, so one command reports the full health of a run.

## What's next
Phase 4 (AI enrichment) is the main remaining piece for the core pipeline. A full historical backfill (`--pages 652` or a dedicated `--all` flag with more careful rate-limiting) is optional and can happen anytime once Phase 4 is stable — no reason to burn Gemini calls summarizing documents before the summary spec is actually wired up.
