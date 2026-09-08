"""Configuration constants shared across the scraper pipelines: URLs, HTTP
headers, DB path, governing-body tags, safety-cap thresholds, and AI
enrichment config. Parsing-specific constants stay in their own parser
modules, tightly coupled to the logic they sit next to."""

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
MAX_CONSECUTIVE_FETCH_FAILURES = 3
MAX_INCREMENTAL_PAGES = 20

# Multnomah County (multco_run.py)
MULTCO_MEETING_LIST_URL = "https://multnomah.granicus.com/ViewPublisher.php?view_id=3"
MULTCO_GOVERNING_BODY = "multnomah_county"
MAX_PDF_PAGES_TO_SCAN = 15
MAX_INCREMENTAL_MEETINGS = 10

# AI enrichment (enrich.py), shared via pipeline.py
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
