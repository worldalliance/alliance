import { R } from "../result";
import { type NamedExpression } from "./catalog";
import { checkExpression } from "./check";
import { catalog, condition, named, variable } from "./check-test-support";
import { BinaryOp, ExprKind, type Expr } from "./tree";

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

test("a parameter hiding a read in a reader of a named expression with one is left out", () => {
  const hides = (body: Expr): Expr => ({
    kind: ExprKind.Method,
    target: { kind: ExprKind.Input, id: "items" },
    method: "some",
    optional: false,
    args: [{ kind: ExprKind.Lambda, params: ["state"], body }],
  });
  const inState: Expr = {
    kind: ExprKind.Binary,
    op: BinaryOp.Equal,
    left: { kind: ExprKind.Input, id: "state" },
    right: { kind: ExprKind.Literal, value: "CA" },
  };
  const x: NamedExpression = { id: "1", name: "x", tree: hides(inState) };
  const source = hides({
    kind: ExprKind.Binary,
    op: BinaryOp.And,
    left: { kind: ExprKind.Ref, id: "1" },
    right: inState,
  });
  const result = checkExpression({
    source,
    scope: { catalog, named: [x] },
    rule: condition,
  });
  expect(result.ok ? [] : result.error.map((d) => d.namedExpression)).toEqual([
    "x",
  ]);
});

test("a named expression's typing problem shows past its reader's hidden name", () => {
  const a = named({ id: "1", name: "a", text: '"x" - 1 > 0' });
  const source: Expr = {
    kind: ExprKind.Binary,
    op: BinaryOp.And,
    left: { kind: ExprKind.Ref, id: "1" },
    right: {
      kind: ExprKind.Method,
      target: { kind: ExprKind.Input, id: "items" },
      method: "some",
      optional: false,
      args: [
        {
          kind: ExprKind.Lambda,
          params: ["state"],
          body: { kind: ExprKind.Input, id: "state" },
        },
      ],
    },
  };
  expect(
    checkExpression({
      source,
      scope: { catalog, named: [a] },
      rule: condition,
    }),
  ).toEqual(
    R.failure([
      {
        message: "The left of this operator has to be a number.",
        start: 0,
        end: 3,
        namedExpression: "a",
      },
    ]),
  );
});
