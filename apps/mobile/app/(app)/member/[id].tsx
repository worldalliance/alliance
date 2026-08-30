import { changedPhoto } from "@alliance/common/image-src";
import { run } from "@alliance/common/run";
import {
  ActionActivityDto,
  HomeFeedItemDto,
  UpdateProfileDto,
  actionsUserCompletedCount,
} from "@alliance/shared/client";
import { type FeedActionActivityDto } from "@alliance/shared/lib/actionActivity";
import { roleBadges } from "@alliance/shared/lib/copy";
import { ParsedHomeFeedItemDto } from "@alliance/shared/lib/feedHelpers";
import useActivities, {
  ActivityList,
} from "@alliance/shared/lib/useActivities";
import useUserFeed from "@alliance/shared/lib/useUserFeed";
import {
  buildForumActivityItems,
  useAcceptFriendRequestMutation,
  useDeclineFriendRequestMutation,
  useMessageableUsersQuery,
  useRemoveFriendMutation,
  useSendFriendRequestMutation,
  useUpdateProfileMutation,
  useUserForumCommentsQuery,
  useUserForumPostsQuery,
  useUserFriendStatusQuery,
  useUserFriendsQuery,
  useUserProfileQuery,
  useUserReceivedFriendRequestsQuery,
  useUserSentFriendRequestsQuery,
  type ForumActivityItem,
} from "@alliance/shared/lib/user";
import { formatTime } from "@alliance/shared/lib/utils";
import { cn } from "@alliance/shared/styles/util";
import { useQuery } from "@tanstack/react-query";
import { RelativePathString, router, useLocalSearchParams } from "expo-router";
import { ChevronDown, Edit, Menu, MessageSquare } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AppMarkdownWrapper from "../../../components/AppMarkdownWrapper";
import EditableContentRenderer from "../../../components/EditableContentRenderer";
import ForumCommentCard from "../../../components/ForumCommentCard";
import { ImageLightboxModal } from "../../../components/ImageLightbox";
import KeyboardAwareScrollView from "../../../components/KeyboardAwareScrollView";
import ProfileImage, {
  resolveProfileImageUri,
} from "../../../components/ProfileImage";
import UserActivityCard from "../../../components/UserActivityCard";
import BackButton from "../../../components/system/BackButton";
import Button, {
  ButtonColor,
  ButtonSize,
} from "../../../components/system/Button";
import { ScreenWithLoading } from "../../../components/system/ScreenWithLoading";
import { SegmentedTabs } from "../../../components/system/SegmentedTabs";
import Text, { FontWeight } from "../../../components/system/Text";
import { useAppDrawer } from "../../../lib/AppDrawerContext";
import { useAuth } from "../../../lib/AuthContext";
import { pickImageDataUri } from "../../../lib/pickImageDataUri";
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
  const { openDrawer, isPermanent } = useAppDrawer();
  const isMe = !!userId && user?.id === userId;

  const {
    data: profile,
    isPending: profilePending,
    isError: profileError,
  } = useUserProfileQuery(userId);
  const { data: friendStatus } = useUserFriendStatusQuery(userId, {
    enabled: isAuthenticated && !isMe,
  });
  const { data: forumPosts = [] } = useUserForumPostsQuery(userId);
  const { data: forumComments = [] } = useUserForumCommentsQuery(userId);
  const { data: friends = [] } = useUserFriendsQuery(userId);
  const { data: receivedRequests = [] } = useUserReceivedFriendRequestsQuery({
    enabled: isMe,
  });
  const { data: sentRequests = [] } = useUserSentFriendRequestsQuery({
    enabled: isMe,
  });
  const { ids: messageableIds } = useMessageableUsersQuery({
    enabled: isAuthenticated,
  });

  const sendFriendRequest = useSendFriendRequestMutation();
  const acceptFriendRequest = useAcceptFriendRequestMutation();
  const declineFriendRequest = useDeclineFriendRequestMutation();
  const removeFriend = useRemoveFriendMutation();
  const updateProfileMutation = useUpdateProfileMutation(userId);

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
  const [friendActionsOpen, setFriendActionsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null);
  const [isPickingAvatar, setIsPickingAvatar] = useState(false);
  const [pfpLightboxOpen, setPfpLightboxOpen] = useState(false);
  const currentProfilePicture = profile?.profilePicture ?? null;

  const { data: completedCountData } = useQuery({
    queryKey: ["userCompletedCount", userId],
    queryFn: async () => {
      const resp = await actionsUserCompletedCount({
        path: { id: userId! },
      });
      return resp.data;
    },
    enabled: Boolean(userId),
  });
  const completedActionCount = completedCountData?.completedCount ?? 0;

  const forumActivityItems = useMemo(
    () => buildForumActivityItems(forumPosts, forumComments),
    [forumPosts, forumComments],
  );

  const {
    activities: completedActivities,
    handleLikeActivity: handleLikeCompletedActivity,
  } = useActivities({
    list: ActivityList.User,
    objectId: userId,
    comments: true,
  });

  useEffect(() => {
    if (!profile || !isMe || isEditing) return;

    setEditName(profile.displayName || "");
    setEditBio(profile.profileDescription || "");
    setEditAvatarUrl(profile.profilePicture || null);
  }, [profile, isMe, isEditing]);

  useEffect(() => {
    setSelectedTab(ProfileTab.Activity);
    setFriendsTab(FriendsTab.Friends);
    setIsEditing(false);
  }, [userId]);

  const handlePickAvatar = useCallback(async () => {
    if (isPickingAvatar) return;
    setIsPickingAvatar(true);
    try {
      const picked = await pickImageDataUri();
      if (!picked.ok) {
        console.error("Failed to pick image", picked.error);
        Alert.alert("Upload failed", "Unable to select that photo.");
        return;
      }
      if (picked.value) {
        setEditAvatarUrl(picked.value.dataUri);
      }
    } finally {
      setIsPickingAvatar(false);
    }
  }, [isPickingAvatar]);

  const handleSaveProfile = useCallback(async () => {
    if (!isMe || updateProfileMutation.isPending) return;

    const payload: UpdateProfileDto = {
      name: editName,
      profileDescription: editBio,
      profilePicture: changedPhoto({
        current: currentProfilePicture,
        next: editAvatarUrl,
      }),
    };

    try {
      await updateProfileMutation.mutateAsync(payload);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save profile", error);
    }
  }, [
    isMe,
    updateProfileMutation,
    editName,
    editBio,
    editAvatarUrl,
    currentProfilePicture,
  ]);

  const handleCancelEdit = useCallback(() => {
    if (!profile) return;
    setEditName(profile.displayName || "");
    setEditBio(profile.profileDescription || "");
    setEditAvatarUrl(profile.profilePicture || null);
    setIsEditing(false);
  }, [profile]);

  const handleSendFriendRequest = useCallback(async () => {
    if (!userId) return;
    try {
      await sendFriendRequest.mutateAsync(userId);
    } catch (error) {
      console.error("Failed to send friend request", error);
    }
  }, [userId, sendFriendRequest]);

  const handleAcceptFriendRequest = useCallback(async () => {
    if (!userId) return;
    try {
      await acceptFriendRequest.mutateAsync(userId);
    } catch (error) {
      console.error("Failed to accept friend request", error);
    }
  }, [userId, acceptFriendRequest]);

  const handleDeclineFriendRequest = useCallback(async () => {
    if (!userId) return;
    try {
      await declineFriendRequest.mutateAsync(userId);
    } catch (error) {
      console.error("Failed to decline friend request", error);
    }
  }, [userId, declineFriendRequest]);

  const handleRemoveFriend = useCallback(async () => {
    if (!userId) return;
    try {
      await removeFriend.mutateAsync(userId);
      setFriendActionsOpen(false);
    } catch (error) {
      console.error("Failed to remove friend", error);
    }
  }, [userId, removeFriend]);

  useEffect(() => {
    if (friendStatus?.status !== "accepted") {
      setFriendActionsOpen(false);
    }
  }, [friendStatus?.status]);

  const confirmCancelRequest = useCallback(
    (targetId: number) => {
      Alert.alert("Cancel request", "Cancel this friend request?", [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel request",
          style: "destructive",
          onPress: () => removeFriend.mutate(targetId),
        },
      ]);
    },
    [removeFriend],
  );

  const renderFriendAction = useCallback(() => {
    if (!isAuthenticated || isMe || !friendStatus) return null;

    if (friendStatus.status === "none") {
      return (
        <Button
          title="Send friend request"
          color={ButtonColor.White}
          size={ButtonSize.Small}
          onPress={handleSendFriendRequest}
        />
      );
    }

    if (friendStatus.status === "accepted") {
      return (
        <View className="relative">
          {friendActionsOpen ? (
            <Pressable
              className="absolute -inset-4"
              onPress={() => setFriendActionsOpen(false)}
            />
          ) : null}
          <Button
            color={ButtonColor.White}
            size={ButtonSize.Small}
            onPress={() => setFriendActionsOpen((prev) => !prev)}
          >
            <View className="flex-row items-center gap-1">
              <Text className="text-zinc-800" weight={FontWeight.Medium}>
                Friends
              </Text>
              <ChevronDown size={14} color="#27272a" />
            </View>
          </Button>
          {friendActionsOpen ? (
            <View className="absolute left-0 top-full z-20 self-start rounded-sm border border-stone-300 bg-white">
              <TouchableOpacity
                className="flex-row self-start px-3 py-2"
                onPress={handleRemoveFriend}
                activeOpacity={0.8}
              >
                <View className="flex-row gap-1">
                  <Text className="shrink-0 text-sm text-red-600">Remove</Text>
                  <Text className="shrink-0 text-sm text-red-600">friend</Text>
                </View>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      );
    }

    if (friendStatus.status === "pending") {
      if (friendStatus.didReceiveRequest) {
        return (
          <View className="flex-row items-center gap-2">
            <Text className="text-zinc-600 text-sm">
              Sent you a friend request
            </Text>
            <Button
              title="Accept"
              color={ButtonColor.Green}
              size={ButtonSize.Small}
              onPress={handleAcceptFriendRequest}
            />
            <Button
              title="Decline"
              color={ButtonColor.Light}
              size={ButtonSize.Small}
              onPress={handleDeclineFriendRequest}
            />
          </View>
        );
      }
      return (
        <Button
          title="Friend request sent"
          color={ButtonColor.Light}
          size={ButtonSize.Small}
          onPress={handleSendFriendRequest}
          disabled
        />
      );
    }

    return null;
  }, [
    isAuthenticated,
    isMe,
    friendStatus,
    handleSendFriendRequest,
    handleAcceptFriendRequest,
    handleDeclineFriendRequest,
    handleRemoveFriend,
    friendActionsOpen,
  ]);

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
              <ProfileImage
                pfp={item.post.author.profilePicture}
                size="small"
              />
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
              onPress={() => acceptFriendRequest.mutate(request.id)}
            />
            <Button
              title="Decline"
              color={ButtonColor.Light}
              size={ButtonSize.Small}
              onPress={() => declineFriendRequest.mutate(request.id)}
            />
          </View>
        </View>
      </View>
    ),
    [acceptFriendRequest, declineFriendRequest],
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
  }, [selectedTab, friendsTab, isMe]);

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

  const badgeStyles = "text-xs text-white px-2 py-0.5 rounded";
  const profileNavBar = (
    <View className="flex-row items-center px-2 pt-1">
      {router.canGoBack() ? (
        <BackButton />
      ) : !isPermanent ? (
        <Pressable onPress={openDrawer} className="p-2">
          <Menu size={25} color={colors.text.icon} strokeWidth={2.5} />
        </Pressable>
      ) : null}
    </View>
  );

  const profileHeader = (
    <>
      {profileNavBar}
      <View className="p-4 pt-4 gap-4">
        <View className="flex flex-row items-center gap-3">
          {isEditing ? (
            <TouchableOpacity
              onPress={handlePickAvatar}
              className="border-zinc-200 rounded-lg p-1 border-dashed border-2 relative"
            >
              <ProfileImage pfp={editAvatarUrl} size="larger" />
              <View className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center ">
                <Edit size={24} color="#fff" />
              </View>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                onPress={() =>
                  profile.profilePicture && setPfpLightboxOpen(true)
                }
                activeOpacity={profile.profilePicture ? 0.9 : 1}
              >
                <ProfileImage pfp={profile.profilePicture} size="larger" />
              </TouchableOpacity>
              <ImageLightboxModal
                uri={
                  pfpLightboxOpen && profile.profilePicture
                    ? resolveProfileImageUri(profile.profilePicture)
                    : null
                }
                onClose={() => setPfpLightboxOpen(false)}
              />
            </>
          )}
          <View className="gap-1">
            {isEditing ? (
              <TextInput
                className="border border-zinc-200 rounded-lg px-3 py-2 text-lg w-full"
                value={editName}
                onChangeText={setEditName}
                placeholder="Name"
                placeholderTextColor="#9ca3af"
              />
            ) : (
              <View className="flex-row items-center flex-wrap gap-2 justify-center">
                <Text
                  className="text-xl text-zinc-900"
                  weight={FontWeight.Semibold}
                >
                  {profile.displayName}
                </Text>
                {profile.staff && (
                  <View className={cn("bg-staff", badgeStyles)}>
                    <Text className="text-white text-sm">
                      {roleBadges.staff.label}
                    </Text>
                  </View>
                )}
                {!profile.staff && profile.ambassador && (
                  <View className={cn("bg-red-500", badgeStyles)}>
                    <Text className="text-white text-xs">
                      {roleBadges.ambassador.label}
                    </Text>
                  </View>
                )}
                {!profile.staff && profile.isCommunityLeader && (
                  <View className={cn("bg-grouplead", badgeStyles)}>
                    <Text className="text-white text-xs">
                      {roleBadges.grouplead.label}
                    </Text>
                  </View>
                )}
                {!profile.hasActiveContract && (
                  <View className={cn("bg-zinc-200", badgeStyles)}>
                    <Text className="text-zinc-700 text-xs">Observer</Text>
                  </View>
                )}
                {isMe && (
                  <TouchableOpacity
                    onPress={() => setIsEditing(true)}
                    activeOpacity={0.7}
                    className="ml-2"
                  >
                    <Edit size={20} />
                  </TouchableOpacity>
                )}
              </View>
            )}
            <Text className="text-sm text-zinc-500">
              <Text className="text-sm text-black">{completedActionCount}</Text>{" "}
              actions
            </Text>
          </View>
          {!isMe && isAuthenticated && messageableIds.has(profile.id) && (
            <View className="ml-auto">
              <TouchableOpacity
                onPress={() => router.push(`/messages/new?to=${profile.id}`)}
                activeOpacity={0.7}
                className="p-2"
                accessibilityLabel={`Message ${profile.displayName}`}
              >
                <MessageSquare size={24} color={colors.text.icon} />
              </TouchableOpacity>
            </View>
          )}
        </View>
        {(!isMe || isEditing) && (
          <View className="flex-row items-center gap-3">
            {isMe ? (
              isEditing ? (
                <>
                  <Button
                    title="Cancel"
                    color={ButtonColor.Light}
                    size={ButtonSize.Medium}
                    onPress={handleCancelEdit}
                  />
                  <Button
                    title={
                      updateProfileMutation.isPending ? "Saving..." : "Save"
                    }
                    color={ButtonColor.Black}
                    size={ButtonSize.Medium}
                    onPress={handleSaveProfile}
                    disabled={updateProfileMutation.isPending}
                  />
                </>
              ) : null
            ) : (
              renderFriendAction()
            )}
          </View>
        )}

        <View>
          {isEditing ? (
            <TextInput
              className="border border-zinc-200 rounded-lg px-3 py-3 text-base min-h-24"
              value={editBio}
              onChangeText={setEditBio}
              placeholder="Write something about yourself..."
              placeholderTextColor="#9ca3af"
              multiline
            />
          ) : profile.profileDescription ? (
            <AppMarkdownWrapper>
              {profile.profileDescription}
            </AppMarkdownWrapper>
          ) : null}
        </View>

        <SegmentedTabs
          tabs={PROFILE_TABS_ORDER}
          selectedTab={selectedTab}
          onSelect={setSelectedTab}
          labels={PROFILE_TAB_LABELS}
        />
      </View>
    </>
  );

  const listHeader =
    selectedTab === ProfileTab.Friends && isMe ? (
      <View>
        {profileHeader}
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
      </View>
    ) : (
      profileHeader
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
