import type { HomeFeedItemDto } from "@alliance/shared/client";
import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import {
  actionActivityDtoIsVisibleInFeed,
  type FeedActionActivityDto,
} from "./actionActivity";
import {
  ActivityFields,
  type ActivityState,
  activityStore,
  selectFeedActivity,
  selectForumComment,
} from "./activityStore";
import { useLikeActivity, useLikeForumComment } from "./useFeedLikes";
import { useStoreState } from "./useStoreState";

/** A home-feed item that has passed `isViewable`. */
export type ParsedHomeFeedItemDto = Omit<HomeFeedItemDto, "activity"> & {
  activity?: FeedActionActivityDto;
};

const isViewable = (item: HomeFeedItemDto): item is ParsedHomeFeedItemDto => {
  switch (item.type) {
    case "activity":
      return item.activity
        ? actionActivityDtoIsVisibleInFeed(item.activity)
        : false;
    case "forum_comment":
      return item.forumComment != null;
    default:
      // Drop unknown variants so older clients don't crash on new server types.
      item.type satisfies never;
      return false;
  }
};

type FeedItemRef =
  | { type: "activity"; date: string; activityId: number }
  | { type: "forum_comment"; date: string; commentId: number };

const toRef = (item: ParsedHomeFeedItemDto): FeedItemRef[] => {
  const { date, activity, forumComment } = item;
  switch (item.type) {
    case "activity":
      return activity
        ? [{ type: item.type, date, activityId: activity.id }]
        : [];
    case "forum_comment":
      return forumComment
        ? [{ type: item.type, date, commentId: forumComment.comment.id }]
        : [];
    default:
      item.type satisfies never;
      return [];
  }
};

type FeedPage = {
  items: FeedItemRef[];
  serverCount: number;
  oldestRawDate: string | undefined;
};

const feedCarries = (comments: boolean): ActivityFields[] =>
  comments
    ? [ActivityFields.Comments, ActivityFields.Output]
    : [ActivityFields.Output];

const loadFeedPage = async (params: {
  queryClient: QueryClient;
  comments: boolean;
  signal: AbortSignal;
  fetch: () => Promise<HomeFeedItemDto[]>;
}): Promise<FeedPage> => {
  let raw: HomeFeedItemDto[] = [];
  await activityStore(params.queryClient).load({
    carries: feedCarries(params.comments),
    signal: params.signal,
    fetch: () =>
      params.fetch().then((items) => {
        raw = items;
        return {
          activities: items.flatMap((item) => item.activity ?? []),
          forumComments: items.flatMap((item) => item.forumComment ?? []),
        };
      }),
  });
  const items = raw
    .filter(isViewable)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .flatMap(toRef);
  return {
    items,
    serverCount: raw.length,
    oldestRawDate: raw.at(-1)?.date,
  };
};

const selectItem = (
  state: ActivityState,
  item: FeedItemRef,
): ParsedHomeFeedItemDto => {
  switch (item.type) {
    case "activity":
      return {
        type: item.type,
        date: item.date,
        activity: selectFeedActivity(state, item.activityId),
      };
    case "forum_comment":
      return {
        type: item.type,
        date: item.date,
        forumComment: selectForumComment(state, item.commentId),
      };
    default:
      throw new Error(`unknown feed item: ${item satisfies never}`);
  }
};

export const useFeedQuery = (params: {
  queryKey: ReadonlyArray<unknown>;
  comments: boolean;
  fetchItems: (params: {
    before: string | undefined;
    signal: AbortSignal;
  }) => Promise<HomeFeedItemDto[]>;
  limit: number;
  enabled?: boolean;
}) => {
  const { queryKey, comments, fetchItems, limit, enabled } = params;
  const queryClient = useQueryClient();
  const state = useStoreState(activityStore);
  const select = useCallback(
    (data: InfiniteData<FeedPage>) =>
      data.pages.flatMap((page) =>
        page.items.map((item) => selectItem(state, item)),
      ),
    [state],
  );

  const {
    data: items = NO_ITEMS,
    isLoading: loading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) =>
      loadFeedPage({
        queryClient,
        comments,
        signal,
        fetch: () => fetchItems({ before: pageParam, signal }),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.serverCount < limit ? undefined : lastPage.oldestRawDate,
    select,
    enabled,
  });

  return {
    loading,
    items,
    handleLikeActivity: useLikeActivity(),
    handleLikeForumComment: useLikeForumComment(),
    fetchNextPage,
    // A failed page stops pagination until a refetch, so a caller that pulls
    // whenever nothing is loading can't request it in a loop.
    hasNextPage: hasNextPage && !isFetchNextPageError,
    isFetchingNextPage,
  };
};

const NO_ITEMS: ParsedHomeFeedItemDto[] = [];
