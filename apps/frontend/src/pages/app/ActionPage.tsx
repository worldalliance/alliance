import {
  ActionDto,
  actionsFindOne,
  UserActionRelation,
} from "@alliance/shared/client";
import { Outlet, href, useNavigate, useParams } from "react-router";
import ActionActivityList from "../../components/ActionActivityList";
import { TaskPanelContext } from "../../components/ActionPageTaskPanel";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";
import useActivities, { ActivityList } from "./useActivities";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext";
import Spinner from "../../components/Spinner";
import { useCIDFromParams } from "../../lib/utils";
import ActionCompletedBarWithInfo from "./ActionCompletedBarWithInfo";

export default function ActionPage() {
  const { id: idParam } = useParams();
  const navigate = useNavigate();

  const actionId = parseInt(idParam!);

  useWhiteBackground();

  const { isAuthenticated } = useAuth();

  const [action, setAction] = useState<ActionDto | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAction = useCallback(async () => {
    try {
      setLoading(true);
      const actionResponse = await actionsFindOne({
        path: { id: actionId },
      });
      if (actionResponse.data) {
        setAction(actionResponse.data);
      } else {
        setAction(null);
      }
    } finally {
      setLoading(false);
    }
  }, [actionId]);

  useEffect(() => {
    fetchAction();
  }, [fetchAction, isAuthenticated]);

  useCIDFromParams();

  const { activities, handleLikeActivity, setActivities } = useActivities({
    list: ActivityList.Action,
    objectId: actionId,
    limit: 10,
  });

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
    <div className="w-full flex flex-row justify-between py-10 sm:py-20 px-4 md:px-4 xl:px-18">
      <div className="flex flex-col md:pr-4 xl:pr-12 max-w-2xl lg:max-w-3xl mx-auto w-full">
        <Outlet
          context={
            {
              action,
              userRelation:
                (action.userRelation as UserActionRelation | undefined) ?? null,
              onCompleteAction: () => {
                setAction((action) => ({
                  ...action!,
                  userRelation: "completed",
                  usersCompleted: action!.usersCompleted + 1,
                }));

                // TODO need better way to update number of remaining tasks
                navigate(href("/actions/:id", { id: actionId.toString() }));
              },
              onJoinAction: () =>
                setAction((action) => ({
                  ...action!,
                  userRelation: "joined",
                })),
              onDeclineAction: () => {
                setAction((action) => ({
                  ...action!,
                  userRelation: "declined",
                }));

                // TODO need better way to update number of remaining tasks
                navigate(href("/actions/:id", { id: actionId.toString() }));
              },
              onOptOutAction: () => {
                setAction((action) => ({
                  ...action!,
                  userRelation: "declined",
                }));

                // TODO need better way to update number of remaining tasks
                navigate(href("/actions/:id", { id: actionId.toString() }));
              },
              activities,
              handleLikeActivity,
              setActivities,
            } satisfies TaskPanelContext
          }
        />
      </div>
      <div className="hidden lg:flex flex-col max-w-[320px] xl:max-w-[380px] rounded gap-y-12 border-l border-zinc-200 pl-4 lg:pl-12">
        <ActionCompletedBarWithInfo
          friendActivities={[]}
          action={action}
          textSize="base"
          textColor="zinc-800"
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
    </div>
  );
}
