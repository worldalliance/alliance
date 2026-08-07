import type { FollowUpForm } from "@alliance/shared/client";
import { actionsDismissAction } from "@alliance/shared/client";
import { useActionsQuery } from "@alliance/shared/lib/actionsListPage";
import {
  ActionWithAwayStatus,
  homePagePriorityComparator,
} from "@alliance/shared/lib/actionUtils";
import { noTasksToDoRightNow } from "@alliance/shared/lib/copy";
import { ParsedHomeFeedItemDto } from "@alliance/shared/lib/feedHelpers";
import { type ParsedGeneralUpdate } from "@alliance/shared/lib/generalUpdates";
import { useHomePageActions } from "@alliance/shared/lib/homePage";
import { getTaskDismissInfo } from "@alliance/shared/lib/largeActionCard";
import { useBoundedIndex } from "@alliance/shared/lib/useBoundedIndex";
import { useUnreadGeneralUpdates } from "@alliance/shared/lib/useGeneralUpdates";
import useHomeFeed, { resetHomeFeed } from "@alliance/shared/lib/useHomeFeed";
import { LegendList, type LegendListRef } from "@legendapp/list";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Check } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  RefreshControl,
  type ScrollViewProps,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollViewRef } from "react-native-keyboard-controller";
import FollowUpFormPanel from "../../components/FollowUpFormPanel";
import ForumCommentCard from "../../components/ForumCommentCard";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import LargeActionCard from "../../components/LargeActionCard";
import LargeGeneralUpdateCard from "../../components/LargeGeneralUpdateCard";
import ProfileImage from "../../components/ProfileImage";
import SuccessOverlay from "../../components/SuccessOverlay";
import { SimplePageTitle } from "../../components/system/SimplePageTitle";
import { TaskNavigatorStepper } from "../../components/system/TaskNavigatorStepper";
import Text from "../../components/system/Text";
import UserActivityCard from "../../components/UserActivityCard";
import { useAuth } from "../../lib/AuthContext";
import { colors } from "../../lib/style/colors";

type HomeScreenItem =
  | { kind: "action"; action: ActionWithAwayStatus }
  | { kind: "generalUpdate"; generalUpdate: ParsedGeneralUpdate }
  | { kind: "followUpForm"; followUpForm: FollowUpForm; actionId: number };

// Stable identity — LegendList remounts its scroll view whenever this prop changes.
const renderKeyboardAwareScrollComponent = (props: ScrollViewProps) => (
  <KeyboardAwareScrollView {...props} />
);

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

  const loading = isPending || generalUpdatesPending;

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
    const actionAndUpdateItems: HomeScreenItem[] = [
      ...todoActions.map((action) => ({ kind: "action", action }) as const),
      ...generalUpdates.map(
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
  const legendListRef = useRef<LegendListRef>(null);
  const legendListHeightRef = useRef(0);
  const homeBodyHeightRef = useRef(0);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetch(),
        refetchGeneralUpdates(),
        queryClient.invalidateQueries({ queryKey: ["form"] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, refetchGeneralUpdates, queryClient]);

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
    scrollToTop();
  }, [refetch, scrollToTop]);

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

  const renderHomeFeedItem = useCallback(
    ({ item }: { item: ParsedHomeFeedItemDto }) => {
      switch (item.type) {
        case "activity": {
          if (!item.activity) return null;
          const activity = item.activity;
          return (
            <View
              className={`border-b-3`}
              style={{ borderColor: colors.grey[1] }}
            >
              <UserActivityCard
                activity={activity}
                handleLike={() => handleHomeFeedLike(activity.id)}
              />
            </View>
          );
        }
        case "forum_comment": {
          const fc = item.forumComment;
          if (!fc) return null;
          const { comment, postId, postTitle, likedByMe, likesCount } = fc;
          return (
            <View
              className={`border-b-3`}
              style={{ borderColor: colors.grey[1] }}
            >
              <ForumCommentCard
                comment={comment}
                postId={postId}
                postTitle={postTitle}
                likedByMe={likedByMe}
                likesCount={likesCount}
                handleLike={() => handleLikeForumComment(comment.id)}
              />
            </View>
          );
        }
        default: {
          item.type satisfies never;
          return null;
        }
      }
    },
    [handleHomeFeedLike, handleLikeForumComment],
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
        <View className="bg-white py-2 px-1">
          <LargeActionCard
            action={currentItem.action}
            dismissProps={dismissProps}
            onUpdateActionState={() => {
              refetch();
            }}
            onCompleteAction={() => {
              refetch();
              resetHomeFeed(queryClient);
              scrollToTop();
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
    handleDismissGeneralUpdate,
    queryClient,
    refetch,
    scrollPageTo,
    scrollToEnd,
    scrollToTop,
    handleSubmitSuccess,
  ]);

  const showHomeFeedList = !homeFeedLoading && homeFeedItems.length > 0;

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
          ref={legendListRef}
          className="flex-1"
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
              <View onLayout={handleHomeBodyLayout}>{body}</View>
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
        onFadeInComplete={handleOverlayFadeIn}
        onComplete={handleSuccessComplete}
      />
    </View>
  );
}
