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

export type LiteralValue = string | number | boolean | null;

/**
 * The stored form of every expression. `Input` names an input by its stable
 * id, which is also its name in text; `Ref` names a named expression by id,
 * printed under its current name. `Lambda` appears only as a method argument.
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
  | { kind: ExprKind.Lambda; params: string[]; body: Expr };
