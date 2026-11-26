import { makeFormResponse, makeUser } from "@alliance/shared/lib/testFixtures";
import { buildResponsesCsv } from "./responsesCsvExport";

it("writes one row per response with uniquely named question columns", () => {
  const response = makeFormResponse({
    id: 3,
    sid: "s1",
    answers: { a: 'say "hi"', b: "line\nbreak, comma" },
  });
  const csv = buildResponsesCsv({
    responses: [response],
    orderedFieldIds: ["a", "b"],
    fieldLabels: new Map([
      ["a", "Name"],
      ["b", "Name"],
    ]),
  });

  expect(csv.split("\n")).toEqual([
    "Response ID,User ID,User Name,SID,Submitted at,Name,Name (2)",
    '3,,,s1,2026-01-01T00:00:00.000Z,"say ""hi""","line break, comma"',
  ]);
});

it("adds a Variant column when given variant names", () => {
  const csv = buildResponsesCsv({
    responses: [makeFormResponse({ id: 3 })],
    orderedFieldIds: [],
    fieldLabels: new Map(),
    variantName: () => "Short",
  });

  expect(csv).toBe(
    "Response ID,User ID,User Name,SID,Submitted at,Variant\n3,,,,2026-01-01T00:00:00.000Z,Short",
  );
});

it("fills the user columns from the respondent's account", () => {
  const csv = buildResponsesCsv({
    responses: [
      makeFormResponse({ id: 3, user: makeUser({ id: 7, name: "Ada" }) }),
    ],
    orderedFieldIds: [],
    fieldLabels: new Map(),
  });

  expect(csv.split("\n")[1]).toBe("3,7,Ada,,2026-01-01T00:00:00.000Z");
});

it("names an unlabeled column by its field id and formats each answer", () => {
  const csv = buildResponsesCsv({
    responses: [
      makeFormResponse({
        id: 3,
        answers: { a: { name: "Paris", key: "paris" } },
      }),
    ],
    orderedFieldIds: ["a", "b"],
    fieldLabels: new Map(),
  });

  expect(csv.split("\n")).toEqual([
    "Response ID,User ID,User Name,SID,Submitted at,a,b",
    "3,,,,2026-01-01T00:00:00.000Z,Paris,NULL",
  ]);
});

it("adds a column per field of the rows responses were submitted with", () => {
  const csv = buildResponsesCsv({
    responses: [
      makeFormResponse({
        id: 3,
        assignedRow: {
          key: '["Springfield"]',
          values: { jurisdiction: "Springfield", email: null },
        },
      }),
      makeFormResponse({ id: 4 }),
    ],
    orderedFieldIds: [],
    fieldLabels: new Map(),
  });

  expect(csv.split("\n")).toEqual([
    "Response ID,User ID,User Name,SID,Submitted at,row.jurisdiction,row.email",
    "3,,,,2026-01-01T00:00:00.000Z,Springfield,",
    "4,,,,2026-01-01T00:00:00.000Z,,",
  ]);
});

describe("question answers", () => {
  const field = (id: string, label: string) => ({
    id,
    type: "input" as const,
    kind: "radio" as const,
    label,
    options: [
      { value: "o1", label: "Happy" },
      { value: "o2", label: "Sad" },
    ],
  });
  const schemaOf = (...fields: ReturnType<typeof field>[]) => ({
    pages: [{ id: "p", fields }],
    outputViews: [],
  });

  it("writes a choice's label, not its stored value", () => {
    const schema = schemaOf(field("mood", "Mood"));
    const csv = buildResponsesCsv({
      responses: [
        makeFormResponse({
          id: 1,
          answers: { mood: "o2" },
          schemaSnapshot: schema,
        }),
      ],
      orderedFieldIds: ["mood"],
      fieldLabels: new Map([["mood", "Mood"]]),
      schema,
    });

    expect(csv.split("\n")[1].endsWith(",Sad")).toBe(true);
  });

  it("reads labels from the version each response was submitted under", () => {
    const old = schemaOf({
      ...field("mood", "Mood"),
      options: [{ value: "o1", label: "Glad" }],
    });
    const schema = schemaOf(field("mood", "Mood"));
    const csv = buildResponsesCsv({
      responses: [
        makeFormResponse({
          id: 1,
          formSnapshotId: 1,
          answers: { mood: "o1" },
          schemaSnapshot: old,
        }),
        makeFormResponse({
          id: 2,
          formSnapshotId: 2,
          answers: { mood: "o1" },
          schemaSnapshot: schema,
        }),
      ],
      orderedFieldIds: ["mood"],
      fieldLabels: new Map([["mood", "Mood"]]),
      schema,
    });

    const rows = csv.split("\n").slice(1);
    expect(rows[0].endsWith(",Glad")).toBe(true);
    expect(rows[1].endsWith(",Happy")).toBe(true);
  });

  it("adds a column, labelled from its own version, for a question a later version removed", () => {
    const old = schemaOf(field("mood", "Mood"), field("gone", "Mood"));
    const schema = schemaOf(field("mood", "Mood"));
    const csv = buildResponsesCsv({
      responses: [
        makeFormResponse({
          id: 1,
          answers: { mood: "o1", gone: "o2" },
          schemaSnapshot: old,
        }),
        makeFormResponse({
          id: 2,
          answers: { mood: "o1" },
          schemaSnapshot: schema,
        }),
      ],
      orderedFieldIds: ["mood"],
      fieldLabels: new Map([["mood", "Mood"]]),
      schema,
      formId: 1,
    });

    const [header, first, second] = csv.split("\n");
    expect(header.endsWith(",Mood,Mood (removed)")).toBe(true);
    expect(first.endsWith(",Happy,Sad")).toBe(true);
    expect(second.endsWith(",Happy,NULL")).toBe(true);
  });

  it("labels a question only a variant's form asks without calling it removed", () => {
    const schema = schemaOf(field("mood", "Mood"));
    const csv = buildResponsesCsv({
      responses: [
        makeFormResponse({
          id: 1,
          formId: 2,
          answers: { mood: "o1", extra: "o2" },
          schemaSnapshot: schemaOf(
            field("mood", "Mood"),
            field("extra", "Mood"),
          ),
        }),
      ],
      orderedFieldIds: ["mood"],
      fieldLabels: new Map([["mood", "Mood"]]),
      schema,
      formId: 1,
    });

    const [header, row] = csv.split("\n");
    expect(header.endsWith(",Mood,Mood (2)")).toBe(true);
    expect(row.endsWith(",Happy,Sad")).toBe(true);
  });

  it("does not call a question the current form still has removed", () => {
    const schema = {
      pages: [
        {
          id: "p",
          fields: [
            {
              id: "rows",
              type: "input" as const,
              kind: "list" as const,
              label: "Rows",
              fields: [],
            },
          ],
        },
      ],
      outputViews: [],
    };
    const csv = buildResponsesCsv({
      responses: [
        makeFormResponse({
          id: 1,
          answers: { rows: [] },
          schemaSnapshot: schema,
        }),
      ],
      orderedFieldIds: [],
      fieldLabels: new Map(),
      schema,
    });

    expect(csv).not.toContain("removed");
  });
});

it("leaves the user name blank for an anonymous response", () => {
  const csv = buildResponsesCsv({
    responses: [makeFormResponse({ id: 9, user: undefined })],
    orderedFieldIds: [],
    fieldLabels: new Map(),
  });

  expect(csv.split("\n")[1].startsWith("9,,,,")).toBe(true);
});

it("writes the submission date", () => {
  const csv = buildResponsesCsv({
    responses: [
      makeFormResponse({ id: 1, createdAt: "2026-03-05T10:00:00.000Z" }),
    ],
    orderedFieldIds: [],
    fieldLabels: new Map(),
  });

  expect(csv.split("\n")[1]).toContain("2026-03-05T10:00:00.000Z");
});
