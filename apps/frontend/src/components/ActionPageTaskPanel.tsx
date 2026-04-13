import { UserActionRelation } from "@alliance/shared/client";
import { useCompletedTaskForm } from "@alliance/shared/lib/actionTaskPanelCompleted";
import Card from "@alliance/sharedweb/ui/Card";
import CheckIcon from "@alliance/sharedweb/ui/icons/CheckIcon";
import { ArrowRight, Link2 } from "lucide-react";
import { isRouteErrorResponse, useOutletContext } from "react-router";
import { Link } from "react-router";
import { useState } from "react";
import { Route } from "../../.react-router/types/src/components/+types/ActionPageTaskPanel";
import { ActionTaskPanelPropsShared } from "@alliance/shared/lib/actionTaskPanel";
import ActionTaskPanel from "./ActionTaskPanel";
import StackedCard from "./system/StackedCard";
import { useAuth } from "../lib/AuthContext";
import {
  ActionPageTaskPanelState,
  cardStylesForState,
  getActionPageTaskPanelState,
  shouldLoadCompletedTaskFormByState,
} from "@alliance/shared/lib/actionPageTaskPanel";
import { taskHeaders } from "@alliance/shared/lib/copy";

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

export interface TaskPanelContext extends Omit<
  ActionTaskPanelPropsShared,
  "userRelation"
> {
  publicMode: boolean;
  userRelation: UserActionRelation | null;
}

const taskPanelHeaderByState: Record<
  ActionPageTaskPanelState,
  React.ReactNode
> = {
  [ActionPageTaskPanelState.PublicOnlyAuthenticated]: (
    <p>{taskHeaders.actionPage.externalOnly}</p>
  ),
  [ActionPageTaskPanelState.PublicOnly]: null,
  [ActionPageTaskPanelState.NotAuthenticated]: (
    <p>
      <Link to="/login" className="text-green hover:underline">
        Log in
      </Link>{" "}
      to complete this task.
    </p>
  ),
  [ActionPageTaskPanelState.NotAssigned]: (
    <p>{taskHeaders.actionPage.notAssigned}</p>
  ),
  [ActionPageTaskPanelState.Completed]: null,
  [ActionPageTaskPanelState.Declined]: <p>{taskHeaders.actionPage.withdrew}</p>,
  [ActionPageTaskPanelState.MemberActionClosed]: (
    <p>{taskHeaders.actionPage.memberActionClosed}</p>
  ),
  [ActionPageTaskPanelState.MissingDataOrNotActive]: null,
  [ActionPageTaskPanelState.ShowTaskWithMissedDeadline]: (
    <div>
      <p className="font-medium">
        {taskHeaders.actionPage.deadlinePassed.title}
      </p>
      <p className="text-zinc-500">
        {taskHeaders.actionPage.deadlinePassed.description}
      </p>
    </div>
  ),
  [ActionPageTaskPanelState.OnboardingSignContractFirst]: (
    <div className="flex flex-row justify-between items-center gap-x-2">
      <p>{taskHeaders.actionPage.onboardingSignContractFirst}</p>
      <Link to="/tasks" className="text-green flex items-center gap-x-2">
        Go back
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  ),
  [ActionPageTaskPanelState.Optional]: (
    <div>
      <p className="font-medium text-sky-500">
        {taskHeaders.actionPage.optional.title}
      </p>
      <p className="text-zinc-500">
        {taskHeaders.actionPage.optional.description}
      </p>
    </div>
  ),
  [ActionPageTaskPanelState.ShowTask]: null,
};

const bodyPaddingClasses = "p-4 sm:p-6";

const ActionPageTaskPanel = () => {
  const { userRelation, action, ...panelHandlers } =
    useOutletContext<TaskPanelContext>();

  const { user, isAuthenticated } = useAuth();
  const [copied, setCopied] = useState(false);

  const state = getActionPageTaskPanelState({
    action,
    userRelation,
    contractSigned: user?.hasActiveContract ?? false,
    isAuthenticated,
  });
  const resolvedUserRelation = userRelation ?? "none";
  const formResponse = useCompletedTaskForm(
    action,
    shouldLoadCompletedTaskFormByState[state],
  );

  const handleShareCopy = () => {
    navigator.clipboard.writeText(`${window.location.origin}/actions/${action.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const completedHeader = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-x-3">
        <CheckIcon size="small" />
        <p>{taskHeaders.actionPage.completed}</p>
      </div>
      <button
        onClick={handleShareCopy}
        className="flex items-center gap-x-1 text-zinc-500 hover:text-zinc-700"
      >
        <Link2 className="w-3.5 h-3.5" />
        <span className="text-sm">{copied ? "Copied to Clipboard!" : "Share"}</span>
      </button>
    </div>
  );

  const taskPanelHeader =
    state === ActionPageTaskPanelState.Completed
      ? completedHeader
      : taskPanelHeaderByState[state];
  const { header: headerStyle, body: bodyStyle } = cardStylesForState(state);

  switch (state) {
    case ActionPageTaskPanelState.Declined:
    case ActionPageTaskPanelState.Completed:
    case ActionPageTaskPanelState.PublicOnlyAuthenticated:
    case ActionPageTaskPanelState.NotAuthenticated:
    case ActionPageTaskPanelState.NotAssigned:
    case ActionPageTaskPanelState.MemberActionClosed:
    case ActionPageTaskPanelState.OnboardingSignContractFirst:
      return (
        <StackedCard
          top={taskPanelHeader}
          topCardStyle={headerStyle}
          bottom={
            <ActionTaskPanel
              userRelation="none"
              action={action}
              {...panelHandlers}
              disabled
              formResponse={formResponse ?? undefined}
            />
          }
          bottomCardStyle={bodyStyle}
          bottomCardClassName={bodyPaddingClasses}
        />
      );
    case ActionPageTaskPanelState.PublicOnly:
      return (
        <StackedCard
          top={taskPanelHeader}
          topCardStyle={headerStyle}
          bottom={
            <ActionTaskPanel
              userRelation="none"
              action={action}
              {...panelHandlers}
            />
          }
          bottomCardStyle={bodyStyle}
          bottomCardClassName={bodyPaddingClasses}
        />
      );
    case ActionPageTaskPanelState.MissingDataOrNotActive:
      return null;
    case ActionPageTaskPanelState.ShowTaskWithMissedDeadline:
      return (
        <StackedCard
          top={taskPanelHeader}
          topCardStyle={headerStyle}
          bottom={
            <ActionTaskPanel
              action={action}
              userRelation={resolvedUserRelation}
              {...panelHandlers}
              missedDeadline
            />
          }
          bottomCardStyle={bodyStyle}
          bottomCardClassName={bodyPaddingClasses}
        />
      );
    case ActionPageTaskPanelState.Optional:
    case ActionPageTaskPanelState.ShowTask:
      return (
        <StackedCard
          top={taskPanelHeader}
          topCardStyle={headerStyle}
          bottom={
            <ActionTaskPanel
              action={action}
              userRelation={resolvedUserRelation}
              {...panelHandlers}
            />
          }
          bottomCardStyle={bodyStyle}
          bottomCardClassName={bodyPaddingClasses}
        />
      );
    default:
      throw new Error(
        `Unknown action page task panel state: ${state satisfies never}`,
      );
  }
};

export default ActionPageTaskPanel;
