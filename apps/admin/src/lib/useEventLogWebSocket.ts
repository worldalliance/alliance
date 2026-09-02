import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { getWebSocketUrl } from "./config";

export interface EventLogWsEvent {
  id: string;
  event: string;
  message: string;
  blob?: Record<string, unknown>;
  createdAt: string;
  userId?: number;
  user?: {
    id: number;
    displayName: string;
  };
}

export const useEventLogWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const onNewEventRef = useRef<((event: EventLogWsEvent) => void) | null>(null);
  const onInviteCreatedRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const socket = io(getWebSocketUrl() + "/event-log", {
      withCredentials: true,
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("EventLog WebSocket connected");
      setIsConnected(true);
      socket.emit("subscribe-event-log");
    });

    socket.on("disconnect", () => {
      console.log("EventLog WebSocket disconnected");
      setIsConnected(false);
    });

    socket.on("event-log-new", (data: EventLogWsEvent) => {
      onNewEventRef.current?.(data);
    });

    socket.on("onetime-invite-created", () => {
      onInviteCreatedRef.current?.();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const setOnNewEvent = useCallback(
    (handler: ((event: EventLogWsEvent) => void) | null) => {
      onNewEventRef.current = handler;
    },
    [],
  );

  const setOnInviteCreated = useCallback((handler: (() => void) | null) => {
    onInviteCreatedRef.current = handler;
  }, []);

  return {
    isConnected,
    setOnNewEvent,
    setOnInviteCreated,
  };
};
