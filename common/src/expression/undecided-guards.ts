import { IS_MISSING } from "./catalog";
import { BinaryOp, ExprKind, UnaryOp, children, type Expr } from "./tree";

/**
 * The reads `isMissing` tests in `side`, or in `!side` when `negated`, through
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
    call.fn === IS_MISSING &&
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

enum GuardKind {
  /** A ternary test's: only the branch it takes runs. */
  Branch,
  /** Beside `&&` or `||`. */
  Beside,
  /**
   * Beside `&&` or `||` outside a list, record, `map` result, `reduce`
   * function or argument holding the read, which carries the read's value on.
   */
  Held,
}

const IN_HELD: Record<GuardKind, GuardKind> = {
  [GuardKind.Branch]: GuardKind.Branch,
  [GuardKind.Beside]: GuardKind.Held,
  [GuardKind.Held]: GuardKind.Held,
};

// Whether a guard already known decides at least what one of kind `added`
// would.
const decidesAsMuch = (existing: GuardKind, added: GuardKind) => {
  switch (existing) {
    case GuardKind.Branch:
      return true;
    case GuardKind.Beside:
      return added === GuardKind.Beside;
    case GuardKind.Held:
      return false;
    default:
      throw new Error(`unknown guard kind: ${existing satisfies never}`);
  }
};

/**
 * The reads an `isMissing` guard decides where the analysis stands. In
 * `… || isMissing(x)`, `… && !isMissing(x)` and `isMissing(x) ? … : …`, an
 * unknown `x` in the other operand or branch can't leave the result
 * undecided: the guard decides it. Reads are matched by their tree, whatever
 * their spacing, quotes or parentheses, so each guard keeps the names it
 * reads: a lambda parameter of the same name is a different value.
 */
export function guards({ text }: { text: (expr: Expr) => string }) {
  type Guard = { names: readonly string[]; kind: GuardKind };
  const known = new Map<string, Guard>();
  const withKnown = <T>(
    entries: ReadonlyMap<string, Guard>,
    run: () => T,
  ): T => {
    const saved = new Map(known);
    known.clear();
    entries.forEach((guard, read) => known.set(read, guard));
    try {
      return run();
    } finally {
      known.clear();
      saved.forEach((guard, read) => known.set(read, guard));
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
  const assumingOne = <T>(
    { read, kind }: { read: Expr; kind: GuardKind },
    run: () => T,
  ): T => {
    const existing = known.get(readKey(read));
    if (existing !== undefined && decidesAsMuch(existing.kind, kind)) {
      return run();
    }
    return withKnown(
      new Map([...known, [readKey(read), { names: freeNames(read), kind }]]),
      run,
    );
  };
  const assuming = <T>(
    { reads, kind }: { reads: readonly Expr[]; kind: GuardKind },
    run: () => T,
  ): T =>
    reads.reduceRight<() => T>(
      (next, read) => () => assumingOne({ read, kind }, next),
      run,
    )();
  return {
    covers: (expr: Expr) => known.size > 0 && known.has(readKey(expr)),
    holds: (expr: Expr) => known.get(readKey(expr))?.kind === GuardKind.Held,
    decidedInBranch: (expr: Expr) =>
      known.get(readKey(expr))?.kind === GuardKind.Branch,
    assumingKnown: <T>(reads: readonly Expr[], run: () => T): T =>
      assuming({ reads, kind: GuardKind.Beside }, run),
    inBranch: <T>(reads: readonly Expr[], run: () => T): T =>
      assuming({ reads, kind: GuardKind.Branch }, run),
    held: <T>(run: () => T): T =>
      withKnown(
        new Map(
          [...known].map(([read, guard]) => [
            read,
            { ...guard, kind: IN_HELD[guard.kind] },
          ]),
        ),
        run,
      ),
    branchesOnly: <T>(run: () => T): T =>
      withKnown(
        new Map([...known].filter(([, { kind }]) => kind === GuardKind.Branch)),
        run,
      ),
    inLambda: <T>(lambda: { params: string[] }, run: () => T): T =>
      withKnown(
        new Map(
          [...known].filter(([, { names }]) =>
            names.every((name) => !lambda.params.includes(name)),
          ),
        ),
        run,
      ),
  };
}
