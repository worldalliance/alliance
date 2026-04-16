import { useCallback, useState } from "react";
import {
  ActionDto,
  actionsComplete,
  FormResponseDto,
  SubmitFormDto,
  tasksOptout,
} from "../client";

export interface ActionTaskPanelPropsShared {
  action: ActionDto;
  onCompleteAction: () => boolean | void | Promise<boolean | void>;
  onOptOutAction: () => void;
  disabled?: boolean;
  formResponse?: FormResponseDto;
  guestMode?: boolean;
}

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
      }
      setActionError(null);
      return onCompleteAction();
    },
    [action, guestMode, onCompleteAction],
  );

  const handleAbandonAction = useCallback(
    async (
      outOfTime: boolean,
      reason: string,
      partialFormData: SubmitFormDto,
    ) => {
      const req = await tasksOptout({
        path: { id: action.taskFormId! },
        body: { actionId: action.id, reason, outOfTime, partialFormData },
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
