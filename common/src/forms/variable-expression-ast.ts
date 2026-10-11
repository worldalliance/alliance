export enum ExprKind {
  Literal = "literal",
  Input = "input",
  Array = "array",
  Record = "record",
  Lambda = "lambda",
  Unary = "unary",
  Binary = "binary",
  Conditional = "conditional",
  Member = "member",
  MathCall = "mathCall",
  MethodCall = "methodCall",
}

export enum UnaryOp {
  Negate = "-",
  Plus = "+",
  Not = "!",
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
  Equal = "==",
  StrictEqual = "===",
  NotEqual = "!=",
  StrictNotEqual = "!==",
  And = "&&",
  Or = "||",
  Coalesce = "??",
}

export type ExprNode =
  | { kind: ExprKind.Literal; value: number | string | boolean }
  | { kind: ExprKind.Input; name: string }
  | { kind: ExprKind.Array; items: ExprNode[] }
  | { kind: ExprKind.Record; entries: { key: string; value: ExprNode }[] }
  | { kind: ExprKind.Lambda; params: string[]; body: ExprNode }
  | { kind: ExprKind.Unary; op: UnaryOp; operand: ExprNode }
  | { kind: ExprKind.Binary; op: BinaryOp; left: ExprNode; right: ExprNode }
  | {
      kind: ExprKind.Conditional;
      test: ExprNode;
      consequent: ExprNode;
      alternate: ExprNode;
    }
  | { kind: ExprKind.Member; target: ExprNode; property: ExprNode }
  | { kind: ExprKind.MathCall; fn: string; args: ExprNode[] }
  | {
      kind: ExprKind.MethodCall;
      target: ExprNode;
      method: string;
      args: ExprNode[];
    };
