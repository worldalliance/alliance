import {
  actionsGetGlobalFeedActivityMembers,
  actionsGetGlobalFeedCommentMembers,
  actionsGetGlobalFeedNewMembers,
  type GlobalFeedActivityTypes,
  type ProfileDto,
} from "@alliance/shared/client";
import { usePagedUsers, type UserPageQuery } from "./usePagedUsers";

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
  query: UserPageQuery,
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

export const useFeedMembers = ({
  source,
  enabled = true,
}: UseFeedMembersProps) =>
  usePagedUsers({
    queryKey: [QUERY_KEY_ROOT, source],
    fetchPage: (query) => fetchMemberPage(source, query),
    enabled,
  });

export default useFeedMembers;
