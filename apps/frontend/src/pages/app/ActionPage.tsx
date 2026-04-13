import { actionsFindOne } from "@alliance/shared/client";
import {
  href,
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
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
import { useCallback } from "react";
import { ActionActivityDetailContext } from "../../components/ActionActivityDetail";
import { useNavbarOptions } from "../../lib/NavbarOptionsContext";

export async function loader({ params }: { params: { id: string } }) {
  const { id } = params;
  const action = await actionsFindOne({
    path: { id: parseInt(id) },
  });
  return action.data;
}

export function meta({ data }: { data: Awaited<ReturnType<typeof loader>> }) {
  const title = data ? data.name + " - Alliance" : "Alliance";
  return [
    { title },
    { property: "og:title", content: title },
    ...(data?.shortDescription
      ? [{ property: "og:description", content: data.shortDescription }]
      : []),
    ...(data?.image ? [{ property: "og:image", content: data.image }] : []),
    { property: "og:type", content: "website" },
  ];
}

export default function ActionPage() {
  const { id: idParam } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  useNavbarOptions({ whiteBackground: true });
  const actionId = parseInt(idParam!);

  const { isAuthenticated, user, loading: userLoading } = useAuth();

  useCIDFromParams(actionId);

  const { activities, handleLikeActivity, setActivities } = useActivities({
    list: ActivityList.Action,
    objectId: actionId,
    limit: 10,
  });

  const reloadTasks = useCallback(() => {
    navigate(href("/actions/:id", { id: actionId.toString() }));
  }, [actionId, navigate]);

  const { action, loading, onCompleteAction, onOptOutAction } =
    useActionHandlers(actionId, isAuthenticated, reloadTasks);

  const publicMode = !isAuthenticated;

  if (!action && !loading && !user && !userLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="space-y-4">
          <p>This action is only visible to Alliance members.</p>
          <p>
            Please{" "}
            <Link
              to={href("/login") + `?redirect=${location.pathname}`}
              className="text-link"
            >
              log in
            </Link>{" "}
            if that&apos;s you.
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

  return (
    <>
      {publicMode && <PrelaunchNavbar transparent={false} absolute={false} />}
      <div className="w-full flex flex-row justify-between py-10 px-4 md:px-8 xl:px-16 bg-white min-h-[calc(100vh-var(--navbar-top-bar-height))]">
        <div className="flex flex-col md:pr-4 xl:pr-12 max-w-2xl lg:max-w-3xl mx-auto w-full">
          <Outlet
            context={
              {
                action,
                userRelation: action.userRelation ?? null,
                onCompleteAction,
                publicMode,
                onOptOutAction,
                activities,
                handleLikeActivity,
                setActivities,
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
