import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { getWebSocketUrl } from "./config";

interface ActionCount {
  actionId: number;
  count: number;
  delta?: number;
}

interface ActionCounts {
  [actionId: number]: number;
}

interface UseActionWebSocketReturn {
  actionCounts: ActionCounts;
  isConnected: boolean;
  subscribeToAction: (actionId: number) => void;
  unsubscribeFromAction: (actionId: number) => void;
  subscribeToActions: (actionIds: number[]) => void;
  unsubscribeFromActions: (actionIds: number[]) => void;
}

export function useActionWebSocket(): UseActionWebSocketReturn {
  const [actionCounts, setActionCounts] = useState<ActionCounts>({});
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const subscribedActionsRef = useRef<Set<number>>(new Set());

  const initializeSocket = useCallback(() => {
    if (socketRef.current) return;

    const socket = io(getWebSocketUrl() + "/actions", {
      transports: ["websocket"],
      forceNew: true,
    });

    socket.on("connect", () => {
      setIsConnected(true);
      console.log("WebSocket connected");
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      console.log("WebSocket disconnected");
    });

    socket.on("action-count", (data: ActionCount) => {
      setActionCounts((prev) => ({
        ...prev,
        [data.actionId]: data.count,
      }));
    });

    socket.on("actions-counts", (data: ActionCounts) => {
      setActionCounts((prev) => ({
        ...prev,
        ...data,
      }));
    });

    socket.on("error", (error) => {
      console.error("WebSocket error:", error);
    });

    socketRef.current = socket;
  }, []);

  const subscribeToAction = useCallback(
    (actionId: number) => {
      if (!socketRef.current || subscribedActionsRef.current.has(actionId))
        return;

      initializeSocket();
      subscribedActionsRef.current.add(actionId);
      socketRef.current.emit("subscribe-action", { actionId });
    },
    [initializeSocket]
  );

  const unsubscribeFromAction = useCallback((actionId: number) => {
    if (!socketRef.current || !subscribedActionsRef.current.has(actionId))
      return;

    subscribedActionsRef.current.delete(actionId);
    socketRef.current.emit("unsubscribe-action", { actionId });

    // Remove from local state
    setActionCounts((prev) => {
      const newCounts = { ...prev };
      delete newCounts[actionId];
      return newCounts;
    });
  }, []);

  const subscribeToActions = useCallback(
    (actionIds: number[]) => {
      if (!actionIds.length) return;

      initializeSocket();

      const newActionIds = actionIds.filter(
        (id) => !subscribedActionsRef.current.has(id)
      );
      if (newActionIds.length === 0) return;

      newActionIds.forEach((id) => subscribedActionsRef.current.add(id));
      socketRef.current?.emit("subscribe-actions", { actionIds: newActionIds });
    },
    [initializeSocket]
  );

  const unsubscribeFromActions = useCallback((actionIds: number[]) => {
    if (!socketRef.current || !actionIds.length) return;

    const toUnsubscribe = actionIds.filter((id) =>
      subscribedActionsRef.current.has(id)
    );
    if (toUnsubscribe.length === 0) return;

    toUnsubscribe.forEach((id) => subscribedActionsRef.current.delete(id));
    socketRef.current.emit("unsubscribe-actions", { actionIds: toUnsubscribe });

    // Remove from local state
    setActionCounts((prev) => {
      const newCounts = { ...prev };
      toUnsubscribe.forEach((id) => delete newCounts[id]);
      return newCounts;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      subscribedActionsRef.current.clear();
    };
  }, []);

  return {
    actionCounts,
    isConnected,
    subscribeToAction,
    unsubscribeFromAction,
    subscribeToActions,
    unsubscribeFromActions,
  };
}

export function useActionCount(actionId: number): number | undefined {
  const { actionCounts, subscribeToAction, unsubscribeFromAction } =
    useActionWebSocket();

  useEffect(() => {
    if (actionId) {
      subscribeToAction(actionId);
      return () => unsubscribeFromAction(actionId);
    }
  }, [actionId, subscribeToAction, unsubscribeFromAction]);

  return actionCounts[actionId];
}

export function useActionCounts(actionIds: number[]): ActionCounts {
  const { actionCounts, subscribeToActions, unsubscribeFromActions } =
    useActionWebSocket();

  useEffect(() => {
    if (actionIds.length > 0) {
      subscribeToActions(actionIds);
      return () => unsubscribeFromActions(actionIds);
    }
  }, [actionIds, subscribeToActions, unsubscribeFromActions]);

  return actionCounts;
}
