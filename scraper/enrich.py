"""
AI enrichment: headline, plain-language summary, and category tags for one
council document, generated via Gemini. Spec (scraper/PLAN.md Phase 4):

- headline: <= 60 chars, newspaper-style, states the action not the doc number.
- summary: 2-3 sentences, ~8th-grade reading level, states what changed and
  who it's affects. No jargon, no doc-number references, no procedural
  filler ("Council voted to approve...") -- lead with the substance.
- Neutrality is non-negotiable: describe what changed and who voted how,
  never characterize a vote as good/bad/controversial/partisan. This tool
  is used to research current officials, including ahead of contested
  elections -- any perceived editorializing undermines its purpose.
- tags: 1-2 tags chosen ONLY from CATEGORY_TAXONOMY below.

The frontend is responsible for visibly labeling this content as
AI-generated and citing the source record (CouncilDocument.sourceUrl) --
this module only ever returns the generated fields, never presents them
as unsourced fact itself.
"""

import json
import os

from google import genai
from google.genai import types

CATEGORY_TAXONOMY = [
    "Housing & Development",
    "Transportation & Infrastructure",
    "Budget & Finance",
    "Public Safety",
    "Parks & Environment",
    "Contracts & Procurement",
    "Government Operations",
    "Other",
]

MODEL = "gemini-3.6-flash"

PROMPT_TEMPLATE = """You are writing for a nonpartisan civic transparency tool that helps Portland, Oregon residents understand what their City Council voted on.

Given a council document's title, produce:
1. "headline": a newspaper-style headline, 60 characters or fewer, stating the action taken (not the document number).
2. "summary": 2-3 sentences at an 8th-grade reading level, stating what changed and who it affects. No jargon, no document-number references, no procedural filler like "Council voted to approve...". Lead with the substance.
3. "tags": 1 or 2 tags chosen ONLY from this exact list: {taxonomy}

Critical rule: stay strictly neutral. Describe what changed and who voted how -- never characterize the action as good, bad, controversial, or partisan, and never use adjectives implying judgment. This tool is used by residents to research their elected officials, including ahead of contested elections, so any perceived bias undermines its purpose entirely.

Document title: {title}

Respond with ONLY a JSON object shaped exactly like: {{"headline": "...", "summary": "...", "tags": ["...", "..."]}}
"""

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    return _client


def enrich_document(title: str) -> dict | None:
    """Returns {"headline": ..., "summary": ..., "tags": "Tag One,Tag Two"}
    or None if generation failed or produced something unusable -- callers
    should skip and leave the document for the next run to retry."""
    prompt = PROMPT_TEMPLATE.format(taxonomy=", ".join(CATEGORY_TAXONOMY), title=title)
    try:
        response = _get_client().models.generate_content(
            model=MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        data = json.loads(response.text)
    except Exception as e:
        print(f"  AI enrichment failed for {title[:60]!r}: {e}")
        return None

    headline = (data.get("headline") or "").strip()
    summary = (data.get("summary") or "").strip()
    tags = [t for t in (data.get("tags") or []) if t in CATEGORY_TAXONOMY]

    if not headline or not summary:
        print(f"  AI enrichment returned incomplete data for {title[:60]!r}, skipping")
        return None

    return {
        "headline": headline[:200],
        "summary": summary,
        "tags": ",".join(tags[:2]),
    }
