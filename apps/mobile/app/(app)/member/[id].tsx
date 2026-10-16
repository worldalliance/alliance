/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */
import { postBylineAuthors } from "@alliance/common/postAuthors";
import { run } from "@alliance/common/run";
import { ActionActivityDto, HomeFeedItemDto } from "@alliance/shared/client";
import { type FeedActionActivityDto } from "@alliance/shared/lib/actionActivity";
import { failedToLoad } from "@alliance/shared/lib/failedToLoad";
import { ParsedHomeFeedItemDto } from "@alliance/shared/lib/feedHelpers";
import useActivities, {
  ActivityList,
} from "@alliance/shared/lib/useActivities";
import useUserFeed from "@alliance/shared/lib/useUserFeed";
import {
  useAcceptFriendRequestMutation,
  useDeclineFriendRequestMutation,
  useMessageableUsersQuery,
  useRemoveFriendMutation,
  useUserCompletedActionCountQuery,
  useUserForumActivity,
  useUserFriendStatusQuery,
  useUserFriendsQuery,
  useUserProfileQuery,
  useUserReceivedFriendRequestsQuery,
  useUserSentFriendRequestsQuery,
  type ForumActivityItem,
} from "@alliance/shared/lib/user";
import { formatTime } from "@alliance/shared/lib/utils";
import { RelativePathString, router, useLocalSearchParams } from "expo-router";
import { MessageSquare } from "lucide-react-native";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
import { Alert, FlatList, TouchableOpacity, View } from "react-native";
import EditableContentRenderer from "../../../components/EditableContentRenderer";
import ForumCommentCard from "../../../components/ForumCommentCard";
import KeyboardAwareScrollView from "../../../components/KeyboardAwareScrollView";
import LoadFailed from "../../../components/LoadFailed";
import ProfileImage from "../../../components/ProfileImage";
import UserActivityCard from "../../../components/UserActivityCard";
import ProfileHeader from "../../../components/member/ProfileHeader";
import { alertFriendFailure } from "../../../components/member/alertFriendFailure";
import Button, {
  ButtonColor,
  ButtonSize,
} from "../../../components/system/Button";
import { ScreenWithLoading } from "../../../components/system/ScreenWithLoading";
import { SegmentedTabs } from "../../../components/system/SegmentedTabs";
import Text, { FontWeight } from "../../../components/system/Text";
import { useAuth } from "../../../lib/AuthContext";
import { colors } from "../../../lib/style/colors";

enum ProfileTab {
  Activity = "activity",
  ActionsCompleted = "actionsCompleted",
  Forum = "forum",
  Friends = "friends",
}

enum FriendsTab {
  Friends = "friends",
  Received = "received",
  Sent = "sent",
}

const PROFILE_TABS_ORDER: ProfileTab[] = [
  ProfileTab.Activity,
  ProfileTab.ActionsCompleted,
  ProfileTab.Forum,
  ProfileTab.Friends,
];
const PROFILE_TAB_LABELS: Record<ProfileTab, string> = {
  [ProfileTab.Activity]: "Activity",
  [ProfileTab.ActionsCompleted]: "Actions",
  [ProfileTab.Forum]: "Posts",
  [ProfileTab.Friends]: "Friends",
};

const FRIENDS_TABS_ORDER: FriendsTab[] = [
  FriendsTab.Friends,
  FriendsTab.Received,
  FriendsTab.Sent,
];
const FRIENDS_TAB_LABELS: Record<FriendsTab, string> = {
  [FriendsTab.Friends]: "Friends",
  [FriendsTab.Received]: "Received",
  [FriendsTab.Sent]: "Sent",
};

export default function UserProfileScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const userId = Number.parseInt(rawId!, 10);
  const { user, isAuthenticated } = useAuth();
  const isMe = !!userId && user?.id === userId;

  const {
    data: profile,
    isPending: profilePending,
    isError: profileError,
  } = useUserProfileQuery(userId);
  // Starts the request alongside the profile's; FriendRequestButton mounts only once the profile loads.
  useUserFriendStatusQuery(userId, { enabled: isAuthenticated && !isMe });
  const {
    items: forumActivityItems,
    didFail: didForumFail,
    retry: retryForum,
    retrying: isRetryingForum,
  } = useUserForumActivity(userId);
  const friendsQuery = useUserFriendsQuery(userId);
  const {
    data: friends = [],
    isFetching: isFetchingFriends,
    refetch: refetchFriends,
  } = friendsQuery;
  const didFriendsFail = failedToLoad(friendsQuery);
  const receivedQuery = useUserReceivedFriendRequestsQuery({
    enabled: isMe,
  });
  const {
    data: receivedRequests = [],
    isFetching: isFetchingReceived,
    refetch: refetchReceived,
  } = receivedQuery;
  const didReceivedFail = failedToLoad(receivedQuery);
  const sentQuery = useUserSentFriendRequestsQuery({
    enabled: isMe,
  });
  const {
    data: sentRequests = [],
    isFetching: isFetchingSent,
    refetch: refetchSent,
  } = sentQuery;
  const didSentFail = failedToLoad(sentQuery);
  const { ids: messageableIds } = useMessageableUsersQuery({
    enabled: isAuthenticated,
  });

  const acceptFriendRequest = useAcceptFriendRequestMutation();
  const declineFriendRequest = useDeclineFriendRequestMutation();
  const removeFriend = useRemoveFriendMutation();
  const answeringRequest =
    acceptFriendRequest.isPending || declineFriendRequest.isPending;

  const {
    items: feedItems,
    handleLikeActivity,
    handleLikeForumComment,
    fetchNextPage: fetchNextFeedPage,
    hasNextPage: feedHasNextPage,
    isFetchingNextPage: feedFetchingNextPage,
  } = useUserFeed({
    userId: userId ?? 0,
    comments: true,
  });

  const [selectedTab, setSelectedTab] = useState<ProfileTab>(
    ProfileTab.Activity,
  );

  const onFeedEndReached = useCallback(() => {
    if (selectedTab !== ProfileTab.Activity) return;
    if (feedHasNextPage && !feedFetchingNextPage) {
      void fetchNextFeedPage();
    }
  }, [selectedTab, feedHasNextPage, feedFetchingNextPage, fetchNextFeedPage]);
  const [friendsTab, setFriendsTab] = useState<FriendsTab>(FriendsTab.Friends);

  const { data: completedActionCount = 0 } =
    useUserCompletedActionCountQuery(userId);

  const {
    activities: completedActivities,
    handleLikeActivity: handleLikeCompletedActivity,
  } = useActivities({
    list: ActivityList.User,
    objectId: userId,
    comments: true,
  });

  useEffect(() => {
    setSelectedTab(ProfileTab.Activity);
    setFriendsTab(FriendsTab.Friends);
  }, [userId]);

  const confirmCancelRequest = useCallback(
    (targetId: number) => {
      Alert.alert("Cancel request", "Cancel this friend request?", [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel request",
          style: "destructive",
          onPress: () =>
            removeFriend
              .mutateAsync(targetId)
              .catch((error) =>
                alertFriendFailure("Couldn't cancel friend request", error),
              ),
        },
      ]);
    },
    [removeFriend],
  );

  const renderActionItem = useCallback(
    ({ item }: { item: ParsedHomeFeedItemDto }) => {
      switch (item.type) {
        case "activity": {
          if (!item.activity) return null;
          return (
            <View className="border-b border-zinc-200">
              <UserActivityCard
                activity={item.activity}
                handleLike={handleLikeActivity}
              />
            </View>
          );
        }
        case "forum_comment": {
          const fc = item.forumComment;
          if (!fc) return null;
          return (
            <View className="border-b border-zinc-200">
              <ForumCommentCard
                comment={fc.comment}
                postId={fc.postId}
                postTitle={fc.postTitle}
                likedByMe={fc.likedByMe}
                likesCount={fc.likesCount}
                handleLike={() => handleLikeForumComment(fc.comment.id)}
              />
            </View>
          );
        }
        default: {
          // Drop unknown variants so older clients don't crash on new server types.
          item.type satisfies never;
          return null;
        }
      }
    },
    [handleLikeActivity, handleLikeForumComment],
  );

  const renderCompletedActivityItem = useCallback(
    ({ item }: { item: FeedActionActivityDto }) => (
      <View className="border-b border-zinc-200">
        <UserActivityCard
          activity={item}
          handleLike={handleLikeCompletedActivity}
        />
      </View>
    ),
    [handleLikeCompletedActivity],
  );

  const renderForumItem = useCallback(
    ({ item }: { item: ForumActivityItem }) => {
      if (item.type === "post") {
        return (
          <TouchableOpacity
            onPress={() =>
              router.push(`/forum/post/${item.post.id}` as RelativePathString)
            }
            className="px-4 py-4 border-b border-zinc-200"
            activeOpacity={0.8}
          >
            <Text className="text-zinc-900">{item.post.title}</Text>
            <View className="flex-row items-center gap-2 mt-1">
              {postBylineAuthors(item.post).map((author) => (
                <ProfileImage
                  key={author.id}
                  pfp={author.profilePicture}
                  size="small"
                />
              ))}
              <Text className="text-sm text-zinc-500">
                {formatTime(new Date(item.post.createdAt), { addSuffix: true })}
              </Text>
            </View>
          </TouchableOpacity>
        );
      }

      const parentRoute =
        item.comment.parentObjectType === "post"
          ? `/forum/post/${item.comment.parentObjectId}?replyId=${item.comment.id}`
          : item.comment.parentObjectType === "action"
            ? `/actions/${item.comment.parentObjectId}`
            : null;

      if (!parentRoute) return null;

      return (
        <TouchableOpacity
          onPress={() => router.push(parentRoute as RelativePathString)}
          className="px-4 py-4 border-b border-zinc-200"
          activeOpacity={0.8}
        >
          <EditableContentRenderer
            content={item.comment.editableContent}
            truncated
          />
          <View className="flex-row items-center gap-2 mt-1">
            <ProfileImage
              pfp={item.comment.author.profilePicture}
              size="small"
            />
            <Text className="text-sm text-zinc-500">
              {" "}
              {formatTime(new Date(item.comment.createdAt), {
                addSuffix: true,
              })}{" "}
              in{" "}
              <Text className="text-sm text-green" weight={FontWeight.Medium}>
                {item.comment.parentTitle}
              </Text>
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [],
  );

  const renderReceivedItem = useCallback(
    ({ item: request }: { item: any }) => (
      <View className="px-4 py-3 border-b border-zinc-200">
        <View className="flex-row items-center gap-3">
          <ProfileImage pfp={request.profilePicture} size="small" />
          <Text className="text-zinc-900 flex-1" weight={FontWeight.Medium}>
            {request.displayName}
          </Text>
          <View className="flex-row gap-2">
            <Button
              title="Accept"
              color={ButtonColor.Green}
              size={ButtonSize.Small}
              onPress={() =>
                acceptFriendRequest
                  .mutateAsync(request.id)
                  .catch((error) =>
                    alertFriendFailure("Couldn't accept friend request", error),
                  )
              }
              disabled={answeringRequest}
            />
            <Button
              title="Decline"
              color={ButtonColor.Light}
              size={ButtonSize.Small}
              onPress={() =>
                declineFriendRequest
                  .mutateAsync(request.id)
                  .catch((error) =>
                    alertFriendFailure(
                      "Couldn't decline friend request",
                      error,
                    ),
                  )
              }
              disabled={answeringRequest}
            />
          </View>
        </View>
      </View>
    ),
    [acceptFriendRequest, declineFriendRequest, answeringRequest],
  );

  const renderSentItem = useCallback(
    ({ item: request }: { item: any }) => (
      <View className="px-4 py-3 border-b border-zinc-200">
        <View className="flex-row items-center gap-3">
          <ProfileImage pfp={request.profilePicture} size="small" />
          <Text className="text-zinc-900 flex-1" weight={FontWeight.Medium}>
            {request.displayName}
          </Text>
          <Button
            title="Cancel"
            color={ButtonColor.Light}
            size={ButtonSize.Small}
            onPress={() => confirmCancelRequest(request.id)}
          />
        </View>
      </View>
    ),
    [confirmCancelRequest],
  );

  const renderFriendItem = useCallback(
    ({ item: friend }: { item: any }) => (
      <View className="px-4 py-3 border-b border-zinc-200 flex-row items-center justify-between">
        <TouchableOpacity
          className="flex-row items-center gap-3 flex-1"
          onPress={() => router.push(`/member/${friend.id}`)}
          activeOpacity={0.8}
        >
          <ProfileImage pfp={friend.profilePicture} size="small" />
          <Text className="text-zinc-900" weight={FontWeight.Medium}>
            {friend.displayName}
          </Text>
        </TouchableOpacity>
        {isMe && messageableIds.has(friend.id) && (
          <TouchableOpacity
            onPress={() => router.push(`/messages/new?to=${friend.id}`)}
            activeOpacity={0.7}
            className="p-2"
            accessibilityLabel={`Message ${friend.displayName}`}
          >
            <MessageSquare size={22} color={colors.text.icon} />
          </TouchableOpacity>
        )}
      </View>
    ),
    [isMe, messageableIds],
  );

  const listData = useMemo((): any[] => {
    switch (selectedTab) {
      case ProfileTab.Activity:
        return feedItems;
      case ProfileTab.ActionsCompleted:
        return completedActivities;
      case ProfileTab.Forum:
        return forumActivityItems;
      case ProfileTab.Friends:
        switch (friendsTab) {
          case FriendsTab.Received:
            return isMe ? receivedRequests : friends;
          case FriendsTab.Sent:
            return isMe ? sentRequests : friends;
          case FriendsTab.Friends:
            return friends;
          default:
            throw new Error(
              `Unknown friends tab: ${friendsTab satisfies never}`,
            );
        }
      default:
        throw new Error(`Unknown profile tab: ${selectedTab satisfies never}`);
    }
  }, [
    selectedTab,
    friendsTab,
    isMe,
    feedItems,
    completedActivities,
    forumActivityItems,
    receivedRequests,
    sentRequests,
    friends,
  ]);

  const listKeyExtractor = useCallback(
    (item: any) => {
      switch (selectedTab) {
        case ProfileTab.Activity: {
          const feedItem = item as HomeFeedItemDto;
          if (feedItem.type === "activity") {
            return `activity-${feedItem.activity?.id}`;
          }
          return `comment-${feedItem.forumComment?.comment.id}`;
        }
        case ProfileTab.ActionsCompleted:
          return `activity-${(item as ActionActivityDto).id}`;
        case ProfileTab.Forum:
          return item.type === "post"
            ? `post-${item.post.id}`
            : `comment-${item.comment.id}`;
        case ProfileTab.Friends:
          return item.id.toString();
        default:
          throw new Error(
            `Unknown profile tab: ${selectedTab satisfies never}`,
          );
      }
    },
    [selectedTab],
  );

  const listRenderItem = useCallback(
    ({ item }: { item: any }) => {
      switch (selectedTab) {
        case ProfileTab.Activity:
          return renderActionItem({ item });
        case ProfileTab.ActionsCompleted:
          return renderCompletedActivityItem({ item });
        case ProfileTab.Forum:
          return renderForumItem({ item });
        case ProfileTab.Friends:
          switch (friendsTab) {
            case FriendsTab.Received:
              return isMe
                ? renderReceivedItem({ item })
                : renderFriendItem({ item });
            case FriendsTab.Sent:
              return isMe
                ? renderSentItem({ item })
                : renderFriendItem({ item });
            case FriendsTab.Friends:
              return renderFriendItem({ item });
            default:
              throw new Error(
                `Unknown friends tab: ${friendsTab satisfies never}`,
              );
          }
        default:
          throw new Error(
            `Unknown profile tab: ${selectedTab satisfies never}`,
          );
      }
    },
    [
      selectedTab,
      friendsTab,
      isMe,
      renderActionItem,
      renderCompletedActivityItem,
      renderForumItem,
      renderReceivedItem,
      renderSentItem,
      renderFriendItem,
    ],
  );

  const listEmptyComponent = useMemo(() => {
    const friendsFailure = (): Omit<
      ComponentProps<typeof LoadFailed>,
      "message"
    > | null => {
      switch (friendsTab) {
        case FriendsTab.Received:
          return didReceivedFail
            ? {
                onRetry: () => void refetchReceived(),
                retrying: isFetchingReceived,
              }
            : null;
        case FriendsTab.Sent:
          return didSentFail
            ? { onRetry: () => void refetchSent(), retrying: isFetchingSent }
            : null;
        case FriendsTab.Friends:
          return didFriendsFail
            ? {
                onRetry: () => void refetchFriends(),
                retrying: isFetchingFriends,
              }
            : null;
        default:
          throw new Error(`Unknown friends tab: ${friendsTab satisfies never}`);
      }
    };

    const friendsEmptyMessage = (): string => {
      switch (friendsTab) {
        case FriendsTab.Received:
          return isMe ? "No incoming requests." : "No friends yet.";
        case FriendsTab.Sent:
          return isMe ? "No outgoing requests." : "No friends yet.";
        case FriendsTab.Friends:
          return "No friends yet.";
        default:
          throw new Error(`Unknown friends tab: ${friendsTab satisfies never}`);
      }
    };

    const failure =
      selectedTab === ProfileTab.Friends ? friendsFailure() : null;
    if (failure) {
      return <LoadFailed message="Couldn't load this list." {...failure} />;
    }
    if (selectedTab === ProfileTab.Forum && didForumFail) return null;

    let message: string;
    switch (selectedTab) {
      case ProfileTab.Activity:
        message = "No activity yet";
        break;
      case ProfileTab.ActionsCompleted:
        message = "No actions completed yet";
        break;
      case ProfileTab.Forum:
        message = "No forum activity yet";
        break;
      case ProfileTab.Friends:
        message = friendsEmptyMessage();
        break;
      default:
        throw new Error(`Unknown profile tab: ${selectedTab satisfies never}`);
    }

    return (
      <Text className="text-center text-zinc-500 py-6 px-4">{message}</Text>
    );
  }, [
    selectedTab,
    friendsTab,
    isMe,
    didFriendsFail,
    didReceivedFail,
    didSentFail,
    isFetchingFriends,
    isFetchingReceived,
    isFetchingSent,
    refetchFriends,
    refetchReceived,
    refetchSent,
    didForumFail,
  ]);

  if (!userId) {
    return (
      <View className="flex-1 items-center justify-center bg-white p-6">
        <Text className="text-zinc-500">User not found.</Text>
      </View>
    );
  }

  if (profilePending) {
    return <ScreenWithLoading title="Profile" loading />;
  }

  if (profileError) {
    return (
      <View className="flex-1 items-center justify-center bg-white p-6">
        <Text className="text-zinc-500">Failed to load user profile.</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View className="flex-1 items-center justify-center bg-white p-6">
        <Text className="text-zinc-500">User not found.</Text>
      </View>
    );
  }

  const listHeader = (
    <View>
      <ProfileHeader
        profile={profile}
        isMe={isMe}
        completedActionCount={completedActionCount}
      >
        <SegmentedTabs
          tabs={PROFILE_TABS_ORDER}
          selectedTab={selectedTab}
          onSelect={setSelectedTab}
          labels={PROFILE_TAB_LABELS}
        />
      </ProfileHeader>
      {selectedTab === ProfileTab.Friends && isMe ? (
        <View className="px-4">
          <View className="my-4">
            <SegmentedTabs
              tabs={FRIENDS_TABS_ORDER}
              selectedTab={friendsTab}
              onSelect={setFriendsTab}
              labels={FRIENDS_TAB_LABELS}
            />
          </View>
        </View>
      ) : selectedTab === ProfileTab.Forum && didForumFail ? (
        <LoadFailed
          message="Couldn't load forum activity."
          onRetry={retryForum}
          retrying={isRetryingForum}
        />
      ) : null}
    </View>
  );

  const listFooter = (
    <>
      {run(() => {
        switch (selectedTab) {
          case ProfileTab.Activity: {
            if (feedFetchingNextPage) {
              return (
                <Text className="text-center text-zinc-400 py-4">
                  Loading more...
                </Text>
              );
            }
            return null;
          }
          case ProfileTab.ActionsCompleted:
          case ProfileTab.Forum:
          case ProfileTab.Friends:
            return null;
          default:
            throw new Error(
              `Unknown profile tab: ${selectedTab satisfies never}`,
            );
        }
      })}
      <View className="h-16" />
    </>
  );

  return (
    <FlatList
      data={listData}
      keyExtractor={listKeyExtractor}
      renderItem={listRenderItem}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={listEmptyComponent}
      ListFooterComponent={listFooter}
      onEndReached={onFeedEndReached}
      onEndReachedThreshold={0.3}
      renderScrollComponent={(props) => <KeyboardAwareScrollView {...props} />}
      contentContainerStyle={{ backgroundColor: "white" }}
      keyboardShouldPersistTaps="handled"
    />
  );
}
