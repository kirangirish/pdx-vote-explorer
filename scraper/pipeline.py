"""
Shared orchestration helpers used by both scraper entrypoints (run.py for
Portland City Council, multco_run.py for Multnomah County). The AI
enrichment loop and the final summary line were previously copy-pasted
almost verbatim between the two -- they live here once instead.
"""

import sys
import time

from db import upsert_enrichment
from enrich import enrich_document
from enrichment_cache import load_cache, save_cache


def enrich_needed_documents(conn, doc_titles: dict, needs_enrichment: list, skip_ai: bool) -> dict:
    """Runs AI enrichment for every doc_number in `needs_enrichment`,
    reusing the git-committed cache (enrichment_cache.py, keyed by
    doc_number+title) to avoid re-spending Gemini's free-tier daily quota
    on a document that's already been enriched once.

    Returns {"enriched": int, "cache_hits": int, "failures": int} -- all
    zero if skip_ai is True or there was nothing to enrich.
    """
    result = {"enriched": 0, "cache_hits": 0, "failures": 0}
    if skip_ai or not needs_enrichment:
        return result

    cache = load_cache()
    print(f"Enriching {len(needs_enrichment)} document(s)...", file=sys.stderr)
    cursor = conn.cursor()
    for doc_number in needs_enrichment:
        title = doc_titles[doc_number]
        cached = cache.get(doc_number)

        if cached and cached.get("title") == title:
            enrichment = cached
            result["cache_hits"] += 1
        else:
            enrichment = enrich_document(title)
            if enrichment is None:
                result["failures"] += 1
                continue
            cache[doc_number] = {"title": title, **enrichment}
            time.sleep(1)  # be polite to the Gemini API -- only for real calls, not cache hits

        upsert_enrichment(cursor, doc_number, enrichment["headline"], enrichment["summary"], enrichment["tags"])
        result["enriched"] += 1

    conn.commit()
    save_cache(cache)
    return result


def format_summary_line(save_summary: dict, enrichment: dict, skip_ai: bool, failure_note: str = "") -> str:
    """Builds the final one-line run summary printed by both entrypoints."""
    line = (
        f"Done. Upserted {save_summary['documents']} documents, "
        f"{save_summary['members']} members, {save_summary['votes']} votes."
    )
    if failure_note:
        line += f" {failure_note}"
    if not skip_ai:
        line += f" Enriched {enrichment['enriched']} document(s)"
        if enrichment["enriched"]:
            new = enrichment["enriched"] - enrichment["cache_hits"]
            line += f" ({enrichment['cache_hits']} from cache, {new} new)."
        else:
            line += "."
        if enrichment["failures"]:
            line += f" {enrichment['failures']} enrichment failure(s)."
    return line
