import { TIME_ZONE_CATALOG } from "@alliance/common/timezone-catalog.gen";
import { CURATED_NAMES } from "./timeZoneCuratedNames";

it("names only zones the catalog lists", () => {
  const listed = new Set(TIME_ZONE_CATALOG.map(({ tz }) => tz));

  expect(Object.keys(CURATED_NAMES).filter((tz) => !listed.has(tz))).toEqual(
    [],
  );
});
