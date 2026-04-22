import {
  FormResponseDto,
  SubmitFormDto,
  tasksGetForm,
  tasksSubmitForm,
  tasksSubmitPublicForm,
} from "@alliance/shared/client";
import { noop } from "@alliance/shared/lib/constants";
import { useState } from "react";
import FormRenderer from "./forms/FormRenderer";
import { FormSchema } from "@alliance/common/forms/form-schema";
import { ActivityIndicator, View } from "react-native";
import { usePostHog } from "posthog-react-native";
import Text from "./system/Text";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/AuthContext";
import { getStoredGuestToken, setStoredGuestToken } from "../lib/guestSession";

interface ActionTaskPanelFormProps {
  taskFormId: number;
  onCompleteAction: ((sendComplete: boolean) => void) | null;
  onFormStarted: () => void;
  onAbandonAction: (
    outOfTime: boolean,
    reason: string,
    partialFormData: SubmitFormDto,
  ) => void;
  actionId: number;
  scrollPageTo: (y: number, animated?: boolean) => void;
  scrollToEnd: (animated?: boolean) => void;
  onSubmitSuccess?: () => void;
  disabled?: boolean;
  formResponse?: FormResponseDto;
}

const ActionTaskPanelForm = ({
  taskFormId,
  onCompleteAction,
  onFormStarted,
  onAbandonAction,
  actionId,
  scrollPageTo,
  scrollToEnd,
  onSubmitSuccess = noop,
  disabled,
  formResponse,
}: ActionTaskPanelFormProps) => {
  const posthog = usePostHog();
  const { user, isAuthenticated } = useAuth();
  const [error, setError] = useState<string | null>(null);

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
            "Unable to load form. Please try again.",
        );
      }

      return response.data;
    },
    enabled: !formResponse,
  });

  const handleSubmitForm = onCompleteAction
    ? async (data: SubmitFormDto) => {
        setError(null);

        const storedGuestToken = isAuthenticated
          ? null
          : await getStoredGuestToken();
        const response = isAuthenticated
          ? await tasksSubmitForm({
              path: { id: taskFormId },
              body: data,
            })
          : await tasksSubmitPublicForm({
              path: { id: taskFormId },
              body: data,
              headers: storedGuestToken
                ? { "X-Guest-Token": storedGuestToken }
                : undefined,
            });
        if (response.response.ok) {
          if (!isAuthenticated) {
            const issuedGuestToken =
              response.response.headers.get("x-guest-token");
            if (issuedGuestToken && issuedGuestToken !== storedGuestToken) {
              await setStoredGuestToken(issuedGuestToken);
            }
          }
          onSubmitSuccess();
        } else {
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

  if (formResponse) {
    return (
      <FormRenderer
        form={formResponse.schemaSnapshot as unknown as FormSchema}
        id={formResponse.formId}
        actionId={actionId}
        completedFormResponse={formResponse}
        onSubmit={null}
        userId={formResponse.user?.id}
        user={formResponse.user ?? undefined}
        scrollPageTo={scrollPageTo}
        scrollToEnd={scrollToEnd}
        renderFormAsCompleted
      />
    );
  }

  if (isPending) {
    return (
      <View className="items-center justify-center py-6">
        <ActivityIndicator />
      </View>
    );
  }

  if (!form) {
    return (
      <View className="items-center justify-center py-6">
        <Text className="text-red-500">Error loading form</Text>
        <Text className="text-center text-red-500">
          {formError?.message ?? "Unable to load form. Please try again."}
        </Text>
      </View>
    );
  }

  return (
    <View>
      <FormRenderer
        id={taskFormId}
        form={form.schema as unknown as FormSchema}
        onSubmit={handleSubmitForm}
        onFormStarted={onFormStarted}
        onAbandonAction={onAbandonAction}
        actionId={actionId}
        persistKey={String(taskFormId)}
        userId={user?.id}
        user={user}
        scrollPageTo={scrollPageTo}
        scrollToEnd={scrollToEnd}
        renderFormAsCompleted={disabled}
      />
      {error ? <Text className="mt-2 text-red-500">{error}</Text> : null}
    </View>
  );
};

export default ActionTaskPanelForm;
