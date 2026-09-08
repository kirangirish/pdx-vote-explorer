"""
Pure parsing for Multnomah County Board of Commissioners data (no network
I/O, testable against fixtures in scraper/fixtures/).

parse_meeting_list() reads the Granicus meeting-list HTML.
parse_minutes_text() reads text extracted (via pypdf) from a meeting's
Minutes PDF: numbered agenda items (C.1, C.2... consent; R.1, R.2...
regular), each followed by an AYES (N): Name... / NOS (N): Name... block.
Everything from "CAPTIONS" onward is an auto-generated meeting transcript
and is excluded. Note it's NOS, not NAYS -- a real difference from
Portland's "Nay".

Blocks are split on blank lines. Name lists often run on into the next
sentence with no clean punctuation boundary, so `_names_from_list`
searches for known "<Title> <Lastname>" patterns directly and stops once
it's matched as many names as the block declared (AYES (N)).
"""

import re
from datetime import datetime

from bs4 import BeautifulSoup

from multco_roster import LAST_NAME_TO_FULL_NAME

# Only these meeting types are confirmed to hold recorded roll-call votes.
VOTING_MEETING_TYPES = {"Regular Board Meeting", "Special Meeting"}

ITEM_LABEL_RE = re.compile(r"^([CR]\.\d+)\s+(.*)", re.S)
AYES_RE = re.compile(r"AYES\s*\((\d+)\):\s*(.*)")
NOS_RE = re.compile(r"NOS\s*\((\d+)\):\s*(.*)")
# Stop before the motion sentence, not at "moves" itself, or the mover's
# name ("Commissioner Brim-Edwards moves...") gets swallowed into the title.
TITLE_END_RE = re.compile(r"\b(?:Vice Chair|Chair|Commissioner)\s+[\w'-]+\s+moves\b|\bAYES\s*\(")
STOP_MARKERS = ("CAPTIONS", "Submitted by:")

_NAME_ALTERNATION = "|".join(re.escape(k) for k in sorted(LAST_NAME_TO_FULL_NAME, key=len, reverse=True))
NAME_PATTERN_RE = re.compile(rf"\b(?:Vice Chair|Chair|Commissioner)\s+({_NAME_ALTERNATION})\b")


def parse_meeting_list(html: str, limit: int | None = None) -> list[dict]:
    """Returns [{name, date (YYYY-MM-DD), minutes_viewer_url}, ...] for the
    most recent `limit` voting-type meetings (None = all). minutes_viewer_url
    still needs a redirect-follow to reach the actual PDF -- MinutesViewer.php
    302s to a Google Docs viewer URL that embeds the real DocumentViewer.php
    link in its query string.
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
    """Returns one dict per (agenda item, member) vote: doc_number, title,
    vote_date, source_url, member_name, district (None, resolved later via
    the roster), vote."""
    stop_at = len(text)
    for marker in STOP_MARKERS:
        idx = text.find(marker)
        if idx != -1:
            stop_at = min(stop_at, idx)
    text = text[:stop_at]

    # A PDF page footer ("Page 2 of 89") can land mid-title when a title
    # wraps across a page boundary. Strip it along with surrounding
    # whitespace, or the blank-line gap it left still forces a block split.
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
