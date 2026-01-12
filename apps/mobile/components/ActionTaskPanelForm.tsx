import {
  SubmitFormDto,
  tasksGetForm,
  tasksSubmitForm,
  tasksSubmitPublicForm,
} from "@alliance/shared/client";
import { useCallback, useMemo, useState } from "react";
import FormRenderer from "./forms/FormRenderer";
import { FormSchema } from "@alliance/shared/forms/formschema";
import { ActivityIndicator, View } from "react-native";
import { usePostHog } from "posthog-react-native";
import SuccessOverlay from "./SuccessOverlay";
import Text from "./system/Text";
import { useQuery } from "@tanstack/react-query";

interface ActionTaskPanelFormProps {
  taskFormId: number;
  onCompleteAction: ((sendComplete: boolean) => void) | null;
  onFormStarted: () => void;
  onAbandonAction: (
    outOfTime: boolean,
    reason: string,
    partialFormData: SubmitFormDto
  ) => void;
  actionId: number;
  publicAction?: boolean;
  scrollPageTo?: (y: number) => void;
}

const ActionTaskPanelForm = ({
  taskFormId,
  onCompleteAction,
  onFormStarted,
  onAbandonAction,
  actionId,
  publicAction = false,
  scrollPageTo,
}: ActionTaskPanelFormProps) => {
  const [showSuccess, setShowSuccess] = useState(false);

  const posthog = usePostHog();
  const [error, setError] = useState<string | null>(null);

  const handleSuccessComplete = useCallback(() => {
    setShowSuccess(false);
    if (onCompleteAction) {
      onCompleteAction(false);
    }
  }, [onCompleteAction]);

  const {
    data: form,
    error: formError,
    isPending,
  } = useQuery({
    queryKey: ["form", taskFormId],
    queryFn: () =>
      tasksGetForm({ path: { id: taskFormId } }).then(
        (response) => response.data
      ),
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
          //   if (user && !user.hasActiveContract) {
          //TODO: better handling of user refresh (things used to break if the user signed a contract in another tab then went back to the first one)
          // refreshUser();
          //   }
          // Show success overlay - it will call onCompleteAction after animation
          setShowSuccess(true);
        } else {
          console.error(response.error);
          posthog.captureException(response.error, {
            event: "form_submit_error",
            properties: {
              actionId: actionId,
              $exception_fingerprint: "FormSubmitError",
            },
          });
          setError("Failed to submit action.");
        }
      }
    : null;

  const { distinctId, sessionReplayUrl } = useMemo(() => {
    if (!posthog) return { distinctId: undefined, sessionReplayUrl: undefined };
    return {
      distinctId: posthog.getDistinctId(),
      sessionReplayUrl: undefined, //TODO mobile posthog doesnt have a replay url
    };
  }, [posthog]);

  if (isPending) {
    return <ActivityIndicator />;
  }

  if (!form) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-red-500">{formError?.message}</Text>
      </View>
    );
  }

  return (
    <View>
      <FormRenderer
        id={taskFormId}
        form={form?.schema as unknown as FormSchema}
        onSubmit={handleSubmitForm}
        onFormStarted={onFormStarted}
        onAbandonAction={onAbandonAction}
        actionId={actionId}
        scrollPageTo={scrollPageTo}
      />
      {error ? <Text className="text-red-500">{error}</Text> : null}
      {formError ? (
        <Text className="text-red-500">{formError.message}</Text>
      ) : null}
      <SuccessOverlay
        visible={showSuccess}
        onComplete={handleSuccessComplete}
        message="Thank you!"
      />
    </View>
  );
};

export default ActionTaskPanelForm;
