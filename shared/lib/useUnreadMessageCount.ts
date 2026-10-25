import {
  type QueryClient,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { conversationGetUnreadSummary } from "../client";
import {
  connectMessagingSocket,
  type MessagingConnectionConfig,
} from "./messagingSocket";
import { queryKeys } from "./queryKeys";

export function refreshUnreadMessageCount(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.conversationUnreadSummary(),
  });
}

/** How many unread messages and message requests the viewer has, refetched
 * on the overview socket's `conversation:unread`. */
export function useUnreadMessageCount(config: MessagingConnectionConfig) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: queryKeys.conversationUnreadSummary(),
    queryFn: () =>
      conversationGetUnreadSummary({ throwOnError: true }).then(
        ({ data }) => data.totalCount,
        (error: unknown) => {
          console.error("Failed to load unread messages count", error);
          throw error;
        },
      ),
  });

  useEffect(() => {
    const { socket, close } = connectMessagingSocket(
      "/messaging/overview",
      config,
    );
    socket.on("conversation:unread", () => {
      void refreshUnreadMessageCount(queryClient);
    });
    socket.on("messaging:error", (error) => {
      console.error("Messaging overview socket error", error);
    });
    return close;
  }, [config, queryClient]);

  return data ?? 0;
}
