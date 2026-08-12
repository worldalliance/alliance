import {
  ListMarkerKind,
  markerColumnWidth,
  resolveListMarker,
} from "./markdownListLayout";

describe("markerColumnWidth", () => {
  test("is the unscaled column at the default text size", () => {
    expect(markerColumnWidth(1)).toBe(24);
  });

  test("scales with the OS text-size setting", () => {
    expect(markerColumnWidth(1.5)).toBe(36);
    expect(markerColumnWidth(2)).toBe(48);
  });
});

const BULLET_LIST = { type: "bullet_list" };
const LIST_ITEM = { type: "list_item" };
const ITEM = { index: 0 };

function orderedList(start?: unknown) {
  return {
    type: "ordered_list",
    attributes: start === undefined ? {} : { start },
  };
}

describe("resolveListMarker", () => {
  test("numbers an ordered list from one", () => {
    expect(
      resolveListMarker({ node: { index: 2 }, parent: [orderedList()] }),
    ).toEqual({ kind: ListMarkerKind.Ordered, glyph: "3." });
  });

  test("delimits with a period, matching web's `list-decimal`", () => {
    expect(
      resolveListMarker({ node: ITEM, parent: [orderedList()] }),
    ).toMatchObject({ glyph: "1." });
  });

  test("numbers from the `start` markdown-it sets on a renumbered list", () => {
    expect(
      resolveListMarker({ node: { index: 1 }, parent: [orderedList(99)] }),
    ).toEqual({ kind: ListMarkerKind.Ordered, glyph: "100." });
  });

  test("numbers from a `start` handed over as a string", () => {
    expect(
      resolveListMarker({ node: ITEM, parent: [orderedList("7")] }),
    ).toMatchObject({ glyph: "7." });
  });

  test("keeps a zero `start` rather than reading it as absent", () => {
    expect(
      resolveListMarker({ node: ITEM, parent: [orderedList(0)] }),
    ).toMatchObject({ glyph: "0." });
  });

  test("falls back to one when `start` is not a number at all", () => {
    for (const start of ["", "abc", null, {}]) {
      expect(
        resolveListMarker({ node: ITEM, parent: [orderedList(start)] }),
      ).toMatchObject({ glyph: "1." });
    }
  });

  test("numbers an ordered list nested under a bullet list", () => {
    expect(
      resolveListMarker({
        node: ITEM,
        parent: [orderedList(), LIST_ITEM, BULLET_LIST],
      }),
    ).toMatchObject({ kind: ListMarkerKind.Ordered, glyph: "1." });
  });

  test("bullets a bullet list nested under an ordered list", () => {
    expect(
      resolveListMarker({
        node: ITEM,
        parent: [BULLET_LIST, LIST_ITEM, orderedList()],
      }),
    ).toEqual({ kind: ListMarkerKind.Bullet, glyph: "\u2022" });
  });

  test("bullets with a full bullet rather than a middle dot", () => {
    const marker = resolveListMarker({ node: ITEM, parent: [BULLET_LIST] });
    expect(marker).toMatchObject({ glyph: "\u2022" });
    expect(marker).not.toMatchObject({ glyph: "\u00b7" });
  });

  test("leaves an item with no list parent unmarked", () => {
    expect(
      resolveListMarker({ node: ITEM, parent: [{ type: "blockquote" }] }),
    ).toEqual({ kind: ListMarkerKind.None });
    expect(resolveListMarker({ node: ITEM, parent: [] })).toEqual({
      kind: ListMarkerKind.None,
    });
  });
});
