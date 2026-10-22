import { useCallback } from "react";
import { useSearchParams } from "react-router";

export function useSearchParamTab<T extends string>(
  tabs: readonly T[],
  fallback: T,
): [T, (tab: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get("tab");
  const selectedTab = tabs.find((tab) => tab === param) ?? fallback;

  const onTabChange = useCallback(
    (tab: T) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", tab);
        return next;
      });
    },
    [setSearchParams],
  );

  return [selectedTab, onTabChange];
}
