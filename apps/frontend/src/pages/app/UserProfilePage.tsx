import {
  CommentDto,
  FriendStatusDto,
  PostDto,
  ProfileDto,
  UpdateProfileDto,
  forumFindForumCommentsByUser,
  forumFindPostsByUser,
  userAcceptFriendRequest,
  userFindOne,
  userListFriends,
  userMyFriendRelationship,
  userRemoveFriend,
  userRequestFriend,
  userUpdate,
} from "@alliance/shared/client";
import AppMarkdownWrapper from "@alliance/shared/ui/AppMarkdownWrapper";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import ProfileImage from "@alliance/shared/ui/ProfileImage";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { Route } from "../../../.react-router/types/src/pages/app/+types/UserProfilePage";
import { useAppLoaderData } from "../../applayout";
import EditableContentRenderer from "../../components/forum/EditableContentRenderer";
import ForumListPost from "../../components/ForumListPost";
import FriendRequestButton from "../../components/FriendRequestButton";
import FriendsTab from "../../components/FriendsTab";
import UserActivityCard from "../../components/UserActivityCard";
import UserDisplayName from "../../components/UserDisplayName";
import UserProfileTab from "../../components/UserProfileTab";
import { useAuth } from "../../lib/AuthContext";
import { formatTime } from "../../lib/utils";
import useActivities, { ActivityList } from "./useActivities";
import { sharp_allowed_mime_types } from "@alliance/shared/lib/config";
import List from "@alliance/shared/ui/List";

enum ProfileTabs {
  Activity = "Actions",
  Forum = "Forum Activity",
  Friends = "Friends",
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  console.error(error);
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)]">
      <div>
        <span className="font-bold pb-2 text-red-500">Error</span>
        <p>Failed to load user profile</p>
      </div>
    </div>
  );
}

interface ForumActivityCommentCardProps {
  comment: CommentDto;
}

const ForumActivityCommentCard: React.FC<ForumActivityCommentCardProps> = ({
  comment,
}) => {
  return (
    <Link
      to={`/forum/post/${comment.parentObjectId}?replyId=${comment.id}`}
      className="w-full mb-0 p-4 hover:bg-zinc-50 bg-white space-y-2"
    >
      <EditableContentRenderer
        content={comment.editableContent}
        charLimit={140}
      />
      <div className="flex flex-row items-center gap-x-2 text-sm text-zinc-500">
        <ProfileImage pfp={comment.author.profilePicture} size="small" />
        <span>
          <UserDisplayName staff={comment.author.staff}>
            {comment.author.displayName}
          </UserDisplayName>{" "}
          {`commented ${formatTime(new Date(comment.createdAt), {
            addSuffix: true,
          })}`}
        </span>
      </div>
    </Link>
  );
};

const UserProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const isMe = id === user?.id.toString();

  const { state } = useLocation();
  const { openFriendRequest } = state || false;
  const { openFriends } = state || false;

  const { profile: myProfile } = useAppLoaderData();
  const [profileUser, setProfileUser] = useState<ProfileDto | null>(
    isMe ? myProfile : null
  );
  const [friendStatus, setFriendStatus] = useState<FriendStatusDto | null>(
    null
  );

  const [selectedTab, setSelectedTab] = useState(ProfileTabs.Activity);

  const [isEditing, setIsEditing] = useState(false);

  const [forumPosts, setForumPosts] = useState<PostDto[]>([]);
  const [forumComments, setForumComments] = useState<CommentDto[]>([]);
  const [friends, setFriends] = useState<ProfileDto[]>([]);

  // Edit mode state
  const [editName, setEditName] = useState<string>(user?.name ?? "");
  const [editBio, setEditBio] = useState<string>(
    myProfile?.profileDescription ?? ""
  );
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(
    myProfile?.profilePicture ?? null
  );
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const forumActivityItems = useMemo(() => {
    const postItems = forumPosts.map((post) => ({
      type: "post" as const,
      createdAt: post.createdAt,
      post,
    }));

    const commentItems = forumComments.map((comment) => ({
      type: "comment" as const,
      createdAt: comment.createdAt,
      comment,
    }));

    return [...postItems, ...commentItems].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [forumPosts, forumComments]);

  const forumActivityCount = forumActivityItems.length;

  const {
    activities: completedActions,
    handleLikeActivity,
    updateActivity,
  } = useActivities({
    list: ActivityList.User,
    objectId: parseInt(id!),
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!id) return;

        const userId = parseInt(id);

        const { data: userData } = await userFindOne({
          path: { id: userId },
        });
        if (userData && userData.displayName) {
          setProfileUser(userData);
          if (isMe) {
            setEditName(userData.displayName);
            setEditBio(userData.profileDescription || "");
            setEditAvatarUrl(userData.profilePicture || null);
          }
        }
        const { data: friendsData } = await userListFriends({
          path: { id: userId },
        });
        if (friendsData) {
          setFriends(friendsData);
        }
        const { data: friendStatusData } = await userMyFriendRelationship({
          path: { id: userId },
        });
        if (friendStatusData) {
          setFriendStatus(friendStatusData);
        }

        const { data: forumPostsData } = await forumFindPostsByUser({
          path: { id: userId },
        });
        setForumPosts(forumPostsData ?? []);

        const { data: forumCommentsData } = await forumFindForumCommentsByUser({
          path: { id: userId },
        });
        setForumComments(forumCommentsData ?? []);
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id, user, isMe]);

  // reset tab and edit mode on user change
  useEffect(() => {
    setSelectedTab(ProfileTabs.Activity);
    setIsEditing(false);
  }, [id]);

  useEffect(() => {
    if (openFriendRequest || openFriends) {
      setSelectedTab(ProfileTabs.Friends);
    }
  }, [openFriendRequest, openFriends]);

  const handleSendFriendRequest = useCallback(async () => {
    if (!id || !user) return;
    try {
      await userRequestFriend({ path: { targetUserId: parseInt(id) } });
      setFriendStatus({ status: "pending", didReceiveRequest: false });
    } catch (error) {
      console.error("Error sending friend request:", error);
    }
  }, [id, user]);

  const handleAcceptFriendRequest = useCallback(async () => {
    if (!id || !user) return;
    const response = await userAcceptFriendRequest({
      path: { requesterId: parseInt(id) },
    });
    if (!response.error) {
      setFriendStatus({ status: "accepted", didReceiveRequest: false });
    }
  }, [id, user]);

  const handleRemoveFriend = useCallback(async () => {
    if (!id || !user) return;
    try {
      await userRemoveFriend({ path: { targetUserId: parseInt(id) } });
      setFriendStatus({ status: "none", didReceiveRequest: false });
    } catch (error) {
      console.error("Error removing friend:", error);
    }
  }, [id, user]);

  const handleAvatarChange: React.ChangeEventHandler<HTMLInputElement> = (
    e
  ) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    setImageUploadError(null);

    if (!sharp_allowed_mime_types.includes(file.type)) {
      setImageUploadError("Please select a valid image file.");
      return;
    }

    const maxSizeInBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      setImageUploadError(
        "Image size must be less than 5MB. Please choose a smaller image."
      );
      return;
    }

    setEditAvatarFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setEditAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!user || isSavingProfile) return;

    setIsSavingProfile(true);
    try {
      const payload: UpdateProfileDto = {
        name: editName,
        profileDescription: editBio,
        profilePicture: editAvatarUrl ?? undefined,
      };
      const response = await userUpdate({
        body: payload,
      });

      if (response.data) {
        setProfileUser(response.data);
        setIsEditing(false);
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCancel = () => {
    if (profileUser) {
      setEditName(profileUser.displayName || "");
      setEditBio(profileUser.profileDescription || "");
      setEditAvatarUrl(profileUser.profilePicture || null);
      setEditAvatarFile(null);
    }
    setImageUploadError(null);
    setIsEditing(false);
  };

  if (!profileUser) {
    return (
      <div className="bg-page pt-20 px-8 md:px-16">
        <div className="max-w-4xl mx-auto">
          <div className="w-full h-[900px]"></div>
          <Card style={CardStyle.White} className="p-8">
            <p className="text-center text-zinc-500">Loading profile...</p>
          </Card>
        </div>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="bg-page pt-20 px-8 md:px-16">
        <div className="max-w-4xl mx-auto">
          <Card style={CardStyle.White} className="p-8">
            <p className="text-center text-zinc-500">User not found</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[800px] mx-auto">
      <div className="mx-2 space-y-2">
        <div className="w-full h-[50px] md:h-[100px]"></div>
        <Card className="px-8 pb-6 relative gap-y-2">
          {isEditing ? (
            <div className="relative w-fit">
              <img
                src={
                  editAvatarFile
                    ? URL.createObjectURL(editAvatarFile)
                    : editAvatarUrl ?? undefined
                }
                className="mt-[-55px] w-29 h-29 rounded-md object-cover"
              />
              <div className="absolute w-29 h-29 top-[-55px] bg-zinc-50/50 border border-dashed border-zinc-300 rounded-md hover:bg-zinc-100 transition-colors duration-100">
                <label className="cursor-pointer text-zinc-400 underline text-sm absolute m-auto text-center w-full h-full flex items-center justify-center">
                  <input
                    type="file"
                    accept={sharp_allowed_mime_types.join(",")}
                    className="hidden w-full h-full"
                    onChange={handleAvatarChange}
                  />
                  <p className="text-center">Change photo</p>
                </label>
              </div>
              {imageUploadError && (
                <p className="text-red-500 text-sm mt-2">{imageUploadError}</p>
              )}
            </div>
          ) : (
            <ProfileImage
              pfp={profileUser.profilePicture}
              size="huge"
              className="mt-[-55px]"
            />
          )}
          <div className="flex gap-2 mt-3">
            {isEditing ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full border border-zinc-300 focus:outline-none !text-[30px] font-medium font-serif"
              />
            ) : (
              <div className="flex flex-row gap-3 items-center">
                <h1 className="font-serif !font-semibold">
                  {profileUser.displayName}
                </h1>
                {profileUser.staff && (
                  <div className="text-sm bg-staff text-white px-3 py-0.5 rounded self-center mt-2">
                    Staff
                  </div>
                )}
              </div>
            )}
          </div>

          {isEditing ? (
            <textarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              rows={6}
              className="w-full border border-zinc-300 focus:outline-none p-2 -ml-2 mt-4 mb-2"
              placeholder="Write something about yourself..."
            />
          ) : (
            profileUser.profileDescription && (
              <AppMarkdownWrapper
                markdownContent={profileUser.profileDescription}
                className="mb-2"
              />
            )
          )}
          {/* stats row */}
          <div className="mt-2 flex flex-row gap-x-2 cursor-pointer">
            <UserProfileTab
              number={completedActions.length}
              label={`action${
                completedActions.length === 1 ? "" : "s"
              } completed`}
              shortLabel={`action${completedActions.length === 1 ? "" : "s"}`}
              selected={selectedTab === ProfileTabs.Activity}
              onClick={() => setSelectedTab(ProfileTabs.Activity)}
            />
            <UserProfileTab
              number={forumActivityCount}
              label={forumActivityCount === 1 ? "forum post" : "forum posts"}
              shortLabel={forumActivityCount === 1 ? "post" : "posts"}
              selected={selectedTab === ProfileTabs.Forum}
              onClick={() => setSelectedTab(ProfileTabs.Forum)}
            />
            <UserProfileTab
              number={friends.length}
              label={`friend${friends.length === 1 ? "" : "s"}`}
              selected={selectedTab === ProfileTabs.Friends}
              onClick={() => setSelectedTab(ProfileTabs.Friends)}
            />
          </div>
          {/* button row */}
          <div className="absolute right-0 top-0 space-x-3 flex flex-row p-5">
            {isAuthenticated && !isMe && (
              <>
                <FriendRequestButton
                  friendStatus={friendStatus}
                  handleSendFriendRequest={handleSendFriendRequest}
                  handleRemoveFriend={handleRemoveFriend}
                  handleAcceptFriendRequest={handleAcceptFriendRequest}
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
              <div className="space-x-3 flex">
                {isEditing ? (
                  <>
                    <Button color={ButtonColor.Light} onClick={handleCancel}>
                      Cancel
                    </Button>
                    <Button
                      color={ButtonColor.Blue}
                      onClick={handleSave}
                      disabled={isSavingProfile}
                    >
                      {isSavingProfile ? "Saving..." : "Save"}
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-col items-end">
                    <Button
                      color={ButtonColor.Light}
                      onClick={() => setIsEditing(true)}
                    >
                      Edit Profile
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
        <div className="pb-24 mt-2">
          {selectedTab === ProfileTabs.Activity && (
            <List className="mb-10 *:p-4">
              {completedActions.length === 0 && (
                <p className="my-4 text-center text-zinc-500">
                  No actions completed yet
                </p>
              )}
              {completedActions?.map((activity) => (
                <UserActivityCard
                  activity={activity}
                  key={activity.id}
                  handleLike={handleLikeActivity}
                  onActivityUpdate={updateActivity}
                  canEdit={isMe}
                />
              ))}
            </List>
          )}

          {selectedTab === ProfileTabs.Forum && (
            <div className="flex flex-col gap-y-1">
              {forumActivityItems.length === 0 ? (
                <p className="my-4 text-center text-zinc-500">
                  No forum activity yet
                </p>
              ) : (
                <List className="mb-10">
                  {forumActivityItems.map((item) => {
                    if (item.type === "post") {
                      return (
                        <ForumListPost
                          post={item.post}
                          key={`post-${item.post.id}`}
                          showReply={false}
                          showContentPreview
                        />
                      );
                    }
                    return (
                      <ForumActivityCommentCard
                        comment={item.comment}
                        key={`comment-${item.comment.id}`}
                      />
                    );
                  })}
                </List>
              )}
            </div>
          )}

          {selectedTab === ProfileTabs.Friends && (
            <Card className="justify-center">
              <div className="px-2">
                {friends.length === 0 && (
                  <p className="my-4 text-center text-zinc-500">
                    No friends yet
                  </p>
                )}
                <FriendsTab
                  userId={profileUser.id}
                  isMe={isMe}
                  originalTab={openFriendRequest ? "received" : "friends"}
                  friends={friends}
                />
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfilePage;
