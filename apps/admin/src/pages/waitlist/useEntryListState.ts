import type {
  WaitlistEntryFilterDto,
  WaitlistEntrySort,
} from "@alliance/shared/client/types.gen";
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import {
  cohortFromParams,
  filterFromParams,
  pageFromParams,
  sortFromParams,
  withCohortParam,
  withFilterParams,
  withPageParam,
  withSortParam,
} from "./waitlistUrl";

/** The entries list's filter, sort, page and applied cohort, kept in the URL. */
export function useEntryListState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.toString();
  // Keyed on the query string, so a filter is one object until the URL changes.
  const filter = useMemo(
    () => filterFromParams(new URLSearchParams(query)),
    [query],
  );
  const write = useCallback(
    (change: (prev: URLSearchParams) => URLSearchParams) =>
      setSearchParams(change, { replace: true }),
    [setSearchParams],
  );
  return {
    filter,
    sort: sortFromParams(searchParams),
    page: pageFromParams(searchParams),
    cohortId: cohortFromParams(searchParams),
    setFilter: useCallback(
      (next: WaitlistEntryFilterDto) =>
        write((prev) => withFilterParams(prev, next)),
      [write],
    ),
    setSort: useCallback(
      (next: WaitlistEntrySort) => write((prev) => withSortParam(prev, next)),
      [write],
    ),
    setPage: useCallback(
      (next: number) => write((prev) => withPageParam(prev, next)),
      [write],
    ),
    /** Applies a cohort: its id and its filter, in one history entry. */
    applyCohort: useCallback(
      (cohortId: number | null, next?: WaitlistEntryFilterDto) =>
        write((prev) => {
          const withCohort = withCohortParam(prev, cohortId);
          return next ? withFilterParams(withCohort, next) : withCohort;
        }),
      [write],
    ),
  };
}

export type EntryListState = ReturnType<typeof useEntryListState>;
