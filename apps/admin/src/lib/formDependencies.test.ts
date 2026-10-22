import { PlaceKind } from "@alliance/common/forms/form-conditions";
import { type Page, type PageItem } from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import {
  DependencyRole,
  DependentEntryKind,
  dependentsOf,
  dependentsOutside,
  findQuestion,
  groupDependents,
  sourcesOf,
} from "./formDependencies";
import { deriveVisibilityGroups } from "./visibilityGroups";

const reads = (when: string, sourceFormId?: number): VisibleIfFormula => ({
  conditions: {
    c1: {
      kind: "hasValue",
      when,
      hasValue: true,
      ...(sourceFormId === undefined ? {} : { sourceFormId }),
    },
  },
  formula: "c1",
});

const text = (
  id: string,
  formulas: {
    visibleIfFormula?: VisibleIfFormula;
    requiredIfFormula?: VisibleIfFormula;
  } = {},
): PageItem => ({ id, type: "input", kind: "text", label: id, ...formulas });

const pages: Page[] = [
  {
    id: "p1",
    title: "One",
    fields: [
      text("a"),
      {
        id: "list",
        type: "input",
        kind: "list",
        label: "List",
        fields: [
          { id: "sub1", type: "input", kind: "text", label: "Sub 1" },
          {
            id: "sub2",
            type: "input",
            kind: "text",
            label: "Sub 2",
            visibleIfFormula: reads("sub1"),
          },
        ],
      },
      text("b", { visibleIfFormula: reads("a") }),
      text("c", { visibleIfFormula: reads("a") }),
      text("d", {
        requiredIfFormula: reads("a"),
        visibleIfFormula: reads("x", 7),
      }),
    ],
  },
  { id: "p2", title: "Two", visibleIfFormula: reads("a"), fields: [] },
];

describe("formDependencies", () => {
  it("finds top-level and list questions", () => {
    expect(findQuestion(pages, "a")).toEqual({
      kind: PlaceKind.Element,
      pageIndex: 0,
      index: 0,
    });
    expect(findQuestion(pages, "sub1")).toEqual({
      kind: PlaceKind.SubField,
      pageIndex: 0,
      index: 1,
      subIndex: 0,
    });
    expect(findQuestion(pages, "gone")).toBeNull();
  });

  it("finds the last of questions sharing an id", () => {
    expect(
      findQuestion([{ id: "p", fields: [text("a"), text("a")] }], "a"),
    ).toEqual({ kind: PlaceKind.Element, pageIndex: 0, index: 1 });
  });

  it("lists what a formula reads, on this form, missing, or elsewhere", () => {
    expect(sourcesOf(pages, pages[0]!.fields[4]!)).toEqual([
      {
        sourceFormId: 7,
        fieldId: "x",
        roles: [DependencyRole.Visibility],
      },
      {
        sourceFormId: null,
        fieldId: "a",
        place: { kind: PlaceKind.Element, pageIndex: 0, index: 0 },
        roles: [DependencyRole.Required],
      },
    ]);
    expect(sourcesOf(pages, { visibleIfFormula: reads("gone") })).toEqual([
      {
        sourceFormId: null,
        fieldId: "gone",
        place: null,
        roles: [DependencyRole.Visibility],
      },
    ]);
  });

  it("lists one source once with each role it plays", () => {
    expect(
      sourcesOf(pages, {
        visibleIfFormula: reads("a"),
        requiredIfFormula: reads("a"),
      }).map(({ roles }) => roles),
    ).toEqual([[DependencyRole.Visibility, DependencyRole.Required]]);
  });

  it("lists pages, elements, and sub-fields reading a question", () => {
    expect(dependentsOf(pages, new Set(["a"]))).toEqual([
      {
        place: { kind: PlaceKind.Element, pageIndex: 0, index: 2 },
        roles: [DependencyRole.Visibility],
      },
      {
        place: { kind: PlaceKind.Element, pageIndex: 0, index: 3 },
        roles: [DependencyRole.Visibility],
      },
      {
        place: { kind: PlaceKind.Element, pageIndex: 0, index: 4 },
        roles: [DependencyRole.Required],
      },
      {
        place: { kind: PlaceKind.Page, pageIndex: 1 },
        roles: [DependencyRole.Visibility],
      },
    ]);
    expect(dependentsOf(pages, new Set(["sub1"]))).toEqual([
      {
        place: {
          kind: PlaceKind.SubField,
          pageIndex: 0,
          index: 1,
          subIndex: 1,
        },
        roles: [DependencyRole.Visibility],
      },
    ]);
  });

  it("ignores another form's question with the same id", () => {
    expect(dependentsOf(pages, new Set(["x"]))).toEqual([]);
  });

  it("gathers a visibility group's members into one entry", () => {
    const entries = groupDependents({
      pages,
      groups: deriveVisibilityGroups(pages),
      dependents: dependentsOf(pages, new Set(["a"])),
    });
    expect(entries.map((entry) => entry.kind)).toEqual([
      DependentEntryKind.Group,
      DependentEntryKind.Single,
      DependentEntryKind.Single,
    ]);
    const [group] = entries;
    expect(
      group?.kind === DependentEntryKind.Group &&
        group.members.map(({ place }) => place),
    ).toEqual([
      { kind: PlaceKind.Element, pageIndex: 0, index: 2 },
      { kind: PlaceKind.Element, pageIndex: 0, index: 3 },
    ]);
  });
});

describe("dependentsOutside", () => {
  it("lists what reads a deleted question, apart from itself", () => {
    expect(
      dependentsOutside(pages, {
        kind: PlaceKind.Element,
        pageIndex: 0,
        index: 0,
      }).map(({ place }) => place),
    ).toEqual([
      { kind: PlaceKind.Element, pageIndex: 0, index: 2 },
      { kind: PlaceKind.Element, pageIndex: 0, index: 3 },
      { kind: PlaceKind.Element, pageIndex: 0, index: 4 },
      { kind: PlaceKind.Page, pageIndex: 1 },
    ]);
  });

  it("leaves out readers deleted with their source", () => {
    expect(
      dependentsOutside(pages, { kind: PlaceKind.Page, pageIndex: 0 }).map(
        ({ place }) => place,
      ),
    ).toEqual([{ kind: PlaceKind.Page, pageIndex: 1 }]);
    expect(
      dependentsOutside(pages, {
        kind: PlaceKind.Element,
        pageIndex: 0,
        index: 1,
      }),
    ).toEqual([]);
  });

  it("lists sibling sub-fields reading a deleted sub-field", () => {
    expect(
      dependentsOutside(pages, {
        kind: PlaceKind.SubField,
        pageIndex: 0,
        index: 1,
        subIndex: 0,
      }).map(({ place }) => place),
    ).toEqual([
      { kind: PlaceKind.SubField, pageIndex: 0, index: 1, subIndex: 1 },
    ]);
  });

  it("leaves out readers of an id another question still carries", () => {
    expect(
      dependentsOutside(
        [
          {
            id: "p",
            fields: [
              text("a"),
              text("a"),
              text("b", { visibleIfFormula: reads("a") }),
            ],
          },
        ],
        { kind: PlaceKind.Element, pageIndex: 0, index: 0 },
      ),
    ).toEqual([]);
  });
});
