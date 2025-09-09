import {
  ActionDto,
  actionsComplete,
  actionsDecline,
  actionsJoin,
  actionsOptout,
  UserActionRelation,
} from "@alliance/shared/client";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import posthog from "posthog-js";
import { useCallback } from "react";
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
  onCompleteAction: () => void;
  onJoinAction: () => void;
  onDeclineAction: () => void;
  onOptOutAction: () => void;
}

const ActionTaskPanel: React.FC<ActionTaskPanelProps> = ({
  action,
  userRelation,
  onCompleteAction,
  onJoinAction,
  onDeclineAction,
  onOptOutAction,
}: ActionTaskPanelProps) => {
  const { isAuthenticated } = useAuth();

  const handleCompleteWithTracking = useCallback(async () => {
    const req = await actionsComplete({
      path: { id: action.id },
    });
    if (req.error) {
      throw new Error("Failed to complete action");
    }
    posthog.capture("action_completed", {
      actionId: action.id,
      actionType: action.type,
      actionName: action.name,
    });
    setRevalidate();
    onCompleteAction();
  }, [action, onCompleteAction]);

  const handleJoinAction = useCallback(async () => {
    const req = await actionsJoin({
      path: { id: action.id },
    });
    if (req.error) {
      throw new Error("Failed to join action");
    }
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
        throw new Error("Failed to decline action");
      }
      setRevalidate();
      onDeclineAction();
    },
    [action, onDeclineAction]
  );

  const handleOptOutAction = useCallback(
    async (reason: string) => {
      const req = await actionsOptout({
        path: { id: action.id },
        body: { reason },
      });
      if (req.error) {
        throw new Error("Failed to opt out of action");
      }
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

  if (
    action.status === "gathering_commitments" ||
    action.status === "commitments_reached"
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
        <ActionTaskPanelCommit
          onCommit={handleJoinAction}
          onDecline={handleDeclineAction}
        />
      );
    }
  }

  let completionElement = null;
  if (canCompleteAction(action, userRelation)) {
    if (action.type === "Funding") {
      completionElement = (
        <StripeWrapper actionId={action.id}>
          <ActionTaskPanelFunding
            onPaymentSuccess={handleCompleteWithTracking}
          />
        </StripeWrapper>
      );
    }
    console.log("action.taskFormId", action.taskFormId);
    if (action.type === "Activity" && action.taskFormId) {
      completionElement = (
        <ActionTaskPanelForm
          taskFormId={action.taskFormId}
          onCompleteAction={handleCompleteWithTracking}
          onFormStarted={handleFormStarted}
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
          {/* <ActionTaskPanelOptOut onOptOut={handleOptOutAction} /> */}
        </>
      );
    }
  }
  return null;
};

export default ActionTaskPanel;
