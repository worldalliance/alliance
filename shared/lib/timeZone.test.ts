import { isTimeZoneIdentifier } from "@alliance/common/timezone";
import { deviceTimeZone } from "./timeZone";

describe("deviceTimeZone", () => {
  it("names a tzdb identifier", () => {
    expect(isTimeZoneIdentifier(deviceTimeZone())).toBe(true);
  });
});
