import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  View,
} from "react-native";
import { ActionActivityDto } from "@alliance/shared/client";
import useActivities, {
  ActivityList,
} from "@alliance/shared/lib/useActivities";
import { useAuth } from "../../lib/AuthContext";
import { colors } from "../../lib/style/colors";
import Text from "../../components/system/Text";
import UserActivityCard from "../../components/UserActivityCard";
import { LegendList } from "@legendapp/list";

type Mode = "friends" | "everyone";

export default function FeedScreen() {
  const [mode, setMode] = useState<Mode>("friends");
  const { user } = useAuth();

  const {
    activities: globalActivities,
    handleLikeActivity: handleGlobalLikeActivity,
    updateActivity: updateGlobalActivity,
    loading: loadingGlobal,
    setActivities: setGlobalActivities,
  } = useActivities({
    list: ActivityList.Global,
    comments: true,
    limit: 30,
  });

  const {
    activities: friendActivities,
    handleLikeActivity: handleLikeFriendActivity,
    updateActivity: updateFriendActivity,
    loading: loadingFriend,
    setActivities: setFriendActivities,
  } = useActivities({
    list: ActivityList.Friends,
    comments: true,
    limit: 30,
  });

  const handleLikeActivity = useCallback(
    async (activityId: number, activityMode: Mode) => {
      if (activityMode === "friends") {
        const liked = await handleLikeFriendActivity(activityId);
        if (liked) {
          setGlobalActivities((prev) =>
            prev.map((a) => (a.id === activityId ? liked : a))
          );
        }
      } else {
        const liked = await handleGlobalLikeActivity(activityId);
        if (liked) {
          setFriendActivities((prev) =>
            prev.map((a) => (a.id === activityId ? liked : a))
          );
        }
      }
    },
    [
      handleLikeFriendActivity,
      handleGlobalLikeActivity,
      setGlobalActivities,
      setFriendActivities,
    ]
  );

  const updateActivity = useCallback(
    (activity: ActionActivityDto, activityMode: Mode) => {
      if (activityMode === "friends") {
        updateFriendActivity(activity);
      } else {
        updateGlobalActivity(activity);
      }
    },
    [updateFriendActivity, updateGlobalActivity]
  );

  const activities = mode === "friends" ? friendActivities : globalActivities;
  const loading = mode === "friends" ? loadingFriend : loadingGlobal;

  const renderActivity = useCallback(
    ({ item: activity }: { item: ActionActivityDto }) => {
      return (
        <View className="border-b border-zinc-200">
          <UserActivityCard
            activity={activity}
            handleLike={() => handleLikeActivity(activity.id, mode)}
            onActivityUpdate={(updatedActivity) =>
              updateActivity(updatedActivity, mode)
            }
            canEdit={activity.user.id === user?.id}
          />
        </View>
      );
    },
    [handleLikeActivity, updateActivity, mode, user?.id]
  );

  return (
    <View className="flex-1 bg-white">
      {/* Fixed header */}
      <View className="bg-green p-4 pt-12 pb-3 z-10 flex-row items-center justify-between">
        <Text className="text-white font-bold">Activity</Text>

        {/* Segmented control */}
        <View className="flex-row bg-white/20 rounded-lg p-1">
          <TouchableOpacity
            onPress={() => setMode("friends")}
            activeOpacity={0.7}
            className={`px-3 py-1.5 rounded-md ${
              mode === "friends" ? "bg-white" : ""
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                mode === "friends" ? "text-zinc-900" : "text-white"
              }`}
            >
              Friends
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMode("everyone")}
            activeOpacity={0.7}
            className={`px-3 py-1.5 rounded-md ${
              mode === "everyone" ? "bg-white" : ""
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                mode === "everyone" ? "text-zinc-900" : "text-white"
              }`}
            >
              Everyone
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content area */}
      {loading ? (
        <View className="flex-1 items-center justify-center bg-white">
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : activities.length === 0 ? (
        <View className="flex-1 items-center justify-center bg-white">
          <Text className="text-zinc-500">
            {mode === "friends"
              ? "No friend activity yet"
              : "No activity yet"}
          </Text>
        </View>
      ) : (
        <LegendList
          key={mode}
          data={activities}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderActivity}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={() => {}} />
          }
          recycleItems
          contentContainerStyle={{
            paddingBottom: 40,
            backgroundColor: "white",
          }}
        />
      )}
    </View>
  );
}
