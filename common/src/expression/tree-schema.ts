import { z } from "zod";
import { BinaryOp, ExprKind, UnaryOp, type Expr } from "./tree";

const expr: z.ZodType<Expr> = z.lazy(() => exprSchema);
const exprs = z.array(expr);

export const exprSchema: z.ZodType<Expr> = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal(ExprKind.Literal),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  }),
  z.object({ kind: z.literal(ExprKind.Input), id: z.string() }),
  z.object({ kind: z.literal(ExprKind.Ref), id: z.string() }),
  z.object({ kind: z.literal(ExprKind.Param), name: z.string() }),
  z.object({ kind: z.literal(ExprKind.List), items: exprs }),
  z.object({
    kind: z.literal(ExprKind.Record),
    entries: z.array(z.object({ key: z.string(), value: expr })),
  }),
  z.object({
    kind: z.literal(ExprKind.Template),
    quasis: z.array(z.string()),
    parts: exprs,
  }),
  z.object({
    kind: z.literal(ExprKind.Unary),
    op: z.enum(UnaryOp),
    operand: expr,
  }),
  z.object({
    kind: z.literal(ExprKind.Binary),
    op: z.enum(BinaryOp),
    left: expr,
    right: expr,
  }),
  z.object({
    kind: z.literal(ExprKind.Conditional),
    test: expr,
    consequent: expr,
    alternate: expr,
  }),
  z.object({
    kind: z.literal(ExprKind.Member),
    target: expr,
    property: z.string(),
    optional: z.boolean(),
  }),
  z.object({
    kind: z.literal(ExprKind.Index),
    target: expr,
    index: expr,
    optional: z.boolean(),
  }),
  z.object({
    kind: z.literal(ExprKind.Call),
    fn: z.string(),
    args: exprs,
  }),
  z.object({
    kind: z.literal(ExprKind.Method),
    target: expr,
    method: z.string(),
    args: exprs,
    optional: z.boolean(),
  }),
  z.object({
    kind: z.literal(ExprKind.Lambda),
    params: z.array(z.string()),
    body: expr,
  }),
]);
