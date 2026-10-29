import { MEMBER_ACTION_DEADLINE_PASSED } from "@alliance/common/actionActivity";
import { ExceptionEvent } from "@alliance/common/analytics";
import { FormSchema } from "@alliance/common/forms/form-schema";
import { FORMULA_SOURCES_CHANGED } from "@alliance/common/forms/formula-options";
import {
  type ActionDto,
  type FormResponseDto,
  type SubmitFormDto,
} from "@alliance/shared/client";
import { formulaSourcesChanged } from "@alliance/shared/forms/formulaChoices";
import { taskFlowMode } from "@alliance/shared/forms/useTaskFlow";
import {
  formAlreadySubmitted,
  memberActionDeadlinePassed,
  type ActionWithdrawal,
} from "@alliance/shared/lib/actionTaskPanel";
import { captureException } from "@alliance/shared/lib/analytics";
import { noop } from "@alliance/shared/lib/constants";
import { useLinkedGuestDraft } from "@alliance/shared/lib/useLinkedGuestDraft";
import { useTaskForm } from "@alliance/shared/lib/useTaskForm";
import { useTaskFormSubmission } from "@alliance/shared/lib/useTaskFormSubmission";
import { cn } from "@alliance/shared/styles/util";
import { computeFormStorageKey } from "@alliance/sharedweb/forms/FormRenderer";
import Card from "@alliance/sharedweb/ui/Card";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import posthog from "posthog-js";
import { useMemo, useRef, useState } from "react";
import { useAuth } from "../lib/AuthContext";
import TaskFlow from "./taskflow/TaskFlow";

interface ActionTaskPanelFormProps {
  taskFormId: number;
  onCompleteAction: (() => void) | null;
  onFormStarted: () => void;
  onAbandonAction?: (withdrawal: ActionWithdrawal) => void;
  onDeadlinePassed: () => void;
  card?: boolean;
  action: ActionDto;
  disabled?: boolean;
  publicAction?: boolean;
  formResponse?: FormResponseDto;
  redirectOnComplete?: boolean;
  onSubmitted?: (formResponse: FormResponseDto) => void;
  /** Editable but unsubmittable, and nothing typed outlives the page. */
  preview?: boolean;
}

const ActionTaskPanelForm = ({
  taskFormId,
  onCompleteAction,
  onFormStarted,
  onAbandonAction,
  onDeadlinePassed,
  card = false,
  action,
  disabled = false,
  publicAction = false,
  formResponse,
  redirectOnComplete = publicAction,
  onSubmitted,
  preview = false,
}: ActionTaskPanelFormProps) => {
  const [error, setError] = useState<string | null>(null);
  const {
    user,
    isAuthenticated,
    refreshUser,
    loading: authLoading,
  } = useAuth();
  const actionId = action.id;
  const { submit, recordCompleted } = useTaskFormSubmission();
  const {
    data: form,
    error: formError,
    isPending,
  } = useTaskForm(taskFormId, { enabled: !formResponse });

  const draftEnabled =
    !formResponse && !disabled && !publicAction && !preview && isAuthenticated;
  const { data: draftFormResponse } = useLinkedGuestDraft({
    taskFormId,
    actionId,
    enabled: draftEnabled,
  });

  const submittedRef = useRef<FormResponseDto | null>(null);

  const submitTaskForm = async (data: SubmitFormDto): Promise<boolean> => {
    setError(null);

    const response = await submit({
      taskFormId,
      body: data,
      isMember: isAuthenticated,
      deferCompletion: true,
    });
    if (response.response.ok) {
      submittedRef.current = response.data ?? null;
      if (typeof window !== "undefined" && form) {
        const storageKey = computeFormStorageKey({
          formId: form.id,
          instanceId: taskFormId,
        });
        window.localStorage.removeItem(storageKey);
      }
      return true;
    }
    if (formAlreadySubmitted(response)) {
      window.location.reload();
      return false;
    }
    if (memberActionDeadlinePassed(response)) {
      setError(MEMBER_ACTION_DEADLINE_PASSED);
      onDeadlinePassed();
      return false;
    }
    if (formulaSourcesChanged(response)) {
      setError(FORMULA_SOURCES_CHANGED);
      return false;
    }
    console.error(response.error);
    captureException(ExceptionEvent.FormSubmitError, response.error, {
      actionId,
      $exception_fingerprint: "FormSubmitError",
    });
    setError("Failed to submit action.");
    return false;
  };

  /** Marks the submitted action completed, which can unmount this form. */
  const completeAction = onCompleteAction
    ? () => {
        recordCompleted({ actionId, isMember: isAuthenticated });
        if (submittedRef.current) onSubmitted?.(submittedRef.current);
        if (user && !user.hasActiveContract) {
          //TODO: better handling of user refresh (things used to break if the user signed a contract in another tab then went back to the first one)
          refreshUser();
        }
        onCompleteAction();
        if (!isAuthenticated && redirectOnComplete) {
          window.location.href = "/actions/completed";
        }
      }
    : null;

  const { distinctId, sessionReplayUrl } = useMemo(() => {
    return {
      distinctId: posthog.get_distinct_id(),
      sessionReplayUrl: posthog.get_session_replay_url(),
    };
  }, []);

  const Wrapper = card ? Card : "div";
  const wrapperClassName = card ? "p-4 sm:p-6" : "flex flex-col gap-y-2";
  const flowMode = taskFlowMode({
    submitted: !!formResponse,
    disabled: !!disabled,
    preview,
    completable: !!completeAction,
  });
  const renderFlow = (flowForm: {
    schema: FormSchema;
    formId: number;
    formSnapshotId: number;
  }) => (
    <Wrapper className={wrapperClassName}>
      <TaskFlow
        key={`${actionId}:${taskFormId}:${flowMode}`}
        action={action}
        {...flowForm}
        mode={flowMode}
        completedFormResponse={formResponse}
        publicAction={publicAction}
        taskFormId={taskFormId}
        draftFormResponse={draftFormResponse}
        phDistinctId={distinctId}
        sessionReplayUrl={sessionReplayUrl}
        submitTaskForm={submitTaskForm}
        submitError={error}
        onCompleteAction={completeAction ?? noop}
        onFormStarted={onFormStarted}
        onAbandonAction={onAbandonAction}
      />
    </Wrapper>
  );

  const responseSchema = formResponse
    ? (formResponse.schemaSnapshot as unknown as FormSchema)
    : null;

  if (formResponse && responseSchema) {
    return renderFlow({
      schema: responseSchema,
      formId: formResponse.formId,
      formSnapshotId: formResponse.formSnapshotId,
    });
  }

  const schema = form?.schema as unknown as FormSchema | undefined;
  // The form seeds its timezone fields from `user` at mount.
  const waitsForUser =
    authLoading &&
    !!schema?.pages.some((page) =>
      page.fields.some((item) => item.kind === "timezone"),
    );

  if (!form || !schema || waitsForUser) {
    if (isPending || waitsForUser) {
      return (
        <div
          className={cn(
            "flex flex-col justify-center items-center",
            card && "p-6 border border-zinc-200",
          )}
        >
          <Spinner />
        </div>
      );
    } else {
      return (
        <div
          className={cn(
            "flex flex-col justify-center items-center text-red-500",
            card && "p-6 border border-zinc-200",
          )}
        >
          <p>Error loading form</p>
          <p>{formError?.message ?? "Unable to load form - please reload"}</p>
        </div>
      );
    }
  }

  return renderFlow({
    schema,
    formId: form.id,
    formSnapshotId: form.formSnapshotId,
  });
};

export default ActionTaskPanelForm;
