import { failedToLoad } from "@alliance/shared/lib/failedToLoad";
import {
  useAcceptFriendRequestMutation,
  useDeclineFriendRequestMutation,
  useRemoveFriendMutation,
  useSendFriendRequestMutation,
  useUserFriendStatusQuery,
} from "@alliance/shared/lib/user";
import { ChevronDown, RefreshCw } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Pressable, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../lib/AuthContext";
import Button, { ButtonColor, ButtonSize } from "../system/Button";
import Text, { FontWeight } from "../system/Text";
import { alertFriendFailure } from "./alertFriendFailure";

export default function FriendRequestButton({ userId }: { userId: number }) {
  const { isAuthenticated } = useAuth();
  const friendStatusQuery = useUserFriendStatusQuery(userId, {
    enabled: isAuthenticated,
  });
  const {
    data: friendStatus,
    isFetching: isFetchingFriendStatus,
    refetch: refetchFriendStatus,
  } = friendStatusQuery;
  const didFriendStatusFail = failedToLoad(friendStatusQuery);

  const sendFriendRequest = useSendFriendRequestMutation();
  const acceptFriendRequest = useAcceptFriendRequestMutation();
  const declineFriendRequest = useDeclineFriendRequestMutation();
  const removeFriend = useRemoveFriendMutation();
  const answeringRequest =
    acceptFriendRequest.isPending || declineFriendRequest.isPending;

  const [friendActionsOpen, setFriendActionsOpen] = useState(false);

  const handleSendFriendRequest = useCallback(async () => {
    try {
      await sendFriendRequest.mutateAsync(userId);
    } catch (error) {
      console.error("Failed to send friend request", error);
      alertFriendFailure("Couldn't send friend request", error);
    }
  }, [userId, sendFriendRequest]);

  const handleAcceptFriendRequest = useCallback(async () => {
    try {
      await acceptFriendRequest.mutateAsync(userId);
    } catch (error) {
      console.error("Failed to accept friend request", error);
      alertFriendFailure("Couldn't accept friend request", error);
    }
  }, [userId, acceptFriendRequest]);

  const handleDeclineFriendRequest = useCallback(async () => {
    try {
      await declineFriendRequest.mutateAsync(userId);
    } catch (error) {
      console.error("Failed to decline friend request", error);
      alertFriendFailure("Couldn't decline friend request", error);
    }
  }, [userId, declineFriendRequest]);

  const handleRemoveFriend = useCallback(async () => {
    try {
      await removeFriend.mutateAsync(userId);
      setFriendActionsOpen(false);
    } catch (error) {
      console.error("Failed to remove friend", error);
      alertFriendFailure("Couldn't remove friend", error);
    }
  }, [userId, removeFriend]);

  useEffect(() => {
    if (friendStatus?.status !== "accepted") {
      setFriendActionsOpen(false);
    }
  }, [friendStatus?.status]);

  if (!isAuthenticated) return null;

  if (!friendStatus) {
    if (!didFriendStatusFail) return null;
    return (
      <Button
        color={ButtonColor.White}
        size={ButtonSize.Small}
        onPress={() => void refetchFriendStatus()}
        loading={isFetchingFriendStatus}
        accessibilityLabel="Retry loading friend status"
      >
        <RefreshCw size={14} color="#27272a" />
      </Button>
    );
  }

  const status = friendStatus.status ?? "none";
  switch (status) {
    case "none":
    case "declined":
      return (
        <Button
          title="Send friend request"
          color={ButtonColor.White}
          size={ButtonSize.Small}
          onPress={handleSendFriendRequest}
        />
      );
    case "accepted":
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
    case "pending":
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
              disabled={answeringRequest}
            />
            <Button
              title="Decline"
              color={ButtonColor.Light}
              size={ButtonSize.Small}
              onPress={handleDeclineFriendRequest}
              disabled={answeringRequest}
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
    default:
      status satisfies never;
      return null;
  }
}
