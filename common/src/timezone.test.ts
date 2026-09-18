import { isTimeZoneIdentifier } from "./timezone";

describe("isTimeZoneIdentifier", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(["America/Los_Angeles", "UTC", "Asia/Kolkata"])(
    "accepts the catalog identifier %p",
    (tz) => {
      expect(isTimeZoneIdentifier(tz)).toBe(true);
    },
  );

  // Members keep a saved alias until they pick a replacement.
  it.each(["US/Pacific", "Asia/Calcutta"])(
    "accepts the catalog alias %p",
    (tz) => {
      expect(isTimeZoneIdentifier(tz)).toBe(true);
    },
  );

  // Devices can report a fixed-offset zone.
  it.each(["Etc/GMT+8", "Etc/GMT-14"])(
    "accepts the identifier %p, which the catalog does not list",
    (tz) => {
      expect(isTimeZoneIdentifier(tz)).toBe(true);
    },
  );

  // `Intl` resolves these, but they name no timezone.
  it.each(["-08:00", "+05:30"])("rejects the raw offset %p", (offset) => {
    expect(isTimeZoneIdentifier(offset)).toBe(false);
  });

  it("rejects Factory", () => {
    expect(isTimeZoneIdentifier("Factory")).toBe(false);
  });

  it.each(["america/new_york", "utc", "us/pacific"])(
    "rejects %p, which tzdb spells differently",
    (value) => {
      expect(isTimeZoneIdentifier(value)).toBe(false);
    },
  );

  it.each(["", " ", "not-a-zone", "Mars/Olympus_Mons", " UTC"])(
    "rejects %p",
    (value) => {
      expect(isTimeZoneIdentifier(value)).toBe(false);
    },
  );

  it.each([null, undefined, 42, {}])("rejects the non-string %p", (value) => {
    expect(isTimeZoneIdentifier(value)).toBe(false);
  });

  it("accepts a catalog alias on a runtime that canonicalizes it, as V8 does", () => {
    const { resolvedOptions } = Intl.DateTimeFormat.prototype;
    jest
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockImplementation(function (this: Intl.DateTimeFormat) {
        return {
          ...resolvedOptions.call(this),
          timeZone: "America/Los_Angeles",
        };
      });

    expect(isTimeZoneIdentifier("US/Pacific")).toBe(true);
    expect(isTimeZoneIdentifier("us/pacific")).toBe(false);
  });
});
