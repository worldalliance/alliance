import { Check } from "lucide-react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import AppMarkdownWrapper from "../../../components/AppMarkdownWrapper";
import {
  ActionActivityDto,
  UserActionRelation,
  actionsGetActionActivities,
  actionsLikeActivity,
  actionsUnlikeActivity,
} from "@alliance/shared/client";
import Card, { CardStyle } from "../../../components/system/Card";
import Text from "../../../components/system/Text";
import ActionEventsPanel from "../../../components/ActionEventsPanel";
import TaskTimeInfo from "../../../components/TaskTimeInfo";
import { getLastAndNextEvent } from "@alliance/shared/lib/largeActionCard";
import ActionPageTaskPanel from "../../../components/ActionPageTaskPanel";
import { useActionHandlers } from "@alliance/shared/lib/actionPage";
import Button, { ButtonColor } from "../../../components/system/Button";
import Comments from "../../../components/Comments";
import ProfileImage from "../../../components/ProfileImage";
import { formatTime } from "@alliance/shared/lib/utils";
import LikeButton from "../../../components/LikeButton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { colors } from "../../../lib/style/colors";

type TabId = "task" | "activity" | "description" | "comments";

const tabs: { id: TabId; label: string }[] = [
  { id: "task", label: "Task" },
  { id: "activity", label: "Activity" },
  { id: "description", label: "Description" },
  { id: "comments", label: "Comments" },
];

interface ActivityItemProps {
  activity: ActionActivityDto;
  onLike: (activityId: number) => void;
}

function ActivityItem({ activity, onLike }: ActivityItemProps) {
  const verb = activity.type === "user_joined" ? "committed to" : "completed";

  if (
    !(activity.type === "user_joined" || activity.type === "user_completed")
  ) {
    return null;
  }

  return (
    <View className="flex-row gap-x-3 items-start py-3 border-b border-zinc-100">
      <ProfileImage pfp={activity.user.profilePicture} size="medium" />
      <View className="flex-1">
        <Text className="font-medium text-zinc-900">
          {activity.user.displayName}
        </Text>
        <Text className="text-zinc-500 text-sm">
          {verb}{" "}
          <Text className="text-green font-medium">{activity.actionName}</Text>
        </Text>
        <Text className="text-zinc-400 text-xs mt-1">
          {formatTime(new Date(activity.createdAt), { addSuffix: true })}
        </Text>
      </View>
      <LikeButton
        liked={activity.likedByMe ?? false}
        likes={activity.likesCount}
        onPress={() => onLike(activity.id)}
      />
    </View>
  );
}

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
        query: { limit: 50, comments: false },
      }),
  });

  const activities = (activitiesResponse?.data ?? []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const handleLike = useCallback(
    async (activityId: number) => {
      const activity = activities.find((a) => a.id === activityId);
      if (!activity) return;

      const isLiked = activity.likedByMe ?? false;

      const response = isLiked
        ? await actionsUnlikeActivity({ path: { id: activityId } })
        : await actionsLikeActivity({ path: { id: activityId } });

      if (response.response.ok && response.data) {
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
                      likes: response.data!.likes,
                      likesCount: response.data!.likesCount,
                      likedByMe: response.data!.likedByMe,
                    }
                  : a
              ),
            };
          }
        );
      }
    },
    [activities, actionId, queryClient]
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
      {activities.map((activity) => (
        <ActivityItem
          key={activity.id}
          activity={activity}
          onLike={handleLike}
        />
      ))}
    </View>
  );
}

export default function ActionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabId>("task");

  const reloadTasks = useCallback(() => {
    router.reload();
  }, []);

  const {
    action,
    loading,
    onCompleteAction,
    onJoinAction,
    onDeclineAction,
    onOptOutAction,
  } = useActionHandlers(parseInt(id), true, reloadTasks);

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

  const userRelation = action.userRelation as UserActionRelation | undefined;
  const { nextEvent, lastEvent } = getLastAndNextEvent(action);

  const renderTabContent = () => {
    switch (activeTab) {
      case "task":
        return (
          <View>
            {action.status !== "planned" ? (
              <View>
                <View className="mb-2 flex flex-row items-center gap-2 w-full">
                  <View className="flex-1">
                    <Text className="text-xl font-semibold text-zinc-900">
                      Task
                    </Text>
                  </View>
                  <TaskTimeInfo
                    action={action}
                    nextEvent={nextEvent}
                    lastEvent={lastEvent}
                  />
                </View>
                <ActionPageTaskPanel
                  action={action}
                  userRelation={userRelation ?? null}
                  onCompleteAction={onCompleteAction}
                  onJoinAction={onJoinAction}
                  onDeclineAction={onDeclineAction}
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
            {userRelation === "joined" &&
              action.status === "gathering_commitments" && (
                <Card cardStyle={CardStyle.Green} className="mt-4">
                  <View className="flex-row items-center gap-2">
                    <Check size={18} color="#166534" />
                    <Text className="text-green-800 font-medium flex-1">
                      You&apos;ve committed to participate. We&apos;ll notify
                      you when it&apos;s time to act.
                    </Text>
                  </View>
                </Card>
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
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <ScrollView className="flex-1 bg-white">
        {action.image && (
          <Image
            source={{ uri: action.image }}
            className="w-full h-48 bg-zinc-200"
            resizeMode="cover"
          />
        )}
        <View className="p-5 pt-8">
          <Text className="text-[24px] font-bold text-zinc-900 mb-2 font-serif-bold">
            {action.name}
          </Text>
          {action.shortDescription && (
            <Text className="mb-1 text-zinc-600">{action.shortDescription}</Text>
          )}
          {action.authors && action.authors.length > 0 && (
            <Text className="mb-4 text-zinc-500">
              By{" "}
              {action.authors.map((author, i) => (
                <Text key={author.id}>
                  <Text className="text-zinc-500 underline">
                    {author.displayName}
                  </Text>
                  {i < action.authors!.length - 2 && ", "}
                  {i === action.authors!.length - 2 &&
                    `${action.authors!.length > 2 ? "," : ""} and `}
                </Text>
              ))}
            </Text>
          )}
          {action.events && action.events.length > 0 && (
            <View className="mb-4">
              <ActionEventsPanel action={action} />
            </View>
          )}

          {/* Tab Bar */}
          <View className="flex-row border-b border-zinc-200 mb-4">
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 items-center ${
                  activeTab === tab.id ? "border-b-2 border-green" : ""
                }`}
                activeOpacity={0.7}
              >
                <Text
                  className={`text-sm font-medium ${
                    activeTab === tab.id ? "text-green" : "text-zinc-500"
                  }`}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab Content */}
          <View className="pb-10">{renderTabContent()}</View>
        </View>
      </ScrollView>
    </>
  );
}
