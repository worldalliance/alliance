import { R } from "../result";
import { TypeKind, type Catalog, type Scope, type ValueType } from "./catalog";
import { Undecided, checkExpression } from "./check";
import {
  GUARDED,
  NEEDLESS,
  groupCondition,
  passes,
  problems,
  string,
  variable,
} from "./check-test-support";

const recordCatalog = {
  inputs: [],
  functions: [
    {
      name: "useEmpty",
      params: [{ name: "r", type: { kind: TypeKind.Record, fields: {} } }],
      returns: string,
    },
    {
      name: "useLength",
      params: [
        {
          name: "r",
          type: {
            kind: TypeKind.Record,
            fields: { length: { kind: TypeKind.Number } },
          },
        },
      ],
      returns: string,
    },
    {
      name: "useMarks",
      params: [
        {
          name: "r",
          type: {
            kind: TypeKind.Nullable,
            inner: {
              kind: TypeKind.Record,
              fields: {
                marks: {
                  kind: TypeKind.List,
                  item: {
                    kind: TypeKind.Nullable,
                    inner: { kind: TypeKind.Number },
                  },
                },
              },
            },
          },
        },
      ],
      returns: string,
    },
    {
      name: "useNested",
      params: [
        {
          name: "r",
          type: {
            kind: TypeKind.Nullable,
            inner: {
              kind: TypeKind.Record,
              fields: {
                a: {
                  kind: TypeKind.List,
                  item: {
                    kind: TypeKind.Nullable,
                    inner: { kind: TypeKind.Record, fields: { b: string } },
                  },
                },
              },
            },
          },
        },
      ],
      returns: string,
    },
    {
      name: "useMaybe",
      params: [
        {
          name: "__list",
          type: {
            kind: TypeKind.Nullable,
            inner: {
              kind: TypeKind.Record,
              fields: { name: string },
            },
          },
        },
      ],
      returns: string,
    },
  ],
} satisfies Catalog;

test.each([
  ["useEmpty(5)", "useEmpty(true)", "useEmpty([1])", 'useEmpty("x")'],
  ['useLength("text")', "useLength([1])", "useLength([])"],
  ["useEmpty([])"],
])("a record parameter rejects what isn't a record: %s", (...calls) => {
  for (const source of [...calls]) {
    expect(
      checkExpression({
        source,
        scope: { catalog: recordCatalog, named: [] },
        rule: variable,
      }).ok,
    ).toBe(false);
  }
  expect(
    checkExpression({
      source: "useEmpty({}) + useLength({ length: 1 })",
      scope: { catalog: recordCatalog, named: [] },
      rule: variable,
    }).ok,
  ).toBe(true);
});

test.each([
  [
    "useLength([1])",
    "Argument of type 'number[]' is not assignable to parameter of type '{ length: number; }'. A list isn't a record.",
  ],
  [
    "useEmpty(5)",
    "Argument of type 'number' is not assignable to parameter of type 'object'. Type 'number' is not assignable to type 'object'.",
  ],
])(
  "a record parameter's message leaves out the check's brand: %s",
  (source, message) => {
    expect(
      checkExpression({
        source,
        scope: { catalog: recordCatalog, named: [] },
        rule: variable,
      }),
    ).toEqual(R.failure([expect.objectContaining({ message })]));
  },
);

test("a parameter may have a name the check's declarations use", () => {
  expect(
    checkExpression({
      source: 'useMaybe({ name: "x" })',
      scope: { catalog: recordCatalog, named: [] },
      rule: variable,
    }).ok,
  ).toBe(true);
});

test("a nullable record parameter's message leaves out the check's brand", () => {
  expect(
    checkExpression({
      source: "useMaybe([5][0])",
      scope: { catalog: recordCatalog, named: [] },
      rule: variable,
    }),
  ).toEqual(
    R.failure([
      expect.objectContaining({
        message:
          "Argument of type 'number | undefined' is not assignable to parameter of type '{ name: string; } | null | undefined'. Type 'number' is not assignable to type '{ name: string; }'.",
      }),
    ]),
  );
});

test("a record whose field's type is a union loses the brand's parentheses too", () => {
  expect(
    checkExpression({
      source: "useMarks([5][0])",
      scope: { catalog: recordCatalog, named: [] },
      rule: variable,
    }),
  ).toEqual(
    R.failure([
      expect.objectContaining({
        message:
          "Argument of type 'number | undefined' is not assignable to parameter of type '{ marks: (number | null | undefined)[]; } | null | undefined'. Type 'number' is not assignable to type '{ marks: (number | null | undefined)[]; }'.",
      }),
    ]),
  );
});

test("a record nested in a record's union field loses the brand's parentheses too", () => {
  expect(
    checkExpression({
      source: "useNested([5][0])",
      scope: { catalog: recordCatalog, named: [] },
      rule: variable,
    }),
  ).toEqual(
    R.failure([
      expect.objectContaining({
        message:
          "Argument of type 'number | undefined' is not assignable to parameter of type '{ a: ({ b: string; } | null | undefined)[]; } | null | undefined'. Type 'number' is not assignable to type '{ a: ({ b: string; } | null | undefined)[]; }'.",
      }),
    ]),
  );
});

test("a record with a numeric field name passes for a record", () => {
  const pair: ValueType = {
    kind: TypeKind.Record,
    fields: { "0": { kind: TypeKind.Number } },
  };
  const scope = {
    catalog: {
      inputs: [{ id: "pair", label: "Pair", type: pair }],
      functions: [
        { name: "first", params: [{ name: "r", type: pair }], returns: string },
      ],
    },
    named: [],
  };
  expect(
    checkExpression({ source: "first(pair)", scope, rule: variable }).ok,
  ).toBe(true);
  expect(
    checkExpression({
      source: "pair",
      scope,
      rule: { type: pair, undecided: Undecided.Allowed },
    }).ok,
  ).toBe(true);
});

describe("a record read by a key input", () => {
  const scope = {
    catalog: {
      inputs: [
        {
          id: "key",
          label: "Key",
          type: {
            kind: TypeKind.Choice,
            options: [{ value: "flag", label: "Flag" }],
          },
        },
        {
          id: "pick",
          label: "Pick",
          type: {
            kind: TypeKind.Nullable,
            inner: {
              kind: TypeKind.Choice,
              options: [
                { value: "name", label: "Name" },
                { value: "score", label: "Score" },
              ],
            },
          },
        },
        {
          id: "field",
          label: "Field",
          type: {
            kind: TypeKind.Choice,
            options: [
              { value: "flag", label: "Flag" },
              { value: "name", label: "Name" },
            ],
          },
        },
        {
          id: "row",
          label: "Row",
          type: {
            kind: TypeKind.Record,
            fields: {
              flag: {
                kind: TypeKind.Nullable,
                inner: { kind: TypeKind.Boolean },
              },
              name: string,
              score: { kind: TypeKind.Number },
            },
          },
        },
      ],
      functions: [],
    },
    named: [],
  } satisfies Scope;
  const check = (source: string) =>
    checkExpression({ source, scope, rule: variable });

  test("reads the field the key names where isMissing narrows it", () => {
    expect(check("isMissing(row[key]) && !row[key]").ok).toBe(true);
  });

  test("reads every field a key can name where isMissing narrows it", () => {
    expect(check("isMissing(row[field]) && !row[field]")).toEqual(
      R.failure([
        expect.objectContaining({ message: "This needs a yes/no value." }),
      ]),
    );
  });

  test("allows a fallback after a read by key `&&` narrowed", () => {
    expect(check("row[key] === true && (row[key] ?? false)").ok).toBe(true);
  });

  test("still has a fallback the guard makes needless reported", () => {
    expect(check("isMissing(pick) ? 0 : row[pick] ?? 0")).toEqual(
      R.failure([expect.objectContaining({ message: GUARDED })]),
    );
  });
});

test("a line the brand alone told apart from the one before is left out", () => {
  const type: ValueType = { kind: TypeKind.Record, fields: { name: string } };
  expect(
    problems("items[0] ?? 1", { type, undecided: Undecided.Allowed }),
  ).toEqual([
    {
      message:
        "Type '{ name: string; score: number | null; } | 1' is not assignable to type '{ name: string; }'. Type 'number' is not assignable to type '{ name: string; }'.",
      at: "items[0] ?? 1",
    },
  ]);
});

test("a record too wide for tsc to print whole loses the brand too", () => {
  const fields = Object.fromEntries(
    Array.from({ length: 8 }, (_, i) => [`fieldNumber${i}`, string]),
  );
  const [found] = problems("5", {
    ...variable,
    type: { kind: TypeKind.Record, fields },
  });
  expect(found.message).not.toContain("& object");
  expect(found.message).not.toContain("...");
});

test("a record type's message names its fields as written", () => {
  const checked = checkExpression({
    source: "[1]",
    scope: { catalog: { inputs: [], functions: [] }, named: [] },
    rule: {
      ...variable,
      type: { kind: TypeKind.Record, fields: { name: string } },
    },
  });
  expect(R.mapError(checked, (found) => found[0].message)).toEqual(
    R.failure(
      "Type 'number[]' is not assignable to type '{ name: string; }'. Property 'name' is missing in type 'number[]' but required in type '{ name: string; }'.",
    ),
  );
});

test("a message keeps the spacing inside text values", () => {
  const checked = checkExpression({
    source: 'choice === "two spaces"',
    scope: {
      catalog: {
        inputs: [
          {
            id: "choice",
            label: "Choice",
            type: {
              kind: TypeKind.Choice,
              options: [{ value: "two  spaces", label: "Two spaces" }],
            },
          },
        ],
        functions: [],
      },
      named: [],
    },
    rule: variable,
  });
  expect(R.mapError(checked, (found) => found[0].message)).toEqual(
    R.failure(
      "This comparison appears to be unintentional because the types '\"two  spaces\"' and '\"two spaces\"' have no overlap.",
    ),
  );
});

test("a fallback after a read by key is needless only when every value its key takes names a field that can't be missing", () => {
  const choice = (values: string[]): ValueType => ({
    kind: TypeKind.Choice,
    options: values.map((value) => ({ value, label: value })),
  });
  const scope = {
    catalog: {
      inputs: [
        {
          id: "rec",
          label: "Rec",
          type: {
            kind: TypeKind.Record,
            fields: {
              a: {
                kind: TypeKind.Nullable,
                inner: { kind: TypeKind.Number },
              },
              b: { kind: TypeKind.Number },
            },
          },
        },
        { id: "key", label: "Key", type: choice(["a", "b"]) },
        { id: "keyB", label: "Key B", type: choice(["b"]) },
        { id: "keyBC", label: "Key BC", type: choice(["b", "c"]) },
      ],
      functions: [],
    },
    named: [],
  } satisfies Scope;
  const check = (source: string) =>
    checkExpression({ source, scope, rule: variable });
  expect(check("rec[key] === 1 && (rec[key] ?? 0) === 1").ok).toBe(true);
  expect(check('keyBC === "b" && (rec[keyBC] ?? 0) === 1').ok).toBe(true);
  expect(
    check('key === "a" || (isMissing(rec[key] ?? 1) ? 1 / 0 : 0) > 0').ok,
  ).toBe(true);
  const needless = "rec[keyB] === 1 && (rec[keyB] ?? 0) === 1";
  const fallback = needless.indexOf("0)");
  expect(check(needless)).toEqual(
    R.failure([
      expect.objectContaining({
        message: NEEDLESS,
        start: fallback,
        end: fallback + 1,
      }),
    ]),
  );
});

test.each([
  "items[0]?.name",
  "items[0]?.score",
  'items[0]?.name?.includes("a")',
])(
  "a fallback after a list holding %s is needless, as `?.` passes tsc",
  (read) => {
    expect(problems(`([${read}].length > 0) ?? false`)).toEqual([
      { message: NEEDLESS, at: "false" },
    ]);
  },
);

test.each([
  'items.some(item => item.score === 1 || isMissing(item["score"]))',
  'items.some(item => item["score"] === 1 || isMissing(item.score))',
])(
  "a guard on a key written as text decides the field it names in %s",
  (text) => {
    expect(passes(text, groupCondition).mayBeUnknown).toBe(false);
  },
);
