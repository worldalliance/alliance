import { moveSpan } from "./useDragReorder";

const items = ["a", "b", "c", "d", "e"];

it.each([
  { index: 4, moved: ["a", "d", "b", "c", "e"], insertionIndex: 2 },
  { index: 5, moved: ["a", "d", "e", "b", "c"], insertionIndex: 3 },
  { index: 0, moved: ["b", "c", "a", "d", "e"], insertionIndex: 0 },
])("moves a run to gap $index", ({ index, moved, insertionIndex }) => {
  expect(moveSpan({ items, start: 1, end: 3, index })).toEqual({
    items: moved,
    insertionIndex,
  });
});

it.each([1, 2, 3])("leaves a run dropped at gap %d where it was", (index) => {
  expect(moveSpan({ items, start: 1, end: 3, index })).toBeNull();
});
