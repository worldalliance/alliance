import { useMemo } from "react";

/** `ids`, keeping the previous array while its contents don't change. */
export function useStableIds(ids: readonly number[]): readonly number[] {
  const key = ids.join(",");
  return useMemo(() => (key === "" ? [] : key.split(",").map(Number)), [key]);
}
