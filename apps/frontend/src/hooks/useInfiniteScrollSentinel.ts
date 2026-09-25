import { useCallback, useRef } from "react";

interface Pagination {
  fetchNextPage: () => unknown;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}

/** Callback ref for an element that fetches the next page once it scrolls within 200px of view. */
export function useInfiniteScrollSentinel(pagination: Pagination) {
  const paginationRef = useRef(pagination);
  paginationRef.current = pagination;
  const observerRef = useRef<IntersectionObserver | null>(null);

  return useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!node) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const p = paginationRef.current;
        if (
          entries.some((entry) => entry.isIntersecting) &&
          p.hasNextPage &&
          !p.isFetchingNextPage
        ) {
          p.fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    observerRef.current.observe(node);
  }, []);
}
