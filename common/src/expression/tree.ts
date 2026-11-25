import { MATH_OBJECT_NAME } from "../forms/formula-allowlist";

export enum ExprKind {
  Literal = "literal",
  Input = "input",
  Ref = "ref",
  Param = "param",
  List = "list",
  Record = "record",
  Template = "template",
  Unary = "unary",
  Binary = "binary",
  Conditional = "conditional",
  Member = "member",
  Index = "index",
  Call = "call",
  Method = "method",
  Lambda = "lambda",
  OnList = "onList",
}

export enum UnaryOp {
  Not = "!",
  Negate = "-",
}

export enum BinaryOp {
  Add = "+",
  Subtract = "-",
  Multiply = "*",
  Divide = "/",
  Modulo = "%",
  Exponent = "**",
  LessThan = "<",
  GreaterThan = ">",
  LessOrEqual = "<=",
  GreaterOrEqual = ">=",
  Equal = "===",
  NotEqual = "!==",
  And = "&&",
  Or = "||",
  Coalesce = "??",
}

export const LAMBDA_ONLY_AS_ARGUMENT =
  "A function can only be the first value passed to a list method.";

export const REMOVED_FORMULA = "This uses a formula that no longer exists.";
export const REMOVED_LIST = "This uses a list that no longer exists.";
/** Leaves the input unnamed, since a formula may have taken its id as its name. */
export const REMOVED_INPUT = "This uses something that no longer exists.";

export type LiteralValue = string | number | boolean | null;

/**
 * The stored form of every expression. `Input` names an input by its stable
 * id, which is also its name in text; `Ref` names a named expression by id,
 * printed under its current name. `OnList` names a member list by id, printed
 * as `isOnList("<current name>")`. `Lambda` appears only as a method argument.
 */
export type Expr =
  | { kind: ExprKind.Literal; value: LiteralValue }
  | { kind: ExprKind.Input; id: string }
  | { kind: ExprKind.Ref; id: string }
  | { kind: ExprKind.Param; name: string }
  | { kind: ExprKind.List; items: Expr[] }
  | { kind: ExprKind.Record; entries: { key: string; value: Expr }[] }
  | { kind: ExprKind.Template; quasis: string[]; parts: Expr[] }
  | { kind: ExprKind.Unary; op: UnaryOp; operand: Expr }
  | { kind: ExprKind.Binary; op: BinaryOp; left: Expr; right: Expr }
  | {
      kind: ExprKind.Conditional;
      test: Expr;
      consequent: Expr;
      alternate: Expr;
    }
  | { kind: ExprKind.Member; target: Expr; property: string; optional: boolean }
  | { kind: ExprKind.Index; target: Expr; index: Expr; optional: boolean }
  | { kind: ExprKind.Call; fn: string; args: Expr[] }
  | {
      kind: ExprKind.Method;
      target: Expr;
      method: string;
      args: Expr[];
      optional: boolean;
    }
  | { kind: ExprKind.Lambda; params: string[]; body: Expr }
  | { kind: ExprKind.OnList; listId: string };

export function children(expr: Expr): readonly Expr[] {
  switch (expr.kind) {
    case ExprKind.Literal:
    case ExprKind.Input:
    case ExprKind.Ref:
    case ExprKind.Param:
    case ExprKind.OnList:
      return [];
    case ExprKind.List:
      return expr.items;
    case ExprKind.Record:
      return expr.entries.map((entry) => entry.value);
    case ExprKind.Template:
      return expr.parts;
    case ExprKind.Unary:
      return [expr.operand];
    case ExprKind.Binary:
      return [expr.left, expr.right];
    case ExprKind.Conditional:
      return [expr.test, expr.consequent, expr.alternate];
    case ExprKind.Member:
      return [expr.target];
    case ExprKind.Index:
      return [expr.target, expr.index];
    case ExprKind.Call:
      return expr.args;
    case ExprKind.Method:
      return [expr.target, ...expr.args];
    case ExprKind.Lambda:
      return [expr.body];
    default:
      throw new Error(`unknown kind: ${expr satisfies never}`);
  }
}

/** The `Math` function a call's `fn` names, as the parser writes it. */
export function mathFunctionName(fn: string): string | undefined {
  const prefix = `${MATH_OBJECT_NAME}.`;
  return fn.startsWith(prefix) ? fn.slice(prefix.length) : undefined;
}
