import { FormSchema } from "@alliance/common/forms/form-schema";
import {
  ActionDto,
  FormResponseDto,
  SubmitFormDto,
} from "@alliance/shared/client";
import { taskFlowMode } from "@alliance/shared/forms/useTaskFlow";
import { type ActionWithdrawal } from "@alliance/shared/lib/actionTaskPanel";
import { noop } from "@alliance/shared/lib/constants";
import { useTaskForm } from "@alliance/shared/lib/useTaskForm";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../lib/AuthContext";
import { colors } from "../lib/style/colors";
import FormRenderer from "./forms/FormRenderer";
import Text from "./system/Text";
import TaskFlow from "./taskflow/TaskFlow";
import { useSubmitTaskForm } from "./useSubmitTaskForm";

interface ActionTaskPanelFormProps {
  taskFormId: number;
  onCompleteAction: (() => void) | null;
  onFormStarted: () => void;
  onAbandonAction?: (withdrawal: ActionWithdrawal) => void;
  onDeadlinePassed: () => void;
  onAlreadySubmitted: () => void;
  actionId: number;
  scrollPageTo: (y: number, animated?: boolean) => void;
  scrollToEnd: (animated?: boolean) => void;
  disabled?: boolean;
  formResponse?: FormResponseDto;
  /** Editable but unsubmittable, and nothing typed outlives the screen. */
  preview?: boolean;
  /** Set to show the form as the full-screen task flow for this action. */
  taskFlowAction?: ActionDto;
}

const ActionTaskPanelForm = ({
  taskFormId,
  onCompleteAction,
  onFormStarted,
  onAbandonAction,
  onDeadlinePassed,
  onAlreadySubmitted,
  actionId,
  scrollPageTo,
  scrollToEnd,
  disabled,
  formResponse,
  preview = false,
  taskFlowAction,
}: ActionTaskPanelFormProps) => {
  const { user, isAuthenticated, isLoading: userLoading } = useAuth();
  const { submitTaskForm, recordCompleted, error, historiesReload } =
    useSubmitTaskForm({
      taskFormId,
      actionId,
      onDeadlinePassed,
      onAlreadySubmitted,
    });

  const {
    data: form,
    error: formError,
    isPending,
  } = useTaskForm(taskFormId, { enabled: !formResponse });

  const completeAction = onCompleteAction
    ? () => {
        recordCompleted();
        onCompleteAction();
      }
    : null;

  const handleSubmitForm = completeAction
    ? async (data: SubmitFormDto) => {
        const submitted = await submitTaskForm(data);
        if (submitted) completeAction();
        return submitted;
      }
    : null;

  const flowMode = taskFlowMode({
    submitted: !!formResponse,
    disabled: !!disabled,
    preview,
    completable: !!completeAction,
  });
  const renderFlow = (flowForm: {
    action: ActionDto;
    schema: FormSchema;
    formId: number;
    formSnapshotId: number;
  }) => (
    <TaskFlow
      key={`${flowForm.action.id}:${taskFormId}:${flowMode}`}
      {...flowForm}
      mode={flowMode}
      completedFormResponse={formResponse}
      taskFormId={taskFormId}
      submitTaskForm={submitTaskForm}
      submitError={error}
      reloadSourceHistories={historiesReload}
      onCompleteAction={completeAction ?? noop}
      onFormStarted={onFormStarted}
      onAbandonAction={onAbandonAction}
    />
  );

  const responseSchema = formResponse
    ? (formResponse.schemaSnapshot as unknown as FormSchema)
    : null;

  if (formResponse && responseSchema && taskFlowAction) {
    return renderFlow({
      action: taskFlowAction,
      schema: responseSchema,
      formId: formResponse.formId,
      formSnapshotId: formResponse.formSnapshotId,
    });
  }

  if (formResponse && responseSchema) {
    return (
      <FormRenderer
        form={responseSchema}
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

  const schema = form.schema as unknown as FormSchema;

  return (
    <View>
      {taskFlowAction ? (
        renderFlow({
          action: taskFlowAction,
          schema,
          formId: taskFormId,
          formSnapshotId: form.formSnapshotId,
        })
      ) : (
        <FormRenderer
          id={taskFormId}
          formSnapshotId={form.formSnapshotId}
          form={schema}
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
      )}
      {error ? <Text className="mt-2 text-red-500">{error}</Text> : null}
    </View>
  );
};

export default ActionTaskPanelForm;
