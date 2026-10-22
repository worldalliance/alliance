import type { FlatList } from "react-native";

type List = Pick<FlatList<unknown>, "scrollToIndex">;

export function createSelectedRowScroller({
  getList,
}: {
  getList: () => List | null;
}) {
  let pending = false;
  // Without getItemLayout, scrollToIndex throws on a row past the measured
  // ones, and the list only gets getItemLayout once a row is measured.
  let measured = false;

  return {
    open: () => {
      pending = true;
    },
    // Once the member types, the rows are theirs to scroll.
    cancel: () => {
      pending = false;
    },
    measured: () => {
      measured = true;
    },
    scroll: (index: number) => {
      const list = getList();
      if (!pending || !measured || index < 0 || !list) return;
      pending = false;
      list.scrollToIndex({ index, viewPosition: 0.5, animated: false });
    },
  };
}
