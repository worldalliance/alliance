import { actionActivityTransitiveVerb } from "@alliance/common/actionActivity";
import { FeedActionActivityDto } from "@alliance/shared/lib/actionActivity";
import { formatTime } from "@alliance/shared/lib/utils";
import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { MessageCircle } from "lucide-react";
import { href, Link, useNavigate } from "react-router";
import LikeFooter, { LikeBarButton } from "./LikeFooter";

export interface ActionActivityFeedItemProps {
  activity: FeedActionActivityDto;
  showTime?: boolean;
  card?: boolean;
  showAction: boolean;
  showLikeFooter: boolean;
  handleLike: (activity: FeedActionActivityDto) => Promise<unknown>;
}

const ActionActivityFeedItem = ({
  activity,
  showTime = true,
  card = true,
  showAction = true,
  showLikeFooter = true,
  handleLike,
}: ActionActivityFeedItemProps) => {
  const navigate = useNavigate();

  const verb = actionActivityTransitiveVerb[activity.type];
  // A combined split's arm page opens only for members routed to it.
  const opensAction = activity.combinedSplitId === null;

  if (card) {
    return (
      <Link
        to={href("/member/:id", { id: activity.user.id.toString() })}
        className="text-black"
      >
        <span className="hover:underline font-medium">
          {`${activity.user.displayName}`}
        </span>
        <span className="text-zinc-600"> {verb}</span>
        <span className="font-medium"> {activity.actionName}</span>
        {showTime && (
          <p className="text-zinc-500 text-right text-nowrap">
            {formatTime(new Date(activity.createdAt), {
              addSuffix: true,
            })}{" "}
          </p>
        )}
      </Link>
    );
  } else {
    return (
      <div
        key={activity.id}
        className={cn(
          "rounded-md border-zinc-200",
          opensAction && "cursor-pointer",
        )}
        onClick={() => {
          if (!opensAction) return;
          navigate(
            href("/actions/:id/activity/:activityId", {
              id: activity.actionId.toString(),
              activityId: activity.id.toString(),
            }),
          );
        }}
      >
        <div className="flex flex-row gap-x-2 items-center flex-1 hover:bg-zinc-50 hover:p-2 hover:-m-2 rounded">
          <AvatarProfile
            pfp={activity.user.profilePicture}
            size="medium"
            className="self-start mt-1.5"
          />
          <div className="flex-1 text-zinc-700">
            <p className="font-medium">{activity.user.displayName}</p>
            {showAction ? (
              <p className="">
                <span className="text-zinc-500 text-nowrap">{verb} </span>
                <span className="text-green">{activity.actionName}</span>
                <span className="text-zinc-500 text-nowrap">
                  {" "}
                  {formatTime(new Date(activity.createdAt), {
                    addSuffix: true,
                  })}
                </span>
              </p>
            ) : (
              <p className="text-zinc-500">
                {formatTime(new Date(activity.createdAt), {
                  addSuffix: true,
                })}
              </p>
            )}
          </div>
        </div>
        {showLikeFooter && (
          <LikeFooter
            likeTargetType="activity"
            likeTargetId={activity.id}
            liked={activity.likedByMe ?? false}
            likesCount={activity.likesCount}
            likers={activity.likes}
            onLike={() => handleLike(activity)}
          >
            {opensAction && (
              <LikeBarButton
                icon={MessageCircle}
                label="Comment"
                onPress={() =>
                  navigate(
                    href("/actions/:id/activity/:activityId", {
                      id: activity.actionId.toString(),
                      activityId: activity.id.toString(),
                    }),
                  )
                }
              />
            )}
          </LikeFooter>
        )}
      </div>
    );
  }
};

export default ActionActivityFeedItem;
