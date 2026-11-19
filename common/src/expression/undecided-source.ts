import ts from "typescript";
import { unionParts } from "../forms/formula-renderable";
import { BINARY_OPS, unparenthesized } from "./convert-syntax";
import { BinaryOp, children, ExprKind, type Expr } from "./tree";
import {
  ARGUMENT_TYPE,
  NO_OVERLAP,
  NOT_ASSIGNABLE,
} from "./undecided-messages";

export type Span = { start: number; end: number };

const NULLISH = ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void;
const BOOLEAN_LIKE = ts.TypeFlags.BooleanLike | NULLISH | ts.TypeFlags.Never;
export const COMPARABLE =
  ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | BOOLEAN_LIKE;
/** A number, or a missing value in its place. */
export const NUMBERS = ts.TypeFlags.NumberLike | NULLISH | ts.TypeFlags.Never;
/** Text, or a missing value in its place. */
export const TEXT = ts.TypeFlags.StringLike | NULLISH | ts.TypeFlags.Never;
/** What `<`, `>`, `<=` and `>=` take, beside a missing value. */
export const ORDERABLE = NUMBERS | TEXT;

export const isNullableType = (type: ts.Type) =>
  unionParts(type).some((part) => (part.flags & NULLISH) !== 0);

export const everyPart = (type: ts.Type, flags: ts.TypeFlags) =>
  unionParts(type).every(
    (part) => (part.flags & (flags | ts.TypeFlags.Any)) !== 0,
  );

export const isYesNoType = (type: ts.Type) => everyPart(type, BOOLEAN_LIKE);

/** Whether a value of `type` holds an item or field, at any depth, that can't be missing. */
export const rejectsMissingInside = (
  checker: ts.TypeChecker,
  type: ts.Type,
): boolean =>
  unionParts(checker.getNonNullableType(type)).some((part) => {
    const item =
      checker.isArrayType(part) || checker.isTupleType(part)
        ? checker.getIndexTypeOfType(part, ts.IndexKind.Number)
        : undefined;
    const inside =
      item !== undefined
        ? [item]
        : (part.flags & ts.TypeFlags.StructuredType) === 0
          ? []
          : checker
              .getPropertiesOfType(part)
              .map((field) => checker.getTypeOfSymbol(field));
    return inside.some(
      (each) => !isNullableType(each) || rejectsMissingInside(checker, each),
    );
  });

const LOGICAL: Record<BinaryOp, boolean> = {
  [BinaryOp.Add]: false,
  [BinaryOp.Subtract]: false,
  [BinaryOp.Multiply]: false,
  [BinaryOp.Divide]: false,
  [BinaryOp.Modulo]: false,
  [BinaryOp.Exponent]: false,
  [BinaryOp.LessThan]: false,
  [BinaryOp.GreaterThan]: false,
  [BinaryOp.LessOrEqual]: false,
  [BinaryOp.GreaterOrEqual]: false,
  [BinaryOp.Equal]: false,
  [BinaryOp.NotEqual]: false,
  [BinaryOp.And]: true,
  [BinaryOp.Or]: true,
  [BinaryOp.Coalesce]: false,
};

const isLogical = (
  expr: Expr,
): expr is Extract<Expr, { kind: ExprKind.Binary }> =>
  expr.kind === ExprKind.Binary && LOGICAL[expr.op];

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
  const itemOf = (type: ts.Type) =>
    checker.getIndexTypeOfType(
      checker.getNonNullableType(type),
      ts.IndexKind.Number,
    );
  const itemType = (list: Expr) => itemOf(typeOf(list));
  // The key's declared type, not the key, names the fields: `rec[key]` with a
  // `key` that can be "a" or "b" reads `a` or `b`, even where `tsc` narrowed
  // `key`, as on the right of `key === "a" || …`.
  const declaredTypes = (
    expr: Expr,
    targets?: readonly ts.Type[],
  ): ts.Type[] | undefined => {
    const read = unparenthesized(node(expr));
    if (!ts.isElementAccessExpression(read)) {
      const symbol = checker.getSymbolAtLocation(
        ts.isPropertyAccessExpression(read) ? read.name : read,
      );
      return symbol && [checker.getTypeOfSymbol(symbol)];
    }
    const keys = (expr.kind === ExprKind.Index &&
      expr.index.kind !== ExprKind.Literal &&
      declaredTypes(expr.index)) || [
      checker.getTypeAtLocation(read.argumentExpression),
    ];
    const fields = (targets ?? [checker.getTypeAtLocation(read.expression)])
      .map((target) => checker.getNonNullableType(target))
      .flatMap((target) =>
        keys
          .flatMap(unionParts)
          .filter((key) => !isNullableType(key))
          .map((key) =>
            key.isStringLiteral() || key.isNumberLiteral()
              ? checker.getPropertyOfType(target, String(key.value))
              : undefined,
          ),
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
  // `tsc` narrows the right of `isMissing(x) && …` to a missing `x`, which the
  // interpreter evaluates whatever `x` holds, so a type rule there reads the
  // type `x` is declared with. So does one in the branch of
  // `isMissing(x) ? … : …` that runs only with `x` missing, where using `x`
  // gains nothing.
  const ruledTypes = (expr: Expr): ts.Type[] => {
    const type = typeOf(expr);
    // A read that can't be missing narrows to `never` there.
    const narrowed =
      (type.flags & ts.TypeFlags.Never) !== 0 || everyPart(type, NULLISH);
    if (!narrowed) return [type];
    if (expr.kind !== ExprKind.Index) return declaredTypes(expr) ?? [type];
    // A guard can narrow the target instead, as `isMissing(items)` does
    // before `items[0]`.
    const targets = ruledTypes(expr.target);
    const items = targets.map(itemOf);
    return (
      declaredTypes(expr, targets) ??
      (items.every((item) => item !== undefined) ? items : [type])
    );
  };
  const every = (expr: Expr, flags: ts.TypeFlags) =>
    ruledTypes(expr).every((type) => everyPart(type, flags));
  // `tsc` types `total && true` as `0 | true`; its operands are
  // reported, not the `&&`. A ternary is read by its branches: asking `tsc`
  // at every link of a chain of them is slow.
  const isYesNo = (expr: Expr): boolean =>
    isLogical(expr)
      ? isYesNo(expr.left) && isYesNo(expr.right)
      : expr.kind === ExprKind.Conditional
        ? isYesNo(expr.consequent) && isYesNo(expr.alternate)
        : ruledTypes(expr).every(isYesNoType);
  // An `&&` or `||` is reported at its operands, and so is a ternary or `??`
  // with one on a side whose other side is one too or yes/no.
  const reportedInside = (expr: Expr): boolean => {
    const sides =
      expr.kind === ExprKind.Conditional
        ? [expr.consequent, expr.alternate]
        : expr.kind === ExprKind.Binary && expr.op === BinaryOp.Coalesce
          ? [expr.left, expr.right]
          : undefined;
    if (sides === undefined) return isLogical(expr);
    const inside = sides.map(reportedInside);
    return (
      inside.some(Boolean) &&
      sides.every((side, index) => inside[index] || isYesNo(side))
    );
  };
  // Where yes/no is asked of a value reported at its operands, `tsc`'s
  // mismatch at it, as an argument or otherwise, at its record entry's
  // name, or at the `===` or `!==` comparing it with yes/no, says the same.
  const restatedMismatches = (expr: Expr): (Span & { code: number })[] => {
    const inside = children(expr).flatMap(restatedMismatches);
    if (!reportedInside(expr) || isYesNo(expr)) return inside;
    const found = node(expr);
    let outer: ts.Node = found;
    while (ts.isParenthesizedExpression(outer.parent)) outer = outer.parent;
    const comparison = outer.parent;
    const other =
      ts.isBinaryExpression(comparison) &&
      [BinaryOp.Equal, BinaryOp.NotEqual].some(
        (op) => BINARY_OPS.get(comparison.operatorToken.kind) === op,
      )
        ? [comparison.left, comparison.right].find((side) => side !== outer)
        : undefined;
    const asked =
      other === undefined
        ? checker.getContextualType(found)
        : checker.getTypeAtLocation(other);
    if (asked === undefined) return inside;
    if (!isYesNoType(checker.getNonNullableType(asked))) return inside;
    const entry = found.parent;
    const name = ts.isPropertyAssignment(entry) ? [nodeSpan(entry.name)] : [];
    const compared = other === undefined ? [] : [nodeSpan(comparison)];
    return [nodeSpan(unparenthesized(found)), ...name, ...compared]
      .flatMap((at) =>
        [NOT_ASSIGNABLE, ARGUMENT_TYPE, NO_OVERLAP].map((code) => ({
          code,
          ...at,
        })),
      )
      .concat(inside);
  };
  return {
    node,
    span: (expr: Expr) => nodeSpan(node(expr)),
    operandSpan: (expr: Expr) => nodeSpan(unparenthesized(node(expr))),
    text: (expr: Expr) => unparenthesized(node(expr)).getText(file),
    typeOf,
    every,
    nullable: (expr: Expr) => isNullableType(typeOf(expr)),
    declaredNullable,
    itemType,
    hasMissingItem: (list: Expr) => {
      const item = itemType(list);
      return item !== undefined && isNullableType(item);
    },
    isString: (expr: Expr) => everyPart(typeOf(expr), ts.TypeFlags.StringLike),
    isYesNo,
    reportedInside,
    restatedMismatches,
  };
}
