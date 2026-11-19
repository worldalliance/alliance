import { R } from "../result";
import { type NamedExpression } from "./catalog";
import { checkExpression } from "./check";
import {
  GUARDED,
  NEEDLESS,
  catalog,
  condition,
  named,
  problems,
  variable,
} from "./check-test-support";
import { parseExpression } from "./parse";
import { BinaryOp, ExprKind, type Expr } from "./tree";

test("a stored tree checks like its printed text", () => {
  const tree = R.unwrap(
    parseExpression("(total > 1) === true", { catalog, named: [] }),
  );
  expect(
    R.unwrap(
      checkExpression({
        source: tree,
        scope: { catalog, named: [] },
        rule: condition,
      }),
    ),
  ).toMatchObject({ text: "total > 1 === true", tree });
});

test("a stored tree calling a removed function fails once", () => {
  expect(
    checkExpression({
      source: { kind: ExprKind.Call, fn: "gone", args: [] },
      scope: { catalog, named: [] },
      rule: variable,
    }),
  ).toEqual(
    R.failure([
      { message: "There's no function called `gone`.", start: 0, end: 4 },
    ]),
  );
});

test("a stored tree whose named expression was deleted fails", () => {
  expect(
    checkExpression({
      source: { kind: ExprKind.Ref, id: "gone" },
      scope: { catalog, named: [] },
      rule: variable,
    }),
  ).toEqual(
    R.failure([
      {
        message: "This uses a named expression that no longer exists.",
        start: 0,
        end: 4,
      },
    ]),
  );
});

test("a deleted named expression is reported where it's read", () => {
  const reader: NamedExpression = {
    id: "5",
    name: "reader",
    tree: { kind: ExprKind.Ref, id: "gone" },
  };
  expect(problems("reader", { ...variable, named: [reader] })).toEqual([
    {
      message: "This uses a named expression that no longer exists.",
      at: "reader@0",
    },
  ]);
});

test("named expressions reading a removed input are listed by name", () => {
  const a = named({ id: "1", name: "a", text: "total + 1" });
  const b = named({ id: "2", name: "b", text: "total + 2" });
  const inputs = catalog.inputs.filter((input) => input.id !== "total");
  const result = checkExpression({
    source: "a + b",
    scope: { catalog: { ...catalog, inputs }, named: [b, a] },
    rule: variable,
  });
  const message = "This uses an input that no longer exists.";
  expect(result).toEqual(
    R.failure([
      { message, start: 0, end: 9, namedExpression: "a" },
      { message, start: 0, end: 9, namedExpression: "b" },
    ]),
  );
});

test("a reader of a named expression reading a removed input gets only its problem", () => {
  const a = named({ id: "1", name: "a", text: "total + 1" });
  const inputs = catalog.inputs.filter((input) => input.id !== "total");
  const source: Expr = {
    kind: ExprKind.Binary,
    op: BinaryOp.Add,
    left: { kind: ExprKind.Ref, id: "1" },
    right: { kind: ExprKind.Ref, id: "gone" },
  };
  expect(
    checkExpression({
      source,
      scope: { catalog: { ...catalog, inputs }, named: [a] },
      rule: variable,
    }),
  ).toEqual(
    R.failure([
      {
        message: "This uses an input that no longer exists.",
        start: 0,
        end: 9,
        namedExpression: "a",
      },
    ]),
  );
});

test("a named expression's typing problem shows past its reader's removed input", () => {
  const a = named({ id: "1", name: "a", text: '"x" - 1' });
  const b = named({ id: "2", name: "b", text: "total" });
  const mid = named({ id: "3", name: "mid", text: '"m" - b', others: [b] });
  const inputs = catalog.inputs.filter((input) => input.id !== "total");
  const source: Expr = {
    kind: ExprKind.Binary,
    op: BinaryOp.Add,
    left: { kind: ExprKind.Input, id: "total" },
    right: {
      kind: ExprKind.Binary,
      op: BinaryOp.Add,
      left: { kind: ExprKind.Ref, id: "1" },
      right: { kind: ExprKind.Ref, id: "3" },
    },
  };
  expect(
    checkExpression({
      source,
      scope: { catalog: { ...catalog, inputs }, named: [a, b, mid] },
      rule: variable,
    }),
  ).toEqual(
    R.failure([
      {
        message: "The left of this operator has to be a number.",
        start: 0,
        end: 3,
        namedExpression: "a",
      },
      {
        message: "This uses an input that no longer exists.",
        start: 0,
        end: 5,
        namedExpression: "b",
      },
    ]),
  );
});

test("a removed input whose id a named expression's name took is reported where it's read", () => {
  const taken = named({ id: "6", name: "gone", text: "5" });
  const gone: Expr = { kind: ExprKind.Input, id: "gone" };
  const message = "This uses an input that no longer exists.";
  expect(
    checkExpression({
      source: gone,
      scope: { catalog, named: [taken] },
      rule: variable,
    }),
  ).toEqual(R.failure([{ message, start: 0, end: 4 }]));
  const reader: NamedExpression = { id: "7", name: "reader", tree: gone };
  expect(problems("reader", { ...variable, named: [taken, reader] })).toEqual([
    { message, at: "reader@0" },
  ]);
});

test("a stored tree's scope with two named expressions of one name throws", () => {
  expect(() =>
    checkExpression({
      source: { kind: ExprKind.Ref, id: "1" },
      scope: {
        catalog,
        named: [
          { id: "1", name: "a", tree: { kind: ExprKind.Literal, value: 1 } },
          { id: "2", name: "a", tree: { kind: ExprKind.Literal, value: 1 } },
        ],
      },
      rule: variable,
    }),
  ).toThrow("`a` names two things in the scope.");
});

test.each([
  ["through another", "a → b → a", { kind: ExprKind.Ref, id: "b" }],
  ["directly", "a → a", { kind: ExprKind.Ref, id: "a" }],
] satisfies [string, string, Expr][])(
  "a loop reading a removed input %s is reported as a loop",
  (_, path, read) => {
    const a: NamedExpression = {
      id: "a",
      name: "a",
      tree: {
        kind: ExprKind.Binary,
        op: BinaryOp.Add,
        left: { kind: ExprKind.Input, id: "total" },
        right: read,
      },
    };
    const b: NamedExpression = {
      id: "b",
      name: "b",
      tree: { kind: ExprKind.Ref, id: "a" },
    };
    const inputs = catalog.inputs.filter((input) => input.id !== "total");
    const result = checkExpression({
      source: "a",
      scope: { catalog: { ...catalog, inputs }, named: [a, b] },
      rule: variable,
    });
    expect(result).toEqual(
      R.failure([
        {
          message: `These named expressions refer to each other in a loop: ${path}.`,
          start: 0,
          end: 1,
        },
      ]),
    );
  },
);

describe("a stored expression isn't told a fallback can't change its result", () => {
  const safe = named({ id: "s", name: "safe", text: "total ?? 0" });
  const check = (
    source: string,
    stored?: { root: boolean; named: ReadonlySet<string> },
  ) =>
    checkExpression({
      source,
      scope: { catalog, named: [safe] },
      rule: variable,
      stored,
    });

  const root = { root: true, named: new Set<string>() };
  test.each([
    ["the root", "total ?? 0", root, NEEDLESS],
    [
      "a named expression",
      "safe",
      { root: false, named: new Set(["s"]) },
      NEEDLESS,
    ],
    [
      "the root, where an `isUnknown` guard makes one needless",
      'isUnknown(state) ? false : ((state === "CA") ?? false)',
      root,
      GUARDED,
    ],
  ])("in %s", (_, source, stored, message) => {
    expect(check(source)).toEqual(
      R.failure([expect.objectContaining({ message })]),
    );
    expect(check(source, stored).ok).toBe(true);
  });

  test("but is still told its other problems", () => {
    expect(check("((total && true) ?? false) ?? true", root)).toEqual(
      R.failure([
        expect.objectContaining({ message: "This needs a yes/no value." }),
      ]),
    );
  });

  test("but a stored root's named expressions still are", () => {
    expect(check("safe", root)).toEqual(
      R.failure([
        expect.objectContaining({ message: NEEDLESS, namedExpression: "safe" }),
      ]),
    );
  });

  test("and so is an unstored root reading stored ones", () => {
    expect(check("safe ?? 0", { root: false, named: new Set(["s"]) })).toEqual(
      R.failure([
        expect.objectContaining({
          message: NEEDLESS,
          namedExpression: undefined,
        }),
      ]),
    );
  });
});
