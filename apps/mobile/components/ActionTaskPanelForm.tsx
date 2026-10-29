import { FormSchema } from "@alliance/common/forms/form-schema";
import { ActionDto, FormResponseDto } from "@alliance/shared/client";
import { taskFlowMode } from "@alliance/shared/forms/useTaskFlow";
import { type ActionWithdrawal } from "@alliance/shared/lib/actionTaskPanel";
import { noop } from "@alliance/shared/lib/constants";
import { useTaskForm } from "@alliance/shared/lib/useTaskForm";
import { ActivityIndicator, View } from "react-native";
import { colors } from "../lib/style/colors";
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
  action: ActionDto;
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
  onDeadlinePassed,
  onAlreadySubmitted,
  action,
  disabled,
  formResponse,
  preview = false,
}: ActionTaskPanelFormProps) => {
  const { submitTaskForm, recordCompleted, error, historiesReload } =
    useSubmitTaskForm({
      taskFormId,
      actionId: action.id,
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
    <TaskFlow
      key={`${action.id}:${taskFormId}:${flowMode}`}
      action={action}
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

  if (formResponse && responseSchema) {
    return renderFlow({
      schema: responseSchema,
      formId: formResponse.formId,
      formSnapshotId: formResponse.formSnapshotId,
    });
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
      {renderFlow({
        schema,
        formId: taskFormId,
        formSnapshotId: form.formSnapshotId,
      })}
      {error ? <Text className="mt-2 text-red-500">{error}</Text> : null}
    </View>
  );
};

export default ActionTaskPanelForm;
