import { useEffect, useState } from "react";
import {
  ActionActivityDto,
  actionsGetActivityFeed,
} from "@alliance/shared/client";
import { useActionActivityWebSocket } from "../../lib/useActionActivityWebSocket";
import ActivityFeedItem, {
  FeedActivity,
} from "../../components/ActivityFeedItem";

const ActivityFeedPage = () => {
  const [initialActivities, setInitialActivities] = useState<FeedActivity[]>(
    []
  );
  const [liveActivities, setLiveActivities] = useState<FeedActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const {
    isConnected,
    subscribeToFeed,
    unsubscribeFromFeed,
    onFeedActivity,
    offFeedActivity,
  } = useActionActivityWebSocket();

  useEffect(() => {
    const fetchInitialActivities = async () => {
      try {
        setLoading(true);
        const response = await actionsGetActivityFeed({
          query: { limit: "50" },
        });
        if (response.data) {
          setInitialActivities(response.data as FeedActivity[]);
        }
      } catch (err) {
        console.error("Error fetching initial activities:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialActivities();
    subscribeToFeed();

    const handleFeedActivity = (event: {
      actionId: number;
      activity: ActionActivityDto;
    }) => {
      const newActivity: FeedActivity = {
        ...event.activity,
        actionId: event.actionId,
      };

      setLiveActivities((prev) => [newActivity, ...prev]);
    };

    onFeedActivity(handleFeedActivity);

    return () => {
      unsubscribeFromFeed();
      offFeedActivity(handleFeedActivity);
    };
  }, [subscribeToFeed, unsubscribeFromFeed, onFeedActivity, offFeedActivity]);

  // Combine initial activities with live activities, avoiding duplicates
  const allActivities = [...liveActivities, ...initialActivities]
    .filter(
      (activity, index, self) =>
        self.findIndex((a) => a.id === activity.id) === index
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p>Loading feed...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="space-y-4 w-full flex flex-col justify-stretch">
        {allActivities.map((activity) => (
          <ActivityFeedItem key={activity.id} activity={activity} />
        ))}
      </div>
    </div>
  );
};

export default ActivityFeedPage;
