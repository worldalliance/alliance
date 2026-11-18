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
  // The key's declared type, not the key, names the fields: `rec[key]` with a
  // `key` that can be "a" or "b" reads `a` or `b`, even where `tsc` narrowed
  // `key`, as on the right of `key === "a" || …`.
  const declaredTypes = (expr: Expr): ts.Type[] | undefined => {
    const read = unparenthesized(node(expr));
    if (!ts.isElementAccessExpression(read)) {
      const symbol = checker.getSymbolAtLocation(
        ts.isPropertyAccessExpression(read) ? read.name : read,
      );
      return symbol && [checker.getTypeOfSymbol(symbol)];
    }
    const target = checker.getNonNullableType(
      checker.getTypeAtLocation(read.expression),
    );
    const keys = (expr.kind === ExprKind.Index &&
      expr.index.kind !== ExprKind.Literal &&
      declaredTypes(expr.index)) || [
      checker.getTypeAtLocation(read.argumentExpression),
    ];
    const fields = keys
      .flatMap(unionParts)
      .filter((key) => !isNullableType(key))
      .map((key) =>
        key.isStringLiteral() || key.isNumberLiteral()
          ? checker.getPropertyOfType(target, String(key.value))
          : undefined,
      );
    if (!fields.every((field) => field !== undefined)) return undefined;
    return fields.map((field) => checker.getTypeOfSymbol(field));
  };
  // A read through a target that can be missing, by position, or by a key
  // naming no field can be missing whatever `tsc` narrowed it to; a target a
  // guard covers can't.
  const declaredNullable = (
    expr: Expr,
    { covered }: { covered: (read: Expr) => boolean },
  ): boolean => {
    const types = declaredTypes(expr);
    if (expr.kind === ExprKind.Member || expr.kind === ExprKind.Index) {
      if (!covered(expr.target) && declaredNullable(expr.target, { covered })) {
        return true;
      }
      if (expr.kind === ExprKind.Index && types === undefined) return true;
    }
    return types?.some(isNullableType) ?? false;
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
