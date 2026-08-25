import { withCount } from "@alliance/common/plural";

/** Default page size for paged user lists (likers, feed members). */
export const USER_LIST_PAGE_SIZE = 30;

/**
 * Title for a user-list modal. `noun` is singular (e.g. "like", "new
 * member"). `expectedCount` is the caller's known total (may be stale);
 * `loadedCount` is how many users have loaded so far. While more pages exist
 * the count is floored at `loadedCount` so a stale total never undercounts
 * the visible list. (`hasNextPage` can be true with nothing left when the
 * last page came back exactly full, so no `+1`.)
 */
export function getUserListTitle({
  noun,
  expectedCount,
  loadedCount,
  initialLoading,
  hasNextPage,
}: {
  noun: string;
  expectedCount: number;
  loadedCount: number;
  initialLoading: boolean;
  hasNextPage: boolean;
}): string {
  const count = initialLoading
    ? expectedCount
    : hasNextPage
      ? Math.max(expectedCount, loadedCount)
      : loadedCount;
  return withCount(count, noun);
}

/**
 * Skeleton row count while a user-list modal's first page loads: the expected
 * total, clamped to one page.
 */
export function getSkeletonCount(expectedCount: number): number {
  return Math.max(1, Math.min(expectedCount, USER_LIST_PAGE_SIZE));
}
