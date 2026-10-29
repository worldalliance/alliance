import {
  FORM_ALREADY_SUBMITTED,
  MEMBER_ACTION_DEADLINE_PASSED,
} from "@alliance/common/actionActivity";
import { ExceptionEvent } from "@alliance/common/analytics";
import { GUEST_HEADER } from "@alliance/common/guest";
import { SubmitFormDto } from "@alliance/shared/client";
import { useFormulaSourcesRefetch } from "@alliance/shared/forms/useFormulaSourcesRefetch";
import {
  formAlreadySubmitted,
  memberActionDeadlinePassed,
} from "@alliance/shared/lib/actionTaskPanel";
import { captureException } from "@alliance/shared/lib/analytics";
import { useTaskFormSubmission } from "@alliance/shared/lib/useTaskFormSubmission";
import { useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { getStoredGuestToken, setStoredGuestToken } from "../lib/guestSession";

/**
 * Submits a task form as the member or guest, resolving whether it was
 * accepted. It defers the completion: the caller marks the action completed
 * with `recordCompleted`.
 */
export function useSubmitTaskForm(params: {
  taskFormId: number;
  actionId: number;
  onDeadlinePassed: () => void;
  onAlreadySubmitted: () => void;
}) {
  const { taskFormId, actionId, onDeadlinePassed, onAlreadySubmitted } = params;
  const { isAuthenticated } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const { reload: historiesReload, refetchIfSourcesChanged } =
    useFormulaSourcesRefetch(setError);
  const { submit, recordCompleted: recordActionCompleted } =
    useTaskFormSubmission();

  const submitTaskForm = async (data: SubmitFormDto): Promise<boolean> => {
    setError(null);

    const storedGuestToken = isAuthenticated
      ? null
      : await getStoredGuestToken();
    const response = await submit({
      taskFormId,
      body: data,
      isMember: isAuthenticated,
      guestToken: storedGuestToken,
      deferCompletion: true,
    });
    if (response.response.ok) {
      if (!isAuthenticated) {
        const issuedGuestToken = response.response.headers.get(GUEST_HEADER);
        if (issuedGuestToken && issuedGuestToken !== storedGuestToken) {
          await setStoredGuestToken(issuedGuestToken);
        }
      }
      return true;
    }
    if (formAlreadySubmitted(response)) {
      setError(FORM_ALREADY_SUBMITTED);
      onAlreadySubmitted();
      return false;
    }
    if (memberActionDeadlinePassed(response)) {
      setError(MEMBER_ACTION_DEADLINE_PASSED);
      onDeadlinePassed();
      return false;
    }
    if (refetchIfSourcesChanged(response)) return false;
    console.error(response.error);
    captureException(ExceptionEvent.FormSubmitError, response.error, {
      actionId,
      $exception_fingerprint: "FormSubmitError",
    });
    setError("Failed to submit action.");
    return false;
  };

  /** Marks the action completed in cached lists, which can unmount the form. */
  const recordCompleted = () => {
    recordActionCompleted({ actionId, isMember: isAuthenticated });
  };

  return { submitTaskForm, recordCompleted, error, historiesReload };
}
