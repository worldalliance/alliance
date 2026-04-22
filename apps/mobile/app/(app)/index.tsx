import {
  View,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  actionsDismissAction,
  actionsDismissGeneralUpdate,
  actionsUnreadGeneralUpdates,
  userGetAwayRanges,
} from "@alliance/shared/client";
import { useActionsQuery } from "@alliance/shared/lib/actionsListPage";
import type {
  ActionActivityDto,
  FollowUpForm,
  GeneralUpdateDto,
} from "@alliance/shared/client";
import { colors } from "../../lib/style/colors";
import Text from "../../components/system/Text";
import {
  ActionWithAwayStatus,
  getAwayStatus,
  homePagePriorityComparator,
} from "@alliance/shared/lib/actionUtils";
import useActivities, {
  ActivityList,
} from "@alliance/shared/lib/useActivities";
import { useHomePageActions } from "@alliance/shared/lib/homePage";
import { getTaskDismissInfo } from "@alliance/shared/lib/largeActionCard";
import LargeActionCard from "../../components/LargeActionCard";
import LargeGeneralUpdateCard from "../../components/LargeGeneralUpdateCard";
import { Check } from "lucide-react-native";
import { noTasksToDoRightNow } from "@alliance/shared/lib/copy";
import SuccessOverlay from "../../components/SuccessOverlay";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyboardAwareScrollViewRef } from "react-native-keyboard-controller";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import { useAuth } from "../../lib/AuthContext";
import { useBoundedIndex } from "@alliance/shared/lib/useBoundedIndex";
import { SimplePageTitle } from "../../components/system/SimplePageTitle";
import { TaskNavigatorStepper } from "../../components/system/TaskNavigatorStepper";
import { router } from "expo-router";
import ProfileImage from "../../components/ProfileImage";
import UserActivityCard from "../../components/UserActivityCard";
import FollowUpFormPanel from "../../components/FollowUpFormPanel";
import { LegendList } from "@legendapp/list";

type HomeScreenItem =
  | { kind: "action"; action: ActionWithAwayStatus }
  | { kind: "generalUpdate"; generalUpdate: GeneralUpdateDto }
  | { kind: "followUpForm"; followUpForm: FollowUpForm; actionId: number };

const GENERAL_UPDATES_QUERY_KEY = [
  "actions",
  "generalUpdates",
  "unread",
] as const;

export default function HomeScreen() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const hasNoTasks = useRef(true);

  const handleSubmitSuccess = useCallback(() => {
    setShowSuccess(true);
  }, []);

  const handleSuccessComplete = useCallback(() => {
    setShowSuccess(false);
  }, []);
  const {
    data: actions,
    isPending,
    refetch,
  } = useActionsQuery({
    refetchInterval: hasNoTasks.current ? 60_000 : false,
  });

  const { user } = useAuth();
  const {
    activities: homeFeedActivities,
    handleLikeActivity: handleLikeHomeFeedActivity,
    loading: homeFeedLoading,
    fetchNextPage: fetchNextHomeFeedPage,
    hasNextPage: homeFeedHasNextPage,
    isFetchingNextPage: homeFeedFetchingNextPage,
  } = useActivities({
    list: ActivityList.HomeFeed,
    comments: true,
    limit: 5,
  });

  const {
    data: generalUpdates,
    isPending: generalUpdatesPending,
    refetch: refetchGeneralUpdates,
  } = useQuery({
    queryKey: GENERAL_UPDATES_QUERY_KEY,
    queryFn: () =>
      actionsUnreadGeneralUpdates().then((response) => response.data ?? []),
  });

  const handleDismissAction = useCallback(
    async (actionId: number) => {
      const action = actions?.find((a) => a.id === actionId);
      if (!action) {
        return;
      }

      await actionsDismissAction({
        path: { id: action.id },
      });

      refetch();
    },
    [actions, refetch],
  );

  const {
    data: awayRanges,
    isPending: awayRangesPending,
    refetch: refetchAwayRanges,
  } = useQuery({
    queryKey: ["awayRanges"],
    queryFn: () => userGetAwayRanges().then((response) => response.data ?? []),
  });

  const handleDismissGeneralUpdate = useCallback(
    async (generalUpdateId: number) => {
      await actionsDismissGeneralUpdate({
        path: { generalUpdateId },
      });
      queryClient.setQueryData<GeneralUpdateDto[]>(
        GENERAL_UPDATES_QUERY_KEY,
        (prev) => prev?.filter((u) => u.id !== generalUpdateId) ?? [],
      );
    },
    [queryClient],
  );

  const loading = isPending || awayRangesPending || generalUpdatesPending;

  const actionsWithAwayStatus = useMemo((): ActionWithAwayStatus[] => {
    if (!actions || !awayRanges) return [];
    return actions.map((action) => ({
      ...action,
      awayStatus: getAwayStatus(action, awayRanges, new Date()),
    }));
  }, [actions, awayRanges]);

  const { todoActions, activeCompletableFollowUpForms } = useHomePageActions(
    actionsWithAwayStatus,
  );

  const allItems = useMemo<HomeScreenItem[]>(() => {
    const actionAndUpdateItems: HomeScreenItem[] = [
      ...todoActions.map((action) => ({ kind: "action", action }) as const),
      ...(generalUpdates ?? []).map(
        (generalUpdate) => ({ kind: "generalUpdate", generalUpdate }) as const,
      ),
    ].sort((a, b) => {
      const aVal = a.kind === "action" ? a.action : a.generalUpdate;
      const bVal = b.kind === "action" ? b.action : b.generalUpdate;
      return homePagePriorityComparator(aVal, bVal);
    });

    const followUpItems: HomeScreenItem[] = activeCompletableFollowUpForms.map(
      ({ followUpForm, actionId }) =>
        ({ kind: "followUpForm", followUpForm, actionId }) as const,
    );

    return [...actionAndUpdateItems, ...followUpItems];
  }, [todoActions, generalUpdates, activeCompletableFollowUpForms]);

  hasNoTasks.current = allItems.length === 0;

  const {
    index: safeIndex,
    goNext,
    goPrev,
    canGoNext,
    canGoPrev,
    hasMultiple: showTaskNavigator,
  } = useBoundedIndex(allItems.length);
  const currentItem = allItems[safeIndex] ?? null;

  const scrollViewRef = useRef<KeyboardAwareScrollViewRef>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetch(),
        refetchGeneralUpdates(),
        refetchAwayRanges(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, refetchGeneralUpdates, refetchAwayRanges]);

  const scrollPageTo = useCallback((y: number, animated = true) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y,
        animated,
      });
    }
  }, []);

  const scrollToEnd = useCallback((animated = true) => {
    scrollViewRef.current?.scrollToEnd({ animated });
  }, []);

  const handleHomeFeedLike = useCallback(
    (activityId: number) => {
      return handleLikeHomeFeedActivity(activityId);
    },
    [handleLikeHomeFeedActivity],
  );

  const onHomeFeedEndReached = useCallback(() => {
    if (homeFeedHasNextPage && !homeFeedFetchingNextPage) {
      void fetchNextHomeFeedPage();
    }
  }, [homeFeedHasNextPage, homeFeedFetchingNextPage, fetchNextHomeFeedPage]);

  const renderHomeFeedActivity = useCallback(
    ({ item: activity }: { item: ActionActivityDto }) => (
      <View className={`border-b-3`} style={{ borderColor: colors.grey[1] }}>
        <UserActivityCard
          activity={activity}
          handleLike={() => handleHomeFeedLike(activity.id)}
        />
      </View>
    ),
    [handleHomeFeedLike],
  );

  useEffect(() => {
    if (currentItem) return;
    if (homeFeedLoading || homeFeedFetchingNextPage) return;
    if (!homeFeedHasNextPage) return;
    // Match web behavior where short lists immediately pull the next page.
    if (homeFeedActivities.length < 5) {
      void fetchNextHomeFeedPage();
    }
  }, [
    currentItem,
    homeFeedLoading,
    homeFeedFetchingNextPage,
    homeFeedHasNextPage,
    homeFeedActivities.length,
    fetchNextHomeFeedPage,
  ]);

  const dismissProps = useMemo(() => {
    if (!currentItem || currentItem.kind !== "action") return undefined;
    const info = getTaskDismissInfo(currentItem.action);
    if (!info) return undefined;
    return {
      ...info,
      onDismiss: () => handleDismissAction(currentItem.action.id),
    };
  }, [currentItem, handleDismissAction]);

  const { title, body, fullScreen } = useMemo(() => {
    if (!currentItem) {
      return {
        title: "Alliance",
        body: (
          <View>
            <View
              className="items-center justify-center py-10 px-5"
              style={{ backgroundColor: colors.grey[0] }}
            >
              <View className="w-8 h-8 rounded-full bg-green items-center justify-center mb-4">
                <Check size={20} color="#fff" strokeWidth={3} />
              </View>
              <Text className="text-zinc-500 text-base text-center">
                {noTasksToDoRightNow}
              </Text>
            </View>
          </View>
        ),
        fullScreen: false,
      };
    }

    if (currentItem.kind === "generalUpdate") {
      return {
        title: "General update",
        body: (
          <View className="p-4">
            <LargeGeneralUpdateCard
              key={currentItem.generalUpdate.id}
              generalUpdate={currentItem.generalUpdate}
              onDismiss={() =>
                handleDismissGeneralUpdate(currentItem.generalUpdate.id)
              }
              userId={user?.id}
              user={user}
            />
          </View>
        ),
        fullScreen: false,
      };
    }

    if (currentItem.kind === "followUpForm") {
      return {
        title: "Follow-up",
        body: (
          <View className="bg-white py-2 px-1">
            <FollowUpFormPanel
              key={currentItem.followUpForm.id}
              followUpForm={currentItem.followUpForm}
              actionId={currentItem.actionId}
              scrollPageTo={scrollPageTo}
              scrollToEnd={scrollToEnd}
              onSubmitted={() => {
                queryClient.invalidateQueries({ queryKey: ["actions"] });
              }}
            />
          </View>
        ),
        fullScreen: false,
      };
    }

    return {
      title: "Current task",
      body: (
        <View className="bg-white py-2 px-1">
          <LargeActionCard
            action={currentItem.action}
            dismissProps={dismissProps}
            onUpdateActionState={() => {
              refetch();
            }}
            scrollPageTo={scrollPageTo}
            scrollToEnd={scrollToEnd}
            onSubmitSuccess={handleSubmitSuccess}
          />
        </View>
      ),
      fullScreen: false,
    };
  }, [
    currentItem,
    dismissProps,
    user,
    handleDismissGeneralUpdate,
    queryClient,
    refetch,
    scrollPageTo,
    scrollToEnd,
    handleSubmitSuccess,
  ]);

  const showHomeFeedList = !homeFeedLoading && homeFeedActivities.length > 0;

  const header = (
    <SimplePageTitle title={title}>
      {showTaskNavigator ? (
        <TaskNavigatorStepper
          index={safeIndex}
          totalCount={allItems.length}
          onPrev={goPrev}
          onNext={goNext}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
        />
      ) : (
        <TouchableOpacity
          onPress={() => router.push("/profile")}
          className="px-2"
          accessibilityLabel="View profile"
        >
          <ProfileImage pfp={user?.profilePicture ?? null} size="medium" />
        </TouchableOpacity>
      )}
    </SimplePageTitle>
  );

  if (loading) {
    return (
      <View className="flex-1 bg-white">
        {header}
        <View className="flex-1 items-center justify-center py-16 px-5 bg-white">
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.grey[0] }}>
      {header}
      {showHomeFeedList ? (
        <LegendList
          className="flex-1"
          data={homeFeedActivities}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderHomeFeedActivity}
          onEndReached={onHomeFeedEndReached}
          onEndReachedThreshold={0.3}
          recycleItems
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={{
            backgroundColor: "white",
            paddingBottom: 40,
          }}
          ListHeaderComponent={
            <>
              {body}
              <View className="px-4 pt-4 pb-2 bg-white">
                <Text className="text-xl">Activity</Text>
              </View>
            </>
          }
          ListFooterComponent={
            homeFeedFetchingNextPage ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color={colors.green} />
                <Text className="text-zinc-400 text-sm mt-2">
                  Loading more...
                </Text>
              </View>
            ) : null
          }
        />
      ) : (
        <KeyboardAwareScrollView
          key={fullScreen ? "fullscreen" : "scroll"}
          ref={scrollViewRef}
          contentContainerStyle={fullScreen ? { flex: 1 } : undefined}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          testID="vr-home-ready"
        >
          {body}
        </KeyboardAwareScrollView>
      )}
      <SuccessOverlay
        visible={showSuccess}
        onFadeInComplete={refetch}
        onComplete={handleSuccessComplete}
      />
    </View>
  );
}
