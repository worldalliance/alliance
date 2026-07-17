import type {
  ActionStatus,
  UserActionRelationDetailDto,
  UserActionRelationPillStatus,
  UserActionSummaryDto,
} from "../client/types.gen";
import {
  calculateAllCompletionData,
  calculateCompletionData,
  canCompleteAction,
  deadlineHasPassed,
  isCurrentlyCompletedAction,
  shouldCompleteAction,
  showActionInSidebarList,
  withOptimisticDismissal,
  withOptimisticRelation,
} from "./actionUtils";
import { makeAction, makeLegacyAction, makeViewer } from "./testFixtures";

function rel(
  actionId: number,
  status: UserActionRelationPillStatus,
): UserActionRelationDetailDto {
  return { actionId, status };
}

function summary(
  id: number,
  status: ActionStatus,
  memberActionDeadline: number | null,
): UserActionSummaryDto {
  return {
    id,
    name: `action ${id}`,
    status,
    weekNumber: null,
    allMembersParticipating: false,
    memberActionDeadline,
  };
}

describe("viewer-based action predicates", () => {
  it("resolves the plain assigned-todo case on both paths", () => {
    for (const action of [makeAction(), makeLegacyAction()]) {
      expect(canCompleteAction(action)).toBe(true);
      expect(shouldCompleteAction(action)).toBe(true);
      expect(showActionInSidebarList(action)).toBe(true);
      expect(isCurrentlyCompletedAction(action)).toBe(false);
    }
  });

  it("keeps a dismissed action completable but out of home lists", () => {
    const action = makeAction({
      viewer: makeViewer({ dismissed: true }),
    });
    expect(canCompleteAction(action)).toBe(true);
    expect(shouldCompleteAction(action)).toBe(false);
    expect(showActionInSidebarList(action)).toBe(false);
  });

  it("blocks completion once the viewer has a terminal relation", () => {
    expect(
      canCompleteAction(
        makeAction({ viewer: makeViewer({ relation: "withdrawn" }) }),
      ),
    ).toBe(false);
    expect(
      canCompleteAction(
        makeAction({ viewer: makeViewer({ relation: "completed" }) }),
      ),
    ).toBe(false);
  });

  it("gates completion on the member-action phase having started", () => {
    const action = makeAction({
      status: "planned",
      viewer: makeViewer({ memberActionStarted: false }),
    });
    expect(canCompleteAction(action)).toBe(false);
  });

  it("lets an unassigned member complete without listing the task", () => {
    const action = makeAction({ viewer: makeViewer({ assigned: false }) });
    expect(canCompleteAction(action)).toBe(true);
    expect(shouldCompleteAction(action)).toBe(false);
  });

  it("keeps away members' tasks out of the sidebar", () => {
    const action = makeAction({
      viewer: makeViewer({ away: "away_currently" }),
    });
    expect(shouldCompleteAction(action)).toBe(true);
    expect(showActionInSidebarList(action)).toBe(false);
  });

  it("marks a completed member-action as currently completed", () => {
    const action = makeAction({
      viewer: makeViewer({ relation: "completed", display: "completed" }),
    });
    expect(isCurrentlyCompletedAction(action)).toBe(true);
  });

  it("derives deadlineHasPassed from viewer.memberActionStarted", () => {
    expect(
      deadlineHasPassed(
        makeAction({ status: "resolution", viewer: makeViewer() }),
      ),
    ).toBe(true);
    expect(
      deadlineHasPassed(
        makeAction({
          status: "planned",
          viewer: makeViewer({ memberActionStarted: false }),
        }),
      ),
    ).toBe(false);
    expect(deadlineHasPassed(makeAction())).toBe(false);
  });

  it("supports shouldCompleteAfterDeadline past the deadline", () => {
    const action = makeAction({
      status: "resolution",
      shouldCompleteAfterDeadline: true,
    });
    expect(shouldCompleteAction(action)).toBe(true);
    // ...but the sidebar still drops it once the deadline passed.
    expect(showActionInSidebarList(action)).toBe(false);
  });

  it("matches the legacy fallback on dismissal semantics", () => {
    const action = makeLegacyAction({
      userRelation: "dismissed",
      // Legacy servers force shouldParticipate=false on dismissal.
      shouldParticipate: false,
    });
    expect(canCompleteAction(action)).toBe(true);
    expect(shouldCompleteAction(action)).toBe(false);
    expect(showActionInSidebarList(action)).toBe(false);
  });
});

// The optimistic patches must flip the predicates the same way the next real
// server payload would — on both the viewer and legacy paths.
describe("optimistic cache patches", () => {
  it("makes an optimistic completion read as completed on both paths", () => {
    for (const base of [makeAction(), makeLegacyAction()]) {
      const action = withOptimisticRelation(base, "completed");
      expect(canCompleteAction(action)).toBe(false);
      expect(shouldCompleteAction(action)).toBe(false);
      expect(isCurrentlyCompletedAction(action)).toBe(true);
    }
  });

  it("makes an optimistic opt-out read as withdrawn on both paths", () => {
    for (const base of [makeAction(), makeLegacyAction()]) {
      const action = withOptimisticRelation(base, "declined");
      expect(canCompleteAction(action)).toBe(false);
      expect(shouldCompleteAction(action)).toBe(false);
      expect(isCurrentlyCompletedAction(action)).toBe(false);
    }
  });

  it("mirrors the terminal relation into viewer.display", () => {
    expect(
      withOptimisticRelation(makeAction(), "completed").viewer?.display,
    ).toBe("completed");
    expect(
      withOptimisticRelation(makeAction(), "declined").viewer?.display,
    ).toBe("wont_complete");
  });

  it("hides an optimistic dismissal from home lists but keeps it completable", () => {
    for (const base of [makeAction(), makeLegacyAction()]) {
      const action = withOptimisticDismissal(base);
      expect(canCompleteAction(action)).toBe(true);
      expect(shouldCompleteAction(action)).toBe(false);
      expect(showActionInSidebarList(action)).toBe(false);
    }
  });
});

describe("calculateCompletionData", () => {
  it("buckets users by completion, restricted to the filtered actions", () => {
    const result = calculateCompletionData({
      filteredActionIds: [10],
      userActionRelations: {
        1: [rel(10, "completed")],
        2: [rel(10, "todo")],
        // action 11 is outside the filter, so only the completed one counts
        3: [rel(10, "completed"), rel(11, "todo")],
        // `away` maps to "none" and produces no entry at all
        4: [rel(10, "away")],
      },
    });

    expect(result.completedAllCurrentActions).toEqual({
      1: true,
      2: false,
      3: true,
    });
    expect(result.nTotal).toBe(3);
    expect(result.nCompleted).toBe(2);
  });

  it("treats any incomplete status as not-completed-all (incomplete wins)", () => {
    const result = calculateCompletionData({
      filteredActionIds: [10, 12],
      userActionRelations: {
        1: [rel(10, "completed"), rel(12, "todo")],
      },
    });

    expect(result.completedAllCurrentActions).toEqual({ 1: false });
    expect(result.nTotal).toBe(1);
    expect(result.nCompleted).toBe(0);
  });

  it("does not count a missed deadline as outstanding work", () => {
    const result = calculateCompletionData({
      filteredActionIds: [10, 11],
      userActionRelations: {
        // missed the deadline on 11 but completed 10 → still caught up
        1: [rel(10, "completed"), rel(11, "missed_deadline")],
        // only a missed deadline → nothing outstanding, omitted entirely
        2: [rel(11, "missed_deadline")],
      },
    });

    expect(result.completedAllCurrentActions).toEqual({ 1: true });
    expect(result.nTotal).toBe(1);
    expect(result.nCompleted).toBe(1);
  });

  it("omits users with only no-op statuses", () => {
    const result = calculateCompletionData({
      filteredActionIds: [10],
      userActionRelations: {
        1: [rel(10, "not_required")],
        2: [rel(10, "optional_task")],
      },
    });

    expect(result.completedAllCurrentActions).toEqual({});
    expect(result.nTotal).toBe(0);
    expect(result.nCompleted).toBe(0);
  });
});

describe("calculateAllCompletionData", () => {
  it("reports the current window when there are active actions", () => {
    const result = calculateAllCompletionData({
      actions: [
        summary(10, "member_action", 1000),
        summary(11, "member_action", 1_000_000_000),
      ],
      users: [
        { userId: 1, relations: [rel(10, "completed"), rel(11, "todo")] },
        { userId: 2, relations: [rel(10, "todo")] },
      ],
      // tiny window so only the earliest-deadline action (10) is "current"
      actionDeadlineWindowMs: 1,
    });

    expect(result.previous).toBeUndefined();
    expect(result.current).toBeDefined();
    expect(result.current?.nActions).toBe(1);
    expect(result.current?.completedAllCurrentActions).toEqual({
      1: true,
      2: false,
    });
    expect(result.current?.nTotal).toBe(2);
    expect(result.current?.nCompleted).toBe(1);
  });

  it("reports an empty current window when no action has relations", () => {
    const result = calculateAllCompletionData({
      actions: [summary(10, "member_action", 1000)],
      users: [],
      actionDeadlineWindowMs: 1,
    });

    expect(result.previous).toBeUndefined();
    expect(result.current).toBeDefined();
    expect(result.current?.nTotal).toBe(0);
  });
});
