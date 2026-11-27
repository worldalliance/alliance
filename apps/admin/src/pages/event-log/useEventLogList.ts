import type { EventType } from "@alliance/shared/client/types.gen";
import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { useEventLogAdmin } from "../../lib/useEventLogAdmin";
import { isEventType } from "./eventLogRules";

const pageOf = (value: string | null): number => {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
};

const withList =
  (next: { page: number; type?: EventType | "" }) =>
  (prev: URLSearchParams) => {
    const params = new URLSearchParams(prev);
    if (next.type !== undefined) {
      if (next.type) params.set("type", next.type);
      else params.delete("type");
    }
    if (next.page === 1) params.delete("page");
    else params.set("page", String(next.page));
    return params;
  };

/**
 * The event log's page of events with its filter in `?type=` and its page in
 * `?page=`, so a reload or a pasted link returns to the same rows.
 */
export function useEventLogList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const typeParam = searchParams.get("type") ?? "";
  const type: EventType | "" = isEventType(typeParam) ? typeParam : "";
  const page = pageOf(searchParams.get("page"));
  const events = useEventLogAdmin(page, type);
  const { data, isPlaceholderData } = events;

  // A list that shrank under the page being read snaps to its last page.
  // Placeholder data is another page's response, so it can't judge this one.
  const lastPage =
    data && !isPlaceholderData && data.totalPages >= 1 && page > data.totalPages
      ? data.totalPages
      : null;
  useEffect(() => {
    if (lastPage !== null)
      setSearchParams(withList({ page: lastPage }), { replace: true });
  }, [lastPage, setSearchParams]);

  return {
    ...events,
    page,
    type,
    setType: (next: EventType | "") =>
      setSearchParams(withList({ page: 1, type: next }), { replace: true }),
    setPage: (next: number) =>
      setSearchParams(withList({ page: next }), { replace: true }),
  };
}
