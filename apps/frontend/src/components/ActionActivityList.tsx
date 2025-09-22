import { ActionActivityDto } from "@alliance/shared/client";
import { useState } from "react";
import { useAuth } from "../lib/AuthContext";
import ActionActivityFeedItem from "./ActionActivityFeedItem";

interface ActionActivityListProps {
  actionId: number;
  activities: ActionActivityDto[];
  loading: boolean;
  onLikeActivity: (activityId: number) => Promise<void>;
  setActivities: React.Dispatch<React.SetStateAction<ActionActivityDto[]>>;
  maxN: number;
}

const ActionActivityList = ({
  activities,
  loading,
  onLikeActivity,
  maxN = 5,
}: ActionActivityListProps) => {
  const [showAll, setShowAll] = useState(false);
  const { user } = useAuth();

  const allActivities = activities.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="animate-pulse flex items-center space-x-3">
          <div className="rounded-full bg-gray-200 h-8 w-8"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  const handleLike = async (activity: ActionActivityDto) => {
    if (!user) {
      return;
    }
    await onLikeActivity(activity.id);
  };

  if (!allActivities.length) {
    return null;
  }
  const displayedActivities = showAll
    ? allActivities
    : allActivities.slice(0, maxN);

  const hasMore = allActivities.length > maxN;

  return (
    <div className="space-y-3 w-full">
      <p className="font-serif font-semibold text-xl text-black">
        Recent activity
      </p>
      <div className="flex flex-col *:py-3 -my-3">
        {displayedActivities.map((activity) => (
          <ActionActivityFeedItem
            key={activity.id}
            activity={activity}
            showTime={false}
            card={false}
            showAction={false}
            handleLike={handleLike}
          />
        ))}
      </div>
      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="text-green hover:text-green/70 mt-3 font-medium"
        >
          See all ({allActivities.length})
        </button>
      )}
    </div>
  );
};

export default ActionActivityList;
