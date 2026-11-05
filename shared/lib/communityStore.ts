import {
  configureStore,
  createEntityAdapter,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { type QueryClient, type QueryKey } from "@tanstack/react-query";
import type { CommunityDto } from "../client";
import { queryKeys } from "./queryKeys";
import { currentSession, sessionLoads, sessionStore } from "./sessionStores";
import { useEntityList } from "./useEntityList";

type CommunityRecord = { value: CommunityDto; revision: number };

const adapter = createEntityAdapter({
  selectId: (record: CommunityRecord) => record.value.id,
});

const slice = createSlice({
  name: "communities",
  initialState: adapter.getInitialState(),
  reducers: {
    received: (
      state,
      {
        payload,
      }: PayloadAction<{ communities: CommunityDto[]; revision: number }>,
    ) => {
      for (const value of payload.communities) {
        const current = state.entities[value.id];
        if (!current || payload.revision > current.revision)
          adapter.setOne(state, { value, revision: payload.revision });
      }
    },
    cleared: () => adapter.getInitialState(),
  },
});

export type CommunityState = ReturnType<typeof slice.reducer>;

function createCommunityStore(queryClient: QueryClient) {
  const store = configureStore({ reducer: slice.reducer });
  const loads = sessionLoads<CommunityDto[]>({
    queryClient,
    queryKey: queryKeys.communitiesAll(),
  });
  const isCurrent = (session: number) =>
    session === currentSession(queryClient);
  const outrankLoads = (community: CommunityDto) =>
    store.dispatch(
      slice.actions.received({
        communities: [community],
        revision: loads.nextRevision(),
      }),
    );
  const drop = (params: {
    session: number;
    communityId: number;
    queryKey: readonly unknown[];
  }) => {
    if (!isCurrent(params.session)) return;
    queryClient.setQueriesData<number[]>({ queryKey: params.queryKey }, (ids) =>
      ids?.filter((id) => id !== params.communityId),
    );
  };

  return {
    subscribe: store.subscribe,
    getState: store.getState,
    clear: () => store.dispatch(slice.actions.cleared()),
    load: async (load: {
      signal: AbortSignal;
      fetch: () => Promise<CommunityDto[]>;
    }): Promise<CommunityDto[]> => {
      const { value, revision } = await loads.load(load);
      store.dispatch(slice.actions.received({ communities: value, revision }));
      return value;
    },
    /** A community the server returned from a write; it outranks loads
     * already in flight, which may have read it before the write. */
    saved: (params: { session: number; community: CommunityDto }) => {
      if (isCurrent(params.session)) outrankLoads(params.community);
    },
    created: (params: { session: number; community: CommunityDto }) => {
      if (!isCurrent(params.session)) return;
      const { id } = params.community;
      outrankLoads(params.community);
      queryClient.setQueryData<number[]>(
        queryKeys.myCommunities(),
        (ids = []) => (ids.includes(id) ? ids : [...ids, id]),
      );
    },
    left: (params: { session: number; communityId: number }) =>
      drop({ ...params, queryKey: queryKeys.myCommunities() }),
    deleted: (params: { session: number; communityId: number }) =>
      drop({ ...params, queryKey: queryKeys.communitiesAll() }),
  };
}

export const communityStore = sessionStore(createCommunityStore);

export function selectCommunity(
  state: CommunityState,
  communityId: number,
): CommunityDto {
  const record = state.entities[communityId];
  if (!record)
    throw new Error(
      `Community ${communityId} is missing from the entity store`,
    );
  return record.value;
}

export function useCommunityList(params: {
  queryKey: QueryKey;
  fetch: (signal: AbortSignal) => Promise<CommunityDto[]>;
  enabled: boolean;
}) {
  const { fetch, ...options } = params;
  return useEntityList({
    ...options,
    store: communityStore,
    select: selectCommunity,
    load: ({ store, signal }) =>
      store.load({ signal, fetch: () => fetch(signal) }),
  });
}
