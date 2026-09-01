import { renderHook } from "@testing-library/react";
import {
  getOffsetMinutes,
  resetTimeZoneCaches,
  useTimeZoneSelect,
} from "./timeZoneSelect";

beforeEach(resetTimeZoneCaches);

type FormatterArgs = {
  locales?: Intl.LocalesArgument;
  options?: Intl.DateTimeFormatOptions;
};

type Formatting = (
  locales?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions,
) => Intl.DateTimeFormat;

// Each of these wraps whichever Intl.DateTimeFormat is in place rather than the
// real one, so they nest into a runtime short of several things at once.
function standingInFor(formatting: Formatting, body: () => void): void {
  const real = Intl.DateTimeFormat;

  // The picker reaches Intl.DateTimeFormat with `new`, which an arrow cannot
  // answer.
  function standIn(
    locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions,
  ) {
    return formatting(locales, options);
  }

  Intl.DateTimeFormat = Object.assign(standIn, real);
  resetTimeZoneCaches();
  try {
    body();
  } finally {
    Intl.DateTimeFormat = real;
    resetTimeZoneCaches();
  }
}

function patchingIntl(
  patch: (args: FormatterArgs) => FormatterArgs,
  body: () => void,
): void {
  const real = Intl.DateTimeFormat;

  standingInFor((locales, options) => {
    const taken = patch({ locales, options });
    return new real(taken.locales, taken.options);
  }, body);
}

const hidingDayPeriod = (body: () => void) => {
  const real = Intl.DateTimeFormat;

  standingInFor((locales, options) => {
    const fmt = new real(locales, options);
    const formatToParts = fmt.formatToParts.bind(fmt);
    fmt.formatToParts = (date) =>
      formatToParts(date).filter((p) => p.type !== "dayPeriod");
    return fmt;
  }, body);
};

const rejecting = (style: string, body: () => void) =>
  patchingIntl((args) => {
    if (args.options?.timeZoneName === style) throw new RangeError("no data");
    return args;
  }, body);

const fallingBackTo = (
  { locale, ignoring }: { locale: string; ignoring?: "calendar" },
  body: () => void,
) =>
  patchingIntl(
    ({ options }) => ({
      locales: locale,
      options: ignoring ? { ...options, [ignoring]: undefined } : options,
    }),
    body,
  );

const resolvingTo = (
  hourCycle: Intl.DateTimeFormatOptions["hourCycle"],
  body: () => void,
) =>
  patchingIntl(
    ({ locales, options }) => ({
      locales,
      options: options?.hour
        ? { ...options, hour12: undefined, hourCycle }
        : options,
    }),
    body,
  );

describe("a zone sitting on UTC", () => {
  const UTC_ZONE = "Atlantic/Reykjavik";

  it("reads as offset zero, not as an offset the runtime withheld", () => {
    expect(getOffsetMinutes(UTC_ZONE)).toBe(0);
  });
});

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

describe("a runtime missing a timeZoneName style", () => {
  it("keeps every clock and every offset when shortOffset is missing", () => {
    rejecting("shortOffset", () => {
      const { result } = renderHook(() => useTimeZoneSelect({}));

      expect(
        result.current.items.every(
          ({ timeLabel, offsetMins }) => timeLabel && offsetMins !== null,
        ),
      ).toBe(true);
    });
  });

  it("still sorts by offset when shortOffset is missing", () => {
    rejecting("shortOffset", () => {
      const { result } = renderHook(() => useTimeZoneSelect({}));
      const offsets = result.current.items.map(({ offsetMins }) => offsetMins!);

      expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
      expect(new Set(offsets).size).toBeGreaterThan(1);
    });
  });
});

describe("a runtime with no en-US data", () => {
  it("reads the offset under a fallback whose year and digits are its own", () => {
    fallingBackTo({ locale: "th-TH-u-nu-thai" }, () => {
      expect(getOffsetMinutes("Asia/Tokyo")).toBe(540);
    });
  });

  it("falls back to shortOffset rather than read a Buddhist year as one", () => {
    fallingBackTo({ locale: "th-TH", ignoring: "calendar" }, () => {
      expect(getOffsetMinutes("Asia/Tokyo")).toBe(540);
    });
  });

  it("withholds the offset when shortOffset cannot rescue the year either", () => {
    rejecting("shortOffset", () => {
      fallingBackTo({ locale: "th-TH", ignoring: "calendar" }, () => {
        expect(getOffsetMinutes("Asia/Tokyo")).toBeNull();
      });
    });
  });
});

describe("a runtime that will not give a 24-hour clock", () => {
  const sixInTheEvening = new Date(Date.UTC(2026, 0, 16, 2));
  const midnight = new Date(Date.UTC(2026, 0, 15, 8));

  it("falls back to shortOffset rather than reading 6 PM as 06:00", () => {
    resolvingTo("h12", () => {
      expect(getOffsetMinutes("America/Los_Angeles", sixInTheEvening)).toBe(
        -480,
      );
    });
  });

  it("withholds the offset when there is no shortOffset to fall back on", () => {
    rejecting("shortOffset", () => {
      resolvingTo("h12", () => {
        expect(
          getOffsetMinutes("America/Los_Angeles", sixInTheEvening),
        ).toBeNull();
      });
    });
  });

  it("withholds the offset rather than reading midnight as noon", () => {
    rejecting("shortOffset", () => {
      resolvingTo("h12", () => {
        expect(getOffsetMinutes("America/Los_Angeles", midnight)).toBeNull();
      });
    });
  });

  // Tokyo at 6 PM read as 06:00 lands 3 hours behind UTC, inside the range
  // check, so the resolved cycle is the only thing left to catch it.
  it("withholds the offset when a 12-hour clock writes no dayPeriod", () => {
    const sixInTheEveningInTokyo = new Date(Date.UTC(2026, 0, 15, 9));

    rejecting("shortOffset", () => {
      resolvingTo("h12", () => {
        hidingDayPeriod(() => {
          expect(
            getOffsetMinutes("Asia/Tokyo", sixInTheEveningInTokyo),
          ).toBeNull();
        });
      });
    });
  });

  it("still reads the offset when midnight comes back as hour 24", () => {
    resolvingTo("h24", () => {
      const halfPastMidnight = new Date(Date.UTC(2026, 0, 2, 0, 30));

      expect(getOffsetMinutes("Atlantic/Reykjavik", halfPastMidnight)).toBe(0);
    });
  });
});
