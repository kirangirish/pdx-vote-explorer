"""
Pure HTML parsing for the portland.gov/council/votes page (no network I/O,
so this is testable against a fixture in scraper/fixtures/).

Must parse with "html5lib", not the default "html.parser": the site's
markup never closes a row's <th> before its sibling <td>s, and html.parser
takes that literally, nesting every <td> inside the <th> and corrupting
every field. html5lib applies the same auto-closing a real browser does.
"""

import re
import sys
from bs4 import BeautifulSoup

DISTRICT_LINK_RE = re.compile(r"^/council/districts/(\d+)/([\w-]+)$")


def _cell(row, field_name, tag="td"):
    return row.find(tag, class_=f"views-field-field-{field_name}")


def parse_votes_page(html: str) -> list[dict]:
    """Returns one dict per (document, member) vote row: doc_number,
    title, doc_url, vote_date (YYYY-MM-DD), member_name, member_slug,
    district, vote. A row missing a required field is skipped and logged
    to stderr rather than aborting the whole page.
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
                missing = [
                    label for label, cell in (
                        ("document-number", doc_th),
                        ("full-document-title", title_td),
                        ("name", member_td),
                        ("voted-as-follows", vote_td),
                    ) if cell is None
                ]
                print(
                    f"  WARNING: skipping unparseable vote row on {vote_date} "
                    f"(missing field(s): {', '.join(missing)}): "
                    f"{row.get_text(' ', strip=True)[:120]!r}",
                    file=sys.stderr,
                )
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
