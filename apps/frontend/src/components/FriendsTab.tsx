import {
  ProfileDto,
  userAcceptFriendRequest,
  userDeclineFriendRequest,
  userListFriends,
  userListReceivedRequests,
  userListSentRequests,
  userRemoveFriend,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import List from "@alliance/shared/ui/List";
import ProfileImage from "@alliance/shared/ui/ProfileImage";
import React, { useCallback, useEffect, useState } from "react";
import { Link, href } from "react-router";
import { setRevalidate } from "../applayout";

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
  const [loading, setLoading] = useState(!!initialFriends.length);
  const [friends, setFriends] = useState<ProfileDto[]>(initialFriends);
  const [receivedRequests, setReceivedRequests] = useState<ProfileDto[]>([]);
  const [sentRequests, setSentRequests] = useState<ProfileDto[]>([]);
  const [activeTab, setActiveTab] = useState<"friends" | "received" | "sent">(
    originalTab
  );
  const [processingIds, setProcessingIds] = useState<Record<string, boolean>>(
    {}
  );
  console.log("originalTab", originalTab);
  console.log("isMe", isMe);
  console.log(activeTab);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [friendsResponse, receivedResponse, sentResponse] =
        await Promise.all([
          userListFriends({ path: { id: userId } }),
          userListReceivedRequests({}),
          userListSentRequests({}),
        ]);

      setFriends(friendsResponse.data || []);
      setReceivedRequests(receivedResponse.data || []);
      setSentRequests(sentResponse.data || []);
    } catch (error) {
      console.error("Error fetching friend data:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      fetchData();
      setRevalidate();
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
      setReceivedRequests((prev) =>
        prev.filter((req) => req.id !== requesterId)
      );
      fetchData();
    } catch (error) {
      console.error("Error declining friend request:", error);
    } finally {
      endProcessing(requesterId);
    }
  };

  const handleRemoveFriend = async (friendId: number) => {
    startProcessing(friendId);

    try {
      await userRemoveFriend({ path: { targetUserId: friendId } });
      setFriends((prev) => prev.filter((friend) => friend.id !== friendId));
      fetchData();
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
      setSentRequests((prev) => prev.filter((req) => req.id !== userId));
      fetchData();
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
          {friends.map((friend) => (
            <Link
              key={friend.id}
              className="flex items-center p-3 hover:bg-zinc-100"
              to={href("/member/:id", { id: friend.id.toString() })}
            >
              <ProfileImage className="mr-3" pfp={friend.profilePicture} />
              <div className="flex-grow">
                <p className="">{friend.displayName}</p>
              </div>
              {isMe && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFriend(friend.id);
                  }}
                  color={ButtonColor.Red}
                  disabled={processingIds[friend.id]}
                  className="text-sm bg-transparent hover:!text-red-700"
                >
                  {processingIds[friend.id] ? "Removing..." : "Remove friend"}
                </Button>
              )}
            </Link>
          ))}
        </List>
      )}
    </>
  );

  if (!isMe) {
    return friendsList;
  }

  return (
    <>
      <div className={`flex mb-3 ${className}`}>
        <Button
          color={ButtonColor.Transparent}
          className={`px-4 py-2 rounded-none  ${
            activeTab === "friends"
              ? "border-b-1 border-black font-semibold"
              : "text-zinc-500"
          }`}
          onClick={() => setActiveTab("friends")}
        >
          Friends ({friends.length})
        </Button>
        {isMe && (
          <Button
            color={ButtonColor.Transparent}
            className={`px-4 py-2 rounded-none ${
              activeTab === "received"
                ? "border-b-1 border-black font-semibold"
                : "text-zinc-500"
            }`}
            onClick={() => setActiveTab("received")}
          >
            Received Requests ({receivedRequests.length})
          </Button>
        )}
        {isMe && (
          <Button
            color={ButtonColor.Transparent}
            className={`px-4 py-2 rounded-none ${
              activeTab === "sent"
                ? "border-b-1 border-black font-semibold"
                : "text-zinc-500"
            }`}
            onClick={() => setActiveTab("sent")}
          >
            Sent Requests ({sentRequests.length})
          </Button>
        )}
      </div>

      <div className="">
        {activeTab === "friends" && friendsList}

        {activeTab === "received" && isMe && (
          <>
            {receivedRequests.length === 0 ? (
              <p className="text-center text-zinc-500 py-4 text-sm">
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
                      <ProfileImage pfp={request.profilePicture} />
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
                      <ProfileImage pfp={request.profilePicture} />
                      <p>{request.displayName}</p>
                    </div>
                    <Button
                      onClick={() => handleCancelRequest(request.id)}
                      color={ButtonColor.Stone}
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
