import { createSelectedRowScroller } from "./selectedRowScroller";

function setup({ measured = true }: { measured?: boolean } = {}) {
  const list = {
    scrolledTo: [] as number[],
    scrollToIndex: ({ index }: { index: number }) => {
      list.scrolledTo.push(index);
    },
  };
  let mounted: typeof list | null = list;
  const scroller = createSelectedRowScroller({ getList: () => mounted });
  if (measured) scroller.measured();
  const unmount = () => {
    mounted = null;
  };
  const mount = () => {
    mounted = list;
  };
  return { list, scroller, unmount, mount };
}

describe("createSelectedRowScroller", () => {
  test("scrolls nowhere before the picker opens", () => {
    const { list, scroller } = setup();
    scroller.scroll(40);
    expect(list.scrolledTo).toEqual([]);
  });

  test("waits for a row to be measured", () => {
    const { list, scroller } = setup({ measured: false });
    scroller.open();
    scroller.scroll(40);
    expect(list.scrolledTo).toEqual([]);

    scroller.measured();
    scroller.scroll(40);
    expect(list.scrolledTo).toEqual([40]);
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

  test("scrolls nowhere after the member searches", () => {
    const { list, scroller } = setup();
    scroller.open();
    scroller.cancel();
    scroller.scroll(2);
    expect(list.scrolledTo).toEqual([]);
  });
});
