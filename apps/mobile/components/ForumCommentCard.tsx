import { commentPath } from "@alliance/common/commentPath";
import { CommentDto } from "@alliance/shared/client";
import { formatTime } from "@alliance/shared/lib/utils";
import { RelativePathString, router } from "expo-router";
import { MessageCircleIcon } from "lucide-react-native";
import { TouchableOpacity, View } from "react-native";
import EditableContentRenderer from "./EditableContentRenderer";
import LikeFooter, { LikeBarButton } from "./LikeFooter";
import ProfileImage from "./ProfileImage";
import Text, { FontWeight } from "./system/Text";

interface ForumCommentCardProps {
  comment: CommentDto;
  postId: number;
  postTitle: string;
  likedByMe: boolean;
  likesCount: number;
  handleLike: () => Promise<unknown>;
}

export default function ForumCommentCard({
  comment,
  postId,
  postTitle,
  likedByMe,
  likesCount,
  handleLike,
}: ForumCommentCardProps) {
  const timeSinceCommented = formatTime(new Date(comment.createdAt), {
    addSuffix: true,
  });
  const hasBody =
    !!comment.editableContent.body ||
    comment.editableContent.attachments.length > 0;
  const replyUrl = commentPath({
    parentObjectType: "post",
    parentObjectId: postId,
    id: comment.id,
  }) as RelativePathString;

  return (
    <View className="bg-white p-4">
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push(replyUrl)}
      >
        <View className="flex-row items-start flex-wrap">
          <TouchableOpacity
            onPress={() =>
              router.push(`/member/${comment.author.id}` as RelativePathString)
            }
            activeOpacity={0.7}
          >
            <ProfileImage pfp={comment.author.profilePicture} size="medium" />
          </TouchableOpacity>
          <View className="flex flex-col gap-y-1 flex-1 ml-2">
            <Text className="text-zinc-900">
              <Text
                weight={FontWeight.Medium}
                onPress={() =>
                  router.push(
                    `/member/${comment.author.id}` as RelativePathString,
                  )
                }
              >
                {comment.author.displayName}
              </Text>
              <Text>{` commented on `}</Text>
              <Text
                className="text-green"
                weight={FontWeight.Medium}
                onPress={() =>
                  router.push(`/forum/post/${postId}` as RelativePathString)
                }
              >
                {postTitle}
              </Text>
            </Text>
            <Text className="text-zinc-500 text-xs">{timeSinceCommented}</Text>
          </View>
        </View>

        {hasBody && (
          <View className="my-3 rounded-lg bg-zinc-100 p-4">
            <EditableContentRenderer content={comment.editableContent} />
          </View>
        )}

        <LikeFooter
          likeTargetType="comment"
          likeTargetId={comment.id}
          liked={likedByMe}
          likesCount={likesCount}
          likers={comment.likes}
          onLike={handleLike}
        >
          <LikeBarButton
            icon={MessageCircleIcon}
            label="Reply"
            onPress={() => router.push(replyUrl)}
          />
        </LikeFooter>
      </TouchableOpacity>
    </View>
  );
}
