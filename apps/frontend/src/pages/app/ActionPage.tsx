import { actionsFindOne } from "@alliance/shared/client";
import { href, Navigate, Outlet, useNavigate, useParams } from "react-router";
import ActionActivityList from "../../components/ActionActivityList";
import { TaskPanelContext } from "../../components/ActionPageTaskPanel";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";
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

export async function loader({ params }: { params: { id: string } }) {
  const { id } = params;
  const action = await actionsFindOne({
    path: { id: parseInt(id) },
  });
  return action.data;
}

export function meta({ data }: { data: Awaited<ReturnType<typeof loader>> }) {
  return [
    {
      title: data ? data.name + " - Alliance" : "Alliance",
    },
  ];
}

export default function ActionPage() {
  const { id: idParam } = useParams();
  const navigate = useNavigate();

  const actionId = parseInt(idParam!);

  useWhiteBackground();

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

  const {
    action,
    loading,
    onCompleteAction,
    onJoinAction,
    onDeclineAction,
    onOptOutAction,
  } = useActionHandlers(actionId, isAuthenticated, reloadTasks);

  const publicMode = !isAuthenticated;

  // TODO: hack because some action pages are public and some are private. we should handle this in a more general way elsehwere (ie applayout.tsx logic)
  if (!action && !loading && !user && !userLoading) {
    return (
      <Navigate
        to={href("/login") + `?redirect=${window.location.pathname}`}
        replace
      />
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

  return (
    <>
      {publicMode && <PrelaunchNavbar transparent={false} absolute={false} />}
      <div className="w-full flex flex-row justify-between py-10 sm:py-20 px-4 md:px-8 xl:px-16">
        <div className="flex flex-col md:pr-4 xl:pr-12 max-w-2xl lg:max-w-3xl mx-auto w-full">
          <Outlet
            context={
              {
                action,
                userRelation: action.userRelation ?? null,
                onCompleteAction,
                onJoinAction,
                publicMode,
                onDeclineAction,
                onOptOutAction,
                activities,
                handleLikeActivity,
                setActivities,
              } satisfies TaskPanelContext
            }
          />
        </div>
        {!publicMode && !action.publicOnly && (
          <div className="hidden lg:flex flex-col w-[320px] xl:w-[340px] rounded gap-y-12 border-l border-zinc-200 pl-4 xl:pl-10">
            <ActionCompletedBarWithInfo
              friendActivities={[]}
              action={action}
              textSize="base"
              textColor="zinc-800"
              showInfoTooltip
            />
            <ActionActivityList
              actionId={action.id}
              activities={activities}
              loading={false}
              onLikeActivity={(activityId) => handleLikeActivity(activityId)}
              setActivities={setActivities}
              maxN={10}
            />
          </div>
        )}
      </div>
    </>
  );
}
