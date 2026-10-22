import { isTimeZoneIdentifier } from "@alliance/common/timezone";
import {
  deviceTimeZone,
  formTimeZoneDefault,
  signupTimeZone,
} from "./timeZone";

describe("deviceTimeZone", () => {
  it("names a tzdb identifier", () => {
    expect(isTimeZoneIdentifier(deviceTimeZone())).toBe(true);
  });
});

describe("signupTimeZone", () => {
  it("keeps a valid detected zone as reported", () => {
    expect(signupTimeZone("Asia/Kolkata")).toBe("Asia/Kolkata");
    expect(signupTimeZone("US/Pacific")).toBe("US/Pacific");
    expect(signupTimeZone("Etc/GMT+8")).toBe("Etc/GMT+8");
  });

  it("sends no zone when detection fails or names no zone", () => {
    expect(signupTimeZone(undefined)).toBeNull();
    expect(signupTimeZone("")).toBeNull();
    expect(signupTimeZone("-08:00")).toBeNull();
    expect(signupTimeZone("america/los_angeles")).toBeNull();
    expect(signupTimeZone("Mars/Olympus_Mons")).toBeNull();
  });
});

describe("formTimeZoneDefault", () => {
  it("takes the saved zone, as saved, over the device's", () => {
    expect(
      formTimeZoneDefault({ saved: "US/Pacific", device: "Asia/Kolkata" }),
    ).toBe("US/Pacific");
  });

  it("falls back to the device zone when no valid zone is saved", () => {
    for (const saved of [null, undefined, "-08:00", "Mars/Olympus_Mons"]) {
      expect(formTimeZoneDefault({ saved, device: "Asia/Kolkata" })).toBe(
        "Asia/Kolkata",
      );
    }
  });

  it("gives no zone when neither is valid", () => {
    expect(
      formTimeZoneDefault({ saved: null, device: undefined }),
    ).toBeUndefined();
    expect(
      formTimeZoneDefault({ saved: "", device: "Factory" }),
    ).toBeUndefined();
  });
});
