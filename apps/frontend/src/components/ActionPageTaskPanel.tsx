import { FormResponseDto, UserActionRelation } from "@alliance/shared/client";
import {
  useCompletedTaskForm,
  useTaskForm,
} from "@alliance/shared/lib/actionTaskPanelCompleted";
import Card from "@alliance/sharedweb/ui/Card";
import CheckIcon from "@alliance/sharedweb/ui/icons/CheckIcon";
import { ArrowRight, Link2 } from "lucide-react";
import { useState } from "react";
import {
  href,
  isRouteErrorResponse,
  useLocation,
  useOutletContext,
  useSearchParams,
} from "react-router";
import { Link } from "react-router";
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
import { clipboardCopy, taskHeaders } from "@alliance/shared/lib/copy";
import { getBaseUrl } from "@alliance/sharedweb/lib/config";
import {
  buildShareText,
  getCompletedShareableTextTemplate,
} from "@alliance/shared/lib/shareText";
import ShareButton from "./ShareButton";

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
  [ActionPageTaskPanelState.NotAuthenticated]: null,
  [ActionPageTaskPanelState.GuestRef]: null,
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
  const [guestCompleted, setGuestCompleted] = useState(false);
  const [guestFormResponse, setGuestFormResponse] =
    useState<FormResponseDto | null>(null);
  const [showGuestJoinPrompt, setShowGuestJoinPrompt] = useState(false);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref");
  const loginHref = `/login?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`;
  const signupHref = refCode ? `/signup?ref=${refCode}` : null;

  const state = getActionPageTaskPanelState({
    action,
    userRelation,
    contractSigned: user?.hasActiveContract ?? false,
    isAuthenticated,
    hasRefCode: !!refCode,
  });
  const resolvedUserRelation = userRelation ?? "none";
  const guestMode =
    !isAuthenticated &&
    !!refCode &&
    (state === ActionPageTaskPanelState.PublicOnly ||
      state === ActionPageTaskPanelState.GuestRef);
  const readOnlyGuestPreview =
    !isAuthenticated &&
    !refCode &&
    (state === ActionPageTaskPanelState.PublicOnly ||
      state === ActionPageTaskPanelState.NotAuthenticated);
  const guestHeaderMode = guestMode;
  const formResponse = useCompletedTaskForm(
    action,
    shouldLoadCompletedTaskFormByState[state],
  );
  const effectiveFormResponse = guestFormResponse ?? formResponse ?? undefined;
  const isCompletedPanel =
    state === ActionPageTaskPanelState.Completed || guestCompleted;
  const taskForm = useTaskForm(action, isCompletedPanel);
  const shareTemplate = getCompletedShareableTextTemplate({
    schemaSnapshot: effectiveFormResponse?.schemaSnapshot as
      | Record<string, unknown>
      | undefined,
    currentSchema: taskForm?.schema as Record<string, unknown> | undefined,
  });

  const handleShareCopy = () => {
    const ref = user?.referralCode ? `?ref=${user.referralCode}` : "";
    const url = `${getBaseUrl()}/actions/${action.id}${ref}`;
    const text = buildShareText({
      template: shareTemplate,
      formResponse: effectiveFormResponse,
      url,
    });
    return navigator.clipboard.writeText(text);
  };
  const completedHeader = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-x-3">
        <CheckIcon size={24} />
        <p>{taskHeaders.actionPage.completed}</p>
      </div>
      <ShareButton
        onClick={handleShareCopy}
        icon={Link2}
        label={clipboardCopy.share}
        copiedLabel={clipboardCopy.copiedToClipboard}
        className="text-zinc-500 hover:text-zinc-700"
        iconClassName="w-3.5 h-3.5 shrink-0"
        labelClassName="text-sm order-first"
      />
    </div>
  );
  const guestCompletedHeader = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-x-3">
        <CheckIcon size="small" />
        <p>{taskHeaders.actionPage.completed}</p>
      </div>
      <ShareButton
        onClick={handleShareCopy}
        icon={Link2}
        label={clipboardCopy.share}
        copiedLabel={clipboardCopy.copiedToClipboard}
        className="text-zinc-500 hover:text-zinc-700"
        iconClassName="w-3.5 h-3.5 shrink-0"
        labelClassName="text-sm order-first"
      />
    </div>
  );

  const loginOrSignupHeader = signupHref ? (
    <p>
      <Link to={loginHref} className="text-green hover:underline">
        Log in
      </Link>{" "}
      or{" "}
      <Link to={signupHref} className="text-green hover:underline">
        sign up
      </Link>{" "}
      to complete this task.
    </p>
  ) : (
    <p>
      <Link to={loginHref} className="text-green hover:underline">
        Log in
      </Link>{" "}
      to complete this task.
    </p>
  );
  const guestHeader = signupHref ? (
    <p>
      <Link to={loginHref} className="text-green hover:underline">
        Log in
      </Link>{" "}
      or{" "}
      <Link to={signupHref} className="text-green hover:underline">
        sign up
      </Link>{" "}
      to join the Alliance. You can try out this task as a guest.
    </p>
  ) : (
    loginOrSignupHeader
  );
  const readOnlyGuestHeader = signupHref ? (
    loginOrSignupHeader
  ) : (
    <p>
      <Link to={loginHref} className="text-green hover:underline">
        Log in
      </Link>{" "}
      or{" "}
      <Link to={href("/signup")} className="text-green hover:underline">
        sign up
      </Link>{" "}
      to join the Alliance.
    </p>
  );

  let taskPanelHeader = taskPanelHeaderByState[state];
  if (guestCompleted) {
    taskPanelHeader = guestCompletedHeader;
  } else if (state === ActionPageTaskPanelState.Completed) {
    taskPanelHeader = completedHeader;
  } else if (guestHeaderMode) {
    taskPanelHeader = guestHeader;
  } else if (readOnlyGuestPreview) {
    taskPanelHeader = readOnlyGuestHeader;
  } else if (state === ActionPageTaskPanelState.NotAuthenticated) {
    taskPanelHeader = loginOrSignupHeader;
  }
  const completedStyles = cardStylesForState(ActionPageTaskPanelState.Completed);
  const { header: headerStyle, body: bodyStyle } = guestCompleted
    ? completedStyles
    : cardStylesForState(state);

  const handleGuestComplete = () => {
    setGuestCompleted(true);
    setShowGuestJoinPrompt(true);
  };

  const renderStackedCard = (bottom: React.ReactNode) => (
    <div className="relative">
      <StackedCard
        top={taskPanelHeader}
        topCardStyle={headerStyle}
        bottom={bottom}
        bottomCardStyle={bodyStyle}
        bottomCardClassName={bodyPaddingClasses}
      />
      {guestCompleted && showGuestJoinPrompt && signupHref && (
        <div className="fixed bottom-6 right-6 z-30 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl">
          <p className="text-base font-semibold text-zinc-900">
            Do you want to join the Alliance?
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            Sign up to keep going with more actions and join through your
            friend&apos;s referral link.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <Link
              to={signupHref}
              className="rounded-full bg-green px-4 py-2 text-sm font-medium text-white"
            >
              Sign up
            </Link>
            <button
              type="button"
              onClick={() => setShowGuestJoinPrompt(false)}
              className="text-sm text-zinc-500 hover:text-zinc-700"
            >
              Not now
            </button>
          </div>
        </div>
      )}
    </div>
  );

  switch (state) {
    case ActionPageTaskPanelState.Declined:
    case ActionPageTaskPanelState.Completed:
    case ActionPageTaskPanelState.NotAssigned:
    case ActionPageTaskPanelState.MemberActionClosed:
    case ActionPageTaskPanelState.OnboardingSignContractFirst:
      return renderStackedCard(
        <ActionTaskPanel
          userRelation="none"
          action={action}
          {...panelHandlers}
          disabled
          formResponse={effectiveFormResponse}
        />,
      );
    case ActionPageTaskPanelState.PublicOnlyAuthenticated:
      return renderStackedCard(
        <ActionTaskPanel
          userRelation={resolvedUserRelation}
          action={action}
          {...panelHandlers}
        />,
      );
    case ActionPageTaskPanelState.NotAuthenticated:
    case ActionPageTaskPanelState.GuestRef:
    case ActionPageTaskPanelState.PublicOnly:
      return renderStackedCard(
        <ActionTaskPanel
          userRelation="none"
          action={action}
          {...panelHandlers}
          onCompleteAction={guestMode ? handleGuestComplete : panelHandlers.onCompleteAction}
          disabled={readOnlyGuestPreview || guestCompleted}
          formResponse={effectiveFormResponse}
          guestMode={guestMode}
          createAccountHref={guestMode ? signupHref ?? undefined : undefined}
          forceRenderTask={guestMode || readOnlyGuestPreview}
          redirectOnComplete={!guestMode}
          onFormSubmitted={
            guestMode
              ? (response) => {
                  setGuestFormResponse(response);
                  handleGuestComplete();
                }
              : undefined
          }
        />,
      );
    case ActionPageTaskPanelState.MissingDataOrNotActive:
      return null;
    case ActionPageTaskPanelState.ShowTaskWithMissedDeadline:
      return renderStackedCard(
        <ActionTaskPanel
          action={action}
          userRelation={resolvedUserRelation}
          {...panelHandlers}
          missedDeadline
        />,
      );
    case ActionPageTaskPanelState.Optional:
    case ActionPageTaskPanelState.ShowTask:
      return renderStackedCard(
        <ActionTaskPanel
          action={action}
          userRelation={resolvedUserRelation}
          {...panelHandlers}
        />,
      );
    default:
      throw new Error(
        `Unknown action page task panel state: ${state satisfies never}`,
      );
  }
};

export default ActionPageTaskPanel;
