import { failedToLoad } from "@alliance/shared/lib/failedToLoad";
import {
  friendMutationErrorMessage,
  useAcceptFriendRequestMutation,
  useDeclineFriendRequestMutation,
  useRemoveFriendMutation,
  useUserFriendsQuery,
  useUserReceivedFriendRequestsQuery,
  useUserSentFriendRequestsQuery,
} from "@alliance/shared/lib/user";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import List from "@alliance/sharedweb/ui/List";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import React, { useState } from "react";
import { Link, href } from "react-router";
import LoadFailed from "./LoadFailed";

interface FriendsTabProps {
  userId: number;
  isMe?: boolean;
  originalTab?: "friends" | "received" | "sent";
  className?: string;
}

const LIST_LOAD_FAILED = "Couldn't load this list.";

const tabLabel = (params: {
  label: string;
  count: number;
  didFail: boolean;
}) => (params.didFail ? params.label : `${params.label} (${params.count})`);

const FriendsTab: React.FC<FriendsTabProps> = ({
  userId,
  isMe = false,
  originalTab = "friends",
  className,
}: FriendsTabProps) => {
  const friendsQuery = useUserFriendsQuery(userId);
  const {
    data: friends = [],
    isLoading: isLoadingFriends,
    isFetching: isFetchingFriends,
    refetch: refetchFriends,
  } = friendsQuery;
  const didFriendsFail = failedToLoad(friendsQuery);

  const receivedQuery = useUserReceivedFriendRequestsQuery();
  const {
    data: receivedRequests = [],
    isLoading: isLoadingReceived,
    isFetching: isFetchingReceived,
    refetch: refetchReceived,
  } = receivedQuery;
  const didReceivedFail = failedToLoad(receivedQuery);

  const sentQuery = useUserSentFriendRequestsQuery();
  const {
    data: sentRequests = [],
    isLoading: isLoadingSent,
    isFetching: isFetchingSent,
    refetch: refetchSent,
  } = sentQuery;
  const didSentFail = failedToLoad(sentQuery);

  const acceptFriendRequest = useAcceptFriendRequestMutation();
  const declineFriendRequest = useDeclineFriendRequestMutation();
  const removeFriend = useRemoveFriendMutation();

  const loading =
    (isLoadingFriends && !didFriendsFail) ||
    (isLoadingReceived && !didReceivedFail) ||
    (isLoadingSent && !didSentFail);

  const [activeTab, setActiveTab] = useState<"friends" | "received" | "sent">(
    originalTab,
  );
  const [processingIds, setProcessingIds] = useState<Record<string, boolean>>(
    {},
  );
  const { confirm, error: errorToast } = useToast();

  const showFailure = (title: string, error: unknown) =>
    errorToast(friendMutationErrorMessage(error), title);

  const startProcessing = (userId: number) => {
    setProcessingIds((prev) => ({ ...prev, [userId]: true }));
  };

  const endProcessing = (userId: number) => {
    setProcessingIds((prev) => ({ ...prev, [userId]: false }));
  };

  const handleAcceptRequest = async (requesterId: number) => {
    startProcessing(requesterId);

    try {
      await acceptFriendRequest.mutateAsync(requesterId);
    } catch (error) {
      console.error("Error accepting friend request:", error);
      showFailure("Couldn't accept friend request", error);
    } finally {
      endProcessing(requesterId);
    }
  };

  const handleDeclineRequest = async (requesterId: number) => {
    startProcessing(requesterId);

    try {
      await declineFriendRequest.mutateAsync(requesterId);
    } catch (error) {
      console.error("Error declining friend request:", error);
      showFailure("Couldn't decline friend request", error);
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
      await removeFriend.mutateAsync(friendId);
    } catch (error) {
      console.error("Error removing friend:", error);
      showFailure("Couldn't remove friend", error);
    } finally {
      endProcessing(friendId);
    }
  };

  const handleCancelRequest = async (userId: number) => {
    startProcessing(userId);

    try {
      await removeFriend.mutateAsync(userId);
    } catch (error) {
      console.error("Error canceling friend request:", error);
      showFailure("Couldn't cancel friend request", error);
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
        didFriendsFail ? (
          <LoadFailed
            message={LIST_LOAD_FAILED}
            onRetry={() => void refetchFriends()}
            retrying={isFetchingFriends}
          />
        ) : (
          <p className="text-center text-zinc-500 py-4 text-sm">
            No friends yet.
          </p>
        )
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
          {tabLabel({
            label: "Friends",
            count: friends.length,
            didFail: didFriendsFail,
          })}
        </span>
        {isMe && (
          <span
            className={cn(
              baseClasses,
              activeTab === "received" ? activeClasses : inactiveClasses,
            )}
            onClick={() => setActiveTab("received")}
          >
            {tabLabel({
              label: "Received Requests",
              count: receivedRequests.length,
              didFail: didReceivedFail,
            })}
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
            {tabLabel({
              label: "Sent Requests",
              count: sentRequests.length,
              didFail: didSentFail,
            })}
          </span>
        )}
      </div>

      <div className="">
        {activeTab === "friends" && friendsList}

        {activeTab === "received" && isMe && (
          <>
            {receivedRequests.length === 0 ? (
              didReceivedFail ? (
                <LoadFailed
                  message={LIST_LOAD_FAILED}
                  onRetry={() => void refetchReceived()}
                  retrying={isFetchingReceived}
                />
              ) : (
                <p className="text-center text-zinc-500 py-4">
                  No pending friend requests.
                </p>
              )
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
              didSentFail ? (
                <LoadFailed
                  message={LIST_LOAD_FAILED}
                  onRetry={() => void refetchSent()}
                  retrying={isFetchingSent}
                />
              ) : (
                <p className="text-center text-zinc-500 py-4 text-sm">
                  You haven&apos;t sent any friend requests.
                </p>
              )
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
