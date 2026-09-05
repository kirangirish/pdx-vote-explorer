"""
Scraper entrypoint for Multnomah County Board of Commissioners.

Usage:
  python multco_run.py                  Fetch the most recent voting meeting only
  python multco_run.py --meetings 5     Fetch the 5 most recent voting meetings
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
from db import get_connection, save_records, upsert_enrichment
from enrich import enrich_document
from enrichment_cache import load_cache, save_cache

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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--meetings", type=int, default=1, help="Number of most-recent voting meetings to fetch (default: 1)")
    parser.add_argument("--dry-run", action="store_true", help="Parse only, don't write to the database")
    parser.add_argument("--no-ai", action="store_true", help="Skip AI enrichment (headline/summary/tags)")
    parser.add_argument("--db", default=DEFAULT_DB_PATH, help=f"Path to the sqlite db (default: {DEFAULT_DB_PATH})")
    args = parser.parse_args()

    print("Fetching meeting list...", file=sys.stderr)
    meetings = parse_meeting_list(fetch_meeting_list(), limit=args.meetings)
    print(f"Found {len(meetings)} voting meeting(s) to process.", file=sys.stderr)

    all_records = []
    fetch_failures = 0
    for meeting in meetings:
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
        if args.meetings > 1:
            time.sleep(1)  # be polite between requests when pulling multiple meetings

    print(f"Parsed {len(all_records)} vote rows across {len(meetings)} meeting(s).", file=sys.stderr)

    if args.dry_run:
        docs = {r["doc_number"] for r in all_records}
        print(f"[dry run] Would upsert {len(docs)} documents, {len(all_records)} votes. No DB changes made.")
        return

    doc_titles = {r["doc_number"]: r["title"] for r in all_records}

    conn = get_connection(args.db)
    try:
        summary = save_records(conn, all_records, resolve_member, GOVERNING_BODY)

        enriched, enrich_failures, cache_hits = 0, 0, 0
        if not args.no_ai and summary["needs_enrichment"]:
            cache = load_cache()
            print(f"Enriching {len(summary['needs_enrichment'])} document(s)...", file=sys.stderr)
            cursor = conn.cursor()
            for doc_number in summary["needs_enrichment"]:
                title = doc_titles[doc_number]
                cached = cache.get(doc_number)

                if cached and cached.get("title") == title:
                    result = cached
                    cache_hits += 1
                else:
                    result = enrich_document(title)
                    if result is None:
                        enrich_failures += 1
                        continue
                    cache[doc_number] = {"title": title, **result}
                    time.sleep(1)

                upsert_enrichment(cursor, doc_number, result["headline"], result["summary"], result["tags"])
                enriched += 1
            conn.commit()
            save_cache(cache)
    finally:
        conn.close()

    print(
        f"Done. Upserted {summary['documents']} documents, "
        f"{summary['members']} members, {summary['votes']} votes."
        + (f" {fetch_failures} meeting(s) failed to fetch." if fetch_failures else "")
        + ("" if args.no_ai else f" Enriched {enriched} document(s)"
           + (f" ({cache_hits} from cache, {enriched - cache_hits} new)." if enriched else ".")
           + (f" {enrich_failures} enrichment failure(s)." if enrich_failures else ""))
    )


if __name__ == "__main__":
    main()
