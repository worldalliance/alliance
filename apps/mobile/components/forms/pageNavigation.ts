import { type useFormValidation } from "@alliance/shared/useFormRenderer";

type Validation = ReturnType<typeof useFormValidation>;

export function pageNavigation({
  currentPageIndex,
  setCurrentPageIndex,
  nextVisiblePageIndex,
  previousVisiblePageIndex,
  visibilitySettled,
  validatePage,
  validateAllPages,
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
} & Validation) {
  const showPageFromTop = (index: number) => {
    setCurrentPageIndex(index);
    setImmediate(() => scrollPageTo(0, false));
  };

  const advanceIfCurrentPageValid = async (next: number) => {
    const result = await validatePage(currentPageIndex, true);
    if (result.isValid) showPageFromTop(next);
  };

  return {
    goToNextPage: async () => {
      if (nextVisiblePageIndex === null || !visibilitySettled) return;
      await advanceIfCurrentPageValid(nextVisiblePageIndex);
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
    /**
     * Resolves true when the form can be submitted. Short of that it moves
     * the member on: past the current page when it isn't the last, or back
     * to the first page with an error.
     */
    readyToSubmit: async (): Promise<boolean> => {
      if (nextVisiblePageIndex !== null) {
        await advanceIfCurrentPageValid(nextVisiblePageIndex);
        return false;
      }
      const { isValid, firstInvalidPageIndex } = await validateAllPages();
      if (isValid) return true;
      if (
        typeof firstInvalidPageIndex === "number" &&
        firstInvalidPageIndex !== currentPageIndex
      ) {
        showPageFromTop(firstInvalidPageIndex);
      }
      return false;
    },
  };
}
