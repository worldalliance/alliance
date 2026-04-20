import { FormResponseDto, UserActionRelation } from "@alliance/shared/client";
import {
  useCompletedTaskForm,
  useTaskForm,
} from "@alliance/shared/lib/actionTaskPanelCompleted";
import Card from "@alliance/sharedweb/ui/Card";
import CheckIcon from "@alliance/sharedweb/ui/icons/CheckIcon";
import { ArrowRight, Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  isRouteErrorResponse,
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
import { clipboardCopy, taskHeaders } from "@alliance/shared/lib/copy";
import { getBaseUrl } from "@alliance/sharedweb/lib/config";
import {
  buildShareText,
  getCompletedShareableTextTemplate,
} from "@alliance/shared/lib/shareText";
import type { DeviceVisibilityTarget } from "@alliance/common/forms/device";
import ShareButton from "./ShareButton";
import {
  getGuestTaskCompletion,
  saveGuestTaskCompletion,
} from "../lib/guestTaskCompletion";
import { isNonmemberOnPublicActionReferral } from "../lib/publicActionReferral";

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
  sharePreviewFirstName?: string | null;
  showReferralTaskPanel?: boolean;
  referralPanelAnimationNonce?: number;
  onGuestCompletionChange?: (completed: boolean) => void;
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

function toDeviceVisibilityTarget(
  value: string | undefined,
): DeviceVisibilityTarget | undefined {
  if (value === "mobile" || value === "tablet" || value === "desktop") {
    return value;
  }
  return undefined;
}

const ActionPageTaskPanel = () => {
  const {
    userRelation,
    action,
    sharePreviewFirstName,
    showReferralTaskPanel = false,
    referralPanelAnimationNonce = 0,
    onGuestCompletionChange,
    ...panelHandlers
  } = useOutletContext<TaskPanelContext>();

  const { user, isAuthenticated, loading: userLoading } = useAuth();
  const [guestCompleted, setGuestCompleted] = useState(false);
  const [guestFormResponse, setGuestFormResponse] =
    useState<FormResponseDto | null>(null);
  const [showGuestJoinPrompt, setShowGuestJoinPrompt] = useState(false);
  const [animateReferralPanel, setAnimateReferralPanel] = useState(false);
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref");
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
  const isNonmemberPublicReferralAction = isNonmemberOnPublicActionReferral({
    referralCode: refCode,
    isAuthenticated,
    userLoading,
  });
  const readOnlyGuestPreview =
    !isAuthenticated &&
    !refCode &&
    (state === ActionPageTaskPanelState.PublicOnly ||
      state === ActionPageTaskPanelState.NotAuthenticated);
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

  let taskPanelHeader = taskPanelHeaderByState[state];
  if (guestCompleted) {
    taskPanelHeader = guestCompletedHeader;
  } else if (state === ActionPageTaskPanelState.Completed) {
    taskPanelHeader = completedHeader;
  } else if (isNonmemberPublicReferralAction) {
    taskPanelHeader = null;
  }
  const completedStyles = cardStylesForState(ActionPageTaskPanelState.Completed);
  const { header: headerStyle, body: bodyStyle } = guestCompleted
    ? completedStyles
    : cardStylesForState(state);

  const handleGuestComplete = () => {
    setGuestCompleted(true);
  };

  useEffect(() => {
    if (isAuthenticated) {
      setGuestCompleted(false);
      setGuestFormResponse(null);
      return;
    }

    const savedCompletion = getGuestTaskCompletion(action.id);
    if (!savedCompletion) {
      setGuestCompleted(false);
      setGuestFormResponse(null);
      return;
    }

    setGuestCompleted(true);
    setGuestFormResponse(savedCompletion.formResponse);
  }, [action.id, isAuthenticated]);

  useEffect(() => {
    onGuestCompletionChange?.(guestCompleted);
  }, [guestCompleted, onGuestCompletionChange]);

  useEffect(() => {
    if (!isNonmemberPublicReferralAction || referralPanelAnimationNonce === 0) {
      return;
    }

    setAnimateReferralPanel(true);
    const timeoutId = window.setTimeout(() => {
      setAnimateReferralPanel(false);
    }, 550);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isNonmemberPublicReferralAction, referralPanelAnimationNonce]);

  const renderStackedCard = (bottom: React.ReactNode) => (
    <div className="relative">
      <StackedCard
        top={taskPanelHeader}
        topCardStyle={headerStyle}
        bottom={
          <>
            {isNonmemberPublicReferralAction &&
              showReferralTaskPanel &&
              signupHref && (
              <div className="-mx-4 -mt-4 mb-4 overflow-hidden sm:-mx-6 sm:-mt-6">
                <div
                  className={`rounded-b-2xl rounded-t-none border-b border-zinc-200 bg-zinc-50 px-4 py-4 sm:px-6 sm:py-5 ${
                    !guestCompleted && animateReferralPanel
                      ? "referral-panel-slide-in"
                      : ""
                  }`}
                >
                  {guestCompleted ? (
                    <>
                      <p className="text-base leading-7 text-zinc-700">
                        To maintain the integrity of our data, only
                        member-submitted forms are formally processed.
                      </p>
                      <p className="mt-3 text-base leading-7 text-zinc-700">
                        Want your work to count? Join the Alliance to ensure
                        your future contributions are acted upon.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-semibold leading-8 text-zinc-900">
                        {sharePreviewFirstName ?? "Your friend"} has invited you
                        to try this task.
                      </p>
                      <p className="mt-3 text-base leading-7 text-zinc-700">
                        The Alliance is a global group of people cooperating to
                        improve the world. Join us!
                      </p>
                    </>
                  )}
                  <Link
                    to={signupHref}
                    className="mt-5 block w-full rounded-full bg-green px-6 py-3 text-center text-base font-medium text-white"
                  >
                    Sign up
                  </Link>
                </div>
              </div>
            )}
            {bottom}
          </>
        }
        bottomCardStyle={bodyStyle}
        bottomCardClassName={bodyPaddingClasses}
      />
      {guestCompleted &&
        showGuestJoinPrompt &&
        signupHref &&
        isNonmemberPublicReferralAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="guest-completion-popup-title"
            className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"
          >
            <button
              type="button"
              aria-label="Dismiss completion popup"
              className="absolute right-4 top-4 text-2xl leading-none text-zinc-400 transition hover:text-zinc-600"
              onClick={() => setShowGuestJoinPrompt(false)}
            >
              ×
            </button>
            <div
              id="guest-completion-popup-title"
              className="pr-8 text-lg font-semibold leading-8 text-zinc-900"
            >
              <p>You&apos;ve completed this task.</p>
              <p className="mt-3">
                To maintain the integrity of our data, only member-submitted
                forms are formally processed.
              </p>
              <p className="mt-3">
                Want your work to count? Join the Alliance to ensure your
                future contributions are acted upon.
              </p>
            </div>
            <div className="mt-6 flex flex-col items-stretch gap-3">
              <Link
                to={signupHref}
                className="w-full rounded-full bg-green px-6 py-3 text-center text-base font-medium text-white"
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
          createAccountHref={
            guestMode && !isNonmemberPublicReferralAction
              ? signupHref ?? undefined
              : undefined
          }
          forceRenderTask={guestMode || readOnlyGuestPreview}
          redirectOnComplete={!guestMode}
          onFormSubmitted={
            guestMode
              ? (response) => {
                  if (action.taskFormId) {
                    saveGuestTaskCompletion({
                      actionId: action.id,
                      taskFormId: action.taskFormId,
                      submission: {
                        actionId: action.id,
                        answers: response.answers,
                        schemaSnapshot:
                          (response.schemaSnapshot as Record<string, unknown>) ??
                          {},
                        visibilityValidatorResults:
                          response.visibilityValidatorResults ?? undefined,
                        deviceType: toDeviceVisibilityTarget(
                          response.deviceType ?? undefined,
                        ),
                        publicAnswers: response.publicAnswers ?? undefined,
                        phDistinctId: response.phDistinctId ?? undefined,
                        sessionReplayUrl:
                          response.sessionReplayUrl ?? undefined,
                        sid: response.sid ?? undefined,
                      },
                      formResponse: response,
                      completedAt: response.createdAt ?? new Date().toISOString(),
                    });
                  }
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
