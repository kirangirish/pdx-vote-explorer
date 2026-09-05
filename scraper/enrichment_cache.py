"""
A small, git-committed cache of AI enrichment results, keyed by doc_number.

Why this exists: prisma/dev.db is gitignored (each dev generates their own,
see README "Database"), but Gemini calls are rate-limited (20/day on the
free tier) and cost real quota -- there's no reason to make every fresh
clone/dev re-spend that quota re-generating a summary that's already been
written once. Unlike dev.db, this is plain JSON: it diffs and merges like
any other text file, so it's safe to commit and grows as an append-mostly
log of {doc_number: {title, headline, summary, tags}}.

A cache entry is only reused if its stored `title` still matches the
document's current title -- if the title changed, the cached summary would
be describing something else, so it's treated as a miss and regenerated.
"""

import json
import os

CACHE_PATH = os.path.join(os.path.dirname(__file__), "enrichment_cache.json")


def load_cache() -> dict:
    if not os.path.exists(CACHE_PATH):
        return {}
    with open(CACHE_PATH) as f:
        return json.load(f)


def save_cache(cache: dict) -> None:
    with open(CACHE_PATH, "w") as f:
        json.dump(cache, f, indent=2, sort_keys=True)
        f.write("\n")
