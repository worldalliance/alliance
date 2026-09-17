import { act, renderHook } from "@testing-library/react";
import { getTimezone } from "countries-and-timezones";
import { millisecondsInMinute } from "date-fns/constants";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { resetClock } from "../lib/useClockMinute";
import {
  PRINCIPAL_ZONES,
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

const writingThePartAs = (
  written: { type: Intl.DateTimeFormatPartTypes; value: unknown },
  body: () => void,
) => {
  const real = Intl.DateTimeFormat;

  standingInFor((locales, options) => {
    const fmt = new real(locales, options);
    const formatToParts = fmt.formatToParts.bind(fmt);
    Object.defineProperty(fmt, "formatToParts", {
      value: (date?: Date) =>
        formatToParts(date).map((p) =>
          p.type === written.type ? { ...p, value: written.value } : p,
        ),
    });
    return fmt;
  }, body);
};

const writingTheZoneNameAs = (value: unknown, body: () => void) =>
  writingThePartAs({ type: "timeZoneName", value }, body);

const blankingTheZoneName = (body: () => void) =>
  writingTheZoneNameAs("", body);

const namingTheLocale = (locale: unknown, body: () => void) => {
  const real = Intl.DateTimeFormat;

  standingInFor((locales, options) => {
    const fmt = new real(locales, options);
    const resolvedOptions = fmt.resolvedOptions.bind(fmt);
    Object.defineProperty(fmt, "resolvedOptions", {
      value: () => ({ ...resolvedOptions(), locale }),
    });
    return fmt;
  }, body);
};

const literal = (value: string): Intl.DateTimeFormatPart => ({
  type: "literal",
  value,
});

const dateWritten = (parts: Intl.DateTimeFormatPart[]) => {
  const at = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return [
    { type: "month", value: at("month") },
    literal("/"),
    { type: "day", value: at("day") },
    literal("/"),
    { type: "year", value: at("year") },
  ] satisfies Intl.DateTimeFormatPart[];
};

type ZoneNameWritten = {
  tz: string;
  name: string;
  date: Intl.DateTimeFormatPart[];
};

const layingOutTheZoneName = (
  layout: (written: ZoneNameWritten) => Intl.DateTimeFormatPart[],
  body: () => void,
) => {
  const real = Intl.DateTimeFormat;

  standingInFor((locales, options) => {
    const fmt = new real(locales, options);
    if (options?.timeZoneName !== "longGeneric") return fmt;

    const formatToParts = fmt.formatToParts.bind(fmt);
    fmt.formatToParts = (date) => {
      const parts = formatToParts(date);
      const name = parts.find((p) => p.type === "timeZoneName");
      return name
        ? layout({
            tz: options.timeZone ?? "",
            name: name.value,
            date: dateWritten(parts),
          })
        : parts;
    };
    return fmt;
  }, body);
};

// What the Hermes in apps/mobile/ios/Pods wrote for these zones, read off its
// own CLI. The name arrives in several parts, which of them come back typed
// timeZoneName follows nothing the reader can lean on, and the separator
// breaks into one part per character.
const APPLE_HERMES_NAME: Record<
  string,
  [Intl.DateTimeFormatPartTypes, string][]
> = {
  "Asia/Kathmandu": [
    ["timeZoneName", "Nepal"],
    ["literal", " "],
    ["literal", "Time"],
  ],
  "Asia/Kolkata": [
    ["timeZoneName", "India"],
    ["literal", " "],
    ["literal", "Standard"],
    ["literal", " "],
    ["timeZoneName", "Time"],
  ],
  "Pacific/Auckland": [
    ["timeZoneName", "New"],
    ["literal", " "],
    ["literal", "Zealand"],
    ["literal", " "],
    ["timeZoneName", "Time"],
  ],
  "Australia/Perth": [
    ["timeZoneName", "Australian"],
    ["literal", " "],
    ["literal", "Western"],
    ["literal", " "],
    ["timeZoneName", "Standard"],
    ["literal", " "],
    ["timeZoneName", "Time"],
  ],
};

// The zones this was not run against keep the one part a conforming engine
// writes, since the rest of the list has to build for a row to read at all.
const asAppleHermesWrote = ({
  tz,
  name,
  date,
}: ZoneNameWritten): Intl.DateTimeFormatPart[] => {
  const written = APPLE_HERMES_NAME[tz];
  if (!written) {
    return [...date, literal(", "), { type: "timeZoneName", value: name }];
  }
  return [
    ...date,
    literal(","),
    literal(" "),
    ...written.map(([type, value]) => ({ type, value })),
  ];
};

// An engine can resolve the calendar the device names rather than the gregory
// one the locale implies, and it writes the year differently under each:
// japanese puts an era after it, chinese replaces it with a relatedYear.
// Neither moves the locale resolvedOptions answers with.
const resolvingTheCalendar = (calendar: string, body: () => void) =>
  patchingIntl(
    (args) =>
      args.options?.timeZoneName === "longGeneric"
        ? { ...args, options: { ...args.options, calendar } }
        : args,
    body,
  );

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

// An engine can write a 12-hour clock under the cycle it says it resolved,
// which leaves the dayPeriod beside the hour as the only sign of it.
const writingA12HourClockUnderTheCycleItResolved = (body: () => void) => {
  const real = Intl.DateTimeFormat;

  standingInFor((locales, options) => {
    const truthful = new real(locales, options);
    if (options?.hourCycle !== "h23") return truthful;

    const fmt = new real(locales, {
      ...options,
      hour12: undefined,
      hourCycle: "h12",
    });
    Object.defineProperty(fmt, "resolvedOptions", {
      value: () => truthful.resolvedOptions(),
    });
    return fmt;
  }, body);
};

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

const renderOpen = () => {
  const rendered = renderHook(() => useTimeZoneSelect({}));
  act(() => rendered.result.current.setOpen(true));
  return rendered;
};

const labelIn = (tz: string) => {
  const { result } = renderOpen();
  return result.current.items.find((i) => i.tz === tz)?.labelLeft;
};

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

  it("offers UTC but no other zone that no country claims", () => {
    const offered = TZ_OPTIONS.map(({ tz }) => tz);

    expect(offered).toContain("Etc/UTC");
    expect(offered).not.toContain("Etc/GMT+5");
    expect(offered).not.toContain("Factory");
  });
});

describe("a zone Intl rejects", () => {
  it("keeps its row, with no clock rather than no zone", () => {
    TZ_OPTIONS.push({ tz: "Not/AZone", countries: [] });
    try {
      const { result } = renderOpen();

      expect(result.current.items).toHaveLength(TZ_OPTIONS.length);
      expect(
        result.current.items.find(({ tz }) => tz === "Not/AZone"),
      ).toMatchObject({ timeLabel: null, offsetMins: null });
    } finally {
      TZ_OPTIONS.pop();
    }
  });

  it("sorts after every zone that has an offset", () => {
    TZ_OPTIONS.push({ tz: "Not/AZone", countries: [] });
    try {
      const { result } = renderOpen();
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
      tz: "Not/AZone",
      countries: [{ name: "Nowhere", alsoCalled: [] }],
    });
    try {
      const { result } = renderOpen();

      expect(result.current.items).toEqual([
        {
          tz: "Not/AZone",
          labelLeft: "AZone",
          labelSub: "Nowhere",
          searchText: "azone nowhere",
          ownNames: ["azone", "nowhere"],
          sharedNames: [],
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
      { tz: "Not/Zed", countries: [] },
      { tz: "Not/Mid", countries: [] },
      { tz: "Not/Alpha", countries: [] },
    );
    try {
      const { result } = renderOpen();

      expect(result.current.items.map(({ tz }) => tz)).toEqual([
        "Not/Alpha",
        "Not/Mid",
        "Not/Zed",
      ]);
    } finally {
      TZ_OPTIONS.splice(0, TZ_OPTIONS.length, ...listed);
    }
  });
});

describe("a runtime that formats without writing parts", () => {
  it("keeps the clocks it can format and gives up the offsets", () => {
    writingNoParts(() => {
      const { result } = renderOpen();

      const row = result.current.items.find(
        ({ tz }) => tz === "America/New_York",
      );
      expect(row?.timeLabel).not.toBeNull();
      expect(row?.offsetMins).toBeNull();
      expect(row?.labelLeft).toBe("New York");
    });
  });

  it("keeps its rows when the parts are not a list either", () => {
    writingPartsNoOneCanWalk(() => {
      expect(getOffsetMinutes("America/New_York")).toBeNull();

      const { result } = renderOpen();

      expect(result.current.items).toHaveLength(TZ_OPTIONS.length);
      expect(
        result.current.items.find(({ tz }) => tz === "America/New_York"),
      ).toMatchObject({
        labelLeft: "New York",
        offsetMins: null,
      });
    });
  });
});

describe("a runtime that refuses at the read rather than at the constructor", () => {
  it("keeps its rows, named by city with no clock or offset", () => {
    refusingAtRead(new RangeError("no data"), () => {
      const { result } = renderOpen();

      expect(result.current.items).toHaveLength(TZ_OPTIONS.length);
      expect(
        result.current.items.find(({ tz }) => tz === "America/New_York"),
      ).toMatchObject({
        labelLeft: "New York",
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
        const { result } = renderOpen();

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
      {
        tz: UTC_ZONE,
        countries: [{ name: "Iceland", alsoCalled: [] }],
      },
      { tz: "Not/AZone", countries: [] },
    );
    try {
      const { result } = renderOpen();
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
  it("refreshes on a picker nobody has opened", () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useTimeZoneSelect({}));
    const atMount = result.current.selected.timeLabel;

    act(() => jest.advanceTimersByTime(millisecondsInMinute));

    expect(result.current.selected.timeLabel).not.toBe(atMount);
  });

  it("flips on the minute boundary, not a minute after mount", () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useTimeZoneSelect({}));
    const atMount = result.current.selected.timeLabel;

    act(() =>
      jest.advanceTimersByTime(
        millisecondsInMinute - (Date.now() % millisecondsInMinute) - 1,
      ),
    );
    expect(result.current.selected.timeLabel).toBe(atMount);

    act(() => jest.advanceTimersByTime(1));
    expect(result.current.selected.timeLabel).not.toBe(atMount);
  });

  it("re-arms on the boundary after that, not a minute past the fire", () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useTimeZoneSelect({}));

    act(() =>
      jest.advanceTimersByTime(
        millisecondsInMinute - (Date.now() % millisecondsInMinute),
      ),
    );
    const atBoundary = result.current.selected.timeLabel;

    act(() => jest.advanceTimersByTime(millisecondsInMinute - 1));
    expect(result.current.selected.timeLabel).toBe(atBoundary);

    act(() => jest.advanceTimersByTime(1));
    expect(result.current.selected.timeLabel).not.toBe(atBoundary);
  });

  it("shows the minute it committed in, not the one it rendered in", () => {
    jest.useFakeTimers();
    jest.setSystemTime(
      Date.now() +
        (millisecondsInMinute - (Date.now() % millisecondsInMinute)) -
        1,
    );

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

  it("refreshes the list while the picker stays open", () => {
    jest.useFakeTimers();
    const { result } = renderOpen();
    const atMount = result.current.items.at(0)?.timeLabel;

    act(() => jest.advanceTimersByTime(millisecondsInMinute));

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

    act(() => jest.advanceTimersByTime(millisecondsInMinute));

    expect(result.current.selected.timeLabel).not.toBe(atMount);
  });

  it("keeps the timer for the pickers a feed has left mounted", () => {
    jest.useFakeTimers();
    const leaving = renderHook(() => useTimeZoneSelect({}));
    const staying = renderHook(() => useTimeZoneSelect({}));
    const atMount = staying.result.current.selected.timeLabel;

    leaving.unmount();
    expect(jest.getTimerCount()).toBe(1);

    act(() => jest.advanceTimersByTime(millisecondsInMinute));

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
    const { result } = renderOpen();

    jest.setSystemTime(new Date(Date.UTC(2026, 2, 8, 10, 30)));
    act(() => jest.advanceTimersByTime(millisecondsInMinute));

    expect(
      result.current.items.find((i) => i.tz === "America/Los_Angeles")
        ?.offsetMins,
    ).toBe(-420);
  });
});

describe("searching the zone list", () => {
  const zonesMatching = (query: string) => {
    const { result } = renderOpen();
    act(() => result.current.setQuery(query));
    return result.current.filtered.map(({ tz }) => tz);
  };

  it("finds a zone by a country its name does not say", () => {
    expect(zonesMatching("germany")).toContain("Europe/Berlin");
    expect(zonesMatching("sri lanka")).toEqual(["Asia/Colombo"]);
  });

  it("finds that country on a runtime with no name for the zone", () => {
    rejecting("longGeneric", () => {
      expect(zonesMatching("sri lanka")).toEqual(["Asia/Colombo"]);
    });
  });

  it("still finds a zone by the name Intl gives it", () => {
    expect(zonesMatching("india standard")).toContain("Asia/Kolkata");
  });

  it("finds a zone by a name spelled with the accents it carries", () => {
    expect(zonesMatching("Bogotá")).toContain("America/Bogota");
  });

  it("finds a zone whose own name carries accents the query leaves out", () => {
    expect(zonesMatching("turkiye")).toEqual(["Europe/Istanbul"]);
  });

  it("leaves out a zone naming the query inside a longer word", () => {
    const matched = zonesMatching("china");
    expect(matched).not.toContain("Asia/Bangkok");
    expect(matched).toContain("Asia/Shanghai");
  });

  it("opens on the zone a query names over one whose name starts with it", () => {
    expect(zonesMatching("india")[0]).toBe("Asia/Kolkata");
  });

  it("opens on the zone a country is principal in over one it shares", () => {
    expect(zonesMatching("germany")[0]).toBe("Europe/Berlin");
    expect(zonesMatching("vietnam")[0]).toBe("Asia/Ho_Chi_Minh");
  });

  it("lists a country's own zones ahead of zones it shares", () => {
    expect(zonesMatching("netherlands")).toEqual([
      "Europe/Brussels",
      "America/Puerto_Rico",
    ]);
  });

  it("opens on the country a query names over one whose name contains it", () => {
    expect(zonesMatching("samoa")[0]).toBe("Pacific/Apia");
    expect(zonesMatching("georgia")[0]).toBe("Asia/Tbilisi");
    expect(zonesMatching("united states")[0]).toBe("Pacific/Honolulu");
  });

  it("leads a country's rows with the zones its own members pick", () => {
    expect(zonesMatching("usa").slice(0, 6)).toEqual([
      "Pacific/Honolulu",
      "America/Anchorage",
      "America/Los_Angeles",
      "America/Denver",
      "America/Chicago",
      "America/New_York",
    ]);
    expect(zonesMatching("china")[0]).toBe("Asia/Shanghai");
    expect(zonesMatching("russia")[0]).toBe("Europe/Moscow");
  });

  it("leads the zones sharing a name with the principal one among them", () => {
    expect(zonesMatching("eastern")[0]).toBe("America/New_York");
    expect(zonesMatching("central")[0]).toBe("America/Chicago");
    expect(zonesMatching("mountain")[0]).toBe("America/Denver");
    expect(zonesMatching("pacific")[0]).toBe("America/Los_Angeles");
  });

  it("leads a name's own zones over the ones Intl calls standard", () => {
    const matched = zonesMatching("mountain");

    expect(matched.indexOf("America/Boise")).toBeLessThan(
      matched.indexOf("America/Dawson_Creek"),
    );
  });

  it("leaves out the area a zone's id starts with", () => {
    const matched = zonesMatching("pacific");

    expect(matched).toContain("America/Los_Angeles");
    expect(matched).not.toContain("Pacific/Niue");
  });

  it("names zones each principal country still lists", () => {
    for (const [code, zones] of Object.entries(PRINCIPAL_ZONES)) {
      for (const tz of zones) {
        expect(TZ_OPTIONS.find((o) => o.tz === tz)?.tz).toBe(tz);
        expect(getTimezone(tz)?.countries).toContain(code);
      }
    }
  });

  it("finds a country by a name tzdata does not call it", () => {
    expect(zonesMatching("uk")[0]).toBe("Europe/London");
    expect(zonesMatching("england")).toEqual(["Europe/London"]);
    expect(zonesMatching("turkey")).toEqual(["Europe/Istanbul"]);
    expect(zonesMatching("usa")).toContain("America/New_York");
  });

  it("finds a zone by a name only its IANA name writes", () => {
    expect(zonesMatching("dakota")).toEqual([
      "America/North_Dakota/Beulah",
      "America/North_Dakota/Center",
      "America/North_Dakota/New_Salem",
    ]);
  });

  it("carries the zone's countries", () => {
    const { result } = renderOpen();
    const labelSubOf = (tz: string) =>
      result.current.items.find((i) => i.tz === tz)?.labelSub;

    expect(labelSubOf("America/New_York")).toBe("United States of America");
    expect(labelSubOf("Asia/Kolkata")).toBe("India");
    expect(labelSubOf("Etc/UTC")).toBeNull();
    expect(labelSubOf("Africa/Abidjan")).toContain(
      " · Saint Helena, Ascension and Tristan da Cunha · ",
    );
  });

  it("names Antarctica only on a zone no country shares", () => {
    const { result } = renderOpen();
    const labelSubOf = (tz: string) =>
      result.current.items.find((i) => i.tz === tz)?.labelSub;

    expect(labelSubOf("Asia/Singapore")).toBe("Singapore · Malaysia");
    expect(labelSubOf("Antarctica/Casey")).toBe("Antarctica");
  });

  it("finds a zone by a city tzdata files under another zone", () => {
    expect(zonesMatching("kinshasa")).toEqual(["Africa/Lagos"]);
    expect(zonesMatching("stockholm")).toEqual(["Europe/Berlin"]);
  });

  it("finds no zone by a retired name that is no place", () => {
    expect(zonesMatching("west")).not.toContain("America/Manaus");
    expect(zonesMatching("general")).toEqual([]);
  });

  const activeFor = (query: string) => {
    const { result } = renderOpen();
    act(() => result.current.setQuery(query));
    return result.current.filtered[result.current.activeIndex]?.tz;
  };

  it("starts on the first row where the query ranks it alone", () => {
    expect(activeFor("india")).toBe("Asia/Kolkata");
    expect(activeFor("germany")).toBe("Europe/Berlin");
    expect(activeFor("kinshasa")).toBe("Africa/Lagos");
  });

  it("starts on no row where the query ranks several first", () => {
    expect(activeFor("usa")).toBeUndefined();
    expect(activeFor("china")).toBeUndefined();
    expect(activeFor("eastern")).toBeUndefined();
    expect(activeFor("")).toBeUndefined();
  });

  it("keeps the row a trigger asks for on its way in", () => {
    const { result } = renderHook(() => useTimeZoneSelect({}));

    act(() => {
      result.current.setOpen(true);
      result.current.setActiveIndex(0);
    });

    expect(result.current.activeIndex).toBe(0);
  });

  it("drops the row the member moved to once they type", () => {
    const { result } = renderOpen();
    act(() => result.current.setActiveIndex(4));

    act(() => result.current.setQuery("eastern"));

    expect(result.current.activeIndex).toBe(-1);
  });

  it("finds a zone by a name tzdata has retired", () => {
    expect(zonesMatching("calcutta")).toEqual(["Asia/Kolkata"]);
    expect(zonesMatching("saigon")).toEqual(["Asia/Ho_Chi_Minh"]);
  });
});

describe("a closed picker", () => {
  it("asks Intl about the saved zone and no other", () => {
    const real = Intl.DateTimeFormat;
    const asked = new Set<string | undefined>();

    standingInFor(
      (locales, options) => {
        asked.add(options?.timeZone);
        return new real(locales, options);
      },
      () => {
        renderHook(() => useTimeZoneSelect({ value: "Europe/Berlin" }));
      },
    );

    expect([...asked]).toEqual(["Europe/Berlin"]);
  });

  it("keeps its list while it closes, for a modal still fading out", () => {
    const { result } = renderOpen();
    act(() => result.current.setQuery("germany"));

    act(() => result.current.setOpen(false));

    expect(result.current.filtered.map(({ tz }) => tz)).toContain(
      "Europe/Berlin",
    );
    expect(result.current.filtered).not.toHaveLength(TZ_OPTIONS.length);
  });

  it("opens on a fresh search rather than the last one's", () => {
    const { result } = renderOpen();
    act(() => result.current.setQuery("germany"));
    act(() => result.current.setOpen(false));

    act(() => result.current.setOpen(true));

    expect(result.current.query).toBe("");
    expect(result.current.filtered).toHaveLength(TZ_OPTIONS.length);
  });
});

describe("a zone saved under a name tzdata has since replaced", () => {
  it.each(["GMT", "Etc/GMT", "Greenwich"])("selects UTC for %s", (tz) => {
    const { result } = renderHook(() => useTimeZoneSelect({ value: tz }));

    expect(result.current.selected.tz).toBe("Etc/UTC");
  });

  it("selects the row of the zone it now names", () => {
    const { result } = renderHook(() =>
      useTimeZoneSelect({ value: "Asia/Calcutta" }),
    );

    expect(result.current.selected).toMatchObject({
      tz: "Asia/Kolkata",
      labelLeft: "India Standard Time — Kolkata",
    });
  });
});

describe("a runtime missing a timeZoneName style", () => {
  it("keeps every clock and every offset when shortOffset is missing", () => {
    rejecting("shortOffset", () => {
      const { result } = renderOpen();

      expect(
        result.current.items.every(
          ({ timeLabel, offsetMins }) => timeLabel && offsetMins !== null,
        ),
      ).toBe(true);
    });
  });

  it("still sorts by offset when shortOffset is missing", () => {
    rejecting("shortOffset", () => {
      const { result } = renderOpen();
      const offsets = result.current.items.map(({ offsetMins }) => offsetMins!);

      expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
      expect(new Set(offsets).size).toBeGreaterThan(1);
    });
  });

  it("falls back to the city when longGeneric is missing", () => {
    rejecting("longGeneric", () => {
      const { result } = renderOpen();

      const row = result.current.items.find(
        ({ tz }) => tz === "America/New_York",
      );
      expect(row?.labelLeft).toBe("New York");
      expect(row?.searchText).toContain("united states");
    });
  });

  it("names every zone rather than reading one back as a path", () => {
    rejecting("longGeneric", () => {
      const { result } = renderOpen();

      for (const { labelLeft } of result.current.items) {
        expect(labelLeft).not.toContain("/");
      }
    });
  });
});

// de writes Europe/London as "Vereinigtes Königreich (Ortszeit)". Nothing off
// the end of a name is the separator the date sits behind.
const PUNCTUATED = "Vereinigtes Königreich (Ortszeit)";

describe("a runtime writing a zone name as one part", () => {
  const oneParted =
    (override?: string) =>
    ({ name, date }: ZoneNameWritten) => [
      ...date,
      literal(", "),
      { type: "timeZoneName", value: override ?? name } as const,
    ];

  it("labels the row with the name and none of what surrounds it", () => {
    layingOutTheZoneName(oneParted(), () => {
      expect(labelIn("Asia/Kolkata")).toBe("India Standard Time — Kolkata");
    });
  });

  it("labels the row with a name that ends in punctuation", () => {
    layingOutTheZoneName(oneParted(PUNCTUATED), () => {
      expect(labelIn("Europe/London")).toBe(`${PUNCTUATED} — London`);
    });
  });

  it("labels the row with none of the glue behind the name", () => {
    const trailed = ({ name, date }: ZoneNameWritten) => [
      ...date,
      literal(", "),
      { type: "timeZoneName", value: name } as const,
      literal(" "),
    ];

    layingOutTheZoneName(trailed, () => {
      expect(labelIn("Asia/Kolkata")).toBe("India Standard Time — Kolkata");
    });
  });
});

describe("the Hermes that ships in apps/mobile/ios", () => {
  const LABELLED: Record<string, string> = {
    "Asia/Kathmandu": "Nepal Time — Kathmandu",
    "Asia/Kolkata": "India Standard Time — Kolkata",
    "Pacific/Auckland": "New Zealand Time — Auckland",
    "Australia/Perth": "Australian Western Standard Time — Perth",
  };

  it("labels the row with the whole name", () => {
    // A zone the parts dropped falls to the one part above, where the name
    // arrives whole and the row reads right without the slice this covers.
    expect(Object.keys(LABELLED)).toEqual(Object.keys(APPLE_HERMES_NAME));

    layingOutTheZoneName(asAppleHermesWrote, () => {
      for (const [tz, label] of Object.entries(LABELLED)) {
        expect(labelIn(tz)).toBe(label);
      }
    });
  });
});

describe.each(["japanese", "chinese"])(
  "a runtime resolving the %s calendar",
  (calendar) => {
    it("labels the row with the name and none of the year in front of it", () => {
      // Against a runtime short of the calendar's data this would pass on the
      // gregory year it never meant to read.
      expect(
        new Intl.DateTimeFormat("en-US", { calendar }).resolvedOptions()
          .calendar,
      ).toBe(calendar);
      resolvingTheCalendar(calendar, () => {
        expect(labelIn("Asia/Kolkata")).toBe("India Standard Time — Kolkata");
      });
    });
  },
);

describe("a runtime writing a zone name that is not a string", () => {
  it("keeps its rows rather than throwing at the slice", () => {
    writingTheZoneNameAs(undefined, () => {
      const { result } = renderOpen();

      expect(result.current.items).toHaveLength(TZ_OPTIONS.length);
      expect(labelIn("Asia/Kolkata")).toBe("Kolkata");
    });
  });
});

describe("a runtime naming its locale as something other than a string", () => {
  it("keeps its rows rather than throwing at the guard", () => {
    namingTheLocale(Symbol("vi"), () => {
      const { result } = renderOpen();

      expect(result.current.items).toHaveLength(TZ_OPTIONS.length);
      expect(labelIn("Asia/Kolkata")).toBe("Kolkata");
    });
  });
});

describe("a runtime that writes an empty zone name", () => {
  it("falls back to the city rather than a bare dash", () => {
    blankingTheZoneName(() => {
      expect(labelIn("America/New_York")).toBe("New York");
    });
  });

  it("falls back on a runtime that also breaks a name into parts", () => {
    layingOutTheZoneName(asAppleHermesWrote, () => {
      blankingTheZoneName(() => {
        expect(labelIn("Asia/Kolkata")).toBe("Kolkata");
      });
    });
  });
});

describe("a runtime with no en-US data", () => {
  it.each(["eu", "vi"])(
    "leaves the row its city when the fallback is %s",
    (locale) => {
      // Against a runtime short of that locale's data this would pass on an
      // en-US name it never meant to read.
      expect(new Intl.DateTimeFormat(locale).resolvedOptions().locale).toBe(
        locale,
      );
      fallingBackTo({ locale }, () => {
        expect(labelIn("Europe/London")).toBe("London");
        expect(labelIn("Asia/Kolkata")).toBe("Kolkata");
      });
    },
  );

  it("labels the row with the name a plain en fallback wrote", () => {
    // Against a runtime that resolved en-US anyway this would pass without
    // reaching the English the guard admits beside en-US.
    expect(new Intl.DateTimeFormat("en").resolvedOptions().locale).toBe("en");
    fallingBackTo({ locale: "en" }, () => {
      expect(labelIn("Asia/Kolkata")).toBe("India Standard Time — Kolkata");
    });
  });

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
  const sixInTheEveningInTokyo = new Date(Date.UTC(2026, 0, 15, 9));

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

  // Reading the dayPeriod off the parts rather than dropping it is what keeps
  // 6 PM from landing 3 hours behind UTC, inside the range check.
  it("withholds it when that clock writes a dayPeriod that is not a string", () => {
    rejecting("shortOffset", () => {
      writingA12HourClockUnderTheCycleItResolved(() => {
        writingThePartAs({ type: "dayPeriod", value: undefined }, () => {
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
