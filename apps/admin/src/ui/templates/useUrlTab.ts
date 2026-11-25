import { useCallback } from "react";
import { useSearchParams } from "react-router";

/**
 * A choice among `ids` held in a search param, for tabs (`tab`) and list views
 * (`view`). The first id is the default and is the bare URL; an unknown value
 * reads as the default. Each change pushes history, so Back returns to the
 * previous tab.
 */
export function useUrlTab<T extends string>(
  ids: readonly T[],
  param = "tab",
): [T, (id: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const fallback = ids[0];
  if (fallback === undefined) throw new Error("useUrlTab needs one id");
  const raw = searchParams.get(param);
  const value = ids.find((id) => id === raw) ?? fallback;

  const setValue = useCallback(
    (id: T) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (id === fallback) next.delete(param);
        else next.set(param, id);
        return next;
      });
    },
    [setSearchParams, fallback, param],
  );

  return [value, setValue];
}
