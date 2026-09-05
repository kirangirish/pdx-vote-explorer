"""
Static roster of Portland City Council members.

District and headshot data are fixed public facts (portland.gov/council) that
the votes page itself never exposes, so they're maintained here rather than
scraped per-run. Keyed by the exact name string as it appears on the votes
page, since that's what seed_db.py has to match against.
"""

ROSTER = {
    "Candace Avalos":       {"slug": "candace-avalos",       "district": 1, "ext": "png"},
    "Jamie Dunphy":         {"slug": "jamie-dunphy",         "district": 1, "ext": "png"},
    "Loretta Smith":        {"slug": "loretta-smith",        "district": 1, "ext": "png"},
    "Dan Ryan":             {"slug": "dan-ryan",             "district": 2, "ext": "png"},
    "Elana Pirtle-Guiney":  {"slug": "elana-pirtle-guiney",  "district": 2, "ext": "png"},
    "Sameer Kanal":         {"slug": "sameer-kanal",         "district": 2, "ext": "png"},
    "Angelita Morillo":     {"slug": "angelita-morillo",     "district": 3, "ext": "png"},
    "Steve Novick":         {"slug": "steve-novick",         "district": 3, "ext": "png"},
    "Tiffany Koyama Lane":  {"slug": "tiffany-koyama-lane",  "district": 3, "ext": "png"},
    "Eric Zimmerman":       {"slug": "eric-zimmerman",       "district": 4, "ext": "png"},
    "Mitch Green":          {"slug": "mitch-green",          "district": 4, "ext": "png"},
    "Olivia Clark":         {"slug": "olivia-clark",         "district": 4, "ext": "png"},
}


def lookup(member_name: str) -> dict:
    """Returns {'slug': ..., 'district': ..., 'ext': ...} for a known member,
    or a fallback slug/district-0 entry for anyone not yet in the roster."""
    entry = ROSTER.get(member_name)
    if entry:
        return entry
    fallback_slug = member_name.strip().lower().replace(" ", "-").replace(".", "")
    return {"slug": fallback_slug, "district": 0, "ext": "jpg"}
