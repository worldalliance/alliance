import { actionsFindOne } from "@alliance/shared/client";
import { getApiUrl } from "@alliance/sharedweb/lib/config";
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
import ActionActivityList from "../../components/ActionActivityList";
import { TaskPanelContext } from "../../components/ActionPageTaskPanel";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { useAuth } from "../../lib/AuthContext";
import { useCIDFromParams } from "../../lib/utils";
import ActionCompletedBarWithInfo from "./ActionCompletedBarWithInfo";
import useActivities, {
  ActivityList,
} from "@alliance/shared/lib/useActivities";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import { useActionHandlers } from "@alliance/shared/lib/actionPage";
import { useCallback, useState } from "react";
import { ActionActivityDetailContext } from "../../components/ActionActivityDetail";
import { useNavbarOptions } from "../../lib/NavbarOptionsContext";
import { isNonmemberOnPublicActionReferral } from "../../lib/publicActionReferral";

export async function loader({
  params,
  request,
}: {
  params: { id: string };
  request: Request;
}) {
  const { id } = params;
  const url = new URL(request.url);
  const refCode = url.searchParams.get("ref");

  const [action, sharePreview] = await Promise.all([
    actionsFindOne({ path: { id: parseInt(id) } }),
    refCode
      ? fetch(
          `${getApiUrl()}/actions/${id}/sharePreview?${new URLSearchParams({
            ref: refCode,
          }).toString()}`,
        )
          .then(async (response) => {
            if (!response.ok) {
              return null;
            }

            return (await response.json()) as {
              firstName?: string | null;
              completedByReferrer: boolean;
            };
          })
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
      : action.name
    : "Alliance";

  return [
    { title },
    { property: "og:title", content: title },
    ...(action?.shortDescription
      ? [{ property: "og:description", content: action.shortDescription }]
      : []),
    ...(action?.image ? [{ property: "og:image", content: action.image }] : []),
    { property: "og:type", content: "website" },
  ];
}

export default function ActionPage() {
  const { id: idParam } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { sharePreview } = useLoaderData() as Awaited<ReturnType<typeof loader>>;
  useNavbarOptions({ whiteBackground: true });
  const actionId = parseInt(idParam!);

  const { isAuthenticated, user, loading: userLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref");
  const signupHref = refCode ? `/signup?ref=${refCode}` : href("/signup");
  const [invitePopupDismissed, setInvitePopupDismissed] = useState(false);
  const [referralPanelAnimationNonce, setReferralPanelAnimationNonce] =
    useState(0);
  const [showReferralTaskPanel, setShowReferralTaskPanel] = useState(false);

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
          {refCode && (
            <p>
              Would you like to join the Alliance?{" "}
              <Link to={`/signup?ref=${refCode}`} className="text-link">
                Invite link
              </Link>
            </p>
          )}
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
  const showHeaderSignupButton =
    publicMode && isNonmemberPublicReferralAction;
  const showInvitePopup =
    isNonmemberPublicReferralAction &&
    !!sharePreview?.firstName &&
    !invitePopupDismissed;

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="referral-invite-popup-title"
            className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <button
              type="button"
              aria-label="Dismiss invitation popup"
              className="absolute right-4 top-4 text-2xl leading-none text-zinc-400 transition hover:text-zinc-600"
              onClick={() => setInvitePopupDismissed(true)}
            >
              ×
            </button>
            <h2
              id="referral-invite-popup-title"
              className="pr-8 text-2xl font-semibold text-zinc-900"
            >
              {sharePreview.firstName} has invited you to try this task.
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-700">
              The Alliance is a global group of people cooperating to improve
              the world. Join us!
            </p>
            <button
              type="button"
              className="mt-6 inline-flex w-full justify-center rounded-full bg-zinc-900 px-6 py-3 text-base font-medium text-white transition hover:bg-zinc-800"
              onClick={handleTryOutTask}
            >
              Try out this task
            </button>
          </div>
        </div>
      )}
      <div className="w-full flex flex-row justify-between py-10 px-4 md:px-8 xl:px-16 bg-white min-h-[calc(100vh-var(--navbar-top-bar-height))]">
        <div className="flex flex-col md:pr-4 xl:pr-12 max-w-2xl lg:max-w-3xl mx-auto w-full">
          <Outlet
            context={
              {
                action,
                userRelation: action.userRelation ?? null,
                sharePreviewFirstName: sharePreview?.firstName ?? null,
                showReferralTaskPanel,
                referralPanelAnimationNonce,
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
