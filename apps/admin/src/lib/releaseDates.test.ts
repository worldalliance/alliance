import {
  defaultReleaseDates,
  formatPacific,
  fromPacificInput,
  toPacificInput,
} from "./releaseDates";

const pacific = (input: string) => fromPacificInput(input)!;

describe("defaultReleaseDates", () => {
  it("launches the next Tuesday at 6 PM Pacific, deadline the Tuesday after at 11:59 PM", () => {
    const { launch, deadline } = defaultReleaseDates(
      pacific("2026-10-29T10:00"),
    );
    expect(toPacificInput(launch)).toBe("2026-11-03T18:00");
    expect(toPacificInput(deadline)).toBe("2026-11-10T23:59");
  });

  it("launches today on a Tuesday before 6 PM", () => {
    const { launch } = defaultReleaseDates(pacific("2026-11-03T17:59"));
    expect(toPacificInput(launch)).toBe("2026-11-03T18:00");
  });

  it("skips to next week on a Tuesday at or after 6 PM", () => {
    const { launch } = defaultReleaseDates(pacific("2026-11-03T18:00"));
    expect(toPacificInput(launch)).toBe("2026-11-10T18:00");
  });

  it("keeps 6 PM Pacific across the DST change", () => {
    const { launch } = defaultReleaseDates(pacific("2026-10-30T09:00"));
    expect(launch.toISOString()).toBe("2026-11-04T02:00:00.000Z");
    const summer = defaultReleaseDates(pacific("2026-07-01T09:00"));
    expect(summer.launch.toISOString()).toBe("2026-07-08T01:00:00.000Z");
  });

  it("uses the Pacific day, not the browser's, near midnight", () => {
    const { launch } = defaultReleaseDates(new Date("2026-11-04T05:00:00Z"));
    expect(toPacificInput(launch)).toBe("2026-11-10T18:00");
  });
});

describe("Pacific input round trip", () => {
  it("parses what it formats", () => {
    expect(toPacificInput(pacific("2026-03-08T03:30"))).toBe(
      "2026-03-08T03:30",
    );
  });

  it("rejects a malformed value", () => {
    expect(fromPacificInput("")).toBeNull();
    expect(fromPacificInput("2026-03-08")).toBeNull();
  });

  it("labels times as Pacific", () => {
    expect(formatPacific(pacific("2026-11-03T18:00"))).toBe(
      "Tue Nov 3, 6:00 PM PT",
    );
  });
});
