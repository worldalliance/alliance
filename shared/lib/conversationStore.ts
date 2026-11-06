import {
  configureStore,
  createEntityAdapter,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import type { QueryClient } from "@tanstack/react-query";
import type { ConversationDto, MessageDto } from "../client";
import { queryKeys } from "./queryKeys";
import { currentSession, sessionLoads, sessionStore } from "./sessionStores";

/** Membership writes apply only to a load of the viewer's whole list, not
 * to a group's chat. */
export type ConversationLoad = {
  conversations: ConversationDto[];
  isViewerList: boolean;
};

type ConversationRecord = { value: ConversationDto; revision: number };

const adapter = createEntityAdapter({
  selectId: (record: ConversationRecord) => record.value.id,
});

const slice = createSlice({
  name: "conversations",
  initialState: adapter.getInitialState(),
  reducers: {
    received: (
      state,
      {
        payload,
      }: PayloadAction<{ conversations: ConversationDto[]; revision: number }>,
    ) => {
      for (const value of payload.conversations) {
        const current = state.entities[value.id];
        if (!current || payload.revision > current.revision)
          adapter.setOne(state, { value, revision: payload.revision });
      }
    },
    written: (state, { payload }: PayloadAction<ConversationDto>) => {
      const current = state.entities[payload.id];
      if (current) current.value = payload;
    },
    cleared: () => adapter.getInitialState(),
  },
});

export type ConversationState = ReturnType<typeof slice.reducer>;

function createConversationStore(queryClient: QueryClient) {
  const store = configureStore({ reducer: slice.reducer });
  const loads = sessionLoads<ConversationLoad>({
    queryClient,
    queryKey: queryKeys.conversationsAll(),
  });
  const isCurrent = (session: number) =>
    session === currentSession(queryClient);
  const outrankLoads = (conversation: ConversationDto) =>
    store.dispatch(
      slice.actions.received({
        conversations: [conversation],
        revision: loads.nextRevision(),
      }),
    );
  // Keeps the record's revision, so a load that read newer fields still
  // replaces it.
  const patch = (params: {
    id: number;
    update: (conversation: ConversationDto) => ConversationDto;
  }) => {
    const { id, update } = params;
    const patched = (conversation: ConversationDto) =>
      conversation.id === id ? update(conversation) : conversation;
    loads.write((load) => ({
      ...load,
      conversations: load.conversations.map(patched),
    }));
    const current = store.getState().entities[id];
    if (current) store.dispatch(slice.actions.written(update(current.value)));
  };
  const writeViewerList = (
    update: (conversations: ConversationDto[]) => ConversationDto[],
  ) =>
    loads.write((load) =>
      load.isViewerList
        ? { ...load, conversations: update(load.conversations) }
        : load,
    );

  return {
    subscribe: store.subscribe,
    getState: store.getState,
    clear: () => store.dispatch(slice.actions.cleared()),
    load: async (load: {
      signal: AbortSignal;
      fetch: () => Promise<ConversationLoad>;
    }): Promise<ConversationDto[]> => {
      const { value, revision } = await loads.load(load);
      store.dispatch(
        slice.actions.received({
          conversations: value.conversations,
          revision,
        }),
      );
      return value.conversations;
    },
    /** A conversation the server sent after a write or over a socket; it
     * outranks loads already in flight, which may have read it before. */
    saved: (params: { session: number; conversation: ConversationDto }) => {
      if (isCurrent(params.session)) outrankLoads(params.conversation);
    },
    /** Takes only the read state from a mark-read response, which the
     * server may have built before a newer message or rename the store or a
     * load in flight holds. */
    read: (params: { session: number; conversation: ConversationDto }) => {
      if (!isCurrent(params.session)) return;
      const { id, unreadCount, hasUnread } = params.conversation;
      patch({
        id,
        update: (conversation) => ({ ...conversation, unreadCount, hasUnread }),
      });
    },
    /** Saves a conversation and adds it to the viewer's list. */
    listed: (params: { session: number; conversation: ConversationDto }) => {
      if (!isCurrent(params.session)) return;
      const { conversation } = params;
      outrankLoads(conversation);
      writeViewerList((conversations) =>
        conversations.some(({ id }) => id === conversation.id)
          ? conversations
          : [...conversations, conversation],
      );
      queryClient.setQueryData<number[]>(queryKeys.myConversations(), (ids) =>
        ids && !ids.includes(conversation.id) ? [...ids, conversation.id] : ids,
      );
    },
    dropped: (params: { session: number; conversationId: number }) => {
      if (!isCurrent(params.session)) return;
      writeViewerList((conversations) =>
        conversations.filter(({ id }) => id !== params.conversationId),
      );
      queryClient.setQueryData<number[]>(queryKeys.myConversations(), (ids) =>
        ids?.filter((id) => id !== params.conversationId),
      );
    },
    messageReceived: (params: { session: number; message: MessageDto }) => {
      if (!isCurrent(params.session)) return;
      const { message } = params;
      patch({
        id: message.conversationId,
        update: (conversation) => ({ ...conversation, lastMessage: message }),
      });
    },
  };
}

export const conversationStore = sessionStore(createConversationStore);

export function selectConversation(
  state: ConversationState,
  conversationId: number,
): ConversationDto {
  const record = state.entities[conversationId];
  if (!record)
    throw new Error(
      `Conversation ${conversationId} is missing from the entity store`,
    );
  return record.value;
}
