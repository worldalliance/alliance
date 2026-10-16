import { forCount } from "@alliance/common/plural";
import { failedToLoad } from "@alliance/shared/lib/failedToLoad";
import useActivities, {
  ActivityList,
} from "@alliance/shared/lib/useActivities";
import { useProfileDraft } from "@alliance/shared/lib/useProfileDraft";
import {
  useUserCompletedActionCountQuery,
  useUserForumActivity,
  useUserFriendsQuery,
  useUserFriendStatusQuery,
  useUserProfileQuery,
} from "@alliance/shared/lib/user";
import useUserFeed from "@alliance/shared/lib/useUserFeed";
import List from "@alliance/sharedweb/ui/List";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import React, { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router";
import { Route } from "../../../.react-router/types/src/pages/app/+types/UserProfilePage";
import FeedItems from "../../components/FeedItems";
import ForumActivityCommentCard from "../../components/ForumActivityCommentCard";
import ForumListPost from "../../components/ForumListPost";
import FriendsTab from "../../components/FriendsTab";
import LoadFailed from "../../components/LoadFailed";
import PillTab from "../../components/PillTab";
import UserActivityCard from "../../components/UserActivityCard";
import UserProfileCard from "../../components/UserProfileCard";
import { useInfiniteScrollSentinel } from "../../hooks/useInfiniteScrollSentinel";
import { useAuth } from "../../lib/AuthContext";
import { MissingRecordPage } from "../../site/NotFoundPage";

enum ProfileTabs {
  Activity = "Activity",
  Forum = "Forum Activity",
  Friends = "Friends",
  ActionsCompleted = "Actions Completed",
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  console.error(error);
  return (
    <div className="flex flex-col items-center justify-center min-h-full">
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

  const userId = id ? parseInt(id, 10) : undefined;
  if (!userId) {
    throw new Error("Invalid user ID");
  }

  const {
    data: profile,
    isPending: profilePending,
    isError: profileError,
  } = useUserProfileQuery(userId);
  const friendStatusQuery = useUserFriendStatusQuery(userId, {
    enabled: isAuthenticated && !isMe,
  });
  const draft = useProfileDraft({ userId, profile, isMe });

  const {
    items: forumActivityItems,
    didFail: didForumFail,
    retry: retryForum,
    retrying: isRetryingForum,
  } = useUserForumActivity(userId);
  const friendsQuery = useUserFriendsQuery(userId);
  const { data: friends = [] } = friendsQuery;
  const didFriendsFail = failedToLoad(friendsQuery);

  const [selectedTab, setSelectedTab] = useState(ProfileTabs.Activity);

  const forumActivityCount = forumActivityItems.length;

  const {
    items: feedItems,
    handleLikeActivity,
    handleLikeForumComment,
    fetchNextPage: fetchNextFeedPage,
    hasNextPage: feedHasNextPage,
    isFetchingNextPage: feedIsFetchingNextPage,
  } = useUserFeed({
    userId: userId ?? 0,
    comments: true,
  });

  const feedSentinelRef = useInfiniteScrollSentinel({
    fetchNextPage: fetchNextFeedPage,
    hasNextPage: feedHasNextPage,
    isFetchingNextPage: feedIsFetchingNextPage,
  });

  const { data: completedActionCount = 0 } =
    useUserCompletedActionCountQuery(userId);

  const {
    activities: completedActivities,
    handleLikeActivity: handleLikeCompletedActivity,
  } = useActivities({
    list: ActivityList.User,
    objectId: userId,
    comments: true,
  });

  useEffect(() => {
    setSelectedTab(ProfileTabs.Activity);
  }, [id]);

  useEffect(() => {
    if (openFriendRequest || openFriends) {
      setSelectedTab(ProfileTabs.Friends);
    }
  }, [openFriendRequest, openFriends]);

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

  if (!profile) return <MissingRecordPage />;

  return (
    <div className="max-w-[800px] mx-auto mt-[var(--navbar-top-bar-height)]">
      <div className="mx-2 space-y-2 mt-8">
        <UserProfileCard
          profile={profile}
          isMe={isMe}
          friendStatusQuery={friendStatusQuery}
          draft={draft}
        >
          <div className="mt-2 flex flex-row gap-x-2 transition-none">
            <PillTab
              label="Activity"
              selected={selectedTab === ProfileTabs.Activity}
              onClick={() => setSelectedTab(ProfileTabs.Activity)}
            />
            <PillTab
              number={completedActionCount}
              label={`${forCount(completedActionCount, "action")} completed`}
              shortLabel={forCount(completedActionCount, "action")}
              selected={selectedTab === ProfileTabs.ActionsCompleted}
              onClick={() => setSelectedTab(ProfileTabs.ActionsCompleted)}
            />
            <PillTab
              number={didForumFail ? undefined : forumActivityCount}
              label={
                didForumFail ? "posts" : forCount(forumActivityCount, "post")
              }
              selected={selectedTab === ProfileTabs.Forum}
              onClick={() => setSelectedTab(ProfileTabs.Forum)}
            />
            <PillTab
              number={didFriendsFail ? undefined : friends.length}
              label={forCount(friends.length, "friend")}
              selected={selectedTab === ProfileTabs.Friends}
              onClick={() => setSelectedTab(ProfileTabs.Friends)}
            />
          </div>
        </UserProfileCard>
        <div className="pb-24 mt-2">
          {selectedTab === ProfileTabs.Activity && (
            <div className="mb-10 *:p-4 flex flex-col gap-y-2">
              {feedItems.length === 0 && (
                <p className="my-4 text-center text-zinc-500">
                  No activity yet
                </p>
              )}
              <FeedItems
                items={feedItems}
                handleLikeActivity={handleLikeActivity}
                handleLikeForumComment={handleLikeForumComment}
              />
              {feedIsFetchingNextPage && (
                <div className="flex justify-center py-4 text-zinc-400">
                  Loading more...
                </div>
              )}
              <div ref={feedSentinelRef} className="h-1" />
            </div>
          )}

          {selectedTab === ProfileTabs.ActionsCompleted && (
            <div className="mb-10 *:p-4 flex flex-col gap-y-2">
              {completedActivities.length === 0 && (
                <p className="my-4 text-center text-zinc-500">
                  No actions completed yet
                </p>
              )}
              {completedActivities.map((activity) => (
                <UserActivityCard
                  activity={activity}
                  key={`activity-${activity.id}`}
                  handleLike={handleLikeCompletedActivity}
                />
              ))}
            </div>
          )}

          {selectedTab === ProfileTabs.Forum && (
            <div className="flex flex-col gap-y-1">
              {didForumFail && (
                <LoadFailed
                  message="Couldn't load forum activity."
                  onRetry={retryForum}
                  retrying={isRetryingForum}
                />
              )}
              {forumActivityItems.length === 0 ? (
                !didForumFail && (
                  <p className="my-4 text-center text-zinc-500">
                    No forum activity yet
                  </p>
                )
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
              className="mt-4"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfilePage;
