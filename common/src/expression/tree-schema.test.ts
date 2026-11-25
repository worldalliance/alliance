import { expect, test } from "bun:test";
import { R } from "../result";
import { catalog } from "./check-test-support";
import { parseExpression } from "./parse";
import { BinaryOp, ExprKind, UnaryOp, type Expr } from "./tree";
import { exprSchema } from "./tree-schema";

test("a parsed tree reads back unchanged", () => {
  const tree = R.unwrap(
    parseExpression(
      '`${state ?? "none"}` + (items.some((item) => (item.score ?? 0) > 1) ? "a" : "b")',
      { catalog, named: [] },
    ),
  );
  expect(exprSchema.parse(JSON.parse(JSON.stringify(tree)))).toEqual(tree);
});

const one: Expr = { kind: ExprKind.Literal, value: 1 };
/**
 * One per kind, so a new kind fails to compile here until listed, and fails
 * the test below until the schema reads it.
 */
const everyKind: { [K in ExprKind]: Extract<Expr, { kind: K }> } = {
  [ExprKind.Literal]: { kind: ExprKind.Literal, value: "a" },
  [ExprKind.Input]: { kind: ExprKind.Input, id: "count" },
  [ExprKind.Ref]: {
    kind: ExprKind.Ref,
    id: "00000000-0000-4000-8000-000000000001",
  },
  [ExprKind.Param]: { kind: ExprKind.Param, name: "x" },
  [ExprKind.OnList]: {
    kind: ExprKind.OnList,
    listId: "00000000-0000-4000-8000-000000000002",
  },
  [ExprKind.List]: { kind: ExprKind.List, items: [one] },
  [ExprKind.Record]: {
    kind: ExprKind.Record,
    entries: [{ key: "a", value: one }],
  },
  [ExprKind.Template]: {
    kind: ExprKind.Template,
    quasis: ["a", ""],
    parts: [one],
  },
  [ExprKind.Unary]: { kind: ExprKind.Unary, op: UnaryOp.Negate, operand: one },
  [ExprKind.Binary]: {
    kind: ExprKind.Binary,
    op: BinaryOp.Add,
    left: one,
    right: one,
  },
  [ExprKind.Conditional]: {
    kind: ExprKind.Conditional,
    test: { kind: ExprKind.Literal, value: true },
    consequent: one,
    alternate: { kind: ExprKind.Literal, value: null },
  },
  [ExprKind.Member]: {
    kind: ExprKind.Member,
    target: one,
    property: "a",
    optional: true,
  },
  [ExprKind.Index]: {
    kind: ExprKind.Index,
    target: one,
    index: one,
    optional: false,
  },
  [ExprKind.Call]: { kind: ExprKind.Call, fn: "round", args: [one] },
  [ExprKind.Method]: {
    kind: ExprKind.Method,
    target: one,
    method: "some",
    args: [
      {
        kind: ExprKind.Lambda,
        params: ["x"],
        body: { kind: ExprKind.Param, name: "x" },
      },
    ],
    optional: false,
  },
  [ExprKind.Lambda]: { kind: ExprKind.Lambda, params: ["x"], body: one },
};

test.each(Object.values(everyKind))(
  "a stored %p reads back unchanged",
  (tree) => {
    expect(exprSchema.parse(JSON.parse(JSON.stringify(tree)))).toEqual(tree);
  },
);

test.each([
  [{ kind: "nope" }],
  [{ kind: "binary", op: "^", left: one, right: one }],
  [{ kind: "unary", op: "~", operand: one }],
  [{ kind: "list", items: [{ kind: "input" }] }],
])("%p is refused", (stored) => {
  expect(exprSchema.safeParse(stored).success).toBe(false);
});
