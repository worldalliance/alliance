import { renderHook } from "@testing-library/react";

import { useInfiniteScrollSentinel } from "./useInfiniteScrollSentinel";

class FakeObserver implements IntersectionObserver {
  static instances: FakeObserver[] = [];
  readonly root = null;
  readonly rootMargin = "";
  readonly scrollMargin = "";
  readonly thresholds = [];
  observed: Element[] = [];
  disconnect = jest.fn();

  constructor(private callback: IntersectionObserverCallback) {
    FakeObserver.instances.push(this);
  }

  observe(node: Element) {
    this.observed.push(node);
  }

  takeRecords() {
    return [];
  }

  unobserve() {}

  intersect(isIntersecting: boolean) {
    const [target] = this.observed;
    const rect = target.getBoundingClientRect();
    this.callback(
      [
        {
          boundingClientRect: rect,
          intersectionRatio: isIntersecting ? 1 : 0,
          intersectionRect: rect,
          isIntersecting,
          rootBounds: null,
          target,
          time: 0,
        },
      ],
      this,
    );
  }
}

const realObserver = globalThis.IntersectionObserver;

beforeEach(() => {
  FakeObserver.instances = [];
  globalThis.IntersectionObserver = FakeObserver;
});

afterEach(() => {
  globalThis.IntersectionObserver = realObserver;
});

const setup = (initial: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}) => {
  const fetchNextPage = jest.fn();
  const hook = renderHook((props) => useInfiniteScrollSentinel(props), {
    initialProps: { fetchNextPage, ...initial },
  });
  const node = document.createElement("div");
  hook.result.current(node);
  return { fetchNextPage, hook, node };
};

test("fetches the next page when the sentinel intersects", () => {
  const { fetchNextPage, node } = setup({
    hasNextPage: true,
    isFetchingNextPage: false,
  });
  const [observer] = FakeObserver.instances;
  expect(observer.observed).toEqual([node]);

  observer.intersect(false);
  expect(fetchNextPage).not.toHaveBeenCalled();

  observer.intersect(true);
  expect(fetchNextPage).toHaveBeenCalledTimes(1);
});

test("skips fetching without a next page or while one is in flight", () => {
  const { fetchNextPage, hook } = setup({
    hasNextPage: false,
    isFetchingNextPage: false,
  });
  const [observer] = FakeObserver.instances;
  observer.intersect(true);

  hook.rerender({ fetchNextPage, hasNextPage: true, isFetchingNextPage: true });
  observer.intersect(true);
  expect(fetchNextPage).not.toHaveBeenCalled();

  hook.rerender({
    fetchNextPage,
    hasNextPage: true,
    isFetchingNextPage: false,
  });
  observer.intersect(true);
  expect(fetchNextPage).toHaveBeenCalledTimes(1);
});

test("disconnects when the sentinel detaches", () => {
  const { hook } = setup({ hasNextPage: true, isFetchingNextPage: false });
  hook.result.current(null);
  expect(FakeObserver.instances[0].disconnect).toHaveBeenCalled();
});
