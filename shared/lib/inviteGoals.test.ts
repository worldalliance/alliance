import { describe, expect, test } from "bun:test";
import type { AmbassadorInviteGoalWithStatsDto } from "../client";
import {
  dateInputToEndOfDayIso,
  dateInputToStartOfDayIso,
  dateToInputValue,
  daysUntil,
  inviteGoalErrorMessage,
  inviteGoalIsUp,
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
