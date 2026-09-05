"""
Scraper entrypoint: fetch portland.gov/council/votes -> parse -> upsert.

Usage:
  python run.py                  Fetch the most recent page (page 0) only
  python run.py --pages 5        Fetch the 5 most recent pages
  python run.py --dry-run        Parse and report without writing to the DB
  python run.py --no-ai          Skip AI enrichment (headline/summary/tags)
"""

import argparse
import sys
import time

import requests
from dotenv import load_dotenv

from parser import parse_votes_page
from db import get_connection, save_records, upsert_enrichment
from enrich import enrich_document

load_dotenv("../.env")

BASE_URL = "https://www.portland.gov/council/votes"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}
DEFAULT_DB_PATH = "../prisma/dev.db"


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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pages", type=int, default=1, help="Number of most-recent pages to fetch (default: 1)")
    parser.add_argument("--dry-run", action="store_true", help="Parse only, don't write to the database")
    parser.add_argument("--no-ai", action="store_true", help="Skip AI enrichment (headline/summary/tags)")
    parser.add_argument("--db", default=DEFAULT_DB_PATH, help=f"Path to the sqlite db (default: {DEFAULT_DB_PATH})")
    args = parser.parse_args()

    all_records = []
    parse_failures = 0
    for page in range(args.pages):
        print(f"Fetching page {page}...", file=sys.stderr)
        try:
            html = fetch_page(page)
        except RuntimeError as e:
            print(f"  ERROR: {e}", file=sys.stderr)
            parse_failures += 1
            continue
        records = parse_votes_page(html)
        if not records and page > 0:
            print(f"  No records found on page {page}, stopping early.", file=sys.stderr)
            break
        all_records.extend(records)
        if args.pages > 1:
            time.sleep(1)  # be polite between requests when pulling multiple pages

    print(f"Parsed {len(all_records)} vote rows across {args.pages} page(s).", file=sys.stderr)

    if args.dry_run:
        docs = {r["doc_number"] for r in all_records}
        print(f"[dry run] Would upsert {len(docs)} documents, {len(all_records)} votes. No DB changes made.")
        return

    doc_titles = {r["doc_number"]: r["title"] for r in all_records}

    conn = get_connection(args.db)
    try:
        summary = save_records(conn, all_records)

        enriched, enrich_failures = 0, 0
        if not args.no_ai and summary["needs_enrichment"]:
            print(f"Enriching {len(summary['needs_enrichment'])} document(s) via Gemini...", file=sys.stderr)
            cursor = conn.cursor()
            for doc_number in summary["needs_enrichment"]:
                result = enrich_document(doc_titles[doc_number])
                if result is None:
                    enrich_failures += 1
                    continue
                upsert_enrichment(cursor, doc_number, result["headline"], result["summary"], result["tags"])
                enriched += 1
                time.sleep(1)  # be polite to the Gemini API too
            conn.commit()
    finally:
        conn.close()

    print(
        f"Done. Upserted {summary['documents']} documents, "
        f"{summary['members']} members, {summary['votes']} votes."
        + (f" {parse_failures} page(s) failed to fetch." if parse_failures else "")
        + ("" if args.no_ai else f" Enriched {enriched} document(s)."
           + (f" {enrich_failures} enrichment failure(s)." if enrich_failures else ""))
    )


if __name__ == "__main__":
    main()
