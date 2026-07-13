import {
  actionsGetGlobalFeedActivityMembers,
  actionsGetGlobalFeedCommentMembers,
  actionsGetGlobalFeedNewMembers,
  type GlobalFeedActivityTypes,
  type ProfileDto,
} from "@alliance/shared/client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { USER_LIST_PAGE_SIZE } from "./userList";

/** Source for a feed item's paginated member list. */
export type FeedMemberSource =
  | {
      type: "activityGroup";
      actionId: number;
      activityType: GlobalFeedActivityTypes;
    }
  | { type: "newMembers" }
  | { type: "forumComments"; postId: number };

const QUERY_KEY_ROOT = "useFeedMembers";

const fetchMemberPage = (
  source: FeedMemberSource,
  query: { limit: number; afterId?: number },
): Promise<{ data?: ProfileDto[] }> => {
  switch (source.type) {
    case "activityGroup":
      return actionsGetGlobalFeedActivityMembers({
        query: {
          actionId: source.actionId,
          activityType: source.activityType,
          ...query,
        },
      });
    case "newMembers":
      return actionsGetGlobalFeedNewMembers({ query });
    case "forumComments":
      return actionsGetGlobalFeedCommentMembers({
        query: { postId: source.postId, ...query },
      });
    default:
      throw new Error(`unknown feed member source: ${source satisfies never}`);
  }
};

export type UseFeedMembersProps = {
  source: FeedMemberSource;
  enabled?: boolean;
};

/**
 * Fetches paged feed members; cursor is the previous page's last user id.
 * Pages are `USER_LIST_PAGE_SIZE` so the loading skeleton's clamp matches the
 * first page.
 */
export const useFeedMembers = ({
  source,
  enabled = true,
}: UseFeedMembersProps) => {
  const {
    data,
    isLoading: loading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [QUERY_KEY_ROOT, source],
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }) => {
      const resp = await fetchMemberPage(source, {
        limit: USER_LIST_PAGE_SIZE,
        afterId: pageParam,
      });
      return resp.data ?? [];
    },
    getNextPageParam: (lastPage) =>
      lastPage.length < USER_LIST_PAGE_SIZE
        ? undefined
        : lastPage[lastPage.length - 1]?.id,
    enabled,
  });

  const users = useMemo(() => data?.pages.flat() ?? [], [data]);

  return {
    users,
    loading,
    fetchNextPage,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
  };
};

export default useFeedMembers;
