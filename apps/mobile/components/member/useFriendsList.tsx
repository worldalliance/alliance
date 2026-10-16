import type { ProfileDto } from "@alliance/shared/client";
import { failedToLoad } from "@alliance/shared/lib/failedToLoad";
import {
  useAcceptFriendRequestMutation,
  useDeclineFriendRequestMutation,
  useMessageableUsersQuery,
  useRemoveFriendMutation,
  useUserFriendsQuery,
  useUserReceivedFriendRequestsQuery,
  useUserSentFriendRequestsQuery,
} from "@alliance/shared/lib/user";
import { router } from "expo-router";
import { MessageSquare } from "lucide-react-native";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Alert, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../lib/AuthContext";
import { colors } from "../../lib/style/colors";
import LoadFailed from "../LoadFailed";
import ProfileImage from "../ProfileImage";
import Button, { ButtonColor, ButtonSize } from "../system/Button";
import { SegmentedTabs } from "../system/SegmentedTabs";
import Text, { FontWeight } from "../system/Text";
import { alertFriendFailure } from "./alertFriendFailure";

enum FriendsTab {
  Friends = "friends",
  Received = "received",
  Sent = "sent",
}

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

function FriendRow({
  friend,
  canMessage,
}: {
  friend: ProfileDto;
  canMessage: boolean;
}) {
  return (
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
      {canMessage && (
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
  );
}

function RequestRow({
  request,
  children,
}: {
  request: ProfileDto;
  children: ReactNode;
}) {
  return (
    <View className="px-4 py-3 border-b border-zinc-200">
      <View className="flex-row items-center gap-3">
        <ProfileImage pfp={request.profilePicture} size="small" />
        <Text className="text-zinc-900 flex-1" weight={FontWeight.Medium}>
          {request.displayName}
        </Text>
        {children}
      </View>
    </View>
  );
}

export function useFriendsList({
  userId,
  isMe,
}: {
  userId: number;
  isMe: boolean;
}) {
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<FriendsTab>(FriendsTab.Friends);

  const friendsQuery = useUserFriendsQuery(userId);
  const receivedQuery = useUserReceivedFriendRequestsQuery({ enabled: isMe });
  const sentQuery = useUserSentFriendRequestsQuery({ enabled: isMe });
  const { ids: messageableIds } = useMessageableUsersQuery({
    enabled: isAuthenticated,
  });

  const acceptFriendRequest = useAcceptFriendRequestMutation();
  const declineFriendRequest = useDeclineFriendRequestMutation();
  const removeFriend = useRemoveFriendMutation();
  const answeringRequest =
    acceptFriendRequest.isPending || declineFriendRequest.isPending;

  useEffect(() => {
    setTab(FriendsTab.Friends);
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

  const renderFriend = useCallback(
    ({ item }: { item: ProfileDto }) => (
      <FriendRow
        friend={item}
        canMessage={isMe && messageableIds.has(item.id)}
      />
    ),
    [isMe, messageableIds],
  );

  const renderReceived = useCallback(
    ({ item }: { item: ProfileDto }) => (
      <RequestRow request={item}>
        <View className="flex-row gap-2">
          <Button
            title="Accept"
            color={ButtonColor.Green}
            size={ButtonSize.Small}
            onPress={() =>
              acceptFriendRequest
                .mutateAsync(item.id)
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
                .mutateAsync(item.id)
                .catch((error) =>
                  alertFriendFailure("Couldn't decline friend request", error),
                )
            }
            disabled={answeringRequest}
          />
        </View>
      </RequestRow>
    ),
    [acceptFriendRequest, declineFriendRequest, answeringRequest],
  );

  const renderSent = useCallback(
    ({ item }: { item: ProfileDto }) => (
      <RequestRow request={item}>
        <Button
          title="Cancel"
          color={ButtonColor.Light}
          size={ButtonSize.Small}
          onPress={() => confirmCancelRequest(item.id)}
        />
      </RequestRow>
    ),
    [confirmCancelRequest],
  );

  const friendsList = {
    query: friendsQuery,
    renderItem: renderFriend,
    emptyMessage: "No friends yet.",
  };
  const list = !isMe
    ? friendsList
    : {
        [FriendsTab.Friends]: friendsList,
        [FriendsTab.Received]: {
          query: receivedQuery,
          renderItem: renderReceived,
          emptyMessage: "No incoming requests.",
        },
        [FriendsTab.Sent]: {
          query: sentQuery,
          renderItem: renderSent,
          emptyMessage: "No outgoing requests.",
        },
      }[tab];

  const empty = failedToLoad(list.query) ? (
    <LoadFailed
      message="Couldn't load this list."
      onRetry={() => void list.query.refetch()}
      retrying={list.query.isFetching}
    />
  ) : (
    <Text className="text-center text-zinc-500 py-6 px-4">
      {list.emptyMessage}
    </Text>
  );

  const tabs = isMe ? (
    <View className="px-4">
      <View className="my-4">
        <SegmentedTabs
          tabs={FRIENDS_TABS_ORDER}
          selectedTab={tab}
          onSelect={setTab}
          labels={FRIENDS_TAB_LABELS}
        />
      </View>
    </View>
  ) : null;

  return {
    data: list.query.data ?? [],
    renderItem: list.renderItem,
    empty,
    tabs,
  };
}
