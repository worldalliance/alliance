import type { QueryClient } from "@tanstack/react-query";
import type { ConversationDto } from "../../client";
import { conversationStore } from "../conversationStore";
import { queryKeys } from "../queryKeys";
import { currentSession } from "../sessionStores";

export function seedConversations(
  client: QueryClient,
  conversations: ConversationDto[],
) {
  const session = currentSession(client);
  for (const conversation of conversations)
    conversationStore(client).saved({ session, conversation });
  client.setQueryData(
    queryKeys.myConversations(),
    conversations.map(({ id }) => id),
  );
}
