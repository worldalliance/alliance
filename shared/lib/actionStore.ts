import {
  configureStore,
  createEntityAdapter,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import type { QueryClient } from "@tanstack/react-query";
import type { ActionDto } from "../client";
import {
  hasViewerCompletedAction,
  withOptimisticDismissal,
  withOptimisticRelation,
} from "./actionUtils";
import { mergeOwned, type Owned } from "./ownedFields";
import { queryKeys } from "./queryKeys";
import { currentSession, sessionLoads, sessionStore } from "./sessionStores";

export enum ActionSource {
  List = "list",
  Detail = "detail",
}

enum ActionFields {
  Detail = "detail",
}

const carries: Record<ActionSource, readonly ActionFields[]> = {
  [ActionSource.List]: [],
  [ActionSource.Detail]: [ActionFields.Detail],
};

// MEMBER_FEED_RELATIONS (member-actions.service.ts) omits these relations that
// findOneOrFail (actions.service.ts) loads, so list responses send them empty.
const actionFieldGroups: Record<ActionFields, readonly (keyof ActionDto)[]> = {
  [ActionFields.Detail]: [
    // BACKCOMPAT(member-feed-authors): the feed sends authors now; keeping this
    // entry only stops an installed client wiping them when it talks to a server
    // from before that change. Drop once no client can reach such a server.
    "authors",
    "project",
    "suite",
    "updates",
  ],
};

type ActionRecord = Owned<ActionDto, ActionFields>;
const adapter = createEntityAdapter({
  selectId: (record: ActionRecord) => record.value.id,
});
const slice = createSlice({
  name: "actions",
  initialState: adapter.getInitialState(),
  reducers: {
    received: (
      state,
      {
        payload,
      }: PayloadAction<{
        actions: ActionDto[];
        revision: number;
        source: ActionSource;
      }>,
    ) => {
      for (const action of payload.actions) {
        const current = state.entities[action.id];
        // Optional auth can return an anonymous payload after a token expires.
        if (current?.value.reqAuthenticated && !action.reqAuthenticated)
          continue;
        const merged = mergeOwned({
          current,
          incoming: action,
          revision: payload.revision,
          carries: carries[payload.source],
          groups: actionFieldGroups,
        });
        if (merged) adapter.setOne(state, merged);
      }
    },
    written: (state, { payload }: PayloadAction<ActionDto>) => {
      const current = state.entities[payload.id];
      if (current) current.value = payload;
    },
    cleared: () => adapter.getInitialState(),
  },
});

export type ActionState = ReturnType<typeof slice.reducer>;

function createActionStore(queryClient: QueryClient) {
  const store = configureStore({ reducer: slice.reducer });
  const loads = sessionLoads<ActionDto[]>({
    queryClient,
    queryKey: queryKeys.actions(),
  });

  const receive = (actions: ActionDto[], source: ActionSource) => {
    store.dispatch(
      slice.actions.received({
        actions,
        revision: loads.nextRevision(),
        source,
      }),
    );
    return actions.map(({ id }) => id);
  };

  const update = (params: {
    actionId: number;
    session: number;
    patch: (action: ActionDto) => ActionDto;
  }) => {
    if (params.session !== currentSession(queryClient)) return false;
    loads.write((actions) =>
      actions.map((action) =>
        action.id === params.actionId ? params.patch(action) : action,
      ),
    );
    const current = store.getState().entities[params.actionId]?.value;
    if (current) store.dispatch(slice.actions.written(params.patch(current)));
    return true;
  };

  return {
    subscribe: store.subscribe,
    getState: store.getState,
    get: (actionId: number) => store.getState().entities[actionId]?.value,
    receive,
    clear: () => void store.dispatch(slice.actions.cleared()),
    load: async ({
      source,
      ...load
    }: {
      source: ActionSource;
      signal: AbortSignal;
      fetch: () => Promise<ActionDto[]>;
    }) => {
      const { value: actions, revision } = await loads.load(load);
      store.dispatch(slice.actions.received({ actions, revision, source }));
      return actions.map(({ id }) => id);
    },
    recordRelation: ({
      relation,
      ...params
    }: {
      actionId: number;
      relation: "completed" | "declined";
      session: number;
    }) =>
      update({
        ...params,
        patch: (action) => {
          const completionDelta: Record<typeof relation, number> = {
            completed: Number(!hasViewerCompletedAction(action)),
            declined: 0,
          };
          return {
            ...withOptimisticRelation(action, relation),
            usersCompleted: action.usersCompleted + completionDelta[relation],
          };
        },
      }),
    recordDismissal: (params: { actionId: number; session: number }) =>
      update({ ...params, patch: withOptimisticDismissal }),
  };
}

export const actionStore = sessionStore(createActionStore);

export function selectAction(state: ActionState, actionId: number): ActionDto {
  const record = state.entities[actionId];
  if (!record)
    throw new Error(`Action ${actionId} is missing from the entity store`);
  return record.value;
}
