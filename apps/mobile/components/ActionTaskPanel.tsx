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
  onAlreadySubmitted: () => void;
};

const ActionTaskPanel = ({
  action,
  onCompleteAction,
  onOptOutAction,
  onDeadlinePassed,
  onAlreadySubmitted,
  disabled,
  formResponse,
}: ActionTaskPanelProps) => {
  const { handleComplete, handleAbandonAction } = useTaskFormHandlers({
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
      actionName: action.name,
    });
  }, [action]);

  if ((disabled || formResponse) && action.taskFormId !== null) {
    return (
      <ActionTaskPanelForm
        taskFormId={action.taskFormId}
        onCompleteAction={null}
        onDeadlinePassed={noop}
        onAlreadySubmitted={noop}
        onFormStarted={handleFormStarted}
        onAbandonAction={onAbandonAction}
        action={action}
        disabled={true}
        formResponse={formResponse}
      />
    );
  }

  if (action.viewer?.staffPreview) {
    return action.taskFormId ? (
      <ActionTaskPanelForm
        taskFormId={action.taskFormId}
        onCompleteAction={null}
        onDeadlinePassed={noop}
        onAlreadySubmitted={noop}
        onFormStarted={noop}
        action={action}
        preview
      />
    ) : null;
  }

  if (action.taskFormId) {
    return (
      <ActionTaskPanelForm
        taskFormId={action.taskFormId}
        onCompleteAction={handleComplete}
        onFormStarted={handleFormStarted}
        onAbandonAction={onAbandonAction}
        onDeadlinePassed={onDeadlinePassed}
        onAlreadySubmitted={onAlreadySubmitted}
        action={action}
        disabled={disabled}
      />
    );
  }

  return null;
};

export default ActionTaskPanel;
