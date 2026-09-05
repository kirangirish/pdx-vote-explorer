"""Idempotent persistence for parsed vote records, shared by both scrapers
(Portland City Council and Multnomah County). Every upsert here is a real
ON CONFLICT DO UPDATE, so re-running a scraper corrects existing rows (a
title cleanup, a corrected vote) instead of only ever adding new ones.

Body-specific concerns (roster lookups, photo conventions, source-URL
prefixing) live in each scraper's own module, not here -- db.py just takes
already-resolved values plus a `governing_body` tag so a Portland district 1
and a Multnomah district 1 never get mixed together.
"""

import sqlite3


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


def upsert_document(
    cursor,
    doc_number: str,
    title: str,
    vote_date: str,
    source_url: str | None,
    governing_body: str = "portland_council",
) -> None:
    cursor.execute(
        "INSERT INTO council_documents (doc_number, governing_body, title, vote_date, source_url) "
        "VALUES (?, ?, ?, ?, ?) "
        "ON CONFLICT(doc_number) DO UPDATE SET title = excluded.title, vote_date = excluded.vote_date, "
        "source_url = excluded.source_url",
        (doc_number, governing_body, title, vote_date, source_url),
    )


def upsert_enrichment(cursor, doc_number: str, headline: str, summary: str, tags: str) -> None:
    cursor.execute(
        "UPDATE council_documents SET ai_headline = ?, ai_summary = ?, category_tags = ? WHERE doc_number = ?",
        (headline, summary, tags, doc_number),
    )


def upsert_member(
    cursor,
    member_id: str,
    slug: str,
    full_name: str,
    district: int,
    photo_url: str | None,
    governing_body: str = "portland_council",
) -> None:
    cursor.execute(
        "INSERT INTO council_members (id, slug, governing_body, full_name, district, photo_url) "
        "VALUES (?, ?, ?, ?, ?, ?) "
        "ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, district = excluded.district, "
        "photo_url = excluded.photo_url",
        (member_id, slug, governing_body, full_name, district, photo_url),
    )


def upsert_vote(cursor, doc_number: str, member_id: str, vote: str) -> None:
    vote_id = f"{doc_number}-{member_id}"
    cursor.execute(
        "INSERT INTO member_votes (id, doc_number, member_id, vote) VALUES (?, ?, ?, ?) "
        "ON CONFLICT(doc_number, member_id) DO UPDATE SET vote = excluded.vote",
        (vote_id, doc_number, member_id, vote),
    )


def save_records(conn: sqlite3.Connection, records: list[dict], resolve_member, governing_body: str = "portland_council") -> dict:
    """Upserts every record. `records` is a list of dicts with doc_number,
    title, vote_date, source_url, member_name, vote (and whatever
    `resolve_member(member_name, record) -> {"slug", "district", "photo_url"}`
    needs from the record, e.g. a parsed district). Returns a summary
    including `needs_enrichment`: doc_numbers that are new, whose title
    changed, or that have never been AI-enriched.
    """
    seen_docs, seen_members, seen_votes = set(), set(), set()
    needs_enrichment = []
    cursor = conn.cursor()
    for r in records:
        if r["doc_number"] not in seen_docs:
            existing = get_existing_document(cursor, r["doc_number"])
            if existing is None or existing["title"] != r["title"] or existing["ai_headline"] is None:
                needs_enrichment.append(r["doc_number"])
            upsert_document(cursor, r["doc_number"], r["title"], r["vote_date"], r.get("source_url"), governing_body)
            seen_docs.add(r["doc_number"])
        if r["member_name"] not in seen_members:
            resolved = resolve_member(r["member_name"], r)
            upsert_member(
                cursor, r["member_name"], resolved["slug"], r["member_name"],
                resolved["district"], resolved["photo_url"], governing_body,
            )
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
