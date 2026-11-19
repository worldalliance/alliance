import { R } from "../result";
import { type NamedExpression, type Value } from "./catalog";
import { evaluate } from "./evaluate";
import { catalog, failureOf, run, valueOf } from "./evaluate-test-support";
import { FailureKind } from "./failure";
import { parseExpression } from "./parse";
import { ExprKind, LAMBDA_ONLY_AS_ARGUMENT, type Expr } from "./tree";

const notCalled = () => {
  throw new Error("not called");
};
const unreachable = {
  catalog,
  named: [],
  readInput: notCalled,
  callFunction: notCalled,
};

describe("three-valued logic", () => {
  test.each<[string, Value, Record<string, Value>?]>([
    ['state === "CA"', null],
    ['state !== "CA"', null],
    ['state === "CA"', true, { state: "CA" }],
    ['state !== "CA"', true, { state: "NY" }],
    ['!(state === "CA")', null],
    ['state === "CA" && false', false],
    ['state === "CA" && true', null],
    ['state === "CA" || true', true],
    ['state === "CA" || false', null],
    ["true && true", true],
    ["false && true", false],
    ["true || false", true],
    ["false || false", false],
    ['(state === "CA") ?? false', false],
    ["isMissing(state)", true],
    ["isMissing(count)", false],
    ['isMissing(state === "CA")', true],
  ])("%s → %p", (...[text, expected, overrides]) => {
    expect(valueOf(text, overrides)).toBe(expected);
  });

  test("a guarded read of an unknown doesn't fail the condition", () => {
    expect(valueOf("!isMissing(count) && count > 5", { count: null })).toBe(
      false,
    );
    expect(
      valueOf("isMissing(count) ? null : count > 5", { count: null }),
    ).toBe(null);
    expect(
      valueOf('!isMissing(tags) && tags.includes("x")', { tags: null }),
    ).toBe(false);
  });

  test.each([
    ['["a", null].includes("a")', true],
    ['["a", null].includes("b")', null],
    ['["a", "b"].includes("c")', false],
    ['["a", null].includes("a", 1)', null],
    ['["a", null].indexOf("a")', 0],
    ['[null, "a"].indexOf("a")', null],
    ['[null, "a"].indexOf("a", 1)', 1],
    ['["a", "b"].indexOf("c")', -1],
    ['[null, "a"].lastIndexOf("a")', 1],
    ['["a", null].lastIndexOf("a")', null],
    ['["a", null].lastIndexOf("b")', null],
  ])("a missing item can be the one %s looks for", (text, expected) => {
    expect(valueOf(text)).toBe(expected);
  });

  test.each(["includes", "indexOf", "lastIndexOf"])(
    "an unknown item to look for makes %s unknown",
    (method) => {
      expect(valueOf(`["a", null].${method}(state)`)).toBe(null);
    },
  );

  test("unknown propagates through other operations", () => {
    for (const text of [
      "count + 1",
      "-count",
      "count > 1",
      "Math.round(count)",
      "double(count)",
      "tags?.length",
      "`n: ${count}`",
      '"n: " + count',
    ]) {
      expect(valueOf(text, { count: null, tags: null })).toBe(null);
    }
  });

  test("a function parameter that accepts unknown receives it", () => {
    expect(valueOf("describe(count)", { count: null })).toBe("n=null");
    expect(valueOf("describe(count)")).toBe("n=7");
  });
});

describe("errors and pending", () => {
  test("an error on either side fails a condition the other side decides", () => {
    expect(failureOf('broken === "x" && false')).toEqual({
      kind: FailureKind.Error,
      message: "read failed",
    });
    expect(failureOf('true || broken === "x"')).toMatchObject({
      kind: FailureKind.Error,
    });
  });

  test("pending is not unknown, and an error outranks it", () => {
    expect(failureOf('waiting === "x" || true')).toEqual({
      kind: FailureKind.Pending,
      waitingOn: ["action:1"],
    });
    expect(failureOf('waiting === "x" && waitingToo === "y"')).toEqual({
      kind: FailureKind.Pending,
      waitingOn: ["action:1", "action:2"],
    });
    expect(failureOf('waiting === "x" || broken === "y"')).toMatchObject({
      kind: FailureKind.Error,
    });
    expect(failureOf("isMissing(waiting)")).toMatchObject({
      kind: FailureKind.Pending,
    });
    expect(failureOf('[1].some(x => broken === "x", waiting)')).toMatchObject({
      kind: FailureKind.Error,
    });
    expect(failureOf("[1].map(x => 1, waiting)")).toEqual({
      kind: FailureKind.Pending,
      waitingOn: ["action:1"],
    });
    expect(failureOf("[waiting].map(x => x, broken)")).toMatchObject({
      kind: FailureKind.Error,
    });
    expect(failureOf("[waiting].map(x => x, waitingToo)")).toEqual({
      kind: FailureKind.Pending,
      waitingOn: ["action:1", "action:2"],
    });
    expect(
      failureOf('items.map(item => item.name === "a" ? waiting : broken)'),
    ).toMatchObject({ kind: FailureKind.Error });
    expect(
      failureOf(
        'items.flatMap(item => item.name === "a" ? [waiting] : [broken])',
      ),
    ).toMatchObject({ kind: FailureKind.Error });
  });

  test("the branch a ternary doesn't take is not evaluated", () => {
    expect(valueOf('true ? 1 : broken === "x"')).toBe(1);
    expect(valueOf('false ? broken === "x" : 1')).toBe(1);
    expect(valueOf('state === "CA" ? broken === "x" : waiting === "x"')).toBe(
      null,
    );
  });

  test("the right of ?? is evaluated only for an unknown left", () => {
    expect(valueOf('1 ?? broken === "x"')).toBe(1);
  });

  test("?? doesn't recover a failed or pending left", () => {
    expect(failureOf('(waiting === "x") ?? true')).toMatchObject({
      kind: FailureKind.Pending,
    });
    expect(failureOf('(broken === "x") ?? true')).toMatchObject({
      kind: FailureKind.Error,
    });
  });

  test("a function runs whatever its method's other arguments hold", () => {
    expect(
      valueOf("[1, 2].reduce((sum, n) => (sum ?? 0) + n, count)", {
        count: null,
      }),
    ).toBe(3);
    expect(
      run("isMissing([1].reduce((sum, n) => Math.log(-1), count))", {
        overrides: { count: null },
      }),
    ).toMatchObject({ ok: false, error: { kind: FailureKind.Error } });
    expect(
      failureOf("isMissing([1].map(n => Math.log(-1), state))"),
    ).toMatchObject({ kind: FailureKind.Error });
  });

  test("reduce stops at the first failure", () => {
    expect(
      failureOf(
        'items.reduce((sum, item) => item.name === "a" ? waiting : broken, "")',
      ),
    ).toMatchObject({ kind: FailureKind.Pending });
  });

  test.each([
    ["items[0].missing", "There's no field `missing` here."],
    ["items[0].toString", "There's no field `toString` here."],
    [
      "mistyped",
      "Input `mistyped` doesn't match its type: expected number, got text",
    ],
    ["count / zero", "/ didn't give a finite number."],
    ["Math.log(-1)", "Math.log didn't give a finite number."],
    ["Math.abs(1, 2)", "Math.abs takes 1 value."],
    ["Math.atan2(1)", "Math.atan2 takes 2 values."],
    ['double("1")', "double n: expected number, got text"],
    ['namesOf("x")', "namesOf people: expected a list, got text"],
    ["namesOf(tags)", "namesOf people: [0]: expected a record, got text"],
    [
      "half(1)",
      "half returned a value that doesn't match its type: expected number, got text",
    ],
  ])("%s", (text, message) => {
    expect(failureOf(text)).toEqual({ kind: FailureKind.Error, message });
  });

  test("a choice input reads as its value", () => {
    expect(valueOf("choice", { choice: "a" })).toBe("a");
  });

  test.each<[string, Record<string, Value>, string]>([
    ["choice", { choice: "z" }, 'expected one of "a", got text'],
    ["items", { items: [{ score: 1 }] }, "[0]: .name: missing"],
    [
      "items[0].secret",
      { items: [{ name: "a", score: 1, secret: "s" }] },
      "[0]: has a field its type doesn't declare",
    ],
    ["names", { names: ["a", 1] }, "[1]: expected string, got a number"],
    ["count", { count: Number.NaN }, "expected number, got NaN"],
    ["count", { count: true }, "expected number, got a yes/no value"],
    ["count", { count: [1] }, "expected number, got a list"],
    ["count", { count: { a: 1 } }, "expected number, got a record"],
    ["tags", { tags: "x" }, "expected a list, got text"],
    ["items", { items: ["a"] }, "[0]: expected a record, got text"],
    [
      "count",
      { count: JSON.parse("{}").count },
      "expected number, got undefined",
    ],
  ])("%s read as %p fails", (text, overrides, problem) => {
    const id = text.split(/[.[]/)[0];
    expect(run(text, { overrides })).toEqual(
      R.failure({
        kind: FailureKind.Error,
        message: `Input \`${id}\` doesn't match its type: ${problem}`,
      }),
    );
  });

  test.each<[Expr, string]>([
    [{ kind: ExprKind.Input, id: "gone" }, "There's no input `gone`."],
    [
      { kind: ExprKind.Ref, id: "gone" },
      "Named expression `gone` doesn't exist.",
    ],
    [
      { kind: ExprKind.Call, fn: "gone", args: [] },
      "There's no function `gone`.",
    ],
    [
      {
        kind: ExprKind.Method,
        target: { kind: ExprKind.Literal, value: null },
        method: "gone",
        args: [],
        optional: false,
      },
      "`gone` can't be called on this value.",
    ],
  ])("a stored tree reading what was removed fails: %j", (tree, message) => {
    expect(evaluate(tree, unreachable)).toEqual(
      R.failure({ kind: FailureKind.Error, message }),
    );
  });
});

test("a host function gets only the fields its parameter declares", () => {
  expect(valueOf("namesOf(items)")).toBe('[{"name":"a"},{"name":"b"}]');
  expect(valueOf("nameOf(items[0])")).toBe('{"name":"a"}');
});

describe("named expressions", () => {
  const named: NamedExpression[] = [
    {
      id: "1",
      name: "isCalifornia",
      tree: R.unwrap(parseExpression('state === "CA"', { catalog, named: [] })),
    },
  ];
  const withNamed = [
    ...named,
    {
      id: "2",
      name: "label",
      tree: R.unwrap(
        parseExpression('(isCalifornia ?? false) ? "CA" : "elsewhere"', {
          catalog,
          named,
        }),
      ),
    },
  ];

  test("evaluate through references", () => {
    expect(R.unwrap(run("label", { named: withNamed }))).toBe("elsewhere");
    expect(
      R.unwrap(run("label", { named: withNamed, overrides: { state: "CA" } })),
    ).toBe("CA");
  });

  test("an evaluation reads each input and named expression once", () => {
    const twice: NamedExpression[] = [
      {
        id: "3",
        name: "twice",
        tree: R.unwrap(
          parseExpression("double(count) + double(count)", {
            catalog,
            named: [],
          }),
        ),
      },
    ];
    const calls: string[] = [];
    const result = evaluate(
      R.unwrap(parseExpression("twice + twice", { catalog, named: twice })),
      {
        catalog,
        named: twice,
        readInput: (id) => {
          calls.push(id);
          return R.success(1);
        },
        callFunction: (name) => {
          calls.push(name);
          return R.success(2);
        },
      },
    );
    expect(result).toEqual(R.success(8));
    expect(calls).toEqual(["count", "double", "double"]);
  });

  test("a cycle is an error", () => {
    const looped: NamedExpression = {
      id: "1",
      name: "loop",
      tree: { kind: ExprKind.Ref, id: "1" },
    };
    expect(run("loop", { named: [looped] })).toEqual(
      R.failure({
        kind: FailureKind.Error,
        message: "`loop` depends on itself.",
      }),
    );
  });

  test("a stored tree with a function after a method's first argument fails", () => {
    const always: Expr = {
      kind: ExprKind.Lambda,
      params: [],
      body: { kind: ExprKind.Literal, value: true },
    };
    const tree: Expr = {
      kind: ExprKind.Method,
      target: { kind: ExprKind.List, items: [] },
      method: "some",
      args: [always, always],
      optional: false,
    };
    expect(evaluate(tree, unreachable)).toEqual(
      R.failure({ kind: FailureKind.Error, message: LAMBDA_ONLY_AS_ARGUMENT }),
    );
  });
});
