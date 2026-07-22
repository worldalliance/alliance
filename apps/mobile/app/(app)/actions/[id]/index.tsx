import {
  ActionActivityDto,
  ActionReviewerIcon,
  actionsGetActionActivities,
  actionsLikeActivity,
  actionsUnlikeActivity,
} from "@alliance/shared/client";
import { actionActivityDtoIsVisibleInFeed } from "@alliance/shared/lib/actionActivity";
import { useActionHandlers } from "@alliance/shared/lib/actionPage";
import { getNextEvent } from "@alliance/shared/lib/largeActionCard";
import { nameListSeparator } from "@alliance/shared/lib/nameList";
import { cn } from "@alliance/shared/styles/util";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Linking,
  Pressable,
  RefreshControl,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollViewRef } from "react-native-keyboard-controller";
import ActionEventsPanel from "../../../../components/ActionEventsPanel";
import ActionPageTaskPanel from "../../../../components/ActionPageTaskPanel";
import AppMarkdownWrapper from "../../../../components/AppMarkdownWrapper";
import Comments from "../../../../components/Comments";
import KeyboardAwareScrollView from "../../../../components/KeyboardAwareScrollView";
import BackButton from "../../../../components/system/BackButton";
import Button, { ButtonColor } from "../../../../components/system/Button";
import LinkedInIcon from "../../../../components/system/LinkedInIcon";
import Text, {
  FontFamily,
  FontWeight,
} from "../../../../components/system/Text";
import TaskTimeInfo from "../../../../components/TaskTimeInfo";
import UserActivityCard from "../../../../components/UserActivityCard";
import { colors } from "../../../../lib/style/colors";

const ReviewerIcon = ({ icon }: { icon: ActionReviewerIcon }) => {
  switch (icon) {
    case "linkedin":
      return (
        <View className="mr-1">
          <LinkedInIcon size={14} />
        </View>
      );
    default:
      icon satisfies never;
      return null;
  }
};

const openReviewerLink = (url: string) => {
  Linking.openURL(url).catch((err) => {
    console.error("Failed to open reviewer link", err);
  });
};

type TabId = "task" | "activity" | "description" | "comments";

const tabs: { id: TabId; label: string }[] = [
  { id: "task", label: "Task" },
  { id: "activity", label: "Activity" },
  { id: "description", label: "Description" },
  { id: "comments", label: "Comments" },
];

interface ActivityTabContentProps {
  actionId: number;
}

function ActivityTabContent({ actionId }: ActivityTabContentProps) {
  const queryClient = useQueryClient();

  const { data: activitiesResponse, isPending } = useQuery({
    queryKey: ["actionActivities", actionId],
    queryFn: () =>
      actionsGetActionActivities({
        path: { id: actionId },
        query: { limit: 50, comments: true, before: new Date().toISOString() },
      }),
  });

  const activities = (activitiesResponse?.data ?? []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const likeMutation = useMutation({
    mutationFn: async ({
      activityId,
      isLiked,
    }: {
      activityId: number;
      isLiked: boolean;
    }) => {
      const response = isLiked
        ? await actionsUnlikeActivity({ path: { id: activityId } })
        : await actionsLikeActivity({ path: { id: activityId } });
      if (response.response.ok && response.data) return response.data;
      throw new Error("Like request failed");
    },
    onMutate: async ({ activityId, isLiked }) => {
      const queryKey = ["actionActivities", actionId];
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(
        queryKey,
        (oldData: typeof activitiesResponse) => {
          if (!oldData?.data) return oldData;
          return {
            ...oldData,
            data: oldData.data.map((a: ActionActivityDto) =>
              a.id === activityId
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

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          ["actionActivities", actionId],
          context.previousData,
        );
      }
    },
    onSuccess: (data, { activityId }) => {
      queryClient.setQueryData(
        ["actionActivities", actionId],
        (oldData: typeof activitiesResponse) => {
          if (!oldData?.data) return oldData;
          return {
            ...oldData,
            data: oldData.data.map((a) =>
              a.id === activityId
                ? {
                    ...a,
                    likes: data.likes,
                    likesCount: data.likesCount,
                    likedByMe: data.likedByMe,
                  }
                : a,
            ),
          };
        },
      );
    },
  });

  const handleLike = useCallback(
    async (activityId: number) => {
      const activity = activities.find((a) => a.id === activityId);
      if (!activity) return;
      await likeMutation.mutateAsync({
        activityId,
        isLiked: activity.likedByMe ?? false,
      });
    },
    [activities, likeMutation],
  );

  if (isPending) {
    return (
      <View className="py-8 items-center">
        <ActivityIndicator size="small" color={colors.green} />
      </View>
    );
  }

  if (activities.length === 0) {
    return (
      <View className="py-8 items-center">
        <Text className="text-zinc-500">No activity yet</Text>
      </View>
    );
  }

  return (
    <View>
      {activities.map(
        (activity) =>
          actionActivityDtoIsVisibleInFeed(activity) && (
            <View
              key={activity.id}
              className="-mx-4 border-b-3 border-zinc-100"
            >
              <UserActivityCard activity={activity} handleLike={handleLike} />
            </View>
          ),
      )}
    </View>
  );
}

export default function ActionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabId>("task");
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const reloadTasks = useCallback(() => {
    router.reload();
  }, []);

  const { action, loading, refetchAction, onCompleteAction, onOptOutAction } =
    useActionHandlers(parseInt(id), true, reloadTasks);

  const scrollViewRef = useRef<KeyboardAwareScrollViewRef>(null);

  const onRefresh = useCallback(async () => {
    if (!action) return;
    setRefreshing(true);
    try {
      await refetchAction({ silent: true });
      if (activeTab === "activity") {
        await queryClient.refetchQueries({
          queryKey: ["actionActivities", action.id],
        });
      }
    } finally {
      setRefreshing(false);
    }
  }, [action, refetchAction, queryClient, activeTab]);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center p-5 bg-white">
        <ActivityIndicator size="large" color="#333" />
        <Text className="mt-3 text-zinc-500">Loading action details...</Text>
      </View>
    );
  }

  if (!action) {
    return (
      <View className="flex-1 justify-center items-center p-5 bg-white">
        <Text className="text-red-500 mb-5 text-center">
          Could not load action
        </Text>
        <Button
          color={ButtonColor.Black}
          onPress={() => router.back()}
          title="Go Back"
        />
      </View>
    );
  }

  const scrollPageTo = (y: number, animated = true) => {
    scrollViewRef.current?.scrollTo({ y, animated });
  };

  const scrollToEnd = (animated = true) => {
    scrollViewRef.current?.scrollToEnd({ animated });
  };

  const nextEvent = getNextEvent(action);

  const renderTabContent = () => {
    switch (activeTab) {
      case "task":
        return (
          <View>
            {action.status !== "planned" ? (
              <View>
                <View className="mb-4 flex flex-col gap-1 w-full">
                  <Text
                    className="text-xl text-zinc-900"
                    weight={FontWeight.Semibold}
                  >
                    Task
                  </Text>

                  <TaskTimeInfo
                    action={action}
                    nextEvent={nextEvent}
                    absoluteDeadline={true}
                    className="flex-row gap-x-1 items-start"
                    filled={true}
                  />
                </View>
                <ActionPageTaskPanel
                  scrollPageTo={scrollPageTo}
                  scrollToEnd={scrollToEnd}
                  action={action}
                  onCompleteAction={onCompleteAction}
                  onOptOutAction={onOptOutAction}
                />
              </View>
            ) : (
              <View className="py-8 items-center">
                <Text className="text-zinc-500">
                  This action is still being planned
                </Text>
              </View>
            )}
          </View>
        );

      case "activity":
        return <ActivityTabContent actionId={action.id} />;

      case "description":
        return (
          <View>
            <AppMarkdownWrapper>{action.body}</AppMarkdownWrapper>
          </View>
        );

      case "comments":
        return <Comments objectId={action.id} type="action" />;

      default:
        return null;
    }
  };

  return (
    <>
      <KeyboardAwareScrollView
        className="bg-white"
        ref={scrollViewRef}
        keyboardShouldPersistTaps="handled"
        testID="vr-action-detail-ready"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {action.image && (
          <Image
            source={{ uri: action.image }}
            className="w-full h-48 bg-zinc-200"
            resizeMode="cover"
          />
        )}
        <View className="p-4">
          <View className="self-start mb-4">
            <BackButton fallbackRoute="/actions" />
          </View>
          <Text
            className="text-2xl text-zinc-900 mb-2"
            family={FontFamily.Serif}
            weight={FontWeight.Semibold}
          >
            {action.name}
          </Text>
          {action.shortDescription && (
            <Text className="mb-1 text-zinc-600">
              {action.shortDescription}
            </Text>
          )}
          {(!!action.authors?.length || action.reviewers.length > 0) && (
            <View className="mb-6">
              {action.authors && action.authors.length > 0 && (
                <View className="flex-row flex-wrap items-center">
                  <Text className="text-zinc-500 text-sm">By </Text>
                  {action.authors.map((author, i) => (
                    <View key={author.id} className="flex-row items-center">
                      <Pressable
                        onPress={() => router.push(`/member/${author.id}`)}
                      >
                        <Text className="text-zinc-500 underline text-sm">
                          {author.displayName}
                        </Text>
                      </Pressable>
                      {i < action.authors!.length - 1 && (
                        <Text className="text-zinc-500 text-sm">
                          {nameListSeparator(i, action.authors!.length)}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
              {action.reviewers.length > 0 && (
                <View
                  className={cn(
                    "flex-row flex-wrap items-center",
                    !!action.authors?.length && "mt-1",
                  )}
                >
                  <Text className="text-zinc-500 text-sm">Reviewed by </Text>
                  {action.reviewers.map((reviewer, i) => (
                    <View key={i} className="flex-row items-center">
                      {reviewer.url ? (
                        <Pressable
                          className="flex-row items-center"
                          onPress={() => openReviewerLink(reviewer.url!)}
                        >
                          {reviewer.icon && (
                            <ReviewerIcon icon={reviewer.icon} />
                          )}
                          <Text className="text-zinc-500 underline text-sm">
                            {reviewer.name}
                          </Text>
                        </Pressable>
                      ) : (
                        <>
                          {reviewer.icon && (
                            <ReviewerIcon icon={reviewer.icon} />
                          )}
                          <Text className="text-zinc-500 text-sm">
                            {reviewer.name}
                          </Text>
                        </>
                      )}
                      {i < action.reviewers.length - 1 && (
                        <Text className="text-zinc-500 text-sm">
                          {nameListSeparator(i, action.reviewers.length)}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
          {action.events && action.events.length > 0 && (
            <View className="mb-6">
              <ActionEventsPanel action={action} />
            </View>
          )}

          <View className="flex-row border-b border-zinc-200 mb-4 w-full">
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.id}
                onPress={() => {
                  Keyboard.dismiss();
                  setActiveTab(tab.id);
                }}
                className={cn(
                  "py-2 items-center grow",
                  activeTab === tab.id && "border-b-2 border-green",
                )}
                activeOpacity={0.7}
              >
                <Text
                  className={cn(
                    "text-sm",
                    activeTab === tab.id ? "text-green" : "text-zinc-500",
                  )}
                  weight={FontWeight.Medium}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View className="pb-10">{renderTabContent()}</View>
        </View>
      </KeyboardAwareScrollView>
    </>
  );
}
