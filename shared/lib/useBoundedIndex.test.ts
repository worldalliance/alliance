import { act, renderHook } from "@testing-library/react";
import { useBoundedIndex } from "./useBoundedIndex";

const render = (keys: string[]) =>
  renderHook(({ keys }) => useBoundedIndex(keys), {
    initialProps: { keys },
  });

it("keeps the selected item when another one is added before it", () => {
  const view = render(["a", "b"]);
  act(() => view.result.current.setIndex(1));

  view.rerender({ keys: ["new", "a", "b"] });

  expect(view.result.current.index).toBe(2);
});

it("keeps the initial selection when an item is added before it", () => {
  const view = render(["a", "b"]);

  view.rerender({ keys: ["new", "a", "b"] });

  expect(view.result.current.index).toBe(1);
});

it("keeps the selected item when one before it is removed", () => {
  const view = render(["a", "b", "c"]);
  act(() => view.result.current.setIndex(2));

  view.rerender({ keys: ["b", "c"] });

  expect(view.result.current.index).toBe(1);
});

it("stays at the removed item's position, clamped to the list", () => {
  const view = render(["a", "b", "c"]);
  act(() => view.result.current.setIndex(2));

  view.rerender({ keys: ["a", "b"] });
  expect(view.result.current.index).toBe(1);

  view.rerender({ keys: ["x", "a", "b"] });
  expect(view.result.current.index).toBe(2);
});

it("stays at the selected item's latest position when it leaves", () => {
  const view = render(["a", "b"]);

  view.rerender({ keys: ["x", "a", "b"] });
  view.rerender({ keys: ["x", "b"] });

  expect(view.result.current.index).toBe(1);
});

it("stays at a moved item's latest position when it leaves", () => {
  const view = render(["a", "b", "c", "d", "e"]);
  act(() => view.result.current.setIndex(2));

  view.rerender({ keys: ["c", "d", "e"] });
  view.rerender({ keys: ["d", "e"] });

  expect(view.result.current.index).toBe(0);
});

it("selects the first item once the list loads", () => {
  const view = render([]);

  view.rerender({ keys: ["a", "b"] });
  view.rerender({ keys: ["new", "a", "b"] });

  expect(view.result.current.index).toBe(1);
});

it("steps through the list within its bounds", () => {
  const view = render(["a", "b"]);

  act(() => view.result.current.goPrev());
  expect(view.result.current.index).toBe(0);
  act(() => view.result.current.goNext());
  act(() => view.result.current.goNext());
  expect(view.result.current.index).toBe(1);
  expect(view.result.current.canGoNext).toBe(false);
});
