import {
  ActionActivityDto,
  ActionDto,
  actionsGetActivity,
  actionsUpdateActivity,
  CreateEditableContentDto,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { useEffect, useMemo, useState } from "react";
import { Link, href, useOutletContext, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import chevronLeft from "../assets/icons8-expand-arrow-96.png";
import { useAuth } from "../lib/AuthContext";
import { formatTime } from "@alliance/shared/lib/utils";
import ActivityLikesButtonRow from "./ActivityLikesButtonRow";
import Comments from "./Comments";
import UserDisplayName from "@alliance/sharedweb/ui/UserDisplayName";
import EditableContentForm from "@alliance/sharedweb/ui/EditableContentForm";
import EditableContentRenderer from "@alliance/sharedweb/ui/EditableContentRenderer";
import { OutputRenderer } from "@alliance/sharedweb/forms/OutputRenderer";
import BasicErrorMessage from "./BasicErrorMessage";
import { actionActivityTransitiveVerb } from "@alliance/shared/lib/actionActivityConstants";

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
  handleLikeActivity: (activityId: number) => Promise<unknown>;
  setActivities: (activities: ActionActivityDto[]) => void;
}

const ActionActivityDetail = () => {
  const params = useParams();
  const activityId = parseInt(params.activityId!);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { action, activities, handleLikeActivity, setActivities } =
    useOutletContext<ActionActivityDetailContext>();

  // Find the activity from the shared state (used for like sync)
  const origactivity = activities.find((a) => a.id === activityId) || null;

  const { data: fetchedActivity } = useQuery({
    queryKey: ["actionsGetActivity", activityId],
    queryFn: () =>
      actionsGetActivity({ path: { id: activityId } }).then(
        (res) => res.data ?? null
      ),
    enabled: !!activityId,
  });

  // Merge fetched activity with live like data from outlet context
  const activity = useMemo(() => {
    const base = fetchedActivity ?? origactivity;
    if (!base || !origactivity) return base;
    return {
      ...base,
      likes: origactivity.likes,
      likesCount: origactivity.likesCount,
      likedByMe: origactivity.likedByMe,
    };
  }, [fetchedActivity, origactivity]);

  const verb = activity ? actionActivityTransitiveVerb[activity.type] : null;

  const handleLike = async () => {
    if (!user || !activity) {
      return;
    }
    await handleLikeActivity(activity.id);
  };

  const isLiked = activity?.likedByMe ?? false;

  const isOwner = activity?.user.id === user?.id;
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] =
    useState<CreateEditableContentDto | null>(
      activity?.editableContent ?? null
    );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEditContent(activity?.editableContent ?? null);
  }, [activity]);

  const handleSave = async () => {
    if (!user || !activity || isSaving || !editContent) {
      return;
    }

    setIsSaving(true);
    try {
      const resp = await actionsUpdateActivity({
        path: {
          id: activity.id,
        },
        body: {
          editableContent: editContent,
        },
      });
      if (resp.error) {
        console.error(resp.error);
        return;
      }
      const newActivity = resp.data!;
      setActivities(
        activities.map((a) => (a.id === activity.id ? newActivity : a))
      );
      queryClient.invalidateQueries({
        queryKey: ["actionsGetActivity", activityId],
      });
      setEditing(false);
    } catch (error) {
      console.error("Error updating activity:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditContent(activity?.editableContent ?? null);
    setEditing(false);
  };

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
                      className="flex-shrink-0"
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
                      <UserDisplayName staff={activity.user.staff}>
                        {activity.user.displayName}
                      </UserDisplayName>
                    </Link>{" "}
                    <span className="">{verb} this action</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-row items-center gap-x-2">
                {isOwner && !editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="text-green underline md:ml-2 text-nowrap"
                  >
                    {activity.editableContent?.body
                      ? "Edit details"
                      : "Add details"}
                  </button>
                )}
                <p className="text-zinc-500 text-nowrap">
                  {formatTime(new Date(activity?.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>
            {editing ? (
              <div className="space-y-2 mt-4 mb-0">
                <div className="rounded p-3 bg-zinc-100">
                  <EditableContentForm
                    value={editContent ?? { body: "", attachments: [] }}
                    restoreDraft={false}
                    onChange={setEditContent}
                    placeholder="Add a description..."
                  />
                  <div className="mt-2 flex justify-end items-center gap-2">
                    <Button
                      color={ButtonColor.Blue}
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      color={ButtonColor.White}
                      onClick={handleCancel}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {(!!activity.editableContent.body ||
                  activity.editableContent.attachments.length > 0) && (
                  <div className="mt-3">
                    <EditableContentRenderer
                      content={activity.editableContent}
                    />
                  </div>
                )}
              </>
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
            <div className="flex flex-row items-center justify-between mt-4">
              <ActivityLikesButtonRow
                isLiked={isLiked}
                likes={activity.likes}
                likesCount={activity.likesCount}
                handleLike={handleLike}
                labelText={true}
              />
            </div>
            <Comments objectId={activity.id} type={"activity"} />
          </>
        )}
      </div>
    </>
  );
};

export default ActionActivityDetail;
