import type { PaginatedList } from "@alliance/common/pagination";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export type { PaginatedList } from "@alliance/common/pagination";

/**
 * Page state + react-query for a server-paginated list endpoint. Keeps the
 * previous page's rows on screen while the next one loads
 * (`isPlaceholderData` is true during that window).
 *
 * `queryKey` must include everything the fetch depends on besides the page
 * (filters etc.). Resetting the page is the caller's job — call `setPage(1)`
 * in the same handler that changes a filter.
 */
export function usePaginatedQuery<
  TList extends PaginatedList<unknown>,
>(params: {
  queryKey: (page: number) => readonly unknown[];
  queryFn: (page: number) => Promise<TList>;
  enabled?: boolean;
}) {
  const { queryKey, queryFn, enabled = true } = params;
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, isPlaceholderData, refetch } = useQuery({
    queryKey: queryKey(page),
    queryFn: () => queryFn(page),
    placeholderData: keepPreviousData,
    enabled,
  });

  // If the dataset shrank under us (deletions, invalidation) and the current
  // page no longer exists, snap to the last page. Placeholder data is another
  // page's response, so its totalPages can't judge this page.
  useEffect(() => {
    if (
      data &&
      !isPlaceholderData &&
      data.totalPages >= 1 &&
      page > data.totalPages
    ) {
      setPage(data.totalPages);
    }
  }, [data, isPlaceholderData, page]);

  return {
    data,
    page,
    setPage,
    isLoading,
    isError,
    isPlaceholderData,
    refetch,
  };
}
