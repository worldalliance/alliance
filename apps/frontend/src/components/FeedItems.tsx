import type { ParsedHomeFeedItemDto } from "@alliance/shared/lib/feedHelpers";
import ForumCommentCard from "./ForumCommentCard";
import UserActivityCard from "./UserActivityCard";

interface FeedItemsProps {
  items: ParsedHomeFeedItemDto[];
  handleLikeActivity: (activityId: number) => Promise<unknown>;
  handleLikeForumComment: (commentId: number) => Promise<unknown>;
}

const FeedItems = ({
  items,
  handleLikeActivity,
  handleLikeForumComment,
}: FeedItemsProps) =>
  items.map((item) => {
    switch (item.type) {
      case "activity": {
        return (
          item.activity && (
            <UserActivityCard
              activity={item.activity}
              key={`activity-${item.activity.id}`}
              handleLike={handleLikeActivity}
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
  });

export default FeedItems;
