import { type useFormValidation } from "@alliance/shared/forms/useFormValidation";

type Validation = ReturnType<typeof useFormValidation>;

export function pageNavigation({
  currentPageIndex,
  setCurrentPageIndex,
  nextVisiblePageIndex,
  previousVisiblePageIndex,
  visibilitySettled,
  validatePage,
  scrollPageTo,
  scrollToEnd,
}: {
  currentPageIndex: number;
  setCurrentPageIndex: (index: number) => void;
  nextVisiblePageIndex: number | null;
  previousVisiblePageIndex: number | null;
  visibilitySettled: boolean;
  scrollPageTo: (y: number, animated?: boolean) => void;
  scrollToEnd: (animated?: boolean) => void;
} & Pick<Validation, "validatePage">) {
  const showPageFromTop = (index: number) => {
    setCurrentPageIndex(index);
    setImmediate(() => scrollPageTo(0, false));
  };

  return {
    goToNextPage: async () => {
      if (nextVisiblePageIndex === null || !visibilitySettled) return;
      const result = await validatePage(currentPageIndex, true);
      if (result.isValid) showPageFromTop(nextVisiblePageIndex);
    },
    goToPreviousPage: () => {
      if (previousVisiblePageIndex === null) return;
      setCurrentPageIndex(previousVisiblePageIndex);
      setImmediate(() => scrollToEnd(false));
    },
    /** Pages through a completed form, which has nothing to validate. */
    browseToNextPage:
      nextVisiblePageIndex === null
        ? null
        : () => showPageFromTop(nextVisiblePageIndex),
    showFirstInvalidPage: (firstInvalidPageIndex: number | null) => {
      if (
        firstInvalidPageIndex !== null &&
        firstInvalidPageIndex !== currentPageIndex
      ) {
        showPageFromTop(firstInvalidPageIndex);
      }
    },
  };
}
