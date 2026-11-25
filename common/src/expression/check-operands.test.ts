import { TypeKind } from "./catalog";
import { Undecided } from "./check";
import {
  NEEDLESS,
  condition,
  named,
  partCondition,
  passes,
  problems,
  variable,
} from "./check-test-support";

test("=== and lookups compare only text, numbers and yes/no values", () => {
  const message = "Only text, numbers and yes/no values can be compared.";
  expect(problems("items[0] === items[1]", variable)).toEqual([
    { message, at: "items[0]" },
    { message, at: "items[1]" },
  ]);
  expect(problems("items[0] !== items[1]", variable)).toEqual([
    { message, at: "items[0]" },
    { message, at: "items[1]" },
  ]);
  for (const lookup of ["includes", "indexOf", "lastIndexOf"]) {
    expect(problems(`[[1]].${lookup}([1])`, variable)).toEqual([
      { message, at: "[1]" },
    ]);
  }
  for (const text of [
    "items.includes(items[0])",
    "[[1]].indexOf(items[0]) > 0",
  ]) {
    expect(problems(text, variable)).toEqual([{ message, at: "items[0]" }]);
    expect(problems(text, condition)).toEqual([{ message, at: "items[0]" }]);
  }
  expect(problems("[1] === [1]", variable)).toEqual([
    { message, at: "[1]" },
    { message, at: "[1]" },
  ]);
  expect(problems('items[0] === "x"', variable)).toEqual([
    { message, at: "items[0]" },
  ]);
});

test("a lookup on text leaves a list or record argument to tsc", () => {
  expect(problems("state.includes([1])", variable)).toContainEqual({
    message:
      "Argument of type 'number[]' is not assignable to parameter of type 'string'.",
    at: "[1]",
  });
  expect(problems('(state ?? "").includes([1])', variable)).toEqual([
    {
      message:
        "Argument of type 'number[]' is not assignable to parameter of type 'string'.",
      at: "[1]",
    },
  ]);
});

test("sort without a function sorts only text, numbers and yes/no values", () => {
  expect(problems("items.sort()", variable)).toEqual([
    {
      message:
        "Only text, numbers and yes/no values can be sorted without a function.",
      at: "items",
    },
  ]);
  expect(passes("marks.sort()", variable).type).toBe("(number | null)[]");
  expect(problems("[items[0]].sort().length > 0")).toEqual([
    {
      message:
        "Only text, numbers and yes/no values can be sorted without a function.",
      at: "[items[0]]",
    },
  ]);
});

test("+ on text and template parts show only text, numbers and yes/no values", () => {
  const shows = "Only text, numbers and yes/no values can be shown in text.";
  expect(problems('"a" + { a: 1 }', variable)).toEqual([
    { message: shows, at: "{ a: 1 }" },
  ]);
  expect(problems('[1] + "a"', variable)).toEqual([
    { message: shows, at: "[1]" },
  ]);
  expect(problems("`x${items}`", variable)).toEqual([
    { message: shows, at: "items" },
  ]);
  expect(problems('`${[count]}` === "x"')).toEqual([
    { message: shows, at: "[count]" },
  ]);
  expect(passes('`${state ?? "-"} ${total}` + true', variable).type).toBe(
    "string",
  );
});

test.each([
  ["state === null", "Use isMissing(…) to test for a missing value.", 10],
  [
    "items[0] === state",
    "Only text, numbers and yes/no values can be compared.",
    0,
  ],
  ["total && true", "This needs a yes/no value.", 0],
])(
  "a reader of a rejected named expression %s gets only its problem",
  (text, message, start) => {
    const options = {
      ...condition,
      named: [named({ id: "1", name: "rejected", text })],
    };
    const reported = [{ message, at: `rejected@${start}` }];
    expect(problems("rejected", options)).toEqual(reported);
    expect(problems("rejected ?? false", options)).toEqual(reported);
  },
);

test("a hinted comparison's unknown its own ?? decides doesn't reach an outer one", () => {
  expect(problems("((state === null) ?? false) ?? true")).toEqual([
    { message: "Use isMissing(…) to test for a missing value.", at: "null" },
    { message: NEEDLESS, at: "true" },
  ]);
});

test.each([
  ["isMissing(state) && !state", "This needs a yes/no value.", "state"],
  ["isMissing(total) && !total", "This needs a yes/no value.", "total"],
  [
    'items.some(item => isMissing(item["score"]) && !item["score"])',
    "This needs a yes/no value.",
    'item["score"]',
  ],
  [
    "isMissing(state) ? (state || true) : false",
    "This needs a yes/no value.",
    "state",
  ],
  [
    "isMissing(items[0]) && items[0] === items[0]",
    "Only text, numbers and yes/no values can be compared.",
    "items[0]",
  ],
  [
    "isMissing(items) && items[0] === 1",
    "Only text, numbers and yes/no values can be compared.",
    "items[0]",
  ],
  ["isMissing(items) && !items[0]", "This needs a yes/no value.", "items[0]"],
  ["isMissing(marks) && !marks[0]", "This needs a yes/no value.", "marks[0]"],
  [
    "isMissing(items) && items[0] < 1",
    "< compares two numbers or two pieces of text.",
    "items[0]",
  ],
  ["isMissing(items) && -items[0] > 0", "- needs a number.", "items[0]"],
  [
    'isMissing(items) && !items[0]["name"]',
    "This needs a yes/no value.",
    'items[0]["name"]',
  ],
])(
  "a read isMissing narrows to missing in %s is still checked as declared",
  (text, message, at) => {
    expect(problems(text, partCondition)).toContainEqual({ message, at });
  },
);

test("a list's length read by key is checked as a number where isMissing narrows it", () => {
  passes('isMissing(items["length"]) || items["length"] > 0', partCondition);
});

test.each([
  ["[1] < [2]", "<", "[1]"],
  ["true >= false", ">=", "true"],
  ["items.sort((a, b) => a < b ? -1 : 1).length > 0", "<", "a"],
])("%s compares only numbers or text", (text, op, at) => {
  expect(problems(text)).toContainEqual({
    message: `${op} compares two numbers or two pieces of text.`,
    at,
  });
});

test("an operand < rejects gets no fallback advice", () => {
  expect(problems('(state === "CA") < true')).toEqual([
    {
      message: "< compares two numbers or two pieces of text.",
      at: '(state === "CA")',
    },
    { message: "< compares two numbers or two pieces of text.", at: "true" },
  ]);
});

test.each(["items[0] < 1", "(items[0]) < 1", "1 < (items[0])"])(
  "an operand < rejects in %s gets no advice to add a fallback either",
  (text) => {
    expect(problems(text)).toEqual([
      {
        message: "< compares two numbers or two pieces of text.",
        at: text.includes("(") ? "(items[0])" : "items[0]",
      },
    ]);
  },
);

test("< compares only two of a kind", () => {
  for (const text of [
    '(total > 0 ? 1 : "a") < (total > 1 ? 2 : "b")',
    '(total > 1 ? marks.indexOf(1) : "a") < 2',
  ]) {
    expect(problems(text)).toEqual([
      { message: "< compares two numbers or two pieces of text.", at: text },
    ]);
  }
});

test.each([
  ["-(total > 1) > 0", "(total > 1)"],
  ['-"a" > 0', '"a"'],
  ["-marks > 0", "marks"],
  ["-state === 1", "state"],
])("- in %s takes only a number", (text, at) => {
  expect(problems(text)).toEqual([{ message: "- needs a number.", at }]);
});

test.each([
  ['count < "a"', 'count < "a"'],
  ['isMissing(count) && count < "a"', 'count < "a"'],
  ['isMissing(marks[0]) ? marks[0] < "a" : false', 'marks[0] < "a"'],
])(
  "%s compares a number with text, which gets the rule's message alone",
  (text, at) => {
    expect(problems(text)).toEqual([
      { message: "< compares two numbers or two pieces of text.", at },
    ]);
  },
);

test.each([
  "!((total && true) ?? false)",
  "((total && true) ?? false) ? 1 : 2",
])("%s is reported once, at the operand that isn't yes/no", (text) => {
  expect(problems(text, variable)).toEqual([
    { message: "This needs a yes/no value.", at: "total" },
    { message: NEEDLESS, at: "false" },
  ]);
});

test.each([
  "(total > 1 ? (total && true) : true) ? 1 : 2",
  "!(total > 1 ? (total && true) : true)",
])("%s is reported once, at the operand in a branch", (text) => {
  expect(problems(text, variable)).toEqual([
    { message: "This needs a yes/no value.", at: "total" },
  ]);
});

test.each([
  "(total > 1 ? (total && true) : null) ?? (state && true)",
  "!((total > 1 ? (total && true) : null) ?? (state && true))",
])("%s is reported only at the operands in its sides", (text) => {
  expect(problems(text)).toEqual([
    { message: "This needs a yes/no value.", at: "total" },
    { message: "This needs a yes/no value.", at: "state" },
  ]);
});

test("a fallback reported at its operands beside a yes/no left gets no fit report", () => {
  expect(problems('(state === "x") ?? (total && true)')).toEqual([
    { message: "This needs a yes/no value.", at: "total" },
  ]);
});

test("a ternary whose other branch is yes/no gets no mismatch beside its operand's report", () => {
  expect(problems("total > 1 ? (total && true) : true")).toEqual([
    { message: "This needs a yes/no value.", at: "total" },
  ]);
});

test.each([
  ['flags([total && true]) === "a"', "total"],
  ['flags([(total && true)]) === "a"', "total"],
  ['flags([total > 1 ? (total && true) : true]) === "a"', "total"],
  ['flagged({ flag: total && true }) === "a"', "total"],
  ['agreed(total && true) === "a"', "total"],
  ['maybeAgreed(total && true) === "a"', "total"],
  ["[1, 2].reduce((a, x) => a && x, true)", "x"],
  ["(total && true) === false", "total"],
  ["true !== (total || false)", "total"],
])(
  "%s gets no mismatch where yes/no is asked, beside its operand's report",
  (text, at) => {
    expect(problems(text)).toEqual([
      { message: "This needs a yes/no value.", at },
    ]);
  },
);

test.each([
  'total && agreed(total && true) === "a"',
  '[total || flagged({ flag: total && true }) === "a"].length > 0',
  'agreed(total && agreed(total && true) === "a") === "a"',
])(
  "%s gets no mismatch where yes/no is asked inside a value reported at its operands",
  (text) => {
    expect(problems(text)).toEqual([
      { message: "This needs a yes/no value.", at: "total" },
      { message: "This needs a yes/no value.", at: "total" },
    ]);
  },
);

test("an operand's report keeps tsc's mismatch where something else is asked", () => {
  expect(problems("sum([total && true]) > 0")).toContainEqual({
    message:
      "Type 'number | boolean' is not assignable to type 'number'. Type 'boolean' is not assignable to type 'number'.",
    at: "total && true",
  });
});

test.each(["(total && true) ?? 0", "total > 1 ? (total && true) : 0"])(
  "%s keeps tsc's mismatch, since another part can cause it",
  (text) => {
    expect(problems(text)).toEqual(
      expect.arrayContaining([
        { message: "This needs a yes/no value.", at: "total" },
        {
          message:
            "Type 'number | boolean' is not assignable to type 'boolean'. Type 'number' is not assignable to type 'boolean'.",
          at: text,
        },
      ]),
    );
  },
);

test("a function sought by a lookup gets tsc's argument error", () => {
  expect(problems("[1].includes(x => x)", variable)).toContainEqual({
    message:
      "Argument of type '(x: any) => any' is not assignable to parameter of type 'number'.",
    at: "x => x",
  });
});

test("tsc's error on mixed operand types gives way to the same rule", () => {
  expect(problems("total < true")).toEqual([
    { message: "< compares two numbers or two pieces of text.", at: "true" },
  ]);
});

test.each([
  ["state ? true : false", "state"],
  ["!total", "total"],
  ["state && true", "state"],
  ["total || false", "total"],
  ["items.some(x => x.name)", "x.name"],
  ["items.some(x => x.score)", "x.score"],
  ["!(total && true)", "total"],
  ["(state || true) ? 1 : 2", "state"],
  ["(state ? 1 : 2) ?? 0", "state"],
  ["!usBased ? 1 : 2", "usBased"],
  ["items.some(x => !state)", "state"],
])("%s needs a yes/no value at %s, and only that", (text, at) => {
  expect(problems(text, variable)).toEqual([
    { message: "This needs a yes/no value.", at },
  ]);
});

test.each([
  '!(total && state === "x")',
  '(total && state === "x") || false',
  '(total && state === "x") === true',
])(
  "%s needs a yes/no value at total, even where the result must be decided",
  (text) => {
    expect(problems(text, condition)).toEqual([
      { message: "This needs a yes/no value.", at: "total" },
    ]);
  },
);

test("a root && that a number is asked for also gets the mismatch", () => {
  expect(
    problems("total && true", {
      type: { kind: TypeKind.Number },
      undecided: Undecided.NeedsFallback,
    }),
  ).toEqual([
    { message: "This needs a yes/no value.", at: "total" },
    {
      message:
        "Type 'number | boolean' is not assignable to type 'number'. Type 'boolean' is not assignable to type 'number'.",
      at: "total && true",
    },
  ]);
});

test.each([
  ["state && true", "state"],
  ["usBased && true", "usBased"],
  ["!items[0]", "items[0]"],
  ["!!state", "state"],
  ["!state && true", "state"],
  ['"x" && true', '"x"'],
  ['"" && true', '""'],
  ["[1] && true", "[1]"],
  ['!"x"', '"x"'],
  ['("x") && true', '("x")'],
  ['!("x")', '("x")'],
  ['("") || false', '("")'],
  ["(state && true) ?? false", "state"],
])("the condition %s is reported at %s alone", (text, at) => {
  expect(problems(text)).toEqual([
    { message: "This needs a yes/no value.", at },
  ]);
});

test.each([
  ['items[0] === "x"', condition],
  ["items[0] === state", condition],
  ['(items[0] === "x") ? 1 : 2', variable],
])(
  "%s is reported where it compares a record, and only there",
  (text, rule) => {
    expect(problems(text, rule)).toEqual([
      {
        message: "Only text, numbers and yes/no values can be compared.",
        at: "items[0]",
      },
    ]);
  },
);

test.each([
  ["state === null", "null"],
  ["state !== null", "null"],
  ["null === state", "null"],
  ["total > null", "null"],
  ["count > null", "null"],
  ["null < marks.indexOf(1)", "null"],
  ["(null) > 1", "(null)"],
  ["marks.includes(null)", "null"],
  ["[1].includes(null)", "null"],
  ["[1].includes((null))", "(null)"],
  ["(state === null) ?? false", "null"],
])("%s points at isMissing at %s, and only that", (text, at) => {
  expect(problems(text)).toEqual([
    { message: "Use isMissing(…) to test for a missing value.", at },
  ]);
});

test.each([
  (i: number) => `total === ${i} ? total > ${i} : `,
  (i: number) => `(total > ${i} ? true : null) ?? `,
  (i: number) => `total === ${i} ? (total > ${i} && true) : `,
])("a chain of 60 yes/no branches is checked quickly", (branch) => {
  passes(Array.from({ length: 60 }, (_, i) => branch(i)).join("") + "false");
});

test.each([
  [
    "[[2]].concat([1]).some((l) => l.length > 0)",
    "Type 'number' is not assignable to type 'number[]'.",
    "1",
  ],
  [
    "[[2]].concat([1]).some((l) => sum(l) > 0)",
    "Type 'number' is not assignable to type 'number[]'.",
    "1",
  ],
  [
    "[[1]].reduce((a, x) => a.concat(x), [[2]]).some((l) => sum(l) > 0)",
    "Argument of type 'number[]' is not assignable to parameter of type 'readonly number[][]'. Type 'number' is not assignable to type 'number[]'.",
    "x",
  ],
])(
  "concat refuses a flat list onto a list of lists in %s",
  (text, message, at) => {
    expect(problems(text)).toEqual([{ message, at }]);
  },
);

test.each([
  "[[2]].concat([[1]]).some((l) => sum(l) > 0)",
  "[1].concat([2], 3).some((n) => n > 1)",
  "marks.concat([1], count).some((n) => (n ?? 0) === 1)",
])("concat takes items and lists of items in %s", (text) => {
  passes(text);
});
