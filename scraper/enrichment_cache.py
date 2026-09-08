"""Git-committed cache of AI enrichment results, keyed by doc_number.
prisma/dev.db is gitignored, but Gemini calls are rate-limited (20/day free
tier) -- this avoids re-spending quota re-generating a summary already
written once. A cached entry is only reused if its stored `title` still
matches the document's current title."""

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
