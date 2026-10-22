import { deviceTimeZoneOffer } from "./deviceTimeZoneOffer";

describe("deviceTimeZoneOffer", () => {
  it("offers the device zone, labelled as its row, when it differs", () => {
    expect(
      deviceTimeZoneOffer({
        saved: "Asia/Kolkata",
        device: "America/Los_Angeles",
      }),
    ).toEqual({
      tz: "America/Los_Angeles",
      label: "Pacific Time · Los Angeles",
    });
  });

  it("offers the device zone when nothing is saved", () => {
    expect(
      deviceTimeZoneOffer({ saved: undefined, device: "Asia/Kolkata" })?.tz,
    ).toBe("Asia/Kolkata");
  });

  it("offers nothing when the saved zone lists as the device's row", () => {
    expect(
      deviceTimeZoneOffer({ saved: "Asia/Kolkata", device: "Asia/Kolkata" }),
    ).toBeNull();
    expect(
      deviceTimeZoneOffer({
        saved: "US/Pacific",
        device: "America/Los_Angeles",
      }),
    ).toBeNull();
    expect(
      deviceTimeZoneOffer({ saved: "Asia/Kolkata", device: "Asia/Calcutta" }),
    ).toBeNull();
  });

  it("offers an alias the device reports as reported", () => {
    expect(
      deviceTimeZoneOffer({ saved: "Asia/Kolkata", device: "US/Pacific" }),
    ).toEqual({ tz: "US/Pacific", label: "Pacific Time · Los Angeles" });
  });

  it("labels an uncatalogued device zone by its identifier", () => {
    expect(
      deviceTimeZoneOffer({ saved: "Asia/Kolkata", device: "Etc/GMT+8" })
        ?.label,
    ).toMatch(/Etc\/GMT\+8$/);
  });

  it("offers nothing when detection fails or names no zone", () => {
    for (const device of [undefined, "", "-08:00", "america/los_angeles"]) {
      expect(deviceTimeZoneOffer({ saved: "Asia/Kolkata", device })).toBeNull();
    }
  });

  it("offers the device zone over an invalid saved value", () => {
    expect(
      deviceTimeZoneOffer({ saved: "-08:00", device: "Asia/Kolkata" })?.tz,
    ).toBe("Asia/Kolkata");
  });
});
