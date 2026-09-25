import { act, renderHook, waitFor } from "@testing-library/react";
import type { AmbassadorInviteGoalWithStatsDto } from "../client";
import {
  dateInputToEndOfDayIso,
  dateInputToStartOfDayIso,
} from "./inviteGoals";
import { NewInviteGoalError, useInviteGoalForms } from "./useInviteGoalForms";

const goal = (dueAt: string): AmbassadorInviteGoalWithStatsDto => ({
  goal: {
    id: 7,
    targetSuccessfulRecruits: 5,
    startAt: "2026-01-01T12:00:00Z",
    dueAt,
    createdAt: "2026-01-01T12:00:00Z",
    updatedAt: "2026-01-01T12:00:00Z",
  },
  stats: {
    totalInvitesSent: 0,
    totalAcceptedInvites: 0,
    totalSuccessfulRecruits: 0,
    goalSuccessfulRecruits: 0,
  },
});

const ongoing = goal("2099-01-01T12:00:00Z");
const ended = goal("2026-02-01T12:00:00Z");

const render = (params: {
  currentGoal?: AmbassadorInviteGoalWithStatsDto;
  createGoal?: jest.Mock;
  updateGoal?: jest.Mock;
}) => {
  const createGoal = params.createGoal ?? jest.fn(() => Promise.resolve());
  const updateGoal = params.updateGoal ?? jest.fn(() => Promise.resolve());
  const hook = renderHook(
    ({ currentGoal }) =>
      useInviteGoalForms({ currentGoal, createGoal, updateGoal }),
    { initialProps: { currentGoal: params.currentGoal } },
  );
  return { hook, createGoal, updateGoal };
};

describe("submitNewGoal", () => {
  test("refuses while the current goal is still running", () => {
    const { hook, createGoal } = render({ currentGoal: ongoing });
    act(() => hook.result.current.setGoalTarget("3"));

    expect(hook.result.current.submitNewGoal()).toEqual({
      ok: false,
      error: NewInviteGoalError.GoalActive,
    });
    expect(createGoal).not.toHaveBeenCalled();
  });

  test.each(["", "0", "1.5", "-2"])("refuses a target of %p", (target) => {
    const { hook, createGoal } = render({ currentGoal: ended });
    act(() => hook.result.current.setGoalTarget(target));

    expect(hook.result.current.submitNewGoal()).toEqual({
      ok: false,
      error: NewInviteGoalError.TargetTooLow,
    });
    expect(createGoal).not.toHaveBeenCalled();
  });

  test("refuses a date that doesn't parse", () => {
    const { hook, createGoal } = render({});
    act(() => {
      hook.result.current.setGoalTarget("3");
      hook.result.current.setGoalDueDate("");
    });

    expect(hook.result.current.submitNewGoal()).toEqual({
      ok: false,
      error: NewInviteGoalError.InvalidDate,
    });
    expect(createGoal).not.toHaveBeenCalled();
  });

  test("creates the goal over whole days and clears the target", async () => {
    const { hook, createGoal } = render({});
    act(() => {
      hook.result.current.setGoalTarget("3");
      hook.result.current.setGoalStartDate("2026-03-01");
      hook.result.current.setGoalDueDate("2026-04-01");
    });

    act(() => {
      expect(hook.result.current.submitNewGoal().ok).toBe(true);
    });

    expect(createGoal).toHaveBeenCalledWith({
      targetSuccessfulRecruits: 3,
      startAt: dateInputToStartOfDayIso("2026-03-01"),
      dueAt: dateInputToEndOfDayIso("2026-04-01"),
    });
    await waitFor(() => expect(hook.result.current.goalTarget).toBe(""));
  });

  test("shows an overlap rejection in words", async () => {
    const { hook } = render({
      createGoal: jest.fn(() => Promise.reject(new Error("Goals overlap"))),
    });
    act(() => hook.result.current.setGoalTarget("3"));

    act(() => {
      hook.result.current.submitNewGoal();
    });

    await waitFor(() =>
      expect(hook.result.current.goalFormMessage).toBe(
        "Those dates overlap with an existing invite goal.",
      ),
    );
  });
});

describe("editing the current goal", () => {
  test("fills the editor from the current goal", () => {
    const { hook } = render({ currentGoal: ongoing });

    expect(hook.result.current.editGoalTarget).toBe("5");
    expect(hook.result.current.editGoalDueDate).toMatch(/^2099-01-0[12]$/);
  });

  test("refills the editor and clears its message when the goal changes", () => {
    const { hook } = render({ currentGoal: ongoing });
    act(() => hook.result.current.saveEditGoalTarget("0"));
    expect(hook.result.current.goalEditMessage).not.toBeNull();

    hook.rerender({
      currentGoal: {
        ...ongoing,
        goal: { ...ongoing.goal, id: 8, targetSuccessfulRecruits: 9 },
      },
    });
    expect(hook.result.current.editGoalTarget).toBe("9");
    expect(hook.result.current.goalEditMessage).toBeNull();

    hook.rerender({ currentGoal: undefined });
    expect(hook.result.current.editGoalTarget).toBe("");
    expect(hook.result.current.editGoalStartDate).toBe("");
    expect(hook.result.current.editGoalDueDate).toBe("");
  });

  test("saves a changed date as that whole day", async () => {
    const { hook, updateGoal } = render({ currentGoal: ongoing });

    act(() => hook.result.current.changeEditGoalStartDate("2098-12-01"));
    act(() => hook.result.current.changeEditGoalDueDate("2099-02-01"));

    expect(hook.result.current.editGoalStartDate).toBe("2098-12-01");
    expect(hook.result.current.editGoalDueDate).toBe("2099-02-01");
    expect(updateGoal.mock.calls).toEqual([
      [
        {
          goalId: 7,
          body: { startAt: dateInputToStartOfDayIso("2098-12-01") },
        },
      ],
      [{ goalId: 7, body: { dueAt: dateInputToEndOfDayIso("2099-02-01") } }],
    ]);
    await waitFor(() => expect(hook.result.current.goalEditMessage).toBeNull());
  });

  test("saves a valid target and flags an invalid one without saving", async () => {
    const { hook, updateGoal } = render({ currentGoal: ongoing });

    act(() => hook.result.current.saveEditGoalTarget("0"));
    expect(hook.result.current.goalEditMessage).toBe(
      "Goal must be at least 1 successful invitation.",
    );
    expect(updateGoal).not.toHaveBeenCalled();

    act(() => hook.result.current.saveEditGoalTarget("8"));
    expect(updateGoal).toHaveBeenCalledWith({
      goalId: 7,
      body: { targetSuccessfulRecruits: 8 },
    });
    await waitFor(() => expect(hook.result.current.goalEditMessage).toBeNull());
  });

  test("shows a rejected save in words", async () => {
    const { hook } = render({
      currentGoal: ongoing,
      updateGoal: jest.fn(() => Promise.reject(new Error("Goals overlap"))),
    });

    act(() => hook.result.current.saveEditGoalTarget("8"));

    await waitFor(() =>
      expect(hook.result.current.goalEditMessage).toBe(
        "Those dates overlap with an existing invite goal.",
      ),
    );
  });
});
