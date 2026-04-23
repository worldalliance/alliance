import { useCallback, useMemo, type RefObject } from "react";
import ActionTaskPanelForm from "./ActionTaskPanelForm";
// import ActionTaskPanelFunding from "./ActionTaskPanelFunding";
// import { StripeWrapper } from "./StripeWrapper";
import {
  ActionTaskPanelPropsShared,
  useTaskFormHandlers,
} from "@alliance/shared/lib/actionTaskPanel";
import posthog from "posthog-js";
import { canCompleteAction } from "@alliance/shared/lib/actionUtils";
import { UserActionRelation } from "@alliance/shared/client";
import ActionTaskPanelActivity from "./ActionTaskPanelActivity";
import { FormResponseDto } from "@alliance/shared/client";

export type ActionTaskPanelProps = ActionTaskPanelPropsShared & {
  userRelation: UserActionRelation;
  missedDeadline?: boolean;
  card?: boolean;
  redirectOnComplete?: boolean;
  onFormSubmitted?: (formResponse: FormResponseDto) => void;
  createAccountHref?: string;
  forceRenderTask?: boolean;
  scrollContainerRef?: RefObject<HTMLElement | null>;
};

const ActionTaskPanel: React.FC<ActionTaskPanelProps> = ({
  action,
  onCompleteAction,
  onOptOutAction,
  card = false,
  disabled = false,
  formResponse,
  guestMode = false,
  redirectOnComplete,
  onFormSubmitted,
  createAccountHref,
  forceRenderTask = false,
  scrollContainerRef,
}: ActionTaskPanelProps) => {
  const handleCompleteAction = useCallback(async () => {
    const didSucceed = await onCompleteAction();
    if (didSucceed === false) {
      return false;
    }
    posthog.capture("action_completed", {
      actionId: action.id,
      actionType: action.type,
      actionName: action.name,
    });
    return true;
  }, [onCompleteAction, action.id, action.type, action.name]);

  const handleFormStarted = useCallback(() => {
    posthog.capture("form_started", {
      actionId: action.id,
      actionType: action.type,
      actionName: action.name,
    });
  }, [action]);

  const { handleCompleteWithTracking, actionError, handleAbandonAction } =
    useTaskFormHandlers({
      action,
      onCompleteAction: handleCompleteAction,
      onOptOutAction,
      guestMode,
    });

  const errorMessageNode = useMemo(() => {
    if (!actionError) {
      return null;
    }
    return (
      <p className="mt-2 text-sm text-red-600" role="alert">
        {actionError}
      </p>
    );
  }, [actionError]);

  if ((disabled || formResponse) && action.taskFormId !== undefined) {
    return (
      <ActionTaskPanelForm
        taskFormId={action.taskFormId}
        onCompleteAction={null}
        onFormStarted={handleFormStarted}
        onAbandonAction={handleAbandonAction}
        card={card}
        actionId={action.id}
        disabled={true}
        formResponse={formResponse}
        onSubmitted={onFormSubmitted}
      />
    );
  }

  let completionElement = null;
  if (canCompleteAction(action) || forceRenderTask) {
    if (action.type === "Activity" && action.taskFormId) {
      completionElement = (
        <ActionTaskPanelForm
          publicAction={action.publicOnly || guestMode}
          taskFormId={action.taskFormId}
          onCompleteAction={handleCompleteWithTracking}
          onFormStarted={handleFormStarted}
          onAbandonAction={handleAbandonAction}
          card={card}
          actionId={action.id}
          redirectOnComplete={redirectOnComplete}
          onSubmitted={onFormSubmitted}
          scrollContainerRef={scrollContainerRef}
        />
      );
    }
    if (action.type === "Activity" && !action.taskFormId) {
      completionElement = <p>Couldn&apos;t load action contents</p>;
    }
    if (action.type === "Ongoing") {
      completionElement = (
        <ActionTaskPanelActivity
          action={action}
          onCompleteAction={handleCompleteWithTracking}
          disabled={disabled}
          createAccountHref={guestMode ? createAccountHref : undefined}
        />
      );
    }
    if (completionElement) {
      return (
        <>
          {completionElement}
          {errorMessageNode}
        </>
      );
    }
  }

  if (action.status === "draft") {
    return (
      <>
        {action.taskFormId && (
          <ActionTaskPanelForm
            taskFormId={action.taskFormId}
            onCompleteAction={null}
            onFormStarted={handleFormStarted}
            onAbandonAction={handleAbandonAction}
            card={card}
            actionId={action.id}
          />
        )}
        {errorMessageNode}
      </>
    );
  }

  return errorMessageNode;
};

export default ActionTaskPanel;
