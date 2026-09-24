import { getOffsetMinutes, resetFormatterCache } from "./timeZoneIntl";

beforeEach(() => resetFormatterCache());

describe("the offset a zone sorts by", () => {
  const january = new Date(Date.UTC(2026, 0, 15, 12));
  const july = new Date(Date.UTC(2026, 6, 15, 12));

  it("reads a zone ahead of UTC", () => {
    expect(getOffsetMinutes("Asia/Tokyo", january)).toBe(540);
  });

  it("reads a zone behind UTC", () => {
    expect(getOffsetMinutes("America/Phoenix", january)).toBe(-420);
  });

  it("reads a zone that is not a whole hour off", () => {
    expect(getOffsetMinutes("Asia/Kathmandu", january)).toBe(345);
  });

  it("follows a zone across its own DST boundary", () => {
    expect(getOffsetMinutes("America/Los_Angeles", january)).toBe(-480);
    expect(getOffsetMinutes("America/Los_Angeles", july)).toBe(-420);
  });
});
