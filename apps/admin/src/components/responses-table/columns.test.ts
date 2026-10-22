import {
  autoSnapshotMode,
  buildQuestionColumns,
  collectSnapshotFields,
  SnapshotMode,
  type SnapshotSource,
} from "./columns";

const field = (id: string, label: string | null) => ({
  id,
  type: "input",
  kind: "textarea",
  label,
});

const select = (params: {
  id: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}) => ({
  id: params.id,
  type: "input",
  kind: "select",
  label: params.label,
  options: params.options,
});

const schema = (fields: unknown[]) => ({
  pages: [{ id: "page-1", fields }],
  outputViews: [],
});

const response = (params: {
  snapshotId: number;
  schema: unknown;
  answers?: Record<string, unknown>;
}): SnapshotSource => ({
  formSnapshotId: params.snapshotId,
  schemaSnapshot: { ...(params.schema ?? {}) },
  answers: params.answers ?? {},
});

const V1 = schema([field("a", "Name"), field("b", "Why did you join?")]);
const V2 = schema([field("a", "Name"), field("c", "What changed?")]);
const CURRENT = schema([
  field("a", "Full name"),
  field("c", "What changed?"),
  field("d", "Anything else?"),
]);

const multiSnapshotSet = () =>
  collectSnapshotFields({
    currentSchema: CURRENT,
    currentSnapshotId: 30,
    responses: [
      response({ snapshotId: 10, schema: V1, answers: { b: "because" } }),
      response({ snapshotId: 20, schema: V2, answers: { c: "a lot" } }),
      response({ snapshotId: 30, schema: CURRENT, answers: { d: "no" } }),
    ],
  });

describe("collectSnapshotFields", () => {
  it("reads the current schema and every snapshot the responses pin", () => {
    const fields = multiSnapshotSet();

    expect(fields.currentFields.map((f) => f.id)).toEqual(["a", "c", "d"]);
    expect([...fields.bySnapshotId.keys()].sort((x, y) => x - y)).toEqual([
      10, 20, 30,
    ]);
    expect(fields.failures).toEqual([]);
  });

  it("keeps the current schema's wording for the current snapshot", () => {
    const fields = multiSnapshotSet();

    expect(fields.bySnapshotId.get(30)?.map((f) => f.label)).toEqual([
      "Full name",
      "What changed?",
      "Anything else?",
    ]);
  });

  it("reports a snapshot it cannot read instead of dropping it silently", () => {
    const fields = collectSnapshotFields({
      currentSchema: CURRENT,
      currentSnapshotId: 30,
      responses: [response({ snapshotId: 9, schema: { pages: "nope" } })],
    });

    expect(fields.failures.map((failure) => failure.snapshotId)).toEqual([9]);
  });
});

describe("buildQuestionColumns", () => {
  it("shows only the current snapshot's questions in focused mode", () => {
    const columns = buildQuestionColumns({
      fields: multiSnapshotSet(),
      mode: SnapshotMode.Focused,
    });

    expect(columns.map((column) => column.fieldId)).toEqual(["a", "c", "d"]);
    expect(columns.every((column) => !column.retired)).toBe(true);
  });

  it("appends retired questions after the current ones in expanded mode", () => {
    const columns = buildQuestionColumns({
      fields: multiSnapshotSet(),
      mode: SnapshotMode.Expanded,
    });

    expect(columns.map((column) => column.fieldId)).toEqual([
      "a",
      "c",
      "d",
      "b",
    ]);
    const retired = columns.filter((column) => column.retired);
    expect(retired.map((column) => column.lastSeenSnapshotId)).toEqual([10]);
  });

  it("orders retired questions by the last version that had them", () => {
    const fields = collectSnapshotFields({
      currentSchema: schema([field("a", "Name")]),
      currentSnapshotId: 30,
      responses: [
        response({
          snapshotId: 10,
          schema: schema([field("a", "Name"), field("old", "Oldest")]),
        }),
        response({
          snapshotId: 20,
          schema: schema([field("a", "Name"), field("recent", "Newer")]),
        }),
      ],
    });

    const columns = buildQuestionColumns({
      fields,
      mode: SnapshotMode.Expanded,
    });

    expect(columns.map((column) => column.fieldId)).toEqual([
      "a",
      "recent",
      "old",
    ]);
  });

  it("keeps one column per field id, headed with the current wording", () => {
    const columns = buildQuestionColumns({
      fields: multiSnapshotSet(),
      mode: SnapshotMode.Expanded,
    });
    const reworded = columns.find((column) => column.fieldId === "a");

    expect(reworded?.label).toBe("Full name");
    expect(reworded?.wordings).toEqual([
      { snapshotId: 10, label: "Name" },
      { snapshotId: 30, label: "Full name" },
    ]);
  });

  it("records a single wording for a question nobody reworded", () => {
    const columns = buildQuestionColumns({
      fields: multiSnapshotSet(),
      mode: SnapshotMode.Expanded,
    });

    expect(
      columns.find((column) => column.fieldId === "c")?.wordings,
    ).toHaveLength(1);
  });

  it("names an unlabelled question by its kind rather than its id", () => {
    const fields = collectSnapshotFields({
      currentSchema: schema([field("block-1789523333513", null)]),
      currentSnapshotId: 1,
      responses: [],
    });

    const [column] = buildQuestionColumns({
      fields,
      mode: SnapshotMode.Focused,
    });

    expect(column.label).toBe("Untitled Text Area Field");
    expect(column.untitled).toBe(true);
  });

  it("separates two ids that happen to share a label", () => {
    const fields = collectSnapshotFields({
      currentSchema: schema([field("a", "Name"), field("b", "Name")]),
      currentSnapshotId: 1,
      responses: [],
    });

    expect(
      buildQuestionColumns({ fields, mode: SnapshotMode.Focused }),
    ).toHaveLength(2);
  });
});

describe("autoSnapshotMode", () => {
  it("expands when a response answers a question the current version dropped", () => {
    const responses = [
      response({ snapshotId: 10, schema: V1, answers: { b: "because" } }),
      response({ snapshotId: 30, schema: CURRENT, answers: { d: "no" } }),
    ];
    const fields = collectSnapshotFields({
      currentSchema: CURRENT,
      currentSnapshotId: 30,
      responses,
    });

    expect(autoSnapshotMode({ responses, fields })).toBe(SnapshotMode.Expanded);
  });

  it("stays focused when several snapshots carry the same questions", () => {
    const responses = [
      response({ snapshotId: 10, schema: CURRENT, answers: { a: "Ada" } }),
      response({ snapshotId: 20, schema: CURRENT, answers: { a: "Bo" } }),
      response({ snapshotId: 30, schema: CURRENT, answers: { a: "Cy" } }),
    ];
    const fields = collectSnapshotFields({
      currentSchema: CURRENT,
      currentSnapshotId: 30,
      responses,
    });

    expect(autoSnapshotMode({ responses, fields })).toBe(SnapshotMode.Focused);
  });

  it("stays focused when the dropped question was left blank", () => {
    const responses = [
      response({ snapshotId: 10, schema: V1, answers: { b: "   " } }),
      response({ snapshotId: 20, schema: V1, answers: { b: [] } }),
      response({ snapshotId: 30, schema: CURRENT, answers: { d: "no" } }),
    ];
    const fields = collectSnapshotFields({
      currentSchema: CURRENT,
      currentSnapshotId: 30,
      responses,
    });

    expect(autoSnapshotMode({ responses, fields })).toBe(SnapshotMode.Focused);
  });

  it("stays focused for an answer no loaded snapshot declares", () => {
    const responses = [
      response({
        snapshotId: 30,
        schema: CURRENT,
        answers: { "field-from-nowhere": "orphan" },
      }),
    ];
    const fields = collectSnapshotFields({
      currentSchema: CURRENT,
      currentSnapshotId: 30,
      responses,
    });

    expect(autoSnapshotMode({ responses, fields })).toBe(SnapshotMode.Focused);
  });

  it("expands on a dropped multi-select that still holds selections", () => {
    const withOptions = schema([
      field("a", "Name"),
      select({
        id: "fav",
        label: "Favourites",
        options: [{ value: "opt-1", label: "Bananas" }],
      }),
    ]);
    const responses = [
      response({
        snapshotId: 10,
        schema: withOptions,
        answers: { fav: "opt-1" },
      }),
      response({ snapshotId: 30, schema: CURRENT, answers: {} }),
    ];
    const fields = collectSnapshotFields({
      currentSchema: CURRENT,
      currentSnapshotId: 30,
      responses,
    });

    expect(autoSnapshotMode({ responses, fields })).toBe(SnapshotMode.Expanded);
  });
});
