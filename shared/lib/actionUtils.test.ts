import type {
  ActionStatus,
  UserActionRelationDetailDto,
  UserActionRelationPillStatus,
  UserActionSummaryDto,
} from "../client/types.gen";
import {
  calculateAllCompletionData,
  calculateCompletionData,
} from "./actionUtils";

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
