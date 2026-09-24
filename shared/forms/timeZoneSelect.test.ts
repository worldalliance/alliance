import { TIME_ZONE_CATALOG } from "@alliance/common/timezone-catalog.gen";
import { act, renderHook } from "@testing-library/react";
import { millisecondsInMinute } from "date-fns/constants";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  fallingBackTo,
  patchingIntl,
  rejecting,
  standingInFor,
} from "../lib/testing/intlStandIns";
import { resetClock } from "../lib/useClockMinute";
import { formatNowTimeInTz, getOffsetMinutes } from "./timeZoneIntl";
import {
  resetTimeZoneCaches,
  useTimeZoneSelect,
  type UseTimeZoneSelectParams,
} from "./timeZoneSelect";

beforeEach(() => {
  resetTimeZoneCaches();
  resetClock();
});
afterEach(() => jest.useRealTimers());

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

function renderOpen(params: UseTimeZoneSelectParams = {}) {
  const hook = renderHook(() => useTimeZoneSelect(params));
  act(() => hook.result.current.setOpen(true));
  return hook;
}

const labelIn = (tz: string) => {
  const { result } = renderOpen();
  return result.current.items.find((i) => i.tz === tz)?.labelLeft;
};

const rejectingZone = (tz: string, body: () => void) =>
  patchingIntl((args) => {
    if (args.options?.timeZone === tz) throw new RangeError("no data");
    return args;
  }, body);

const rejectingEveryZone = (body: () => void) =>
  patchingIntl((args) => {
    if (args.options?.timeZone) throw new RangeError("no data");
    return args;
  }, body);

describe("the rows", () => {
  const january = new Date(Date.UTC(2026, 0, 15, 12));
  const rowFor = (tz: string) => {
    jest.useFakeTimers();
    jest.setSystemTime(january);
    const { result } = renderOpen();
    return result.current.items.find((i) => i.tz === tz);
  };

  it("lists every zone the catalog carries, once", () => {
    const { result } = renderOpen();

    expect(result.current.items.map(({ tz }) => tz).sort()).toEqual(
      TIME_ZONE_CATALOG.map(({ tz }) => tz).sort(),
    );
  });

  it("names the zone and its location, with country and offset under it", () => {
    expect(rowFor("America/Los_Angeles")).toMatchObject({
      labelLeft: "Pacific Time · Los Angeles",
      labelSub: "United States · UTC-8",
    });
  });

  it("writes the minutes of an offset that is not a whole hour", () => {
    expect(rowFor("Asia/Kathmandu")?.labelSub).toBe("Nepal · UTC+5:45");
  });

  it("gives UTC, which belongs to no country, only its offset", () => {
    expect(rowFor("UTC")?.labelSub).toBe("UTC+0");
  });

  it("names UTC by location rather than by its offset", () => {
    expect(rowFor("UTC")?.labelLeft).toBe("UTC");
  });

  it("writes each zone's clock as a formatter in that zone would", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(Date.UTC(2026, 6, 15, 12, 34)));
    const { result } = renderOpen();

    const wrong = result.current.items.filter(
      ({ tz, timeLabel }) => timeLabel !== formatNowTimeInTz(tz),
    );

    expect(wrong).toEqual([]);
  });

  it("sorts by offset, then location", () => {
    const { result } = renderOpen();
    const items = result.current.items;

    const outOfOrder = items.slice(1).filter((item, i) => {
      const before = items[i];
      return (
        item.offsetMins! < before.offsetMins! ||
        (item.offsetMins === before.offsetMins &&
          item.city.localeCompare(before.city) < 0)
      );
    });

    expect(outOfOrder).toEqual([]);
  });
});

describe("a zone Intl rejects", () => {
  it("keeps its row, by location, with no clock rather than no zone", () => {
    rejectingZone("Asia/Tokyo", () => {
      const { result } = renderOpen();

      expect(result.current.items).toHaveLength(TIME_ZONE_CATALOG.length);
      expect(
        result.current.items.find(({ tz }) => tz === "Asia/Tokyo"),
      ).toMatchObject({
        labelLeft: "Tokyo",
        labelSub: "Japan",
        timeLabel: null,
        offsetMins: null,
      });
    });
  });

  it("sorts after every zone that has an offset", () => {
    rejectingZone("Asia/Tokyo", () => {
      const { result } = renderOpen();

      expect(result.current.items.at(-1)?.tz).toBe("Asia/Tokyo");
    });
  });

  it("keeps its place when it is the zone a member already saved", () => {
    const { result } = renderOpen({ value: "Not/AZone" });

    expect(result.current.selected.tz).toBe("Not/AZone");
    expect(result.current.selected.timeLabel).toBeNull();
    expect(result.current.items).toHaveLength(TIME_ZONE_CATALOG.length);
  });
});

describe("a runtime that rejects every zone", () => {
  it("still offers a list a member can pick their zone from", () => {
    rejectingEveryZone(() => {
      const { result } = renderOpen();

      expect(result.current.items).toHaveLength(TIME_ZONE_CATALOG.length);
      expect(
        result.current.items.find(({ tz }) => tz === "Asia/Tokyo"),
      ).toMatchObject({
        labelLeft: "Tokyo",
        labelSub: "Japan",
        offsetMins: null,
        timeLabel: null,
      });
    });
  });

  it("sorts the list by location, since no zone has an offset to sort by", () => {
    rejectingEveryZone(() => {
      const { result } = renderOpen();
      const cities = result.current.items.map(({ city }) => city);

      expect(cities).toEqual([...cities].sort((a, b) => a.localeCompare(b)));
    });
  });
});

describe("a picker nobody has opened", () => {
  it("builds no list", () => {
    const { result } = renderHook(() => useTimeZoneSelect({}));

    expect(result.current.items).toEqual([]);
  });

  it("still labels the zone on its trigger", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(Date.UTC(2026, 0, 15, 12)));
    const { result } = renderHook(() =>
      useTimeZoneSelect({ value: "America/Los_Angeles" }),
    );

    expect(result.current.selected).toMatchObject({
      tz: "America/Los_Angeles",
      labelLeft: "Pacific Time · Los Angeles",
      labelSub: "United States · UTC-8",
    });
  });

  it("keeps its list once the picker closes", () => {
    const { result } = renderOpen();

    act(() => result.current.setOpen(false));

    expect(result.current.items).toHaveLength(TIME_ZONE_CATALOG.length);
  });
});

describe("a picker mounted on a runtime with idle time", () => {
  let pending: IdleRequestCallback | null;
  let requested: number;
  let options: IdleRequestOptions | undefined;

  beforeEach(() => {
    pending = null;
    requested = 0;
    options = undefined;
    globalThis.requestIdleCallback = (callback, requestOptions) => {
      pending = callback;
      options = requestOptions;
      return ++requested;
    };
    globalThis.cancelIdleCallback = () => {
      pending = null;
    };
  });
  afterEach(() => {
    jest.restoreAllMocks();
    resetTimeZoneCaches();
    Reflect.deleteProperty(globalThis, "requestIdleCallback");
    Reflect.deleteProperty(globalThis, "cancelIdleCallback");
  });

  const runIdle = ({
    steps,
    msEach,
    didTimeout = false,
  }: {
    steps: number;
    msEach: number;
    didTimeout?: boolean;
  }) => {
    for (let run = 0; run < steps; run++) {
      const callback = pending;
      pending = null;
      callback?.({ didTimeout, timeRemaining: () => msEach });
    }
  };

  const countingFormatters = (body: (built: () => number) => void) => {
    const real = Intl.DateTimeFormat;
    let built = 0;
    standingInFor(
      (locales, options) => {
        built++;
        return new real(locales, options);
      },
      () => body(() => built),
    );
  };

  it("builds no formatter on open once the runtime has been idle", () => {
    countingFormatters((built) => {
      const { result } = renderHook(() => useTimeZoneSelect({}));
      runIdle({ steps: 1, msEach: Infinity });
      const beforeOpen = built();

      act(() => result.current.setOpen(true));

      expect(result.current.items).toHaveLength(TIME_ZONE_CATALOG.length);
      expect(built()).toBe(beforeOpen);
    });
  });

  it("hands the runtime back after a zone once its idle time runs out", () => {
    countingFormatters((built) => {
      // The trigger has already built the selected zone's formatters.
      renderHook(() => useTimeZoneSelect({ value: "Pacific/Kiritimati" }));
      const atMount = built();

      runIdle({ steps: 1, msEach: 0 });

      expect(built() - atMount).toBe(2);
      expect(pending).not.toBeNull();
    });
  });

  it("keeps labelling in a late step while it has idle time left", () => {
    renderHook(() => useTimeZoneSelect({}));

    runIdle({ steps: 1, msEach: 50, didTimeout: true });

    expect(pending).toBeNull();
  });

  it("yields a late step once its idle time is taken back", () => {
    jest.spyOn(performance, "now").mockReturnValue(0);
    renderHook(() => useTimeZoneSelect({}));
    let calls = 0;

    const callback = pending;
    pending = null;
    callback?.({
      didTimeout: true,
      timeRemaining: () => (calls++ === 0 ? 50 : 0),
    });

    expect(pending).not.toBeNull();
  });

  it("labels for a few ms in a step forced with no idle time left", () => {
    let now = 0;
    const clock = jest.spyOn(performance, "now").mockImplementation(() => now);
    renderHook(() => useTimeZoneSelect({}));

    runIdle({ steps: 1, msEach: 0, didTimeout: true });
    expect(pending).toBeNull();

    resetTimeZoneCaches();
    renderHook(() => useTimeZoneSelect({}));
    clock.mockImplementation(() => now++);
    runIdle({ steps: 1, msEach: 0, didTimeout: true });
    expect(pending).not.toBeNull();
  });

  it("shows no rows while it warms rather than labelling the rest at once", () => {
    countingFormatters((built) => {
      const { result } = renderHook(() => useTimeZoneSelect({}));
      runIdle({ steps: 1, msEach: 0 });
      const beforeOpen = built();

      act(() => result.current.setOpen(true));

      expect(result.current.loading).toBe(true);
      expect(result.current.items).toEqual([]);
      expect(built()).toBe(beforeOpen);
    });
  });

  it("lists the rows a cold open would once warming ends", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(Date.UTC(2026, 0, 15, 12)));
    const idle = globalThis.requestIdleCallback;
    Reflect.deleteProperty(globalThis, "requestIdleCallback");
    const cold = renderOpen().result.current.items;
    globalThis.requestIdleCallback = idle;
    resetTimeZoneCaches();
    expect(cold).toHaveLength(TIME_ZONE_CATALOG.length);

    const { result } = renderHook(() => useTimeZoneSelect({}));
    runIdle({ steps: Math.floor(TIME_ZONE_CATALOG.length / 2), msEach: 0 });
    act(() => result.current.setOpen(true));
    act(() => runIdle({ steps: TIME_ZONE_CATALOG.length, msEach: 0 }));

    expect(result.current.loading).toBe(false);
    expect(result.current.items).toEqual(cold);
  });

  it("asks for every step with a timeout", () => {
    renderHook(() => useTimeZoneSelect({}));
    expect(options?.timeout).toBeGreaterThan(0);

    runIdle({ steps: 1, msEach: 0 });

    expect(pending).not.toBeNull();
    expect(options?.timeout).toBeGreaterThan(0);
  });

  it("stops warming once every zone is labelled", () => {
    renderHook(() => useTimeZoneSelect({}));
    runIdle({ steps: TIME_ZONE_CATALOG.length, msEach: 0 });

    expect(pending).toBeNull();
  });

  it("warms once however many pickers a screen mounts", () => {
    [1, 2, 3].map(() => renderHook(() => useTimeZoneSelect({})));

    expect(requested).toBe(1);
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

      expect(result.current.items).toHaveLength(TIME_ZONE_CATALOG.length);
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
  it("keeps its rows, by location with no clock or offset", () => {
    refusingAtRead(new RangeError("no data"), () => {
      const { result } = renderOpen();

      expect(result.current.items).toHaveLength(TIME_ZONE_CATALOG.length);
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

        expect(result.current.items).toHaveLength(TIME_ZONE_CATALOG.length);
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
    const { result } = renderOpen();
    const place = (tz: string) =>
      result.current.items.findIndex((i) => i.tz === tz);

    expect(place(UTC_ZONE)).toBeGreaterThan(place("America/New_York"));
    expect(place(UTC_ZONE)).toBeLessThan(place("Europe/Paris"));
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

  it("leaves the list alone on a picker opened once and closed", () => {
    jest.useFakeTimers();
    const { result } = renderOpen();
    act(() => result.current.setOpen(false));
    const atClose = result.current.items;

    act(() => jest.advanceTimersByTime(millisecondsInMinute));

    expect(result.current.items).toBe(atClose);
  });

  it("refreshes the list when that picker opens again", () => {
    jest.useFakeTimers();
    const { result } = renderOpen();
    act(() => result.current.setOpen(false));
    const atClose = result.current.items.at(0)?.timeLabel;

    act(() => jest.advanceTimersByTime(millisecondsInMinute));
    act(() => result.current.setOpen(true));

    expect(result.current.items.at(0)?.timeLabel).not.toBe(atClose);
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

describe("the locale a formatter is built for", () => {
  const localesAsked = (defaultLocale: string) => {
    const real = Intl.DateTimeFormat;
    const asked: unknown[] = [];

    standingInFor(
      (locales, options) => {
        if (options?.timeZone) asked.push(locales);
        return new real(locales ?? defaultLocale, options);
      },
      () => renderOpen(),
    );
    return new Set(asked);
  };

  it("is the runtime's own where that is en-US, which Hermes builds faster", () => {
    expect(localesAsked("en-US").has("en-US")).toBe(false);
  });

  it("is en-US where the runtime's own is another", () => {
    expect(localesAsked("de-DE").has("en-US")).toBe(true);
  });
});

describe("searching the zone list", () => {
  const zonesMatching = (query: string) => {
    const { result } = renderOpen();
    act(() => result.current.setQuery(query));
    return result.current.filtered.map(({ tz }) => tz);
  };

  it("finds a zone by its country", () => {
    expect(zonesMatching("sri lanka")).toEqual(["Asia/Colombo"]);
  });

  it.each([
    ["trinidad and tobago", "America/Port_of_Spain"],
    ["trinidad & tobago", "America/Port_of_Spain"],
    ["cote d'ivoire", "Africa/Abidjan"],
    ["côte d’ivoire", "Africa/Abidjan"],
  ])(
    "finds a country spelled as typed or as CLDR writes it, %s",
    (query, tz) => {
      expect(zonesMatching(query)).toEqual([tz]);
    },
  );

  it("finds a zone by the offset under its name", () => {
    expect(zonesMatching("utc+5:30")).toEqual(["Asia/Colombo", "Asia/Kolkata"]);
    expect(zonesMatching("+5:45")).toEqual(["Asia/Kathmandu"]);
  });

  it.each(["utc+", "utc+0", "+0", "utc+00:00"])(
    "opens %s on UTC ahead of the other zones at its offset",
    (query) => {
      expect(zonesMatching(query)[0]).toBe("UTC");
    },
  );

  it.each([
    ["utc-1", -60],
    ["-3", -180],
    ["utc-9", -540],
    ["utc+1", 60],
    ["utc+5", 300],
  ])("opens %s on that offset, ahead of the ones it starts", (query, mins) => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(Date.UTC(2026, 0, 15, 12)));
    const { result } = renderOpen();
    act(() => result.current.setQuery(query));

    expect(result.current.filtered[0].offsetMins).toBe(mins);
  });

  it.each([
    ["gmt+1", "utc+1"],
    ["utc+01:00", "utc+1"],
    ["+0530", "utc+5:30"],
    ["utc 5", "utc+5"],
    ["utc-0", "utc+0"],
    ["utc+5:3", "utc+5:3"],
    ["+053", "utc+5:3"],
    ["-093", "utc-9:3"],
    ["+530", "utc+5:30"],
    ["utc\u22125", "utc-5"],
  ])("reads %s as the offset a row writes as %s", (query, written) => {
    const { result } = renderOpen();
    act(() => result.current.setQuery(query));
    const offsets = result.current.filtered.map((i) =>
      i.labelSub?.split(" · ").at(-1)?.toLowerCase(),
    );

    expect(offsets.length).toBeGreaterThan(0);
    expect(offsets.every((o) => o?.startsWith(written))).toBe(true);
  });

  it.each([
    ["utc+01:00", 60],
    ["utc+5:00", 300],
    ["+0530", 330],
    ["utc+01", 60],
    ["utc+1:", 60],
    ["utc+5:0", 300],
    ["+050", 300],
  ])("keeps only the offset %s writes out in full", (query, mins) => {
    const { result } = renderOpen();
    act(() => result.current.setQuery(query));

    expect(result.current.filtered.length).toBeGreaterThan(0);
    expect(
      result.current.filtered.every(({ offsetMins }) => offsetMins === mins),
    ).toBe(true);
  });

  it.each(["gmt+0", "gmt-0"])(
    "opens %s on UTC, which it names, ahead of the other zones at UTC+0",
    (query) => {
      const found = zonesMatching(query);

      expect(found[0]).toBe("UTC");
      expect(found).toContain("Africa/Abidjan");
    },
  );

  it.each([
    ["utc+", 1],
    ["+", 1],
    ["utc-", -1],
    ["-", -1],
  ])(
    "keeps every offset with the sign of %s while the digits go in",
    (query, sign) => {
      const { result } = renderOpen();
      act(() => result.current.setQuery(query));

      expect(
        result.current.filtered.every(
          ({ offsetMins }) =>
            offsetMins !== null &&
            (offsetMins === 0 || Math.sign(offsetMins) === sign),
        ),
      ).toBe(true);
      expect(result.current.filtered.length).toBeGreaterThan(0);
    },
  );

  it.each(["utc+5:", "+5:"])(
    "opens %s on UTC+5 while the minutes go in",
    (query) => {
      const { result } = renderOpen();
      act(() => result.current.setQuery(query));

      expect(result.current.filtered[0].offsetMins).toBe(300);
    },
  );

  it("reads no offset into a query that has not reached its sign", () => {
    expect(zonesMatching("ut")).toEqual(["UTC"]);
    expect(zonesMatching("u")).not.toContain("Pacific/Niue");
  });

  it("finds that country on a runtime with no name for the zone", () => {
    rejecting("longGeneric", () => {
      expect(zonesMatching("sri lanka")).toEqual(["Asia/Colombo"]);
    });
  });

  it("finds a zone by the name Intl gives it", () => {
    expect(zonesMatching("india standard")).toEqual([
      "Asia/Colombo",
      "Asia/Kolkata",
    ]);
  });

  it("finds a zone by its identifier", () => {
    rejecting("longGeneric", () => {
      expect(zonesMatching("america/argentina/buenos")).toEqual([
        "America/Argentina/Buenos_Aires",
      ]);
    });
  });

  it("finds a zone by a tzdb alias of it", () => {
    expect(zonesMatching("calcutta")).toEqual(["Asia/Kolkata"]);
  });

  it("finds a zone by a region only its aliases name", () => {
    expect(zonesMatching("arizona")).toEqual(["America/Phoenix"]);
  });

  it("finds a zone by a tzdb country alias of it", () => {
    expect(zonesMatching("prc")).toEqual(["Asia/Shanghai"]);
  });

  it("does not find a zone by a tzdb abbreviation linked to it", () => {
    expect(zonesMatching("mst")).toEqual([]);
    expect(zonesMatching("eet")).toEqual([]);
  });

  it("finds a zone by a name spelled with the accents it carries", () => {
    expect(zonesMatching("Bogotá")).toContain("America/Bogota");
  });

  it("finds a zone whose own name carries accents the query leaves out", () => {
    expect(zonesMatching("turkiye")).toEqual(["Europe/Istanbul"]);
  });

  it("puts a zone in the country the query names first", () => {
    expect(zonesMatching("india")[0]).toBe("Asia/Kolkata");
  });

  it("puts a place the query names in full before one it only starts", () => {
    expect(zonesMatching("guinea").slice(0, 2)).toEqual([
      "Africa/Conakry",
      "Africa/Bissau",
    ]);
  });

  it("puts a place the query starts before a zone it matches elsewhere", () => {
    expect(zonesMatching("santa")).toEqual([
      "America/Santarem",
      "America/Tijuana",
    ]);
  });

  it("finds a zone by a place no name or alias spells", () => {
    expect(zonesMatching("uk")[0]).toBe("Europe/London");
    expect(zonesMatching("britain")).toEqual(["Europe/London"]);
    expect(zonesMatching("western australia")).toEqual(["Australia/Perth"]);
  });

  it.each([
    ["china", "Asia/Shanghai"],
    ["china mainland", "Asia/Shanghai"],
    ["brazil", "America/Sao_Paulo"],
    ["russia", "Europe/Moscow"],
    ["hawaii", "Pacific/Honolulu"],
    ["us", "America/New_York"],
    ["america", "America/New_York"],
    ["korea", "Asia/Seoul"],
    ["canada", "America/Toronto"],
    ["mexico", "America/Mexico_City"],
    ["chile", "America/Santiago"],
    ["ecuador", "America/Guayaquil"],
    ["greenland", "America/Nuuk"],
    ["spain", "Europe/Madrid"],
    ["portugal", "Europe/Lisbon"],
    ["mongolia", "Asia/Ulaanbaatar"],
    ["australia", "Australia/Sydney"],
  ])("puts the zone most of %s keeps first", (query, tz) => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(Date.UTC(2026, 0, 15, 12)));

    expect(zonesMatching(query)[0]).toBe(tz);
  });

  it.each([
    ["eastern", "America/New_York"],
    ["central", "America/Chicago"],
    ["mountain", "America/Denver"],
    ["pacific", "America/Los_Angeles"],
    ["united", "America/New_York"],
    ["greenwich", "Europe/London"],
    ["gmt", "Europe/London"],
    ["central africa", "Africa/Maputo"],
  ])("opens %s on %s, ahead of places it only starts", (query, tz) => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(Date.UTC(2026, 0, 15, 12)));

    expect(zonesMatching(query)[0]).toBe(tz);
  });

  it.each([
    ["central european", "Europe/Paris"],
    ["eastern european", "Europe/Athens"],
    ["atlantic", "America/Halifax"],
    ["brasilia", "America/Sao_Paulo"],
    ["central australia", "Australia/Darwin"],
  ])("opens %s on %s in July", (query, tz) => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(Date.UTC(2026, 6, 15, 12)));

    expect(zonesMatching(query)[0]).toBe(tz);
  });

  it("finds a place followed by the word time", () => {
    expect(zonesMatching("hawaii time")[0]).toBe("Pacific/Honolulu");
    expect(zonesMatching("moscow time")[0]).toBe("Europe/Moscow");
  });

  it("finds an offset followed by the word time", () => {
    for (const query of ["gmt+1", "+5", "utc-9:30"]) {
      expect(zonesMatching(`${query} time`)).toEqual(zonesMatching(query));
      expect(zonesMatching(query).length).toBeGreaterThan(0);
    }
  });

  it("keeps finding a place while the word time is typed after it", () => {
    for (const query of ["hawaii t", "hawaii ti", "hawaii tim"]) {
      expect(zonesMatching(query)[0]).toBe("Pacific/Honolulu");
    }
  });

  it("keeps the word time where a zone's name carries it", () => {
    expect(zonesMatching("pacific time")).toEqual([
      "America/Los_Angeles",
      "America/Tijuana",
      "America/Vancouver",
    ]);
  });

  it("leaves out a zone naming the query inside a longer word", () => {
    const matched = zonesMatching("china");
    expect(matched).not.toContain("Asia/Bangkok");
    expect(matched).toContain("Asia/Shanghai");
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

  it("falls back to the location when longGeneric is missing", () => {
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
      expect(labelIn("Asia/Kolkata")).toBe("India Standard Time · Kolkata");
    });
  });

  it("labels the row with a name that ends in punctuation", () => {
    layingOutTheZoneName(oneParted(PUNCTUATED), () => {
      expect(labelIn("Europe/London")).toBe(`${PUNCTUATED} · London`);
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
      expect(labelIn("Asia/Kolkata")).toBe("India Standard Time · Kolkata");
    });
  });
});

describe("the Hermes that ships in apps/mobile/ios", () => {
  const LABELLED: Record<string, string> = {
    "Asia/Kathmandu": "Nepal Time · Kathmandu",
    "Asia/Kolkata": "India Standard Time · Kolkata",
    "Pacific/Auckland": "New Zealand Time · Auckland",
    "Australia/Perth": "Australian Western Standard Time · Perth",
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
        expect(labelIn("Asia/Kolkata")).toBe("India Standard Time · Kolkata");
      });
    });
  },
);

describe("a runtime writing a zone name that is not a string", () => {
  it("keeps its rows rather than throwing at the slice", () => {
    writingTheZoneNameAs(undefined, () => {
      const { result } = renderOpen();

      expect(result.current.items).toHaveLength(TIME_ZONE_CATALOG.length);
      expect(labelIn("Asia/Kolkata")).toBe("Kolkata");
    });
  });
});

describe("a runtime naming its locale as something other than a string", () => {
  it("keeps its rows rather than throwing at the guard", () => {
    namingTheLocale(Symbol("vi"), () => {
      const { result } = renderOpen();

      expect(result.current.items).toHaveLength(TIME_ZONE_CATALOG.length);
      expect(labelIn("Asia/Kolkata")).toBe("Kolkata");
    });
  });
});

describe("a runtime that writes an empty zone name", () => {
  it("falls back to the location rather than a bare separator", () => {
    blankingTheZoneName(() => {
      const { result } = renderOpen();

      const row = result.current.items.find(
        ({ tz }) => tz === "America/New_York",
      );
      expect(row?.labelLeft).toBe("New York");
      expect(row?.searchText).toContain("united states");
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
    "labels the row by location when the fallback is %s",
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
      expect(labelIn("Asia/Kolkata")).toBe("India Standard Time · Kolkata");
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

describe("reopening the picker", () => {
  it("shows every zone after a pick made through search", () => {
    const { result } = renderHook(() => useTimeZoneSelect({}));
    act(() => result.current.setOpen(true));
    act(() => result.current.setQuery("tokyo"));
    act(() => result.current.commit("Asia/Tokyo"));
    act(() => result.current.setOpen(true));
    expect(result.current.query).toBe("");
    expect(result.current.filtered).toEqual(result.current.items);
  });

  it("shows every zone after closing mid-search", () => {
    const { result } = renderHook(() => useTimeZoneSelect({}));
    act(() => result.current.setOpen(true));
    act(() => result.current.setQuery("tokyo"));
    act(() => result.current.setOpen(false));
    act(() => result.current.setOpen(true));
    expect(result.current.query).toBe("");
  });
});
