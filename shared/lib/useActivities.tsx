import {
  ActionActivityDto,
  actionsFindCompletedForUser,
  actionsFriendActivity,
  actionsGetActionActivities,
  actionsGetActivityFeed,
  actionsCommunityActivity,
  actionsLikeActivity,
  actionsUnlikeActivity,
  actionsFriendActivityForAction,
} from "@alliance/shared/client";
import { useCallback, useMemo } from "react";
import {
  useInfiniteQuery,
  useQueryClient,
  InfiniteData,
} from "@tanstack/react-query";
import posthog from "posthog-js";
import { actionActivityViewable } from "./actionActivityConstants";

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

const supportsCursor = (list: ActivityList) =>
  list === ActivityList.Global ||
  list === ActivityList.Friends ||
  list === ActivityList.Community ||
  list === ActivityList.Action;

const generateQueryKey = (props: UseActivitiesProps) => {
  return [
    "useActivities",
    props.list,
    props.objectId ?? "none",
    props.limit ?? 50,
    props.comments ?? false,
  ];
};

const callActivityApi = async (props: UseActivitiesProps, before?: string) => {
  const { list, objectId, limit = 50, comments = false } = props;
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
  data: ActionActivityDto[] | undefined
): ActionActivityDto[] => {
  const filtered = data?.filter((a) => actionActivityViewable[a.type]) ?? [];
  return filtered.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

/** Page wrapper that preserves the raw server count for accurate pagination */
type ActivityPage = {
  activities: ActionActivityDto[];
  serverCount: number;
};

const fetchActivityPage = async (
  props: UseActivitiesProps,
  before?: string
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
  mapper: (activity: ActionActivityDto) => ActionActivityDto
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

const useActivities = (props: UseActivitiesProps) => {
  const queryClient = useQueryClient();
  const queryKey = generateQueryKey(props);
  const infinite = supportsCursor(props.list);
  const limit = props.limit ?? 50;

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
    [data]
  );

  const setActivities = useCallback(
    (updater: React.SetStateAction<ActionActivityDto[]>) => {
      queryClient.setQueryData<InfiniteActivityData>(queryKey, (old) => {
        if (!old) return old;
        if (typeof updater === "function") {
          // Apply per-page to preserve page structure and pageParams alignment
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              activities: updater(page.activities),
            })),
          };
        }
        // Direct replacement: single page, matching single pageParam
        return {
          pages: [{ activities: updater, serverCount: updater.length }],
          pageParams: [old.pageParams[0]],
        };
      });
    },
    [queryClient, queryKey]
  );

  const handleLikeActivity = useCallback(
    async (activityId: number) => {
      const activity = activities.find((a) => a.id === activityId);
      if (!activity) return;

      const isLiked = activity.likedByMe ?? false;

      const updateLikeInCache = (responseData: ActionActivityDto) => {
        const mapper = (a: ActionActivityDto) =>
          a.id === activityId
            ? {
                ...a,
                likes: responseData.likes,
                likesCount: responseData.likesCount,
                likedByMe: responseData.likedByMe,
              }
            : a;

        queryClient.setQueryData<InfiniteActivityData>(queryKey, (old) =>
          mapInfiniteActivities(old, mapper)
        );
      };

      if (isLiked) {
        const response = await actionsUnlikeActivity({
          path: { id: activityId },
        });
        if (response.response.ok && response.data) {
          updateLikeInCache(response.data);
          return response.data;
        }
        return null;
      } else {
        const response = await actionsLikeActivity({
          path: { id: activityId },
        });
        if (response.response.ok && response.data) {
          updateLikeInCache(response.data);
          posthog.capture("activity_liked", {
            activityId: activity.id,
            activityType: activity.type,
          });
          return response.data;
        }
      }
      return null;
    },
    [activities, queryClient, queryKey]
  );

  const updateActivity = useCallback(
    (updatedActivity: ActionActivityDto) => {
      const mapper = (a: ActionActivityDto) =>
        a.id === updatedActivity.id ? { ...a, ...updatedActivity } : a;

      queryClient.setQueryData<InfiniteActivityData>(queryKey, (old) =>
        mapInfiniteActivities(old, mapper)
      );
    },
    [queryClient, queryKey]
  );

  const noop = useCallback(() => {}, []);

  return {
    loading,
    activities,
    handleLikeActivity,
    setActivities,
    updateActivity,
    fetchNextPage: infinite ? fetchNextPage : noop,
    hasNextPage: infinite ? hasNextPage ?? false : false,
    isFetchingNextPage: infinite ? isFetchingNextPage : false,
  };
};

export default useActivities;
