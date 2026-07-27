import { useCallback, useState } from "react";
import {
  ActionDto,
  actionsComplete,
  FormResponseDto,
  SubmitFormDto,
  tasksOptout,
} from "../client";
import { useInvalidateVisibilityContext } from "./useVisibilityContext";

export interface ActionTaskPanelPropsShared {
  action: ActionDto;
  onCompleteAction: () => boolean | void | Promise<boolean | void>;
  onOptOutAction: () => void;
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

export const useTaskFormHandlers = ({
  action,
  onCompleteAction,
  onOptOutAction,
  guestMode = false,
}: Pick<
  ActionTaskPanelPropsShared,
  "action" | "onCompleteAction" | "onOptOutAction" | "guestMode"
>) => {
  const [actionError, setActionError] = useState<string | null>(null);
  const invalidateVisibilityContext = useInvalidateVisibilityContext();

  const handleComplete = useCallback(
    async (sendComplete: boolean = true) => {
      if (sendComplete && !guestMode) {
        const req = await actionsComplete({
          path: { id: action.id },
        });
        if (req.error) {
          setActionError("Something went wrong. Please try again.");
          return false;
        }
        // Bumped `completedActionCount`.
        invalidateVisibilityContext();
      }
      setActionError(null);
      return onCompleteAction();
    },
    [action, guestMode, onCompleteAction, invalidateVisibilityContext],
  );

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
    handleCompleteWithTracking: handleComplete,
    handleAbandonAction,
    actionError,
  };
};
