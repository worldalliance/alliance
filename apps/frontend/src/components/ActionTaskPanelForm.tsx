import { MEMBER_ACTION_DEADLINE_PASSED } from "@alliance/common/actionActivity";
import { ExceptionEvent } from "@alliance/common/analytics";
import {
  flattenPageItems,
  FormSchema,
} from "@alliance/common/forms/form-schema";
import { FORMULA_SOURCES_CHANGED } from "@alliance/common/forms/formula-options";
import {
  FormResponseDto,
  SubmitFormDto,
  tasksGetLinkedGuestDraft,
  tasksSubmitForm,
  tasksSubmitPublicForm,
} from "@alliance/shared/client";
import { formulaSourcesChanged } from "@alliance/shared/forms/formulaChoices";
import {
  memberActionDeadlinePassed,
  type ActionWithdrawal,
} from "@alliance/shared/lib/actionTaskPanel";
import { captureException } from "@alliance/shared/lib/analytics";
import { useTaskForm } from "@alliance/shared/lib/useTaskForm";
import { useInvalidateVisibilityContext } from "@alliance/shared/lib/useVisibilityContext";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import FormRenderer, {
  computeFormStorageKey,
} from "@alliance/sharedweb/forms/FormRenderer";
import Card from "@alliance/sharedweb/ui/Card";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { useQuery } from "@tanstack/react-query";
import posthog from "posthog-js";
import { useMemo, useState, type RefObject } from "react";
import { useAuth } from "../lib/AuthContext";

interface ActionTaskPanelFormProps {
  taskFormId: number;
  onCompleteAction: ((sendComplete: boolean) => void) | null;
  onFormStarted: () => void;
  onAbandonAction?: (withdrawal: ActionWithdrawal) => void;
  onDeadlinePassed: () => void;
  card?: boolean;
  actionId: number;
  disabled?: boolean;
  publicAction?: boolean;
  formResponse?: FormResponseDto;
  redirectOnComplete?: boolean;
  onSubmitted?: (formResponse: FormResponseDto) => void;
  scrollContainerRef?: RefObject<HTMLElement | null>;
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
  actionId,
  disabled = false,
  publicAction = false,
  formResponse,
  redirectOnComplete = publicAction,
  onSubmitted,
  scrollContainerRef,
  preview = false,
}: ActionTaskPanelFormProps) => {
  const [error, setError] = useState<string | null>(null);
  const {
    user,
    isAuthenticated,
    refreshUser,
    loading: authLoading,
  } = useAuth();
  const invalidateVisibilityContext = useInvalidateVisibilityContext();
  const {
    data: form,
    error: formError,
    isPending,
  } = useTaskForm(taskFormId, { enabled: !formResponse });

  const draftEnabled =
    !formResponse && !disabled && !publicAction && !preview && isAuthenticated;
  const { data: draftFormResponse } = useQuery({
    queryKey: ["linkedGuestDraft", taskFormId],
    queryFn: async () => {
      const response = await tasksGetLinkedGuestDraft({
        path: { id: taskFormId },
      });
      return response.data?.draft ?? null;
    },
    enabled: draftEnabled,
    retry: false,
  });

  const handleSubmitForm = onCompleteAction
    ? async (data: SubmitFormDto): Promise<boolean> => {
        setError(null);

        const response = isAuthenticated
          ? await tasksSubmitForm({
              path: { id: taskFormId },
              body: data,
            })
          : await tasksSubmitPublicForm({
              path: { id: taskFormId },
              body: data,
            });
        if (response.response.ok) {
          if (isAuthenticated) {
            // Bumped `completedActionCount` (and `firstContractSignedAt` for a
            // contract-signing action).
            invalidateVisibilityContext();
          }
          if (response.data) {
            onSubmitted?.(response.data);
          }
          if (!isAuthenticated && redirectOnComplete) {
            window.location.href = "/actions/completed";
          }
          if (typeof window !== "undefined" && form) {
            const storageKey = computeFormStorageKey({
              formId: form.id,
              instanceId: taskFormId,
            });
            window.localStorage.removeItem(storageKey);
          }
          if (user && !user.hasActiveContract) {
            //TODO: better handling of user refresh (things used to break if the user signed a contract in another tab then went back to the first one)
            refreshUser();
          }
          onCompleteAction(false); //tasksSubmitForm handles completion here
          return true;
        }
        if (response.error?.message === "Form already submitted") {
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
      }
    : null;

  const { distinctId, sessionReplayUrl } = useMemo(() => {
    return {
      distinctId: posthog.get_distinct_id(),
      sessionReplayUrl: posthog.get_session_replay_url(),
    };
  }, []);

  if (formResponse) {
    return (
      <FormRenderer
        form={formResponse.schemaSnapshot as unknown as FormSchema}
        id={formResponse.formId}
        formSnapshotId={formResponse.formSnapshotId}
        actionId={actionId}
        completedFormResponse={formResponse}
        onSubmit={null}
        userId={formResponse.user?.id}
        user={formResponse.user}
        renderFormAsCompleted
      />
    );
  }

  const schema = form?.schema as unknown as FormSchema | undefined;
  // The form seeds its timezone fields from `user` at mount.
  const waitsForUser =
    authLoading &&
    !!schema?.pages.some((page) =>
      flattenPageItems(page.fields).some((item) => item.kind === "timezone"),
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

  const Wrapper = card ? Card : "div";

  return (
    <Wrapper className={card ? "p-4 sm:p-6" : "flex flex-col gap-y-2"}>
      <div>
        <FormRenderer
          form={schema}
          id={form.id}
          formSnapshotId={form.formSnapshotId}
          actionId={actionId}
          onSubmit={handleSubmitForm}
          persistKey={preview ? null : String(taskFormId)}
          userId={user?.id}
          user={user}
          userLoading={authLoading}
          loadCurrentUserLocation={!!user && isAuthenticated}
          onFormStarted={onFormStarted}
          onAbandonAction={onAbandonAction}
          renderFormAsCompleted={disabled}
          publicAction={publicAction}
          draftFormResponse={draftFormResponse}
          syncDraftToServer={isAuthenticated && !publicAction}
          phDistinctId={distinctId}
          sessionReplayUrl={sessionReplayUrl}
          scrollContainerRef={scrollContainerRef}
        />
      </div>
      {error && (
        <Card style={CardStyle.White} className="!border-red-400 !bg-red-50">
          <div className="text-red-500">{error}</div>
        </Card>
      )}
    </Wrapper>
  );
};

export default ActionTaskPanelForm;
