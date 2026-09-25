import {
  likesGetActivityUsers,
  likesGetCommentUsers,
  likesGetPostUsers,
  type ProfileDto,
} from "@alliance/shared/client";
import { usePagedUsers, type UserPageQuery } from "./usePagedUsers";

export type LikeTargetType = "post" | "comment" | "activity";

type LikersFetcher = (
  id: number,
  query: UserPageQuery,
) => Promise<{ data?: ProfileDto[] }>;

const LIKERS_FETCHERS: Record<LikeTargetType, LikersFetcher> = {
  post: (id, query) => likesGetPostUsers({ path: { id }, query }),
  comment: (id, query) => likesGetCommentUsers({ path: { id }, query }),
  activity: (id, query) => likesGetActivityUsers({ path: { id }, query }),
};

const QUERY_KEY_ROOT = "useLikers";

export type UseLikersProps = {
  targetType: LikeTargetType;
  targetId: number;
  enabled?: boolean;
};

export const useLikers = ({
  targetType,
  targetId,
  enabled = true,
}: UseLikersProps) =>
  usePagedUsers({
    queryKey: [QUERY_KEY_ROOT, targetType, targetId],
    fetchPage: (query) => LIKERS_FETCHERS[targetType](targetId, query),
    enabled,
  });

export default useLikers;
