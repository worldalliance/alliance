import { ActionDto, actionsFindOne } from "@alliance/shared/client";
import useActivities, {
  ActivityList,
} from "@alliance/shared/lib/useActivities";
import {
  selectFriendIds,
  useUserFriendsQuery,
} from "@alliance/shared/lib/user";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, href, useParams } from "react-router";
import chevronLeft from "../../assets/icons8-expand-arrow-96.png";
import FeedModeColumns, { FeedMode } from "../../components/FeedModeColumns";
import UserActivityCard from "../../components/UserActivityCard";
import { useInfiniteScrollSentinel } from "../../hooks/useInfiniteScrollSentinel";
import { useAuth } from "../../lib/AuthContext";

const ActionActivityFeedPage = () => {
  const { actionId } = useParams<{ actionId: string }>();

  const { isAuthenticated, user } = useAuth();

  const [action, setAction] = useState<ActionDto | null>(null);
  const [actionLoading, setActionLoading] = useState(true);

  const fetchAction = useCallback(async () => {
    try {
      setActionLoading(true);
      const actionResponse = await actionsFindOne({
        path: { id: parseInt(actionId!) },
      });
      console.log("Fetched action:", actionResponse);
      if (actionResponse.data) {
        setAction(actionResponse.data);
      } else {
        setAction(null);
      }
    } finally {
      setActionLoading(false);
    }
  }, [actionId]);

  useEffect(() => {
    fetchAction();
  }, [fetchAction, isAuthenticated]);

  const {
    activities,
    handleLikeActivity,
    loading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useActivities({
    list: ActivityList.Action,
    objectId: parseInt(actionId!),
    comments: true,
    limit: 50,
  });

  const { data: myFriends = [] } = useUserFriendsQuery(user?.id, {
    select: selectFriendIds,
  });

  const friendsActivities = useMemo(
    () =>
      activities.filter(
        (activity) =>
          activity.user.id === user?.id || myFriends.includes(activity.user.id),
      ),
    [activities, user, myFriends],
  );

  const friendsSentinelRef = useInfiniteScrollSentinel({
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  });
  const everyoneSentinelRef = useInfiniteScrollSentinel({
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  });

  const renderActivityColumn = (mode: FeedMode) => {
    const list = mode === FeedMode.Friends ? friendsActivities : activities;
    return (
      <div className="flex flex-col">
        <div className="flex flex-col divide-y divide-zinc-200 *:p-4">
          {list.map((activity) => (
            <UserActivityCard
              activity={activity}
              key={activity.id}
              handleLike={handleLikeActivity}
            />
          ))}
          {list.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500 p-8">
              <p>
                {loading || actionLoading
                  ? "Loading..."
                  : `No ${mode === FeedMode.Friends ? "friend " : ""}activity yet`}
              </p>
            </div>
          )}
        </div>
        {isFetchingNextPage && (
          <div className="flex justify-center py-4 text-zinc-400">
            Loading more...
          </div>
        )}
        <div
          ref={
            mode === FeedMode.Friends ? friendsSentinelRef : everyoneSentinelRef
          }
          className="h-1"
        />
      </div>
    );
  };

  return (
    <CenterLayout width="3xl">
      {action && (
        <div className="flex flex-col gap-y-8 mb-8 pt-5">
          <Link
            className="flex flex-row gap-x-2 items-center cursor-pointer hover:bg-zinc-50 self-start px-2 py-1 rounded border border-zinc-200"
            to={href("/actions/:id", { id: action.id.toString() })}
          >
            <img src={chevronLeft} className="w-3 h-3 rotate-90" />
            Back to action
          </Link>
          <p className="text-title-small">{action.name}</p>
        </div>
      )}

      <FeedModeColumns renderColumn={renderActivityColumn} />
    </CenterLayout>
  );
};

export default ActionActivityFeedPage;
