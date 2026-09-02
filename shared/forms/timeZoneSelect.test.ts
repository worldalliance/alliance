import { act, renderHook } from "@testing-library/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { resetClock } from "../lib/useClockMinute";
import {
  TZ_OPTIONS,
  formatNowTimeInTz,
  getOffsetMinutes,
  resetTimeZoneCaches,
  useTimeZoneSelect,
} from "./timeZoneSelect";

beforeEach(() => {
  resetTimeZoneCaches();
  resetClock();
});
afterEach(() => jest.useRealTimers());

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

const blankingTheZoneName = (body: () => void) => {
  const real = Intl.DateTimeFormat;

  standingInFor((locales, options) => {
    const fmt = new real(locales, options);
    const formatToParts = fmt.formatToParts.bind(fmt);
    fmt.formatToParts = (date) =>
      formatToParts(date).map((p) =>
        p.type === "timeZoneName" ? { ...p, value: "" } : p,
      );
    return fmt;
  }, body);
};

const rejecting = (style: string, body: () => void) =>
  patchingIntl((args) => {
    if (args.options?.timeZoneName === style) throw new RangeError("no data");
    return args;
  }, body);

// formatToParts lives on the prototype, so the stand-in hides it on the
// instance rather than deleting it.
const writingNoParts = (body: () => void) => {
  const real = Intl.DateTimeFormat;

  standingInFor((locales, options) => {
    const fmt = new real(locales, options);
    Object.defineProperty(fmt, "formatToParts", { value: undefined });
    return fmt;
  }, body);
};

const writingPartsNoOneCanWalk = (body: () => void) => {
  const real = Intl.DateTimeFormat;

  standingInFor((locales, options) => {
    const fmt = new real(locales, options);
    Object.defineProperty(fmt, "formatToParts", {
      value: () => ({ length: 3 }),
    });
    return fmt;
  }, body);
};

// A runtime that builds a formatter and refuses at the read, which the guard on
// the construction cannot see.
const refusingAtRead = (error: Error, body: () => void) => {
  const real = Intl.DateTimeFormat;

  standingInFor((locales, options) => {
    const fmt = new real(locales, options);
    for (const read of ["format", "formatToParts", "resolvedOptions"]) {
      Object.defineProperty(fmt, read, {
        value: () => {
          throw error;
        },
      });
    }
    return fmt;
  }, body);
};

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

describe("TZ_OPTIONS", () => {
  it("offers only zones this runtime can format", () => {
    const rejected = TZ_OPTIONS.filter(
      ({ tz }) => formatNowTimeInTz(tz) === null,
    );

    expect(rejected.map(({ tz }) => tz)).toEqual([]);
  });

  it("offers India, which a TODO once claimed Intl could not place", () => {
    expect(TZ_OPTIONS.map(({ tz }) => tz)).toContain("Asia/Kolkata");
    expect(getOffsetMinutes("Asia/Kolkata")).toBe(330);
  });
});

describe("a zone Intl rejects", () => {
  it("keeps its row, with no clock rather than no zone", () => {
    TZ_OPTIONS.push({ group: "Asia", label: "Nowhere", tz: "Not/AZone" });
    try {
      const { result } = renderHook(() => useTimeZoneSelect({}));

      expect(result.current.items).toHaveLength(TZ_OPTIONS.length);
      expect(
        result.current.items.find(({ tz }) => tz === "Not/AZone"),
      ).toMatchObject({ timeLabel: null, offsetMins: null });
    } finally {
      TZ_OPTIONS.pop();
    }
  });

  it("sorts after every zone that has an offset", () => {
    TZ_OPTIONS.push({ group: "Asia", label: "Nowhere", tz: "Not/AZone" });
    try {
      const { result } = renderHook(() => useTimeZoneSelect({}));
      const offsets = result.current.items.map(({ offsetMins }) => offsetMins);
      const firstMissing = offsets.indexOf(null);

      expect(firstMissing).toBeGreaterThan(-1);
      expect(offsets.filter((o) => o !== null)).toEqual(
        offsets.slice(0, firstMissing),
      );
    } finally {
      TZ_OPTIONS.pop();
    }
  });

  it("keeps its place when it is the zone a member already saved", () => {
    const { result } = renderHook(() =>
      useTimeZoneSelect({ value: "Not/AZone" }),
    );

    expect(result.current.selected.tz).toBe("Not/AZone");
    expect(result.current.selected.timeLabel).toBeNull();
  });
});

describe("a runtime that rejects every zone", () => {
  it("still offers a list a member can pick their zone from", () => {
    const listed = TZ_OPTIONS.splice(0, TZ_OPTIONS.length, {
      group: "Asia",
      label: "Nowhere",
      tz: "Not/AZone",
    });
    try {
      const { result } = renderHook(() => useTimeZoneSelect({}));

      expect(result.current.items).toEqual([
        {
          tz: "Not/AZone",
          labelLeft: "Nowhere — AZone",
          labelSub: null,
          searchText: "nowhere — azone not/azone",
          offsetMins: null,
          timeLabel: null,
        },
      ]);
    } finally {
      TZ_OPTIONS.splice(0, TZ_OPTIONS.length, ...listed);
    }
  });

  it("sorts the list by name, since no zone has an offset to sort by", () => {
    const listed = TZ_OPTIONS.splice(
      0,
      TZ_OPTIONS.length,
      { group: "Asia", label: "Zed", tz: "Not/AZone" },
      { group: "Asia", label: "Mid", tz: "Not/BZone" },
      { group: "Asia", label: "Alpha", tz: "Not/CZone" },
    );
    try {
      const { result } = renderHook(() => useTimeZoneSelect({}));

      expect(result.current.items.map(({ tz }) => tz)).toEqual([
        "Not/CZone",
        "Not/BZone",
        "Not/AZone",
      ]);
    } finally {
      TZ_OPTIONS.splice(0, TZ_OPTIONS.length, ...listed);
    }
  });
});

describe("a runtime that formats without writing parts", () => {
  it("keeps the clocks it can format and gives up the offsets", () => {
    writingNoParts(() => {
      const { result } = renderHook(() => useTimeZoneSelect({}));

      const row = result.current.items.find(
        ({ tz }) => tz === "America/New_York",
      );
      expect(row?.timeLabel).not.toBeNull();
      expect(row?.offsetMins).toBeNull();
      expect(row?.labelLeft).toBe("Eastern Time — New York");
    });
  });

  it("keeps its rows when the parts are not a list either", () => {
    writingPartsNoOneCanWalk(() => {
      expect(getOffsetMinutes("America/New_York")).toBeNull();

      const { result } = renderHook(() => useTimeZoneSelect({}));

      expect(result.current.items).toHaveLength(TZ_OPTIONS.length);
      expect(
        result.current.items.find(({ tz }) => tz === "America/New_York"),
      ).toMatchObject({
        labelLeft: "Eastern Time — New York",
        offsetMins: null,
      });
    });
  });
});

describe("a runtime that refuses at the read rather than at the constructor", () => {
  it("keeps its rows, with a curated name and no clock or offset", () => {
    refusingAtRead(new RangeError("no data"), () => {
      const { result } = renderHook(() => useTimeZoneSelect({}));

      expect(result.current.items).toHaveLength(TZ_OPTIONS.length);
      expect(
        result.current.items.find(({ tz }) => tz === "America/New_York"),
      ).toMatchObject({
        labelLeft: "Eastern Time — New York",
        timeLabel: null,
        offsetMins: null,
      });
    });
  });

  it("withholds the offset rather than throwing it at the caller", () => {
    refusingAtRead(new RangeError("no data"), () => {
      expect(getOffsetMinutes("America/New_York")).toBeNull();
    });
  });
});

describe("a runtime refusing with something other than a RangeError", () => {
  it("costs the picker a clock rather than the whole list", () => {
    patchingIntl(
      () => {
        throw new TypeError("not the error the spec names");
      },
      () => {
        const { result } = renderHook(() => useTimeZoneSelect({}));

        expect(result.current.items).toHaveLength(TZ_OPTIONS.length);
        expect(formatNowTimeInTz("America/New_York")).toBeNull();
      },
    );
  });

  it("withholds the offset rather than throwing it at the caller", () => {
    refusingAtRead(new TypeError("not the error the spec names"), () => {
      expect(getOffsetMinutes("America/New_York")).toBeNull();
    });
  });
});

describe("a zone sitting on UTC", () => {
  const UTC_ZONE = "Atlantic/Reykjavik";

  it("reads as offset zero, not as an offset the runtime withheld", () => {
    expect(getOffsetMinutes(UTC_ZONE)).toBe(0);
  });

  it("sorts among the zones it shares an offset with", () => {
    // The unplaceable row is labelled to sort ahead of "Greenwich Mean Time",
    // so the offset is the only thing that can put it behind.
    TZ_OPTIONS.push(
      { group: "Atlantic", label: "Iceland", tz: UTC_ZONE },
      { group: "Asia", label: "Anywhere", tz: "Not/AZone" },
    );
    try {
      const { result } = renderHook(() => useTimeZoneSelect({}));
      const place = (tz: string) =>
        result.current.items.findIndex((i) => i.tz === tz);

      expect(place(UTC_ZONE)).toBeGreaterThan(place("America/New_York"));
      expect(place(UTC_ZONE)).toBeLessThan(place("Europe/Paris"));
      expect(place(UTC_ZONE)).toBeLessThan(place("Not/AZone"));
    } finally {
      TZ_OPTIONS.splice(-2);
    }
  });
});

describe("the clock beside a zone", () => {
  // A whole minute crosses exactly one boundary, whatever minute it starts in.
  const A_MINUTE = 60_000;

  it("refreshes on a picker nobody has opened", () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useTimeZoneSelect({}));
    const atMount = result.current.selected.timeLabel;

    act(() => jest.advanceTimersByTime(A_MINUTE));

    expect(result.current.selected.timeLabel).not.toBe(atMount);
  });

  it("flips on the minute boundary, not a minute after mount", () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useTimeZoneSelect({}));
    const atMount = result.current.selected.timeLabel;

    act(() => jest.advanceTimersByTime(A_MINUTE - (Date.now() % A_MINUTE) - 1));
    expect(result.current.selected.timeLabel).toBe(atMount);

    act(() => jest.advanceTimersByTime(1));
    expect(result.current.selected.timeLabel).not.toBe(atMount);
  });

  it("re-arms on the boundary after that, not a minute past the fire", () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useTimeZoneSelect({}));

    act(() => jest.advanceTimersByTime(A_MINUTE - (Date.now() % A_MINUTE)));
    const atBoundary = result.current.selected.timeLabel;

    act(() => jest.advanceTimersByTime(A_MINUTE - 1));
    expect(result.current.selected.timeLabel).toBe(atBoundary);

    act(() => jest.advanceTimersByTime(1));
    expect(result.current.selected.timeLabel).not.toBe(atBoundary);
  });

  it("shows the minute it committed in, not the one it rendered in", () => {
    jest.useFakeTimers();
    jest.setSystemTime(Date.now() + (A_MINUTE - (Date.now() % A_MINUTE)) - 1);

    let crossed = false;
    const straddling = renderHook(() => {
      const picker = useTimeZoneSelect({});
      // Carries the clock past the boundary between this render and its commit.
      if (!crossed) {
        crossed = true;
        jest.setSystemTime(Date.now() + 2);
      }
      return picker;
    });
    const beside = renderHook(() => useTimeZoneSelect({}));

    expect(straddling.result.current.selected.timeLabel).toBe(
      beside.result.current.selected.timeLabel,
    );
  });

  it("refreshes the list on a picker nobody has opened", () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useTimeZoneSelect({}));
    const atMount = result.current.items.at(0)?.timeLabel;

    act(() => jest.advanceTimersByTime(A_MINUTE));

    expect(result.current.items.at(0)?.timeLabel).not.toBe(atMount);
  });

  it("renders on a server, which has no timer to subscribe to", () => {
    const Picker = () =>
      createElement("span", null, useTimeZoneSelect({}).selected.timeLabel);

    expect(renderToString(createElement(Picker))).toMatch(/\d:\d\d/);
  });

  it("runs one timer however many pickers a feed mounts", () => {
    jest.useFakeTimers();
    const pickers = [1, 2, 3].map(() =>
      renderHook(() => useTimeZoneSelect({})),
    );

    expect(jest.getTimerCount()).toBe(1);

    for (const picker of pickers) picker.unmount();

    expect(jest.getTimerCount()).toBe(0);
  });

  it("arms a fresh timer for the picker that follows the last unmount", () => {
    jest.useFakeTimers();
    renderHook(() => useTimeZoneSelect({})).unmount();

    const { result } = renderHook(() => useTimeZoneSelect({}));
    const atMount = result.current.selected.timeLabel;

    act(() => jest.advanceTimersByTime(A_MINUTE));

    expect(result.current.selected.timeLabel).not.toBe(atMount);
  });

  it("keeps the timer for the pickers a feed has left mounted", () => {
    jest.useFakeTimers();
    const leaving = renderHook(() => useTimeZoneSelect({}));
    const staying = renderHook(() => useTimeZoneSelect({}));
    const atMount = staying.result.current.selected.timeLabel;

    leaving.unmount();
    expect(jest.getTimerCount()).toBe(1);

    act(() => jest.advanceTimersByTime(A_MINUTE));

    expect(staying.result.current.selected.timeLabel).not.toBe(atMount);
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

  it("follows one a picker sat mounted through", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(Date.UTC(2026, 2, 8, 9, 30)));
    const { result } = renderHook(() => useTimeZoneSelect({}));

    jest.setSystemTime(new Date(Date.UTC(2026, 2, 8, 10, 30)));
    act(() => jest.advanceTimersByTime(60_000));

    expect(
      result.current.items.find((i) => i.tz === "America/Los_Angeles")
        ?.offsetMins,
    ).toBe(-420);
  });
});

describe("searching the zone list", () => {
  const zonesMatching = (query: string) => {
    const { result } = renderHook(() => useTimeZoneSelect({}));
    act(() => result.current.setQuery(query));
    return result.current.filtered.map(({ tz }) => tz);
  };

  it("finds a zone by a country only its curated label names", () => {
    expect(zonesMatching("sri lanka")).toEqual(["Asia/Kolkata"]);
    expect(zonesMatching("maldives")).toEqual(["Asia/Karachi"]);
  });

  it("finds that country on a runtime with no name for the zone", () => {
    rejecting("longGeneric", () => {
      expect(zonesMatching("sri lanka")).toEqual(["Asia/Kolkata"]);
    });
  });

  it("still finds a zone by the name Intl gives it", () => {
    expect(zonesMatching("india standard")).toEqual(["Asia/Kolkata"]);
  });

  const labelSubOf = (tz: string) => {
    const { result } = renderHook(() => useTimeZoneSelect({}));
    return result.current.items.find((i) => i.tz === tz)?.labelSub;
  };

  it("carries the label it matched on for the row to show", () => {
    expect(labelSubOf("Asia/Kolkata")).toBe("India, Sri Lanka Time");
  });

  it("carries nothing where Intl's name is the curated one", () => {
    expect(labelSubOf("America/Chicago")).toBeNull();
  });

  it("carries nothing where the row already names everywhere it names", () => {
    expect(labelSubOf("Asia/Dubai")).toBeNull();
    expect(labelSubOf("Europe/Moscow")).toBeNull();
    expect(labelSubOf("Australia/Perth")).toBeNull();
    expect(labelSubOf("Europe/Istanbul")).toBeNull();
  });

  // Accents fold here as they do in the label, or a row reading "Türkiye" would
  // pass a sweep looking for "Turkey".
  const fold = (text: string) =>
    text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

  it("carries nothing any row already says", () => {
    const { result } = renderHook(() => useTimeZoneSelect({}));

    const saidTwice: string[] = [];
    for (const { tz, labelLeft, labelSub } of result.current.items) {
      if (!labelSub) continue;
      const shown = fold(labelLeft);
      const words = fold(labelSub).match(/\p{L}+/gu) ?? [];
      if (words.every((w) => w === "time" || shown.includes(w.slice(0, 4)))) {
        saidTwice.push(tz);
      }
    }

    expect(saidTwice).toEqual([]);
  });

  it("carries every place its row leaves unnamed", () => {
    const { result } = renderHook(() => useTimeZoneSelect({}));
    const curated = new Map(TZ_OPTIONS.map(({ tz, label }) => [tz, label]));

    const leftOut: string[] = [];
    for (const { tz, labelLeft, labelSub } of result.current.items) {
      if (labelSub) continue;
      const shown = fold(labelLeft);
      const words = fold(curated.get(tz) ?? "").match(/\p{L}+/gu) ?? [];
      if (words.some((w) => w !== "time" && !shown.includes(w.slice(0, 4)))) {
        leftOut.push(tz);
      }
    }

    expect(leftOut).toEqual([]);
  });

  it("carries nothing on a runtime with no name for the zone", () => {
    rejecting("longGeneric", () => {
      expect(labelSubOf("Asia/Kolkata")).toBeNull();
    });
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

  it("falls back to the curated label when longGeneric is missing", () => {
    rejecting("longGeneric", () => {
      const { result } = renderHook(() => useTimeZoneSelect({}));

      const row = result.current.items.find(
        ({ tz }) => tz === "America/New_York",
      );
      expect(row?.labelLeft).toBe("Eastern Time — New York");
      expect(row?.searchText).toContain("eastern");
    });
  });

  it("names every zone rather than reading one back as a path", () => {
    rejecting("longGeneric", () => {
      const { result } = renderHook(() => useTimeZoneSelect({}));

      for (const { labelLeft } of result.current.items) {
        expect(labelLeft).not.toContain("/");
      }
    });
  });
});

describe("a runtime that writes an empty zone name", () => {
  it("falls back to the curated label rather than a bare dash", () => {
    blankingTheZoneName(() => {
      const { result } = renderHook(() => useTimeZoneSelect({}));

      const row = result.current.items.find(
        ({ tz }) => tz === "America/New_York",
      );
      expect(row?.labelLeft).toBe("Eastern Time — New York");
      expect(row?.searchText).toContain("eastern");
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
