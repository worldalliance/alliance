import { MEMBER_ACTION_DEADLINE_PASSED } from "@alliance/common/actionActivity";
import { useCallback, useState } from "react";
import {
  ActionDto,
  FormResponseDto,
  SubmitFormDto,
  tasksOptout,
} from "../client";
import type { SubmitResult } from "../forms/formulaChoices";

export interface ActionTaskPanelPropsShared {
  action: ActionDto;
  onCompleteAction: () => boolean | void | Promise<boolean | void>;
  onOptOutAction: () => void;
  /** Called when the server refuses completion because the action's deadline passed. */
  onDeadlinePassed: () => void;
  disabled?: boolean;
  formResponse?: FormResponseDto;
  guestMode?: boolean;
}

/** A member's withdrawal from an action, as collected by the task form UI. */
export type ActionWithdrawal = {
  outOfTime: boolean;
  isMoral: boolean;
  reason: string;
  partialFormData: SubmitFormDto;
};

export function memberActionDeadlinePassed(result: SubmitResult): boolean {
  return (
    result.response.status === 403 &&
    result.error?.message === MEMBER_ACTION_DEADLINE_PASSED
  );
}

export const useTaskFormHandlers = ({
  action,
  onCompleteAction,
  onOptOutAction,
}: Pick<
  ActionTaskPanelPropsShared,
  "action" | "onCompleteAction" | "onOptOutAction"
>) => {
  const [actionError, setActionError] = useState<string | null>(null);

  const handleComplete = useCallback(() => {
    setActionError(null);
    return onCompleteAction();
  }, [onCompleteAction]);

  const handleAbandonAction = useCallback(
    async (withdrawal: ActionWithdrawal) => {
      const { outOfTime, isMoral, reason, partialFormData } = withdrawal;
      const req = await tasksOptout({
        path: { id: action.taskFormId! },
        body: {
          actionId: action.id,
          reason,
          outOfTime,
          isMoral,
          partialFormData,
        },
      });
      if (req.error) {
        setActionError("Something went wrong. Please try again.");
        return;
      }
      setActionError(null);
      onOptOutAction();
    },
    [action, onOptOutAction],
  );

  return {
    handleComplete,
    handleAbandonAction,
    actionError,
  };
};
