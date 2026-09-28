import useHomeFeed from "@alliance/shared/lib/useHomeFeed";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { useInfiniteScrollSentinel } from "../hooks/useInfiniteScrollSentinel";
import FeedItems from "./FeedItems";

const LIMIT = 5;

const HomeFeed = () => {
  const {
    items,
    handleLikeActivity,
    handleLikeForumComment,
    loading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useHomeFeed({
    comments: true,
    limit: LIMIT,
  });

  const sentinelRef = useInfiniteScrollSentinel({
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  });

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="medium" />
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col">
      <p className="text-title font-serif mb-4">Activity</p>
      <div className="flex flex-col gap-y-2 *:p-4">
        <FeedItems
          items={items}
          handleLikeActivity={handleLikeActivity}
          handleLikeForumComment={handleLikeForumComment}
        />
      </div>
      {isFetchingNextPage && (
        <div className="flex justify-center py-4 text-zinc-400">
          Loading more...
        </div>
      )}
      <div ref={sentinelRef} className="h-1" />
    </div>
  );
};

export default HomeFeed;
