import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Card, { CardStyle } from "../../components/system/Card";
import Button, { ButtonColor } from "../../components/system/Button";
import { useAuth } from "../../lib/AuthContext";
import UserBubble from "../../components/UserBubble";
import {
  userFindOne,
  userRequestFriend,
  userRemoveFriend,
  userListFriends,
  UserDto,
  userMyFriendRelationship,
  FriendStatusDto,
} from "../../../../../shared/client";

const UserProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profileUser, setProfileUser] = useState<UserDto | null>(null);
  const [userFriends, setUserFriends] = useState<UserDto[]>([]);
  const [friendStatus, setFriendStatus] =
    useState<FriendStatusDto["status"]>("none");
  const [sendingRequest, setSendingRequest] = useState(false);
  const [isMe, setIsMe] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (!id) return;

        const userId = parseInt(id);

        // Fetch user profile
        const { data: userData } = await userFindOne({
          path: { id: userId },
        });
        if (userData) {
          setProfileUser(userData);
        }
        setIsMe(userData?.email === user?.email);

        // Fetch user's friends
        const { data: friendsData } = await userListFriends({
          path: { id: userId },
        });
        if (friendsData) {
          setUserFriends(friendsData);
        }
        const { data: friendStatusData } = await userMyFriendRelationship({
          path: { id: userId },
        });
        setFriendStatus(friendStatusData?.status ?? "none");
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id, user]);

  const handleSendFriendRequest = async () => {
    if (!id || !user) return;

    try {
      setSendingRequest(true);
      await userRequestFriend({ path: { targetUserId: parseInt(id) } });
      setFriendStatus("pending");
    } catch (error) {
      console.error("Error sending friend request:", error);
    } finally {
      setSendingRequest(false);
    }
  };

  const handleRemoveFriend = async () => {
    if (!id || !user) return;

    try {
      setSendingRequest(true);
      await userRemoveFriend({ path: { targetUserId: parseInt(id) } });
      setFriendStatus("none");
    } catch (error) {
      console.error("Error removing friend:", error);
    } finally {
      setSendingRequest(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-pagebg pt-20 px-8 md:px-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-sabon mb-8">User Profile</h1>
          <Card style={CardStyle.White} className="p-8">
            <p className="text-center text-stone-500">Loading profile...</p>
          </Card>
        </div>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="min-h-screen bg-pagebg pt-20 px-8 md:px-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-sabon mb-8">User Profile</h1>
          <Card style={CardStyle.White} className="p-8">
            <p className="text-center text-stone-500">User not found</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pagebg pt-20 px-8 md:px-16">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-sabon">User Profile</h1>
          {isMe && (
            <Button
              onClick={() => navigate("/settings")}
              color={ButtonColor.Stone}
              className="px-4"
            >
              Edit My Profile
            </Button>
          )}
        </div>

        <Card style={CardStyle.White} className="p-8 mb-6">
          <div className="flex items-center mb-8">
            <UserBubble className="w-20 h-20 mr-6" />
            <div>
              <h2 className="text-xl font-bold">{profileUser.name}</h2>
              <p className="text-stone-500">{profileUser.email}</p>
            </div>
          </div>

          {!isMe && (
            <div className="border-t pt-4">
              {friendStatus === "none" && (
                <Button
                  onClick={handleSendFriendRequest}
                  color={ButtonColor.Blue}
                  disabled={sendingRequest}
                >
                  {sendingRequest ? "Sending..." : "Send Friend Request"}
                </Button>
              )}
              {friendStatus === "pending" && (
                <div className="flex items-center">
                  <span className="text-stone-500 mr-4">
                    Friend Request Pending
                  </span>
                  <Button
                    onClick={handleRemoveFriend}
                    color={ButtonColor.Stone}
                    disabled={sendingRequest}
                  >
                    Cancel Request
                  </Button>
                </div>
              )}
              {friendStatus === "accepted" && (
                <div className="flex items-center">
                  <span className="text-green-600 mr-4">Friends</span>
                  <Button
                    onClick={handleRemoveFriend}
                    color={ButtonColor.Red}
                    disabled={sendingRequest}
                  >
                    Remove Friend
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>

        <Card style={CardStyle.White} className="p-8">
          <h3 className="text-lg font-bold mb-4">
            Friends ({userFriends.length})
          </h3>
          {userFriends.length === 0 ? (
            <p className="text-stone-500">No friends yet</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {userFriends.map((friend) => (
                <div
                  key={friend.email}
                  className="flex items-center p-2 border rounded-lg"
                >
                  <UserBubble className="w-10 h-10 mr-3" />
                  <div>
                    <p className="font-medium">{friend.name}</p>
                    <p className="text-stone-500 text-sm">{friend.email}</p>
                  </div>
                  <Button
                    onClick={() => navigate(`/user/${friend.email}`)}
                    color={ButtonColor.Light}
                    className="ml-auto"
                  >
                    View
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default UserProfilePage;
