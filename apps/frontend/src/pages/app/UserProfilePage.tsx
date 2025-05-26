import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Card, { CardStyle } from "../../components/system/Card";
import Button, { ButtonColor } from "../../components/system/Button";
import { useAuth } from "../../lib/AuthContext";
import {
  userFindOne,
  userRequestFriend,
  userListFriends,
  UserDto,
  userMyFriendRelationship,
  FriendStatusDto,
  ActionDto,
  ProfileDto,
  actionsFindCompletedForUser,
} from "../../../../../shared/client";
import ProfileImage from "./ProfileImage";
import testImg from "../../assets/fakebgimage.png";
import icons8Plus from "../../assets/icons8-plus.svg";
import dots from "../../assets/dots.svg";
import UserActivityCard from "./UserActivityCard";

enum ProfileTabs {
  Activity = "Activity",
  Forum = "Forum Posts",
  Friends = "Friends",
}

const UserProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profileUser, setProfileUser] = useState<ProfileDto | null>(null);
  const [userFriends, setUserFriends] = useState<UserDto[]>([]);
  const [friendStatus, setFriendStatus] =
    useState<FriendStatusDto["status"]>("none");
  const [isMe, setIsMe] = useState(false);
  const [selectedTab, setSelectedTab] = useState(ProfileTabs.Activity);
  const [completedActions, setCompletedActions] = useState<ActionDto[]>([]);

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

  useEffect(() => {
    if (!id) return;
    actionsFindCompletedForUser({ path: { id: id } }).then((response) => {
      if (response.data) {
        setCompletedActions(response.data);
      }
    });
  }, [id]);

  const handleSendFriendRequest = async () => {
    if (!id || !user) return;

    try {
      await userRequestFriend({ path: { targetUserId: parseInt(id) } });
      setFriendStatus("pending");
    } catch (error) {
      console.error("Error sending friend request:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-pagebg pt-20 px-8 md:px-16">
        <div className="max-w-4xl mx-auto">
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
          <Card style={CardStyle.White} className="p-8">
            <p className="text-center text-stone-500">User not found</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[800px] mx-auto space-y-2">
      <div className="w-full h-[200px] border-stone-200"></div>
      <div className="px-8 relative space-y-2 border-stone-300 border rounded-lg mx-2">
        <ProfileImage src={testImg} className="mt-[-55px]" />
        <div className="flex gap-2">
          <h1>{profileUser.name}</h1>
        </div>
        {/* stats row */}
        <div className="flex flex-row gap-5">
          <p>
            <b>{completedActions.length} </b>
            actions completed
          </p>
          <p>
            <b>100 </b>
            forum posts
          </p>
          <p>
            <b>100 </b>
            Friends
          </p>
        </div>
        <p className="my-6">{profileUser.profileDescription}</p>
        <div className="flex flex-row w-full justify-evenly">
          {Object.values(ProfileTabs).map((tab) => (
            <div
              onClick={() => setSelectedTab(tab)}
              className={`${selectedTab === tab ? "font-bold " : "text-gray-800"} flex-1 text-center py-3 pt-4 cursor-pointer hover:underline`}
            >
              <p className="text-md">{tab}</p>
            </div>
          ))}
        </div>
        {/* button row */}
        <div className="absolute right-0 top-0 space-x-3 flex flex-row p-5">
          <Button
            color={ButtonColor.Blue}
            onClick={handleSendFriendRequest}
            className="rounded-full pl-3"
          >
            <img src={icons8Plus} alt="send" className="invert w-6 h-6" />
            <span className="mt-1">Send Friend Request</span>
          </Button>
          <Button
            color={ButtonColor.Light}
            onClick={handleSendFriendRequest}
            className="!p-[8px] rounded-full"
          >
            <img src={dots} alt="send" className="w-7 h-7" />
          </Button>
        </div>
      </div>
      <div className="mx-2">
        {selectedTab === ProfileTabs.Activity && (
          <div className="space-y-2">
            {completedActions.length === 0 && (
              <p className="text-center text-stone-500">
                No actions completed yet
              </p>
            )}
            {completedActions?.map((action: ActionDto) => (
              <UserActivityCard action={action} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfilePage;
