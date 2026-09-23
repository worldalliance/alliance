import { createSelectedRowScroller } from "./selectedRowScroller";

// Mirrors VirtualizedList.scrollToIndex: an index past the rows throws, and
// one past the measured rows reports a failure instead of scrolling.
function fakeList({ rows, measured }: { rows: number; measured: number }) {
  const list = {
    rows,
    measured,
    scrolledTo: [] as number[],
    offsets: [] as number[],
    onFailed: (_: { index: number; averageItemLength: number }) => {},
    scrollToIndex: ({ index }: { index: number }) => {
      if (index >= list.rows) throw new Error(`index ${index} out of range`);
      if (index > list.measured) {
        list.onFailed({ index, averageItemLength: 50 });
        return;
      }
      list.scrolledTo.push(index);
    },
    scrollToOffset: ({ offset }: { offset: number }) => {
      list.offsets.push(offset);
    },
  };
  return list;
}

function setup({
  rows = 60,
  measured = 60,
}: { rows?: number; measured?: number } = {}) {
  const list = fakeList({ rows, measured });
  let mounted: typeof list | null = list;
  const frames: (() => void)[] = [];
  const landed = { count: 0 };
  const scroller = createSelectedRowScroller({
    getList: () => mounted,
    onLanded: () => landed.count++,
    nextFrame: (run) => frames.push(run),
  });
  list.onFailed = scroller.failed;
  const runFrames = () => frames.splice(0).forEach((run) => run());
  const unmount = () => {
    mounted = null;
  };
  const mount = () => {
    mounted = list;
  };
  return { list, scroller, landed, runFrames, unmount, mount };
}

describe("createSelectedRowScroller", () => {
  test("scrolls nowhere before the picker opens", () => {
    const { list, scroller } = setup();
    scroller.scroll(40);
    expect(list.scrolledTo).toEqual([]);
  });

  test("scrolls to the selected row once per open", () => {
    const { list, scroller } = setup();
    scroller.open();
    scroller.scroll(40);
    scroller.scroll(40);
    expect(list.scrolledTo).toEqual([40]);

    scroller.open();
    scroller.scroll(40);
    expect(list.scrolledTo).toEqual([40, 40]);
  });

  test("waits for the list to mount", () => {
    const { list, scroller, unmount, mount } = setup();
    unmount();
    scroller.open();
    scroller.scroll(40);
    mount();
    scroller.scroll(40);
    expect(list.scrolledTo).toEqual([40]);
  });

  test("waits while the selected row is filtered out", () => {
    const { list, scroller } = setup();
    scroller.open();
    scroller.scroll(-1);
    scroller.scroll(40);
    expect(list.scrolledTo).toEqual([40]);
  });

  test("steps toward an unmeasured row and retries on the next frame", () => {
    const { list, scroller, landed, runFrames } = setup({ measured: 10 });
    scroller.open();
    scroller.scroll(40);
    expect(list.offsets).toEqual([2000]);
    expect(list.scrolledTo).toEqual([]);
    expect(landed.count).toBe(0);

    list.measured = 60;
    runFrames();
    expect(list.scrolledTo).toEqual([40]);
    expect(landed.count).toBe(1);
  });

  test("reports landing once per open", () => {
    const { scroller, landed } = setup();
    scroller.open();
    scroller.scroll(40);
    scroller.scroll(40);
    expect(landed.count).toBe(1);
  });

  test("drops a queued retry once the member searches", () => {
    const { list, scroller, runFrames } = setup({ measured: 10 });
    scroller.open();
    scroller.scroll(40);
    scroller.cancel();
    list.rows = 3;
    list.measured = 3;
    expect(runFrames).not.toThrow();
    expect(list.scrolledTo).toEqual([]);
  });

  test("scrolls nowhere after the member searches", () => {
    const { list, scroller } = setup();
    scroller.open();
    scroller.cancel();
    scroller.scroll(2);
    expect(list.scrolledTo).toEqual([]);
  });
});
