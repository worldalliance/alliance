import { useActionLoaderData } from "../pages/app/ActionPage";
import chevronLeft from "../assets/icons8-expand-arrow-96.png";
import { useNavigate, useParams, useOutletContext } from "react-router";
import { formatTime } from "../lib/utils";
import { ActionActivityDto } from "@alliance/shared/client";
import { useEffect, useState } from "react";
import Comments from "./Comments";
import heart from "../assets/icons8-heart-90.png";
import { useAuth } from "../lib/AuthContext";
import { TaskPanelContext } from "./ActionTaskPanel";

export function formatActivityMessage(activity: ActionActivityDto) {
  const userName = activity.user.displayName || "Someone";
  switch (activity.type) {
    case "user_joined":
      return `${userName} joined`;
    case "user_completed":
      return `${userName} completed this action`;
    default:
      return "Unknown activity";
  }
}

export function ErrorBoundary(error: unknown) {
  console.error(error);
  const action = useActionLoaderData();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-y-3 flex-2 px-5 pl-10 pt-5">
      <h1 className="font-adobe w-full">{action.name}</h1>
      <div
        className="flex flex-row gap-x-3 items-center cursor-pointer border-b border-gray-300 pb-3 hover:underline"
        onClick={() => {
          navigate(`/actions/${action.id}`);
        }}
      >
        <img src={chevronLeft} className="w-4 h-4 rotate-90" />
        <p className="">Back to action</p>
      </div>
      <div className="flex flex-col items-center justify-center h-100 text-red-500">
        <p>Error loading user action</p>
      </div>
    </div>
  );
}

const ActionActivityDetail = () => {
  const navigate = useNavigate();
  const action = useActionLoaderData();
  const params = useParams();
  const activityId = parseInt(params.activityId!);
  const { user } = useAuth();
  const { activities, handleLikeActivity, setActivities } = useOutletContext<TaskPanelContext>();
  
  // Find the activity from the shared state
  const activity = activities.find(a => a.id === activityId) || null;

  const handleLike = async () => {
    if (!user || !activity) {
      return;
    }
    await handleLikeActivity(activity.id);
  };

  const isLiked = activity?.likes.some((like) => like.id === user?.id) || false;

  return (
    <div className="flex flex-col gap-y-3 flex-2 px-5 pl-10 pt-5">
      <h1 className="font-adobe w-full">{action.name}</h1>
      <div
        className="flex flex-row gap-x-3 items-center cursor-pointer border-b border-gray-300 pb-3 hover:underline"
        onClick={() => {
          navigate(`/actions/${action.id}`);
        }}
      >
        <img src={chevronLeft} className="w-4 h-4 rotate-90" />
        <p className="">Back to action</p>
      </div>
      {activity !== null && (
        <>
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-row items-center gap-x-2">
              {activity.user.profilePicture !== null && (
                <img
                  src={activity.user.profilePicture}
                  className="w-8 h-8 rounded-md object-cover"
                />
              )}
              <p className="font-semibold text-lg">
                {formatActivityMessage(activity)}
              </p>
            </div>
            <p className="text-gray-500 text-sm">
              {formatTime(new Date(activity?.createdAt), {
                addSuffix: true,
              })}
            </p>
          </div>
          <p className="text-gray-500">{activity.description}</p>
          {activity.attachments?.map((attachment) => (
            <img
              key={attachment}
              src={attachment}
              className="w-full h-auto rounded-md object-cover"
            />
          ))}
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-row items-center gap-x-2">
              <button
                onClick={handleLike}
                className="flex items-center gap-x-2 hover:bg-gray-100 rounded-md px-3 py-1.5 transition-colors cursor-pointer"
              >
                <img
                  src={heart}
                  alt="Like"
                  className={`w-5 h-5 transition-opacity ${
                    isLiked ? "opacity-80" : "opacity-30"
                  } hover:opacity-50`}
                />
                <span className="text-sm font-medium">{activity.likes.length} {activity.likes.length === 1 ? 'like' : 'likes'}</span>
              </button>
              {activity.likes
                .filter((like) => like.profilePicture !== null)
                .slice(0, 5)
                .map((like) => (
                  <img
                    key={like.id}
                    src={like.profilePicture!}
                    className="w-6 h-6 rounded-md object-cover"
                    title={like.displayName}
                  />
                ))}
              {activity.likes.length > 5 && (
                <span className="text-sm text-gray-500">
                  +{activity.likes.length - 5} more
                </span>
              )}
            </div>
          </div>
          <Comments objectId={activity.id} type={"activity"} />
        </>
      )}
    </div>
  );
};

export default ActionActivityDetail;
