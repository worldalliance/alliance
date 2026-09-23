import type { FlatList } from "react-native";

type List = Pick<FlatList<unknown>, "scrollToIndex" | "scrollToOffset">;

type ScrollToIndexFailure = { index: number; averageItemLength: number };

export function createSelectedRowScroller({
  getList,
  onLanded,
  nextFrame = requestAnimationFrame,
}: {
  getList: () => List | null;
  onLanded: () => void;
  nextFrame?: (run: () => void) => void;
}) {
  let pending = false;

  const scroll = (index: number) => {
    const list = getList();
    if (!pending || index < 0 || !list) return;
    pending = false;
    list.scrollToIndex({ index, viewPosition: 0.5, animated: false });
    // A failed scroll re-arms pending before scrollToIndex returns.
    if (!pending) onLanded();
  };

  return {
    open: () => {
      pending = true;
    },
    // A retry queued before a search narrowed the rows would carry an index
    // past the end of them, which scrollToIndex throws on.
    cancel: () => {
      pending = false;
    },
    scroll,
    // Rows vary in height, so a row past the measured ones has no offset yet,
    // and the list ends at the last measured row: step toward it and retry.
    failed: ({ index, averageItemLength }: ScrollToIndexFailure) => {
      pending = true;
      getList()?.scrollToOffset({
        offset: averageItemLength * index,
        animated: false,
      });
      nextFrame(() => scroll(index));
    },
  };
}
