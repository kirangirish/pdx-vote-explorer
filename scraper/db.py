"""Idempotent persistence for parsed vote records. Every upsert here is a
real ON CONFLICT DO UPDATE, so re-running the scraper corrects existing rows
(a title cleanup, a corrected vote) instead of only ever adding new ones.
"""

import sqlite3
from roster import lookup as roster_lookup


def get_connection(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def upsert_document(cursor, doc_number: str, title: str, vote_date: str) -> None:
    cursor.execute(
        "INSERT INTO council_documents (doc_number, title, vote_date) VALUES (?, ?, ?) "
        "ON CONFLICT(doc_number) DO UPDATE SET title = excluded.title, vote_date = excluded.vote_date",
        (doc_number, title, vote_date),
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
    """Upserts every record, returns a summary of what happened for reporting."""
    seen_docs, seen_members, seen_votes = set(), set(), set()
    cursor = conn.cursor()
    for r in records:
        if r["doc_number"] not in seen_docs:
            upsert_document(cursor, r["doc_number"], r["title"], r["vote_date"])
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
    }
