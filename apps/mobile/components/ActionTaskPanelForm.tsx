import { ExceptionEvent } from "@alliance/common/analytics";
import { FormSchema } from "@alliance/common/forms/form-schema";
import { GUEST_HEADER } from "@alliance/common/guest";
import {
  FormResponseDto,
  SubmitFormDto,
  tasksSubmitForm,
  tasksSubmitPublicForm,
} from "@alliance/shared/client";
import { useFormulaSourcesRefetch } from "@alliance/shared/forms/useFormulaSourcesRefetch";
import type { ActionWithdrawal } from "@alliance/shared/lib/actionTaskPanel";
import { captureException } from "@alliance/shared/lib/analytics";
import { useTaskForm } from "@alliance/shared/lib/useTaskForm";
import { useInvalidateVisibilityContext } from "@alliance/shared/lib/useVisibilityContext";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../lib/AuthContext";
import { getStoredGuestToken, setStoredGuestToken } from "../lib/guestSession";
import { colors } from "../lib/style/colors";
import FormRenderer from "./forms/FormRenderer";
import Text from "./system/Text";

interface ActionTaskPanelFormProps {
  taskFormId: number;
  onCompleteAction: ((sendComplete: boolean) => void) | null;
  onFormStarted: () => void;
  onAbandonAction?: (withdrawal: ActionWithdrawal) => void;
  actionId: number;
  scrollPageTo: (y: number, animated?: boolean) => void;
  scrollToEnd: (animated?: boolean) => void;
  disabled?: boolean;
  formResponse?: FormResponseDto;
  /** Editable but unsubmittable, and nothing typed outlives the screen. */
  preview?: boolean;
}

const ActionTaskPanelForm = ({
  taskFormId,
  onCompleteAction,
  onFormStarted,
  onAbandonAction,
  actionId,
  scrollPageTo,
  scrollToEnd,
  disabled,
  formResponse,
  preview = false,
}: ActionTaskPanelFormProps) => {
  const { user, isAuthenticated, isLoading: userLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const { reload: historiesReload, refetchIfSourcesChanged } =
    useFormulaSourcesRefetch(setError);
  const invalidateVisibilityContext = useInvalidateVisibilityContext();

  const {
    data: form,
    error: formError,
    isPending,
  } = useTaskForm(taskFormId, { enabled: !formResponse });

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
              throwOnError: false,
            })
          : await tasksSubmitPublicForm({
              path: { id: taskFormId },
              body: data,
              headers: storedGuestToken
                ? { [GUEST_HEADER]: storedGuestToken }
                : undefined,
              throwOnError: false,
            });
        if (response.response.ok) {
          if (isAuthenticated) {
            // Bumped `completedActionCount` (and `firstContractSignedAt` for a
            // contract-signing action).
            invalidateVisibilityContext();
          } else {
            const issuedGuestToken =
              response.response.headers.get(GUEST_HEADER);
            if (issuedGuestToken && issuedGuestToken !== storedGuestToken) {
              await setStoredGuestToken(issuedGuestToken);
            }
          }
          onCompleteAction(false);
          return true;
        } else {
          if (refetchIfSourcesChanged(response)) return false;
          console.error(response.error);
          captureException(ExceptionEvent.FormSubmitError, response.error, {
            actionId,
            $exception_fingerprint: "FormSubmitError",
          });
          setError("Failed to submit action.");
          return false;
        }
      }
    : null;

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
        <ActivityIndicator color={colors.green} />
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
        formSnapshotId={form.formSnapshotId}
        form={form.schema as unknown as FormSchema}
        onSubmit={handleSubmitForm}
        onFormStarted={onFormStarted}
        onAbandonAction={onAbandonAction}
        actionId={actionId}
        persistKey={preview ? null : String(taskFormId)}
        reloadSourceHistories={historiesReload}
        userId={user?.id}
        user={user}
        userLoading={userLoading}
        loadCurrentUserLocation={!!user && isAuthenticated}
        syncDraftToServer={isAuthenticated}
        scrollPageTo={scrollPageTo}
        scrollToEnd={scrollToEnd}
        renderFormAsCompleted={disabled}
      />
      {error ? <Text className="mt-2 text-red-500">{error}</Text> : null}
    </View>
  );
};

export default ActionTaskPanelForm;
