import {
  configureStore,
  createEntityAdapter,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import type { QueryClient } from "@tanstack/react-query";
import type { ActionActivityDto, HomeFeedForumCommentDto } from "../client";
import {
  actionActivityDtoIsVisibleInFeed,
  type FeedActionActivityDto,
} from "./actionActivity";
import { mergeOwned, type Owned } from "./ownedFields";
import { queryKeys } from "./queryKeys";
import { likeTurns } from "./sendLike";
import { currentSession, sessionLoads, sessionStore } from "./sessionStores";

/** Fields only some activity responses send; one that leaves a group out
 * sends placeholders for it. */
export enum ActivityFields {
  Comments = "comments",
  Output = "output",
}

const activityFieldGroups: Record<
  ActivityFields,
  readonly (keyof ActionActivityDto)[]
> = {
  [ActivityFields.Comments]: ["comments"],
  [ActivityFields.Output]: ["formResponseOutput"],
};

/** Home and profile feeds interleave forum comments with activities. */
export type ActivityLoad = {
  activities: ActionActivityDto[];
  forumComments: HomeFeedForumCommentDto[];
};

type ActivityRecord = Owned<ActionActivityDto, ActivityFields>;
type ForumCommentRecord = {
  forumComment: HomeFeedForumCommentDto;
  revision: number;
};

const activityAdapter = createEntityAdapter({
  selectId: (record: ActivityRecord) => record.value.id,
});
const forumCommentAdapter = createEntityAdapter({
  selectId: (record: ForumCommentRecord) => record.forumComment.comment.id,
});
const initialState = () => ({
  activities: activityAdapter.getInitialState(),
  forumComments: forumCommentAdapter.getInitialState(),
});

const slice = createSlice({
  name: "activities",
  initialState,
  reducers: {
    received: (
      state,
      {
        payload,
      }: PayloadAction<
        ActivityLoad & { revision: number; carries: readonly ActivityFields[] }
      >,
    ) => {
      for (const activity of payload.activities) {
        const merged = mergeOwned({
          current: state.activities.entities[activity.id],
          incoming: activity,
          revision: payload.revision,
          carries: payload.carries,
          groups: activityFieldGroups,
        });
        if (merged) activityAdapter.setOne(state.activities, merged);
      }
      for (const forumComment of payload.forumComments) {
        const current = state.forumComments.entities[forumComment.comment.id];
        if (payload.revision > (current?.revision ?? 0))
          forumCommentAdapter.setOne(state.forumComments, {
            forumComment,
            revision: payload.revision,
          });
      }
    },
    written: (state, { payload }: PayloadAction<ActivityLoad>) => {
      for (const activity of payload.activities) {
        const current = state.activities.entities[activity.id];
        if (current) current.value = activity;
      }
      for (const forumComment of payload.forumComments) {
        const current = state.forumComments.entities[forumComment.comment.id];
        if (current) current.forumComment = forumComment;
      }
    },
    cleared: initialState,
  },
});

export type ActivityState = ReturnType<typeof slice.reducer>;

/** Returns the changed record, or undefined to leave it as it is. */
export type ActivityChange = {
  activity?: (activity: ActionActivityDto) => ActionActivityDto | undefined;
  forumComment?: (
    forumComment: HomeFeedForumCommentDto,
  ) => HomeFeedForumCommentDto | undefined;
};

const applyChange = (change: ActivityChange, load: ActivityLoad) => ({
  activities: load.activities.flatMap(
    (activity) => change.activity?.(activity) ?? [],
  ),
  forumComments: load.forumComments.flatMap(
    (forumComment) => change.forumComment?.(forumComment) ?? [],
  ),
});

function createActivityStore(queryClient: QueryClient) {
  const store = configureStore({ reducer: slice.reducer });
  const loads = sessionLoads<ActivityLoad>({
    queryClient,
    queryKey: queryKeys.activitiesAll(),
  });
  const turns = likeTurns();

  const all = (): ActivityLoad => {
    const { activities, forumComments } = store.getState();
    return {
      activities: activityAdapter
        .getSelectors()
        .selectAll(activities)
        .map((record) => record.value),
      forumComments: forumCommentAdapter
        .getSelectors()
        .selectAll(forumComments)
        .map((record) => record.forumComment),
    };
  };

  return {
    subscribe: store.subscribe,
    getState: store.getState,
    getActivity: (activityId: number) =>
      store.getState().activities.entities[activityId]?.value,
    getForumComment: (commentId: number) =>
      store.getState().forumComments.entities[commentId]?.forumComment,
    clear: () => {
      turns.reset();
      store.dispatch(slice.actions.cleared());
    },
    load: async (load: {
      carries: readonly ActivityFields[];
      signal: AbortSignal;
      fetch: () => Promise<ActivityLoad>;
    }): Promise<ActivityLoad> => {
      const { value, revision } = await loads.load(load);
      store.dispatch(
        slice.actions.received({ ...value, revision, carries: load.carries }),
      );
      return value;
    },
    /** Patches loaded records and loads in flight; does nothing once
     * `session` has ended. A write with a `confirmation` must be idempotent
     * (see `sessionLoads`). */
    write: (params: {
      session: number;
      change: ActivityChange;
      confirmation?: Promise<unknown>;
    }) => {
      if (params.session !== currentSession(queryClient)) return;
      const { change } = params;
      loads.write(
        (load) => ({
          activities: load.activities.map(
            (activity) => change.activity?.(activity) ?? activity,
          ),
          forumComments: load.forumComments.map(
            (forumComment) =>
              change.forumComment?.(forumComment) ?? forumComment,
          ),
        }),
        params.confirmation,
      );
      store.dispatch(slice.actions.written(applyChange(change, all())));
    },
    takeTurn: turns.take,
  };
}

export const activityStore = sessionStore(createActivityStore);

export function selectActivity(
  state: ActivityState,
  activityId: number,
): ActionActivityDto {
  const record = state.activities.entities[activityId];
  if (!record)
    throw new Error(`Activity ${activityId} is missing from the entity store`);
  return record.value;
}

export function selectForumComment(
  state: ActivityState,
  commentId: number,
): HomeFeedForumCommentDto {
  const record = state.forumComments.entities[commentId];
  if (!record)
    throw new Error(
      `Forum comment ${commentId} is missing from the entity store`,
    );
  return record.forumComment;
}

export function selectFeedActivity(
  state: ActivityState,
  activityId: number,
): FeedActionActivityDto {
  const activity = selectActivity(state, activityId);
  if (!actionActivityDtoIsVisibleInFeed(activity))
    throw new Error(`Activity ${activityId} is not a feed activity`);
  return activity;
}
