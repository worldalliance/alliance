import { ParsedHomeFeedItemDto } from "@alliance/shared/lib/feedHelpers";
import { View } from "react-native";
import { colors } from "../lib/style/colors";
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
        <View className={`border-b-3`} style={{ borderColor: colors.grey[1] }}>
          <UserActivityCard
            activity={item.activity}
            handleLike={onLikeActivity}
          />
        </View>
      );
    }
    case "forum_comment": {
      const fc = item.forumComment;
      if (!fc) return null;
      const { comment, postId, postTitle, likedByMe, likesCount } = fc;
      return (
        <View className={`border-b-3`} style={{ borderColor: colors.grey[1] }}>
          <ForumCommentCard
            comment={comment}
            postId={postId}
            postTitle={postTitle}
            likedByMe={likedByMe}
            likesCount={likesCount}
            handleLike={() => onLikeForumComment(comment.id)}
          />
        </View>
      );
    }
    default: {
      item.type satisfies never;
      return null;
    }
  }
}
