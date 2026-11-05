import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { conversationGetCommunityConversations } from "../client";
import { conversationStore, selectConversation } from "./conversationStore";
import { queryKeys } from "./queryKeys";
import { useMyConversations } from "./useMyConversations";
import { useStoreState } from "./useStoreState";

/** A group's chat, read from the same record as the viewer's list. */
export function useCommunityConversation(communityId: number | null) {
  const store = conversationStore(useQueryClient());
  const state = useStoreState(conversationStore);
  const select = useCallback(
    (id: number) => selectConversation(state, id),
    [state],
  );
  const { data: conversation, isPending } = useQuery({
    queryKey: queryKeys.communityConversation(communityId),
    queryFn:
      communityId === null
        ? skipToken
        : async ({ signal }) => {
            const [loaded] = await store.load({
              signal,
              fetch: () =>
                conversationGetCommunityConversations({
                  path: { communityId },
                  throwOnError: true,
                  signal,
                }).then(({ data }) => ({
                  conversations: [data],
                  isViewerList: false,
                })),
            });
            return loaded.id;
          },
    select,
  });
  const { storeConversation, markRead } = useMyConversations({ load: false });

  return { conversation, isPending, storeConversation, markRead };
}
