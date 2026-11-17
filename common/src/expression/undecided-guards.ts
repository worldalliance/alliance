import { IS_UNKNOWN } from "./catalog";
import { BinaryOp, ExprKind, UnaryOp, children, type Expr } from "./tree";

/**
 * The reads `isUnknown` tests in `side`, or in `!side` when `negated`, through
 * a chain of `||`, or of `&&` when `negated`, as either decides the chain,
 * and through the left of `??`, which keeps a decided left.
 */
export function readsGuardedBy(
  side: Expr,
  { negated }: { negated: boolean },
): Expr[] {
  if (side.kind === ExprKind.Binary && side.op === BinaryOp.Coalesce) {
    return readsGuardedBy(side.left, { negated });
  }
  if (
    side.kind === ExprKind.Binary &&
    side.op === (negated ? BinaryOp.And : BinaryOp.Or)
  ) {
    return [side.left, side.right].flatMap((each) =>
      readsGuardedBy(each, { negated }),
    );
  }
  const call = negated
    ? side.kind === ExprKind.Unary && side.op === UnaryOp.Not
      ? side.operand
      : undefined
    : side;
  return call?.kind === ExprKind.Call &&
    call.fn === IS_UNKNOWN &&
    call.args.length === 1
    ? [call.args[0]]
    : [];
}

// `x["k"]` reads what `x.k` reads, so both share a key.
export const readKey = (expr: Expr) =>
  JSON.stringify(expr, (_key, value: unknown) =>
    isKeyRead(value)
      ? {
          kind: ExprKind.Member,
          target: value.target,
          property: value.index.value,
          optional: value.optional,
        }
      : value,
  );

const isKeyRead = (
  value: unknown,
): value is Extract<Expr, { kind: ExprKind.Index }> & {
  index: { value: string };
} =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  value.kind === ExprKind.Index &&
  "index" in value &&
  typeof value.index === "object" &&
  value.index !== null &&
  "kind" in value.index &&
  value.index.kind === ExprKind.Literal &&
  "value" in value.index &&
  typeof value.index.value === "string";

/**
 * The reads an `isUnknown` guard decides where the analysis stands. In
 * `… || isUnknown(x)`, `… && !isUnknown(x)` and `isUnknown(x) ? … : …`, an
 * unknown `x` in the other operand or branch can't leave the result
 * undecided: the guard decides it. Reads are matched by their tree, whatever
 * their spacing, quotes or parentheses, so each guard keeps the names it
 * reads: a lambda parameter of the same name is a different value.
 */
export function guards({ text }: { text: (expr: Expr) => string }) {
  const known = new Map<string, readonly string[]>();
  const withKnown = <T>(
    entries: ReadonlyMap<string, readonly string[]>,
    run: () => T,
  ): T => {
    const saved = new Map(known);
    known.clear();
    entries.forEach((names, read) => known.set(read, names));
    try {
      return run();
    } finally {
      known.clear();
      saved.forEach((names, read) => known.set(read, names));
    }
  };
  const freeNames = (expr: Expr): string[] => {
    switch (expr.kind) {
      case ExprKind.Input:
      case ExprKind.Ref:
      case ExprKind.Param:
        return [text(expr)];
      case ExprKind.Lambda:
        return freeNames(expr.body).filter(
          (name) => !expr.params.includes(name),
        );
      case ExprKind.Literal:
      case ExprKind.List:
      case ExprKind.Record:
      case ExprKind.Template:
      case ExprKind.Unary:
      case ExprKind.Binary:
      case ExprKind.Conditional:
      case ExprKind.Member:
      case ExprKind.Index:
      case ExprKind.Call:
      case ExprKind.Method:
        return children(expr).flatMap(freeNames);
      default:
        throw new Error(`unknown kind: ${expr satisfies never}`);
    }
  };
  return {
    covers: (expr: Expr) => known.size > 0 && known.has(readKey(expr)),
    assumingKnown: <T>(reads: readonly Expr[], run: () => T): T => {
      const added = reads.filter((read) => !known.has(readKey(read)));
      if (added.length === 0) return run();
      return withKnown(
        new Map([
          ...known,
          ...added.map((read): [string, string[]] => [
            readKey(read),
            freeNames(read),
          ]),
        ]),
        run,
      );
    },
    inLambda: <T>(lambda: { params: string[] }, run: () => T): T =>
      withKnown(
        new Map(
          [...known].filter(([, names]) =>
            names.every((name) => !lambda.params.includes(name)),
          ),
        ),
        run,
      ),
  };
}
