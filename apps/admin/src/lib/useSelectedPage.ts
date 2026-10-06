import type { Page } from "@alliance/common/forms/form-schema";
import { useCallback, useState } from "react";

/**
 * The builder's selected page index, kept within `pages`. `keepPage` runs a
 * move through history that can add, remove, or reorder pages, and keeps the
 * page on screen by id; when that page goes, the selection stays at its
 * position, or the last page if that position is gone.
 */
export function useSelectedPage(pages: readonly Page[]) {
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [pageToRestore, setPageToRestore] = useState<string | null>(null);

  const restoredPageIndex =
    pageToRestore === null
      ? -1
      : pages.findIndex((page) => page.id === pageToRestore);
  if (pageToRestore !== null) setPageToRestore(null);
  if (restoredPageIndex !== -1) {
    if (restoredPageIndex !== selectedPageIndex) {
      setSelectedPageIndex(restoredPageIndex);
    }
  } else if (selectedPageIndex > pages.length - 1) {
    setSelectedPageIndex(pages.length - 1);
  }

  const currentPageId = pages[selectedPageIndex]?.id ?? null;
  const keepPage = useCallback(
    (move: () => void) => {
      move();
      setPageToRestore(currentPageId);
    },
    [currentPageId],
  );

  return { selectedPageIndex, setSelectedPageIndex, keepPage };
}
