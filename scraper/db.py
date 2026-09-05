"""Idempotent persistence for parsed vote records. Every upsert here is a
real ON CONFLICT DO UPDATE, so re-running the scraper corrects existing rows
(a title cleanup, a corrected vote) instead of only ever adding new ones.
"""

import sqlite3
from roster import lookup as roster_lookup

PORTLAND_GOV_BASE = "https://www.portland.gov"


def get_connection(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def get_existing_document(cursor, doc_number: str) -> dict | None:
    cursor.execute(
        "SELECT title, ai_headline FROM council_documents WHERE doc_number = ?",
        (doc_number,),
    )
    row = cursor.fetchone()
    if row is None:
        return None
    return {"title": row[0], "ai_headline": row[1]}


def upsert_document(cursor, doc_number: str, title: str, vote_date: str, doc_url: str | None) -> None:
    source_url = f"{PORTLAND_GOV_BASE}{doc_url}" if doc_url else None
    cursor.execute(
        "INSERT INTO council_documents (doc_number, title, vote_date, source_url) VALUES (?, ?, ?, ?) "
        "ON CONFLICT(doc_number) DO UPDATE SET title = excluded.title, vote_date = excluded.vote_date, "
        "source_url = excluded.source_url",
        (doc_number, title, vote_date, source_url),
    )


def upsert_enrichment(cursor, doc_number: str, headline: str, summary: str, tags: str) -> None:
    cursor.execute(
        "UPDATE council_documents SET ai_headline = ?, ai_summary = ?, category_tags = ? WHERE doc_number = ?",
        (headline, summary, tags, doc_number),
    )


def upsert_member(cursor, member_name: str, district: int | None, parsed_slug: str | None = None) -> None:
    roster_entry = roster_lookup(member_name)
    resolved_district = district if district is not None else roster_entry["district"]
    # Prefer the slug scraped straight from the member's own /council/districts/{d}/{slug}
    # link (self-updating if a name ever changes); fall back to the static roster.
    slug = parsed_slug or roster_entry["slug"]
    photo_url = f"/members/{roster_entry['slug']}.{roster_entry['ext']}"
    cursor.execute(
        "INSERT INTO council_members (id, slug, full_name, district, photo_url) VALUES (?, ?, ?, ?, ?) "
        "ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, district = excluded.district, photo_url = excluded.photo_url",
        (member_name, slug, member_name, resolved_district, photo_url),
    )


def upsert_vote(cursor, doc_number: str, member_name: str, vote: str) -> None:
    vote_id = f"{doc_number}-{member_name}"
    cursor.execute(
        "INSERT INTO member_votes (id, doc_number, member_id, vote) VALUES (?, ?, ?, ?) "
        "ON CONFLICT(doc_number, member_id) DO UPDATE SET vote = excluded.vote",
        (vote_id, doc_number, member_name, vote),
    )


def save_records(conn: sqlite3.Connection, records: list[dict]) -> dict:
    """Upserts every record. Returns a summary of what happened for reporting,
    including `needs_enrichment`: doc_numbers that are new, whose title
    changed, or that have never been AI-enriched -- so the caller only spends
    Gemini calls on documents that actually need it.
    """
    seen_docs, seen_members, seen_votes = set(), set(), set()
    needs_enrichment = []
    cursor = conn.cursor()
    for r in records:
        if r["doc_number"] not in seen_docs:
            existing = get_existing_document(cursor, r["doc_number"])
            if existing is None or existing["title"] != r["title"] or existing["ai_headline"] is None:
                needs_enrichment.append(r["doc_number"])
            upsert_document(cursor, r["doc_number"], r["title"], r["vote_date"], r.get("doc_url"))
            seen_docs.add(r["doc_number"])
        if r["member_name"] not in seen_members:
            upsert_member(cursor, r["member_name"], r["district"], r.get("member_slug"))
            seen_members.add(r["member_name"])
        upsert_vote(cursor, r["doc_number"], r["member_name"], r["vote"])
        seen_votes.add((r["doc_number"], r["member_name"]))
    conn.commit()
    return {
        "documents": len(seen_docs),
        "members": len(seen_members),
        "votes": len(seen_votes),
        "needs_enrichment": needs_enrichment,
    }
