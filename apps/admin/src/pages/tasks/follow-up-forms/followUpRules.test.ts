import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  setSystemTime,
} from "bun:test";
import {
  draftOf,
  FollowUpStatus,
  followUpStatus,
  followUpWindow,
  isDraftDirty,
  saveNote,
  updateBodyOf,
  windowError,
} from "./followUpRules";

const now = new Date("2026-06-15T12:00:00Z");
beforeEach(() => setSystemTime(now));
afterEach(() => setSystemTime());
const cohort = { kind: "all" } as never;
const form = (over: Record<string, unknown>) =>
  ({
    id: 1,
    formId: 2,
    name: null,
    instructions: null,
    startDate: null,
    endDate: null,
    cohortExpression: cohort,
    ...over,
  }) as never;

describe("followUpStatus", () => {
  it("shows nobody a form with no cohort, even inside its dates", () => {
    expect(
      followUpStatus(
        form({ cohortExpression: null, startDate: "2026-06-01T00:00:00Z" }),
        now,
      ),
    ).toBe(FollowUpStatus.NoCohort);
  });
  it("never opens a form with no start date", () => {
    expect(followUpStatus(form({}), now)).toBe(FollowUpStatus.NoStart);
  });
  it("tells scheduled, open (no end date is open-ended) and ended apart", () => {
    expect(
      followUpStatus(form({ startDate: "2026-07-01T00:00:00Z" }), now),
    ).toBe(FollowUpStatus.Scheduled);
    expect(
      followUpStatus(form({ startDate: "2026-06-01T00:00:00Z" }), now),
    ).toBe(FollowUpStatus.Open);
    expect(
      followUpStatus(
        form({
          startDate: "2026-06-01T00:00:00Z",
          endDate: "2026-06-10T00:00:00Z",
        }),
        now,
      ),
    ).toBe(FollowUpStatus.Ended);
  });
});

describe("dates", () => {
  it("words the window in Pacific time", () => {
    expect(
      followUpWindow({
        startDate: "2026-06-01T16:00:00Z",
        endDate: "2026-06-08T16:00:00Z",
      }),
    ).toBe("Jun 1, 9:00 AM PT to Jun 8, 9:00 AM PT");
  });
  it("refuses an end before the start", () => {
    const base = draftOf(form({}), null);
    expect(
      windowError({
        ...base,
        startDate: "2026-06-08T00:00:00Z",
        endDate: "2026-06-01T00:00:00Z",
      }),
    ).not.toBeNull();
  });
});

describe("draft", () => {
  it("is clean when only the instant's spelling differs", () => {
    const a = draftOf(form({ startDate: "2026-06-01T16:00:00.000Z" }), cohort);
    expect(isDraftDirty(a, { ...a, startDate: "2026-06-01T16:00:00Z" })).toBe(
      false,
    );
    expect(isDraftDirty(a, { ...a, name: "x" })).toBe(true);
  });
  it("stores blank text as null", () => {
    const d = draftOf(form({}), cohort);
    expect(updateBodyOf({ ...d, name: "  ", instructions: " " })).toMatchObject(
      { name: null, instructions: null, startDate: null },
    );
  });
});

describe("saveNote", () => {
  const readable = { cohortUnreadable: false };
  it("says an empty cohort shows nobody and a missing start shows nobody yet", () => {
    const d = draftOf(form({ startDate: "2026-06-01T16:00:00Z" }), null);
    expect(saveNote(d, readable)).toContain("nobody sees");
    expect(
      saveNote({ ...d, cohortExpression: cohort, startDate: "" }, readable),
    ).toContain("no start date");
  });
  it("names the window otherwise", () => {
    const d = draftOf(form({ startDate: "2026-06-01T16:00:00Z" }), cohort);
    expect(saveNote(d, readable)).toContain(
      "Jun 1, 9:00 AM PT, with no end date",
    );
  });
  it("says saving is off, not that nobody sees it, when the cohort can't be read", () => {
    const d = draftOf(form({}), null);
    expect(saveNote(d, { cohortUnreadable: true })).toBe(
      "Saving is off: the stored cohort couldn't be read.",
    );
  });
});
