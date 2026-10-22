import useActivityFeeds, {
  FEED_EMPTY_MESSAGE,
  FeedMode,
} from "@alliance/shared/lib/useActivityFeeds";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import { Link, href } from "react-router";
import FeedModeColumns from "../../components/FeedModeColumns";
import UserActivityCard from "../../components/UserActivityCard";
import { useInfiniteScrollSentinel } from "../../hooks/useInfiniteScrollSentinel";

const ActivityFeedPage = () => {
  const feeds = useActivityFeeds();

  const sentinelRefs = {
    [FeedMode.Friends]: useInfiniteScrollSentinel(feeds[FeedMode.Friends]),
    [FeedMode.Everyone]: useInfiniteScrollSentinel(feeds[FeedMode.Everyone]),
  };

  const renderActivityColumn = (mode: FeedMode) => {
    const { activities, handleLikeActivity, loading, isFetchingNextPage } =
      feeds[mode];
    return (
      <div className="flex flex-col bg-page">
        <div className="flex flex-col gap-y-2 *:p-4">
          {activities.map((activity) => (
            <UserActivityCard
              activity={activity}
              key={activity.id}
              handleLike={() => handleLikeActivity(activity.id)}
            />
          ))}
          {activities.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500 p-8">
              <p>{loading ? "Loading..." : FEED_EMPTY_MESSAGE[mode]}</p>
            </div>
          )}
        </div>
        {isFetchingNextPage && (
          <div className="flex justify-center py-4 text-zinc-400">
            Loading more...
          </div>
        )}
        <div ref={sentinelRefs[mode]} className="h-1" />
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
