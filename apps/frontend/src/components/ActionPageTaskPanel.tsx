import { FormResponseDto, UserActionRelation } from "@alliance/shared/client";
import {
  useCompletedTaskForm,
  useGuestTaskForm,
  useTaskForm,
} from "@alliance/shared/lib/actionTaskPanelCompleted";
import Card from "@alliance/sharedweb/ui/Card";
import CheckIcon from "@alliance/sharedweb/ui/icons/CheckIcon";
import { ArrowRight, Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { isRouteErrorResponse, useOutletContext } from "react-router";
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
  isFormDisabledByState,
  shouldLoadCompletedTaskFormByState,
} from "@alliance/shared/lib/actionPageTaskPanel";
import {
  clipboardCopy,
  guestReferral,
  taskHeaders,
} from "@alliance/shared/lib/copy";
import { getBaseUrl } from "@alliance/sharedweb/lib/config";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import {
  buildActionShareUrl,
  buildShareText,
  getCompletedShareableTextTemplate,
} from "@alliance/shared/lib/shareText";
import ShareButton from "./ShareButton";
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
  referralCode?: string | null;
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
  [ActionPageTaskPanelState.GuestCompleted]: null,
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
  const {
    userRelation,
    action,
    referralCode,
    sharePreviewFirstName,
    showReferralTaskPanel = false,
    referralPanelAnimationNonce = 0,
    onGuestCompletionChange,
    ...panelHandlers
  } = useOutletContext<TaskPanelContext>();

  const { user, isAuthenticated, loading: userLoading } = useAuth();
  const [localGuestFormResponse, setLocalGuestFormResponse] =
    useState<FormResponseDto | null>(null);
  const [animateReferralPanel, setAnimateReferralPanel] = useState(false);
  const refCode = referralCode ?? null;
  const signupHref = refCode
    ? `/signup?ref=${encodeURIComponent(refCode)}`
    : null;

  const fetchedGuestFormResponse = useGuestTaskForm(action, !isAuthenticated);
  const guestFormResponse =
    localGuestFormResponse ?? fetchedGuestFormResponse ?? null;
  const hasGuestResponse = !isAuthenticated && !!guestFormResponse;

  const state = getActionPageTaskPanelState({
    action,
    userRelation,
    contractSigned: user?.hasActiveContract ?? false,
    isAuthenticated,
    hasRefCode: !!refCode,
    hasGuestResponse,
  });
  const resolvedUserRelation = userRelation ?? "none";
  const guestCompleted = state === ActionPageTaskPanelState.GuestCompleted;
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
  const formDisabledByState = isFormDisabledByState(state);
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

  const handleShareCopy = async () => {
    const url = await buildActionShareUrl({
      actionId: action.id,
      baseUrl: getBaseUrl(),
      isAuthenticated,
    });
    const text = buildShareText({
      template: shareTemplate,
      formResponse: effectiveFormResponse,
      userName: user?.name,
      url,
    });
    return copyToClipboard(text);
  };
  const completedHeader = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-x-3">
        <CheckIcon size={24} />
        <p>{taskHeaders.actionPage.completed}</p>
      </div>
      {isAuthenticated && (
        <ShareButton
          onClick={handleShareCopy}
          icon={Link2}
          label={clipboardCopy.share}
          copiedLabel={clipboardCopy.copiedToClipboard}
          className="text-zinc-500 hover:text-zinc-700"
          iconClassName="w-3.5 h-3.5 shrink-0"
          labelClassName="text-sm order-first"
        />
      )}
    </div>
  );

  let taskPanelHeader = taskPanelHeaderByState[state];
  if (isCompletedPanel) {
    taskPanelHeader = completedHeader;
  } else if (isNonmemberPublicReferralAction) {
    taskPanelHeader = null;
  }
  const { header: headerStyle, body: bodyStyle } = cardStylesForState(state);

  useEffect(() => {
    if (isAuthenticated) {
      setLocalGuestFormResponse(null);
    }
  }, [isAuthenticated]);

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
                          {guestReferral.completionIntegrityExplanation}
                        </p>
                        <p className="mt-3 text-base leading-7 text-zinc-700">
                          {guestReferral.joinToCountContributions}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-semibold leading-8 text-zinc-900">
                          {guestReferral.inviteToTryTask(
                            sharePreviewFirstName ??
                              guestReferral.defaultReferrerName,
                          )}
                        </p>
                        <p className="mt-3 text-base leading-7 text-zinc-700">
                          {guestReferral.allianceIntro}
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
    </div>
  );

  switch (state) {
    case ActionPageTaskPanelState.Declined:
    case ActionPageTaskPanelState.Completed:
    case ActionPageTaskPanelState.GuestCompleted:
    case ActionPageTaskPanelState.PublicOnlyAuthenticated:
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
    case ActionPageTaskPanelState.NotAuthenticated:
    case ActionPageTaskPanelState.GuestRef:
    case ActionPageTaskPanelState.PublicOnly:
      return renderStackedCard(
        <ActionTaskPanel
          userRelation="none"
          action={action}
          {...panelHandlers}
          onCompleteAction={
            guestMode ? () => {} : panelHandlers.onCompleteAction
          }
          disabled={formDisabledByState}
          formResponse={effectiveFormResponse}
          guestMode={guestMode}
          createAccountHref={guestMode ? (signupHref ?? undefined) : undefined}
          forceRenderTask={guestMode || formDisabledByState}
          redirectOnComplete={!guestMode}
          onFormSubmitted={
            guestMode
              ? (response) => setLocalGuestFormResponse(response)
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
