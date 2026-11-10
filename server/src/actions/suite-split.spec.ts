import { memberActionPhase } from "@alliance/common/actionEvent";
import type { CohortExpression } from "@alliance/common/cohort-expression";
import { describe, expect, it } from "bun:test";
import type { ActionEvent } from "./entities/action-event.entity";
import type { ActionSuiteSplitArm } from "./entities/action-suite-split-arm.entity";
import {
  SplitVisibilityMode,
  type ActionSuiteSplit,
} from "./entities/action-suite-split.entity";
import {
  armEditRejection,
  armIneligibility,
  armRoutingExpressions,
  armScheduleMismatch,
  combinedSplitOf,
  hasSplitLaunched,
  isActionOptional,
  splitPrerequisiteActionIds,
} from "./suite-split";

const tag: CohortExpression = { type: "Tag", tagId: "t" };
const us: CohortExpression = { type: "USMember" };
const staff: CohortExpression = { type: "Staff" };

function schedule(start: string | null, deadline: string | null) {
  const events = [
    ...(start ? [{ date: new Date(start), newStatus: "member_action" }] : []),
    ...(deadline
      ? [{ date: new Date(deadline), newStatus: "resolution" }]
      : []),
  ];
  return { memberActionPhase: memberActionPhase(events as ActionEvent[]) };
}

function arm(
  overrides: Partial<ActionSuiteSplitArm> = {},
): ActionSuiteSplitArm {
  return {
    id: 1,
    splitId: 1,
    actionId: 1,
    position: 0,
    rule: null,
    optional: false,
    deletedAt: null,
    ...overrides,
  };
}

describe("armRoutingExpressions", () => {
  it("routes to the first matching arm and catches the rest in the last", () => {
    const routing = armRoutingExpressions({
      filterExpression: null,
      arms: [
        { actionId: 1, rule: tag },
        { actionId: 2, rule: us },
        { actionId: 3, rule: null },
      ],
    });
    expect(routing.get(1)).toEqual(tag);
    expect(routing.get(2)).toEqual({
      type: "AND",
      children: [{ type: "NOT", child: tag }, us],
    });
    expect(routing.get(3)).toEqual({
      type: "AND",
      children: [
        { type: "NOT", child: tag },
        { type: "NOT", child: us },
      ],
    });
  });

  it("limits every arm to the filter", () => {
    const routing = armRoutingExpressions({
      filterExpression: staff,
      arms: [
        { actionId: 1, rule: tag },
        { actionId: 2, rule: null },
      ],
    });
    expect(routing.get(1)).toEqual({ type: "AND", children: [staff, tag] });
    expect(routing.get(2)).toEqual({
      type: "AND",
      children: [staff, { type: "NOT", child: tag }],
    });
  });

  it("reaches every member with a lone catch-all and no filter", () => {
    const routing = armRoutingExpressions({
      filterExpression: null,
      arms: [{ actionId: 1, rule: null }],
    });
    expect(routing.get(1)).toEqual({ type: "AllMembers" });
  });
});

describe("splitPrerequisiteActionIds", () => {
  it("unions every arm's prerequisites", () => {
    expect(
      splitPrerequisiteActionIds([
        { prerequisiteActionIds: [5, 3] },
        { prerequisiteActionIds: [3, 1] },
      ]),
    ).toEqual([1, 3, 5]);
  });
});

describe("isActionOptional", () => {
  it("reads the arm's flag for an arm", () => {
    expect(
      isActionOptional({
        id: 1,
        optional: false,
        splitArms: [arm({ optional: true })],
      }),
    ).toBe(true);
  });

  it("reads the action's flag outside a split", () => {
    expect(isActionOptional({ id: 1, optional: true, splitArms: [] })).toBe(
      true,
    );
  });

  it("throws when the arms aren't loaded", () => {
    expect(() => isActionOptional({ id: 1, optional: false })).toThrow(
      "splitArms of action 1 not loaded",
    );
  });
});

describe("combinedSplitOf", () => {
  const split = (visibilityMode: SplitVisibilityMode) =>
    ({ id: 7, title: "Split", visibilityMode }) as ActionSuiteSplit;

  it("returns a combined split", () => {
    expect(
      combinedSplitOf({
        id: 1,
        splitArms: [arm({ split: split(SplitVisibilityMode.Combined) })],
      })?.id,
    ).toBe(7);
  });

  it("returns null for a per-arm split or no split", () => {
    expect(
      combinedSplitOf({
        id: 1,
        splitArms: [arm({ split: split(SplitVisibilityMode.PerArm) })],
      }),
    ).toBeNull();
    expect(combinedSplitOf({ id: 1, splitArms: [] })).toBeNull();
  });

  it("throws when the arm's split isn't loaded", () => {
    expect(() => combinedSplitOf({ id: 1, splitArms: [arm()] })).toThrow();
  });
});

describe("armIneligibility", () => {
  const regular = {
    name: "A",
    onboarding: false,
    publicOnly: false,
    isContractSigningAction: false,
    staffPreview: false,
  };

  it("allows a regular action", () => {
    expect(armIneligibility(regular)).toBeNull();
  });

  it.each([
    ["onboarding", "an onboarding action"],
    ["publicOnly", "a public-only action"],
    ["isContractSigningAction", "a contract-signing action"],
    ["staffPreview", "a staff-preview action"],
  ])("rejects %s", (flag, kind) => {
    expect(armIneligibility({ ...regular, [flag]: true })).toBe(
      `"A" is ${kind}, so it can't be an arm.`,
    );
  });
});

describe("armScheduleMismatch", () => {
  it("accepts arms sharing a launch and deadline", () => {
    expect(
      armScheduleMismatch([
        { name: "A", ...schedule("2026-01-01", "2026-01-08") },
        { name: "B", ...schedule("2026-01-01", "2026-01-08") },
      ]),
    ).toBeNull();
  });

  it("names the arm whose deadline differs", () => {
    expect(
      armScheduleMismatch([
        { name: "A", ...schedule("2026-01-01", "2026-01-08") },
        { name: "B", ...schedule("2026-01-01", "2026-01-09") },
      ]),
    ).toContain(`"B" doesn't share "A"'s`);
  });
});

describe("hasSplitLaunched", () => {
  it("is true once the member-action event takes effect", () => {
    const arms = [schedule("2026-01-01", null)];
    expect(hasSplitLaunched(arms, new Date("2025-12-31"))).toBe(false);
    expect(hasSplitLaunched(arms, new Date("2026-01-02"))).toBe(true);
  });

  it("is false with no member-action event", () => {
    expect(hasSplitLaunched([schedule(null, null)], new Date())).toBe(false);
  });
});

describe("armEditRejection", () => {
  const stored = { cohortExpression: tag, suiteId: 4 };

  it("allows resending the stored expression", () => {
    expect(
      armEditRejection({
        stored,
        next: { cohortExpression: { ...tag }, suiteId: 4, optional: false },
      }),
    ).toBeNull();
  });

  it("rejects a changed expression, optional, a new suite and a non-regular kind", () => {
    expect(
      armEditRejection({ stored, next: { cohortExpression: us } }),
    ).toContain("Edit the split's rules");
    expect(armEditRejection({ stored, next: { optional: true } })).toContain(
      "split's arm",
    );
    expect(armEditRejection({ stored, next: { suiteId: 5 } })).toContain(
      "another suite",
    );
    expect(armEditRejection({ stored, next: { publicOnly: true } })).toContain(
      "regular action",
    );
  });
});
