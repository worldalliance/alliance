import { R } from "../result";
import { TypeKind, type NamedExpression } from "./catalog";
import { checkExpression } from "./check";
import {
  catalog,
  condition,
  groupCondition,
  named,
  NEEDLESS,
  passes,
  problems,
  string,
  UNDECIDED_STATE,
  variable,
} from "./check-test-support";
import { ExprKind } from "./tree";

const METHOD_VALUE = "A method can't be used as a value. Call it with `(…)`.";

test.each([
  ['"a" - 1', "The left of this operator has to be a number."],
  [
    "items.join()",
    "join works on a list of text, numbers or yes/no. Name a part of each item first, like .map(item => item.name).join(', '), or flatten a list of lists with .flat().",
  ],
])("%s gets the formula checker's wording", (text, message) => {
  expect(problems(text, variable).map((problem) => problem.message)).toEqual([
    message,
  ]);
});

test("a catalog input that doesn't read as a name throws", () => {
  expect(() =>
    checkExpression({
      source: "1",
      scope: {
        catalog: {
          inputs: [{ id: "first-name", label: "First name", type: string }],
          functions: [],
        },
        named: [],
      },
      rule: variable,
    }),
  ).toThrow("`first-name` doesn't read back as a name.");
});

test("lists only the named expressions' problems, by name, when they have any", () => {
  const a = named({ id: "1", name: "a", text: '"a" - 1' });
  const b = named({ id: "2", name: "b", text: '"b" - 1' });
  const message = "The left of this operator has to be a number.";
  expect(problems('"c" - 1 + b + a', { ...variable, named: [b, a] })).toEqual([
    { message, at: "a@0" },
    { message, at: "b@0" },
  ]);
});

test("an input with no options can take no value", () => {
  const checked = checkExpression({
    source: "empty",
    scope: {
      catalog: {
        inputs: [
          {
            id: "empty",
            label: "Empty",
            type: { kind: TypeKind.Choice, options: [] },
          },
        ],
        functions: [],
      },
      named: [],
    },
    rule: variable,
  });
  expect(R.map(checked, ({ type }) => type)).toEqual(R.success("never"));
});

describe("types", () => {
  test.each([
    [
      "items[0]?.nme",
      "Property 'nme' does not exist on type '{ name: string; score: number | null; }'. Did you mean 'name'?",
    ],
    [
      'usBased === "yse"',
      'This comparison appears to be unintentional because the types \'"yes" | "no" | null\' and \'"yse"\' have no overlap.',
    ],
    [
      'items.find(item => item.name === "a").name',
      "Object is possibly 'undefined'.",
    ],
    [
      "double(items[0]?.score)",
      "Argument of type 'number | null | undefined' is not assignable to parameter of type 'number'. Type 'undefined' is not assignable to type 'number'.",
    ],
  ])("%s", (text, message) => {
    expect(
      problems(text, variable).map((problem) => problem.message),
    ).toContain(message);
  });

  test("a parameter that accepts a missing value takes undefined as well as null", () => {
    expect(passes("describe(items[0]?.score)", variable).type).toBe("string");
  });

  test.each(["marks[0]", 'items.find(item => item.name === "a")?.score'])(
    "a missing lookup in %s fits a consumer that takes a missing value",
    (text) => {
      expect(
        passes(text, { ...variable, type: { kind: TypeKind.Number } })
          .mayBeUnknown,
      ).toBe(true);
    },
  );

  test("a missing lookup inside a list fits a list that takes missing items", () => {
    passes("[marks[0]]", {
      ...variable,
      type: {
        kind: TypeKind.List,
        item: { kind: TypeKind.Nullable, inner: { kind: TypeKind.Number } },
      },
    });
  });

  test("a missing lookup fits a parameter taking missing items in a missing list", () => {
    expect(passes("highest([marks[0]])", variable).type).toBe("number");
  });

  test("a result found always decided names no missing value in its type", () => {
    expect(passes("true ? true : null", variable)).toMatchObject({
      type: "boolean",
      mayBeUnknown: false,
    });
  });

  test("the result must fit the consumer's type", () => {
    expect(problems("total", condition)).toEqual([
      {
        message: "Type 'number' is not assignable to type 'boolean'.",
        at: "total",
      },
    ]);
  });

  test.each(['"x".trim', '[1]["map"]', "state?.trim"])(
    "reading the method %s as a value fails",
    (method) => {
      expect(problems(`({ m: ${method} })`, variable)).toEqual([
        { message: METHOD_VALUE, at: method },
      ]);
      const value = named({ id: "5", name: "value", text: method });
      expect(
        problems("isMissing(value)", { ...condition, named: [value] }),
      ).toEqual([{ message: METHOD_VALUE, at: "value@0" }]);
    },
  );

  test("a method called, or a field named like one, passes", () => {
    passes('[" x".trim(), ({ trim: "v" }).trim]', variable);
  });

  test("a list filtered by a comparison keeps its items' type", () => {
    passes('["a", "b"].filter((k) => k === "a").includes("b")');
  });
});

test("a catalog name starting with __ is the check's own and throws", () => {
  expect(() =>
    checkExpression({
      source: "1",
      scope: {
        catalog: {
          inputs: [{ id: "__result", label: "Result", type: string }],
          functions: [],
        },
        named: [],
      },
      rule: variable,
    }),
  ).toThrow("`__result` starts with `__`");
});

test("a named expression whose name isn't an identifier throws naming it", () => {
  expect(() =>
    checkExpression({
      source: { kind: ExprKind.Ref, id: "1" },
      scope: {
        catalog,
        named: [
          { id: "1", name: "a b", tree: { kind: ExprKind.Literal, value: 1 } },
        ],
      },
      rule: variable,
    }),
  ).toThrow("`a b` doesn't read back as a name.");
});

test("a function result tsc rejects gets no undecided report", () => {
  expect(problems("marks.reduce((a, m) => m, 0) > 1")).toEqual([
    {
      message:
        "Type 'number | null' is not assignable to type 'number'. Type 'null' is not assignable to type 'number'.",
      at: "m",
    },
  ]);
  expect(
    passes("marks.reduce((a, m) => m, count) ?? 0", variable).mayBeUnknown,
  ).toBe(false);
});

test("a fallback after a reduce whose list, starting value and function can't be missing is needless", () => {
  expect(
    problems(
      '(total > 0 && [1, 2].reduce((a, x) => a + x, 0) > 0) ?? (state === "CA")',
    ),
  ).toEqual([{ message: NEEDLESS, at: '(state === "CA")' }]);
});

describe("named expressions", () => {
  const isCalifornia = named({
    id: "1",
    name: "isCalifornia",
    text: 'state === "CA"',
  });
  const scores = named({
    id: "2",
    name: "scores",
    text: "items.map(item => item.score ?? 0)",
  });

  test("isMissing narrows a named expression inside a list callback", () => {
    const x = named({ id: "3", name: "x", text: "state" });
    passes("!isMissing(x) && items.some(item => x.length > 1)", {
      ...condition,
      named: [x],
    });
  });

  test("an undecided named expression needs handling where it's used", () => {
    expect(
      problems("isCalifornia ? 1 : 2", { ...variable, named: [isCalifornia] }),
    ).toContainEqual({
      message:
        "This is undecided when `isCalifornia` has no value. Add `?? false` or `?? true` to decide it then.",
      at: "isCalifornia",
    });
    expect(
      passes("isCalifornia", { ...groupCondition, named: [isCalifornia] })
        .mayBeUnknown,
    ).toBe(true);
    expect(
      passes("isCalifornia ?? false", { ...condition, named: [isCalifornia] })
        .mayBeUnknown,
    ).toBe(false);
  });

  test.each([
    ['state === "CA" ? true : false', UNDECIDED_STATE, 0],
    [
      '`${state}` === "a"',
      'Members without a value for `state` would see no text here. Add `?? "…"` to choose what they see instead.',
      3,
    ],
    [
      "state === 1",
      "This comparison appears to be unintentional because the types 'string | null' and 'number' have no overlap.",
      0,
    ],
    [
      'state === "CA" && "x" - 1 > 0',
      "The left of this operator has to be a number.",
      18,
    ],
  ])(
    "a reader of a named expression %s with a problem of its own gets only that problem",
    (text, message, start) => {
      const options = {
        ...condition,
        named: [named({ id: "1", name: "inner", text })],
      };
      const reported = [{ message, at: `inner@${start}` }];
      expect(problems("inner", options)).toEqual(reported);
      expect(problems("inner ?? false", options)).toEqual(reported);
    },
  );

  test.each([
    ['inner === "a"', undefined],
    ["mid ?? false", "inner.length"],
    ["mid", 'inner === "a"'],
    ['mid === "a"', "inner"],
  ])(
    "%s gets nothing that follows from a broken named expression it reads",
    (text, midText) => {
      const inner = named({ id: "1", name: "inner", text: '"x" - 1' });
      const mid =
        midText === undefined
          ? []
          : [named({ id: "2", name: "mid", text: midText, others: [inner] })];
      expect(problems(text, { ...condition, named: [inner, ...mid] })).toEqual([
        {
          message: "The left of this operator has to be a number.",
          at: "inner@0",
        },
      ]);
    },
  );

  test("a reader two levels above a broken named expression is held back", () => {
    const inner = named({ id: "1", name: "inner", text: '"x" - 1' });
    const mid = named({
      id: "2",
      name: "mid",
      text: "inner > 0",
      others: [inner],
    });
    const top = named({ id: "3", name: "top", text: "mid", others: [mid] });
    expect(problems("top", { ...condition, named: [inner, mid, top] })).toEqual(
      [
        {
          message: "The left of this operator has to be a number.",
          at: "inner@0",
        },
      ],
    );
  });

  test.each([
    "isMissing(count) || [count].length > 0",
    "isMissing(count) || highest([count]) > 0",
    "!isMissing(count) && [count].length > 0",
    "isMissing(count) || [count].map((c) => c + 1).length > 0",
    "!isMissing(count) && [count].some((c) => c > 0)",
    "isMissing(count) || [count].filter((c) => c > 0).length > 0",
  ])(
    "a named expression a guard decides through a list isn't declared nullable: %s",
    (text) => {
      const inner = named({ id: "1", name: "inner", text });
      passes("inner", { ...condition, named: [inner] });
    },
  );

  test("a named expression always decided needs no handling where it's used", () => {
    const decision = named({
      id: "3",
      name: "decision",
      text: "true ? true : null",
    });
    expect(
      passes("decision ? 1 : 2", { ...variable, named: [decision] }).type,
    ).toBe("number");
  });

  test("a named expression tsc calls never missing keeps its fallback where the analysis finds it can be", () => {
    const und = named({
      id: "3",
      name: "und",
      text: '((state === "CA") ?? false) === (count === 1)',
    });
    expect(passes("und", { ...variable, named: [und] }).mayBeUnknown).toBe(
      true,
    );
  });

  test("isMissing guards a named expression", () => {
    expect(
      passes("isMissing(isCalifornia) ? 0 : isCalifornia ? 1 : 2", {
        ...variable,
        named: [isCalifornia],
      }).type,
    ).toBe("number");
  });

  test("a named expression can read another named expression", () => {
    const top = named({
      id: "3",
      name: "top",
      text: "scores.some(score => score > 5)",
      others: [scores],
    });
    expect(
      passes("top && total > 1", { ...condition, named: [top, scores] }).type,
    ).toBe("boolean");
  });

  test("a named constant has its value's type, not its literal's", () => {
    const region = named({ id: "5", name: "region", text: '"US"' });
    const scope = { named: [region] };
    expect(passes('region === "EU"', { ...condition, ...scope }).type).toBe(
      "boolean",
    );
    expect(passes("region", { ...variable, ...scope }).type).toBe("string");
    expect(passes('"US"', variable).type).toBe("string");
  });

  test("named expressions chain", () => {
    const top = named({
      id: "3",
      name: "top",
      text: "scores.some(score => score > 5)",
      others: [scores],
    });
    expect(
      passes("top && total > 1", { ...condition, named: [scores, top] })
        .mayBeUnknown,
    ).toBe(false);
  });

  test("a removed input a named expression reads is reported under its name", () => {
    const broken = named({ id: "4", name: "broken", text: "total + 1" });
    const brokenCatalog = {
      ...catalog,
      inputs: catalog.inputs.filter((input) => input.id !== "total"),
    };
    const result = checkExpression({
      source: "broken > 1",
      scope: { catalog: brokenCatalog, named: [broken] },
      rule: condition,
    });
    expect(result).toEqual(
      R.failure([
        {
          message: "This uses something that no longer exists.",
          start: 0,
          end: 9,
          namedExpression: "broken",
        },
      ]),
    );
  });

  test("a loop is reported", () => {
    const a: NamedExpression = {
      id: "a",
      name: "a",
      tree: { kind: ExprKind.Ref, id: "b" },
    };
    const b: NamedExpression = {
      id: "b",
      name: "b",
      tree: { kind: ExprKind.Ref, id: "a" },
    };
    expect(problems("a", { ...variable, named: [a, b] })).toEqual([
      {
        message: "These formulas refer to each other in a loop: a → b → a.",
        at: "a",
      },
    ]);
  });
});
