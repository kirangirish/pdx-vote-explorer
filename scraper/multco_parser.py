"""
Pure parsing for Multnomah County Board of Commissioners data. No network
I/O here so this can be tested against a saved fixture (scraper/fixtures/).

Two inputs:
1. The meeting-list HTML from multnomah.granicus.com/ViewPublisher.php --
   `parse_meeting_list()` finds Regular/Special Board Meeting rows (the
   only types confirmed to hold recorded votes) and their Minutes link.
2. The text extracted (via pypdf) from a meeting's Minutes PDF --
   `parse_minutes_text()` finds each numbered agenda item and its vote.

Minutes PDF structure (confirmed against a real fixture, 2026-09-05): the
first few pages are the actual minutes -- numbered items (C.1, C.2... for
the consent agenda, R.1, R.2... for the regular agenda), each followed by
an AYES (N): Name, Name... / NOS (N): Name, Name... block (NOS, not NAYS --
a real difference from Portland's "Nay"). Everything from "CAPTIONS"
onward is an auto-generated Webex transcript of the entire meeting (100+
pages) and is not part of the formal record -- must be excluded or the
parser wastes time scanning speaker-by-speaker chatter for a pattern that
isn't there.

Blocks are separated by blank lines in the extracted text, which is more
reliable to split on than sentence punctuation given pypdf preserves the
PDF's mid-sentence line wraps as literal newlines. A regular-agenda item
(R.N) typically has its title, motion, and AYES/NOS vote all in ONE block
(no blank line in between); a consent-agenda item (C.N) is usually just a
title in its own block, with several C.N titles sharing ONE vote block
for "the consent calendar" later on. Both shapes are handled the same way
here: whichever block(s) are still pending when an AYES line is found get
that vote applied to all of them.

Name lists in the AYES/NOS text often run on into the following outcome
sentence with no clean punctuation boundary ("...Chair Vega Pederson The
consent agenda is approved."). Rather than fight that with a fragile
regex boundary, `_names_from_list` just searches the raw text for known
"<Title> <Lastname>" patterns directly and stops once it's found as many
as the block itself declared (`AYES (N)`) -- robust regardless of what
trailing prose got captured alongside the names.
"""

import re
from datetime import datetime

from bs4 import BeautifulSoup

from multco_roster import LAST_NAME_TO_FULL_NAME

# Only these meeting types have been confirmed to hold recorded roll-call
# votes (see scraper/PLAN.md); Board Briefings and Budget Work Sessions
# don't appear to.
VOTING_MEETING_TYPES = {"Regular Board Meeting", "Special Meeting"}

ITEM_LABEL_RE = re.compile(r"^([CR]\.\d+)\s+(.*)", re.S)
AYES_RE = re.compile(r"AYES\s*\((\d+)\):\s*(.*)")
NOS_RE = re.compile(r"NOS\s*\((\d+)\):\s*(.*)")
# Stop the title right before the motion sentence, not at the word "moves"
# itself -- otherwise the mover's name ("Commissioner Brim-Edwards moves...")
# gets swallowed into the title text.
TITLE_END_RE = re.compile(r"\b(?:Vice Chair|Chair|Commissioner)\s+[\w'-]+\s+moves\b|\bAYES\s*\(")
STOP_MARKERS = ("CAPTIONS", "Submitted by:")

_NAME_ALTERNATION = "|".join(re.escape(k) for k in sorted(LAST_NAME_TO_FULL_NAME, key=len, reverse=True))
NAME_PATTERN_RE = re.compile(rf"\b(?:Vice Chair|Chair|Commissioner)\s+({_NAME_ALTERNATION})\b")


def parse_meeting_list(html: str, limit: int | None = None) -> list[dict]:
    """Returns [{name, date (YYYY-MM-DD), minutes_viewer_url}, ...] for the
    most recent `limit` voting-type meetings (None = all), most recent
    first, matching the page's own order. minutes_viewer_url still needs a
    redirect-follow (see multco_run.fetch_minutes_pdf_url) to reach the
    actual PDF -- MinutesViewer.php 302s to a Google Docs viewer URL that
    embeds the real DocumentViewer.php PDF link in its query string.
    """
    soup = BeautifulSoup(html, "html.parser")
    meetings = []
    for row in soup.find_all("tr"):
        name_cell = row.find("td", class_="listItem", id=True)
        if name_cell is None:
            continue
        name = name_cell.get_text(strip=True)
        if name not in VOTING_MEETING_TYPES:
            continue

        date_cell = row.find("td", headers=lambda h: h and h.startswith("Date "))
        timestamp_span = date_cell.find("span") if date_cell else None
        if timestamp_span is None or not timestamp_span.get_text(strip=True).isdigit():
            continue
        meeting_date = datetime.utcfromtimestamp(int(timestamp_span.get_text(strip=True))).strftime("%Y-%m-%d")

        minutes_link = next(
            (a for a in row.find_all("a") if a.get_text(strip=True) == "Minutes"), None
        )
        if minutes_link is None or not minutes_link.get("href"):
            continue
        minutes_url = minutes_link["href"]
        if minutes_url.startswith("//"):
            minutes_url = "https:" + minutes_url

        meetings.append({"name": name, "date": meeting_date, "minutes_viewer_url": minutes_url})
        if limit is not None and len(meetings) >= limit:
            break

    return meetings


def _normalize_paragraph(block: str) -> str:
    return " ".join(line.strip() for line in block.strip().splitlines() if line.strip())


def _names_from_list(raw: str, expected_count: int) -> list[str]:
    names = []
    for m in NAME_PATTERN_RE.finditer(raw):
        full_name = LAST_NAME_TO_FULL_NAME[m.group(1)]
        if full_name not in names:
            names.append(full_name)
        if len(names) >= expected_count:
            break
    return names


def parse_minutes_text(text: str, meeting_date: str, source_url: str | None = None) -> list[dict]:
    """Returns one dict per (agenda item, member) vote:
    doc_number, title, vote_date, source_url, member_name, district (None
    -- resolved later via the roster, same as parser.py's convention), vote.
    """
    stop_at = len(text)
    for marker in STOP_MARKERS:
        idx = text.find(marker)
        if idx != -1:
            stop_at = min(stop_at, idx)
    text = text[:stop_at]

    # pypdf extracts each page's footer in visual reading order, which can
    # land it mid-sentence when a title happens to wrap across a page
    # boundary (e.g. "...Ordinance Amending MCC Page 2 of 89 Chapter
    # 11.500..."). Strip it globally rather than special-case every place
    # a title might wrap.
    # Strip the surrounding whitespace along with the footer text itself --
    # otherwise the blank-line gap it sat in still forces an unwanted block
    # split at that position, truncating whatever title wrapped across it.
    text = re.sub(r"\s*Page \d+ of \d+\s*", " ", text)

    blocks = [_normalize_paragraph(b) for b in re.split(r"\n\s*\n", text)]
    blocks = [b for b in blocks if b]

    records = []
    pending_items: list[tuple[str, str]] = []  # (label, title)

    for block in blocks:
        item_match = ITEM_LABEL_RE.match(block)
        if item_match:
            rest = item_match.group(2)
            end = TITLE_END_RE.search(rest)
            title = (rest[:end.start()] if end else rest).strip()
            pending_items.append((item_match.group(1), title))

        ayes_match = AYES_RE.search(block)
        if ayes_match and pending_items:
            aye_names = _names_from_list(ayes_match.group(2), int(ayes_match.group(1)))
            nos_match = NOS_RE.search(block)
            no_names = _names_from_list(nos_match.group(2), int(nos_match.group(1))) if nos_match else []

            for label, title in pending_items:
                doc_number = f"{meeting_date}-{label}"
                for name in aye_names:
                    records.append({
                        "doc_number": doc_number, "title": title, "vote_date": meeting_date,
                        "source_url": source_url, "member_name": name, "district": None, "vote": "Yea",
                    })
                for name in no_names:
                    records.append({
                        "doc_number": doc_number, "title": title, "vote_date": meeting_date,
                        "source_url": source_url, "member_name": name, "district": None, "vote": "Nay",
                    })
            pending_items = []

    return records
