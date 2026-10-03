import type { DisplayBlock } from "@alliance/common/forms/display-blocks";
import type { Page, PageItem } from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import {
  deriveVisibilityGroups,
  detachMember,
  joinNeighbor,
  mergeGroups,
  normalizeVisibilityGroups,
  pageSegments,
  SegmentKind,
  setGroupVisibility,
  splitGroup,
  ungroup,
  type VisibilityGroups,
} from "./visibilityGroups";

const shownWhen = (value: string): VisibleIfFormula => ({
  conditions: { c1: { kind: "equals", when: "q", equals: value } },
  formula: "c1",
});
const X = shownWhen("x");
const Y = shownWhen("y");

const text = (id: string, visibleIfFormula?: VisibleIfFormula): PageItem => ({
  id,
  type: "input",
  kind: "text",
  label: id,
  ...(visibleIfFormula ? { visibleIfFormula } : {}),
});
const label = (
  id: string,
  visibleIfFormula?: VisibleIfFormula,
): DisplayBlock => ({
  id,
  type: "display",
  kind: "label",
  text: "",
  ...(visibleIfFormula ? { visibleIfFormula } : {}),
});

/** Each group's member ids, in document order. */
function memberLists(pages: Page[], groups: VisibilityGroups): string[][] {
  return pages.flatMap((page) =>
    pageSegments(page.fields, groups).flatMap((segment) =>
      segment.kind === SegmentKind.Group
        ? [page.fields.slice(segment.start, segment.end).map((f) => f.id ?? "")]
        : [],
    ),
  );
}

const keyOf = (groups: VisibilityGroups, id: string) => {
  const key = groups.get(id);
  if (!key) throw new Error(`${id} is not grouped`);
  return key;
};

const formulaOf = (pages: Page[], id: string) =>
  pages.flatMap((page) => page.fields).find((f) => f.id === id)
    ?.visibleIfFormula;

describe("deriveVisibilityGroups", () => {
  it("groups maximal matching runs of two or more within a page", () => {
    const pages: Page[] = [
      {
        id: "p1",
        fields: [
          text("A", X),
          text("B", X),
          text("C"),
          text("D", X),
          label("E", X),
        ],
      },
      { id: "p2", fields: [text("F", X), text("G", Y)] },
    ];
    expect(memberLists(pages, deriveVisibilityGroups(pages))).toEqual([
      ["A", "B"],
      ["D", "E"],
    ]);
  });

  it("matches conditions regardless of object key order", () => {
    const reordered: VisibleIfFormula = {
      formula: "c1",
      conditions: { c1: { equals: "x", when: "q", kind: "equals" } },
    };
    const pages: Page[] = [
      { id: "p", fields: [text("A", X), text("B", reordered)] },
    ];
    expect(memberLists(pages, deriveVisibilityGroups(pages))).toEqual([
      ["A", "B"],
    ]);
  });

  it("keeps structurally different equivalent conditions apart", () => {
    const renamed: VisibleIfFormula = {
      conditions: { c2: { kind: "equals", when: "q", equals: "x" } },
      formula: "c2",
    };
    const pages: Page[] = [
      { id: "p", fields: [text("A", X), text("B", renamed)] },
    ];
    expect(memberLists(pages, deriveVisibilityGroups(pages))).toEqual([]);
  });

  it("leaves elements without a condition or an id ungrouped", () => {
    const anonymous: DisplayBlock = { ...label("", X), id: undefined };
    const pages: Page[] = [
      { id: "p", fields: [text("A"), text("B"), anonymous, text("C", X)] },
    ];
    expect(memberLists(pages, deriveVisibilityGroups(pages))).toEqual([]);
  });
});

describe("membership operations", () => {
  const fiveMembers: Page[] = [
    {
      id: "p",
      fields: ["A", "B", "C", "D", "E"].map((id) => text(id, X)),
    },
  ];
  const grouped = deriveVisibilityGroups(fiveMembers);
  const key = keyOf(grouped, "A");

  it("splits at a boundary without touching conditions", () => {
    const split = splitGroup(grouped, {
      fields: fiveMembers[0].fields,
      key,
      index: 2,
    });
    expect(memberLists(fiveMembers, split)).toEqual([
      ["A", "B"],
      ["C", "D", "E"],
    ]);
  });

  it("detaching a middle member leaves separate runs on either side", () => {
    const detached = normalizeVisibilityGroups(
      fiveMembers,
      detachMember(grouped, "C"),
    );
    expect(memberLists(fiveMembers, detached)).toEqual([
      ["A", "B"],
      ["D", "E"],
    ]);
    expect(keyOf(detached, "A")).not.toBe(keyOf(detached, "D"));
  });

  it("ungrouping keeps every condition", () => {
    expect(memberLists(fiveMembers, ungroup(grouped, key))).toEqual([]);
  });

  it("drops the wrapper once a group is down to one member", () => {
    const pair: Page[] = [{ id: "p", fields: [text("A", X), text("B", X)] }];
    const groups = deriveVisibilityGroups(pair);
    expect(
      memberLists(
        pair,
        normalizeVisibilityGroups(pair, detachMember(groups, "A")),
      ),
    ).toEqual([]);
  });

  it("writes a shared condition to every member, and clearing dissolves", () => {
    const edited = setGroupVisibility({
      pages: fiveMembers,
      groups: grouped,
      key,
      formula: Y,
    });
    expect(memberLists(edited.pages, edited.groups)).toEqual([
      ["A", "B", "C", "D", "E"],
    ]);
    expect(edited.pages[0].fields.map((f) => f.visibleIfFormula)).toEqual(
      Array(5).fill(Y),
    );

    const cleared = setGroupVisibility({
      pages: fiveMembers,
      groups: grouped,
      key,
      formula: undefined,
    });
    expect(cleared.groups.size).toBe(0);
    expect(
      cleared.pages[0].fields.every((f) => !("visibleIfFormula" in f)),
    ).toBe(true);
  });
});

describe("joining and merging", () => {
  it("adopts only the destination group's condition", () => {
    const pages: Page[] = [
      { id: "p", fields: [text("A", X), text("B", X), text("C", Y)] },
    ];
    const groups = deriveVisibilityGroups(pages);
    const [, , joining] = pages[0].fields;
    const joined = joinNeighbor({
      pages,
      groups,
      element: joining,
      neighbor: pages[0].fields[1],
    });
    const normalized = normalizeVisibilityGroups(joined.pages, joined.groups);
    expect(memberLists(joined.pages, normalized)).toEqual([["A", "B", "C"]]);
    expect(formulaOf(joined.pages, "C")).toEqual(X);
  });

  it("forms a new group with a conditional element outside any group", () => {
    const pages: Page[] = [{ id: "p", fields: [text("A"), text("B", Y)] }];
    const joined = joinNeighbor({
      pages,
      groups: new Map(),
      element: pages[0].fields[0],
      neighbor: pages[0].fields[1],
    });
    expect(
      memberLists(
        joined.pages,
        normalizeVisibilityGroups(joined.pages, joined.groups),
      ),
    ).toEqual([["A", "B"]]);
  });

  it("merges adjacent groups under the chosen condition", () => {
    const pages: Page[] = [
      {
        id: "p",
        fields: [text("A", X), text("B", X), text("C", Y), text("D", Y)],
      },
    ];
    const groups = deriveVisibilityGroups(pages);
    const merged = mergeGroups({
      pages,
      groups,
      previousKey: keyOf(groups, "A"),
      nextKey: keyOf(groups, "C"),
      formula: Y,
    });
    expect(memberLists(merged.pages, merged.groups)).toEqual([
      ["A", "B", "C", "D"],
    ]);
    expect(formulaOf(merged.pages, "A")).toEqual(Y);
  });
});

describe("normalizeVisibilityGroups", () => {
  it("keeps split halves apart when their conditions still match", () => {
    const pages: Page[] = [
      { id: "p", fields: ["A", "B", "C", "D"].map((id) => text(id, X)) },
    ];
    const groups = deriveVisibilityGroups(pages);
    const split = splitGroup(groups, {
      fields: pages[0].fields,
      key: keyOf(groups, "A"),
      index: 2,
    });
    expect(normalizeVisibilityGroups(pages, split)).toBe(split);
  });

  it("does not merge runs once an intervening element is deleted", () => {
    const pages: Page[] = [
      {
        id: "p",
        fields: [
          text("A", X),
          text("B", X),
          text("C"),
          text("D", X),
          text("E", X),
        ],
      },
    ];
    const groups = deriveVisibilityGroups(pages);
    const withoutC: Page[] = [
      { ...pages[0], fields: pages[0].fields.filter((f) => f.id !== "C") },
    ];
    expect(
      memberLists(withoutC, normalizeVisibilityGroups(withoutC, groups)),
    ).toEqual([
      ["A", "B"],
      ["D", "E"],
    ]);
  });

  it("detaches a member whose condition changes elsewhere", () => {
    const pages: Page[] = [
      { id: "p", fields: ["A", "B", "C", "D", "E"].map((id) => text(id, X)) },
    ];
    const groups = deriveVisibilityGroups(pages);
    const edited: Page[] = [
      {
        ...pages[0],
        fields: pages[0].fields.map((f) =>
          f.id === "C" ? { ...f, visibleIfFormula: Y } : f,
        ),
      },
    ];
    expect(
      memberLists(edited, normalizeVisibilityGroups(edited, groups)),
    ).toEqual([
      ["A", "B"],
      ["D", "E"],
    ]);
  });

  it("keeps membership through unrelated edits", () => {
    const pages: Page[] = [{ id: "p", fields: [text("A", X), text("B", X)] }];
    const groups = deriveVisibilityGroups(pages);
    const relabeled: Page[] = [
      {
        ...pages[0],
        fields: pages[0].fields.map((f) => ({ ...f, label: "renamed" })),
      },
    ];
    expect(normalizeVisibilityGroups(relabeled, groups)).toBe(groups);
  });

  it("splits a group around a moved-in element, which keeps its condition", () => {
    const pages: Page[] = [
      {
        id: "p",
        fields: [
          text("A", X),
          text("B", X),
          text("C", X),
          text("D", X),
          text("M", Y),
        ],
      },
    ];
    const groups = deriveVisibilityGroups(pages);
    const [a, b, c, d, m] = pages[0].fields;
    const moved: Page[] = [{ ...pages[0], fields: [a, b, m, c, d] }];
    expect(
      memberLists(moved, normalizeVisibilityGroups(moved, groups)),
    ).toEqual([
      ["A", "B"],
      ["C", "D"],
    ]);
    expect(formulaOf(moved, "M")).toEqual(Y);
  });
});

describe("per-user display content", () => {
  const perUser = (id: string, formula: VisibleIfFormula): DisplayBlock => ({
    ...label(id, formula),
    manualPerUser: true,
    manualUserContent: { "7": { text: "for 7", visibleIfFormula: formula } },
  });
  const page = (fields: PageItem[]): Page[] => [{ id: "p", fields }];
  const userFormula = (pages: Page[], id: string) => {
    const element = pages[0].fields.find((field) => field.id === id);
    return element?.type === "display"
      ? element.manualUserContent?.["7"]?.visibleIfFormula
      : undefined;
  };

  it("takes a group's shared condition, and loses it when cleared", () => {
    const pages = page([perUser("a", X), label("b", X)]);
    const groups = deriveVisibilityGroups(pages);
    const key = keyOf(groups, "a");
    const edited = setGroupVisibility({ pages, groups, key, formula: Y });
    expect(userFormula(edited.pages, "a")).toEqual(Y);
    const cleared = setGroupVisibility({
      pages,
      groups,
      key,
      formula: undefined,
    });
    expect(userFormula(cleared.pages, "a")).toBeUndefined();
  });

  it("takes the condition it adopts by joining or merging", () => {
    const pages = page([perUser("a", X), label("b", Y)]);
    const [element, neighbor] = pages[0].fields;
    const joined = joinNeighbor({
      pages,
      groups: new Map(),
      element,
      neighbor,
    });
    expect(userFormula(joined.pages, "a")).toEqual(Y);

    const four = page([
      perUser("a", X),
      label("b", X),
      label("c", Y),
      label("d", Y),
    ]);
    const groups = deriveVisibilityGroups(four);
    const merged = mergeGroups({
      pages: four,
      groups,
      previousKey: keyOf(groups, "a"),
      nextKey: keyOf(groups, "c"),
      formula: Y,
    });
    expect(userFormula(merged.pages, "a")).toEqual(Y);
  });
});
