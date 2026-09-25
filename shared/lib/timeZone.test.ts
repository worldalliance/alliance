import { isTimeZoneIdentifier } from "@alliance/common/timezone";
import { deviceTimeZone, signupTimeZone } from "./timeZone";

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
