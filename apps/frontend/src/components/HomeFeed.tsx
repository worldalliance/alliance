import useHomeFeed from "@alliance/shared/lib/useHomeFeed";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { useCallback } from "react";
import { useInfiniteScrollSentinel } from "../hooks/useInfiniteScrollSentinel";
import ForumCommentCard from "./ForumCommentCard";
import UserActivityCard from "./UserActivityCard";

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

  const handleLike = useCallback(
    (activityId: number) => {
      return handleLikeActivity(activityId);
    },
    [handleLikeActivity],
  );

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
        {items.map((item) => {
          switch (item.type) {
            case "activity": {
              return (
                item.activity && (
                  <UserActivityCard
                    activity={item.activity}
                    key={`activity-${item.activity.id}`}
                    handleLike={() => handleLike(item.activity!.id)}
                  />
                )
              );
            }
            case "forum_comment": {
              const fc = item.forumComment;
              if (!fc) return null;
              return (
                <ForumCommentCard
                  key={`comment-${fc.comment.id}`}
                  comment={fc.comment}
                  postId={fc.postId}
                  postTitle={fc.postTitle}
                  likedByMe={fc.likedByMe}
                  likesCount={fc.likesCount}
                  handleLike={() => handleLikeForumComment(fc.comment.id)}
                />
              );
            }
            default: {
              // Drop unknown variants so older clients don't crash on new server types.
              item.type satisfies never;
              return null;
            }
          }
        })}
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
