import useActivities, {
  ActivityList,
} from "@alliance/shared/lib/useActivities";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import { useCallback } from "react";
import { Link, href } from "react-router";
import FeedModeColumns, { FeedMode } from "../../components/FeedModeColumns";
import UserActivityCard from "../../components/UserActivityCard";
import { useInfiniteScrollSentinel } from "../../hooks/useInfiniteScrollSentinel";

const ActivityFeedPage = () => {
  const {
    activities,
    handleLikeActivity: handleGlobalLikeActivity,
    loading,
    fetchNextPage: fetchNextGlobal,
    hasNextPage: hasNextGlobal,
    isFetchingNextPage: isFetchingNextGlobal,
  } = useActivities({
    list: ActivityList.Global,
    comments: true,
    limit: 30,
  });

  const {
    activities: friendActivities,
    handleLikeActivity: handleLikeFriendActivity,
    loading: loadingFriend,
    fetchNextPage: fetchNextFriends,
    hasNextPage: hasNextFriends,
    isFetchingNextPage: isFetchingNextFriends,
  } = useActivities({
    list: ActivityList.Friends,
    comments: true,
    limit: 30,
  });

  const handleLikeActivity = useCallback(
    (activityId: number, mode: FeedMode) => {
      if (mode === FeedMode.Friends) {
        return handleLikeFriendActivity(activityId);
      } else {
        return handleGlobalLikeActivity(activityId);
      }
    },
    [handleLikeFriendActivity, handleGlobalLikeActivity],
  );

  const friendsSentinelRef = useInfiniteScrollSentinel({
    fetchNextPage: fetchNextFriends,
    hasNextPage: hasNextFriends,
    isFetchingNextPage: isFetchingNextFriends,
  });
  const everyoneSentinelRef = useInfiniteScrollSentinel({
    fetchNextPage: fetchNextGlobal,
    hasNextPage: hasNextGlobal,
    isFetchingNextPage: isFetchingNextGlobal,
  });

  const renderActivityColumn = (mode: FeedMode) => {
    const list = mode === FeedMode.Friends ? friendActivities : activities;
    const isFetchingNext =
      mode === FeedMode.Friends ? isFetchingNextFriends : isFetchingNextGlobal;
    const sentinelRef =
      mode === FeedMode.Friends ? friendsSentinelRef : everyoneSentinelRef;
    return (
      <div className="flex flex-col bg-page">
        <div className="flex flex-col gap-y-2 *:p-4">
          {list.map((activity) => (
            <UserActivityCard
              activity={activity}
              key={activity.id}
              handleLike={() => handleLikeActivity(activity.id, mode)}
            />
          ))}
          {list.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500 p-8">
              <p>
                {(mode === FeedMode.Friends ? loadingFriend : loading)
                  ? "Loading..."
                  : `No ${mode === FeedMode.Friends ? "friend " : ""}activity yet`}
              </p>
            </div>
          )}
        </div>
        {isFetchingNext && (
          <div className="flex justify-center py-4 text-zinc-400">
            Loading more...
          </div>
        )}
        <div ref={sentinelRef} className="h-1" />
      </div>
    );
  };

  return (
    <CenterLayout width="3xl">
      <FeedModeColumns
        renderColumn={renderActivityColumn}
        trailing={
          <Link
            to={href("/members")}
            className="text-zinc-800 hover:underline rounded font-medium"
          >
            Member list
          </Link>
        }
      />
    </CenterLayout>
  );
};

export default ActivityFeedPage;
