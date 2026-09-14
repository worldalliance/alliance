import { AnalyticsEvent } from "@alliance/common/analytics";
import {
  ActionTaskPanelPropsShared,
  useTaskFormHandlers,
} from "@alliance/shared/lib/actionTaskPanel";
import { captureEvent } from "@alliance/shared/lib/analytics";
import { noop } from "@alliance/shared/lib/constants";
import { useCallback } from "react";
import ActionTaskPanelForm from "./ActionTaskPanelForm";

export type ActionTaskPanelProps = ActionTaskPanelPropsShared & {
  scrollPageTo: (y: number, animated?: boolean) => void;
  scrollToEnd: (animated?: boolean) => void;
  onSubmitSuccess?: () => void;
};

const ActionTaskPanel = ({
  action,
  onCompleteAction,
  onOptOutAction,
  scrollPageTo,
  scrollToEnd,
  disabled,
  formResponse,
  onSubmitSuccess = noop,
}: ActionTaskPanelProps) => {
  const { handleCompleteWithTracking, handleAbandonAction } =
    useTaskFormHandlers({
      action,
      onCompleteAction,
      onOptOutAction,
    });

  // Contract signing actions cannot be withdrawn from.
  const onAbandonAction = action.isContractSigningAction
    ? undefined
    : handleAbandonAction;

  const handleFormStarted = useCallback(() => {
    captureEvent(AnalyticsEvent.FormStarted, {
      actionId: action.id,
      actionType: action.type,
      actionName: action.name,
    });
  }, [action]);

  if ((disabled || formResponse) && action.taskFormId !== undefined) {
    return (
      <ActionTaskPanelForm
        taskFormId={action.taskFormId}
        scrollPageTo={scrollPageTo}
        scrollToEnd={scrollToEnd}
        onCompleteAction={null}
        onFormStarted={handleFormStarted}
        onAbandonAction={onAbandonAction}
        actionId={action.id}
        onSubmitSuccess={onSubmitSuccess}
        disabled={true}
        formResponse={formResponse}
      />
    );
  }

  if (action.viewer?.staffPreview) {
    return action.taskFormId ? (
      <ActionTaskPanelForm
        taskFormId={action.taskFormId}
        scrollPageTo={scrollPageTo}
        scrollToEnd={scrollToEnd}
        onCompleteAction={null}
        onFormStarted={noop}
        actionId={action.id}
        preview
      />
    ) : null;
  }

  if (action.taskFormId) {
    return (
      <ActionTaskPanelForm
        taskFormId={action.taskFormId}
        scrollPageTo={scrollPageTo}
        scrollToEnd={scrollToEnd}
        onCompleteAction={handleCompleteWithTracking}
        onFormStarted={handleFormStarted}
        onAbandonAction={onAbandonAction}
        actionId={action.id}
        onSubmitSuccess={onSubmitSuccess}
        disabled={disabled}
      />
    );
  }

  return null;
};

export default ActionTaskPanel;
