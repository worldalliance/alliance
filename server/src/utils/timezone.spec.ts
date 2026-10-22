import { isTimeZoneIdentifier } from "@alliance/common/timezone";
import {
  TIME_ZONE_ALIASES,
  TIME_ZONE_CATALOG,
} from "@alliance/common/timezone-catalog.gen";

describe("server timezone validation", () => {
  it.each(TIME_ZONE_CATALOG.map((entry) => entry.tz))(
    "accepts the catalog identifier %p",
    (tz) => {
      expect(isTimeZoneIdentifier(tz)).toBe(true);
    },
  );

  it.each([...TIME_ZONE_ALIASES.keys()])(
    "accepts the catalog alias %p",
    (alias) => {
      expect(isTimeZoneIdentifier(alias)).toBe(true);
    },
  );
});
