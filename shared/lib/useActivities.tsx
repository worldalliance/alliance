import {
  ActionActivityDto,
  actionsCommunityActivity,
  actionsFindCompletedForUser,
  actionsFriendActivity,
  actionsFriendActivityForAction,
  actionsGetActionActivities,
  actionsGetActivity,
  actionsGetActivityFeed,
  actionsLikeActivity,
  actionsUnlikeActivity,
} from "@alliance/shared/client";
import {
  InfiniteData,
  skipToken,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  actionActivityDtoIsVisibleInFeed,
  type FeedActionActivityDto,
} from "./actionActivity";
import { queryKeys } from "./queryKeys";

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

const callActivityApi = async (props: UseActivitiesProps, before?: string) => {
  const { list, objectId, limit = DEFAULT_LIMIT, comments = false } = props;
  const beforeStr = before ?? new Date().toISOString();

  let apiCall;
  switch (list) {
    case ActivityList.Friends:
      apiCall = actionsFriendActivity({
        query: { comments, limit: limit.toString(), before: beforeStr },
      });
      break;
    case ActivityList.User:
      apiCall = actionsFindCompletedForUser({
        path: { id: objectId! },
        query: { comments },
      });
      break;
    case ActivityList.Action:
      apiCall = actionsGetActionActivities({
        path: { id: objectId! },
        query: { limit: limit, comments, before: beforeStr },
      });
      break;
    case ActivityList.FriendsForAction:
      if (!objectId) {
        throw new Error("objectId is required for FriendsForAction");
      }
      apiCall = actionsFriendActivityForAction({
        path: { actionId: objectId },
        query: { comments, limit: limit.toString() },
      });
      break;
    case ActivityList.Community:
      apiCall = actionsCommunityActivity({
        query: {
          limit: limit.toString(),
          before: beforeStr,
          comments,
          communityId: objectId!,
        },
      });
      break;
    case ActivityList.Global:
      apiCall = actionsGetActivityFeed({
        query: {
          limit: limit.toString(),
          before: beforeStr,
          comments,
        },
      });
      break;
  }

  return apiCall;
};

const processActivities = (
  data: ActionActivityDto[] | undefined,
): FeedActionActivityDto[] => {
  const filtered = data?.filter(actionActivityDtoIsVisibleInFeed) ?? [];
  return filtered.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
};

/** Page wrapper that preserves the raw server count for accurate pagination */
type ActivityPage = {
  activities: FeedActionActivityDto[];
  serverCount: number;
};

const fetchActivityPage = async (
  props: UseActivitiesProps,
  before?: string,
): Promise<ActivityPage> => {
  const resp = await callActivityApi(props, before);
  const raw = resp.data ?? [];
  return {
    activities: processActivities(raw),
    serverCount: raw.length,
  };
};

type InfiniteActivityData = InfiniteData<ActivityPage>;

/** Map over all activities across pages in an infinite query cache entry */
const mapInfiniteActivities = (
  old: InfiniteActivityData | undefined,
  mapper: (activity: FeedActionActivityDto) => FeedActionActivityDto,
): InfiniteActivityData | undefined => {
  if (!old) return old;
  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      activities: page.activities.map(mapper),
    })),
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

export const useActivity = (activityId: number) =>
  useQuery({
    queryKey: queryKeys.activity(activityId),
    queryFn: activityId
      ? () =>
          actionsGetActivity({
            path: { id: activityId },
            throwOnError: true,
          }).then((res) => res.data)
      : skipToken,
  });

/** Likes or unlikes an activity, optimistically in every cached activity
 * list and in its useActivity entry. */
export const useLikeActivity = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      activityId,
      isLiked,
    }: {
      activityId: number;
      isLiked: boolean;
    }) => {
      const response = isLiked
        ? await actionsUnlikeActivity({ path: { id: activityId } })
        : await actionsLikeActivity({ path: { id: activityId } });
      if (response.response.ok && response.data) return response.data;
      throw new Error("Like request failed");
    },
    onMutate: async ({ activityId, isLiked }) => {
      const detailKey = queryKeys.activity(activityId);
      // cancelQueries doesn't restart the fetch it cancels; onSettled does.
      const detailWasFetching =
        queryClient.isFetching({ queryKey: detailKey }) > 0;
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.activitiesAll() }),
        queryClient.cancelQueries({ queryKey: detailKey }),
      ]);

      const previousQueries = queryClient.getQueriesData<InfiniteActivityData>({
        queryKey: queryKeys.activitiesAll(),
      });
      const previousDetail =
        queryClient.getQueryData<ActionActivityDto>(detailKey);

      const toggle = <T extends ActionActivityDto>(a: T): T => ({
        ...a,
        likedByMe: !isLiked,
        likesCount: isLiked ? a.likesCount - 1 : a.likesCount + 1,
      });
      queryClient.setQueriesData<InfiniteActivityData>(
        { queryKey: queryKeys.activitiesAll() },
        (old) =>
          mapInfiniteActivities(old, (a) =>
            a.id === activityId ? toggle(a) : a,
          ),
      );
      queryClient.setQueryData<ActionActivityDto>(
        detailKey,
        (old) => old && toggle(old),
      );

      return { previousQueries, previousDetail, detailWasFetching };
    },
    onError: (_err, { activityId }, context) => {
      context?.previousQueries?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      if (context?.previousDetail) {
        queryClient.setQueryData(
          queryKeys.activity(activityId),
          context.previousDetail,
        );
      }
    },
    onSuccess: (data, { activityId }) => {
      const fromServer = <T extends ActionActivityDto>(a: T): T => ({
        ...a,
        likes: data.likes,
        likesCount: data.likesCount,
        likedByMe: data.likedByMe,
      });
      queryClient.setQueriesData<InfiniteActivityData>(
        { queryKey: queryKeys.activitiesAll() },
        (old) =>
          mapInfiniteActivities(old, (a) =>
            a.id === activityId ? fromServer(a) : a,
          ),
      );
      queryClient.setQueryData<ActionActivityDto>(
        queryKeys.activity(activityId),
        (old) => old && fromServer(old),
      );
    },
    onSettled: (_data, _err, { activityId }, context) => {
      if (context?.detailWasFetching) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.activity(activityId),
        });
      }
    },
  });
};

const useActivities = (props: UseActivitiesProps) => {
  const queryClient = useQueryClient();
  const refreshActivities = useRefreshActivities();
  const queryKey = activitiesKey(props);
  const infinite = supportsCursor(props.list);
  const limit = props.limit ?? DEFAULT_LIMIT;

  const {
    data,
    isLoading: loading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchActivityPage(props, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      // Non-cursor lists (User, Action, FriendsForAction) never paginate
      if (!infinite) return undefined;
      // Use raw server count to avoid premature stop from client-side filtering
      if (lastPage.serverCount < limit) return undefined;
      const last = lastPage.activities[lastPage.activities.length - 1];
      return last?.createdAt;
    },
  });

  const activities = useMemo(
    () => data?.pages.flatMap((p) => p.activities) ?? [],
    [data],
  );

  const likeMutation = useLikeActivity();

  const handleLikeActivity = useCallback(
    async (
      activityId: number,
      overrides?: { isLiked: boolean; activityType: string },
    ) => {
      const activity = activities.find((a) => a.id === activityId);
      const isLiked = overrides?.isLiked ?? activity?.likedByMe ?? false;
      const activityType = overrides?.activityType ?? activity?.type;
      if (!activityType) return;
      await likeMutation.mutateAsync({ activityId, isLiked });
    },
    [activities, likeMutation],
  );

  const updateActivity = useCallback(
    (updatedActivity: FeedActionActivityDto) => {
      const mapper = (a: FeedActionActivityDto) =>
        a.id === updatedActivity.id ? { ...a, ...updatedActivity } : a;

      queryClient.setQueryData<InfiniteActivityData>(queryKey, (old) =>
        mapInfiniteActivities(old, mapper),
      );
    },
    [queryClient, queryKey],
  );

  const refresh = () => refreshActivities(props);

  const noop = useCallback(() => {}, []);

  return {
    loading,
    activities,
    handleLikeActivity,
    updateActivity,
    refresh,
    fetchNextPage: infinite ? fetchNextPage : noop,
    hasNextPage: infinite ? (hasNextPage ?? false) : false,
    isFetchingNextPage: infinite ? isFetchingNextPage : false,
  };
};

export default useActivities;
