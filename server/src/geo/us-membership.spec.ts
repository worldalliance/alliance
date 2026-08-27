import { resolveUsMembership, UsMembership } from "./us-membership";

describe("resolveUsMembership", () => {
  it("uses the city's country when there is one", () => {
    expect(
      resolveUsMembership({ countryCode: "US", timeZone: "Europe/London" }),
    ).toBe(UsMembership.Us);
    expect(
      resolveUsMembership({ countryCode: "GB", timeZone: "America/New_York" }),
    ).toBe(UsMembership.NonUs);
  });

  it("falls back to the time zone's country without a city", () => {
    expect(
      resolveUsMembership({ countryCode: null, timeZone: "America/Anchorage" }),
    ).toBe(UsMembership.Us);
    expect(
      resolveUsMembership({ countryCode: null, timeZone: "US/Eastern" }),
    ).toBe(UsMembership.Us);
    expect(
      resolveUsMembership({ countryCode: null, timeZone: "Europe/Berlin" }),
    ).toBe(UsMembership.NonUs);
  });

  it("treats US territories as non-US", () => {
    expect(resolveUsMembership({ countryCode: "PR", timeZone: null })).toBe(
      UsMembership.NonUs,
    );
    expect(
      resolveUsMembership({ countryCode: null, timeZone: "Pacific/Guam" }),
    ).toBe(UsMembership.NonUs);
  });

  it("is Unknown with no city and no placeable zone", () => {
    expect(resolveUsMembership({ countryCode: null, timeZone: null })).toBe(
      UsMembership.Unknown,
    );
    expect(resolveUsMembership({ countryCode: null, timeZone: "UTC" })).toBe(
      UsMembership.Unknown,
    );
  });
});
