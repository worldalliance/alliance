import {
  ActionActivityDto,
  actionsUpdateActivity,
  CreateEditableContentDto,
  imagesUploadImage,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { useCallback, useState } from "react";
import { Link, href, useNavigate } from "react-router";
import { useAuth } from "../lib/AuthContext";
import { formatTime } from "@alliance/shared/lib/utils";
import ActivityLikeButton from "./ActivityLikeButton";
import Comments from "./Comments";
import EditableContentForm from "@alliance/sharedweb/ui/EditableContentForm";
import EditableContentRenderer from "@alliance/sharedweb/ui/EditableContentRenderer";
import OutputRenderer from "@alliance/sharedweb/forms/OutputRenderer";
import { Edit } from "lucide-react";
import { cn } from "@alliance/shared/styles/util";

interface UserActivityCardProps {
  activity: ActionActivityDto;
  handleLike: (activityId: number) => void;
  onActivityUpdate?: (updatedActivity: ActionActivityDto) => void;
  canEdit?: boolean;
}

const UserActivityCard = ({
  activity,
  handleLike,
  onActivityUpdate,
  canEdit = false,
}: UserActivityCardProps) => {
  const navigate = useNavigate();
  const { user: self } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState<CreateEditableContentDto>(
    activity.editableContent ?? { body: "", attachments: [] }
  );

  const [isSaving, setIsSaving] = useState(false);

  const [showCommentForm, setShowCommentForm] = useState(false);

  const completed = activity.type === "user_completed";

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigate(href("/actions/:id", { id: activity.actionId.toString() }));
    },
    [activity.actionId, navigate]
  );

  const handleActivityClick = useCallback(() => {
    if (isEditing || isSaving || showCommentForm) return;
    navigate(
      href("/actions/:id/activity/:activityId", {
        id: activity.actionId.toString(),
        activityId: activity.id.toString(),
      })
    );
  }, [
    activity.actionId,
    activity.id,
    navigate,
    isEditing,
    isSaving,
    showCommentForm,
  ]);

  const timeSinceCompleted = formatTime(new Date(activity.createdAt), {
    addSuffix: true,
  });

  const handleEdit = useCallback(() => {
    setEditContent({
      body: activity.editableContent.body,
      attachments: activity.editableContent.attachments,
    });
    setIsEditing(true);
  }, [activity.editableContent]);

  const handleSave = useCallback(async () => {
    if (!self || isSaving) return;

    setIsSaving(true);
    try {
      const uploads = await Promise.all(
        (editContent.attachments || []).map(async (img) => {
          if (img.startsWith("data:")) {
            const res = await imagesUploadImage({ body: { file: img } });
            return res.data?.key;
          }
          return img;
        })
      );
      const attachmentKeys = uploads.filter((key) => key !== undefined);

      const response = await actionsUpdateActivity({
        path: { id: activity.id },
        body: {
          editableContent: {
            body: editContent.body,
            attachments: attachmentKeys,
          },
        },
      });

      if (response.error) {
        console.error("Error updating activity:", response.error);
        return;
      }

      if (response.data && onActivityUpdate) {
        onActivityUpdate(response.data);
      }

      setIsEditing(false);
    } catch (error) {
      console.error("Error updating activity:", error);
    } finally {
      setIsSaving(false);
    }
  }, [
    self,
    isSaving,
    editContent.attachments,
    editContent.body,
    activity.id,
    onActivityUpdate,
  ]);

  const handleCancel = useCallback(() => {
    setEditContent({
      body: activity.editableContent.body,
      attachments: activity.editableContent.attachments,
    });
    setIsEditing(false);
  }, [activity.editableContent]);

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          "block p-4 -m-4 text-[11pt] transition-colors duration-100 flex-1 gap-y-2 bg-white",
          !(isEditing || isSaving || showCommentForm) &&
            "hover:bg-zinc-50 cursor-pointer"
        )}
        onClick={handleActivityClick}
      >
        <div className="*:inline">
          <div className="flex-shrink-0 inline align-middle">
            <Link
              to={href("/member/:id", { id: activity.user.id.toString() })}
              className="mr-2"
              onClick={(e) => e.stopPropagation()}
            >
              <AvatarProfile
                pfp={activity.user.profilePicture}
                size="small"
                className="align-middle"
              />
            </Link>
          </div>
          <Link
            to={href("/member/:id", { id: activity.user.id.toString() })}
            className="text-zinc-900 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {activity.user.displayName}
          </Link>
          <p className="text-zinc-900">
            {completed ? " completed " : " committed to "}
          </p>
          {activity.actionName ? (
            <p
              className="text-green cursor-pointer hover:underline font-medium"
              onClick={handleClick}
            >
              {activity.actionName}
            </p>
          ) : (
            <p>this action</p>
          )}
        </div>
        {isEditing ? (
          <div className="flex-1 space-y-2 -m-4 mt-4 mb-0 border-t border-zinc-200">
            <div className="rounded p-3 bg-zinc-100">
              <EditableContentForm
                value={editContent}
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
          <div>
            {(!!activity.editableContent.body ||
              activity.editableContent.attachments.length > 0) && (
              <div className="mt-3">
                <EditableContentRenderer content={activity.editableContent} />
              </div>
            )}
            <>
              {activity.formResponseOutput &&
                Object.keys(activity.formResponseOutput.publicAnswers ?? {})
                  .length > 0 && (
                  <div className="my-3">
                    <OutputRenderer submission={activity.formResponseOutput} />
                  </div>
                )}
            </>

            <div className="flex flex-row justify-between w-full items-end">
              <p className="text-zinc-500">{timeSinceCompleted}</p>
              <div
                className={cn(
                  "flex items-center space-x-2 self-end",
                  !activity.editableContent.body && "mt-2"
                )}
              >
                <ActivityLikeButton
                  liked={activity.likedByMe ?? false}
                  likes={activity.likesCount}
                  handleLike={() => handleLike(activity.id)}
                  backgroundColor="white"
                />
                {canEdit && (
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit();
                    }}
                    color={ButtonColor.White}
                    className="flex flex-row gap-x-1 items-center !px-3 !py-[6px] !h-full"
                  >
                    <Edit size="15" strokeWidth={1.5} />
                    <span className="text-sm text-zinc-800">Edit</span>
                  </Button>
                )}
                {completed && (
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCommentForm(true);
                    }}
                    color={ButtonColor.White}
                    className="flex flex-row gap-x-1 items-center !px-3 !py-[6px] !h-full"
                  >
                    <span className="text-sm text-zinc-800 text-nowrap">
                      Reply
                    </span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {completed && (
        <Comments
          objectId={activity.id}
          type="activity"
          initialComments={activity.comments}
          compact
          showForm={showCommentForm}
          autofocus={showCommentForm}
          showUserBadges={false}
        />
      )}
    </div>
  );
};

export default UserActivityCard;
