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

## Multnomah County scraper (added 2026-09-05)

A second, separate scraper for the County Board of Commissioners, sharing `db.py`/`enrich.py`/`enrichment_cache.py` with the Portland one but with its own fetch/parse layer, since the data lives in a completely different shape:

- `multco_parser.py` — pure parsing (no network I/O), tested against fixtures. `parse_meeting_list()` reads the Granicus meeting-list HTML, filtered to `Regular Board Meeting` / `Special Meeting` rows (confirmed to be the only types with recorded votes — Board Briefings and Budget Work Sessions don't appear to have them). `parse_minutes_text()` reads text extracted (via `pypdf`) from each meeting's minutes PDF.
- `multco_run.py` — the pipeline entrypoint: fetch meeting list → resolve each meeting's actual PDF URL (`MinutesViewer.php` redirects to a Google Docs viewer URL that embeds the real `DocumentViewer.php` link in its query string — one redirect-follow, no need to actually load Google's viewer) → extract PDF text → parse → upsert, with `--meetings`, `--dry-run`, `--no-ai`, `--db` flags, mirroring `run.py`.
- `multco_roster.py` — the 5 real Board members (Chair + 4 district Commissioners), confirmed against multco.us. Minutes PDFs refer to people by last name only with a title prefix ("Commissioner Moyer", "Chair Vega Pederson"), so this also maps those short forms to full names.
- `test_multco_parser.py` — regression tests against `fixtures/multco_meeting_list.html` and `fixtures/multco_minutes_2026-09-03.txt`.

### Why this needed a schema change
Added `CouncilMember`/`CouncilDocument.governingBody` (`"portland_council"` default | `"multnomah_county"`). Necessary because both bodies use district numbers 1-4 for different geographic areas covering different people — any query that groups or filters by district must also filter by `governingBody`, or a Portland District 1 and a Multnomah District 1 silently get mixed together. The homepage's district grid query is the one place in the app that would have broken the moment county data existed; it's now explicitly scoped to `portland_council`.

### The data format, and real gotchas hit
The minutes PDF's real content — numbered agenda items (`C.1`, `C.2`... consent; `R.1`, `R.2`... regular) each followed by an `AYES (N): Name, Name...` / `NOS (N): Name, Name...` block — is only ever the first 1-2 pages. Everything from `CAPTIONS` onward is a 100+ page auto-generated Webex transcript of the entire meeting and must be excluded, both for correctness and so the parser isn't scanning speaker-by-speaker chatter for a pattern that isn't there. Note it's **`NOS`**, not `NAYS`/`NAY` like Portland — a real format difference, not a typo.

Two parsing bugs found and fixed while building this, both now regression-tested:
1. A vote's name list often runs on into the outcome sentence with no clean punctuation boundary (`"...Chair Vega Pederson The consent agenda is approved."`), which silently truncated the last-listed name (almost always the Chair) when parsed by splitting on commas. Fixed by searching the raw text directly for known `"<Title> <Lastname>"` patterns instead, stopping once the block's own declared count (`AYES (N)`) is reached — robust regardless of what trailing prose got captured.
2. Title extraction stopped at the word "moves" but included the mover's name before it (`"...Technicians. Commissioner Brim-Edwards moves..."` → title ends up containing "Commissioner Brim-Edwards"). Separately, a PDF page-footer (`"Page 2 of 89"`) can land mid-title when a title happens to wrap across a page boundary — and stripping just the footer text without its surrounding blank-line whitespace still left an unwanted paragraph-block split that truncated the title anyway. Both fixed.

### Status
Verified against 5 real live meetings: 20 documents, 98 votes, all persisted correctly with `governingBody: "multnomah_county"`. AI enrichment shares the same daily Gemini quota as Portland's (see above) — not run for county documents yet today.

### Not done yet
- No dedicated county UI — county member/document pages are reachable by URL (`/members/meghan-moyer`, `/documents/2026-09-03-R.2`) since routes are already body-agnostic, but nothing in the app links to them. A homepage section (or a body switcher) is real design work, intentionally out of scope for this pass.
- Only pulled 5 of the ~90+ voting meetings since 2010 available on Granicus. No backfill attempted yet.
- Haven't exhaustively confirmed Board Briefings/Budget Work Sessions never have votes — `parse_meeting_list()` excludes them based on a handful of samples, worth a closer look before relying on that assumption for a real historical backfill.

## What's next
Phase 4 (AI enrichment) is done for both scrapers' code paths; the remaining 55 Portland documents and all 20 Multnomah documents will pick up their headlines/summaries/tags automatically as the shared daily Gemini quota resets. A full historical backfill (Portland: `--pages 652`; Multnomah: `--meetings` for full history) is optional and can happen anytime — no reason to burn Gemini calls summarizing documents faster than the free tier allows.
