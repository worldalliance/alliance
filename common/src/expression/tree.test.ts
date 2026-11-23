import { BinaryOp, ExprKind, UnaryOp, children, type Expr } from "./tree";

const a: Expr = { kind: ExprKind.Input, id: "a" };
const b: Expr = { kind: ExprKind.Input, id: "b" };
const c: Expr = { kind: ExprKind.Input, id: "c" };

const cases: Record<ExprKind, [Expr, Expr[]]> = {
  [ExprKind.Literal]: [{ kind: ExprKind.Literal, value: 1 }, []],
  [ExprKind.Input]: [a, []],
  [ExprKind.Ref]: [{ kind: ExprKind.Ref, id: "r" }, []],
  [ExprKind.Param]: [{ kind: ExprKind.Param, name: "x" }, []],
  [ExprKind.OnList]: [{ kind: ExprKind.OnList, listId: "l" }, []],
  [ExprKind.List]: [{ kind: ExprKind.List, items: [a, b] }, [a, b]],
  [ExprKind.Record]: [
    {
      kind: ExprKind.Record,
      entries: [
        { key: "k", value: a },
        { key: "l", value: b },
      ],
    },
    [a, b],
  ],
  [ExprKind.Template]: [
    { kind: ExprKind.Template, quasis: ["", "-", ""], parts: [a, b] },
    [a, b],
  ],
  [ExprKind.Unary]: [
    { kind: ExprKind.Unary, op: UnaryOp.Not, operand: a },
    [a],
  ],
  [ExprKind.Binary]: [
    { kind: ExprKind.Binary, op: BinaryOp.Add, left: a, right: b },
    [a, b],
  ],
  [ExprKind.Conditional]: [
    { kind: ExprKind.Conditional, test: a, consequent: b, alternate: c },
    [a, b, c],
  ],
  [ExprKind.Member]: [
    { kind: ExprKind.Member, target: a, property: "p", optional: false },
    [a],
  ],
  [ExprKind.Index]: [
    { kind: ExprKind.Index, target: a, index: b, optional: false },
    [a, b],
  ],
  [ExprKind.Call]: [{ kind: ExprKind.Call, fn: "f", args: [a, b] }, [a, b]],
  [ExprKind.Method]: [
    {
      kind: ExprKind.Method,
      target: a,
      method: "map",
      args: [b, c],
      optional: false,
    },
    [a, b, c],
  ],
  [ExprKind.Lambda]: [{ kind: ExprKind.Lambda, params: ["x"], body: a }, [a]],
};

test.each(Object.entries(cases))("children of %s", (_, [expr, expected]) => {
  const actual = children(expr);
  expect(actual).toHaveLength(expected.length);
  actual.forEach((child, index) => expect(child).toBe(expected[index]));
});
