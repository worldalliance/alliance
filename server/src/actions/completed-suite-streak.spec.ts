import { completedSuiteStreak } from "./completed-suite-streak";
import type { SuiteOutcome } from "./missed-suite-streak";

const MEMBER = 1;

type Outcome = "completed" | "withdrawn" | "missed" | "unassigned";

function suite(
  suiteId: number,
  outcome: Outcome,
  { onboarding = false } = {},
): SuiteOutcome {
  return {
    suiteId,
    closedAt: new Date(2026, 0, suiteId),
    onboarding,
    actions: [{ id: suiteId * 10, name: `Task ${suiteId}` }],
    missedActionIdsByUser:
      outcome === "unassigned"
        ? new Map()
        : new Map([[MEMBER, outcome === "missed" ? [suiteId * 10] : []]]),
    completedUserIds:
      outcome === "completed" ? new Set([MEMBER]) : new Set<number>(),
  };
}

const streakOf = (outcomes: Outcome[]) =>
  completedSuiteStreak(
    outcomes.map((outcome, index) => suite(index + 1, outcome)),
    MEMBER,
  );

describe("completedSuiteStreak", () => {
  it("counts each completed suite once and identifies the run by its first suite", () => {
    expect(streakOf(["completed", "completed", "completed"])).toEqual({
      count: 3,
      runSuiteId: 1,
    });
  });

  it("resets on a missed suite and starts a new run after it", () => {
    expect(streakOf(["completed", "completed", "missed", "completed"])).toEqual(
      { count: 1, runSuiteId: 4 },
    );
    expect(streakOf(["completed", "missed"])).toEqual({
      count: 0,
      runSuiteId: null,
    });
  });

  it("leaves the run unchanged across withdrawn and unassigned suites", () => {
    expect(
      streakOf(["completed", "withdrawn", "unassigned", "completed"]),
    ).toEqual({ count: 2, runSuiteId: 1 });
  });

  it("skips the onboarding suite even when the member completed it", () => {
    expect(
      completedSuiteStreak(
        [suite(1, "completed", { onboarding: true }), suite(2, "completed")],
        MEMBER,
      ),
    ).toEqual({ count: 1, runSuiteId: 2 });
    expect(
      completedSuiteStreak(
        [suite(1, "completed"), suite(2, "missed", { onboarding: true })],
        MEMBER,
      ),
    ).toEqual({ count: 1, runSuiteId: 1 });
  });

  it("counts nothing for a member with no suites", () => {
    expect(completedSuiteStreak([], MEMBER)).toEqual({
      count: 0,
      runSuiteId: null,
    });
  });
});
