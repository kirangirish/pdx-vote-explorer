"""
Regression tests for multco_parser.py against saved fixtures, so parsing
logic can be verified without hitting the network. Run with:
python test_multco_parser.py
"""

from multco_parser import parse_meeting_list, parse_minutes_text

MEETING_LIST_FIXTURE = "fixtures/multco_meeting_list.html"
MINUTES_FIXTURE = "fixtures/multco_minutes_2026-09-03.txt"


def test_parse_meeting_list():
    html = open(MEETING_LIST_FIXTURE).read()
    meetings = parse_meeting_list(html)

    assert len(meetings) == 8, f"expected 8 voting meetings in the fixture, got {len(meetings)}"
    assert meetings[0] == {
        "name": "Regular Board Meeting",
        "date": "2026-09-03",
        "minutes_viewer_url": "https://multnomah.granicus.com/MinutesViewer.php?view_id=3&clip_id=3581&doc_id=cf7316b6-a881-11f1-a183-005056a89546",
    }
    # Board Briefings must be excluded -- confirmed not to have recorded votes
    assert all(m["name"] in ("Regular Board Meeting", "Special Meeting") for m in meetings)


def test_parse_minutes_text():
    text = open(MINUTES_FIXTURE).read()
    records = parse_minutes_text(text, "2026-09-03", source_url="https://example.com/minutes.pdf")

    doc_numbers = {r["doc_number"] for r in records}
    assert doc_numbers == {
        "2026-09-03-C.1", "2026-09-03-C.2", "2026-09-03-C.3",
        "2026-09-03-R.1", "2026-09-03-R.2",
    }, doc_numbers

    # regression guard: title extraction must stop before the mover's name
    # ("...Technicians. Commissioner Brim-Edwards moves...") not include it
    titles = {r["doc_number"]: r["title"] for r in records}
    assert titles["2026-09-03-R.1"] == (
        "BUDGET MODIFICATION #DCJ-001-27 - DCJ ASD Reallocation of "
        "Funding from 1.00 Parole and Probation Officer to two 0.50 "
        "Recognizance Correction Technicians."
    ), titles["2026-09-03-R.1"]
    assert "moves" not in titles["2026-09-03-R.1"] and "Commissioner" not in titles["2026-09-03-R.1"]
    assert "moves" not in titles["2026-09-03-R.2"] and "Chair" not in titles["2026-09-03-R.2"]

    # the consent agenda (C.1-C.3) shares one 5-0 unanimous vote
    for label in ("2026-09-03-C.1", "2026-09-03-C.2", "2026-09-03-C.3"):
        votes = {r["member_name"]: r["vote"] for r in records if r["doc_number"] == label}
        assert len(votes) == 5, f"{label}: expected 5 votes, got {votes}"
        assert all(v == "Yea" for v in votes.values()), f"{label}: expected unanimous Yea, got {votes}"

    # R.1 is also 5-0
    r1_votes = {r["member_name"]: r["vote"] for r in records if r["doc_number"] == "2026-09-03-R.1"}
    assert len(r1_votes) == 5 and all(v == "Yea" for v in r1_votes.values()), r1_votes

    # R.2 is the real regression guard: a genuine 3-2 split, and the Chair
    # (last-listed in both AYES and NOS in the source PDF) must resolve
    # correctly rather than being swallowed by trailing prose.
    r2_votes = {r["member_name"]: r["vote"] for r in records if r["doc_number"] == "2026-09-03-R.2"}
    assert r2_votes == {
        "Shannon Singleton": "Yea",
        "Julia Brim-Edwards": "Yea",
        "Meghan Moyer": "Yea",
        "Vince Jones-Dixon": "Nay",
        "Jessica Vega Pederson": "Nay",
    }, r2_votes

    for r in records:
        assert r["source_url"] == "https://example.com/minutes.pdf"
        assert r["vote_date"] == "2026-09-03"


if __name__ == "__main__":
    test_parse_meeting_list()
    test_parse_minutes_text()
    print("OK: multco_parser.py matches the fixtures as expected.")
