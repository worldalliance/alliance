import { TIME_ZONE_CATALOG } from "@alliance/common/timezone-catalog.gen";
import { COMMON_COUNTRY_NAMES, CURATED_NAMES } from "./timeZoneCuratedNames";

it.each([
  ["CURATED_NAMES", CURATED_NAMES],
  ["COMMON_COUNTRY_NAMES", COMMON_COUNTRY_NAMES],
])("%s names only zones the catalog lists", (_, names) => {
  const listed = new Set(TIME_ZONE_CATALOG.map(({ tz }) => tz));

  expect(Object.keys(names).filter((tz) => !listed.has(tz))).toEqual([]);
});

it("gives a common country name to every zone of that country", () => {
  const countryOf = new Map(TIME_ZONE_CATALOG.map((z) => [z.tz, z.country]));
  const missed = Object.entries(COMMON_COUNTRY_NAMES).flatMap(([tz, names]) =>
    TIME_ZONE_CATALOG.filter(({ country }) => country === countryOf.get(tz))
      .filter((zone) =>
        names.some((name) => !COMMON_COUNTRY_NAMES[zone.tz]?.includes(name)),
      )
      .map((zone) => zone.tz),
  );

  expect(missed).toEqual([]);
});
