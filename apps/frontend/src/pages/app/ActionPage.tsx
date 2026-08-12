import {
  actionsFindOne,
  actionsGetSharePreview,
} from "@alliance/shared/client";
import { useActionHandlers } from "@alliance/shared/lib/actionPage";
import { guestReferral, taskHeaders } from "@alliance/shared/lib/copy";
import useActivities, {
  ActivityList,
} from "@alliance/shared/lib/useActivities";
import Modal, {
  ModalBody,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "@alliance/sharedweb/ui/Modal";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import CheckIcon from "@alliance/sharedweb/ui/icons/CheckIcon";
import { useCallback, useState } from "react";
import {
  href,
  Link,
  Outlet,
  useLoaderData,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import { ActionActivityDetailContext } from "../../components/ActionActivityDetail";
import ActionActivityList from "../../components/ActionActivityList";
import { TaskPanelContext } from "../../components/ActionPageTaskPanel";
import AllianceSignupPitch from "../../components/AllianceSignupPitch";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import { useAuth } from "../../lib/AuthContext";
import { useNavbarOptions } from "../../lib/NavbarOptionsContext";
import { isNonmemberOnPublicActionReferral } from "../../lib/publicActionReferral";
import { socialPreviewMeta } from "../../lib/socialPreviewMeta";
import { useCIDFromParams } from "../../lib/utils";
import ActionCompletedBarWithInfo from "./ActionCompletedBarWithInfo";

export async function loader({
  params,
  request,
}: {
  params: { id: string };
  request: Request;
}) {
  const { id } = params;
  const url = new URL(request.url);
  const refCode = url.searchParams.get("sid") ?? url.searchParams.get("ref");

  const [action, sharePreview] = await Promise.all([
    actionsFindOne({ path: { id: parseInt(id) } }),
    refCode
      ? actionsGetSharePreview({
          path: { id: parseInt(id) },
          query: { sid: refCode },
        })
          .then((res) => res.data ?? null)
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  return {
    action: action.data,
    sharePreview,
  };
}

export function meta({ data }: { data: Awaited<ReturnType<typeof loader>> }) {
  const action = data?.action;
  const sharePreview = data?.sharePreview;

  const title = action
    ? sharePreview?.firstName
      ? sharePreview.completedByReferrer
        ? `${sharePreview.firstName} completed ${action.name}`
        : `${sharePreview.firstName} invites you to try ${action.name}`
      : `${action.name} - Alliance`
    : "Alliance";

  return socialPreviewMeta({
    title,
    description: action?.shortDescription,
    image: action?.image,
  });
}

export default function ActionPage() {
  const { id: idParam } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { sharePreview } = useLoaderData() as Awaited<
    ReturnType<typeof loader>
  >;
  useNavbarOptions({ whiteBackground: true });
  const actionId = parseInt(idParam!);

  const { isAuthenticated, user, loading: userLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const rawRefCode = searchParams.get("sid") ?? searchParams.get("ref");
  const refCode = sharePreview?.validReferral ? rawRefCode : null;
  const signupHref = refCode
    ? `/signup?ref=${encodeURIComponent(refCode)}`
    : href("/signup");
  const [invitePopupDismissed, setInvitePopupDismissed] = useState(false);
  const [completedPopupDismissed, setCompletedPopupDismissed] = useState(false);
  const [referralPanelAnimationNonce, setReferralPanelAnimationNonce] =
    useState(0);
  const [showReferralTaskPanel, setShowReferralTaskPanel] = useState(false);
  const [guestCompleted, setGuestCompleted] = useState(false);

  useCIDFromParams(actionId);

  const { activities, handleLikeActivity } = useActivities({
    list: ActivityList.Action,
    objectId: actionId,
    limit: 10,
  });

  const reloadTasks = useCallback(() => {
    navigate(href("/actions/:id", { id: actionId.toString() }));
  }, [actionId, navigate]);
  const handleTryOutTask = useCallback(() => {
    setInvitePopupDismissed(true);
    setShowReferralTaskPanel(true);
    setReferralPanelAnimationNonce((prev) => prev + 1);
  }, []);
  const dismissInvitePopup = useCallback(() => {
    if (guestCompleted) {
      setCompletedPopupDismissed(true);
      setShowReferralTaskPanel(true);
      return;
    }
    setInvitePopupDismissed(true);
  }, [guestCompleted]);
  const handleGuestCompletionChange = useCallback((completed: boolean) => {
    setGuestCompleted(completed);
    if (completed) {
      setCompletedPopupDismissed(false);
    }
  }, []);

  const { action, loading, onCompleteAction, onOptOutAction } =
    useActionHandlers(actionId, isAuthenticated, reloadTasks);

  const publicMode = !isAuthenticated;

  if (!action && !loading && !user && !userLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="space-y-4">
          <p>You need to be a member to view this action.</p>
          <p>
            Already a member?{" "}
            <Link
              to={href("/login") + `?redirect=${location.pathname}`}
              className="text-link"
            >
              Log in
            </Link>
          </p>
          <p>
            Would you like to join the Alliance?{" "}
            <Link to={signupHref} className="text-link">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (!action) {
    return (
      <div className="bg-page pt-20 px-8 md:px-16">
        <div className="absolute inset-0 flex items-center justify-center">
          {loading ? (
            <Spinner />
          ) : (
            <p className="text-center text-zinc-500">Action not found</p>
          )}
        </div>
      </div>
    );
  }

  const showSidebar =
    !publicMode && !action.publicOnly && action.status === "member_action";
  const isNonmemberPublicReferralAction = isNonmemberOnPublicActionReferral({
    referralCode: refCode,
    isAuthenticated,
    userLoading,
  });
  const showHeaderSignupButton = publicMode && isNonmemberPublicReferralAction;
  const showInvitePopup =
    isNonmemberPublicReferralAction &&
    !!sharePreview?.firstName &&
    (guestCompleted ? !completedPopupDismissed : !invitePopupDismissed);

  return (
    <>
      {publicMode && (
        <PrelaunchNavbar
          transparent={false}
          absolute={false}
          showSignupButton={showHeaderSignupButton}
          signupHref={signupHref}
        />
      )}
      {showInvitePopup && (
        <Modal
          onClose={dismissInvitePopup}
          panelClassName="max-w-xl border border-white/70 shadow-2xl"
        >
          <ModalHeader className="border-b-0 p-6 pb-0 sm:p-8 sm:pb-0">
            {guestCompleted && (
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-green/10">
                <CheckIcon size={28} />
              </div>
            )}
            <ModalTitle className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
              {guestCompleted
                ? taskHeaders.actionPage.completed
                : guestReferral.inviteToTryTask(
                    sharePreview.firstName ?? guestReferral.defaultReferrerName,
                  )}
            </ModalTitle>
            <ModalDescription className="mt-2 text-base text-zinc-700">
              {guestCompleted
                ? guestReferral.joinForMoreText
                : guestReferral.locateTaskText}
            </ModalDescription>
          </ModalHeader>
          <ModalBody className="p-6 sm:p-8 sm:pt-6">
            {guestCompleted ? (
              <AllianceSignupPitch signupHref={signupHref} />
            ) : (
              <button
                type="button"
                className="inline-flex w-full justify-center rounded-full bg-zinc-900 px-6 py-3 text-base font-medium text-white transition hover:bg-zinc-800"
                onClick={handleTryOutTask}
              >
                {guestReferral.tryOutTaskButton}
              </button>
            )}
          </ModalBody>
        </Modal>
      )}
      <div className="w-full flex flex-row justify-between py-10 px-4 md:px-8 xl:px-16 bg-white min-h-[calc(100vh-var(--navbar-top-bar-height))]">
        <div className="flex flex-col md:pr-4 xl:pr-12 max-w-2xl lg:max-w-3xl mx-auto w-full">
          <Outlet
            context={
              {
                action,
                userRelation: action.userRelation ?? null,
                referralCode: refCode,
                sharePreviewFirstName: sharePreview?.firstName ?? null,
                showReferralTaskPanel,
                referralPanelAnimationNonce,
                onGuestCompletionChange: handleGuestCompletionChange,
                onCompleteAction,
                publicMode,
                onOptOutAction,
                activities,
                handleLikeActivity,
              } satisfies TaskPanelContext & ActionActivityDetailContext
            }
          />
        </div>
        {showSidebar && (
          <div className="hidden lg:flex flex-col w-[320px] xl:w-[340px] rounded gap-y-12 border-l border-zinc-200 pl-4 xl:pl-10">
            <div>
              <ActionCompletedBarWithInfo
                friendActivities={[]}
                action={action}
                textSize="base"
                textColor="zinc-800"
                showInfoTooltip
              />
              {!!action.customStatType && action.customStatValue !== null && (
                <div className="mt-3">
                  <p className="text-zinc-800">{action.customStatLabel}:</p>
                  <p className="text-xl font-bold">
                    {action.customStatValue ?? 0}
                  </p>
                </div>
              )}
            </div>
            <ActionActivityList
              actionId={action.id}
              activities={activities}
              loading={false}
              onLikeActivity={(activityId) => handleLikeActivity(activityId)}
              maxN={10}
            />
          </div>
        )}
      </div>
    </>
  );
}
