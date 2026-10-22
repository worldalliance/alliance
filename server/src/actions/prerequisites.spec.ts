import {
  arePrerequisitesReady,
  type PrerequisiteProgress,
} from "./prerequisites";

const NOW = new Date("2026-01-08T00:00:00Z");
const MEMBER = 1;

const open = (
  overrides: Partial<PrerequisiteProgress> = {},
): PrerequisiteProgress => ({
  deadline: new Date("2026-01-10T00:00:00Z"),
  terminalUserIds: new Set(),
  excludedUserIds: new Set(),
  ...overrides,
});

const ready = (prerequisites: PrerequisiteProgress[]) =>
  arePrerequisitesReady({ prerequisites, userId: MEMBER, now: NOW });

describe("arePrerequisitesReady", () => {
  it("is ready with no prerequisites", () => {
    expect(ready([])).toBe(true);
  });

  it("waits while the member has no outcome before the deadline", () => {
    expect(ready([open()])).toBe(false);
  });

  it("resolves early on a completion or withdrawal", () => {
    expect(ready([open({ terminalUserIds: new Set([MEMBER]) })])).toBe(true);
  });

  it("resolves early when the prerequisite excluded the member", () => {
    expect(ready([open({ excludedUserIds: new Set([MEMBER]) })])).toBe(true);
  });

  it("resolves at the deadline instant", () => {
    expect(ready([open({ deadline: NOW })])).toBe(true);
  });

  it("keeps waiting on a prerequisite without a deadline", () => {
    expect(ready([open({ deadline: null })])).toBe(false);
  });

  it("waits for every prerequisite", () => {
    expect(ready([open({ terminalUserIds: new Set([MEMBER]) }), open()])).toBe(
      false,
    );
  });

  it("ignores other members' outcomes", () => {
    expect(ready([open({ terminalUserIds: new Set([MEMBER + 1]) })])).toBe(
      false,
    );
  });
});
