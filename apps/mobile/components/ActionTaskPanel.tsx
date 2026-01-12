import {
  ActionTaskPanelPropsShared,
  useTaskFormHandlers,
} from "@alliance/shared/lib/actionTaskPanel";
import ActionTaskPanelForm from "./ActionTaskPanelForm";
import { useCallback } from "react";
import { usePostHog } from "posthog-react-native";

export interface ActionTaskPanelProps extends ActionTaskPanelPropsShared {
  scrollPageTo?: (y: number) => void;
}

const ActionTaskPanel = ({
  action,
  onCompleteAction,
  onJoinAction,
  onDeclineAction,
  onOptOutAction,
  scrollPageTo,
}: ActionTaskPanelProps) => {
  const {
    handleCompleteWithTracking,
    actionError,
    handleAbandonAction,
    handleJoinAction,
    handleDeclineAction,
  } = useTaskFormHandlers({
    action,
    onCompleteAction,
    onJoinAction,
    onDeclineAction,
    onOptOutAction,
  });

  const posthog = usePostHog();

  const handleFormStarted = useCallback(() => {
    if (!posthog) return;
    posthog.capture("form_started", {
      actionId: action.id,
      actionType: action.type,
      actionName: action.name,
    });
  }, [action, posthog]);

  if (action.taskFormId) {
    return (
      <ActionTaskPanelForm
        taskFormId={action.taskFormId}
        scrollPageTo={scrollPageTo}
        onCompleteAction={handleCompleteWithTracking}
        onFormStarted={handleFormStarted}
        onAbandonAction={handleAbandonAction}
        actionId={action.id}
      />
    );
  }

  return null;
};

export default ActionTaskPanel;
