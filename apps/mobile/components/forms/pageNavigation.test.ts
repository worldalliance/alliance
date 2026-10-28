import { pageNavigation } from "./pageNavigation";

function setup({
  currentPageIndex = 0,
  nextVisiblePageIndex = 1,
  previousVisiblePageIndex = null,
  visibilitySettled = true,
  pageValid = true,
}: {
  currentPageIndex?: number;
  nextVisiblePageIndex?: number | null;
  previousVisiblePageIndex?: number | null;
  visibilitySettled?: boolean;
  pageValid?: boolean;
} = {}) {
  const shown: number[] = [];
  const validatedPages: number[] = [];
  const calls = { shown, scrolledTop: 0, scrolledEnd: 0, validatedPages };
  const navigation = pageNavigation({
    currentPageIndex,
    setCurrentPageIndex: (index) => calls.shown.push(index),
    nextVisiblePageIndex,
    previousVisiblePageIndex,
    visibilitySettled,
    validatePage: async (pageIndex) => {
      calls.validatedPages.push(pageIndex);
      return { isValid: pageValid };
    },
    scrollPageTo: () => calls.scrolledTop++,
    scrollToEnd: () => calls.scrolledEnd++,
  });
  return { navigation, calls };
}

const flushImmediate = () => new Promise((resolve) => setImmediate(resolve));

describe("pageNavigation", () => {
  test("advances past a valid page and scrolls to its top", async () => {
    const { navigation, calls } = setup();
    await navigation.goToNextPage();
    await flushImmediate();
    expect(calls.validatedPages).toEqual([0]);
    expect(calls.shown).toEqual([1]);
    expect(calls.scrolledTop).toBe(1);
  });

  test("stays on an invalid page", async () => {
    const { navigation, calls } = setup({ pageValid: false });
    await navigation.goToNextPage();
    expect(calls.shown).toEqual([]);
  });

  test("waits for visibility to settle before advancing", async () => {
    const { navigation, calls } = setup({ visibilitySettled: false });
    await navigation.goToNextPage();
    expect(calls.validatedPages).toEqual([]);
    expect(calls.shown).toEqual([]);
  });

  test("goes back to the end of the previous page", async () => {
    const { navigation, calls } = setup({
      currentPageIndex: 2,
      previousVisiblePageIndex: 0,
    });
    navigation.goToPreviousPage();
    await flushImmediate();
    expect(calls.shown).toEqual([0]);
    expect(calls.scrolledEnd).toBe(1);
  });

  test("browses a completed form without validating", async () => {
    const { navigation, calls } = setup({ pageValid: false });
    navigation.browseToNextPage?.();
    expect(calls.validatedPages).toEqual([]);
    expect(calls.shown).toEqual([1]);
  });

  test("offers no browsing past the last page", () => {
    const { navigation } = setup({ nextVisiblePageIndex: null });
    expect(navigation.browseToNextPage).toBeNull();
  });

  describe("showFirstInvalidPage", () => {
    test("returns to the first page with an error", async () => {
      const { navigation, calls } = setup({ currentPageIndex: 2 });
      navigation.showFirstInvalidPage(0);
      expect(calls.shown).toEqual([0]);
      await flushImmediate();
      expect(calls.scrolledTop).toBe(1);
    });

    test("stays put when the error is on the current page", () => {
      const { navigation, calls } = setup({ currentPageIndex: 2 });
      navigation.showFirstInvalidPage(2);
      expect(calls.shown).toEqual([]);
    });

    test("stays put when no page has an error", () => {
      const { navigation, calls } = setup();
      navigation.showFirstInvalidPage(null);
      expect(calls.shown).toEqual([]);
    });
  });
});
