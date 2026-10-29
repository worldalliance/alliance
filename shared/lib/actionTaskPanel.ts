import {
  FORM_ALREADY_SUBMITTED,
  MEMBER_ACTION_DEADLINE_PASSED,
} from "@alliance/common/actionActivity";
import { useCallback, useState } from "react";
import type { ActionDto, FormResponseDto, SubmitFormDto } from "../client";
import type { SubmitResult } from "../forms/formulaChoices";
import { shuffledAuthors } from "./actionUtils";
import { taskFlow } from "./copy";
import { useTaskFormSubmission } from "./useTaskFormSubmission";

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

export function formAlreadySubmitted(result: SubmitResult): boolean {
  return (
    result.response.status === 400 &&
    result.error?.message === FORM_ALREADY_SUBMITTED
  );
}

export const useTaskFormHandlers = ({
  action,
  onCompleteAction,
  onOptOutAction,
}: Pick<ActionTaskPanelPropsShared, "onCompleteAction" | "onOptOutAction"> & {
  action: Pick<ActionDto, "id" | "taskFormId">;
}) => {
  const [actionError, setActionError] = useState<string | null>(null);
  const { optOut } = useTaskFormSubmission();

  const handleComplete = useCallback(() => {
    setActionError(null);
    return onCompleteAction();
  }, [onCompleteAction]);

  const handleAbandonAction = useCallback(
    async (withdrawal: ActionWithdrawal) => {
      const { outOfTime, isMoral, reason, partialFormData } = withdrawal;
      const req = await optOut(action.taskFormId!, {
        actionId: action.id,
        reason,
        outOfTime,
        isMoral,
        partialFormData,
      });
      if (req.error) {
        setActionError("Something went wrong. Please try again.");
        return;
      }
      setActionError(null);
      onOptOutAction();
    },
    [action, onOptOutAction, optOut],
  );

  return {
    handleComplete,
    handleAbandonAction,
    actionError,
  };
};

export type TaskFlowContributor = {
  key: string;
  name: string;
  picture: string | null;
  role: string;
};

export function taskFlowContributors(
  action: Pick<ActionDto, "id" | "authors" | "reviewers">,
): TaskFlowContributor[] {
  return [
    ...shuffledAuthors(action).map((author) => ({
      key: `author-${author.id}`,
      name: author.displayName,
      picture: author.profilePicture,
      role: taskFlow.staff,
    })),
    ...action.reviewers.map((reviewer, i) => ({
      key: `reviewer-${i}`,
      name: reviewer.name,
      picture: null,
      role: taskFlow.expert,
    })),
  ];
}
