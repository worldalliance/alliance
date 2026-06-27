import { actionActivityTransitiveVerb } from "@alliance/common/actionActivity";
import {
  ActionActivityDto,
  ActionDto,
  actionsGetActivity,
} from "@alliance/shared/client";
import { formatTime } from "@alliance/shared/lib/utils";
import { OutputRenderer } from "@alliance/sharedweb/forms/OutputRenderer";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import EditableContentRenderer from "@alliance/sharedweb/ui/EditableContentRenderer";
import UserDisplayName from "@alliance/sharedweb/ui/UserDisplayName";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link, href, useOutletContext, useParams } from "react-router";
import chevronLeft from "../assets/icons8-expand-arrow-96.png";
import { useAuth } from "../lib/AuthContext";
import BasicErrorMessage from "./BasicErrorMessage";
import Comments from "./Comments";
import LikeFooter from "./LikeFooter";

export function ErrorBoundary(error: unknown) {
  console.error(error);

  return (
    <div className="flex flex-col gap-y-3 flex-2 px-5 pl-10 pt-5">
      <div className="flex flex-col items-center justify-center h-100 text-red-500">
        <p>Error loading user action</p>
      </div>
    </div>
  );
}

export interface ActionActivityDetailContext {
  action: ActionDto;
  activities: ActionActivityDto[];
  handleLikeActivity: (
    activityId: number,
    overrides?: { isLiked: boolean; activityType: string },
  ) => Promise<unknown>;
}

const ActionActivityDetail = () => {
  const params = useParams();
  const activityId = parseInt(params.activityId!);
  const { user } = useAuth();
  const { action, activities, handleLikeActivity } =
    useOutletContext<ActionActivityDetailContext>();

  const origactivity = activities.find((a) => a.id === activityId) || null;

  const { data: fetchedActivity } = useQuery({
    queryKey: ["actionsGetActivity", activityId],
    queryFn: () =>
      actionsGetActivity({ path: { id: activityId } }).then(
        (res) => res.data ?? null,
      ),
    enabled: !!activityId,
  });

  const activity = useMemo(() => {
    const base = fetchedActivity ?? origactivity;
    if (!base || !origactivity) return base;
    return {
      ...base,
      likes: origactivity.likes ?? fetchedActivity?.likes,
      likesCount: origactivity.likesCount ?? fetchedActivity?.likesCount,
      likedByMe: origactivity.likedByMe ?? fetchedActivity?.likedByMe,
    };
  }, [fetchedActivity, origactivity]);

  const verb = activity ? actionActivityTransitiveVerb[activity.type] : null;

  const queryClient = useQueryClient();
  const detailQueryKey = ["actionsGetActivity", activityId];

  const likeMutation = useMutation({
    mutationFn: (isLiked: boolean) =>
      handleLikeActivity(activityId, {
        isLiked,
        activityType: activity?.type ?? "",
      }),
    onMutate: async (isLiked: boolean) => {
      await queryClient.cancelQueries({ queryKey: detailQueryKey });
      const previous = queryClient.getQueryData<ActionActivityDto | null>(
        detailQueryKey,
      );
      queryClient.setQueryData(
        detailQueryKey,
        (old: ActionActivityDto | null) =>
          old
            ? {
                ...old,
                likedByMe: !isLiked,
                likesCount: isLiked ? old.likesCount - 1 : old.likesCount + 1,
              }
            : old,
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(detailQueryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: detailQueryKey });
    },
  });

  const handleLike = async () => {
    if (!user || !activity) return;
    await likeMutation.mutateAsync(activity.likedByMe ?? false);
  };

  const isLiked = activity?.likedByMe ?? false;

  if (activity?.actionId !== action.id) {
    return <BasicErrorMessage>Activity not found</BasicErrorMessage>;
  }

  return (
    <>
      <div className="flex flex-col flex-2 pr-0 sm:pr-5 xl:pl-10 pt-5 w-full">
        <Link
          className="flex flex-row gap-x-2 items-center cursor-pointer hover:bg-zinc-50 self-start px-2 py-1 rounded border border-zinc-200"
          to={href("/actions/:id", { id: action.id.toString() })}
        >
          <img src={chevronLeft} className="w-3 h-3 rotate-90" />
          Back to action
        </Link>
        <h1 className="text-title mt-8 mb-2">{action.name}</h1>
        {activity !== null && (
          <>
            <div className="flex flex-col gap-y-2 lg:gap-y-0 lg:flex-row lg:items-center lg:gap-x-2 justify-between mt-4">
              <div className="flex flex-col gap-y-2 lg:gap-y-0 lg:flex-row items-start lg:items-center">
                <div className="flex flex-row items-center gap-x-2">
                  {activity.user.profilePicture !== null && (
                    <Link
                      to={href("/member/:id", {
                        id: activity.user.id.toString(),
                      })}
                      className="shrink-0"
                    >
                      <AvatarProfile
                        pfp={activity.user.profilePicture}
                        size="medium"
                      />
                    </Link>
                  )}
                  <div>
                    <Link
                      to={href("/member/:id", {
                        id: activity.user.id.toString(),
                      })}
                    >
                      <UserDisplayName
                        staff={activity.user.staff}
                        ambassador={activity.user.ambassador}
                        grouplead={activity.user.isCommunityLeader}
                      >
                        {activity.user.displayName}
                      </UserDisplayName>
                    </Link>{" "}
                    <span className="">{verb} this action</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-row items-center gap-x-2">
                <p className="text-zinc-500 text-nowrap">
                  {formatTime(new Date(activity?.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>
            {(!!activity.editableContent.body ||
              activity.editableContent.attachments.length > 0) && (
              <div className="mt-3">
                <EditableContentRenderer content={activity.editableContent} />
              </div>
            )}
            {activity.formResponseOutput && (
              <div className="my-3">
                <OutputRenderer submission={activity.formResponseOutput} />
              </div>
            )}
            {activity.editableContent?.attachments?.map((attachment) => (
              <img
                key={attachment}
                src={attachment}
                className="w-full h-auto rounded-md object-cover"
              />
            ))}
            <LikeFooter
              likeTargetType="activity"
              likeTargetId={activity.id}
              liked={isLiked}
              likesCount={activity.likesCount}
              likers={activity.likes}
              onLike={handleLike}
              align="right"
            />
            <Comments objectId={activity.id} type={"activity"} />
          </>
        )}
      </div>
    </>
  );
};

export default ActionActivityDetail;
