import { ActionActivityDto, UserActionRelation } from "@alliance/shared/client";
import { getLatestEvent } from "@alliance/shared/lib/actionUtils";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import { isRouteErrorResponse, useOutletContext } from "react-router";
import { Route } from "../../.react-router/types/src/components/+types/ActionPageTaskPanel";
import ActionTaskPanel, { ActionTaskPanelProps } from "./ActionTaskPanel";
import ActionTaskPanelCompleted from "./ActionTaskPanelCompleted";
import ActionTaskPanelDeclined from "./ActionTaskPanelDeclined";

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  console.error(error);
  let errorText: string | undefined = undefined;
  if (isRouteErrorResponse(error)) {
    errorText = error.statusText;
  } else if (error instanceof Error) {
    errorText = error.name;
  }
  return (
    <Card>
      <p className="text-red-500 text-center">
        Error loading task: {errorText}
      </p>
    </Card>
  );
}

export interface TaskPanelContext
  extends Omit<ActionTaskPanelProps, "userRelation"> {
  userRelation: UserActionRelation | null;
  activities: ActionActivityDto[];
  handleLikeActivity: (activityId: number) => Promise<unknown>;
  setActivities: (activities: ActionActivityDto[]) => void;
}

const ActionPageTaskPanel = () => {
  const { userRelation, action, ...panelHandlers } =
    useOutletContext<TaskPanelContext>();

  if (action.publicOnly) {
    return (
      <ActionTaskPanel
        userRelation={"none"}
        action={action}
        {...panelHandlers}
        missedDeadline={false}
        disabled={false}
        card={false}
      />
    );
  }

  if (!action.reqAuthenticated) {
    return (
      <Card style={CardStyle.Grey}>
        Log in or reload to interact with this action
      </Card>
    );
  }

  if (
    !userRelation ||
    !action ||
    (!action.canParticipate && !action.preventCompletion)
  ) {
    return null;
  }

  if (userRelation === "completed") {
    return <ActionTaskPanelCompleted action={action} />;
  } else if (userRelation === "declined") {
    return <ActionTaskPanelDeclined />;
  }

  if (!action.canParticipate) {
    return (
      <div>
        <Card
          style={CardStyle.Grey}
          className=" !bg-zinc-200 rounded-b-none border-t-0 border-x-0"
        >
          This action no longer requires member participation.
        </Card>
        <Card style={CardStyle.Grey} className="rounded-t-none">
          <ActionTaskPanel
            userRelation={"none"}
            action={action}
            {...panelHandlers}
            missedDeadline={false}
            disabled={true}
            card={false}
          />
        </Card>
      </div>
    );
  }

  const latestEvent = getLatestEvent(action);
  const didMissDeadline =
    action.events.some((event) => event.newStatus === "member_action") &&
    (latestEvent?.newStatus === "office_action" ||
      latestEvent?.newStatus === "resolution");

  return (
    <>
      {didMissDeadline && (
        <Card style={CardStyle.Grey} className="mb-2">
          <p className="font-medium">
            The deadline for member action has passed.
          </p>
          <p>
            You do not need to complete this task, but you can still do so below
            if you would like.
          </p>
        </Card>
      )}
      <ActionTaskPanel
        userRelation={userRelation}
        action={action}
        {...panelHandlers}
        missedDeadline={didMissDeadline}
        card={true}
      />
    </>
  );
};

export default ActionPageTaskPanel;
