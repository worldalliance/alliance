import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { getApiUrl } from "../config";

interface DatabaseEvent {
  tableName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entity?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entityId?: any;
}

export const useAdminWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState<string | null>(
    null
  );
  const socketRef = useRef<Socket | null>(null);
  const eventHandlersRef = useRef<{
    onRowInserted?: (event: DatabaseEvent) => void;
    onRowUpdated?: (event: DatabaseEvent) => void;
    onRowDeleted?: (event: DatabaseEvent) => void;
  }>({});

  useEffect(() => {
    // Initialize WebSocket connection only once
    const socket = io(getApiUrl() + "/admin-viewer", {
      withCredentials: true,
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Admin WebSocket connected");
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("Admin WebSocket disconnected");
      setIsConnected(false);
      setCurrentSubscription(null);
    });

    socket.on("row-inserted", (data: DatabaseEvent) => {
      console.log("Row inserted:", data);
      eventHandlersRef.current.onRowInserted?.(data);
    });

    socket.on("row-updated", (data: DatabaseEvent) => {
      console.log("Row updated:", data);
      eventHandlersRef.current.onRowUpdated?.(data);
    });

    socket.on("row-deleted", (data: DatabaseEvent) => {
      console.log("Row deleted:", data);
      eventHandlersRef.current.onRowDeleted?.(data);
    });

    return () => {
      console.log("Cleaning up WebSocket connection");
      socket.disconnect();
    };
  }, []); // No dependencies - only connect once

  const subscribeToTable = useCallback(
    (tableName: string) => {
      if (!socketRef.current || !isConnected) {
        return; // Silently fail when not connected to avoid console spam
      }

      if (currentSubscription === tableName) {
        return; // Already subscribed
      }

      // Subscribe to new table
      socketRef.current.emit("subscribe-table", { tableName });
      setCurrentSubscription(tableName);
      console.log(`Subscribed to table: ${tableName}`);
    },
    [isConnected, currentSubscription]
  );

  const unsubscribeFromTable = useCallback(
    (tableName: string) => {
      if (!socketRef.current) {
        return;
      }

      socketRef.current.emit("unsubscribe-table", { tableName });

      if (currentSubscription === tableName) {
        setCurrentSubscription(null);
      }

      console.log(`Unsubscribed from table: ${tableName}`);
    },
    [currentSubscription]
  );

  const setEventHandlers = useCallback(
    (handlers: {
      onRowInserted?: (event: DatabaseEvent) => void;
      onRowUpdated?: (event: DatabaseEvent) => void;
      onRowDeleted?: (event: DatabaseEvent) => void;
    }) => {
      eventHandlersRef.current = handlers;
    },
    []
  );

  return {
    isConnected,
    currentSubscription,
    subscribeToTable,
    unsubscribeFromTable,
    setEventHandlers,
  };
};
