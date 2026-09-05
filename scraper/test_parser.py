"""
Regression test for parser.py against a saved fixture, so parsing logic can
be verified without hitting the live site. Run with: python test_parser.py
"""

from parser import parse_votes_page

FIXTURE_PATH = "fixtures/votes_page.html"


def test_parses_expected_shape():
    html = open(FIXTURE_PATH).read()
    records = parse_votes_page(html)

    assert len(records) == 24, f"expected 24 vote rows, got {len(records)}"

    doc_numbers = {r["doc_number"] for r in records}
    assert doc_numbers == {"2026-285", "2026-294"}, doc_numbers

    first = records[0]
    assert first["doc_number"] == "2026-285"
    assert first["vote_date"] == "2026-09-03"
    assert first["member_name"] == "Angelita Morillo"
    assert first["member_slug"] == "angelita-morillo"
    assert first["district"] == 3
    assert first["vote"] == "Yea"
    assert first["title"].startswith("Direct the City Administrator")

    for r in records:
        assert r["doc_number"], "doc_number must never be empty"
        assert r["vote_date"], "vote_date must never be empty"
        assert r["member_name"], "member_name must never be empty"
        assert r["vote"], "vote must never be empty"
        # regression guard for the invalid-HTML-nesting bug: doc_number must
        # never contain other fields' text glued onto it
        assert len(r["doc_number"]) < 20, f"doc_number looks corrupted: {r['doc_number']!r}"


if __name__ == "__main__":
    test_parses_expected_shape()
    print("OK: parser.py matches the fixture as expected.")
