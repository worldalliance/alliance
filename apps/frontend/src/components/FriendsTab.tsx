import {
  ProfileDto,
  userAcceptFriendRequest,
  userDeclineFriendRequest,
  userListFriends,
  userListReceivedRequests,
  userListSentRequests,
  userRemoveFriend,
} from "@alliance/shared/client";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import List from "@alliance/sharedweb/ui/List";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { Link, href } from "react-router";

interface FriendsTabProps {
  userId: number;
  isMe?: boolean;
  originalTab?: "friends" | "received" | "sent";
  friends?: ProfileDto[];
  className?: string;
}

const FriendsTab: React.FC<FriendsTabProps> = ({
  userId,
  isMe = false,
  originalTab = "friends",
  friends: initialFriends = [],
  className,
}: FriendsTabProps) => {
  const queryClient = useQueryClient();

  const { data: friends = initialFriends, isLoading: isLoadingFriends } =
    useQuery({
      queryKey: ["userListFriends", userId],
      queryFn: () =>
        userListFriends({ path: { id: userId } }).then((res) => res.data ?? []),
    });

  const { data: receivedRequests = [], isLoading: isLoadingReceived } =
    useQuery({
      queryKey: ["userListReceivedRequests"],
      queryFn: () => userListReceivedRequests({}).then((res) => res.data ?? []),
    });

  const { data: sentRequests = [], isLoading: isLoadingSent } = useQuery({
    queryKey: ["userListSentRequests"],
    queryFn: () => userListSentRequests({}).then((res) => res.data ?? []),
  });

  const loading = isLoadingFriends || isLoadingReceived || isLoadingSent;

  const [activeTab, setActiveTab] = useState<"friends" | "received" | "sent">(
    originalTab,
  );
  const [processingIds, setProcessingIds] = useState<Record<string, boolean>>(
    {},
  );
  const { confirm } = useToast();

  const startProcessing = (userId: number) => {
    setProcessingIds((prev) => ({ ...prev, [userId]: true }));
  };

  const endProcessing = (userId: number) => {
    setProcessingIds((prev) => ({ ...prev, [userId]: false }));
  };

  const handleAcceptRequest = async (requesterId: number) => {
    console.log("requesterId", requesterId);
    startProcessing(requesterId);

    try {
      const response = await userAcceptFriendRequest({ path: { requesterId } });
      console.log("response", response);
      queryClient.invalidateQueries({ queryKey: ["userListFriends"] });
      queryClient.invalidateQueries({
        queryKey: ["userListReceivedRequests"],
      });
    } catch (error) {
      console.error("Error accepting friend request:", error);
    } finally {
      endProcessing(requesterId);
    }
  };

  const handleDeclineRequest = async (requesterId: number) => {
    startProcessing(requesterId);

    try {
      await userDeclineFriendRequest({ path: { requesterId } });
      queryClient.invalidateQueries({
        queryKey: ["userListReceivedRequests"],
      });
    } catch (error) {
      console.error("Error declining friend request:", error);
    } finally {
      endProcessing(requesterId);
    }
  };

  const handleRemoveFriend = async (
    e: React.MouseEvent<HTMLElement>,
    friendId: number,
  ) => {
    const ok = await confirm({
      message: "Are you sure you want to remove this friend?",
      confirmLabel: "Yes",
      cancelLabel: "No",
      anchorEl: e.currentTarget,
      placement: "topleft",
    });
    if (!ok) {
      return;
    }

    startProcessing(friendId);

    try {
      await userRemoveFriend({ path: { targetUserId: friendId } });
      queryClient.invalidateQueries({ queryKey: ["userListFriends"] });
    } catch (error) {
      console.error("Error removing friend:", error);
    } finally {
      endProcessing(friendId);
    }
  };

  const handleCancelRequest = async (userId: number) => {
    startProcessing(userId);

    try {
      await userRemoveFriend({ path: { targetUserId: userId } });
      queryClient.invalidateQueries({ queryKey: ["userListSentRequests"] });
    } catch (error) {
      console.error("Error canceling friend request:", error);
    } finally {
      endProcessing(userId);
    }
  };

  if (
    loading &&
    !friends.length &&
    !receivedRequests.length &&
    !sentRequests.length
  ) {
    return (
      <Card style={CardStyle.White} className="p-4">
        <p className="text-center text-zinc-500 py-4">Loading friend data...</p>
      </Card>
    );
  }

  const friendsList: React.ReactNode = (
    <>
      {friends.length === 0 ? (
        <p className="text-center text-zinc-500 py-4 text-sm">
          No friends yet.
        </p>
      ) : (
        <List>
          {friends
            .filter((friend) => typeof friend.id === "number")
            .map((friend) => (
              <div
                key={friend.id}
                className="flex items-center p-3 hover:bg-zinc-100 group"
              >
                <Link
                  className="flex items-center flex-1"
                  to={href("/member/:id", { id: friend.id.toString() })}
                >
                  <AvatarProfile className="mr-3" pfp={friend.profilePicture} />
                  <div className="flex-grow">
                    <p className="">{friend.displayName}</p>
                  </div>
                </Link>
                {isMe && (
                  <Button
                    onClick={(e) => handleRemoveFriend(e, friend.id)}
                    color={ButtonColor.Red}
                    disabled={processingIds[friend.id]}
                    className="text-sm bg-transparent hover:!text-red-700 hidden group-hover:block"
                  >
                    {processingIds[friend.id] ? "Removing..." : "Remove friend"}
                  </Button>
                )}
              </div>
            ))}
        </List>
      )}
    </>
  );

  if (!isMe) {
    return friendsList;
  }

  const baseClasses = "px-4 py-2 text-base! cursor-pointer";
  const activeClasses = "border-b-2 border-green";
  const inactiveClasses = "text-black";

  return (
    <>
      <div className={cn("flex mb-3", className)}>
        <span
          className={cn(
            baseClasses,
            activeTab === "friends" ? activeClasses : inactiveClasses,
          )}
          onClick={() => setActiveTab("friends")}
        >
          Friends ({friends.length})
        </span>
        {isMe && (
          <span
            className={cn(
              baseClasses,
              activeTab === "received" ? activeClasses : inactiveClasses,
            )}
            onClick={() => setActiveTab("received")}
          >
            Received Requests ({receivedRequests.length})
          </span>
        )}
        {isMe && (
          <span
            className={cn(
              baseClasses,
              activeTab === "sent" ? activeClasses : inactiveClasses,
            )}
            onClick={() => setActiveTab("sent")}
          >
            Sent Requests ({sentRequests.length})
          </span>
        )}
      </div>

      <div className="">
        {activeTab === "friends" && friendsList}

        {activeTab === "received" && isMe && (
          <>
            {receivedRequests.length === 0 ? (
              <p className="text-center text-zinc-500 py-4">
                No pending friend requests.
              </p>
            ) : (
              <List>
                {receivedRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center p-3 justify-between"
                  >
                    <Link
                      to={href("/member/:id", { id: request.id.toString() })}
                      className="flex flex-row flex-2 items-center hover:underline gap-x-3"
                    >
                      <AvatarProfile pfp={request.profilePicture} />
                      <p>{request.displayName}</p>
                    </Link>
                    <div className="flex space-x-2 -my-1">
                      <Button
                        onClick={() => handleAcceptRequest(request.id)}
                        color={ButtonColor.Green}
                        disabled={processingIds[request.id]}
                      >
                        {processingIds[request.id] ? "Processing..." : "Accept"}
                      </Button>
                      <Button
                        onClick={() => handleDeclineRequest(request.id)}
                        color={ButtonColor.White}
                        disabled={processingIds[request.id]}
                      >
                        {processingIds[request.id]
                          ? "Processing..."
                          : "Decline"}
                      </Button>
                    </div>
                  </div>
                ))}
              </List>
            )}
          </>
        )}

        {activeTab === "sent" && (
          <>
            {sentRequests.length === 0 ? (
              <p className="text-center text-zinc-500 py-4 text-sm">
                You haven&apos;t sent any friend requests.
              </p>
            ) : (
              <List>
                {sentRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center p-3 justify-between"
                  >
                    <div className="flex flex-row items-center gap-x-3">
                      <AvatarProfile pfp={request.profilePicture} />
                      <p>{request.displayName}</p>
                    </div>
                    <Button
                      onClick={() => handleCancelRequest(request.id)}
                      color={ButtonColor.Black}
                      disabled={processingIds[request.id]}
                    >
                      {processingIds[request.id]
                        ? "Canceling..."
                        : "Cancel Request"}
                    </Button>
                  </div>
                ))}
              </List>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default FriendsTab;
