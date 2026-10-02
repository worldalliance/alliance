import { MEMBER_ACTION_DEADLINE_PASSED } from "@alliance/common/actionActivity";
import type { FollowUpFormDto } from "@alliance/shared/client";
import { actionsDismissAction } from "@alliance/shared/client";
import {
  useActionsQuery,
  useInvalidateActions,
} from "@alliance/shared/lib/actionsListPage";
import { type ActionWithAwayStatus } from "@alliance/shared/lib/actionUtils";
import { failedToLoad } from "@alliance/shared/lib/failedToLoad";
import { ParsedHomeFeedItemDto } from "@alliance/shared/lib/feedHelpers";
import {
  type HomeSequenceItem,
  interleaveActionsAndUpdates,
  useHomePageActions,
} from "@alliance/shared/lib/homePage";
import { getTaskDismissInfo } from "@alliance/shared/lib/largeActionCard";
import { useBoundedIndex } from "@alliance/shared/lib/useBoundedIndex";
import { useUnreadGeneralUpdates } from "@alliance/shared/lib/useGeneralUpdates";
import useHomeFeed, { resetHomeFeed } from "@alliance/shared/lib/useHomeFeed";
import { useInvalidateTaskForms } from "@alliance/shared/lib/useTaskForm";
import { LegendList, type LegendListRef } from "@legendapp/list";
import { useQueryClient } from "@tanstack/react-query";
import { milliseconds } from "date-fns";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  type LayoutChangeEvent,
  RefreshControl,
  type ScrollViewProps,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollViewRef } from "react-native-keyboard-controller";
import FollowUpFormPanel from "../../components/FollowUpFormPanel";
import HomeFeedItem from "../../components/HomeFeedItem";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import LargeActionCard from "../../components/LargeActionCard";
import LargeGeneralUpdateCard from "../../components/LargeGeneralUpdateCard";
import LoadFailed from "../../components/LoadFailed";
import NoTasksNotice from "../../components/NoTasksNotice";
import ProfileImage from "../../components/ProfileImage";
import SuccessOverlay from "../../components/SuccessOverlay";
import { SimplePageTitle } from "../../components/system/SimplePageTitle";
import { TaskNavigatorStepper } from "../../components/system/TaskNavigatorStepper";
import Text from "../../components/system/Text";
import { useAuth } from "../../lib/AuthContext";
import {
  Anchor,
  useWalkthroughScroll,
  WalkthroughAnchor,
} from "../../lib/onboarding/walkthrough";
import { colors } from "../../lib/style/colors";

type HomeScreenItem =
  | HomeSequenceItem
  | { kind: "followUpForm"; followUpForm: FollowUpFormDto; actionId: number };

// Stable identity — LegendList remounts its scroll view whenever this prop changes.
const renderKeyboardAwareScrollComponent = (props: ScrollViewProps) => (
  <KeyboardAwareScrollView {...props} />
);

export default function HomeScreen() {
  const queryClient = useQueryClient();
  const invalidateTaskForms = useInvalidateTaskForms();
  const invalidateActions = useInvalidateActions();
  const [refreshing, setRefreshing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const hasNoTasks = useRef(true);

  const handleSubmitSuccess = useCallback(() => {
    setShowSuccess(true);
  }, []);

  const handleSuccessComplete = useCallback(() => {
    setShowSuccess(false);
  }, []);
  const actionsQuery = useActionsQuery({
    refetchInterval: hasNoTasks.current ? milliseconds({ minutes: 1 }) : false,
  });
  const {
    data: actions,
    isPending,
    isFetching: isFetchingActions,
    refetch,
  } = actionsQuery;
  const didActionsFail = failedToLoad(actionsQuery);

  const { user } = useAuth();
  const {
    items: homeFeedItems,
    handleLikeActivity: handleLikeHomeFeedActivity,
    handleLikeForumComment,
    loading: homeFeedLoading,
    fetchNextPage: fetchNextHomeFeedPage,
    hasNextPage: homeFeedHasNextPage,
    isFetchingNextPage: homeFeedFetchingNextPage,
  } = useHomeFeed({
    comments: true,
    limit: 5,
  });

  const {
    generalUpdates,
    isPending: generalUpdatesPending,
    didFail: didGeneralUpdatesFail,
    isFetching: isFetchingGeneralUpdates,
    refetch: refetchGeneralUpdates,
    dismissGeneralUpdate: handleDismissGeneralUpdate,
  } = useUnreadGeneralUpdates();

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

  const loading =
    (isPending && !didActionsFail) ||
    (generalUpdatesPending && !didGeneralUpdatesFail);

  const actionsWithAwayStatus = useMemo((): ActionWithAwayStatus[] => {
    if (!actions) return [];

    return actions.map((action) => ({
      ...action,
      awayStatus: action.awayStatus ?? "not_away",
    }));
  }, [actions]);

  const { todoActions, activeCompletableFollowUpForms } = useHomePageActions(
    actionsWithAwayStatus,
  );

  const allItems = useMemo<HomeScreenItem[]>(() => {
    const actionAndUpdateItems = interleaveActionsAndUpdates({
      todoActions,
      generalUpdates,
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
  const legendListRef = useRef<LegendListRef>(null);
  const walkthroughScroll = useWalkthroughScroll();
  const legendListHeightRef = useRef(0);
  const homeBodyHeightRef = useRef(0);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetch(),
        refetchGeneralUpdates(),
        invalidateTaskForms(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, refetchGeneralUpdates, invalidateTaskForms]);

  const scrollPageTo = useCallback((y: number, animated = true) => {
    scrollViewRef.current?.scrollTo({ y, animated });
    legendListRef.current?.scrollToOffset({ offset: y, animated });
  }, []);

  const scrollToTop = useCallback(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    legendListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  const handleOverlayFadeIn = useCallback(() => {
    refetch();
    resetHomeFeed(queryClient);
    scrollToTop();
  }, [refetch, queryClient, scrollToTop]);

  const scrollToEnd = useCallback((animated = true) => {
    scrollViewRef.current?.scrollToEnd({ animated });

    requestAnimationFrame(() => {
      const offset = Math.max(
        0,
        homeBodyHeightRef.current - legendListHeightRef.current,
      );
      legendListRef.current?.scrollToOffset({ offset, animated });
    });
  }, []);

  const handleHomeFeedLayout = useCallback((event: LayoutChangeEvent) => {
    legendListHeightRef.current = event.nativeEvent.layout.height;
  }, []);

  const handleHomeBodyLayout = useCallback((event: LayoutChangeEvent) => {
    homeBodyHeightRef.current = event.nativeEvent.layout.height;
  }, []);

  const onHomeFeedEndReached = useCallback(() => {
    if (homeFeedHasNextPage && !homeFeedFetchingNextPage) {
      void fetchNextHomeFeedPage();
    }
  }, [homeFeedHasNextPage, homeFeedFetchingNextPage, fetchNextHomeFeedPage]);

  const renderHomeFeedItem = useCallback(
    ({ item }: { item: ParsedHomeFeedItemDto }) => (
      <HomeFeedItem
        item={item}
        onLikeActivity={handleLikeHomeFeedActivity}
        onLikeForumComment={handleLikeForumComment}
      />
    ),
    [handleLikeHomeFeedActivity, handleLikeForumComment],
  );

  useEffect(() => {
    if (currentItem) return;
    if (homeFeedLoading || homeFeedFetchingNextPage) return;
    if (!homeFeedHasNextPage) return;
    // Match web behavior where short lists immediately pull the next page.
    if (homeFeedItems.length < 5) {
      void fetchNextHomeFeedPage();
    }
  }, [
    currentItem,
    homeFeedLoading,
    homeFeedFetchingNextPage,
    homeFeedHasNextPage,
    homeFeedItems.length,
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
        body: <NoTasksNotice />,
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
                invalidateActions();
                resetHomeFeed(queryClient);
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
        <Anchor
          name={WalkthroughAnchor.CurrentTask}
          className="bg-white py-2 px-1"
        >
          <LargeActionCard
            action={currentItem.action}
            dismissProps={dismissProps}
            onUpdateActionState={() => {
              refetch();
            }}
            onDeadlinePassed={() => {
              Alert.alert(
                currentItem.action.name,
                MEMBER_ACTION_DEADLINE_PASSED,
              );
              refetch();
            }}
            onCompleteAction={handleSubmitSuccess}
            scrollPageTo={scrollPageTo}
            scrollToEnd={scrollToEnd}
          />
        </Anchor>
      ),
      fullScreen: false,
    };
  }, [
    currentItem,
    dismissProps,
    handleDismissGeneralUpdate,
    invalidateActions,
    queryClient,
    refetch,
    scrollPageTo,
    scrollToEnd,
    handleSubmitSuccess,
  ]);

  const showHomeFeedList = !homeFeedLoading && homeFeedItems.length > 0;

  const generalUpdatesNotice = didGeneralUpdatesFail && (
    <LoadFailed
      message="Couldn't load general updates."
      onRetry={() => void refetchGeneralUpdates()}
      retrying={isFetchingGeneralUpdates}
    />
  );
  const actionsNotice = didActionsFail && (
    <LoadFailed
      message="Couldn't load your tasks."
      onRetry={() => void refetch()}
      retrying={isFetchingActions}
    />
  );
  const notices = (generalUpdatesNotice || actionsNotice) && (
    <>
      {generalUpdatesNotice}
      {actionsNotice}
    </>
  );
  const homeBody = currentItem ? (
    <>
      {notices}
      {body}
    </>
  ) : (
    notices || body
  );

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
      <Anchor name={WalkthroughAnchor.TaskList} className="min-h-0 flex-1">
        {showHomeFeedList ? (
          <LegendList
            ref={(node) => {
              legendListRef.current = node;
              walkthroughScroll.ref(node);
            }}
            className="flex-1"
            onScroll={walkthroughScroll.onScroll}
            onLayout={handleHomeFeedLayout}
            data={homeFeedItems}
            keyExtractor={(item) =>
              item.type === "activity"
                ? `activity-${item.activity?.id}`
                : `comment-${item.forumComment?.comment.id}`
            }
            renderItem={renderHomeFeedItem}
            onEndReached={onHomeFeedEndReached}
            onEndReachedThreshold={0.3}
            renderScrollComponent={renderKeyboardAwareScrollComponent}
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
                <View onLayout={handleHomeBodyLayout}>{homeBody}</View>
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
            ref={(node) => {
              scrollViewRef.current = node;
              walkthroughScroll.ref(node);
            }}
            onScroll={walkthroughScroll.onScroll}
            scrollEventThrottle={walkthroughScroll.scrollEventThrottle}
            contentContainerStyle={fullScreen ? { flex: 1 } : undefined}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            testID="vr-home-ready"
          >
            {homeBody}
          </KeyboardAwareScrollView>
        )}
      </Anchor>
      <SuccessOverlay
        visible={showSuccess}
        onFadeInComplete={handleOverlayFadeIn}
        onComplete={handleSuccessComplete}
      />
    </View>
  );
}
