import {
  configureStore,
  createEntityAdapter,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { CancelledError, type QueryClient } from "@tanstack/react-query";
import { pick } from "es-toolkit";
import type { ActionDto } from "../client";
import {
  hasViewerCompletedAction,
  withOptimisticDismissal,
  withOptimisticRelation,
} from "./actionUtils";
import { queryKeys } from "./queryKeys";
import { writesDuringLoads } from "./writesDuringLoads";

export enum ActionSource {
  List = "list",
  Detail = "detail",
}

const carriesDetailFields: Record<ActionSource, boolean> = {
  [ActionSource.List]: false,
  [ActionSource.Detail]: true,
};

// MEMBER_FEED_RELATIONS (member-actions.service.ts) omits these relations that
// findOneOrFail (actions.service.ts) loads, so list responses send them empty.
const detailOnlyFields = [
  "authors",
  "project",
  "suite",
  "updates",
] as const satisfies (keyof ActionDto)[];

type ActionRecord = {
  id: number;
  action: ActionDto;
  revision: number;
  detailRevision?: number;
};
const adapter = createEntityAdapter<ActionRecord>();
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
      const fromDetail = carriesDetailFields[payload.source];
      for (const action of payload.actions) {
        const current = state.entities[action.id];
        // Optional auth can return an anonymous payload after a token expires.
        if (current?.action.reqAuthenticated && !action.reqAuthenticated)
          continue;
        const newer = payload.revision > (current?.revision ?? 0);
        const newerDetail =
          fromDetail && payload.revision > (current?.detailRevision ?? 0);
        if (!newer && !newerDetail) continue;
        const latest = !current || newer ? action : current.action;
        const details = !current || newerDetail ? action : current.action;
        adapter.setOne(state, {
          id: action.id,
          action:
            details === latest
              ? latest
              : { ...latest, ...pick(details, detailOnlyFields) },
          revision: newer ? payload.revision : (current?.revision ?? 0),
          detailRevision: newerDetail
            ? payload.revision
            : current?.detailRevision,
        });
      }
    },
    cleared: () => adapter.getInitialState(),
  },
});

export type ActionState = ReturnType<typeof slice.reducer>;
const loads = writesDuringLoads<ActionDto[]>();

function createActionStore(queryClient: QueryClient) {
  const store = configureStore({ reducer: slice.reducer });
  let revision = 0;
  let session = 0;

  const receive = (actions: ActionDto[], source: ActionSource) => {
    store.dispatch(
      slice.actions.received({ actions, revision: ++revision, source }),
    );
    return actions.map(({ id }) => id);
  };

  const update = (params: {
    actionId: number;
    session: number;
    patch: (action: ActionDto) => ActionDto;
  }) => {
    if (params.session !== session) return false;
    loads.record({
      queryClient,
      queryKey: queryKeys.actions(),
      update: (actions) =>
        actions.map((action) =>
          action.id === params.actionId ? params.patch(action) : action,
        ),
    });
    const current = store.getState().entities[params.actionId]?.action;
    if (current) receive([params.patch(current)], ActionSource.List);
    return true;
  };

  return {
    subscribe: store.subscribe,
    getState: store.getState,
    getSession: () => session,
    get: (actionId: number) => store.getState().entities[actionId]?.action,
    receive,
    clear: () => {
      session++;
      store.dispatch(slice.actions.cleared());
    },
    load: async (params: {
      source: ActionSource;
      signal: AbortSignal;
      fetch: () => Promise<ActionDto[]>;
    }) => {
      const started = ++revision;
      const requestedSession = session;
      const actions = await loads.load({
        queryClient,
        queryKey: queryKeys.actions(),
        fetch: params.fetch,
      });
      if (params.signal.aborted || session !== requestedSession) {
        throw new CancelledError();
      }
      store.dispatch(
        slice.actions.received({
          actions,
          revision: started,
          source: params.source,
        }),
      );
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

const stores = new WeakMap<QueryClient, ReturnType<typeof createActionStore>>();

export function actionStore(queryClient: QueryClient) {
  let store = stores.get(queryClient);
  if (!store) {
    store = createActionStore(queryClient);
    stores.set(queryClient, store);
  }
  return store;
}

export function selectAction(state: ActionState, actionId: number): ActionDto {
  const record = state.entities[actionId];
  if (!record)
    throw new Error(`Action ${actionId} is missing from the entity store`);
  return record.action;
}
