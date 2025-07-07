import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { getWebSocketUrl } from "./config";
import { ActionActivityDto } from "@alliance/shared/client";

interface ActionActivityEvent {
  actionId: number;
  activity: ActionActivityDto;
}

interface FeedActivityEvent {
  actionId: number;
  activity: ActionActivityDto;
}

interface UseActionActivityWebSocketReturn {
  isConnected: boolean;
  subscribeToActionActivity: (actionId: number) => void;
  unsubscribeFromActionActivity: (actionId: number) => void;
  subscribeToFeed: () => void;
  unsubscribeFromFeed: () => void;
  onActionActivity: (callback: (event: ActionActivityEvent) => void) => void;
  onFeedActivity: (callback: (event: FeedActivityEvent) => void) => void;
  offActionActivity: (callback: (event: ActionActivityEvent) => void) => void;
  offFeedActivity: (callback: (event: FeedActivityEvent) => void) => void;
}

export function useActionActivityWebSocket(): UseActionActivityWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const subscribedActivitiesRef = useRef<Set<number>>(new Set());
  const subscribedToFeedRef = useRef<boolean>(false);
  const actionActivityCallbacksRef = useRef<
    Set<(event: ActionActivityEvent) => void>
  >(new Set());
  const feedActivityCallbacksRef = useRef<
    Set<(event: FeedActivityEvent) => void>
  >(new Set());

  const initializeSocket = useCallback(() => {
    if (socketRef.current) return;

    const socket = io(getWebSocketUrl() + "/actions", {
      transports: ["websocket"],
      forceNew: true,
    });

    socket.on("connect", () => {
      setIsConnected(true);
      console.log("Activity WebSocket connected");
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      console.log("Activity WebSocket disconnected");
    });

    socket.on("action-activity", (data: ActionActivityEvent) => {
      actionActivityCallbacksRef.current.forEach((callback) => callback(data));
    });

    socket.on("feed-activity", (data: FeedActivityEvent) => {
      feedActivityCallbacksRef.current.forEach((callback) => callback(data));
    });

    socket.on("error", (error) => {
      console.error("Activity WebSocket error:", error);
    });

    socketRef.current = socket;
  }, []);

  const subscribeToActionActivity = useCallback(
    (actionId: number) => {
      if (subscribedActivitiesRef.current.has(actionId)) return;

      initializeSocket();
      subscribedActivitiesRef.current.add(actionId);
      socketRef.current?.emit("subscribe-action-activity", { actionId });
    },
    [initializeSocket]
  );

  const unsubscribeFromActionActivity = useCallback((actionId: number) => {
    if (!socketRef.current || !subscribedActivitiesRef.current.has(actionId))
      return;

    subscribedActivitiesRef.current.delete(actionId);
    socketRef.current.emit("unsubscribe-action-activity", { actionId });
  }, []);

  const subscribeToFeed = useCallback(() => {
    if (subscribedToFeedRef.current) return;

    initializeSocket();
    subscribedToFeedRef.current = true;
    socketRef.current?.emit("subscribe-feed");
  }, [initializeSocket]);

  const unsubscribeFromFeed = useCallback(() => {
    if (!socketRef.current || !subscribedToFeedRef.current) return;

    subscribedToFeedRef.current = false;
    socketRef.current.emit("unsubscribe-feed");
  }, []);

  const onActionActivity = useCallback(
    (callback: (event: ActionActivityEvent) => void) => {
      actionActivityCallbacksRef.current.add(callback);
    },
    []
  );

  const offActionActivity = useCallback(
    (callback: (event: ActionActivityEvent) => void) => {
      actionActivityCallbacksRef.current.delete(callback);
    },
    []
  );

  const onFeedActivity = useCallback(
    (callback: (event: FeedActivityEvent) => void) => {
      feedActivityCallbacksRef.current.add(callback);
    },
    []
  );

  const offFeedActivity = useCallback(
    (callback: (event: FeedActivityEvent) => void) => {
      feedActivityCallbacksRef.current.delete(callback);
    },
    []
  );

  useEffect(() => {
    const subscribedActivities = subscribedActivitiesRef.current;
    const actionActivityCallbacks = actionActivityCallbacksRef.current;
    const feedActivityCallbacks = feedActivityCallbacksRef.current;

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      subscribedActivities.clear();
      subscribedToFeedRef.current = false;
      actionActivityCallbacks.clear();
      feedActivityCallbacks.clear();
    };
  }, []);

  return {
    isConnected,
    subscribeToActionActivity,
    unsubscribeFromActionActivity,
    subscribeToFeed,
    unsubscribeFromFeed,
    onActionActivity,
    onFeedActivity,
    offActionActivity,
    offFeedActivity,
  };
}

export function useActionActivity(actionId: number): {
  activities: ActionActivityDto[];
  addActivity: (activity: ActionActivityDto) => void;
  isConnected: boolean;
} {
  const [activities, setActivities] = useState<ActionActivityDto[]>([]);
  const {
    isConnected,
    subscribeToActionActivity,
    unsubscribeFromActionActivity,
    onActionActivity,
    offActionActivity,
  } = useActionActivityWebSocket();

  const addActivity = useCallback((activity: ActionActivityDto) => {
    setActivities((prev) => [activity, ...prev]);
  }, []);

  useEffect(() => {
    if (actionId) {
      subscribeToActionActivity(actionId);

      const handleActivity = (event: ActionActivityEvent) => {
        if (event.actionId === actionId) {
          addActivity(event.activity);
        }
      };

      onActionActivity(handleActivity);

      return () => {
        unsubscribeFromActionActivity(actionId);
        offActionActivity(handleActivity);
      };
    }
  }, [
    actionId,
    subscribeToActionActivity,
    unsubscribeFromActionActivity,
    onActionActivity,
    offActionActivity,
    addActivity,
  ]);

  return {
    activities,
    addActivity,
    isConnected,
  };
}
