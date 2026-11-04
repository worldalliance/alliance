import { ParsedHomeFeedItemDto } from "@alliance/shared/lib/feedHelpers";
import FeedSeparator from "./FeedSeparator";
import ForumCommentCard from "./ForumCommentCard";
import UserActivityCard from "./UserActivityCard";

interface HomeFeedItemProps {
  item: ParsedHomeFeedItemDto;
  onLikeActivity: (activityId: number) => Promise<unknown>;
  onLikeForumComment: (commentId: number) => Promise<unknown>;
}

export default function HomeFeedItem({
  item,
  onLikeActivity,
  onLikeForumComment,
}: HomeFeedItemProps) {
  switch (item.type) {
    case "activity": {
      if (!item.activity) return null;
      return (
        <FeedSeparator>
          <UserActivityCard
            activity={item.activity}
            handleLike={onLikeActivity}
          />
        </FeedSeparator>
      );
    }
    case "forum_comment": {
      const fc = item.forumComment;
      if (!fc) return null;
      const { comment, postId, postTitle, likedByMe, likesCount } = fc;
      return (
        <FeedSeparator>
          <ForumCommentCard
            comment={comment}
            postId={postId}
            postTitle={postTitle}
            likedByMe={likedByMe}
            likesCount={likesCount}
            handleLike={() => onLikeForumComment(comment.id)}
          />
        </FeedSeparator>
      );
    }
    default: {
      item.type satisfies never;
      return null;
    }
  }
}
