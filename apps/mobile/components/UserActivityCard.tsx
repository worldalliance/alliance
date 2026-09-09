import {
  actionActivityCommentable,
  actionActivityTransitiveVerb,
} from "@alliance/common/actionActivity";
import { FeedActionActivityDto } from "@alliance/shared/lib/actionActivity";
import { canToggleLike } from "@alliance/shared/lib/actionUtils";
import { formatTime } from "@alliance/shared/lib/utils";
import { router } from "expo-router";
import { MessageCircleIcon } from "lucide-react-native";
import { useCallback, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import Comments from "./Comments";
import EditableContentRenderer from "./EditableContentRenderer";
import LikeFooter, { LikeBarButton } from "./LikeFooter";
import OutputRenderer from "./OutputRenderer";
import ProfileImage from "./ProfileImage";
import Text, { FontWeight } from "./system/Text";

interface UserActivityCardProps {
  activity: FeedActionActivityDto;
  handleLike: (activityId: number) => Promise<unknown>;
}

export default function UserActivityCard({
  activity,
  handleLike,
}: UserActivityCardProps) {
  const [showCommentForm, setShowCommentForm] = useState(false);

  const verb = actionActivityTransitiveVerb[activity.type];
  const commentable = actionActivityCommentable[activity.type];

  const handleActionPress = useCallback(() => {
    router.push(`/actions/${activity.actionId}`);
  }, [activity.actionId]);

  const handleActivityPress = useCallback(() => {
    if (showCommentForm) return;
    router.push(`/actions/${activity.actionId}/activity/${activity.id}`);
  }, [activity.actionId, activity.id, showCommentForm]);

  const handleUserPress = useCallback(() => {
    router.push(`/member/${activity.user.id}`);
  }, [activity.user.id]);

  const timeSinceCompleted = formatTime(new Date(activity.createdAt), {
    addSuffix: true,
  });

  return (
    <View className="bg-white p-4">
      <TouchableOpacity
        activeOpacity={showCommentForm ? 1 : 0.7}
        onPress={handleActivityPress}
        disabled={showCommentForm}
      >
        <View className="flex-row items-start flex-wrap">
          <TouchableOpacity onPress={handleUserPress} activeOpacity={0.7}>
            <ProfileImage pfp={activity.user.profilePicture} size="medium" />
          </TouchableOpacity>
          <View className="flex flex-col gap-y-1 flex-1 ml-2">
            <Text className="text-zinc-900">
              <Text weight={FontWeight.Medium} onPress={handleUserPress}>
                {activity.user.displayName}
              </Text>
              <Text>{` ${verb} `}</Text>
              <Text
                className="text-green"
                weight={FontWeight.Medium}
                onPress={handleActionPress}
              >
                {activity.actionName || "this action"}
              </Text>
            </Text>
            <Text className="text-zinc-500 text-xs">{timeSinceCompleted}</Text>
          </View>
        </View>

        {activity.formResponseOutput &&
          Object.keys(activity.formResponseOutput.publicAnswers ?? {}).length >
            0 && (
            <View className="my-3">
              <OutputRenderer submission={activity.formResponseOutput} />
            </View>
          )}

        {(!!activity.editableContent?.body ||
          (activity.editableContent?.attachments?.length ?? 0) > 0) && (
          <View className="mt-3">
            <EditableContentRenderer content={activity.editableContent} />
          </View>
        )}

        <LikeFooter
          likeTargetType="activity"
          likeTargetId={activity.id}
          liked={activity.likedByMe ?? false}
          likesCount={activity.likesCount}
          likers={activity.likes}
          onLike={
            canToggleLike({
              discussionClosed: activity.discussionClosed,
              liked: activity.likedByMe ?? false,
            })
              ? () => handleLike(activity.id)
              : undefined
          }
        >
          {commentable && !activity.discussionClosed && (
            <LikeBarButton
              icon={MessageCircleIcon}
              label="Comment"
              onPress={() => setShowCommentForm(true)}
            />
          )}
        </LikeFooter>
      </TouchableOpacity>

      {commentable && (
        <View className="mx-8 mt-3">
          <Comments
            objectId={activity.id}
            type="activity"
            initialComments={activity.comments}
            compact
            showForm={showCommentForm}
            autofocus={showCommentForm}
            small
            discussionClosed={activity.discussionClosed}
          />
        </View>
      )}
    </View>
  );
}
