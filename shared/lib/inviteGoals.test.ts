import { describe, expect, test } from "bun:test";
import type { AmbassadorInviteGoalWithStatsDto } from "../client";
import {
  dateInputToEndOfDayIso,
  dateInputToStartOfDayIso,
  dateToInputValue,
  daysUntil,
  inviteGoalErrorMessage,
  inviteGoalIsUp,
  InviteGoalPhase,
  inviteGoalProgressPercent,
  inviteGoalStatus,
  inviteGoalSummary,
  oneMonthFromTodayDateInputValue,
  selectCurrentInviteGoal,
  selectInviteGoals,
  selectPastInviteGoals,
} from "./inviteGoals";

const goal = (
  id: number,
  startAt: string,
  dueAt: string,
  recruits = 0,
): AmbassadorInviteGoalWithStatsDto => ({
  goal: {
    id,
    targetSuccessfulRecruits: 5,
    startAt,
    dueAt,
    createdAt: startAt,
    updatedAt: startAt,
  },
  stats: {
    totalInvitesSent: 0,
    totalAcceptedInvites: 0,
    totalSuccessfulRecruits: recruits,
    goalSuccessfulRecruits: recruits,
  },
});

const now = new Date("2026-06-15T12:00:00Z");
const past = goal(1, "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z");
const olderPast = goal(2, "2025-01-01T00:00:00Z", "2025-02-01T00:00:00Z");
const active = goal(3, "2026-06-01T00:00:00Z", "2026-07-01T00:00:00Z");
const laterActive = goal(4, "2026-06-10T00:00:00Z", "2026-07-01T00:00:00Z");
const upcoming = goal(5, "2026-08-01T00:00:00Z", "2026-09-01T00:00:00Z");
const soonerUpcoming = goal(6, "2026-07-01T00:00:00Z", "2026-08-01T00:00:00Z");

describe("selectCurrentInviteGoal", () => {
  test("prefers the latest-started active goal", () => {
    expect(
      selectCurrentInviteGoal([past, active, laterActive, upcoming], now),
    ).toBe(laterActive);
  });

  test("falls back to the soonest upcoming goal", () => {
    expect(selectCurrentInviteGoal([past, upcoming, soonerUpcoming], now)).toBe(
      soonerUpcoming,
    );
  });

  test("falls back to the latest-due past goal", () => {
    expect(selectCurrentInviteGoal([olderPast, past], now)).toBe(past);
  });

  test("is undefined without goals", () => {
    expect(selectCurrentInviteGoal([], now)).toBeUndefined();
  });
});

describe("selectPastInviteGoals", () => {
  test("lists ended goals other than the current one, latest due first", () => {
    expect(
      selectPastInviteGoals({
        goals: [olderPast, active, past],
        currentGoal: active,
        now,
      }),
    ).toEqual([past, olderPast]);
    expect(
      selectPastInviteGoals({
        goals: [olderPast, past],
        currentGoal: past,
        now,
      }),
    ).toEqual([olderPast]);
  });
});

describe("inviteGoalIsUp", () => {
  test("is up with no goal, past its due date, or once the target is met", () => {
    expect(inviteGoalIsUp(undefined, now)).toBe(true);
    expect(inviteGoalIsUp(past, now)).toBe(true);
    expect(
      inviteGoalIsUp(
        goal(7, "2026-06-01T00:00:00Z", "2026-07-01T00:00:00Z", 5),
        now,
      ),
    ).toBe(true);
    expect(inviteGoalIsUp(active, now)).toBe(false);
  });
});

describe("inviteGoalProgressPercent", () => {
  test("is the share of the target recruited, capped at 100", () => {
    const withRecruits = (recruits: number) =>
      goal(7, "2026-06-01T00:00:00Z", "2026-07-01T00:00:00Z", recruits);
    expect(inviteGoalProgressPercent(withRecruits(0))).toBe(0);
    expect(inviteGoalProgressPercent(withRecruits(2))).toBe(40);
    expect(inviteGoalProgressPercent(withRecruits(8))).toBe(100);
  });
});

describe("inviteGoalStatus", () => {
  test("counts down to an upcoming goal's start", () => {
    expect(inviteGoalStatus(upcoming, now)).toEqual({
      phase: InviteGoalPhase.Upcoming,
      daysToStart: 47,
    });
  });

  test("is completed once the target is met, even after the due date", () => {
    expect(
      inviteGoalStatus(
        goal(7, "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z", 5),
        now,
      ),
    ).toEqual({ phase: InviteGoalPhase.Completed });
  });

  test("reports the recruits a past-due goal fell short by", () => {
    expect(inviteGoalStatus(past, now)).toEqual({
      phase: InviteGoalPhase.Ended,
      remainingRecruits: 5,
    });
  });

  test("counts the days and recruits left on an active goal", () => {
    expect(
      inviteGoalStatus(
        goal(8, "2026-06-01T00:00:00Z", "2026-07-01T00:00:00Z", 2),
        now,
      ),
    ).toEqual({
      phase: InviteGoalPhase.Active,
      daysLeft: 16,
      remainingRecruits: 3,
    });
  });
});

test("oneMonthFromTodayDateInputValue clamps to the last day of a shorter month", () => {
  expect(oneMonthFromTodayDateInputValue(new Date(2026, 0, 31))).toBe(
    "2026-02-28",
  );
  expect(oneMonthFromTodayDateInputValue(new Date(2028, 0, 31))).toBe(
    "2028-02-29",
  );
  expect(oneMonthFromTodayDateInputValue(new Date(2026, 2, 31))).toBe(
    "2026-04-30",
  );
});

test("dateToInputValue formats the local calendar date", () => {
  expect(dateToInputValue(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
});

test("daysUntil rounds a partial day up and never goes negative", () => {
  expect(daysUntil(new Date(now.getTime() + 1), now)).toBe(1);
  expect(daysUntil(new Date(now.getTime() - 1), now)).toBe(0);
});

test("inviteGoalErrorMessage rewrites overlap errors and passes others through", () => {
  expect(inviteGoalErrorMessage(new Error("Goal OVERLAPS another"))).toBe(
    "Those dates overlap with an existing invite goal.",
  );
  expect(inviteGoalErrorMessage(new Error("Target too low"))).toBe(
    "Target too low",
  );
});

test("selectInviteGoals pairs the current goal with the ones before it", () => {
  expect(selectInviteGoals([past, active, upcoming], now)).toEqual({
    currentGoal: active,
    pastGoals: [past],
  });
});

test("date inputs convert to the start and end of that local day", () => {
  const start = new Date(dateInputToStartOfDayIso("2026-03-09"));
  const end = new Date(dateInputToEndOfDayIso("2026-03-09"));

  expect(dateToInputValue(start)).toBe("2026-03-09");
  expect([start.getHours(), start.getMinutes(), start.getSeconds()]).toEqual([
    0, 0, 0,
  ]);
  expect(dateToInputValue(end)).toBe("2026-03-09");
  expect([end.getHours(), end.getMinutes(), end.getSeconds()]).toEqual([
    23, 59, 59,
  ]);
});

test("inviteGoalSummary sets apart each count in the phase's sentence", () => {
  expect(
    inviteGoalSummary({ phase: InviteGoalPhase.Upcoming, daysToStart: 1 }),
  ).toEqual(["This goal starts in ", { emphasis: "1 day" }, "."]);
  expect(inviteGoalSummary({ phase: InviteGoalPhase.Completed })).toEqual([
    "You have completed this invitation goal.",
  ]);
  expect(
    inviteGoalSummary({ phase: InviteGoalPhase.Ended, remainingRecruits: 3 }),
  ).toEqual([
    "This goal ended with ",
    { emphasis: "3 members" },
    " left to successfully invite.",
  ]);
  expect(
    inviteGoalSummary({
      phase: InviteGoalPhase.Active,
      daysLeft: 4,
      remainingRecruits: 1,
    }),
  ).toEqual([
    "You have ",
    { emphasis: "4 days" },
    " to successfully invite ",
    { emphasis: "1 more member" },
    ".",
  ]);
});
