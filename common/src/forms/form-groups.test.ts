import { elementRuns, splitGroupRuns } from "./form-groups";
import { pageSchema, type PageItem } from "./form-schema";
import { validateFormSchema } from "./form-schema-validate";

const text = (id: string, group?: string): PageItem => ({
  id,
  type: "input",
  kind: "text",
  label: id,
  group,
});

const label = (id: string, group?: string): PageItem => ({
  id,
  type: "display",
  kind: "label",
  text: id,
  group,
});

describe("elementRuns", () => {
  it("joins consecutive elements with the same group", () => {
    expect(
      elementRuns([
        text("a"),
        text("b"),
        label("c", "g1"),
        text("d", "g1"),
        text("e", "g2"),
        text("f"),
      ]),
    ).toEqual([
      { group: undefined, start: 0, end: 2 },
      { group: "g1", start: 2, end: 4 },
      { group: "g2", start: 4, end: 5 },
      { group: undefined, start: 5, end: 6 },
    ]);
  });

  it("returns no runs for no elements", () => {
    expect(elementRuns([])).toEqual([]);
  });
});

describe("splitGroupRuns", () => {
  it("returns each run of a group after its first", () => {
    expect(
      splitGroupRuns([
        text("a", "g1"),
        text("b"),
        text("c", "g1"),
        text("d", "g1"),
        text("e", "g1"),
      ]),
    ).toEqual([{ group: "g1", start: 2, end: 5 }]);
  });

  it("accepts back-to-back groups and a single-element group", () => {
    expect(
      splitGroupRuns([text("a", "g1"), text("b", "g2"), text("c")]),
    ).toEqual([]);
  });
});

describe("group validation", () => {
  const schema = (fields: PageItem[]) => ({
    pages: [{ id: "p1", fields }],
    outputViews: [],
  });

  it("flags a group split by another element", () => {
    expect(
      validateFormSchema(
        schema([text("a", "g1"), label("b"), text("c", "g1")]),
      ),
    ).toEqual([
      {
        blockId: "c",
        message: "Elements in a group must be next to each other",
      },
    ]);
  });

  it("accepts a contiguous group of fields and blocks", () => {
    expect(
      validateFormSchema(schema([label("a", "g1"), text("b", "g1")])),
    ).toEqual([]);
  });

  it("checks each page separately", () => {
    expect(
      validateFormSchema({
        pages: [
          { id: "p1", fields: [text("a", "g1")] },
          { id: "p2", fields: [text("b", "g1")] },
        ],
        outputViews: [],
      }),
    ).toEqual([]);
  });
});

describe("group schema", () => {
  const parses = (element: unknown) =>
    pageSchema.safeParse({ id: "p1", fields: [element] }).success;

  it("accepts a group on top-level fields and blocks", () => {
    expect(parses(text("a", "g1"))).toBe(true);
    expect(parses(label("a", "g1"))).toBe(true);
  });

  it("rejects an empty group id", () => {
    expect(parses(text("a", ""))).toBe(false);
  });

  it("rejects a group on a list sub-field", () => {
    const list = (group?: string) => ({
      id: "list",
      type: "input",
      kind: "list",
      label: "List",
      fields: [text("sub", group)],
    });
    expect(parses(list())).toBe(true);
    expect(parses(list("g1"))).toBe(false);
  });

  it("rejects a group on a block inside an accordion", () => {
    const accordion = (inner: object) => ({
      id: "acc",
      type: "display",
      kind: "accordion",
      sections: [{ title: "S", blocks: [inner] }],
    });
    const inner = { type: "display", kind: "label", text: "x" };
    expect(parses(accordion(inner))).toBe(true);
    expect(parses(accordion({ ...inner, group: "g1" }))).toBe(false);
  });
});
