import { useCallback, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { router, RelativePathString } from "expo-router";
import {
  ActionActivityDto,
  actionsUpdateActivity,
  CreateEditableContentDto,
  imagesUploadImage,
} from "@alliance/shared/client";
import { formatTime } from "@alliance/shared/lib/utils";
import { Edit } from "lucide-react-native";
import { useAuth } from "../lib/AuthContext";
import ProfileImage from "./ProfileImage";
import LikeButton from "./LikeButton";
import Comments from "./Comments";
import EditableContentForm from "./EditableContentForm";
import EditableContentRenderer from "./EditableContentRenderer";
import Button, { ButtonColor, ButtonSize } from "./system/Button";
import Text from "./system/Text";

interface UserActivityCardProps {
  activity: ActionActivityDto;
  handleLike: (activityId: number) => void;
  onActivityUpdate?: (updatedActivity: ActionActivityDto) => void;
  canEdit?: boolean;
}

export default function UserActivityCard({
  activity,
  handleLike,
  onActivityUpdate,
  canEdit = false,
}: UserActivityCardProps) {
  const { user: self } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState<CreateEditableContentDto>(
    activity.editableContent ?? { body: "", attachments: [] }
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showCommentForm, setShowCommentForm] = useState(false);

  const completed = activity.type === "user_completed";

  const handleActionPress = useCallback(() => {
    router.push(`/actions/${activity.actionId}` as RelativePathString);
  }, [activity.actionId]);

  const handleActivityPress = useCallback(() => {
    if (isEditing || isSaving || showCommentForm) return;
    router.push(
      `/actions/${activity.actionId}/activity/${activity.id}` as RelativePathString
    );
  }, [activity.actionId, activity.id, isEditing, isSaving, showCommentForm]);

  const handleUserPress = useCallback(() => {
    router.push(`/user/${activity.user.id}` as RelativePathString);
  }, [activity.user.id]);

  const timeSinceCompleted = formatTime(new Date(activity.createdAt), {
    addSuffix: true,
  });

  const handleEdit = useCallback(() => {
    setEditContent({
      body: activity.editableContent.body,
      attachments: activity.editableContent.attachments,
    });
    setIsEditing(true);
  }, [activity.editableContent]);

  const handleSave = useCallback(async () => {
    if (!self || isSaving) return;

    setIsSaving(true);
    try {
      const uploads = await Promise.all(
        (editContent.attachments || []).map(async (img) => {
          if (img.startsWith("data:")) {
            const res = await imagesUploadImage({ body: { file: img } });
            return res.data?.key;
          }
          return img;
        })
      );
      const attachmentKeys = uploads.filter((key) => key !== undefined);

      const response = await actionsUpdateActivity({
        path: { id: activity.id },
        body: {
          editableContent: {
            body: editContent.body,
            attachments: attachmentKeys,
          },
        },
      });

      if (response.error) {
        console.error("Error updating activity:", response.error);
        return;
      }

      if (response.data && onActivityUpdate) {
        onActivityUpdate(response.data);
      }

      setIsEditing(false);
    } catch (error) {
      console.error("Error updating activity:", error);
    } finally {
      setIsSaving(false);
    }
  }, [self, isSaving, editContent, activity.id, onActivityUpdate]);

  const handleCancel = useCallback(() => {
    setEditContent({
      body: activity.editableContent.body,
      attachments: activity.editableContent.attachments,
    });
    setIsEditing(false);
  }, [activity.editableContent]);

  return (
    <View className="bg-white">
      <TouchableOpacity
        activeOpacity={isEditing || isSaving || showCommentForm ? 1 : 0.7}
        onPress={handleActivityPress}
        disabled={isEditing || isSaving || showCommentForm}
        className="p-4"
      >
        {/* Header: User info and action */}
        <View className="flex-row items-start flex-wrap">
          <TouchableOpacity onPress={handleUserPress} activeOpacity={0.7}>
            <ProfileImage pfp={activity.user.profilePicture} size="small" />
          </TouchableOpacity>
          <View className="flex-1 ml-2">
            <Text className="text-zinc-900">
              <Text className="font-medium" onPress={handleUserPress}>
                {activity.user.displayName}
              </Text>
              <Text>{completed ? " completed " : " committed to "}</Text>
              <Text
                className="text-green font-medium"
                onPress={handleActionPress}
              >
                {activity.actionName || "this action"}
              </Text>
            </Text>
          </View>
        </View>

        {/* Content */}
        {isEditing ? (
          <View className="mt-3 border border-zinc-200 rounded p-3 bg-zinc-50">
            <EditableContentForm
              value={editContent}
              onChange={setEditContent}
              placeholder="Add a description..."
              restoreDraft={false}
            />
            <View className="flex-row justify-end gap-x-2 mt-3">
              <Button
                color={ButtonColor.White}
                size={ButtonSize.Small}
                title="Cancel"
                onPress={handleCancel}
                disabled={isSaving}
              />
              <Button
                color={ButtonColor.Black}
                size={ButtonSize.Small}
                title={isSaving ? "Saving..." : "Save"}
                onPress={handleSave}
                disabled={isSaving}
              />
            </View>
          </View>
        ) : (
          <>
            {(!!activity.editableContent?.body ||
              (activity.editableContent?.attachments?.length ?? 0) > 0) && (
              <View className="mt-3">
                <EditableContentRenderer content={activity.editableContent} />
              </View>
            )}
          </>
        )}

        {/* Footer: Time and actions */}
        {!isEditing && (
          <View className="flex-row justify-between items-center mt-3">
            <Text className="text-zinc-500 text-sm">{timeSinceCompleted}</Text>
            <View className="flex-row items-center gap-x-3">
              <LikeButton
                liked={activity.likedByMe ?? false}
                likes={activity.likesCount}
                onPress={() => handleLike(activity.id)}
                bordered
              />
              {canEdit && (
                <TouchableOpacity
                  onPress={handleEdit}
                  activeOpacity={0.7}
                  className="flex-row items-center gap-x-1 border border-zinc-300 rounded px-2 py-1"
                >
                  <Edit size={14} color="#52525b" />
                  <Text className="text-sm text-zinc-600">Edit</Text>
                </TouchableOpacity>
              )}
              {completed && (
                <TouchableOpacity
                  onPress={() => setShowCommentForm(true)}
                  activeOpacity={0.7}
                  className="border border-zinc-300 rounded px-2 py-1"
                >
                  <Text className="text-sm text-zinc-600">Reply</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* Comments section */}
      {completed && (
        <View className="px-4">
          <Comments
            objectId={activity.id}
            type="activity"
            initialComments={activity.comments}
            compact
            showForm={showCommentForm}
            autofocus={showCommentForm}
          />
        </View>
      )}
    </View>
  );
}
