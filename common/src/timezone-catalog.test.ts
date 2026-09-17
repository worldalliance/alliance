import {
  TIME_ZONE_ALIASES,
  TIME_ZONE_CATALOG,
  TZDB_VERSION,
} from "./timezone-catalog.gen";

const identifiers = TIME_ZONE_CATALOG.map((entry) => entry.tz);
const rows = new Set(identifiers);

describe("the timezone catalog", () => {
  it("names the tzdb release it came from", () => {
    expect(TZDB_VERSION).toMatch(/^\d{4}[a-z]$/);
  });

  // A regeneration that reads an empty or truncated zone.tab still writes a
  // well-formed file, so only the count catches it.
  it("covers the whole of zone.tab", () => {
    expect(TIME_ZONE_CATALOG.length).toBeGreaterThan(400);
  });

  it("lists each identifier once, in order", () => {
    expect(rows.size).toBe(identifiers.length);
    expect(identifiers).toEqual([...identifiers].sort());
  });

  it("offers UTC", () => {
    expect(rows.has("UTC")).toBe(true);
  });

  it("lists no fixed-offset row", () => {
    expect(identifiers.filter((tz) => tz.startsWith("Etc/"))).toEqual([]);
  });

  it("names a place for every row", () => {
    const unnamed = TIME_ZONE_CATALOG.filter(
      ({ tz, city, country }) =>
        city === "" || country === "" || (country === null && tz !== "UTC"),
    );
    expect(unnamed).toEqual([]);
  });

  it("holds only identifiers this runtime resolves", () => {
    const unresolved = identifiers.filter((tz) => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return false;
      } catch {
        return true;
      }
    });
    expect(unresolved).toEqual([]);
  });
});

describe("the timezone aliases", () => {
  it("covers the whole of backward", () => {
    expect(TIME_ZONE_ALIASES.size).toBeGreaterThan(100);
  });

  it("points every alias at a row", () => {
    const dangling = [...TIME_ZONE_ALIASES].filter(
      ([, target]) => !rows.has(target),
    );
    expect(dangling).toEqual([]);
  });

  it("aliases nothing the catalog already lists", () => {
    const shadowed = [...TIME_ZONE_ALIASES.keys()].filter((name) =>
      rows.has(name),
    );
    expect(shadowed).toEqual([]);
  });

  it("resolves the names members are most likely to have saved", () => {
    expect(TIME_ZONE_ALIASES.get("US/Pacific")).toBe("America/Los_Angeles");
    expect(TIME_ZONE_ALIASES.get("Asia/Calcutta")).toBe("Asia/Kolkata");
    expect(TIME_ZONE_ALIASES.get("GMT")).toBe("UTC");
    expect(TIME_ZONE_ALIASES.get("Etc/UTC")).toBe("UTC");
  });

  // tzdb links these to a zone in another country. The first three name the
  // row they mean in a `#=` comment, the rest only in backzone.
  it("keeps an alias in the place its name says", () => {
    expect(TIME_ZONE_ALIASES.get("Iceland")).toBe("Atlantic/Reykjavik");
    expect(TIME_ZONE_ALIASES.get("Africa/Asmera")).toBe("Africa/Asmara");
    expect(TIME_ZONE_ALIASES.get("Pacific/Truk")).toBe("Pacific/Chuuk");
    expect(TIME_ZONE_ALIASES.get("Africa/Timbuktu")).toBe("Africa/Bamako");
    expect(TIME_ZONE_ALIASES.get("America/Coral_Harbour")).toBe(
      "America/Atikokan",
    );
    expect(TIME_ZONE_ALIASES.get("Antarctica/South_Pole")).toBe(
      "Antarctica/McMurdo",
    );
    expect(TIME_ZONE_ALIASES.get("Atlantic/Jan_Mayen")).toBe("Europe/Oslo");
    expect(TIME_ZONE_ALIASES.get("Pacific/Yap")).toBe("Pacific/Chuuk");
  });

  // A plain object would answer `toString` with a function.
  it("answers nothing for a name it does not carry", () => {
    expect(TIME_ZONE_ALIASES.get("toString")).toBeUndefined();
  });
});
