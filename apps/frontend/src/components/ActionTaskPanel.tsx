import {
  ActionDto,
  actionsComplete,
  actionsDecline,
  actionsJoin,
  SubmitFormDto,
  tasksOptout,
  UserActionRelation,
} from "@alliance/shared/client";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import posthog from "posthog-js";
import { useCallback, useMemo, useState } from "react";
import { setRevalidate } from "../applayout";
import { useAuth } from "../lib/AuthContext";
import { canCompleteAction } from "../pages/app/HomePage";
import ActionTaskPanelActivity from "./ActionTaskPanelActivity";
import ActionTaskPanelCommit from "./ActionTaskPanelCommit";
import ActionTaskPanelForm from "./ActionTaskPanelForm";
import ActionTaskPanelFunding from "./ActionTaskPanelFunding";
import { StripeWrapper } from "./StripeWrapper";

export interface ActionTaskPanelProps {
  action: ActionDto;
  userRelation: Extract<UserActionRelation, "joined" | "none">;
  missedDeadline?: boolean;
  onCompleteAction: () => void;
  onJoinAction: () => void;
  onDeclineAction: () => void;
  onOptOutAction: () => void;
  card?: boolean;
  disabled?: boolean;
}

const ActionTaskPanel: React.FC<ActionTaskPanelProps> = ({
  action,
  userRelation,
  missedDeadline = false,
  onCompleteAction,
  onJoinAction,
  onDeclineAction,
  onOptOutAction,
  card = false,
  disabled = false,
}: ActionTaskPanelProps) => {
  const { isAuthenticated } = useAuth();
  const [actionError, setActionError] = useState<string | null>(null);

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

  const handleCompleteWithTracking = useCallback(
    async (sendComplete: boolean = true) => {
      if (sendComplete) {
        const req = await actionsComplete({
          path: { id: action.id },
        });
        if (req.error) {
          setActionError("Something went wrong. Please try again.");
          return;
        }
      }
      setActionError(null);
      posthog.capture("action_completed", {
        actionId: action.id,
        actionType: action.type,
        actionName: action.name,
      });
      setRevalidate();
      onCompleteAction();
    },
    [action, onCompleteAction]
  );

  const handleJoinAction = useCallback(async () => {
    const req = await actionsJoin({
      path: { id: action.id },
    });
    if (req.error) {
      setActionError("Something went wrong. Please try again.");
      return;
    }
    setActionError(null);
    setRevalidate();
    onJoinAction();
  }, [action, onJoinAction]);

  const handleDeclineAction = useCallback(
    async (moral: boolean, reason: string) => {
      const req = await actionsDecline({
        path: { id: action.id },
        body: { reason, moral },
      });
      if (req.error) {
        setActionError("Something went wrong. Please try again.");
        return;
      }
      setActionError(null);
      setRevalidate();
      onDeclineAction();
    },
    [action, onDeclineAction]
  );

  const handleAbandonAction = useCallback(
    async (
      outOfTime: boolean,
      reason: string,
      partialFormData: SubmitFormDto
    ) => {
      const req = await tasksOptout({
        path: { id: action.taskFormId! },
        body: { actionId: action.id, reason, outOfTime, partialFormData },
      });
      if (req.error) {
        setActionError("Something went wrong. Please try again.");
        return;
      }
      setActionError(null);
      setRevalidate();
      onOptOutAction();
    },
    [action, onOptOutAction]
  );

  const handleFormStarted = useCallback(() => {
    posthog.capture("form_started", {
      actionId: action.id,
      actionType: action.type,
      actionName: action.name,
    });
  }, [action]);

  if (disabled && action.taskFormId) {
    return (
      <ActionTaskPanelForm
        taskFormId={action.taskFormId}
        onCompleteAction={null}
        onFormStarted={handleFormStarted}
        onAbandonAction={handleAbandonAction}
        card={card}
        actionId={action.id}
        disabled={true}
      />
    );
  }

  if (
    (action.status === "gathering_commitments" ||
      action.status === "office_action") &&
    !missedDeadline
  ) {
    if (userRelation === "joined") {
      return (
        <Card style={CardStyle.Green}>
          <p>
            <span className="font-medium">
              You&apos;ve committed to participate.
            </span>{" "}
            We&apos;ll notify you when it&apos;s time to act.
          </p>
        </Card>
      );
    } else {
      if (!isAuthenticated) {
        return null;
      }
      return (
        <>
          <ActionTaskPanelCommit
            onCommit={handleJoinAction}
            onDecline={handleDeclineAction}
          />
          {errorMessageNode}
        </>
      );
    }
  }
  let completionElement = null;
  if (canCompleteAction(action)) {
    if (action.type === "Funding") {
      completionElement = (
        <StripeWrapper actionId={action.id}>
          <ActionTaskPanelFunding
            onPaymentSuccess={handleCompleteWithTracking}
          />
        </StripeWrapper>
      );
    }
    if (action.type === "Activity" && action.taskFormId) {
      completionElement = (
        <ActionTaskPanelForm
          publicAction={action.publicOnly}
          taskFormId={action.taskFormId}
          onCompleteAction={handleCompleteWithTracking}
          onFormStarted={handleFormStarted}
          onAbandonAction={handleAbandonAction}
          card={card}
          actionId={action.id}
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
