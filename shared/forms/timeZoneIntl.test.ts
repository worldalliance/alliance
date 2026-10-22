import {
  fallingBackTo,
  rejecting,
  standingInFor,
} from "../lib/testing/intlStandIns";
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

describe("reading an offset again", () => {
  it("asks for no parts once the zone's formatter has been checked", () => {
    const real = Intl.DateTimeFormat;
    let partsAsked = 0;

    standingInFor(
      (locales, options) => {
        const fmt = new real(locales, options);
        const formatToParts = fmt.formatToParts.bind(fmt);
        fmt.formatToParts = (date) => {
          partsAsked++;
          return formatToParts(date);
        };
        return fmt;
      },
      () => {
        getOffsetMinutes("America/New_York");
        const afterFirst = partsAsked;

        expect(getOffsetMinutes("America/New_York")).not.toBeNull();
        expect(partsAsked).toBe(afterFirst);
      },
    );
  });

  it("keeps asking for parts where the runtime writes another locale", () => {
    const may5 = new Date(Date.UTC(2026, 4, 5, 12));
    const may9 = new Date(Date.UTC(2026, 4, 9, 12));

    rejecting("shortOffset", () =>
      fallingBackTo({ locale: "en-GB" }, () => {
        expect(getOffsetMinutes("America/New_York", may5)).toBe(-240);
        expect(getOffsetMinutes("America/New_York", may9)).toBe(-240);
      }),
    );
  });
});
