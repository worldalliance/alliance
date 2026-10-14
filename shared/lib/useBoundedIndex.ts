import { useCallback, useEffect, useState } from "react";

/**
 * Manages a selection in a list of keyed items. The selection follows its
 * item when others are added or removed around it; when the item itself
 * leaves, the selection stays at its position, clamped to the list.
 */
export function useBoundedIndex(keys: readonly string[]) {
  const [selected, setSelected] = useState<{
    key: string | null;
    index: number;
  }>({ key: null, index: 0 });
  const length = keys.length;
  const found = selected.key === null ? -1 : keys.indexOf(selected.key);
  const safeIndex =
    found >= 0 ? found : Math.min(selected.index, Math.max(0, length - 1));

  useEffect(() => {
    if (length > 0 && (found < 0 || found !== selected.index)) {
      setSelected({ key: keys[safeIndex], index: safeIndex });
    }
  }, [keys, length, found, safeIndex, selected.index]);

  const setIndex = useCallback(
    (index: number) => setSelected({ key: keys[index] ?? null, index }),
    [keys],
  );

  const goNext = useCallback(() => {
    setIndex(Math.min(length - 1, safeIndex + 1));
  }, [setIndex, length, safeIndex]);

  const goPrev = useCallback(() => {
    setIndex(Math.max(0, safeIndex - 1));
  }, [setIndex, safeIndex]);

  return {
    index: safeIndex,
    setIndex,
    goNext,
    goPrev,
    canGoNext: length > 1 && safeIndex < length - 1,
    canGoPrev: length > 1 && safeIndex > 0,
    hasMultiple: length > 1,
  };
}
