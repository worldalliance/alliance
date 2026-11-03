import {
  actionFeedCommunityActivity,
  actionFeedFindCompletedForUser,
  actionFeedFriendActivity,
  actionFeedFriendActivityForAction,
  actionFeedGetActionActivities,
  actionFeedGetActivity,
  actionFeedGetActivityFeed,
} from "@alliance/shared/client";
import {
  type InfiniteData,
  type QueryClient,
  skipToken,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import {
  actionActivityDtoIsVisibleInFeed,
  type FeedActionActivityDto,
} from "./actionActivity";
import {
  ActivityFields,
  activityStore,
  selectActivity,
  selectFeedActivity,
} from "./activityStore";
import { queryKeys } from "./queryKeys";
import { useLikeActivity } from "./useFeedLikes";
import { useStoreState } from "./useStoreState";

export enum ActivityList {
  Friends = "friends",
  FriendsForAction = "friendsForAction",
  User = "user",
  Action = "action",
  Global = "global",
  Community = "community",
}

export type UseActivitiesProps = {
  comments?: boolean;
} & (
  | {
      list:
        | ActivityList.User
        | ActivityList.Action
        | ActivityList.Community
        | ActivityList.FriendsForAction;
      objectId: number;
      limit?: number;
    }
  | {
      list: ActivityList.Global | ActivityList.Friends;
      objectId?: never;
      limit?: number;
    }
);

const DEFAULT_LIMIT = 50;

const activitiesKey = (props: UseActivitiesProps) =>
  queryKeys.activities({ ...props, limit: props.limit ?? DEFAULT_LIMIT });

const supportsCursor = (list: ActivityList) =>
  list === ActivityList.Global ||
  list === ActivityList.Friends ||
  list === ActivityList.Community ||
  list === ActivityList.Action;

const fetchActivities = async (params: {
  props: UseActivitiesProps;
  signal: AbortSignal;
  before?: string;
}) => {
  const {
    list,
    objectId,
    limit = DEFAULT_LIMIT,
    comments = false,
  } = params.props;
  const before = params.before ?? new Date().toISOString();
  const options = { signal: params.signal } as const;

  switch (list) {
    case ActivityList.Friends:
      return actionFeedFriendActivity({
        ...options,
        query: { comments, limit: limit.toString(), before },
      });
    case ActivityList.User:
      return actionFeedFindCompletedForUser({
        ...options,
        path: { id: objectId },
        query: { comments },
      });
    case ActivityList.Action:
      return actionFeedGetActionActivities({
        ...options,
        path: { id: objectId },
        query: { limit, comments, before },
      });
    case ActivityList.FriendsForAction:
      return actionFeedFriendActivityForAction({
        ...options,
        path: { actionId: objectId },
        query: { comments, limit: limit.toString() },
      });
    case ActivityList.Community:
      return actionFeedCommunityActivity({
        ...options,
        query: {
          limit: limit.toString(),
          before,
          comments,
          communityId: objectId,
        },
      });
    case ActivityList.Global:
      return actionFeedGetActivityFeed({
        ...options,
        query: { limit: limit.toString(), before, comments },
      });
    default:
      throw new Error(`unknown activity list: ${list satisfies never}`);
  }
};

type ActivityPage = {
  activityIds: number[];
  /** Counted before client-side filtering, so filtering can't end pagination early. */
  serverCount: number;
  cursor: string | undefined;
};

const listCarries = (comments: boolean): ActivityFields[] =>
  comments ? [ActivityFields.Comments, ActivityFields.Output] : [];

const fetchActivityPage = async (params: {
  props: UseActivitiesProps;
  queryClient: QueryClient;
  signal: AbortSignal;
  before?: string;
}): Promise<ActivityPage> => {
  const { props, queryClient, signal, before } = params;
  const { activities } = await activityStore(queryClient).load({
    carries: listCarries(props.comments ?? false),
    signal,
    fetch: () =>
      fetchActivities({ props, signal, before }).then((response) => ({
        activities: response.data ?? [],
        forumComments: [],
      })),
  });
  const visible = activities
    .filter(actionActivityDtoIsVisibleInFeed)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  return {
    activityIds: visible.map(({ id }) => id),
    serverCount: activities.length,
    cursor: visible.at(-1)?.createdAt,
  };
};

export const useRefreshActivities = () => {
  const queryClient = useQueryClient();
  return useCallback(
    (props: UseActivitiesProps) =>
      queryClient.invalidateQueries({ queryKey: activitiesKey(props) }),
    [queryClient],
  );
};

export const useActivity = (activityId: number) => {
  const queryClient = useQueryClient();
  const store = activityStore(queryClient);
  const state = useStoreState(activityStore);
  const select = useCallback(
    (id: number) => selectActivity(state, id),
    [state],
  );
  return useQuery({
    queryKey: queryKeys.activity(activityId),
    queryFn: activityId
      ? async ({ signal }) => {
          await store.load({
            carries: [ActivityFields.Output],
            signal,
            fetch: () =>
              actionFeedGetActivity({
                path: { id: activityId },
                throwOnError: true,
                signal,
              }).then((response) => ({
                activities: [response.data],
                forumComments: [],
              })),
          });
          return activityId;
        }
      : skipToken,
    // A record a list already loaded shows while its own request is out.
    placeholderData: () =>
      store.getActivity(activityId) ? activityId : undefined,
    select,
  });
};

const useActivities = (props: UseActivitiesProps) => {
  const queryClient = useQueryClient();
  const refreshActivities = useRefreshActivities();
  const state = useStoreState(activityStore);
  const infinite = supportsCursor(props.list);
  const limit = props.limit ?? DEFAULT_LIMIT;

  const select = useCallback(
    (data: InfiniteData<ActivityPage>) =>
      data.pages.flatMap((page) =>
        page.activityIds.map((id) => selectFeedActivity(state, id)),
      ),
    [state],
  );

  const {
    data: activities = NO_ACTIVITIES,
    isLoading: loading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: activitiesKey(props),
    queryFn: ({ pageParam, signal }) =>
      fetchActivityPage({ props, queryClient, signal, before: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      infinite && lastPage.serverCount >= limit ? lastPage.cursor : undefined,
    select,
  });

  const handleLikeActivity = useLikeActivity();
  const refresh = () => refreshActivities(props);
  const noop = useCallback(() => {}, []);

  return {
    loading,
    activities,
    handleLikeActivity,
    refresh,
    fetchNextPage: infinite ? fetchNextPage : noop,
    hasNextPage: infinite ? (hasNextPage ?? false) : false,
    isFetchingNextPage: infinite ? isFetchingNextPage : false,
  };
};

const NO_ACTIVITIES: FeedActionActivityDto[] = [];

export default useActivities;
