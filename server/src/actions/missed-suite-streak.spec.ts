import {
  type SuiteOutcome,
  suspensionReasonKey,
  trailingMissedSuiteIds,
} from "./missed-suite-streak";

const MEMBER = 1;

function suite(
  suiteId: number,
  outcome: number[] | "unassigned",
): SuiteOutcome {
  return {
    suiteId,
    closedAt: new Date(2026, 0, suiteId),
    missedActionIdsByUser:
      outcome === "unassigned" ? new Map() : new Map([[MEMBER, outcome]]),
  };
}

describe("trailingMissedSuiteIds", () => {
  it("counts a suite with any missed required action", () => {
    expect(trailingMissedSuiteIds([suite(1, [10])], MEMBER)).toEqual([1]);
  });

  it("resets on a satisfied suite, so an older run cannot suspend", () => {
    const suites = [
      suite(1, [10]),
      suite(2, [20]),
      suite(3, [30]),
      suite(4, []),
    ];
    expect(trailingMissedSuiteIds(suites, MEMBER)).toEqual([]);
  });

  it("keeps counting misses after a reset", () => {
    const suites = [suite(1, [10]), suite(2, []), suite(3, [30])];
    expect(trailingMissedSuiteIds(suites, MEMBER)).toEqual([3]);
  });

  it("leaves the run unchanged across suites the member was not assigned", () => {
    const suites = [
      suite(1, [10]),
      suite(2, "unassigned"),
      suite(3, [30]),
      suite(4, [40]),
    ];
    expect(trailingMissedSuiteIds(suites, MEMBER)).toEqual([1, 3, 4]);
  });
});

describe("suspensionReasonKey", () => {
  it("stays stable while the run grows", () => {
    expect(suspensionReasonKey([1, 3, 4])).toBe("s-1-3-4");
    expect(suspensionReasonKey([1, 3, 4, 5])).toBe("s-1-3-4");
  });
});
