export type GoverningBody = "portland_council" | "multnomah_county";

export const GOVERNING_BODIES: Record<
  GoverningBody,
  {
    tabLabel: string;
    fullName: string;
    atLargeTitle: string; // "Mayor" or "Chair" -- the district-0 seat
    districts: number[];
    findDistrictUrl: string;
    homeHref: string;
  }
> = {
  portland_council: {
    tabLabel: "City",
    fullName: "Portland City Council",
    atLargeTitle: "Mayor",
    districts: [1, 2, 3, 4],
    findDistrictUrl:
      "https://pdx.maps.arcgis.com/apps/instant/lookup/index.html?appid=e2e4809ee732411c9f0dca06c78cda38",
    homeHref: "/",
  },
  multnomah_county: {
    tabLabel: "County",
    fullName: "Multnomah County Board",
    atLargeTitle: "Chair",
    districts: [1, 2, 3, 4],
    findDistrictUrl: "https://multco.maps.arcgis.com/apps/instant/lookup/index.html?appid=3f014410c5fc47528e611c85b5c4b3d0",
    homeHref: "/county",
  },
};
