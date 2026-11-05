import {
  configureStore,
  createEntityAdapter,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import type { QueryClient } from "@tanstack/react-query";
import type { PostDto } from "../client";
import { mergeOwned, type Owned } from "./ownedFields";
import { queryKeys } from "./queryKeys";
import { likeTurns } from "./sendLike";
import { currentSession, sessionLoads, sessionStore } from "./sessionStores";

/** Fields only the forum index sends; other responses leave them undefined. */
export enum PostFields {
  Thread = "thread",
}

const postFieldGroups: Record<PostFields, readonly (keyof PostDto)[]> = {
  [PostFields.Thread]: ["commentCount", "lastComment"],
};

type PostRecord = Owned<PostDto, PostFields>;

const adapter = createEntityAdapter({
  selectId: (record: PostRecord) => record.value.id,
});

const slice = createSlice({
  name: "forumPosts",
  initialState: adapter.getInitialState(),
  reducers: {
    received: (
      state,
      {
        payload,
      }: PayloadAction<{
        posts: PostDto[];
        revision: number;
        carries: readonly PostFields[];
      }>,
    ) => {
      for (const post of payload.posts) {
        const merged = mergeOwned({
          current: state.entities[post.id],
          incoming: post,
          revision: payload.revision,
          carries: payload.carries,
          groups: postFieldGroups,
        });
        if (merged) adapter.setOne(state, merged);
      }
    },
    written: (state, { payload }: PayloadAction<PostDto[]>) => {
      for (const post of payload) {
        const current = state.entities[post.id];
        if (current) current.value = post;
      }
    },
    removed: (state, { payload }: PayloadAction<number>) => {
      adapter.removeOne(state, payload);
    },
    cleared: () => adapter.getInitialState(),
  },
});

export type ForumPostState = ReturnType<typeof slice.reducer>;

/** Returns the changed post, or undefined to leave it as it is. */
export type PostChange = (post: PostDto) => PostDto | undefined;

function createForumPostStore(queryClient: QueryClient) {
  const store = configureStore({ reducer: slice.reducer });
  const loads = sessionLoads<PostDto[]>({
    queryClient,
    queryKey: queryKeys.forumPostsAll(),
  });
  const turns = likeTurns();
  const isCurrent = (session: number) =>
    session === currentSession(queryClient);

  return {
    subscribe: store.subscribe,
    getState: store.getState,
    getPost: (postId: number) => store.getState().entities[postId]?.value,
    clear: () => {
      turns.reset();
      store.dispatch(slice.actions.cleared());
    },
    load: async (load: {
      carries: readonly PostFields[];
      signal: AbortSignal;
      fetch: () => Promise<PostDto[]>;
    }): Promise<PostDto[]> => {
      const { value, revision } = await loads.load(load);
      store.dispatch(
        slice.actions.received({
          posts: value,
          revision,
          carries: load.carries,
        }),
      );
      return value;
    },
    /** A post the server returned from a write; it outranks loads already in
     * flight, which may have read the post before the write. */
    saved: (params: { session: number; post: PostDto }) => {
      if (!isCurrent(params.session)) return;
      store.dispatch(
        slice.actions.received({
          posts: [params.post],
          revision: loads.nextRevision(),
          carries: [],
        }),
      );
    },
    /** Drops a deleted post from every cached list and detail, loads in
     * flight, and then the store, since `selectPost` throws on an id a cached
     * query holds and the store lacks. */
    removed: (params: { session: number; postId: number }) => {
      const { session, postId } = params;
      if (!isCurrent(session)) return;
      queryClient.setQueriesData<number[]>(
        { queryKey: queryKeys.forumPostListsAll() },
        (ids) => ids?.filter((id) => id !== postId),
      );
      queryClient.setQueriesData<number | null>(
        { queryKey: queryKeys.forumPostDetailsAll() },
        (id) => (id === postId ? null : id),
      );
      loads.write((posts) => posts.filter(({ id }) => id !== postId));
      store.dispatch(slice.actions.removed(postId));
    },
    /** Patches loaded posts and loads in flight; does nothing once `session`
     * has ended. A write with a `confirmation` must be idempotent (see
     * `sessionLoads`). */
    write: (params: {
      session: number;
      change: PostChange;
      confirmation?: Promise<unknown>;
    }) => {
      if (!isCurrent(params.session)) return;
      const { change } = params;
      loads.write(
        (posts) => posts.map((post) => change(post) ?? post),
        params.confirmation,
      );
      const changed = adapter
        .getSelectors()
        .selectAll(store.getState())
        .flatMap((record) => change(record.value) ?? []);
      store.dispatch(slice.actions.written(changed));
    },
    takeTurn: turns.take,
  };
}

export const forumPostStore = sessionStore(createForumPostStore);

export function selectPost(state: ForumPostState, postId: number): PostDto {
  const record = state.entities[postId];
  if (!record)
    throw new Error(`Post ${postId} is missing from the entity store`);
  return record.value;
}
