// eslint-disable-next-line api-client/named-hooks-only -- the TanStack hooks in this file own these calls
import {
  HomeFeedForumCommentDto,
  HomeFeedItemDto,
  actionFeedLikeActivity,
  actionFeedUnlikeActivity,
  forumLikeComment,
  forumUnlikeComment,
} from "@alliance/shared/client";
import {
  InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  actionActivityDtoIsVisibleInFeed,
  type FeedActionActivityDto,
} from "./actionActivity";

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

export const processFeedItems = (
  data: HomeFeedItemDto[] | undefined,
): ParsedHomeFeedItemDto[] =>
  (data?.filter(isViewable) ?? []).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

export type FeedPage = {
  items: ParsedHomeFeedItemDto[];
  serverCount: number;
  oldestRawDate: string | undefined;
};

export const buildFeedPage = (raw: HomeFeedItemDto[]): FeedPage => ({
  items: processFeedItems(raw),
  serverCount: raw.length,
  oldestRawDate: raw.length ? raw[raw.length - 1].date : undefined,
});

export type InfiniteFeedData = InfiniteData<FeedPage>;

export const mapActivitiesInPages = (
  old: InfiniteFeedData | undefined,
  mapper: (activity: FeedActionActivityDto) => FeedActionActivityDto,
): InfiniteFeedData | undefined => {
  if (!old) return old;
  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      items: page.items.map((item) =>
        item.type === "activity" && item.activity
          ? { ...item, activity: mapper(item.activity) }
          : item,
      ),
    })),
  };
};

export const mapForumCommentsInPages = (
  old: InfiniteFeedData | undefined,
  mapper: (comment: HomeFeedForumCommentDto) => HomeFeedForumCommentDto,
): InfiniteFeedData | undefined => {
  if (!old) return old;
  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      items: page.items
        .map((item): ParsedHomeFeedItemDto | null => {
          switch (item.type) {
            case "activity":
              return item;
            case "forum_comment": {
              const fc = item.forumComment;
              if (!fc) return item;
              return { ...item, forumComment: mapper(fc) };
            }
            default: {
              // Drop unknown variants so older clients don't crash on new server types.
              item.type satisfies never;
              return null;
            }
          }
        })
        .filter((i): i is ParsedHomeFeedItemDto => i !== null),
    })),
  };
};

export const useFeedLikeMutations = (
  queryKeyRoot: string,
  items: HomeFeedItemDto[],
) => {
  const queryClient = useQueryClient();

  const likeMutation = useMutation({
    mutationFn: async ({
      activityId,
      isLiked,
    }: {
      activityId: number;
      isLiked: boolean;
      activityType: string;
    }) => {
      const response = isLiked
        ? await actionFeedUnlikeActivity({ path: { id: activityId } })
        : await actionFeedLikeActivity({ path: { id: activityId } });
      if (response.response.ok && response.data) return response.data;
      throw new Error("Like request failed");
    },
    onMutate: async ({ activityId, isLiked }) => {
      await queryClient.cancelQueries({ queryKey: [queryKeyRoot] });

      const previousQueries = queryClient.getQueriesData<InfiniteFeedData>({
        queryKey: [queryKeyRoot],
      });

      queryClient.setQueriesData<InfiniteFeedData>(
        { queryKey: [queryKeyRoot] },
        (old) =>
          mapActivitiesInPages(old, (a) =>
            a.id === activityId
              ? {
                  ...a,
                  likedByMe: !isLiked,
                  likesCount: isLiked ? a.likesCount - 1 : a.likesCount + 1,
                }
              : a,
          ),
      );

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      context?.previousQueries?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSuccess: (data, { activityId }) => {
      queryClient.setQueriesData<InfiniteFeedData>(
        { queryKey: [queryKeyRoot] },
        (old) =>
          mapActivitiesInPages(old, (a) =>
            a.id === activityId
              ? {
                  ...a,
                  likes: data.likes,
                  likesCount: data.likesCount,
                  likedByMe: data.likedByMe,
                }
              : a,
          ),
      );
    },
  });

  const handleLikeActivity = useCallback(
    async (activityId: number) => {
      const activity = items.find(
        (i) => i.type === "activity" && i.activity?.id === activityId,
      )?.activity;
      if (!activity) return;
      await likeMutation.mutateAsync({
        activityId,
        isLiked: activity.likedByMe ?? false,
        activityType: activity.type,
      });
    },
    [items, likeMutation],
  );

  const commentLikeMutation = useMutation({
    mutationFn: async ({
      commentId,
      isLiked,
    }: {
      commentId: number;
      isLiked: boolean;
    }) => {
      const response = isLiked
        ? await forumUnlikeComment({ path: { id: commentId } })
        : await forumLikeComment({ path: { id: commentId } });
      if (!response.response.ok) throw new Error("Like request failed");
    },
    onMutate: async ({ commentId, isLiked }) => {
      await queryClient.cancelQueries({ queryKey: [queryKeyRoot] });

      const previousQueries = queryClient.getQueriesData<InfiniteFeedData>({
        queryKey: [queryKeyRoot],
      });

      queryClient.setQueriesData<InfiniteFeedData>(
        { queryKey: [queryKeyRoot] },
        (old) =>
          mapForumCommentsInPages(old, (c) =>
            c.comment.id === commentId
              ? {
                  ...c,
                  likedByMe: !isLiked,
                  likesCount: isLiked ? c.likesCount - 1 : c.likesCount + 1,
                }
              : c,
          ),
      );

      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      context?.previousQueries?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
  });

  const handleLikeForumComment = useCallback(
    async (commentId: number) => {
      const forumComment = items
        .map((item) => item.forumComment)
        .find((fc) => fc?.comment.id === commentId);
      if (!forumComment) return;
      await commentLikeMutation.mutateAsync({
        commentId,
        isLiked: forumComment.likedByMe,
      });
    },
    [items, commentLikeMutation],
  );

  return { handleLikeActivity, handleLikeForumComment };
};

export const useFeedQuery = (params: {
  queryKeyRoot: string;
  queryKey: ReadonlyArray<unknown>;
  fetchPage: (before?: string) => Promise<FeedPage>;
  limit: number;
  enabled?: boolean;
}) => {
  const { queryKeyRoot, queryKey, fetchPage, limit, enabled } = params;

  const {
    data,
    isLoading: loading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.serverCount < limit) return undefined;
      return lastPage.oldestRawDate;
    },
    enabled,
  });

  const items = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  const { handleLikeActivity, handleLikeForumComment } = useFeedLikeMutations(
    queryKeyRoot,
    items,
  );

  return {
    loading,
    items,
    handleLikeActivity,
    handleLikeForumComment,
    fetchNextPage,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
  };
};
