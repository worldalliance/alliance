import { commentPath } from "@alliance/common/commentPath";
import { postBylineAuthors } from "@alliance/common/postAuthors";
import { run } from "@alliance/common/run";
import { ActionActivityDto, HomeFeedItemDto } from "@alliance/shared/client";
import { type FeedActionActivityDto } from "@alliance/shared/lib/actionActivity";
import { ParsedHomeFeedItemDto } from "@alliance/shared/lib/feedHelpers";
import useActivities, {
  ActivityList,
} from "@alliance/shared/lib/useActivities";
import useUserFeed from "@alliance/shared/lib/useUserFeed";
import {
  useUserCompletedActionCountQuery,
  useUserForumActivity,
  useUserFriendStatusQuery,
  useUserProfileQuery,
  type ForumActivityItem,
} from "@alliance/shared/lib/user";
import { formatTime } from "@alliance/shared/lib/utils";
import { RelativePathString, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, TouchableOpacity, View } from "react-native";
import EditableContentRenderer from "../../../components/EditableContentRenderer";
import ForumCommentCard from "../../../components/ForumCommentCard";
import KeyboardAwareScrollView from "../../../components/KeyboardAwareScrollView";
import LoadFailed from "../../../components/LoadFailed";
import ProfileImage from "../../../components/ProfileImage";
import UserActivityCard from "../../../components/UserActivityCard";
import ProfileHeader from "../../../components/member/ProfileHeader";
import { useFriendsList } from "../../../components/member/useFriendsList";
import { ScreenWithLoading } from "../../../components/system/ScreenWithLoading";
import { SegmentedTabs } from "../../../components/system/SegmentedTabs";
import Text, { FontWeight } from "../../../components/system/Text";
import { useAuth } from "../../../lib/AuthContext";

enum ProfileTab {
  Activity = "activity",
  ActionsCompleted = "actionsCompleted",
  Forum = "forum",
  Friends = "friends",
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
  const {
    data: friendsData,
    renderItem: renderFriendsItem,
    empty: friendsEmpty,
    tabs: friendsTabs,
  } = useFriendsList({ userId, isMe });

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
  }, [userId]);

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

      return (
        <TouchableOpacity
          onPress={() =>
            router.push(commentPath(item.comment) as RelativePathString)
          }
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

  const listData = useMemo((): any[] => {
    switch (selectedTab) {
      case ProfileTab.Activity:
        return feedItems;
      case ProfileTab.ActionsCompleted:
        return completedActivities;
      case ProfileTab.Forum:
        return forumActivityItems;
      case ProfileTab.Friends:
        return friendsData;
      default:
        throw new Error(`Unknown profile tab: ${selectedTab satisfies never}`);
    }
  }, [
    selectedTab,
    feedItems,
    completedActivities,
    forumActivityItems,
    friendsData,
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
          return renderFriendsItem({ item });
        default:
          throw new Error(
            `Unknown profile tab: ${selectedTab satisfies never}`,
          );
      }
    },
    [
      selectedTab,
      renderActionItem,
      renderCompletedActivityItem,
      renderForumItem,
      renderFriendsItem,
    ],
  );

  const listEmptyComponent = useMemo(() => {
    if (selectedTab === ProfileTab.Friends) return friendsEmpty;
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
      default:
        throw new Error(`Unknown profile tab: ${selectedTab satisfies never}`);
    }

    return (
      <Text className="text-center text-zinc-500 py-6 px-4">{message}</Text>
    );
  }, [selectedTab, friendsEmpty, didForumFail]);

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
      {selectedTab === ProfileTab.Friends ? (
        friendsTabs
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
