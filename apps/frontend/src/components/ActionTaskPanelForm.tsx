import {
  FormResponseDto,
  SubmitFormDto,
  tasksGetForm,
  tasksSubmitForm,
  tasksSubmitPublicForm,
} from "@alliance/shared/client";
import FormRenderer, {
  computeFormStorageKey,
} from "@alliance/sharedweb/forms/FormRenderer";
import { FormSchema } from "@alliance/common/forms/form-schema";
import Card from "@alliance/sharedweb/ui/Card";
import posthog from "posthog-js";
import { useMemo, useState, type RefObject } from "react";
import { useAuth } from "../lib/AuthContext";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import { useQuery } from "@tanstack/react-query";

interface ActionTaskPanelFormProps {
  taskFormId: number;
  onCompleteAction: ((sendComplete: boolean) => void) | null;
  onFormStarted: () => void;
  onAbandonAction: (
    outOfTime: boolean,
    reason: string,
    partialFormData: SubmitFormDto,
  ) => void;
  card?: boolean;
  actionId: number;
  disabled?: boolean;
  publicAction?: boolean;
  formResponse?: FormResponseDto;
  scrollContainerRef?: RefObject<HTMLElement | null>;
}

const ActionTaskPanelForm = ({
  taskFormId,
  onCompleteAction,
  onFormStarted,
  onAbandonAction,
  card = false,
  actionId,
  disabled = false,
  publicAction = false,
  formResponse,
  scrollContainerRef,
}: ActionTaskPanelFormProps) => {
  const [error, setError] = useState<string | null>(null);
  const { user, refreshUser } = useAuth();
  const {
    data: form,
    error: formError,
    isPending,
  } = useQuery({
    queryKey: ["form", taskFormId],
    queryFn: async () => {
      const response = await tasksGetForm({
        path: { id: taskFormId },
      });

      if (!response.data) {
        throw new Error(
          (response.error as Error)?.message ??
            "Unable to load form - please reload",
        );
      }

      return response.data;
    },
    enabled: !formResponse,
  });

  const handleSubmitForm = onCompleteAction
    ? async (data: SubmitFormDto) => {
        setError(null);

        const response = publicAction
          ? await tasksSubmitPublicForm({
              path: { id: taskFormId },
              body: data,
            })
          : await tasksSubmitForm({
              path: { id: taskFormId },
              body: data,
            });
        if (response.response.ok) {
          if (publicAction) {
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
        } else {
          if ((response.error as Error).message === "Form already submitted") {
            window.location.reload();
            return;
          }
          console.error(response.error);
          posthog.captureException(response.error, {
            event: "form_submit_error",
            properties: {
              actionId,
              $exception_fingerprint: "FormSubmitError",
            },
          });
          setError("Failed to submit action.");
        }
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
        actionId={actionId}
        completedFormResponse={formResponse}
        onSubmit={null}
        userId={formResponse.user?.id}
        user={formResponse.user}
        renderFormAsCompleted
      />
    );
  }

  if (!form) {
    if (isPending) {
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
          form={form.schema as unknown as FormSchema}
          id={form.id}
          actionId={actionId}
          onSubmit={handleSubmitForm}
          persistKey={String(taskFormId)}
          userId={user?.id}
          user={user}
          onFormStarted={onFormStarted}
          onAbandonAction={onAbandonAction}
          renderFormAsCompleted={disabled}
          publicAction={publicAction}
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
