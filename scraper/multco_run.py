"""
Scraper entrypoint for Multnomah County Board of Commissioners.

--meetings omitted (default): incremental mode for a daily cron job.
Checks meetings one at a time and stops once a meeting has nothing new
(checked against the database), bounded by MAX_INCREMENTAL_MEETINGS.
--meetings N: one-off backfill. Fetches exactly N meetings.

Usage:
  python multco_run.py                  Incremental
  python multco_run.py --meetings 20    Backfill
  python multco_run.py --dry-run        Parse and report without writing to the DB
  python multco_run.py --no-ai          Skip AI enrichment
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
from constants import (
    HEADERS,
    DEFAULT_DB_PATH,
    MULTCO_MEETING_LIST_URL as MEETING_LIST_URL,
    MULTCO_GOVERNING_BODY as GOVERNING_BODY,
    MAX_PDF_PAGES_TO_SCAN,
    MAX_INCREMENTAL_MEETINGS,
)

load_dotenv("../.env")


def parse_args():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument(
        "--meetings", type=int, default=None,
        help=(
            "Fetch exactly this many most-recent voting meetings (one-off backfill, e.g. "
            f"--meetings 20). If omitted, runs incrementally instead (up to "
            f"{MAX_INCREMENTAL_MEETINGS} meetings), stopping as soon as a meeting has "
            "nothing new -- the default for a daily cron job."
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
    backfill = meetings_limit is not None
    candidate_limit = meetings_limit if backfill else MAX_INCREMENTAL_MEETINGS

    meetings = parse_meeting_list(fetch_meeting_list(), limit=candidate_limit)
    print(f"Found {len(meetings)} voting meeting(s) to check.", file=sys.stderr)

    all_records = []
    fetch_failures = 0

    for i, meeting in enumerate(meetings):
        if i > 0:
            time.sleep(1)

        try:
            pdf_url = resolve_pdf_url(meeting["minutes_viewer_url"])
            if pdf_url is None:
                raise RuntimeError("could not resolve a PDF URL from the minutes viewer link")
            text = fetch_pdf_text(pdf_url)
        except (requests.RequestException, RuntimeError) as e:
            print(f"  ERROR ({meeting['name']}, {meeting['date']}): {e}", file=sys.stderr)
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
                "ERROR: zero vote rows parsed -- likely a Granicus/PDF format change, or "
                "every fetch attempt failed. Aborting without writing to the database.",
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
        sys.exit(1)


if __name__ == "__main__":
    main()
