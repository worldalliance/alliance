import { actionActivityTransitiveVerb } from "@alliance/common/actionActivity";
import {
  ActionActivityDto,
  actionsGetActivity,
  actionsLikeActivity,
  actionsUnlikeActivity,
} from "@alliance/shared/client";
import { canToggleLike } from "@alliance/shared/lib/actionUtils";
import {
  InfiniteActivityData,
  mapInfiniteActivities,
} from "@alliance/shared/lib/useActivities";
import { formatTime } from "@alliance/shared/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import Comments from "../../../../../components/Comments";
import EditableContentRenderer from "../../../../../components/EditableContentRenderer";
import LikeFooter from "../../../../../components/LikeFooter";
import OutputRenderer from "../../../../../components/OutputRenderer";
import ProfileImage from "../../../../../components/ProfileImage";
import BackButton from "../../../../../components/system/BackButton";
import Text, {
  FontFamily,
  FontWeight,
} from "../../../../../components/system/Text";
import { colors } from "../../../../../lib/style/colors";

export default function ActivityDetailScreen() {
  const { id, activityId } = useLocalSearchParams<{
    id: string;
    activityId: string;
  }>();

  const [activity, setActivity] = useState<ActionActivityDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const fetchActivity = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!activityId) return;
      const silent = options?.silent ?? false;
      try {
        if (!silent) {
          setLoading(true);
          setError(null);
        }
        const resp = await actionsGetActivity({
          path: { id: parseInt(activityId) },
        });
        if (resp.data) {
          setActivity(resp.data);
        } else {
          setError("Activity not found");
        }
      } catch {
        if (!silent) setError("Failed to load activity");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [activityId],
  );

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchActivity({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [fetchActivity]);

  const handleBack = useCallback(() => {
    router.dismissTo(`/actions/${id}`);
  }, [id]);

  const handleUserPress = useCallback(() => {
    if (activity?.user.id) {
      router.push(`/member/${activity.user.id}`);
    }
  }, [activity?.user.id]);

  const actionId = Number(id);

  const likeMutation = useMutation({
    mutationFn: async (isLiked: boolean) => {
      if (!activity) throw new Error("No activity");
      const response = isLiked
        ? await actionsUnlikeActivity({ path: { id: activity.id } })
        : await actionsLikeActivity({ path: { id: activity.id } });
      if (response.response.ok && response.data) return response.data;
      throw new Error("Like request failed");
    },
    onMutate: async (isLiked: boolean) => {
      const previousActivity = activity;

      setActivity((prev: ActionActivityDto | null) =>
        prev
          ? {
              ...prev,
              likedByMe: !isLiked,
              likesCount: isLiked ? prev.likesCount - 1 : prev.likesCount + 1,
            }
          : prev,
      );

      await queryClient.cancelQueries({
        queryKey: ["actionActivities", actionId],
      });
      const previousActionActivities = queryClient.getQueryData([
        "actionActivities",
        actionId,
      ]);
      queryClient.setQueryData(
        ["actionActivities", actionId],
        (oldData: { data?: ActionActivityDto[] } | undefined) => {
          if (!oldData?.data) return oldData;
          return {
            ...oldData,
            data: oldData.data.map((a) =>
              a.id === activity?.id
                ? {
                    ...a,
                    likedByMe: !isLiked,
                    likesCount: isLiked ? a.likesCount - 1 : a.likesCount + 1,
                  }
                : a,
            ),
          };
        },
      );

      await queryClient.cancelQueries({ queryKey: ["useActivities"] });
      const previousFeedQueries =
        queryClient.getQueriesData<InfiniteActivityData>({
          queryKey: ["useActivities"],
        });
      queryClient.setQueriesData<InfiniteActivityData>(
        { queryKey: ["useActivities"] },
        (old) =>
          mapInfiniteActivities(old, (a) =>
            a.id === activity?.id
              ? {
                  ...a,
                  likedByMe: !isLiked,
                  likesCount: isLiked ? a.likesCount - 1 : a.likesCount + 1,
                }
              : a,
          ),
      );

      return {
        previousActivity,
        previousActionActivities,
        previousFeedQueries,
      };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousActivity) {
        setActivity(context.previousActivity);
      }
      if (context?.previousActionActivities) {
        queryClient.setQueryData(
          ["actionActivities", actionId],
          context.previousActionActivities,
        );
      }
      context?.previousFeedQueries?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSuccess: (data) => {
      setActivity((prev: ActionActivityDto | null) =>
        prev
          ? {
              ...prev,
              likes: data.likes,
              likesCount: data.likesCount,
              likedByMe: data.likedByMe,
            }
          : prev,
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["actionActivities", actionId],
      });
      queryClient.invalidateQueries({ queryKey: ["useActivities"] });
    },
  });

  const handleLike = useCallback(async () => {
    if (!activity) return;
    await likeMutation.mutateAsync(activity.likedByMe ?? false);
  }, [activity, likeMutation]);

  const verb = activity && actionActivityTransitiveVerb[activity.type];

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
    <KeyboardStickyView
      className="flex-1 bg-white"
      offset={{ closed: 0, opened: 90 }}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="p-4">
          <BackButton
            fallbackRoute={`/actions/${id}`}
            className="mb-4"
            bordered
          />
          <Text
            className="text-2xl mb-4"
            family={FontFamily.Serif}
            weight={FontWeight.Semibold}
          >
            {activity.actionName}
          </Text>
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
                  <Text weight={FontWeight.Medium} onPress={handleUserPress}>
                    {activity.user.displayName}
                  </Text>
                  <Text> {verb} this action</Text>
                </Text>
              </View>
            </View>
          </View>

          {activity.formResponseOutput &&
            Object.keys(activity.formResponseOutput.publicAnswers ?? {})
              .length > 0 && (
              <View className="my-3">
                <OutputRenderer submission={activity.formResponseOutput} />
              </View>
            )}

          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-zinc-500 text-sm">
              {formatTime(new Date(activity.createdAt), { addSuffix: true })}
            </Text>
          </View>

          {(!!activity.editableContent?.body ||
            (activity.editableContent?.attachments?.length ?? 0) > 0) && (
            <View className="mb-4">
              <EditableContentRenderer content={activity.editableContent} />
            </View>
          )}

          <View className="mb-6">
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
                  ? handleLike
                  : undefined
              }
              align="right"
            />
          </View>

          <Text className="text-zinc-900 mb-3" weight={FontWeight.Medium}>
            Comments
          </Text>
          <Comments
            objectId={activity.id}
            type="activity"
            discussionClosed={activity.discussionClosed}
          />
        </View>
      </ScrollView>
    </KeyboardStickyView>
  );
}
