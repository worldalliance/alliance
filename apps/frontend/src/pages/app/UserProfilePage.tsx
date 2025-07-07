import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
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
  ProfileDto,
  actionsFindCompletedForUser,
  ActionWithRelationDto,
  PostDto,
  forumFindPostsByUser,
  userRemoveFriend,
} from "@alliance/shared/client";
import ProfileImage from "../../components/ProfileImage";
import testImg from "../../assets/fakebgimage.png";
// import dots from "../../assets/dots.svg";
import UserActivityCard from "../../components/UserActivityCard";
import ForumListPost from "../../components/ForumListPost";
import FriendRequestButton from "../../components/FriendRequestButton";
import { getImageSource } from "../../lib/config";

enum ProfileTabs {
  Activity = "Activity",
  Forum = "Posts",
  Friends = "Friends",
}

const UserProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profileUser, setProfileUser] = useState<ProfileDto | null>(null);
  const [friendStatus, setFriendStatus] =
    useState<FriendStatusDto["status"]>("none");
  const [isMe, setIsMe] = useState(false);
  const [selectedTab, setSelectedTab] = useState(ProfileTabs.Activity);

  const [completedActions, setCompletedActions] = useState<
    ActionWithRelationDto[]
  >([]);
  const [forumPosts, setForumPosts] = useState<PostDto[]>([]);
  const [friends, setFriends] = useState<UserDto[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (!id) return;

        const userId = parseInt(id);

        const { data: userData } = await userFindOne({
          path: { id: userId },
        });
        if (userData) {
          setProfileUser(userData);
        }
        console.log(userData?.id, user?.id);
        setIsMe(userData?.id === user?.id);

        const { data: friendsData } = await userListFriends({
          path: { id: userId },
        });
        if (friendsData) {
          setFriends(friendsData);
        }
        const { data: friendStatusData } = await userMyFriendRelationship({
          path: { id: userId },
        });
        setFriendStatus(friendStatusData?.status ?? "none");

        const { data: forumPostsData } = await forumFindPostsByUser({
          path: { id: userId },
        });
        if (forumPostsData) {
          setForumPosts(forumPostsData);
        }
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

  // reset tab on user change
  useEffect(() => {
    setSelectedTab(ProfileTabs.Activity);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    actionsFindCompletedForUser({ path: { id: parseInt(id) } }).then(
      (response) => {
        if (response.data) {
          setCompletedActions(response.data);
        }
      }
    );
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

  const handleRemoveFriend = async () => {
    if (!id || !user) return;
    try {
      await userRemoveFriend({ path: { targetUserId: parseInt(id) } });
      setFriendStatus("none");
    } catch (error) {
      console.error("Error removing friend:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-pagebg pt-20 px-8 md:px-16">
        <div className="max-w-4xl mx-auto">
          <div className="w-full h-[900px]"></div>
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
    <div className="max-w-[800px] mx-auto">
      <div className="mx-2 space-y-2">
        <div className="w-full h-[100px]"></div>
        <div className="px-8 relative space-y-2 border-stone-300 border rounded pb-8">
          <ProfileImage
            src={
              profileUser.profilePicture
                ? getImageSource(profileUser.profilePicture)
                : null
            }
            className="mt-[-55px]"
          />
          <div className="flex gap-2">
            <h1>{profileUser.displayName}</h1>
          </div>
          {/* stats row */}
          <div className="flex flex-row gap-5 cursor-pointer">
            <p onClick={() => setSelectedTab(ProfileTabs.Activity)}>
              <b>{completedActions.length} </b>
              actions completed
            </p>
            <p onClick={() => setSelectedTab(ProfileTabs.Forum)}>
              <b>{forumPosts.length} </b>
              forum posts
            </p>
            <p onClick={() => setSelectedTab(ProfileTabs.Friends)}>
              <b>{friends.length} </b>
              friends
            </p>
          </div>
          <p className="my-6">{profileUser.profileDescription}</p>
          {/* button row */}
          <div className="absolute right-0 top-0 space-x-3 flex flex-row p-5">
            {isAuthenticated && !isMe && (
              <>
                <FriendRequestButton
                  friendStatus={friendStatus}
                  handleSendFriendRequest={handleSendFriendRequest}
                  handleRemoveFriend={handleRemoveFriend}
                />
                {/* <Button
                  color={ButtonColor.Light}
                  onClick={() => {}}
                  className="!p-[8px] rounded-full"
                >
                  <img src={dots} alt="send" className="w-7 h-7" />
                </Button> */}
              </>
            )}
            {isMe && (
              <Button
                color={ButtonColor.Light}
                className=""
                onClick={() => navigate(`/editprofile`)}
              >
                Edit Profile
              </Button>
            )}
          </div>
          {/* <div className="absolute -left-20 top-0 p-5">
          <BackButton />
          </div> */}
          {/* <ImpactPanel
            completedActions={completedActions}
            isMe={isMe}
            referredCount={referredCount}
          /> */}
        </div>
        <div className="flex flex-row w-full justify-evenly">
          {[ProfileTabs.Activity, ProfileTabs.Forum].map((tab) => (
            <div
              onClick={() => setSelectedTab(tab)}
              key={tab}
              className={`${
                selectedTab === tab ? "font-bold underline" : "text-gray-800"
              } flex-1 text-center py-3 pt-4 cursor-pointer hover:underline`}
            >
              <p className="text-md">{tab}</p>
            </div>
          ))}
        </div>
        <div className="py-3">
          {selectedTab === ProfileTabs.Activity && (
            <div className="space-y-2">
              {completedActions.length === 0 && (
                <p className="text-center text-stone-500">
                  No actions completed yet
                </p>
              )}
              {completedActions?.map((action: ActionWithRelationDto) => (
                <UserActivityCard action={action} key={action.id} />
              ))}
            </div>
          )}
          {selectedTab === ProfileTabs.Forum && (
            <div className="space-y-2">
              {forumPosts.length === 0 && (
                <p className="text-center text-stone-500">No forum posts yet</p>
              )}
              {forumPosts?.map((post: PostDto) => (
                <ForumListPost
                  post={post}
                  key={post.id}
                  handleViewPost={() => {
                    navigate(`/forum/post/${post.id}`);
                  }}
                />
              ))}
            </div>
          )}
          {selectedTab === ProfileTabs.Friends && (
            <div className="space-2 flex flex-row flex-wrap gap-2 justify-center">
              {friends.length === 0 && (
                <p className="text-center text-stone-500">No friends yet</p>
              )}
              {friends?.map((friend: UserDto) => (
                <div
                  className="flex flex-row gap-2 items-center cursor-pointer hover:bg-stone-100 rounded-md p-3 px-5 w-fit"
                  onClick={() => navigate(`/user/${friend.id}`)}
                  key={friend.id}
                >
                  <ProfileImage src={testImg} className="!w-10 !h-10" />
                  <p>{friend.name}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfilePage;
