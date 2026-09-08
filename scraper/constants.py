"""
Central location for configuration-style constants used across the scraper
pipelines: URLs, HTTP headers, the local DB path, governing-body tags,
safety-cap thresholds, and AI enrichment config. Previously these were
scattered across run.py / multco_run.py / enrich.py (with HEADERS and
DEFAULT_DB_PATH literally duplicated between the two entrypoints) -- having
them all in one file makes any single value a one-file change, and makes
the two scrapers' configuration easy to compare side by side.

Parsing-specific constants (e.g. multco_parser.py's VOTING_MEETING_TYPES,
or either parser's compiled regexes) intentionally stay in their own
modules -- those are tightly coupled to the parsing logic they sit next to
and are covered by that module's own fixture-based tests, not general
configuration.
"""

# Shared by both scrapers' entrypoints
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}
DEFAULT_DB_PATH = "../prisma/dev.db"

# Portland City Council (run.py)
PORTLAND_BASE_URL = "https://www.portland.gov/council/votes"
PORTLAND_GOV_BASE = "https://www.portland.gov"
PORTLAND_GOVERNING_BODY = "portland_council"
# If this many page fetches in a row fail, treat it as likely rate-limiting
# or blocking rather than a transient network blip -- stop requesting more
# pages instead of continuing to hammer a server that's already signaling
# "stop," but still process/save whatever was collected before the abort.
MAX_CONSECUTIVE_FETCH_FAILURES = 3
# Safety cap for incremental mode, so a bug or a genuinely empty database
# can't turn "pick up what's new" into an unbounded fetch loop. ~2
# documents/page, weekly meeting cadence -- 20 pages is a wide cushion
# for even a multi-week gap in cron runs.
MAX_INCREMENTAL_PAGES = 20

# Multnomah County (multco_run.py)
MULTCO_MEETING_LIST_URL = "https://multnomah.granicus.com/ViewPublisher.php?view_id=3"
MULTCO_GOVERNING_BODY = "multnomah_county"
# The real minutes narrative is only ever the first few pages; everything
# after "CAPTIONS" is a 100+ page auto-generated transcript. Capping the
# extraction avoids wasting time decoding pages we'll throw away anyway.
MAX_PDF_PAGES_TO_SCAN = 15
# Safety cap for incremental mode, so a bug or a genuinely empty database
# can't turn "pick up what's new" into an unbounded fetch loop. The Board
# meets roughly weekly, so 10 meetings is a wide cushion for even a
# multi-month gap in cron runs.
MAX_INCREMENTAL_MEETINGS = 10

# AI enrichment (enrich.py), shared by both scrapers via pipeline.py
GEMINI_MODEL = "gemini-3.6-flash"
CATEGORY_TAXONOMY = [
    "Housing & Development",
    "Transportation & Infrastructure",
    "Budget & Finance",
    "Public Safety",
    "Parks & Environment",
    "Contracts & Procurement",
    "Government Operations",
    "Other",
]
