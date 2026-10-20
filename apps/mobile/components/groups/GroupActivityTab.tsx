import useActivities, {
  ActivityList,
} from "@alliance/shared/lib/useActivities";
import { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  View,
} from "react-native";
import { colors } from "../../lib/style/colors";
import Text from "../system/Text";
import UserActivityCard from "../UserActivityCard";

export function GroupActivityTab({
  communityId,
  onRefresh,
  refreshing,
}: {
  communityId: number;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const { activities, handleLikeActivity, loading, refresh } = useActivities({
    list: ActivityList.Community,
    objectId: communityId,
    comments: true,
  });

  const handleRefresh = useCallback(() => {
    onRefresh();
    void refresh();
  }, [onRefresh, refresh]);

  if (loading && activities.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  return (
    <FlatList
      data={activities}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => (
        <View className="border-t border-zinc-200" key={item.id}>
          <UserActivityCard
            activity={item}
            handleLike={() => handleLikeActivity(item.id)}
          />
        </View>
      )}
      ListEmptyComponent={
        <View className="py-12 items-center">
          <Text className="text-zinc-500">No activities yet</Text>
        </View>
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    />
  );
}
