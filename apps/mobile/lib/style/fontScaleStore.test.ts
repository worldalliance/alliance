import { createFontScaleStore } from "./fontScaleStore";

function stubSource(initial: number) {
  let fontScale = initial;
  let watchers = 0;
  let onChange: (() => void) | null = null;

  return {
    read: () => fontScale,
    watch: (notify: () => void) => {
      watchers += 1;
      onChange = notify;
    },
    change: (next: number) => {
      fontScale = next;
      onChange?.();
    },
    setSilently: (next: number) => {
      fontScale = next;
    },
    watcherCount: () => watchers,
  };
}

describe("createFontScaleStore", () => {
  test("subscribing picks up a change that landed before it", () => {
    const source = stubSource(1);
    const store = createFontScaleStore(source);

    source.setSilently(1.35);
    store.subscribe(() => {});

    expect(store.getSnapshot()).toBe(1.35);
  });

  test("a change notifies every subscriber", () => {
    const source = stubSource(1);
    const store = createFontScaleStore(source);
    const seen: number[] = [];
    store.subscribe(() => seen.push(store.getSnapshot()));
    store.subscribe(() => seen.push(store.getSnapshot()));

    source.change(2);

    expect(seen).toEqual([2, 2]);
  });

  test("a change that leaves the text size alone notifies nobody", () => {
    const source = stubSource(1);
    const store = createFontScaleStore(source);
    const seen: number[] = [];
    store.subscribe(() => seen.push(store.getSnapshot()));

    source.change(1);

    expect(seen).toEqual([]);
  });

  test("every subscriber shares one watcher", () => {
    const source = stubSource(1);
    const store = createFontScaleStore(source);

    store.subscribe(() => {});
    store.subscribe(() => {});

    expect(source.watcherCount()).toBe(1);
  });

  test("unsubscribing stops the notifications", () => {
    const source = stubSource(1);
    const store = createFontScaleStore(source);
    const seen: number[] = [];
    const unsubscribe = store.subscribe(() => seen.push(store.getSnapshot()));

    unsubscribe();
    source.change(2);

    expect(seen).toEqual([]);
  });
});
