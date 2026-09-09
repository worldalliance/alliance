import {
  actionActivityCommentable,
  actionActivityTransitiveVerb,
} from "@alliance/common/actionActivity";
import { FormSchema } from "@alliance/common/forms/form-schema";
import { FeedActionActivityDto } from "@alliance/shared/lib/actionActivity";
import { canToggleLike } from "@alliance/shared/lib/actionUtils";
import { formatTime } from "@alliance/shared/lib/utils";
import { cn } from "@alliance/shared/styles/util";
import OutputRenderer from "@alliance/sharedweb/forms/OutputRenderer";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import EditableContentRenderer from "@alliance/sharedweb/ui/EditableContentRenderer";
import { MessageCircle } from "lucide-react";
import { useCallback, useState } from "react";
import { href, Link, useNavigate } from "react-router";
import Comments from "./Comments";
import LikeFooter, { LikeBarButton } from "./LikeFooter";

interface UserActivityCardProps {
  activity: FeedActionActivityDto;
  handleLike: (activityId: number) => Promise<unknown>;
}

const UserActivityCard = ({ activity, handleLike }: UserActivityCardProps) => {
  const navigate = useNavigate();
  const [showCommentForm, setShowCommentForm] = useState(false);

  const verb = actionActivityTransitiveVerb[activity.type];
  const commentable = actionActivityCommentable[activity.type];

  const handleActivityClick = useCallback(() => {
    if (showCommentForm) return;
    navigate(
      href("/actions/:id/activity/:activityId", {
        id: activity.actionId.toString(),
        activityId: activity.id.toString(),
      }),
    );
  }, [activity.actionId, activity.id, navigate, showCommentForm]);

  const timeSinceCompleted = formatTime(new Date(activity.createdAt), {
    addSuffix: true,
  });

  return (
    <div className="flex flex-col bg-white">
      <div
        className={cn(
          "block p-4 -m-4 text-[11pt] transition-colors duration-100 flex-1 gap-y-2 bg-white",
          // Child controls do not open activity; keep card hover off there.
          !showCommentForm &&
            "hover:bg-grey-1 [&:has(a:hover)]:bg-white [&:has(button:hover)]:bg-white cursor-pointer",
        )}
        onClick={handleActivityClick}
      >
        <div className="flex flex-wrap items-center">
          <Link
            to={href("/member/:id", { id: activity.user.id.toString() })}
            className="inline-flex items-center text-zinc-900 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <AvatarProfile
              pfp={activity.user.profilePicture}
              size="small"
              className="mr-2 shrink-0"
            />
            <span>{activity.user.displayName}</span>
          </Link>
          <span className="whitespace-pre text-zinc-900">{` ${verb} `}</span>

          {activity.actionName ? (
            <Link
              to={href("/actions/:id", { id: activity.actionId.toString() })}
              className="text-green hover:underline font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              {activity.actionName}
            </Link>
          ) : (
            <span>this action</span>
          )}
        </div>
        <div>
          {(!!activity.editableContent.body ||
            activity.editableContent.attachments.length > 0) && (
            <div className="mt-3">
              <EditableContentRenderer content={activity.editableContent} />
            </div>
          )}
          {activity.formResponseOutput &&
            Object.keys(activity.formResponseOutput.publicAnswers ?? {})
              .length > 0 &&
            !!(
              activity.formResponseOutput
                .schemaSnapshot as unknown as FormSchema
            ).outputViews?.length && (
              <div className="my-3">
                <OutputRenderer submission={activity.formResponseOutput} />
              </div>
            )}
          <p className="text-zinc-500 mt-1">{timeSinceCompleted}</p>
          <LikeFooter
            likeTargetType="activity"
            likeTargetId={activity.id}
            liked={activity.likedByMe ?? false}
            likesCount={activity.likesCount}
            likers={activity.likes}
            onLike={
              canToggleLike({
                discussionClosed: activity.discussionClosed,
                liked: activity.likedByMe ?? false,
              })
                ? () => handleLike(activity.id)
                : undefined
            }
          >
            {commentable && !activity.discussionClosed && (
              <LikeBarButton
                icon={MessageCircle}
                label="Comment"
                onPress={(e) => {
                  e.stopPropagation();
                  setShowCommentForm(true);
                }}
              />
            )}
          </LikeFooter>
        </div>
      </div>
      {commentable && (
        <Comments
          objectId={activity.id}
          type="activity"
          initialComments={activity.comments}
          compact
          showForm={showCommentForm}
          autofocus={showCommentForm}
          showUserBadges={false}
          discussionClosed={activity.discussionClosed}
        />
      )}
    </div>
  );
};

export default UserActivityCard;
