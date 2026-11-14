import ts from "typescript";
import { unionParts } from "../forms/formula-renderable";
import { unparenthesized } from "./convert-syntax";
import { ExprKind, type Expr } from "./tree";

export type Span = { start: number; end: number };

const NULLISH = ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void;
const BOOLEAN_LIKE = ts.TypeFlags.BooleanLike | NULLISH | ts.TypeFlags.Never;

export const isNullableType = (type: ts.Type) =>
  unionParts(type).some((part) => (part.flags & NULLISH) !== 0);

export const isYesNoType = (type: ts.Type) =>
  unionParts(type).every(
    (part) => (part.flags & (BOOLEAN_LIKE | ts.TypeFlags.Any)) !== 0,
  );

export function sourceQueries({
  source,
  checker,
  file,
  offset,
}: {
  source: ReadonlyMap<Expr, ts.Expression>;
  checker: ts.TypeChecker;
  file: ts.SourceFile;
  offset: number;
}) {
  const node = (expr: Expr): ts.Expression => {
    const found = source.get(expr);
    if (found === undefined)
      throw new Error(`no source for a ${expr.kind} node`);
    return found;
  };
  const nodeSpan = (found: ts.Node): Span => ({
    start: found.getStart(file) - offset,
    end: found.getEnd() - offset,
  });
  const typeOf = (expr: Expr) => checker.getTypeAtLocation(node(expr));
  const every = (expr: Expr, flags: ts.TypeFlags) =>
    unionParts(typeOf(expr)).every(
      (part) => (part.flags & (flags | ts.TypeFlags.Any)) !== 0,
    );
  // A read declared never missing stays so whatever `tsc` narrowed, unless
  // its target can be missing and no guard covers that target.
  const declaredNullable = (
    expr: Expr,
    { covered }: { covered: (read: Expr) => boolean },
  ): boolean => {
    if (
      (expr.kind === ExprKind.Member || expr.kind === ExprKind.Index) &&
      !covered(expr.target) &&
      declaredNullable(expr.target, { covered })
    ) {
      return true;
    }
    const read = unparenthesized(node(expr));
    const symbol = checker.getSymbolAtLocation(
      ts.isPropertyAccessExpression(read) ? read.name : read,
    );
    if (symbol === undefined) return ts.isElementAccessExpression(read);
    return isNullableType(checker.getTypeOfSymbol(symbol));
  };
  return {
    node,
    span: (expr: Expr) => nodeSpan(node(expr)),
    operandSpan: (expr: Expr) => nodeSpan(unparenthesized(node(expr))),
    text: (expr: Expr) => unparenthesized(node(expr)).getText(file),
    typeOf,
    nullable: (expr: Expr) => isNullableType(typeOf(expr)),
    declaredNullable,
    hasMissingItem: (list: Expr) => {
      const item = checker.getIndexTypeOfType(
        checker.getNonNullableType(typeOf(list)),
        ts.IndexKind.Number,
      );
      return item !== undefined && isNullableType(item);
    },
    isString: (expr: Expr) => every(expr, ts.TypeFlags.StringLike),
  };
}
