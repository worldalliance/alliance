import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  conversationGetCommunityConversations,
  conversationMarkRead,
  type ConversationDto,
} from "../client";
import { queryKeys } from "./queryKeys";

/** A group's chat. `storeConversation` and `markRead` drop a result for any
 * conversation other than the one cached for the group, such as one that lands
 * after the group changed. */
export function useCommunityConversation(communityId: number | null) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.communityConversation(communityId);

  const { data: conversation, isPending } = useQuery({
    queryKey,
    queryFn:
      communityId === null
        ? skipToken
        : () =>
            conversationGetCommunityConversations({
              path: { communityId },
              throwOnError: true,
            }).then((res) => res.data),
  });

  const storeConversation = async (updated: ConversationDto) => {
    if (
      queryClient.getQueryData<ConversationDto>(queryKey)?.id !== updated.id
    ) {
      return;
    }
    // A refetch in flight would land an older copy over the update.
    await queryClient.cancelQueries({ queryKey });
    queryClient.setQueryData(queryKey, updated);
  };

  const { mutate: markRead } = useMutation({
    mutationFn: (conversationId: number) =>
      conversationMarkRead({
        path: { conversationId },
        throwOnError: true,
      }).then((res) => res.data),
    onSuccess: storeConversation,
  });

  return { conversation, isPending, storeConversation, markRead };
}
