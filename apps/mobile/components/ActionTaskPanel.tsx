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
};

const ActionTaskPanel = ({
  action,
  onCompleteAction,
  onOptOutAction,
  onDeadlinePassed,
  scrollPageTo,
  scrollToEnd,
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

  if ((disabled || formResponse) && action.taskFormId !== undefined) {
    return (
      <ActionTaskPanelForm
        taskFormId={action.taskFormId}
        scrollPageTo={scrollPageTo}
        scrollToEnd={scrollToEnd}
        onCompleteAction={null}
        onDeadlinePassed={noop}
        onFormStarted={handleFormStarted}
        onAbandonAction={onAbandonAction}
        actionId={action.id}
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
        onDeadlinePassed={noop}
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
        onCompleteAction={handleComplete}
        onFormStarted={handleFormStarted}
        onAbandonAction={onAbandonAction}
        onDeadlinePassed={onDeadlinePassed}
        actionId={action.id}
        disabled={disabled}
      />
    );
  }

  return null;
};

export default ActionTaskPanel;
