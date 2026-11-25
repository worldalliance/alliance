import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The selected entry ids, emptied whenever `filterKey` changes. `stamp` and
 * `isCurrent` tell a late answer, such as "select all matching", whether the
 * selection or filter it was asked for has since changed.
 */
export function useEntrySelection(filterKey: string) {
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [seenKey, setSeenKey] = useState(filterKey);
  const version = useRef(0);
  if (seenKey !== filterKey) {
    setSeenKey(filterKey);
    setSelected(new Set());
  }
  useEffect(() => {
    version.current += 1;
  }, [filterKey]);

  const change = useCallback((next: ReadonlySet<number>) => {
    version.current += 1;
    setSelected(next);
  }, []);

  const deselect = useCallback((id: number) => {
    version.current += 1;
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  return {
    selected,
    change,
    clear: useCallback(() => change(new Set()), [change]),
    deselect,
    stamp: () => version.current,
    isCurrent: (stamp: number) => stamp === version.current,
  };
}

export type EntrySelection = ReturnType<typeof useEntrySelection>;
