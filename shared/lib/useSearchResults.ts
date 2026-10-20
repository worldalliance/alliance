import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { searchAll, type SearchItemDto } from "../client";
import { queryKeys } from "./queryKeys";
import { groupSearchItems } from "./search";

type UseSearchResultsOptions = {
  debounceMs?: number;
  autoselectFirst?: boolean;
};

/**
 * Search results for `query`, cached per query under `queryKeys.search`.
 * Fetches once `query` has held still for `debounceMs`, keeping the previous
 * query's results on screen meanwhile unless the query was cleared or failed
 * to load since. A failed refetch keeps the results it would have replaced.
 */
export const useSearchResults = (
  query: string,
  options?: UseSearchResultsOptions,
) => {
  const debounceMs = options?.debounceMs ?? 50;
  const autoselectFirst = options?.autoselectFirst ?? true;
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    if (!query.length) {
      setDebouncedQuery("");
      return;
    }
    const timeout = setTimeout(() => setDebouncedQuery(query), debounceMs);
    return () => clearTimeout(timeout);
  }, [query, debounceMs]);

  const searchQuery = useQuery({
    queryKey: queryKeys.search(debouncedQuery),
    queryFn: () =>
      searchAll({ query: { query: debouncedQuery }, throwOnError: true }).then(
        (r) => r.data,
      ),
    enabled: debouncedQuery.length > 0,
    // Results follow live data; mobile's default staleTime is 5 minutes.
    staleTime: 0,
    // The next keystroke or Retry asks again; backoff would leave the
    // dropdown blank for seconds before the error shows.
    retry: false,
    // A paused offline fetch would read as no results; failing shows Retry.
    networkMode: "always",
  });

  const failed = query.length > 0 && searchQuery.isLoadingError;
  const cleared = !query.length || failed;
  const answered = cleared ? undefined : searchQuery.data;
  const [kept, setKept] = useState<{ query: string; data: SearchItemDto[] }>();
  if (cleared ? kept !== undefined : answered && answered !== kept?.data) {
    setKept(answered && { query: debouncedQuery, data: answered });
  }
  const shown = cleared
    ? undefined
    : answered
      ? { query: debouncedQuery, data: answered }
      : kept;
  const data = shown?.data;
  const { grouped: itemsByCategory, ordered: items } = useMemo(
    () => groupSearchItems(data ?? []),
    [data],
  );

  const [selection, setSelection] = useState<{
    query: string | undefined;
    id: string | null;
  }>();
  const shownQuery = shown?.query;
  if (selection && selection.query !== shownQuery) setSelection(undefined);
  const first = autoselectFirst ? (items[0] ?? null) : null;
  const selectedItem = !selection
    ? first
    : selection.id === null
      ? null
      : (items.find((item) => item.id === selection.id) ?? first);
  const setSelectedItem = useCallback(
    (item: SearchItemDto | null) =>
      setSelection({ query: shownQuery, id: item?.id ?? null }),
    [shownQuery],
  );

  const loading =
    query.length > 0 &&
    (query !== debouncedQuery ||
      (searchQuery.isFetching && searchQuery.data === undefined));
  const { refetch } = searchQuery;
  const retry = useCallback(() => void refetch(), [refetch]);

  return {
    items,
    itemsByCategory,
    selectedItem,
    setSelectedItem,
    loading,
    error: failed ? searchQuery.error : null,
    retry,
  };
};
