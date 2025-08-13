import { useCallback, useEffect, useMemo, useState } from "react";
import {
  data,
  isRouteErrorResponse,
  Outlet,
  useLoaderData,
  useParams,
  useRouteLoaderData,
} from "react-router";
import Card, { CardStyle } from "../../components/system/Card";
import {
  actionsComplete,
  actionsFindOne,
  actionsJoin,
  actionsMyStatus,
  actionsUserLocations,
  LatLonDto,
  actionsGetActionActivities,
  actionsLikeActivity,
  actionsUnlikeActivity,
  ActionActivityDto,
} from "@alliance/shared/client";
import { ActionDto, UserActionDto } from "@alliance/shared/client";
import { useActionCount } from "../../lib/useActionWebSocket";
import { useActionActivity } from "../../lib/useActionActivityWebSocket";
import TwoColumnSplit from "../../components/system/TwoColumnSplit";
import ActionEventsPanel from "../../components/ActionEventsPanel";
import CompletedBar from "../../components/CompletedBar";
import { Route } from "../../../.react-router/types/src/pages/app/+types/ActionPage";
import { useAuth } from "../../lib/AuthContext";
import { TaskPanelContext } from "../../components/ActionTaskPanel";
import ActionActivityList from "../../components/ActionActivityList";
import { testActions } from "../../stories/testData";
import { useAppLoaderData } from "../../applayout";

const actionStatusDescriptions: Record<ActionDto["status"], string> = {
  gathering_commitments: "Gathering commitments",
  commitments_reached: "Sufficient commitments reached",
  member_action: "Members are now taking action",
  resolution: "Pending office resolution",
  completed: "Completed",
  failed: "Failed",
  abandoned: "Abandoned",
  draft: "Draft",
  upcoming: "Upcoming",
};

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  console.error(error);
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div>
        <p className="font-bold pb-2">Could not load action</p>
        <p>
          {isRouteErrorResponse(error) && error.status === 404
            ? "Not found"
            : "API server is not responding. Please try again later."}
        </p>
      </div>
    </div>
  );
}

export async function loader({
  params,
}: Route.LoaderArgs): Promise<
  (ActionDto & { locations: LatLonDto[] }) | undefined
> {
  if (!params.id || isNaN(parseInt(params.id))) {
    return undefined;
  }
  const action = await actionsFindOne({
    path: { id: parseInt(params.id) },
  });

  const locations = await actionsUserLocations({
    path: { id: parseInt(params.id) },
  });
  if (!action.data) {
    throw data("Record Not Found", { status: 404 });
  }

  return { ...action.data, locations: locations.data || [] };
}

export function meta({ data }: Route.MetaArgs) {
  const action = data as ActionDto | undefined;
  if (!action) {
    return [{ title: "Alliance" }];
  }
  return [
    { title: action.name },
    { name: "description", content: action.shortDescription },
  ];
}

export default function ActionPage() {
  const { id: idParam } = useParams();

  const loaderData = useLoaderData<typeof loader>();

  const action = useMemo(() => {
    if (import.meta.env.STORYBOOK) {
      return { ...testActions[0], locations: [] };
    }
    return loaderData;
  }, [loaderData]);
  const id = idParam || String(action?.id);

  const [userRelation, setUserRelation] = useState<
    UserActionDto["status"] | null
  >(null);
  const [activities, setActivities] = useState<ActionActivityDto[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  const { isAuthenticated, user } = useAuth();

  const actionId = action?.id || 0;
  const liveUserCount = useActionCount(actionId);
  const { revalidate } = useAppLoaderData();
  const { activities: liveActivities } = useActionActivity(actionId);

  // Fetch initial activities
  useEffect(() => {
    const fetchActivities = async () => {
      if (!actionId) return;
      try {
        setActivitiesLoading(true);
        const response = await actionsGetActionActivities({
          path: { id: actionId },
        });
        if (response.data) {
          setActivities(response.data);
        }
      } catch (err) {
        console.error("Error fetching activities:", err);
      } finally {
        setActivitiesLoading(false);
      }
    };

    fetchActivities();
  }, [actionId]);

  // Update activities when new websocket activities arrive
  useEffect(() => {
    if (liveActivities.length > 0) {
      setActivities(prev => {
        const newActivities = [...liveActivities, ...prev];
        // Remove duplicates based on id
        const uniqueActivities = newActivities.filter(
          (activity, index, self) =>
            self.findIndex((a) => a.id === activity.id) === index
        );
        return uniqueActivities;
      });
    }
  }, [liveActivities]);

  useEffect(() => {
    if (isAuthenticated && id) {
      actionsMyStatus({
        path: { id },
      }).then((response) => {
        console.log("response", response);
        if (response.error) {
          console.error("Failed to fetch user status", response.error);
        }
        if (response.data) {
          setUserRelation(response.data.status);
        }
      });
    }
  }, [isAuthenticated, id]);

  const handleCompleteAction = useCallback(async () => {
    setUserRelation("completed");
    actionsComplete({
      path: { id },
    });
    revalidate();
  }, [id, revalidate]);

  const onJoinAction = useCallback(async () => {
    if (!id) return;

    try {
      const response = await actionsJoin({
        path: { id },
      });

      if (response.error) {
        throw new Error("Failed to join action");
      } else {
        setUserRelation("joined");
      }
    } catch (err) {
      console.error("Error joining action:", err);
    } finally {
      revalidate();
    }
  }, [id, revalidate]);

  const handleLikeActivity = useCallback(async (activityId: number) => {
    if (!user) return;
    
    const activity = activities.find(a => a.id === activityId);
    if (!activity) return;

    const isLiked = activity.likes.some((like) => like.id === user.id);
    
    if (isLiked) {
      const response = await actionsUnlikeActivity({
        path: { id: activityId },
      });
      if (response.response.ok) {
        setActivities(prev => 
          prev.map(a =>
            a.id === activityId
              ? {
                  ...a,
                  likes: a.likes.filter((like) => like.id !== user.id),
                }
              : a
          )
        );
      }
    } else {
      const response = await actionsLikeActivity({
        path: { id: activityId },
      });
      if (response.response.ok && response.data) {
        setActivities(prev =>
          prev.map(a =>
            a.id === activityId
              ? {
                  ...a,
                  likes: response.data.likes || [],
                }
              : a
          )
        );
      }
    }
  }, [user, activities]);

  return (
    <TwoColumnSplit
      left={
        <Outlet
          context={
            {
              userRelation,
              handleCompleteAction,
              handleJoinAction: onJoinAction,
              activities,
              handleLikeActivity,
              setActivities,
            } satisfies TaskPanelContext
          }
        />
      }
      right={
        <div className="flex flex-col gap-y-4 p-6 pt-2">
          <Card style={CardStyle.White}>
            <div className="p-2">
              <p className="text-lg font-semibold">Status</p>
              {action && (
                <div className="mt-1">
                  <p>{actionStatusDescriptions[action.status]}</p>

                  {action.status === "gathering_commitments" ||
                  action.status === "commitments_reached" ? (
                    <div className="mt-4">
                      <CompletedBar
                        percentage={
                          ((liveUserCount ?? action.usersJoined) /
                            (action.commitmentThreshold ?? 1)) *
                          100
                        }
                      />
                      <p className="mt-4 text-green-3 text-sm font-weight-450">
                        {(
                          liveUserCount ?? action.usersJoined
                        )?.toLocaleString() || 0}{" "}
                        commitments made
                      </p>
                      <p className="text-zinc-400 text-sm">
                        {(action.commitmentThreshold ?? 0).toLocaleString()}{" "}
                        commitments needed
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <CompletedBar
                        percentage={
                          ((action.usersCompleted ?? 0) /
                            (action.usersJoined ?? 1)) *
                          100
                        }
                      />
                      <p className="mt-4 text-green-3 text-sm font-weight-450">
                        {(action.usersCompleted ?? 0).toLocaleString()} members
                        completed
                      </p>
                      <p className="text-zinc-400 text-sm">
                        {(action.usersJoined ?? 0).toLocaleString()} members
                        committed
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* <div className="w-full border-t border-gray-300" />
            <UserBubbleRow />
            <p className="text-center pt-2 text-[11pt]">
              <b>6 friends</b> already joined this action!
            </p> */}
          </Card>
          {action !== undefined && (
            <Card style={CardStyle.White}>
              <ActionEventsPanel events={action.events} />
            </Card>
          )}
          {action && (
            <ActionActivityList 
              actionId={action.id} 
              activities={activities}
              loading={activitiesLoading}
              onLikeActivity={handleLikeActivity}
              setActivities={setActivities}
            />
          )}
        </div>
      }
      bg="bg-white"
      border={false}
    />
  );
}

export function useActionLoaderData() {
  const action = useRouteLoaderData<typeof loader>("pages/app/ActionPage"); //TODO: why is this based on file path
  if (!action) {
    throw new Error("No data - applayout loader not found");
  }
  return action;
}
