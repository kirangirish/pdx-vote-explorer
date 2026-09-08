"""
Scraper entrypoint: fetch portland.gov/council/votes -> parse -> upsert.

--pages omitted (default): incremental mode for a daily cron job. Fetches
pages one at a time and stops once a page has nothing new (checked against
the database), bounded by MAX_INCREMENTAL_PAGES. Self-heals from a missed
run by walking back further automatically.
--pages N: one-off backfill. Fetches exactly N pages regardless of what's
already known.

Usage:
  python run.py                  Incremental
  python run.py --pages 30       Backfill
  python run.py --dry-run        Parse and report without writing to the DB
  python run.py --no-ai          Skip AI enrichment

Exit codes: 1 if zero rows were parsed (likely a markup change) or any page
failed to fetch, so cron/monitoring can alert on it.
"""

import argparse
import sys
import time

import requests
from dotenv import load_dotenv

from parser import parse_votes_page
from db import get_connection, save_records, all_records_already_current
from pipeline import enrich_needed_documents, format_summary_line
from roster import lookup as roster_lookup
from constants import (
    HEADERS,
    DEFAULT_DB_PATH,
    PORTLAND_BASE_URL as BASE_URL,
    PORTLAND_GOV_BASE,
    PORTLAND_GOVERNING_BODY as GOVERNING_BODY,
    MAX_CONSECUTIVE_FETCH_FAILURES,
    MAX_INCREMENTAL_PAGES,
)

load_dotenv("../.env")


def parse_args():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument(
        "--pages", type=int, default=None,
        help=(
            "Fetch exactly this many most-recent pages (one-off backfill, e.g. --pages 30). "
            f"If omitted, runs incrementally instead (up to {MAX_INCREMENTAL_PAGES} pages), "
            "stopping as soon as a page has nothing new -- the default for a daily cron job."
        ),
    )
    cli.add_argument("--dry-run", action="store_true", help="Parse only, don't write to the database")
    cli.add_argument("--no-ai", action="store_true", help="Skip AI enrichment (headline/summary/tags)")
    cli.add_argument("--db", default=DEFAULT_DB_PATH, help=f"Path to the sqlite db (default: {DEFAULT_DB_PATH})")
    return cli.parse_args()


def resolve_member(member_name: str, record: dict) -> dict:
    entry = roster_lookup(member_name)
    parsed_district = record.get("district")
    return {
        "slug": record.get("member_slug") or entry["slug"],
        "district": parsed_district if parsed_district is not None else entry["district"],
        "photo_url": f"/members/{entry['slug']}.{entry['ext']}",
    }


def fetch_page(page: int, retries: int = 3) -> str:
    url = BASE_URL if page == 0 else f"{BASE_URL}?page={page}"
    last_error = None
    for attempt in range(retries):
        try:
            response = requests.get(url, headers=HEADERS, timeout=15)
            response.raise_for_status()
            return response.text
        except requests.RequestException as e:
            last_error = e
            time.sleep(2 ** attempt)
    raise RuntimeError(f"Failed to fetch {url} after {retries} attempts") from last_error


def fetch_records(cursor, pages: int | None) -> tuple[list[dict], list[int]]:
    backfill = pages is not None
    page_limit = pages if backfill else MAX_INCREMENTAL_PAGES

    all_records = []
    fetch_failures = []
    consecutive_failures = 0

    for page in range(page_limit):
        if page > 0:
            time.sleep(1)

        try:
            html = fetch_page(page)
        except RuntimeError as e:
            print(f"  ERROR: {e}", file=sys.stderr)
            fetch_failures.append(page)
            consecutive_failures += 1
            if consecutive_failures >= MAX_CONSECUTIVE_FETCH_FAILURES:
                print(
                    f"  ABORTING pagination: {consecutive_failures} consecutive fetch failures "
                    f"-- likely rate-limited or blocked. Re-run later instead of continuing.",
                    file=sys.stderr,
                )
                break
            continue
        consecutive_failures = 0

        records = parse_votes_page(html)
        if not records and page > 0:
            print(f"  No records found on page {page}, stopping (reached end of pagination).", file=sys.stderr)
            break

        all_records.extend(records)

        if not backfill and records and all_records_already_current(cursor, records):
            print(f"  Page {page} has nothing new -- caught up, stopping.", file=sys.stderr)
            break

    return all_records, fetch_failures


def main():
    args = parse_args()

    conn = get_connection(args.db)
    try:
        cursor = conn.cursor()
        all_records, fetch_failures = fetch_records(cursor, args.pages)

        print(f"Parsed {len(all_records)} vote rows.", file=sys.stderr)

        if not all_records:
            print(
                "ERROR: zero vote rows parsed -- likely a markup change in parser.py, "
                "not genuinely empty pages. Aborting without writing to the database.",
                file=sys.stderr,
            )
            sys.exit(1)

        if args.dry_run:
            docs = {r["doc_number"] for r in all_records}
            print(f"[dry run] Would upsert {len(docs)} documents, {len(all_records)} votes. No DB changes made.")
            if fetch_failures:
                print(f"[dry run] Page(s) {', '.join(str(p) for p in fetch_failures)} failed to fetch and were skipped.")
            return

        doc_titles = {r["doc_number"]: r["title"] for r in all_records}
        for r in all_records:
            r["source_url"] = f"{PORTLAND_GOV_BASE}{r['doc_url']}" if r.get("doc_url") else None

        save_summary = save_records(conn, all_records, resolve_member, GOVERNING_BODY)
        enrichment = enrich_needed_documents(conn, doc_titles, save_summary["needs_enrichment"], args.no_ai)
    finally:
        conn.close()

    failure_note = f"Page(s) {', '.join(str(p) for p in fetch_failures)} failed to fetch." if fetch_failures else ""
    print(format_summary_line(save_summary, enrichment, args.no_ai, failure_note))

    if fetch_failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
