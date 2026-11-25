import ts from "typescript";
import { BinaryOp } from "./tree";

export const BINARY_OPS: ReadonlyMap<ts.SyntaxKind, BinaryOp> = new Map([
  [ts.SyntaxKind.PlusToken, BinaryOp.Add],
  [ts.SyntaxKind.MinusToken, BinaryOp.Subtract],
  [ts.SyntaxKind.AsteriskToken, BinaryOp.Multiply],
  [ts.SyntaxKind.SlashToken, BinaryOp.Divide],
  [ts.SyntaxKind.PercentToken, BinaryOp.Modulo],
  [ts.SyntaxKind.AsteriskAsteriskToken, BinaryOp.Exponent],
  [ts.SyntaxKind.LessThanToken, BinaryOp.LessThan],
  [ts.SyntaxKind.GreaterThanToken, BinaryOp.GreaterThan],
  [ts.SyntaxKind.LessThanEqualsToken, BinaryOp.LessOrEqual],
  [ts.SyntaxKind.GreaterThanEqualsToken, BinaryOp.GreaterOrEqual],
  [ts.SyntaxKind.EqualsEqualsEqualsToken, BinaryOp.Equal],
  [ts.SyntaxKind.ExclamationEqualsEqualsToken, BinaryOp.NotEqual],
  [ts.SyntaxKind.AmpersandAmpersandToken, BinaryOp.And],
  [ts.SyntaxKind.BarBarToken, BinaryOp.Or],
  [ts.SyntaxKind.QuestionQuestionToken, BinaryOp.Coalesce],
]);

// JavaScript rejects `??` beside an unparenthesized `&&` or `||`; TypeScript
// reports it only from its checker.
export const COALESCE_MIXES: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.QuestionQuestionToken,
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
]);

// A comparison gives yes/no, which these can't order. TypeScript can also read
// such a nest as a call with type arguments once printed.
export const ORDERING: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
]);

export const LOOSE_EQUALITY: ReadonlyMap<ts.SyntaxKind, string> = new Map([
  [ts.SyntaxKind.EqualsEqualsToken, "==="],
  [ts.SyntaxKind.ExclamationEqualsToken, "!=="],
]);

export const unsupportedMessage = (text: string) =>
  `\`${text}\` isn't supported in expressions.`;

export const unparenthesized = (side: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(side) ? unparenthesized(side.expression) : side;
