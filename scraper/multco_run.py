"""
Scraper entrypoint for Multnomah County Board of Commissioners.

Two distinct modes, controlled by --meetings (mirrors run.py's --pages):

- Incremental (default, no --meetings given): the right mode for a daily
  cron job. Checks voting meetings one at a time, most-recent-first, and
  stops as soon as a meeting has nothing new to learn (checked against
  the database itself) -- bounded by MAX_INCREMENTAL_MEETINGS as a safety
  cap. A normal day finds nothing new at all (the Board meets roughly
  weekly); if a run gets missed, it self-heals by walking back further.
- Backfill (--meetings N given explicitly): a one-off historical pull.
  Fetches exactly N meetings, full stop, regardless of what's already known.

Usage:
  python multco_run.py                  Incremental: pick up whatever's new since the last run
  python multco_run.py --meetings 20    Backfill: fetch exactly 20 meetings, one-off
  python multco_run.py --dry-run        Parse and report without writing to the DB
  python multco_run.py --no-ai          Skip AI enrichment (headline/summary/tags)
"""

import argparse
import io
import sys
import time
from urllib.parse import parse_qs, urlparse

import requests
from dotenv import load_dotenv
from pypdf import PdfReader

from multco_parser import parse_meeting_list, parse_minutes_text
from multco_roster import lookup as roster_lookup
from db import get_connection, save_records, all_records_already_current
from pipeline import enrich_needed_documents, format_summary_line

load_dotenv("../.env")

MEETING_LIST_URL = "https://multnomah.granicus.com/ViewPublisher.php?view_id=3"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}
DEFAULT_DB_PATH = "../prisma/dev.db"
GOVERNING_BODY = "multnomah_county"
# The real minutes narrative is only ever the first few pages; everything
# after "CAPTIONS" is a 100+ page auto-generated transcript. Capping the
# extraction avoids wasting time decoding pages we'll throw away anyway.
MAX_PDF_PAGES_TO_SCAN = 15
# Safety cap for incremental mode, so a bug or a genuinely empty database
# can't turn "pick up what's new" into an unbounded fetch loop. The Board
# meets roughly weekly, so 10 meetings is a wide cushion for even a
# multi-month gap in cron runs.
MAX_INCREMENTAL_MEETINGS = 10


def parse_args():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument(
        "--meetings", type=int, default=None,
        help=(
            "Fetch exactly this many most-recent voting meetings (one-off backfill mode, "
            "e.g. --meetings 20). If omitted, runs in incremental mode instead: checks "
            f"meetings one at a time (up to {MAX_INCREMENTAL_MEETINGS} as a safety cap) and "
            "stops as soon as a meeting has nothing new -- the right default for a daily cron job."
        ),
    )
    cli.add_argument("--dry-run", action="store_true", help="Parse only, don't write to the database")
    cli.add_argument("--no-ai", action="store_true", help="Skip AI enrichment (headline/summary/tags)")
    cli.add_argument("--db", default=DEFAULT_DB_PATH, help=f"Path to the sqlite db (default: {DEFAULT_DB_PATH})")
    return cli.parse_args()


def resolve_member(member_name: str, record: dict) -> dict:
    entry = roster_lookup(member_name)
    return {
        "slug": entry["slug"],
        "district": entry["district"],
        "photo_url": f"/members/{entry['slug']}.{entry['ext']}",
    }


def fetch_meeting_list() -> str:
    response = requests.get(MEETING_LIST_URL, headers=HEADERS, timeout=30)
    response.raise_for_status()
    return response.text


def resolve_pdf_url(minutes_viewer_url: str) -> str | None:
    """MinutesViewer.php 302s to a Google Docs viewer URL that embeds the
    real DocumentViewer.php PDF link in its `url` query param."""
    response = requests.get(minutes_viewer_url, headers=HEADERS, timeout=15, allow_redirects=False)
    location = response.headers.get("location")
    if not location:
        return None
    embedded = parse_qs(urlparse(location).query).get("url")
    return embedded[0] if embedded else None


def fetch_pdf_text(pdf_url: str) -> str:
    response = requests.get(pdf_url, headers=HEADERS, timeout=30)
    response.raise_for_status()
    reader = PdfReader(io.BytesIO(response.content))
    text = ""
    for page in reader.pages[:MAX_PDF_PAGES_TO_SCAN]:
        text += page.extract_text()
        if "CAPTIONS" in text:
            break
    return text


def fetch_meeting_records(cursor, meetings_limit: int | None) -> tuple[list[dict], int]:
    """Fetches and parses voting meetings, in either backfill or
    incremental mode (see module docstring). Returns
    (records, fetch_failure_count)."""
    backfill = meetings_limit is not None
    candidate_limit = meetings_limit if backfill else MAX_INCREMENTAL_MEETINGS

    print("Fetching meeting list...", file=sys.stderr)
    meetings = parse_meeting_list(fetch_meeting_list(), limit=candidate_limit)
    print(f"Found {len(meetings)} voting meeting(s) to check.", file=sys.stderr)

    all_records = []
    fetch_failures = 0

    for i, meeting in enumerate(meetings):
        if i > 0:
            time.sleep(1)  # be polite between requests when pulling multiple meetings

        print(f"  {meeting['name']} ({meeting['date']})...", file=sys.stderr)
        try:
            pdf_url = resolve_pdf_url(meeting["minutes_viewer_url"])
            if pdf_url is None:
                raise RuntimeError("could not resolve a PDF URL from the minutes viewer link")
            text = fetch_pdf_text(pdf_url)
        except (requests.RequestException, RuntimeError) as e:
            print(f"    ERROR: {e}", file=sys.stderr)
            fetch_failures += 1
            continue

        records = parse_minutes_text(text, meeting["date"], source_url=pdf_url)
        all_records.extend(records)

        if not backfill and records and all_records_already_current(cursor, records):
            print(f"  {meeting['name']} ({meeting['date']}) has nothing new -- caught up, stopping.", file=sys.stderr)
            break

    return all_records, fetch_failures


def main():
    args = parse_args()

    conn = get_connection(args.db)
    try:
        cursor = conn.cursor()
        all_records, fetch_failures = fetch_meeting_records(cursor, args.meetings)

        print(f"Parsed {len(all_records)} vote rows.", file=sys.stderr)

        if not all_records:
            print(
                "ERROR: zero vote rows parsed. This almost always means either the Granicus "
                "page or minutes PDF format changed and multco_parser.py needs updating, or "
                "every fetch attempt failed -- aborting without writing to the database.",
                file=sys.stderr,
            )
            sys.exit(1)

        if args.dry_run:
            docs = {r["doc_number"] for r in all_records}
            print(f"[dry run] Would upsert {len(docs)} documents, {len(all_records)} votes. No DB changes made.")
            if fetch_failures:
                print(f"[dry run] {fetch_failures} meeting(s) failed to fetch and were skipped.")
            return

        doc_titles = {r["doc_number"]: r["title"] for r in all_records}

        save_summary = save_records(conn, all_records, resolve_member, GOVERNING_BODY)
        enrichment = enrich_needed_documents(conn, doc_titles, save_summary["needs_enrichment"], args.no_ai)
    finally:
        conn.close()

    failure_note = f"{fetch_failures} meeting(s) failed to fetch." if fetch_failures else ""
    print(format_summary_line(save_summary, enrichment, args.no_ai, failure_note))

    if fetch_failures:
        # Some data was still saved successfully above, but a cron/monitoring
        # setup should be able to see that this run was incomplete.
        sys.exit(1)


if __name__ == "__main__":
    main()
