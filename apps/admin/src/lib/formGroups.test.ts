import type { PageItem } from "@alliance/common/forms/form-schema";
import {
  groupEdges,
  regroup,
  settleInserted,
  settlePlaced,
  withFreshGroupIds,
} from "./formGroups";
import { moveElements } from "./moveElements";

const el = (id: string, group?: string): PageItem => ({
  id,
  type: "input",
  kind: "text",
  label: id,
  ...(group === undefined ? {} : { group }),
});

const groupsOf = (fields: readonly PageItem[]) =>
  fields.map((element) => element.group);

/** The fields' groups with each id replaced by its order of appearance. */
const shape = (fields: readonly PageItem[]) => {
  const names = new Map<string, number>();
  return groupsOf(fields).map((group) => {
    if (group === undefined) return null;
    if (!names.has(group)) names.set(group, names.size);
    return names.get(group);
  });
};

describe("regroup", () => {
  it("puts a range in a new group", () => {
    const fields = regroup({
      fields: [el("a"), el("b"), el("c")],
      start: 0,
      end: 2,
      group: "new",
    });
    expect(shape(fields)).toEqual([0, 0, null]);
  });

  it("splits the group a removal cuts through", () => {
    const fields = regroup({
      fields: [el("a", "g"), el("b", "g"), el("c", "g")],
      start: 1,
      end: 2,
      group: null,
    });
    expect(shape(fields)).toEqual([0, null, 1]);
  });

  it("splits the group a new group cuts through", () => {
    const fields = regroup({
      fields: [el("a", "g"), el("b", "g"), el("c", "g")],
      start: 1,
      end: 2,
      group: "new",
    });
    expect(shape(fields)).toEqual([0, 1, 2]);
    expect(fields[0]!.group).toBe("g");
  });
});

describe("settleInserted", () => {
  it("joins the group it is inserted inside", () => {
    expect(
      groupsOf(settleInserted([el("a", "g"), el("new"), el("b", "g")], 1)),
    ).toEqual(["g", "g", "g"]);
  });

  it("stays out of a group it is inserted beside", () => {
    expect(
      groupsOf(settleInserted([el("a", "g"), el("new"), el("b")], 1)),
    ).toEqual(["g", undefined, undefined]);
  });

  it("keeps the group of a duplicate beside its source", () => {
    expect(
      groupsOf(settleInserted([el("a"), el("b", "g"), el("copy", "g")], 2)),
    ).toEqual([undefined, "g", "g"]);
  });

  it("drops a group no neighbour shares", () => {
    expect(groupsOf(settleInserted([el("a"), el("copy", "x")], 1))).toEqual([
      undefined,
      undefined,
    ]);
  });
});

describe("settlePlaced", () => {
  it("joins the group the elements land inside", () => {
    const fields = [el("a", "g"), el("x", "h"), el("y"), el("b", "g")];
    expect(groupsOf(settlePlaced({ fields, start: 1, end: 3 }))).toEqual([
      "g",
      "g",
      "g",
      "g",
    ]);
  });

  it("drops the group of a member moved away from the rest", () => {
    const fields = [el("b", "g"), el("c", "g"), el("x"), el("a", "g")];
    expect(groupsOf(settlePlaced({ fields, start: 3, end: 4 }))).toEqual([
      "g",
      "g",
      undefined,
      undefined,
    ]);
  });

  it("keeps a whole group moved together", () => {
    const fields = [el("x"), el("a", "g"), el("b", "g")];
    expect(groupsOf(settlePlaced({ fields, start: 1, end: 3 }))).toEqual([
      undefined,
      "g",
      "g",
    ]);
  });

  it("drops the group of members whose group stays on the page they left", () => {
    const fields = [el("a", "g")];
    expect(
      groupsOf(
        settlePlaced({ fields, start: 0, end: 1, left: [el("b", "g")] }),
      ),
    ).toEqual([undefined]);
  });
});

describe("moveElements", () => {
  it("settles groups on a move within a page", () => {
    const pages = [{ id: "p", fields: [el("a", "g"), el("b", "g"), el("x")] }];
    const moved = moveElements({
      pages,
      from: { pageIndex: 0, start: 0, end: 1 },
      to: { pageIndex: 0, index: 3 },
    });
    expect(groupsOf(moved![0]!.fields)).toEqual(["g", undefined, undefined]);
  });

  it("keeps a whole group moved to another page", () => {
    const pages = [
      { id: "p1", fields: [el("a", "g"), el("b", "g")] },
      { id: "p2", fields: [el("x")] },
    ];
    const moved = moveElements({
      pages,
      from: { pageIndex: 0, start: 0, end: 2 },
      to: { pageIndex: 1, index: 1 },
    });
    expect(groupsOf(moved![1]!.fields)).toEqual([undefined, "g", "g"]);
  });
});

describe("groupEdges", () => {
  it("marks where each run opens and closes", () => {
    const fields = [el("a"), el("b", "g"), el("c", "g"), el("d", "h")];
    expect(fields.map((_, index) => groupEdges(fields, index))).toEqual([
      null,
      { first: true, last: false },
      { first: false, last: true },
      { first: true, last: true },
    ]);
  });
});

describe("withFreshGroupIds", () => {
  it("gives each group a new id, keeping members together", () => {
    const fields = withFreshGroupIds([el("a", "g"), el("b", "g"), el("c")]);
    expect(shape(fields)).toEqual([0, 0, null]);
    expect(fields[0]!.group).not.toBe("g");
  });
});
