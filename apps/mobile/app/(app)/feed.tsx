import { FeedActionActivityDto } from "@alliance/shared/lib/actionActivity";
import useActivityFeeds, {
  FEED_EMPTY_MESSAGE,
  FeedMode,
} from "@alliance/shared/lib/useActivityFeeds";
import { cn } from "@alliance/shared/styles/util";
import { LegendList } from "@legendapp/list";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SimplePageTitle } from "../../components/system/SimplePageTitle";
import Text, { FontWeight } from "../../components/system/Text";
import UserActivityCard from "../../components/UserActivityCard";
import { colors } from "../../lib/style/colors";

export default function FeedScreen() {
  const [mode, setMode] = useState(FeedMode.Friends);
  const feeds = useActivityFeeds();
  const { activities, handleLikeActivity, loading, isFetchingNextPage } =
    feeds[mode];

  // Stable ref for onEndReached so the callback doesn't need volatile deps (per frontend pattern)
  const paginationRef = useRef(feeds[mode]);
  paginationRef.current = feeds[mode];

  const onEndReached = useCallback(() => {
    const p = paginationRef.current;
    if (p.hasNextPage && !p.isFetchingNextPage) p.fetchNextPage();
  }, []);

  const renderActivity = useCallback(
    ({ item: activity }: { item: FeedActionActivityDto }) => (
      <View className="border-b-3 border-zinc-100">
        <UserActivityCard
          activity={activity}
          handleLike={() => handleLikeActivity(activity.id)}
        />
      </View>
    ),
    [handleLikeActivity],
  );

  const listHeader = (
    <SimplePageTitle title="Activity">
      <View className="flex-row bg-white/20 rounded-lg p-1">
        <TouchableOpacity
          onPress={() => setMode(FeedMode.Friends)}
          activeOpacity={0.7}
          className={cn(
            "px-3 py-1.5 rounded-md",
            mode === FeedMode.Friends && "bg-white",
          )}
        >
          <Text
            className={cn(
              "text-sm",
              mode === FeedMode.Friends ? "text-green" : "text-black",
            )}
            weight={FontWeight.Medium}
          >
            Friends
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setMode(FeedMode.Everyone)}
          activeOpacity={0.7}
          className={cn(
            "px-3 py-1.5 rounded-md",
            mode === FeedMode.Everyone && "bg-white",
          )}
        >
          <Text
            className={cn(
              "text-sm",
              mode === FeedMode.Everyone ? "text-green" : "text-black",
            )}
            weight={FontWeight.Medium}
          >
            Everyone
          </Text>
        </TouchableOpacity>
      </View>
    </SimplePageTitle>
  );

  return (
    <View className="flex-1">
      {loading ? (
        <>
          {listHeader}
          <View className="flex-1 items-center justify-center bg-white">
            <ActivityIndicator size="large" color={colors.green} />
          </View>
        </>
      ) : activities.length === 0 ? (
        <>
          {listHeader}
          <View className="flex-1 items-center justify-center bg-white">
            <Text className="text-zinc-500">{FEED_EMPTY_MESSAGE[mode]}</Text>
          </View>
        </>
      ) : (
        <KeyboardAvoidingView
          behavior="position"
          className="flex-1"
          contentContainerStyle={{ flex: 1 }}
          testID="vr-feed-ready"
          keyboardVerticalOffset={100}
        >
          {listHeader}
          <LegendList
            key={mode}
            className="flex-1"
            data={activities}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderActivity}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.3}
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={() => {}} />
            }
            recycleItems
            contentContainerStyle={{
              paddingBottom: 40,
              backgroundColor: "white",
            }}
            ListFooterComponent={
              isFetchingNextPage ? (
                <View className="py-4 items-center">
                  <ActivityIndicator size="small" color={colors.green} />
                  <Text className="text-zinc-400 text-sm mt-2">
                    Loading more...
                  </Text>
                </View>
              ) : null
            }
          />
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
