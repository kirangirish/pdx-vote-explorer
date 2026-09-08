"""
Static roster of the Multnomah County Board of Commissioners: a Chair
(at-large) plus 4 district Commissioners. Confirmed against
multco.us/elected/board-county-commissioners.

Keyed by full name, as expected by db.py. Minutes PDFs refer to people by
last name with a title prefix ("Commissioner Moyer", "Chair Vega
Pederson"), so LAST_NAME_TO_FULL_NAME maps those short forms to the
ROSTER keys. District 0 marks the Chair, same convention roster.py uses
for Portland's Mayor.
"""

ROSTER = {
    "Jessica Vega Pederson": {"slug": "jessica-vega-pederson", "district": 0, "ext": "png"},
    "Meghan Moyer":          {"slug": "meghan-moyer",          "district": 1, "ext": "png"},
    "Shannon Singleton":     {"slug": "shannon-singleton",     "district": 2, "ext": "png"},
    "Julia Brim-Edwards":    {"slug": "julia-brim-edwards",    "district": 3, "ext": "png"},
    "Vince Jones-Dixon":     {"slug": "vince-jones-dixon",     "district": 4, "ext": "png"},
}

LAST_NAME_TO_FULL_NAME = {
    "Vega Pederson": "Jessica Vega Pederson",
    "Moyer": "Meghan Moyer",
    "Singleton": "Shannon Singleton",
    "Brim-Edwards": "Julia Brim-Edwards",
    "Jones-Dixon": "Vince Jones-Dixon",
}


def lookup(member_name: str) -> dict:
    """Returns {'slug', 'district', 'ext'} for a known member, or a
    fallback slug/district-0 entry for anyone not yet in the roster."""
    entry = ROSTER.get(member_name)
    if entry:
        return entry
    fallback_slug = member_name.strip().lower().replace(" ", "-").replace(".", "")
    return {"slug": fallback_slug, "district": 0, "ext": "jpg"}
