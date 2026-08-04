import {
  buildTimeOfDayOptions,
  formatTimeForDisplay,
  toTimeInputValue,
  toWireTime,
} from "./timeUtils";

describe("formatTimeForDisplay", () => {
  it("reads the HH:MM:SS the API sends for a time column", () => {
    expect(formatTimeForDisplay("09:30:00")).toBe("9:30 AM");
    expect(formatTimeForDisplay("19:00:00")).toBe("7:00 PM");
    expect(formatTimeForDisplay("00:00:00")).toBe("12:00 AM");
  });

  it("still reads the HH:MM that form answers use", () => {
    expect(formatTimeForDisplay("09:30")).toBe("9:30 AM");
  });
});

describe("toWireTime", () => {
  it("canonicalizes to the form the time column round-trips in", () => {
    expect(toWireTime("09:30")).toBe("09:30:00");
    expect(toWireTime("9:30")).toBe("09:30:00");
    expect(toWireTime("09:30:00")).toBe("09:30:00");
  });

  it("is null for blank input, so clearing the field reaches the server", () => {
    expect(toWireTime("")).toBeNull();
    expect(toWireTime(null)).toBeNull();
    expect(toWireTime(undefined)).toBeNull();
  });

  it("is null rather than a guess for unparseable input", () => {
    expect(toWireTime("9am")).toBeNull();
    expect(toWireTime("25:00")).toBeNull();
    expect(toWireTime("10:75")).toBeNull();
  });
});

describe("toTimeInputValue", () => {
  it("drops the seconds an input[type=time] cannot round-trip", () => {
    expect(toTimeInputValue("09:30:00")).toBe("09:30");
    expect(toTimeInputValue("09:30")).toBe("09:30");
  });

  it("is empty for an unset time", () => {
    expect(toTimeInputValue(null)).toBe("");
    expect(toTimeInputValue("")).toBe("");
  });
});

describe("buildTimeOfDayOptions", () => {
  it("covers the whole day on the requested grid", () => {
    const options = buildTimeOfDayOptions(15);

    expect(options).toHaveLength(96);
    expect(options[0]).toEqual({ value: "00:00:00", label: "12:00 AM" });
    expect(options.at(-1)).toEqual({ value: "23:45:00", label: "11:45 PM" });
  });

  it("labels options for display and values for the wire", () => {
    expect(buildTimeOfDayOptions(30)).toContainEqual({
      value: "19:30:00",
      label: "7:30 PM",
    });
  });

  it("sorts lexicographically by value, so an off-grid time can be spliced in", () => {
    const values = buildTimeOfDayOptions(15).map((option) => option.value);

    expect([...values].sort()).toEqual(values);
  });
});
