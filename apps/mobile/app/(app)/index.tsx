import { View, ScrollView, ActivityIndicator } from "react-native";
import { useCallback, useMemo, useRef } from "react";
import {
  actionsFindAllLoggedIn,
  userGetAwayRanges,
} from "@alliance/shared/client";
import { colors } from "../../lib/style/colors";
import Text from "../../components/system/Text";
import { useHomePageActions } from "@alliance/shared/lib/homePage";
import LargeActionCard from "../../components/LargeActionCard";
import useActivities, {
  ActivityList,
} from "@alliance/shared/lib/useActivities";
import { Check } from "lucide-react-native";
import { noTasksToDoRightNow } from "@alliance/shared/lib/copy";
import {
  ActionWithAwayStatus,
  getAwayStatus,
} from "@alliance/shared/lib/actionUtils";
import { useQuery } from "@tanstack/react-query";

export default function HomeScreen() {
  const {
    data: actions,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["actions"],
    queryFn: () =>
      actionsFindAllLoggedIn({ query: { sorted: true } }).then(
        (response) => response.data ?? []
      ),
  });

  const { data: awayRanges, isPending: awayRangesPending } = useQuery({
    queryKey: ["awayRanges"],
    queryFn: () => userGetAwayRanges().then((response) => response.data ?? []),
  });

  const loading = isPending || awayRangesPending;

  const actionsWithAwayStatus = useMemo((): ActionWithAwayStatus[] => {
    if (!actions || !awayRanges) return [];
    return actions.map((action) => ({
      ...action,
      awayStatus: getAwayStatus(action, awayRanges, new Date()),
    }));
  }, [actions, awayRanges]);

  const { currentTask } = useHomePageActions(actionsWithAwayStatus);

  const { activities: friendActivities } = useActivities({
    list: ActivityList.Friends,
    limit: 8,
  });

  const scrollViewRef = useRef<ScrollView>(null);

  const scrollPageTo = useCallback((y: number) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: y,
        animated: true,
      });
    }
  }, []);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center py-16 px-5 bg-white">
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  if (!currentTask) {
    return (
      <View className="flex-1 items-center justify-center py-16 px-5 bg-white">
        <View className="w-12 h-12 rounded-full bg-green items-center justify-center mb-4">
          <Check size={32} color="#fff" strokeWidth={3} />
        </View>
        <Text className="text-zinc-500 text-lg text-center">
          {noTasksToDoRightNow}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView ref={scrollViewRef} className="flex-1 bg-white">
      <View className="bg-green p-4 pt-11">
        <Text className="text-white font-bold text-base mt-2 pb-0">
          Current task
        </Text>
      </View>
      <View className="">
        {!currentTask ? (
          <Text className="text-red-500 text-center py-4">
            {error?.message}
          </Text>
        ) : (
          <LargeActionCard
            action={currentTask}
            userRelation={currentTask.userRelation ?? "none"}
            friendActivities={friendActivities.filter(
              (activity) => activity.actionId === currentTask.id
            )}
            onUpdateActionState={refetch}
            scrollPageTo={scrollPageTo}
          />
        )}
      </View>
    </ScrollView>
  );
}
