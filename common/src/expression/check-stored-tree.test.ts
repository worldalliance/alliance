import { R } from "../result";
import { type NamedExpression } from "./catalog";
import { checkExpression } from "./check";
import {
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

test.each([
  ["an input", { kind: ExprKind.Input, id: "state" }, "state", []],
  [
    "a named expression",
    { kind: ExprKind.Ref, id: "1" },
    "x",
    [named({ id: "1", name: "x", text: "state" })],
  ],
  [
    "a function",
    {
      kind: ExprKind.Call,
      fn: "double",
      args: [{ kind: ExprKind.Literal, value: 1 }],
    },
    "double",
    [],
  ],
  [
    "a Math function",
    {
      kind: ExprKind.Call,
      fn: "Math.abs",
      args: [{ kind: ExprKind.Literal, value: 1 }],
    },
    "Math",
    [],
  ],
] satisfies [string, Expr, string, NamedExpression[]][])(
  "a stored tree reading %s a parameter hides fails",
  (_, read, name, namedExpressions) => {
    const tree: Expr = {
      kind: ExprKind.Method,
      target: { kind: ExprKind.Input, id: "items" },
      method: "some",
      optional: false,
      args: [
        {
          kind: ExprKind.Lambda,
          params: [name],
          body: {
            kind: ExprKind.Binary,
            op: BinaryOp.Equal,
            left: read,
            right: { kind: ExprKind.Literal, value: "CA" },
          },
        },
      ],
    };
    const checked = checkExpression({
      source: tree,
      scope: { catalog, named: namedExpressions },
      rule: condition,
    });
    expect(checked).toEqual(
      R.failure([
        expect.objectContaining({
          message: `A function parameter here is also called \`${name}\`, so the text reads the parameter instead. Rename the parameter.`,
          start: 0,
        }),
      ]),
    );
  },
);

test("a parameter hiding a read is reported in the named expression", () => {
  const hiding: NamedExpression = {
    id: "1",
    name: "x",
    tree: {
      kind: ExprKind.Method,
      target: { kind: ExprKind.Input, id: "items" },
      method: "some",
      optional: false,
      args: [
        {
          kind: ExprKind.Lambda,
          params: ["state"],
          body: {
            kind: ExprKind.Binary,
            op: BinaryOp.Equal,
            left: { kind: ExprKind.Input, id: "state" },
            right: { kind: ExprKind.Literal, value: "CA" },
          },
        },
      ],
    },
  };
  expect(
    checkExpression({
      source: "x === true",
      scope: { catalog, named: [hiding] },
      rule: condition,
    }),
  ).toEqual(
    R.failure([
      expect.objectContaining({
        message:
          "A function parameter here is also called `state`, so the text reads the parameter instead. Rename the parameter.",
        namedExpression: "x",
      }),
    ]),
  );
});

test("a parameter read outside its function is reported", () => {
  const unbound: Expr = { kind: ExprKind.Param, name: "total" };
  const message =
    "This reads `total` outside the function that has it as a parameter.";
  expect(
    checkExpression({
      source: unbound,
      scope: { catalog, named: [] },
      rule: variable,
    }),
  ).toEqual(R.failure([expect.objectContaining({ message })]));
  expect(
    checkExpression({
      source: "amount",
      scope: { catalog, named: [{ id: "1", name: "amount", tree: unbound }] },
      rule: variable,
    }),
  ).toEqual(
    R.failure([
      expect.objectContaining({ message, namedExpression: "amount" }),
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
