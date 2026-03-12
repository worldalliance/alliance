import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
} from "react-native";
import { RelativePathString, router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { UpdateProfileDto } from "@alliance/shared/client";
import {
  buildForumActivityItems,
  type ForumActivityItem,
  useAcceptFriendRequestMutation,
  useDeclineFriendRequestMutation,
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
} from "@alliance/shared/lib/user";
import useActivities, {
  ActivityList,
} from "@alliance/shared/lib/useActivities";
import { formatTime } from "@alliance/shared/lib/utils";
import { Edit } from "lucide-react-native";
import AppMarkdownWrapper from "../../../components/AppMarkdownWrapper";
import EditableContentRenderer from "../../../components/EditableContentRenderer";
import ProfileImage from "../../../components/ProfileImage";
import UserActivityCard from "../../../components/UserActivityCard";
import Button, {
  ButtonColor,
  ButtonSize,
} from "../../../components/system/Button";
import Text from "../../../components/system/Text";
import { useAuth } from "../../../lib/AuthContext";
import { colors } from "../../../lib/style/colors";
import { cn } from "@alliance/shared/styles/util";

type ProfileTab = "actions" | "forum" | "friends";
type FriendsTab = "friends" | "received" | "sent";

const tabs: { id: ProfileTab; label: string }[] = [
  { id: "actions", label: "Actions" },
  { id: "forum", label: "Forum" },
  { id: "friends", label: "Friends" },
];

const friendsTabs: { id: FriendsTab; label: string }[] = [
  { id: "friends", label: "Friends" },
  { id: "received", label: "Received" },
  { id: "sent", label: "Sent" },
];

export default function UserProfileScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const parsedUserId = rawId ? Number.parseInt(rawId, 10) : undefined;
  const userId = Number.isNaN(parsedUserId) ? undefined : parsedUserId;
  const { user, isAuthenticated } = useAuth();
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

  const sendFriendRequest = useSendFriendRequestMutation();
  const acceptFriendRequest = useAcceptFriendRequestMutation();
  const declineFriendRequest = useDeclineFriendRequestMutation();
  const removeFriend = useRemoveFriendMutation();
  const updateProfileMutation = useUpdateProfileMutation(userId);

  const { activities, handleLikeActivity, updateActivity } = useActivities({
    list: ActivityList.User,
    objectId: userId ?? 0,
    comments: true,
  });

  const [selectedTab, setSelectedTab] = useState<ProfileTab>("actions");
  const [friendsTab, setFriendsTab] = useState<FriendsTab>("friends");
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null);
  const [isPickingAvatar, setIsPickingAvatar] = useState(false);

  const completedActions = useMemo(() => {
    return (
      activities?.filter((activity) => activity.type === "user_completed") ?? []
    );
  }, [activities]);

  const forumActivityItems = useMemo(
    () => buildForumActivityItems(forumPosts, forumComments),
    [forumPosts, forumComments]
  );

  useEffect(() => {
    if (!profile || !isMe || isEditing) return;
    setEditName(profile.displayName || "");
    setEditBio(profile.profileDescription || "");
    setEditAvatarUrl(profile.profilePicture || null);
  }, [profile, isMe, isEditing]);

  useEffect(() => {
    setSelectedTab("actions");
    setFriendsTab("friends");
    setIsEditing(false);
  }, [userId]);

  const handlePickAvatar = useCallback(async () => {
    if (isPickingAvatar) return;
    setIsPickingAvatar(true);
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission required", "Please allow photo access.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets.length) return;
      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert("Upload failed", "Unable to read that image.");
        return;
      }

      const mime = asset.mimeType ?? "image/jpeg";
      setEditAvatarUrl(`data:${mime};base64,${asset.base64}`);
    } catch (error) {
      console.error("Failed to pick image", error);
      Alert.alert("Upload failed", "Unable to select that photo.");
    } finally {
      setIsPickingAvatar(false);
    }
  }, [isPickingAvatar]);

  const handleSaveProfile = useCallback(async () => {
    if (!isMe || updateProfileMutation.isPending) return;

    const payload: UpdateProfileDto = {
      name: editName,
      profileDescription: editBio,
      profilePicture: editAvatarUrl ?? undefined,
    };

    try {
      await updateProfileMutation.mutateAsync(payload);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save profile", error);
    }
  }, [isMe, updateProfileMutation, editName, editBio, editAvatarUrl]);

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
    [removeFriend]
  );

  const renderFriendAction = useCallback(() => {
    if (!isAuthenticated || isMe || !friendStatus) return null;

    if (friendStatus.status === "none") {
      return (
        <Button
          title="Send friend request"
          color={ButtonColor.Blue}
          size={ButtonSize.Medium}
          onPress={handleSendFriendRequest}
        />
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
          size={ButtonSize.Medium}
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
  ]);

  const renderActionItem = useCallback(
    ({ item: activity }: { item: (typeof completedActions)[number] }) => (
      <View className="border-b border-zinc-200">
        <UserActivityCard
          activity={activity}
          handleLike={handleLikeActivity}
          onActivityUpdate={updateActivity}
          canEdit={isMe}
        />
      </View>
    ),
    [handleLikeActivity, updateActivity, isMe]
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
            <Text className="text-sm text-zinc-900">{item.post.title}</Text>
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
          ? `/forum/post/${item.comment.parentObjectId}`
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
              commented{" "}
              {formatTime(new Date(item.comment.createdAt), {
                addSuffix: true,
              })}{" "}
              in{" "}
              <Text className="text-sm text-green font-medium">
                {item.comment.parentTitle}
              </Text>
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    []
  );

  const renderReceivedItem = useCallback(
    ({ item: request }: { item: any }) => (
      <View className="px-4 py-3 border-b border-zinc-200">
        <View className="flex-row items-center gap-3">
          <ProfileImage pfp={request.profilePicture} size="small" />
          <Text className="text-zinc-900 font-medium flex-1">
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
    [acceptFriendRequest, declineFriendRequest]
  );

  const renderSentItem = useCallback(
    ({ item: request }: { item: any }) => (
      <View className="px-4 py-3 border-b border-zinc-200">
        <View className="flex-row items-center gap-3">
          <ProfileImage pfp={request.profilePicture} size="small" />
          <Text className="text-zinc-900 font-medium flex-1">
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
    [confirmCancelRequest]
  );

  const renderFriendItem = useCallback(
    ({ item: friend }: { item: any }) => (
      <View className="px-4 py-3 border-b border-zinc-200 flex-row items-center justify-between">
        <TouchableOpacity
          className="flex-row items-center gap-3 flex-1"
          onPress={() =>
            router.push(`/user/${friend.id}` as RelativePathString)
          }
          activeOpacity={0.8}
        >
          <ProfileImage pfp={friend.profilePicture} size="small" />
          <Text className="text-zinc-900 font-medium">
            {friend.displayName}
          </Text>
        </TouchableOpacity>
      </View>
    ),
    []
  );

  const listData = useMemo((): any[] => {
    if (selectedTab === "actions") return completedActions;
    if (selectedTab === "forum") return forumActivityItems;
    if (friendsTab === "received" && isMe) return receivedRequests;
    if (friendsTab === "sent" && isMe) return sentRequests;
    return friends;
  }, [
    selectedTab,
    friendsTab,
    isMe,
    completedActions,
    forumActivityItems,
    receivedRequests,
    sentRequests,
    friends,
  ]);

  const listKeyExtractor = useCallback(
    (item: any) => {
      if (selectedTab === "forum") {
        return item.type === "post"
          ? `post-${item.post.id}`
          : `comment-${item.comment.id}`;
      }
      return item.id.toString();
    },
    [selectedTab]
  );

  const listRenderItem = useCallback(
    ({ item }: { item: any }) => {
      if (selectedTab === "actions") return renderActionItem({ item });
      if (selectedTab === "forum") return renderForumItem({ item });
      if (friendsTab === "received" && isMe)
        return renderReceivedItem({ item });
      if (friendsTab === "sent" && isMe) return renderSentItem({ item });
      return renderFriendItem({ item });
    },
    [
      selectedTab,
      friendsTab,
      isMe,
      renderActionItem,
      renderForumItem,
      renderReceivedItem,
      renderSentItem,
      renderFriendItem,
    ]
  );

  const listEmptyComponent = useMemo(() => {
    if (selectedTab === "actions") return undefined;
    if (selectedTab === "forum") {
      return (
        <Text className="text-center text-zinc-500 py-6 px-4">
          No forum activity yet
        </Text>
      );
    }
    if (friendsTab === "received" && isMe) {
      return (
        <Text className="text-center text-zinc-500 py-6 px-4">
          No incoming requests.
        </Text>
      );
    }
    if (friendsTab === "sent" && isMe) {
      return (
        <Text className="text-center text-zinc-500 py-6 px-4">
          No outgoing requests.
        </Text>
      );
    }
    return (
      <Text className="text-center text-zinc-500 py-6 px-4">
        No friends yet.
      </Text>
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
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
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
  const profileHeader = (
    <>
      <View className="p-4 pt-12 gap-4">
        <View className="items-center gap-3">
          {isEditing ? (
            <TouchableOpacity
              onPress={handlePickAvatar}
              className="border-zinc-200 rounded-lg p-1 border-dashed border-2 relative"
            >
              <ProfileImage pfp={editAvatarUrl} size="huge" />
              <View className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center ">
                <Edit size={24} color="#fff" />
              </View>
            </TouchableOpacity>
          ) : (
            <ProfileImage pfp={profile.profilePicture} size="huge" />
          )}
        </View>

        <View className="items-center gap-2">
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
              <Text className="text-2xl font-semibold text-zinc-900">
                {profile.displayName}
              </Text>
              {profile.staff && (
                <View className={cn("bg-amber-600", badgeStyles)}>
                  <Text className="text-white text-xs">Staff</Text>
                </View>
              )}
              {!profile.staff && profile.isCommunityLeader && (
                <View className={cn("bg-green-600", badgeStyles)}>
                  <Text className="text-white text-xs">Lead</Text>
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
        </View>

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

        {(!isMe || isEditing) && (
          <View className="flex-row items-center justify-end gap-3">
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

        <View className="flex-row bg-zinc-100 rounded-lg p-1">
          {tabs.map((tab) => {
            const isSelected = selectedTab === tab.id;

            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setSelectedTab(tab.id)}
                activeOpacity={0.7}
                className={cn(
                  "flex-1 px-3 py-2 rounded-md items-center",
                  isSelected && "bg-white"
                )}
              >
                <Text
                  className={cn(
                    "text-sm font-medium",
                    isSelected ? "text-zinc-900" : "text-zinc-500"
                  )}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <View className="border-t border-zinc-200" />
    </>
  );

  const listHeader =
    selectedTab === "friends" && isMe ? (
      <View>
        {profileHeader}
        <View className="px-4">
          <View className="flex-row bg-zinc-100 rounded-lg p-1 my-4">
            {friendsTabs.map((tab) => (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setFriendsTab(tab.id)}
                activeOpacity={0.7}
                className={cn(
                  "flex-1 px-3 py-2 rounded-md items-center",
                  friendsTab === tab.id && "bg-white"
                )}
              >
                <Text
                  className={cn(
                    "text-sm font-medium",
                    friendsTab === tab.id ? "text-zinc-900" : "text-zinc-500"
                  )}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    ) : (
      profileHeader
    );

  return (
    <View className="flex-1 bg-white" testID="vr-user-profile-ready">
      <FlatList
        data={listData}
        keyExtractor={listKeyExtractor}
        renderItem={listRenderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmptyComponent}
        ListFooterComponent={<View className="h-16" />}
        contentContainerStyle={{ backgroundColor: "white" }}
      />
    </View>
  );
}
