import type { Page } from "@alliance/common/forms/form-schema";
import { moveElements } from "./moveElements";

const block = (id: string) =>
  ({ id, type: "display", kind: "text", text: id }) as const;
const pages: Page[] = [
  { id: "p1", fields: ["a", "b", "c", "d"].map(block) },
  { id: "p2", fields: ["x", "y"].map(block) },
];
const ids = (result: Page[] | null) =>
  result?.map((page) => page.fields.map((element) => element.id));

it("moves a span to another page's gap", () => {
  expect(
    ids(
      moveElements({
        pages,
        from: { pageIndex: 0, start: 1, end: 3 },
        to: { pageIndex: 1, index: 1 },
      }),
    ),
  ).toEqual([
    ["a", "d"],
    ["x", "b", "c", "y"],
  ]);
});

it("moves a span to the end of another page", () => {
  expect(
    ids(
      moveElements({
        pages,
        from: { pageIndex: 1, start: 0, end: 1 },
        to: { pageIndex: 0, index: 4 },
      }),
    ),
  ).toEqual([["a", "b", "c", "d", "x"], ["y"]]);
});

it("moves a span later on its own page", () => {
  expect(
    ids(
      moveElements({
        pages,
        from: { pageIndex: 0, start: 0, end: 2 },
        to: { pageIndex: 0, index: 3 },
      }),
    ),
  ).toEqual([
    ["c", "a", "b", "d"],
    ["x", "y"],
  ]);
});

it("moves a span earlier on its own page", () => {
  expect(
    ids(
      moveElements({
        pages,
        from: { pageIndex: 0, start: 2, end: 4 },
        to: { pageIndex: 0, index: 0 },
      }),
    ),
  ).toEqual([
    ["c", "d", "a", "b"],
    ["x", "y"],
  ]);
});

it.each([1, 2, 3])(
  "leaves a span dropped at gap %d, its own edge or inside it",
  (index) => {
    expect(
      moveElements({
        pages,
        from: { pageIndex: 0, start: 1, end: 3 },
        to: { pageIndex: 0, index },
      }),
    ).toBeNull();
  },
);

it.each([
  { from: { pageIndex: 2, start: 0, end: 1 }, to: { pageIndex: 0, index: 0 } },
  { from: { pageIndex: 0, start: 1, end: 1 }, to: { pageIndex: 1, index: 0 } },
  { from: { pageIndex: 0, start: -1, end: 1 }, to: { pageIndex: 1, index: 0 } },
  { from: { pageIndex: 0, start: 3, end: 5 }, to: { pageIndex: 1, index: 0 } },
  { from: { pageIndex: 0, start: 0, end: 1 }, to: { pageIndex: 1, index: 3 } },
  { from: { pageIndex: 0, start: 0, end: 1 }, to: { pageIndex: 1, index: -1 } },
])("throws on a span or gap that isn't there: %o", ({ from, to }) => {
  expect(() => moveElements({ pages, from, to })).toThrow("invalid move");
});

it("leaves pages the move doesn't touch as they were", () => {
  const third: Page = { id: "p3", fields: [block("z")] };
  const moved = moveElements({
    pages: [...pages, third],
    from: { pageIndex: 0, start: 0, end: 1 },
    to: { pageIndex: 1, index: 0 },
  });
  expect(moved?.[2]).toBe(third);
});
