export type GoverningBody = "portland_council" | "multnomah_county";

export const GOVERNING_BODIES: Record<
  GoverningBody,
  {
    tabLabel: string;
    fullName: string;
    atLargeTitle: string; // "Mayor" or "Chair" -- the district-0 seat
    // The Portland Mayor doesn't vote with Council except to break a tie;
    // the Multnomah Chair is a regular voting Board member. Drives the
    // at-large chip's visual weight -- it shouldn't look as minor as a
    // tiebreaker when it isn't one.
    atLargeIsVotingMember: boolean;
    // Short, factual description of the at-large seat's role, shown next to
    // its name when atLargeIsVotingMember is true. Null for Portland since
    // the Mayor's chip stays compact rather than a full spotlight card.
    atLargeBlurb: string | null;
    districts: number[];
    findDistrictUrl: string;
    homeHref: string;
    charterUrl: string;
    charterLabel: string;
  }
> = {
  portland_council: {
    tabLabel: "City",
    fullName: "Portland City Council",
    atLargeTitle: "Mayor",
    atLargeIsVotingMember: false,
    atLargeBlurb: null,
    districts: [1, 2, 3, 4],
    findDistrictUrl:
      "https://pdx.maps.arcgis.com/apps/instant/lookup/index.html?appid=e2e4809ee732411c9f0dca06c78cda38",
    homeHref: "/",
    charterUrl: "https://www.portland.gov/charter",
    charterLabel: "Portland City Charter",
  },
  multnomah_county: {
    tabLabel: "County",
    fullName: "Multnomah County Board",
    atLargeTitle: "Chair",
    atLargeIsVotingMember: true,
    atLargeBlurb:
      "Elected countywide. Unlike Portland's Mayor, the Chair is a full voting member of the Board and serves as the county's chief executive, presiding over meetings and overseeing day-to-day administration.",
    districts: [1, 2, 3, 4],
    findDistrictUrl: "https://multco.maps.arcgis.com/apps/instant/lookup/index.html?appid=3f014410c5fc47528e611c85b5c4b3d0",
    homeHref: "/county",
    charterUrl: "https://www.multco.us/county-attorney/county-charter",
    charterLabel: "Multnomah County Home Rule Charter",
  },
};

// Tailwind needs each class string to appear literally in source -- can't
// build "text-district-N" from a template string at runtime. District 0
// (Mayor/Chair) gets the same gold accent used for its avatar ring.
export const DISTRICT_TEXT_CLASSES: Record<number, string> = {
  0: "text-yellow-700",
  1: "text-district-1",
  2: "text-district-2",
  3: "text-district-3",
  4: "text-district-4",
};
