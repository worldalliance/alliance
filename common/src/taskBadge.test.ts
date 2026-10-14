import {
  countsTowardTaskBadge,
  countTaskBadge,
  type TaskBadgeAction,
} from "./taskBadge";

const now = new Date("2026-10-05T12:00:00Z");

function eligible(): TaskBadgeAction & {
  viewer: NonNullable<TaskBadgeAction["viewer"]>;
} {
  return {
    status: "member_action",
    publicOnly: false,
    viewer: {
      assigned: true,
      dismissed: false,
      contractGap: false,
      canComplete: true,
      memberActionStarted: true,
      relation: "none",
      away: "not_away",
      staffPreview: false,
      deadlineAt: "2026-10-06T12:00:00Z",
    },
  };
}

function withViewer(
  patch: Partial<NonNullable<TaskBadgeAction["viewer"]>>,
): TaskBadgeAction {
  const action = eligible();
  return { ...action, viewer: { ...action.viewer, ...patch } };
}

describe("countsTowardTaskBadge", () => {
  it("counts an assigned, unfinished, open action", () => {
    expect(countsTowardTaskBadge(eligible(), now)).toBe(true);
  });

  it("counts an action with no deadline", () => {
    expect(countsTowardTaskBadge(withViewer({ deadlineAt: null }), now)).toBe(
      true,
    );
  });

  it("accepts a Date deadline as the server passes it", () => {
    expect(
      countsTowardTaskBadge(
        withViewer({ deadlineAt: new Date("2026-10-06T12:00:00Z") }),
        now,
      ),
    ).toBe(true);
  });

  it.each([
    ["a contract gap", { contractGap: true }],
    ["being away now", { away: "away_currently" }],
    ["having been away during the task", { away: "away_previously" }],
    ["being scheduled away during the task", { away: "away_later" }],
    ["a staff preview", { staffPreview: true }],
    ["dismissal", { dismissed: true }],
    ["completion", { relation: "completed" }],
    ["withdrawal", { relation: "withdrawn" }],
    ["no assignment", { assigned: false }],
    ["a blocked completion", { canComplete: false }],
    ["a phase not yet open", { memberActionStarted: false }],
    ["a deadline at now", { deadlineAt: now.toISOString() }],
    ["a deadline already passed", { deadlineAt: "2026-10-05T11:59:59Z" }],
  ] as const)("excludes %s", (_label, patch) => {
    expect(countsTowardTaskBadge(withViewer(patch), now)).toBe(false);
  });

  it("excludes an action no longer in its member-action phase", () => {
    expect(
      countsTowardTaskBadge({ ...eligible(), status: "office_action" }, now),
    ).toBe(false);
  });

  it("excludes public-only actions", () => {
    expect(
      countsTowardTaskBadge({ ...eligible(), publicOnly: true }, now),
    ).toBe(false);
  });

  it("excludes actions without a viewer status", () => {
    expect(
      countsTowardTaskBadge({ ...eligible(), viewer: undefined }, now),
    ).toBe(false);
  });
});

describe("countTaskBadge", () => {
  it("counts each eligible action once", () => {
    expect(
      countTaskBadge(
        [eligible(), eligible(), withViewer({ relation: "completed" })],
        now,
      ),
    ).toBe(2);
  });

  it("is zero for no actions", () => {
    expect(countTaskBadge([], now)).toBe(0);
  });
});
