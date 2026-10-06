import {
  findMissedSuiteStanding,
  type SuiteOutcome,
  suspensionReasonKey,
  trailingMissedSuiteIds,
} from "./missed-suite-streak";

const MEMBER = 1;

function suite(
  suiteId: number,
  outcome: number[] | "unassigned",
  actions = [{ id: suiteId * 10, name: `Task ${suiteId}` }],
): SuiteOutcome {
  return {
    suiteId,
    closedAt: new Date(2026, 0, suiteId),
    onboarding: false,
    actions,
    missedActionIdsByUser:
      outcome === "unassigned" ? new Map() : new Map([[MEMBER, outcome]]),
    completedUserIds: new Set(),
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

describe("findMissedSuiteStanding", () => {
  it("numbers the miss within the run ending at the suite", () => {
    const suites = [suite(1, []), suite(2, [20]), suite(3, [30])];
    expect(
      findMissedSuiteStanding({ suites, userId: MEMBER, suiteId: 3 }),
    ).toEqual({
      missNumber: 2,
      missedActions: [{ id: 30, name: "Task 3" }],
      isFirstAssignedSuite: false,
    });
  });

  it("ignores suites after the one asked about", () => {
    const suites = [suite(1, [10]), suite(2, [20])];
    expect(
      findMissedSuiteStanding({ suites, userId: MEMBER, suiteId: 1 }),
    ).toMatchObject({ missNumber: 1, isFirstAssignedSuite: true });
  });

  it("names only the member's missed required actions", () => {
    const suites = [
      suite(
        1,
        [11],
        [
          { id: 10, name: "Done" },
          { id: 11, name: "Missed" },
        ],
      ),
    ];
    expect(
      findMissedSuiteStanding({ suites, userId: MEMBER, suiteId: 1 })
        ?.missedActions,
    ).toEqual([{ id: 11, name: "Missed" }]);
  });

  it("is null for a satisfied, unassigned, or unclosed suite", () => {
    const suites = [suite(1, []), suite(2, "unassigned")];
    for (const suiteId of [1, 2, 3]) {
      expect(
        findMissedSuiteStanding({ suites, userId: MEMBER, suiteId }),
      ).toBeNull();
    }
  });
});
