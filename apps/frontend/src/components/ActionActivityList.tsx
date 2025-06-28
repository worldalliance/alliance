import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ActionActivityDto } from "@alliance/shared/client";
import { actionsGetActionActivities } from "@alliance/shared/client";
import { CardStyle } from "./system/Card";
import Card from "./system/Card";

interface ActionActivityListProps {
  actionId: number;
}

const ActionActivityList = ({ actionId }: ActionActivityListProps) => {
  const [activities, setActivities] = useState<ActionActivityDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setLoading(true);
        const response = await actionsGetActionActivities({
          path: { id: actionId },
        });
        if (!response.data) {
          throw new Error();
        }
        setActivities(response.data);
      } catch (err) {
        console.error("Error fetching activities:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [actionId]);

  const formatActivityMessage = useCallback((activity: ActionActivityDto) => {
    const userName = activity.user.name || "Someone";
    switch (activity.type) {
      case "user_joined":
        return `${userName} joined.`;
      case "user_completed":
        return `${userName} completed this action`;
      default:
        return "Unknown activity";
    }
  }, []);

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

  if (!activities.length) {
    return null;
  }

  return (
    <Card style={CardStyle.White} className="p-8">
      <div className="space-y-3 w-full">
        <h3 className="font-semibold text-gray-900">Recent Activity</h3>
        <div className="space-y-2">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                {activity.type === "user_joined" ? (
                  <div className="w-2 h-2 bg-bgreen rounded-full mt-2"></div>
                ) : (
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-900">
                  {formatActivityMessage(activity)}
                </p>
                <p className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(activity.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default ActionActivityList;
