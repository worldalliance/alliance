import type { Page } from "@alliance/common/forms/form-schema";
import {
  CanvasTargetKind,
  elementTarget,
  followElement,
  resolveTarget,
  type CanvasTarget,
} from "./canvasSelection";

const shown = {
  conditions: { c1: { kind: "userHasCity" as const, userHasCity: true } },
  formula: "c1",
};
const page: Page = {
  id: "p1",
  fields: [
    { type: "display", kind: "text", text: "No id" },
    {
      id: "a",
      type: "input",
      kind: "text",
      label: "A",
      visibleIfFormula: shown,
    },
    {
      id: "b",
      type: "input",
      kind: "text",
      label: "B",
      visibleIfFormula: shown,
    },
  ],
};
const groups = new Map([
  ["a", "g"],
  ["b", "g"],
]);
const resolve = (target: CanvasTarget, pageId = "p1") =>
  resolveTarget({ page, groups, selection: { pageId, target } });

describe("resolveTarget", () => {
  it("finds an element by id wherever it moved", () => {
    expect(
      resolve({ kind: CanvasTargetKind.Element, id: "b", index: 0 }),
    ).toEqual({ kind: CanvasTargetKind.Element, index: 2 });
  });

  it("keeps to the selected one of elements sharing an id", () => {
    const duplicated: Page = {
      id: "p1",
      fields: [
        { id: "dup", type: "input", kind: "text", label: "Alpha" },
        { id: "dup", type: "input", kind: "text", label: "Beta" },
      ],
    };
    expect(
      resolveTarget({
        page: duplicated,
        groups: new Map(),
        selection: {
          pageId: "p1",
          target: elementTarget(duplicated.fields[1]!, 1),
        },
      }),
    ).toEqual({ kind: CanvasTargetKind.Element, index: 1 });
  });

  it("finds an id-less block only at its position", () => {
    expect(resolve(elementTarget(page.fields[0]!, 0))).toEqual({
      kind: CanvasTargetKind.Element,
      index: 0,
    });
    expect(
      resolve({ kind: CanvasTargetKind.Element, id: null, index: 1 }),
    ).toEqual({ kind: CanvasTargetKind.Page });
  });

  it("finds a group's current members", () => {
    expect(resolve({ kind: CanvasTargetKind.Group, key: "g" })).toEqual({
      kind: CanvasTargetKind.Group,
      key: "g",
      start: 1,
      end: 3,
    });
  });

  it("falls back to the page for what's gone or on another page", () => {
    expect(
      resolve({ kind: CanvasTargetKind.Element, id: "gone", index: 1 }),
    ).toEqual({ kind: CanvasTargetKind.Page });
    expect(resolve({ kind: CanvasTargetKind.Group, key: "old" })).toEqual({
      kind: CanvasTargetKind.Page,
    });
    expect(
      resolve({ kind: CanvasTargetKind.Element, id: "a", index: 1 }, "p2"),
    ).toEqual({ kind: CanvasTargetKind.Page });
  });
});

describe("followElement", () => {
  const [loose, a, b] = page.fields;
  const looseTarget = elementTarget(loose!, 0);

  it("follows an id-less block to its new position", () => {
    expect(
      followElement({
        before: page.fields,
        after: [a!, b!, loose!],
        target: looseTarget,
      }),
    ).toEqual(elementTarget(loose!, 2));
  });

  it("gives way to the page once the id-less block is gone", () => {
    expect(
      followElement({
        before: page.fields,
        after: [a!, b!],
        target: looseTarget,
      }),
    ).toEqual({ kind: CanvasTargetKind.Page });
  });

  it("leaves a target addressed by id alone", () => {
    const target = elementTarget(a!, 1);
    expect(
      followElement({ before: page.fields, after: [b!, a!], target }),
    ).toBe(target);
  });
});
