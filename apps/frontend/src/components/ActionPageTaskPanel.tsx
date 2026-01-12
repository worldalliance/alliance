import { ActionActivityDto, UserActionRelation } from "@alliance/shared/client";
import Card from "@alliance/sharedweb/ui/Card";
import { isRouteErrorResponse, useOutletContext } from "react-router";
import { Route } from "../../.react-router/types/src/components/+types/ActionPageTaskPanel";
import ActionTaskPanel from "./ActionTaskPanel";
import { ActionTaskPanelPropsShared } from "@alliance/shared/lib/actionTaskPanel";
import ActionTaskPanelCompleted from "./ActionTaskPanelCompleted";
import ActionTaskPanelDeclined from "./ActionTaskPanelDeclined";
import { useAuth } from "../lib/AuthContext";
import { CardStyle } from "@alliance/shared/styles/card";
import {
  ActionPageTaskPanelState,
  getActionPageTaskPanelState,
} from "@alliance/shared/lib/actionPageTaskPanel";
import {
  taskDeadlinePassed,
  taskDeadlinePassedDescription,
  taskNotAssigned,
} from "@alliance/shared/lib/copy";

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
  extends Omit<ActionTaskPanelPropsShared, "userRelation"> {
  publicMode: boolean;
  userRelation: UserActionRelation | null;
  activities: ActionActivityDto[];
  handleLikeActivity: (activityId: number) => Promise<unknown>;
  setActivities: (activities: ActionActivityDto[]) => void;
}

const ActionPageTaskPanel = () => {
  const { userRelation, action, ...panelHandlers } =
    useOutletContext<TaskPanelContext>();

  const state = getActionPageTaskPanelState(action, userRelation);

  const { isAuthenticated } = useAuth();

  switch (state) {
    case ActionPageTaskPanelState.PublicOnly:
      return (
        <ActionTaskPanel
          userRelation={"none"}
          action={action}
          {...panelHandlers}
          missedDeadline={false}
          disabled={isAuthenticated}
          card={isAuthenticated}
        />
      );
    case ActionPageTaskPanelState.NotAuthenticated:
      return (
        <div>
          <Card style={CardStyle.Grey} className="bg-zinc-200 rounded-b-none">
            Members: Log in or reload to interact with this action
          </Card>
          <Card style={CardStyle.Grey} className="rounded-t-none border-t-0">
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
    case ActionPageTaskPanelState.ActiveButCantParticipate:
      return (
        <div>
          <Card style={CardStyle.Grey} className="rounded-b-none font-medium">
            {taskNotAssigned}
          </Card>
          <Card style={CardStyle.Grey} className="rounded-t-none border-t-0">
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
    case ActionPageTaskPanelState.MissingDataOrNotActive:
      return null;
    case ActionPageTaskPanelState.Completed:
      return <ActionTaskPanelCompleted action={action} />;
    case ActionPageTaskPanelState.Declined:
      return <ActionTaskPanelDeclined />;
    case ActionPageTaskPanelState.MemberActionClosed:
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
    case ActionPageTaskPanelState.ShowTaskWithMissedDeadline:
      return (
        <>
          <Card style={CardStyle.Grey} className="mb-2">
            <p className="font-medium">{taskDeadlinePassed}</p>
            <p>{taskDeadlinePassedDescription}</p>
          </Card>
          <ActionTaskPanel
            userRelation={userRelation ?? "none"}
            action={action}
            {...panelHandlers}
            missedDeadline={true}
            card={true}
          />
        </>
      );
    case ActionPageTaskPanelState.ShowTask:
      return (
        <ActionTaskPanel
          action={action}
          userRelation={userRelation ?? "none"}
          card={true}
          {...panelHandlers}
        />
      );
    default:
      throw new Error(
        `Unknown action page task panel state: ${state satisfies never}`
      );
  }
};

export default ActionPageTaskPanel;
