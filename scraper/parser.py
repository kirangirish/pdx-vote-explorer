"""
Pure HTML parsing for the portland.gov/council/votes page. No network I/O
here so this can be tested against a saved fixture (scraper/fixtures/).

Page structure (confirmed against a live fixture 2026-09-05): each vote date
renders as a `div.table-group` (an <h2> wrapping a <time datetime="...">)
immediately followed by a sibling `div.table-responsive` containing the
actual votes <table> for that date. One table = one council document; every
row in its <tbody> is one member's vote on that document.

The server's raw markup never closes each row's leading <th> before its
sibling <td>s (relies on a browser's HTML5 parser to auto-close it). Must
parse with "html5lib", which implements the same auto-closing rules a real
browser does -- "html.parser" takes the markup literally and nests every
<td> inside the <th>, corrupting every field.
"""

import re
from bs4 import BeautifulSoup

DISTRICT_LINK_RE = re.compile(r"^/council/districts/(\d+)/([\w-]+)$")


def _cell(row, field_name, tag="td"):
    return row.find(tag, class_=f"views-field-field-{field_name}")


def parse_votes_page(html: str) -> list[dict]:
    """Returns one dict per (document, member) vote row:
    doc_number, title, doc_url, vote_date (YYYY-MM-DD), member_name,
    member_slug, district, vote.
    """
    soup = BeautifulSoup(html, "html5lib")
    records = []

    date_headings = [h for h in soup.find_all("h2") if h.find("time", class_="datetime")]

    for heading in date_headings:
        vote_date = heading.find("time", class_="datetime")["datetime"]
        table_group = heading.parent
        table_wrapper = table_group.find_next_sibling("div", class_="table-responsive")
        table = table_wrapper.find("table") if table_wrapper else None
        if table is None:
            continue

        tbody = table.find("tbody")
        if tbody is None:
            continue

        for row in tbody.find_all("tr"):
            doc_th = _cell(row, "document-number", tag="th")
            title_td = _cell(row, "full-document-title")
            member_td = _cell(row, "name")
            vote_td = _cell(row, "voted-as-follows")
            if not (doc_th and title_td and member_td and vote_td):
                continue

            title_a = title_td.find("a")
            member_a = member_td.find("a")

            district, member_slug = None, None
            if member_a and member_a.get("href"):
                match = DISTRICT_LINK_RE.match(member_a["href"])
                if match:
                    district = int(match.group(1))
                    member_slug = match.group(2)

            records.append({
                "doc_number": doc_th.get_text(strip=True),
                "title": (title_a or title_td).get_text(strip=True),
                "doc_url": title_a["href"] if title_a else None,
                "vote_date": vote_date,
                "member_name": (member_a or member_td).get_text(strip=True),
                "member_slug": member_slug,
                "district": district,
                "vote": vote_td.get_text(strip=True),
            })

    return records
