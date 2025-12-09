import {
  ActionActivityDto,
  ActionDto,
  actionsGetActivity,
  actionsUpdateActivity,
  CreateEditableContentDto,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import ProfileImage from "@alliance/shared/ui/ProfileImage";
import { useEffect, useState } from "react";
import { Link, href, useOutletContext, useParams } from "react-router";
import chevronLeft from "../assets/icons8-expand-arrow-96.png";
import { useAuth } from "../lib/AuthContext";
import { formatTime } from "@alliance/shared/lib/utils";
import ActivityLikesButtonRow from "./ActivityLikesButtonRow";
import Comments from "./Comments";
import UserDisplayName from "./UserDisplayName";
import EditableContentForm from "@alliance/shared/ui/EditableContentForm";
import EditableContentRenderer from "@alliance/shared/ui/EditableContentRenderer";
import { OutputRenderer } from "@alliance/shared/forms/OutputRenderer";

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
  const origactivity = activities.find((a) => a.id === activityId) || null;

  const [activity, setActivity] = useState<ActionActivityDto | null>(
    origactivity
  );
  useEffect(() => {
    if (!origactivity) {
      return;
    }
    setActivity((prev) =>
      !!prev
        ? {
            ...prev,
            likes: origactivity.likes,
            likesCount: origactivity.likesCount,
            likedByMe: origactivity.likedByMe,
          }
        : prev
    );
  }, [origactivity]);

  useEffect(() => {
    actionsGetActivity({ path: { id: activityId } }).then((resp) => {
      if (resp.data) {
        setActivity(resp.data);
      }
    });
  }, [activityId]);

  const verb = activity?.type === "user_joined" ? "committed to" : "completed";

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
      setActivity(newActivity);
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
        <h1 className="mt-8 mb-2 text-3xl font-serif !font-semibold w-full">
          {action.name}
        </h1>
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
                      <ProfileImage
                        pfp={activity.user.profilePicture}
                        size="medium"
                      />
                    </Link>
                  )}
                  <p className="font-medium">
                    <Link
                      to={href("/member/:id", {
                        id: activity.user.id.toString(),
                      })}
                    >
                      <UserDisplayName staff={activity.user.staff}>
                        {activity.user.displayName}
                      </UserDisplayName>
                    </Link>{" "}
                    {verb} this action
                  </p>
                </div>
              </div>
              <div className="flex flex-row items-center gap-x-2">
                {isOwner && !editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="text-green text-sm underline md:ml-2 text-nowrap"
                  >
                    {activity.editableContent?.body
                      ? "Edit details"
                      : "Add details"}
                  </button>
                )}
                <p className="text-gray-500 text-sm text-nowrap">
                  {formatTime(new Date(activity?.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>
            {editing ? (
              <div className="flex-1 space-y-2 -m-4 mt-4 mb-0 border-t border-zinc-200">
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
