import {
  ActionActivityDto,
  ActionDto,
  actionsUpdateActivity,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import ProfileImage from "@alliance/shared/ui/ProfileImage";
import { useEffect, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router";
import chevronLeft from "../assets/icons8-expand-arrow-96.png";
import { useAuth } from "../lib/AuthContext";
import { formatTime } from "@alliance/shared/lib/utils";
import ActivityLikesButtonRow from "./ActivityLikesButtonRow";
import Comments from "./Comments";
import UserDisplayName from "./UserDisplayName";

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
  handleLikeActivity: (activityId: number) => Promise<void>;
  setActivities: (activities: ActionActivityDto[]) => void;
}

const ActionActivityDetail = () => {
  const params = useParams();
  const activityId = parseInt(params.activityId!);
  const { user } = useAuth();
  const { action, activities, handleLikeActivity, setActivities } =
    useOutletContext<ActionActivityDetailContext>();

  // Find the activity from the shared state
  const activity = activities.find((a) => a.id === activityId) || null;
  const verb = activity?.type === "user_joined" ? "committed to" : "completed";

  const handleLike = async () => {
    if (!user || !activity) {
      return;
    }
    await handleLikeActivity(activity.id);
  };

  const isLiked = activity?.likes.some((like) => like.id === user?.id) || false;

  const isOwner = activity?.user.id === user?.id;
  const [editing, setEditing] = useState(false);
  const [activityDescription, setActivityDescription] = useState(
    activity?.editableContent?.body || ""
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setActivityDescription(activity?.editableContent?.body || "");
  }, [activity]);

  const handleSave = async () => {
    if (!user || !activity || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      const resp = await actionsUpdateActivity({
        path: {
          id: activity.id,
        },
        body: {
          editableContent: { body: activityDescription, attachments: [] },
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
      setActivityDescription(newActivity.editableContent?.body || "");
      setEditing(false);
    } catch (error) {
      console.error("Error updating activity:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setActivityDescription(activity?.editableContent?.body || "");
    setEditing(false);
  };

  return (
    <>
      <div className="flex flex-col gap-y-3 flex-2 px-5 pl-10 pt-5 w-full">
        <Link
          className="flex flex-row gap-x-2 items-center cursor-pointer hover:bg-zinc-50 self-start px-2 py-1 rounded border border-zinc-200"
          to={`/actions/${action.id}`}
        >
          <img src={chevronLeft} className="w-3 h-3 rotate-90" />
          Back to action
        </Link>
        <h1 className="font-serif !font-medium w-full">{action.name}</h1>
        {activity !== null && (
          <>
            <div className="flex flex-row items-center justify-between mt-4">
              <div className="flex flex-row items-center">
                <div className="flex flex-row items-center gap-x-2">
                  {activity.user.profilePicture !== null && (
                    <Link to={`/user/${activity.user.id}`}>
                      <ProfileImage
                        pfp={activity.user.profilePicture}
                        size="medium"
                      />
                    </Link>
                  )}
                  <p className="font-medium">
                    <Link to={`/user/${activity.user.id}`}>
                      <UserDisplayName staff={activity.user.staff}>
                        {activity.user.displayName}
                      </UserDisplayName>
                    </Link>{" "}
                    {verb} this action
                  </p>
                </div>
                {isOwner && !editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="text-green text-sm underline ml-2"
                  >
                    {activity.editableContent?.body
                      ? "Edit details"
                      : "Add details"}
                  </button>
                )}
              </div>
              <p className="text-gray-500 text-sm">
                {formatTime(new Date(activity?.createdAt), {
                  addSuffix: true,
                })}
              </p>
            </div>
            {editing ? (
              <div className="space-y-2">
                <textarea
                  value={activityDescription}
                  onChange={(e) => setActivityDescription(e.target.value)}
                  placeholder="Add any details you want to share about this activity..."
                  className="w-full border border-zinc-300 focus:outline-none p-2 rounded"
                  rows={4}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      handleCancel();
                    }
                  }}
                />
                <div className="flex space-x-2">
                  <Button
                    color={ButtonColor.Light}
                    onClick={handleCancel}
                    className="text-xs py-1 px-2"
                  >
                    Cancel
                  </Button>
                  <Button
                    color={ButtonColor.Blue}
                    onClick={handleSave}
                    disabled={isSaving}
                    className="text-xs py-1 px-2"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            ) : (
              activity.editableContent?.body && (
                <p>{activity.editableContent.body}</p>
              )
            )}
            {activity.editableContent?.attachments?.map((attachment) => (
              <img
                key={attachment}
                src={attachment}
                className="w-full h-auto rounded-md object-cover"
              />
            ))}
            <div className="flex flex-row items-center justify-between mt-1">
              <ActivityLikesButtonRow
                isLiked={isLiked}
                likes={activity.likes}
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
