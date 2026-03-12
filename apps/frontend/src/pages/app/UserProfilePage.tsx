import { UpdateProfileDto } from "@alliance/shared/client";
import AppMarkdownWrapper from "@alliance/sharedweb/ui/AppMarkdownWrapper";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { href, useLocation, useNavigate, useParams } from "react-router";
import { Route } from "../../../.react-router/types/src/pages/app/+types/UserProfilePage";
import ForumListPost from "../../components/ForumListPost";
import FriendRequestButton from "../../components/FriendRequestButton";
import FriendsTab from "../../components/FriendsTab";
import UserActivityCard from "../../components/UserActivityCard";
import UserProfileTab from "../../components/UserProfileTab";
import { useAuth } from "../../lib/AuthContext";
import useActivities, {
  ActivityList,
} from "@alliance/shared/lib/useActivities";
import { sharp_allowed_mime_types } from "@alliance/sharedweb/lib/config";
import List from "@alliance/sharedweb/ui/List";
import ForumActivityCommentCard from "../../components/ForumActivityCommentCard";
import ImageEditor from "../../components/ImageEditor";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { MessageSquare } from "lucide-react";
import { Features } from "@alliance/shared/lib/features";
import { isFeatureEnabled } from "../../lib/config";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import {
  buildForumActivityItems,
  useAcceptFriendRequestMutation,
  useRemoveFriendMutation,
  useSendFriendRequestMutation,
  useUpdateProfileMutation,
  useUserForumCommentsQuery,
  useUserForumPostsQuery,
  useUserFriendStatusQuery,
  useUserFriendsQuery,
  useUserProfileQuery,
} from "@alliance/shared/lib/user";
import InfoTooltip from "@alliance/sharedweb/ui/InfoTooltip";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@alliance/sharedweb/ui/HoverCard";

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

const UserProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const isMe = id === user?.id.toString();

  const { state } = useLocation();
  const { openFriendRequest } = state || false;
  const { openFriends } = state || false;
  const { confirm } = useToast();

  const userId = id ? parseInt(id, 10) : undefined;

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

  const [selectedTab, setSelectedTab] = useState(ProfileTabs.Activity);
  const [isEditing, setIsEditing] = useState(false);

  const [editName, setEditName] = useState<string>(user?.name ?? "");
  const [editBio, setEditBio] = useState<string>("");
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null);
  const [avatarEditorKey, setAvatarEditorKey] = useState(0);

  const updateProfileMutation = useUpdateProfileMutation(userId);
  const sendFriendRequest = useSendFriendRequestMutation();
  const acceptFriendRequest = useAcceptFriendRequestMutation();
  const removeFriend = useRemoveFriendMutation();

  const isSavingProfile = updateProfileMutation.isPending;
  const currentProfilePicture = profile?.profilePicture ?? null;
  const isProfileImageUploadPending =
    isSavingProfile && editAvatarUrl !== currentProfilePicture;

  const forumActivityItems = useMemo(
    () => buildForumActivityItems(forumPosts, forumComments),
    [forumPosts, forumComments]
  );

  const forumActivityCount = forumActivityItems.length;

  const { activities, handleLikeActivity, updateActivity } = useActivities({
    list: ActivityList.User,
    objectId: userId ?? 0,
    comments: true,
  });

  const completedActions = useMemo(() => {
    return (
      activities?.filter((activity) => activity.type === "user_completed") ?? []
    );
  }, [activities]);

  useEffect(() => {
    if (!profile || !isMe || isEditing) return;
    setEditName(profile.displayName || "");
    setEditBio(profile.profileDescription || "");
    setEditAvatarUrl(profile.profilePicture || null);
  }, [profile, isMe, isEditing]);

  // reset tab and edit mode on user change
  useEffect(() => {
    setSelectedTab(ProfileTabs.Activity);
    setIsEditing(false);
    setAvatarEditorKey((prev) => prev + 1);
  }, [id]);

  useEffect(() => {
    if (openFriendRequest || openFriends) {
      setSelectedTab(ProfileTabs.Friends);
    }
  }, [openFriendRequest, openFriends]);

  const handleSendFriendRequest = useCallback(async () => {
    if (!userId || !user) return;
    try {
      await sendFriendRequest.mutateAsync(userId);
    } catch (error) {
      console.error("Error sending friend request:", error);
    }
  }, [userId, user, sendFriendRequest]);

  const handleAcceptFriendRequest = useCallback(async () => {
    if (!userId || !user) return;
    try {
      await acceptFriendRequest.mutateAsync(userId);
    } catch (error) {
      console.error("Error accepting friend request:", error);
    }
  }, [userId, user, acceptFriendRequest]);

  const navigate = useNavigate();

  const handleRemoveFriend = useCallback(
    async (e: React.MouseEvent<HTMLElement>) => {
      if (!userId || !user) return;
      const ok = await confirm({
        message: "Are you sure you want to remove this friend?",
        confirmLabel: "Yes",
        cancelLabel: "No",
        anchorEl: e.currentTarget,
        placement: "bottomleft",
      });

      if (!ok) return;
      try {
        await removeFriend.mutateAsync(userId);
      } catch (error) {
        console.error("Error removing friend:", error);
      }
    },
    [userId, user, confirm, removeFriend]
  );

  const handleSave = async () => {
    if (!user || isSavingProfile) return;

    try {
      const payload: UpdateProfileDto = {
        name: editName,
        profileDescription: editBio,
        profilePicture: editAvatarUrl ?? undefined,
      };
      const response = await updateProfileMutation.mutateAsync(payload);

      if (response && id) {
        setIsEditing(false);
        navigate(href("/member/:id", { id })); // to make navbar pfp reload
      }
    } catch (err: unknown) {
      console.error(err);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setEditName(profile.displayName || "");
      setEditBio(profile.profileDescription || "");
      setEditAvatarUrl(profile.profilePicture || null);
    }
    setAvatarEditorKey((prev) => prev + 1);
    setIsEditing(false);
  };

  const messagingEnabled = isFeatureEnabled(Features.Messaging);

  if (profilePending) {
    return (
      <div className="bg-page pt-20 px-8 md:px-16">
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner size="large" />
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="bg-page pt-20 px-8 md:px-16">
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-center text-zinc-500">
            Failed to load user profile
          </p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-page pt-20 px-8 md:px-16">
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-center text-zinc-500">User not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[800px] mx-auto">
      <div className="mx-2 space-y-2">
        <div className="w-full h-[50px] md:h-[100px]"></div>
        <Card className="px-4 md:px-8 pb-6 relative gap-y-2">
          {/* {isProfileImageUploadPending && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px] rounded-[inherit]">
              <Spinner />
            </div>
          )} */}
          {isEditing ? (
            <ImageEditor
              key={avatarEditorKey}
              className="mt-[-55px]"
              initialImageUrl={editAvatarUrl}
              onChange={setEditAvatarUrl}
              allowedMimeTypes={sharp_allowed_mime_types}
              isUploading={isProfileImageUploadPending}
            />
          ) : (
            <AvatarProfile
              pfp={profile.profilePicture}
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
                className="text-title-small w-full border-none !bg-zinc-100 px-2 -mx-2 rounded focus:outline-none"
              />
            ) : (
              <div className="flex flex-row gap-3 items-center">
                <h1 className="text-title-small">{profile.displayName}</h1>
                {profile.displayName === "Someone" && (
                  <div className="mt-px">
                    <InfoTooltip content="Names are hidden for members who have set their account to be anonymous." />
                  </div>
                )}
                {profile.staff && (
                  <HoverCard>
                    <HoverCardTrigger
                      render={
                        <div className="text-xs bg-staff text-white px-2 py-0.5 rounded-sm self-center cursor-default">
                          Staff
                        </div>
                      }
                    />
                    <HoverCardContent sideOffset={4}>
                      Member of the office
                    </HoverCardContent>
                  </HoverCard>
                )}
                {!profile.staff && profile.isCommunityLeader && (
                  <HoverCard>
                    <HoverCardTrigger
                      render={
                        <div className="text-xs bg-grouplead text-white px-2 py-0.5 rounded-sm self-center cursor-default">
                          Lead
                        </div>
                      }
                    />
                    <HoverCardContent sideOffset={4}>
                      Leads a group of members
                    </HoverCardContent>
                  </HoverCard>
                )}
                {!profile.hasActiveContract && !profilePending && (
                  <HoverCard>
                    <HoverCardTrigger
                      render={
                        <div className="text-xs bg-zinc-100 text-zinc-600 px-2 py-1 rounded-sm self-center cursor-default">
                          Observer
                        </div>
                      }
                    />
                    <HoverCardContent sideOffset={4}>
                      No signed contract
                    </HoverCardContent>
                  </HoverCard>
                )}
              </div>
            )}
          </div>

          {isEditing ? (
            <textarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              rows={6}
              className="w-full border-none !bg-zinc-100 px-2 -ml-2 rounded focus:outline-none p-2 mb-2"
              placeholder="Write something about yourself..."
            />
          ) : (
            profile.profileDescription && (
              <AppMarkdownWrapper
                markdownContent={profile.profileDescription}
                className="mb-2"
              />
            )
          )}
          {/* stats row */}
          <div className="mt-2 flex flex-row gap-x-2 transition-none">
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
              label={forumActivityCount === 1 ? "post" : "posts"}
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
            {isAuthenticated && !isMe && friendStatus != null && (
              <FriendRequestButton
                friendStatus={friendStatus}
                handleSendFriendRequest={handleSendFriendRequest}
                handleRemoveFriend={handleRemoveFriend}
                handleAcceptFriendRequest={handleAcceptFriendRequest}
              />
            )}
            {messagingEnabled &&
              isAuthenticated &&
              !isMe &&
              friendStatus &&
              friendStatus.status === "accepted" && (
                <Button
                  color={ButtonColor.White}
                  onClick={() =>
                    navigate(href("/messages") + `?to=${profile.id}`)
                  }
                  className="!h-9 flex flex-row items-center !px-3"
                >
                  <MessageSquare size={16} className="text-zinc-600" />
                </Button>
              )}
            {isMe && (
              <div className="space-x-3 flex">
                {isEditing ? (
                  <>
                    <Button
                      color={ButtonColor.Light}
                      onClick={handleCancel}
                      className="!h-9"
                    >
                      Cancel
                    </Button>
                    <Button
                      color={ButtonColor.Blue}
                      onClick={handleSave}
                      disabled={isSavingProfile}
                      className="!h-9"
                    >
                      {isSavingProfile ? "Saving..." : "Save"}
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-col items-end">
                    <Button
                      color={ButtonColor.White}
                      onClick={() => setIsEditing(true)}
                      className="!h-9"
                    >
                      Edit
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
            <FriendsTab
              userId={profile.id}
              isMe={isMe}
              originalTab={openFriendRequest ? "received" : "friends"}
              friends={friends}
              className="mt-4"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfilePage;
