import { deviceTimeZone } from "./timeZone";

describe("deviceTimeZone", () => {
  it("names a zone the server's IsTimeZone accepts", () => {
    const zone = deviceTimeZone();

    // Intl treats an undefined zone as "use the default", so the throw below
    // only means something once the zone is a non-empty string.
    expect(typeof zone).toBe("string");
    expect(zone).not.toBe("");
    expect(() =>
      Intl.DateTimeFormat(undefined, { timeZone: zone }),
    ).not.toThrow();
  });
});
