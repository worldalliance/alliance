import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActionActivityDto,
  actionsGetActivity,
  actionsLikeActivity,
  actionsUnlikeActivity,
  actionsUpdateActivity,
  CreateEditableContentDto,
  imagesUploadImage,
} from "@alliance/shared/client";
import { formatTime } from "@alliance/shared/lib/utils";
import { ChevronLeft } from "lucide-react-native";
import { useAuth } from "../../../../../lib/AuthContext";
import { colors } from "../../../../../lib/style/colors";
import Text from "../../../../../components/system/Text";
import Button, {
  ButtonColor,
  ButtonSize,
} from "../../../../../components/system/Button";
import ProfileImage from "../../../../../components/ProfileImage";
import LikeButton from "../../../../../components/LikeButton";
import Comments from "../../../../../components/Comments";
import EditableContentForm from "../../../../../components/EditableContentForm";
import EditableContentRenderer from "../../../../../components/EditableContentRenderer";
import { actionActivityTransitiveVerb } from "@alliance/shared/lib/actionActivityConstants";

export default function ActivityDetailScreen() {
  const { id, activityId } = useLocalSearchParams<{
    id: string;
    activityId: string;
  }>();
  const { user } = useAuth();

  const [activity, setActivity] = useState<ActionActivityDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState<CreateEditableContentDto>({
    body: "",
    attachments: [],
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!activityId) return;

    setLoading(true);
    actionsGetActivity({ path: { id: parseInt(activityId) } })
      .then((resp) => {
        if (resp.data) {
          setActivity(resp.data);
          setEditContent({
            body: resp.data.editableContent?.body ?? "",
            attachments: resp.data.editableContent?.attachments ?? [],
          });
        } else {
          setError("Activity not found");
        }
      })
      .catch(() => {
        setError("Failed to load activity");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [activityId]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(`/actions/${id}`);
    }
  }, [id]);

  const handleUserPress = useCallback(() => {
    if (activity?.user.id) {
      router.push(`/user/${activity.user.id}`);
    }
  }, [activity?.user.id]);

  const handleLike = useCallback(async () => {
    if (!activity) return;

    const isLiked = activity.likedByMe ?? false;

    if (isLiked) {
      const response = await actionsUnlikeActivity({
        path: { id: activity.id },
      });
      if (response.data) {
        setActivity((prev) =>
          prev
            ? {
                ...prev,
                likes: response.data!.likes,
                likesCount: response.data!.likesCount,
                likedByMe: response.data!.likedByMe,
              }
            : prev
        );
      }
    } else {
      const response = await actionsLikeActivity({
        path: { id: activity.id },
      });
      if (response.data) {
        setActivity((prev) =>
          prev
            ? {
                ...prev,
                likes: response.data!.likes,
                likesCount: response.data!.likesCount,
                likedByMe: response.data!.likedByMe,
              }
            : prev
        );
      }
    }
  }, [activity]);

  const handleEdit = useCallback(() => {
    if (!activity) return;
    setEditContent({
      body: activity.editableContent?.body ?? "",
      attachments: activity.editableContent?.attachments ?? [],
    });
    setIsEditing(true);
  }, [activity]);

  const handleSave = useCallback(async () => {
    if (!user || !activity || isSaving) return;

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

      if (response.data) {
        setActivity(response.data);
      }

      setIsEditing(false);
    } catch (err) {
      console.error("Error updating activity:", err);
    } finally {
      setIsSaving(false);
    }
  }, [user, activity, isSaving, editContent]);

  const handleCancel = useCallback(() => {
    if (!activity) return;
    setEditContent({
      body: activity.editableContent?.body ?? "",
      attachments: activity.editableContent?.attachments ?? [],
    });
    setIsEditing(false);
  }, [activity]);

  const verb = activity ? actionActivityTransitiveVerb[activity.type] : null;
  const isOwner = activity?.user.id === user?.id;

  if (loading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  if (error || !activity) {
    return (
      <View className="flex-1 bg-white items-center justify-center p-4">
        <Text className="text-red-500 text-center">
          {error || "Activity not found"}
        </Text>
        <TouchableOpacity onPress={handleBack} className="mt-4">
          <Text className="text-green">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Header */}
        <View className="p-4 pt-12">
          {/* Back button */}
          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.7}
            className="flex-row items-center gap-x-1 self-start px-2 py-1 rounded border border-zinc-200 mb-6"
          >
            <ChevronLeft size={16} color="#52525b" />
            <Text className="text-zinc-600 text-sm">Back to action</Text>
          </TouchableOpacity>

          {/* Action name */}
          <Text className="text-2xl font-serif font-semibold mb-4">
            {activity.actionName}
          </Text>

          {/* User info row */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-x-2 flex-1">
              <TouchableOpacity onPress={handleUserPress} activeOpacity={0.7}>
                <ProfileImage
                  pfp={activity.user.profilePicture}
                  size="medium"
                />
              </TouchableOpacity>
              <View className="flex-1">
                <Text className="text-zinc-900">
                  <Text className="font-medium" onPress={handleUserPress}>
                    {activity.user.displayName}
                  </Text>
                  <Text> {verb} this action</Text>
                </Text>
              </View>
            </View>
          </View>

          {/* Timestamp and edit button */}
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-zinc-500 text-sm">
              {formatTime(new Date(activity.createdAt), { addSuffix: true })}
            </Text>
            {isOwner && !isEditing && (
              <TouchableOpacity onPress={handleEdit} activeOpacity={0.7}>
                <Text className="text-green text-sm">
                  {activity.editableContent?.body
                    ? "Edit details"
                    : "Add details"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Content */}
          {isEditing ? (
            <View className="border border-zinc-200 rounded p-3 bg-zinc-50 mb-4">
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
                <View className="mb-4">
                  <EditableContentRenderer content={activity.editableContent} />
                </View>
              )}
            </>
          )}

          {/* Like button */}
          <View className="flex-row items-center mb-6">
            <LikeButton
              liked={activity.likedByMe ?? false}
              likes={activity.likesCount}
              onPress={handleLike}
              bordered
            />
          </View>

          {/* Comments */}
          <View>
            <Text className="font-medium text-zinc-900 mb-3">Comments</Text>
            <Comments
              objectId={activity.id}
              type="activity"
              initialComments={activity.comments}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
