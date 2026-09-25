import { R, type Result } from "@alliance/common/result";
import { useCallback, useEffect, useState } from "react";
import type { AmbassadorInviteGoalWithStatsDto } from "../client";
import {
  dateInputToEndOfDayIso,
  dateInputToStartOfDayIso,
  dateToInputValue,
  inviteGoalErrorMessage,
  inviteGoalIsUp,
  oneMonthFromTodayDateInputValue,
  todayDateInputValue,
} from "./inviteGoals";
import type { useAmbassadorInviteDashboard } from "./useAmbassadorInviteDashboard";

type Dashboard = ReturnType<typeof useAmbassadorInviteDashboard>;

export enum NewInviteGoalError {
  GoalActive = "goalActive",
  TargetTooLow = "targetTooLow",
  InvalidDate = "invalidDate",
}

const TARGET_TOO_LOW = "Goal must be at least 1 successful invitation.";

export const newInviteGoalErrorCopy: Record<
  NewInviteGoalError,
  { title: string; message: string }
> = {
  [NewInviteGoalError.GoalActive]: {
    title: "Goal already active",
    message: "You can set a new goal once your current goal is up.",
  },
  [NewInviteGoalError.TargetTooLow]: {
    title: "Goal needed",
    message: TARGET_TOO_LOW,
  },
  [NewInviteGoalError.InvalidDate]: {
    title: "Date needed",
    message: "Choose a start and end date.",
  },
};

const parseTarget = (value: string) => {
  const target = Number(value);
  return Number.isInteger(target) && target >= 1 ? target : undefined;
};

const isDateInput = (value: string) =>
  !Number.isNaN(new Date(`${value}T00:00:00`).getTime());

export function useInviteGoalForms(params: {
  currentGoal: AmbassadorInviteGoalWithStatsDto | undefined;
  createGoal: (
    body: Parameters<Dashboard["createGoal"]>[0],
  ) => Promise<unknown>;
  updateGoal: (
    update: Parameters<Dashboard["updateGoal"]>[0],
  ) => Promise<unknown>;
}) {
  const { currentGoal, createGoal, updateGoal } = params;

  const [goalTarget, setGoalTarget] = useState("");
  const [goalStartDate, setGoalStartDate] = useState(todayDateInputValue);
  const [goalDueDate, setGoalDueDate] = useState(
    oneMonthFromTodayDateInputValue,
  );
  const [editGoalStartDate, setEditGoalStartDate] = useState("");
  const [editGoalDueDate, setEditGoalDueDate] = useState("");
  const [editGoalTarget, setEditGoalTarget] = useState("");
  const [goalFormMessage, setGoalFormMessage] = useState<string | null>(null);
  const [goalEditMessage, setGoalEditMessage] = useState<string | null>(null);
  const showProminentGoalForm = inviteGoalIsUp(currentGoal);

  useEffect(() => {
    if (!currentGoal) {
      setEditGoalStartDate("");
      setEditGoalDueDate("");
      setEditGoalTarget("");
      return;
    }
    setEditGoalStartDate(dateToInputValue(currentGoal.goal.startAt));
    setEditGoalDueDate(dateToInputValue(currentGoal.goal.dueAt));
    setEditGoalTarget(String(currentGoal.goal.targetSuccessfulRecruits));
    setGoalEditMessage(null);
  }, [currentGoal]);

  const submitNewGoal = useCallback((): Result<void, NewInviteGoalError> => {
    if (!showProminentGoalForm) {
      return R.failure(NewInviteGoalError.GoalActive);
    }
    const target = parseTarget(goalTarget);
    if (target === undefined) {
      return R.failure(NewInviteGoalError.TargetTooLow);
    }
    if (!isDateInput(goalStartDate) || !isDateInput(goalDueDate)) {
      return R.failure(NewInviteGoalError.InvalidDate);
    }

    void createGoal({
      targetSuccessfulRecruits: target,
      startAt: dateInputToStartOfDayIso(goalStartDate),
      dueAt: dateInputToEndOfDayIso(goalDueDate),
    })
      .then(() => {
        setGoalTarget("");
        setGoalFormMessage(null);
      })
      .catch((err: Error) => {
        setGoalFormMessage(inviteGoalErrorMessage(err));
      });
    return R.success(undefined);
  }, [
    createGoal,
    goalDueDate,
    goalStartDate,
    goalTarget,
    showProminentGoalForm,
  ]);

  const updateCurrentGoal = useCallback(
    (update: {
      targetSuccessfulRecruits?: number;
      startDate?: string;
      dueDate?: string;
    }) => {
      if (!currentGoal) {
        return;
      }

      void updateGoal({
        goalId: currentGoal.goal.id,
        body: {
          ...(update.targetSuccessfulRecruits !== undefined && {
            targetSuccessfulRecruits: update.targetSuccessfulRecruits,
          }),
          ...(update.startDate !== undefined && {
            startAt: dateInputToStartOfDayIso(update.startDate),
          }),
          ...(update.dueDate !== undefined && {
            dueAt: dateInputToEndOfDayIso(update.dueDate),
          }),
        },
      })
        .then(() => {
          setGoalEditMessage(null);
        })
        .catch((err: Error) => {
          setGoalEditMessage(inviteGoalErrorMessage(err));
        });
    },
    [currentGoal, updateGoal],
  );

  const changeEditGoalStartDate = useCallback(
    (value: string) => {
      setEditGoalStartDate(value);
      updateCurrentGoal({ startDate: value });
    },
    [updateCurrentGoal],
  );

  const changeEditGoalDueDate = useCallback(
    (value: string) => {
      setEditGoalDueDate(value);
      updateCurrentGoal({ dueDate: value });
    },
    [updateCurrentGoal],
  );

  const saveEditGoalTarget = useCallback(
    (value: string) => {
      const target = parseTarget(value);
      if (target === undefined) {
        setGoalEditMessage(TARGET_TOO_LOW);
        return;
      }
      updateCurrentGoal({ targetSuccessfulRecruits: target });
    },
    [updateCurrentGoal],
  );

  return {
    goalTarget,
    setGoalTarget,
    goalStartDate,
    setGoalStartDate,
    goalDueDate,
    setGoalDueDate,
    goalFormMessage,
    submitNewGoal,
    showProminentGoalForm,
    editGoalStartDate,
    changeEditGoalStartDate,
    editGoalDueDate,
    changeEditGoalDueDate,
    editGoalTarget,
    setEditGoalTarget,
    saveEditGoalTarget,
    goalEditMessage,
  };
}
