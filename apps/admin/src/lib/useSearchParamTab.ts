import { useCallback } from "react";
import { useSearchParams } from "react-router";

export function useSearchParamTab<T extends string>(
  tabs: readonly T[],
  fallback: T,
  options: {
    param?: string;
    /** Params that belong to one tab, dropped on switching to another. */
    resets?: readonly string[];
  } = {},
): [T, (tab: T) => void, (tab: T) => string] {
  const { param = "tab", resets } = options;
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(param);
  const selectedTab = tabs.find((tab) => tab === value) ?? fallback;

  const withTab = useCallback(
    (prev: URLSearchParams, tab: T) => {
      const next = new URLSearchParams(prev);
      const shown = tabs.find((each) => each === prev.get(param)) ?? fallback;
      if (tab !== shown) {
        resets?.forEach((name) => next.delete(name));
      }
      next.set(param, tab);
      return next;
    },
    [tabs, fallback, param, resets],
  );

  const onTabChange = useCallback(
    (tab: T) => setSearchParams((prev) => withTab(prev, tab)),
    [setSearchParams, withTab],
  );

  const tabHref = useCallback(
    (tab: T) => `?${withTab(searchParams, tab).toString()}`,
    [searchParams, withTab],
  );

  return [selectedTab, onTabChange, tabHref];
}
