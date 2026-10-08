import type { Page } from "@alliance/common/forms/form-schema";
import {
  CanvasTargetKind,
  ChildKind,
  elementTarget,
  followElement,
  forgetPositions,
  resolveTarget,
  targetKey,
  type CanvasTarget,
  type ChildTarget,
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

  it("keeps the child selected inside an id-less block it follows", () => {
    const target = {
      ...looseTarget,
      child: {
        kind: ChildKind.Section,
        section: { id: null, index: 0 },
      },
    } satisfies CanvasTarget;
    expect(
      followElement({
        before: page.fields,
        after: [a!, b!, loose!],
        target,
      }),
    ).toEqual({ ...target, index: 2 });
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

const containers: Page = {
  id: "p1",
  fields: [
    {
      id: "list",
      type: "input",
      kind: "list",
      label: "List",
      fields: [
        { id: "x", type: "input", kind: "text", label: "X" },
        { id: "y", type: "input", kind: "text", label: "Y" },
      ],
    },
    {
      id: "acc",
      type: "display",
      kind: "accordion",
      sections: [
        { title: "Loose", blocks: [] },
        {
          id: "s",
          title: "S",
          blocks: [{ id: "b", type: "display", kind: "text", text: "B" }],
        },
      ],
    },
  ],
};
const inside = (index: number, child: ChildTarget): CanvasTarget => ({
  ...elementTarget(containers.fields[index]!, index),
  child,
});
const resolveIn = (target: CanvasTarget) =>
  resolveTarget({
    page: containers,
    groups: new Map(),
    selection: { pageId: "p1", target },
  });

describe("resolveTarget inside an element", () => {
  it("finds a sub-field by id wherever it moved", () => {
    expect(
      resolveIn(
        inside(0, { kind: ChildKind.SubField, field: { id: "y", index: 0 } }),
      ),
    ).toEqual({
      kind: CanvasTargetKind.Element,
      index: 0,
      child: { kind: ChildKind.SubField, index: 1 },
    });
  });

  it("falls back to the section once its block is gone", () => {
    expect(
      resolveIn(
        inside(1, {
          kind: ChildKind.SectionBlock,
          section: { id: "s", index: 1 },
          block: { id: "gone", index: 0 },
        }),
      ),
    ).toEqual({
      kind: CanvasTargetKind.Element,
      index: 1,
      child: { kind: ChildKind.Section, section: 1 },
    });
  });

  it("falls back to the element once its child is gone", () => {
    expect(
      resolveIn(
        inside(0, { kind: ChildKind.SubField, field: { id: "z", index: 0 } }),
      ),
    ).toEqual({ kind: CanvasTargetKind.Element, index: 0 });
  });
});

describe("forgetPositions", () => {
  it("drops a child addressed by position, keeping its element", () => {
    const loose = inside(1, {
      kind: ChildKind.Section,
      section: { id: null, index: 0 },
    });
    expect(forgetPositions(loose)).toEqual(
      elementTarget(containers.fields[1]!, 1),
    );
  });

  it("keeps a child addressed by id", () => {
    const target = inside(1, {
      kind: ChildKind.Section,
      section: { id: "s", index: 1 },
    });
    expect(forgetPositions(target)).toBe(target);
  });

  it("drops a block addressed by position inside a section with an id", () => {
    const loose = inside(1, {
      kind: ChildKind.SectionBlock,
      section: { id: "s", index: 1 },
      block: { id: null, index: 0 },
    });
    expect(forgetPositions(loose)).toEqual(
      elementTarget(containers.fields[1]!, 1),
    );
  });

  it("keeps a block and a sub-field addressed by id", () => {
    const block = inside(1, {
      kind: ChildKind.SectionBlock,
      section: { id: "s", index: 1 },
      block: { id: "t", index: 0 },
    });
    expect(forgetPositions(block)).toBe(block);
    const field = inside(0, {
      kind: ChildKind.SubField,
      field: { id: "f", index: 0 },
    });
    expect(forgetPositions(field)).toBe(field);
  });

  it("drops an id-less element for the page", () => {
    expect(
      forgetPositions({ kind: CanvasTargetKind.Element, id: null, index: 0 }),
    ).toEqual({ kind: CanvasTargetKind.Page });
  });
});

describe("targetKey", () => {
  it("tells children apart from their element", () => {
    expect(
      targetKey(containers, {
        kind: CanvasTargetKind.Element,
        index: 1,
        child: { kind: ChildKind.SectionBlock, section: 1, block: 0 },
      }),
    ).toBe("element:p1/acc/section:s/block:b");
    expect(
      targetKey(containers, {
        kind: CanvasTargetKind.Element,
        index: 1,
        child: { kind: ChildKind.Section, section: 0 },
      }),
    ).toBe("element:p1/acc/section:@0");
  });
});
