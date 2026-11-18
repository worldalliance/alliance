/* alliance/max-lines 650 -- one recursive walk whose counters, guard state and reports every branch shares; codex's splits move its operand checks or read tracking out behind callbacks into that state */
import ts from "typescript";
import { IS_UNKNOWN, type Diagnostic } from "./catalog";
import {
  collectsEachResult,
  feedsResultBack,
  indexParam,
  isItemLookup,
  isPredicateMethod,
  keepsUnknownAsItem,
  needsEveryItem,
} from "./evaluate-methods";
import { BinaryOp, ExprKind, UnaryOp, children, type Expr } from "./tree";
import { guards, readKey, readsGuardedBy } from "./undecided-guards";
import {
  GUARDED_FALLBACK,
  NEEDLESS_FALLBACK,
  NEVER_NULLISH,
  UNREACHABLE_FALLBACK,
  textMessage,
  undecidedMessage,
  type Culprit,
} from "./undecided-messages";
import {
  isNullableType,
  isYesNoType,
  sourceQueries,
  type Span,
} from "./undecided-source";

/** A `tsc` error at an operand, parentheses skipped, that the analysis needs gone. */
export type Excused = Span & { code: number };

type Analysis = {
  diagnostics: Diagnostic[];
  excused: Excused[];
  /** Set when the whole result can be unknown or undecided. */
  root: Culprit | undefined;
};

/**
 * Finds every part of a converted expression that can be unknown or undecided
 * where `tsc`'s types say it can't be, which `tsc` misses because it types
 * `===`, `&&`, `||` and `!` as plain yes/no. Unknown values may flow only into
 * three-valued operators, `===`/`!==`, either side of `??`, a ternary branch,
 * `isUnknown`, a function parameter that accepts a missing value, and the
 * result; a ternary test or list predicate needs a decided yes/no, and a text
 * part needs a value. It also reports a `??` whose left side can't be
 * missing, in place of `tsc`'s TS2869 and TS2881.
 */
export function analyze({
  tree,
  source,
  checker,
  file,
  offset,
}: {
  tree: Expr;
  source: ReadonlyMap<Expr, ts.Expression>;
  checker: ts.TypeChecker;
  file: ts.SourceFile;
  /** Where the expression's text starts in `file`. */
  offset: number;
}): Analysis {
  const diagnostics: Diagnostic[] = [];
  const excused: Excused[] = [];

  const {
    node,
    span,
    operandSpan,
    text,
    typeOf,
    nullable,
    declaredNullable,
    hasMissingItem,
    isString,
  } = sourceQueries({ source, checker, file, offset });
  const report = (expr: Expr, message: string) =>
    diagnostics.push({ message, ...span(expr) });
  const missingItemMatters = (expr: Extract<Expr, { kind: ExprKind.Method }>) =>
    isItemLookup(expr.method) || needsEveryItem(expr.method, expr.args.length);

  // Undecided reports, and reads that can be missing: `guarded` ones a guard
  // covered, which `tsc` may have narrowed, `narrowed` ones `tsc` narrowed by
  // anything but a guard, and `loose` ones, the narrowed reads that can leave
  // the value around them unknown, which those a held guard decides can't.
  const tally = { undecided: 0, guarded: 0, narrowed: 0, loose: 0 };
  const counts = () => ({ ...tally });
  const missingSoFar = () => tally.undecided + tally.guarded + tally.narrowed;
  const restore = (saved: typeof tally) => Object.assign(tally, saved);
  let quiet = false;
  let discarded = false;
  let dead = false;
  const undecided = (expr: Expr, culprit: Culprit) => {
    tally.undecided += 1;
    if (quiet) return;
    report(
      expr,
      undecidedMessage({ culprit, yesNo: isYesNoType(typeOf(expr)) }),
    );
  };
  // Undecided reports and guarded, narrowed and loose reads inside don't reach
  // the value around it, except with `keepsNarrowed`, where narrowed and loose
  // reads do, and any undecided report adds one narrowed, loose read.
  const isolated = <T>(
    run: () => T,
    { keepsNarrowed = false }: { keepsNarrowed?: boolean } = {},
  ): T => {
    const saved = counts();
    const result = run();
    const undecidedItem = tally.undecided > saved.undecided ? 1 : 0;
    const kept = [tally.narrowed + undecidedItem, tally.loose + undecidedItem];
    restore(saved);
    if (keepsNarrowed) [tally.narrowed, tally.loose] = kept;
    return result;
  };
  // A guard on the read holding this doesn't decide it.
  const loud = (run: () => void) => {
    const saved = quiet;
    quiet = discarded || dead;
    run();
    quiet = saved;
  };
  // A function receives its arguments whole, so discarding its result
  // discards nothing inside them.
  const received = (run: () => void) => {
    const saved = discarded;
    discarded = false;
    run();
    discarded = saved;
  };
  // An unknown list item, record entry or `map` result leaves the list, record
  // or call known, but a read out of it can take a narrowed read's missing
  // value, or an undecided item's, and carry a guarded read's on.
  const contained = (run: () => void) =>
    loud(() => isolated(() => held(run), { keepsNarrowed: true }));
  // A guard decides an unknown that reaches the read it guards, and an
  // `isUnknown` argument's value is discarded whole.
  const decidedByGuard = <T>(
    run: () => T,
    { discards }: { discards: boolean },
  ): T => {
    const saved = { quiet, discarded };
    quiet = true;
    discarded ||= discards;
    const result = isolated(run);
    ({ quiet, discarded } = saved);
    return result;
  };
  // Code that never runs reports no unknown, down to its calls' arguments.
  const neverRuns = (run: () => void) => {
    const saved = dead;
    dead = true;
    decidedByGuard(run, { discards: true });
    dead = saved;
  };
  // What a parameter given `run`'s value is fed, if it can be missing, leaving
  // no report or tally behind.
  const gives = (run: () => Culprit | undefined) => {
    const [reports, excuses] = [diagnostics.length, excused.length];
    let fed: Fed | undefined;
    neverRuns(() => {
      const was = counts();
      const loose =
        run() !== undefined ||
        tally.undecided > was.undecided ||
        tally.loose > was.loose;
      if (loose || tally.narrowed > was.narrowed) fed = { loose };
    });
    diagnostics.length = reports;
    excused.length = excuses;
    return fed;
  };
  const excuse = (expr: Expr, code: number) => {
    excused.push({ code, ...operandSpan(expr) });
  };
  // `tsc` leaves the right of `??` out of the result's type when it thinks the
  // left is never missing, so whether a required fallback fits is checked here.
  const fallback = (left: Expr, right: Expr) => {
    excuse(left, UNREACHABLE_FALLBACK);
    const expected = checker.getBaseTypeOfLiteralType(typeOf(left));
    // A fallback that can be missing passes its unknown on through the `??`.
    // A left narrowed to `never` is a contradiction `tsc` already reports.
    if (
      (expected.flags & ts.TypeFlags.Never) === 0 &&
      !checker.isTypeAssignableTo(
        checker.getNonNullableType(typeOf(right)),
        expected,
      )
    ) {
      report(
        right,
        `The fallback has to be ${checker.typeToString(expected)}, like the value before \`??\`.`,
      );
    }
  };
  // A reported unknown stops here, so each missing fallback is reported once.
  const plain = (expr: Expr): Culprit | undefined => {
    const culprit = visit(expr);
    if (culprit === undefined || nullable(expr)) return culprit;
    undecided(expr, culprit);
    return undefined;
  };
  const decided = (expr: Expr) => {
    const culprit = visit(expr);
    if (culprit !== undefined) undecided(expr, culprit);
  };
  // The interpreter makes the whole text unknown, so an enclosing `??` is
  // needed all the same.
  const shown = (expr: Expr) => {
    const culprit = visit(expr);
    if (culprit === undefined) return;
    tally.undecided += 1;
    if (!quiet) report(expr, textMessage(culprit));
  };
  // An item whose destination, such as a function parameter, accepts a
  // missing value needs no fallback.
  const item = (expr: Expr) => {
    const destination = checker.getContextualType(node(expr));
    if (destination !== undefined && isNullableType(destination)) visit(expr);
    else plain(expr);
  };
  // A rejected value gets no undecided report, whose `?? …` would leave it
  // wrong, but is still unknown at runtime, so an enclosing `??` is needed
  // all the same.
  const rejected = (culprit: Culprit | undefined): undefined => {
    if (culprit !== undefined) tally.undecided += 1;
    return undefined;
  };
  // `tsc` rejects a nullable operand of arithmetic or `<`, target of a read or
  // call without `?.`, key of a read, or argument to a parameter that takes no
  // missing value, itself, which only `?? …` on that operand fixes.
  const checkedOperand = (expr: Expr): Culprit | undefined => {
    const culprit = plain(expr);
    return nullable(expr) ? rejected(culprit) : culprit;
  };
  const {
    covers,
    holds,
    assumingKnown,
    inBranch,
    inLambda,
    held,
    branchesOnly,
  } = guards({ text });
  const holdsRead = (expr: Expr): boolean =>
    holds(expr) || children(expr).some(holdsRead);
  type Fed = { loose: boolean };
  // Parameters fed a narrowed read, as a function's item is when its list
  // holds one and `reduce`'s accumulator is when its start, or with none its
  // list, or its function can give one, each set when that read is loose.
  let fedParams: ReadonlyMap<string, boolean> = new Map();
  const inFunction = <T>({
    lambda,
    fed,
    run,
  }: {
    lambda: { params: string[] };
    fed: (param: number) => Fed | undefined;
    run: () => T;
  }): T => {
    const saved = fedParams;
    fedParams = new Map([
      ...[...saved].filter(([name]) => !lambda.params.includes(name)),
      ...lambda.params.flatMap((name, i) => {
        const each = fed(i);
        return each === undefined ? [] : [[name, each.loose] as const];
      }),
    ]);
    try {
      return inLambda(lambda, run);
    } finally {
      fedParams = saved;
    }
  };
  // `tsc` narrows by an `isUnknown` on the right of `??` as if it ran.
  const unrun = new Set<string>();
  const collectUnrun = (expr: Expr, { right }: { right: boolean }): void => {
    if (right && expr.kind === ExprKind.Call && expr.fn === IS_UNKNOWN) {
      expr.args.forEach((arg) => unrun.add(readKey(arg)));
    }
    const coalesce =
      expr.kind === ExprKind.Binary && expr.op === BinaryOp.Coalesce;
    for (const child of children(expr)) {
      collectUnrun(child, {
        right: right || (coalesce && child === expr.right),
      });
    }
  };
  collectUnrun(tree, { right: false });
  // `tsc` narrows the right of `??` as if the left were false, but it runs
  // when the left is unknown, so a read the left reads can be missing there.
  let leftReads: ReadonlySet<string> = new Set();
  const keysIn = (expr: Expr): string[] => [
    readKey(expr),
    ...children(expr).flatMap(keysIn),
  ];
  const own = (expr: Expr): Culprit | undefined => {
    const key = readKey(expr);
    const declared = declaredNullable(expr, { covered: covers });
    if (
      nullable(expr) ||
      ((unrun.has(key) || leftReads.has(key)) && declared)
    ) {
      return `\`${text(expr)}\``;
    }
    const fed =
      expr.kind === ExprKind.Param ? fedParams.get(expr.name) : undefined;
    if (fed !== undefined || declared) {
      tally.narrowed += 1;
      if (fed !== false) tally.loose += 1;
    }
    return undefined;
  };

  // A held guard still decides the read's unknown, but the read can still be
  // missing where it goes, so it counts as narrowed rather than guarded.
  function visit(expr: Expr): Culprit | undefined {
    if (!covers(expr)) return visitParts(expr);
    const missing = decidedByGuard(
      () => {
        const [reported, narrowed] = [tally.undecided, tally.narrowed];
        const culprit = visitParts(expr);
        return (
          culprit !== undefined ||
          tally.undecided > reported ||
          tally.narrowed > narrowed
        );
      },
      { discards: false },
    );
    if (missing && holds(expr)) tally.narrowed += 1;
    else if (missing) tally.guarded += 1;
    return undefined;
  }

  function visitParts(expr: Expr): Culprit | undefined {
    switch (expr.kind) {
      case ExprKind.Literal:
        return expr.value === null ? "" : undefined;
      case ExprKind.Input:
      case ExprKind.Ref:
      case ExprKind.Param:
        return own(expr);
      case ExprKind.List:
        contained(() => expr.items.forEach(item));
        return undefined;
      case ExprKind.Record:
        contained(() => expr.entries.forEach((entry) => item(entry.value)));
        return undefined;
      case ExprKind.Template:
        expr.parts.forEach(shown);
        return undefined;
      case ExprKind.Unary: {
        const { op, operand } = expr;
        switch (op) {
          case UnaryOp.Not:
            return visit(operand);
          case UnaryOp.Negate:
            return checkedOperand(operand);
          default:
            throw new Error(`unknown unary op: ${op satisfies never}`);
        }
      }
      case ExprKind.Binary:
        return binary(expr);
      case ExprKind.Conditional: {
        decided(expr.test);
        const taken =
          expr.test.kind === ExprKind.Literal ? expr.test.value : undefined;
        // A branch a literal test never takes passes nothing on and needs no
        // fallback.
        const branch = (
          run: () => Culprit | undefined,
          { runs }: { runs: boolean },
        ) => {
          if (runs) return run();
          neverRuns(run);
          return undefined;
        };
        const consequent = branch(
          () =>
            inBranch(readsGuardedBy(expr.test, { negated: true }), () =>
              visit(expr.consequent),
            ),
          { runs: taken !== false },
        );
        return (
          branch(
            () =>
              inBranch(readsGuardedBy(expr.test, { negated: false }), () =>
                visit(expr.alternate),
              ),
            { runs: taken !== true },
          ) ?? consequent
        );
      }
      case ExprKind.Member:
        (expr.optional ? plain : checkedOperand)(expr.target);
        return own(expr);
      case ExprKind.Index:
        (expr.optional ? plain : checkedOperand)(expr.target);
        checkedOperand(expr.index);
        return own(expr);
      case ExprKind.Call:
        if (expr.fn === IS_UNKNOWN) {
          // A guard beside `&&` or `||` doesn't make a fallback inside
          // needless, since the fallback changes what `isUnknown` sees; a
          // ternary test's does, since its branch runs only with the value.
          decidedByGuard(() => branchesOnly(() => expr.args.forEach(visit)), {
            discards: true,
          });
          return undefined;
        }
        // A parameter that accepts a missing value lets the function decide,
        // so nothing inside reaches the call's value or a guard around it.
        received(() => {
          for (const arg of expr.args) {
            const param = checker.getContextualType(node(arg));
            if (param !== undefined && isNullableType(param)) {
              loud(() => isolated(() => held(() => visit(arg))));
            } else checkedOperand(arg);
          }
        });
        return own(expr);
      case ExprKind.Method: {
        const atTarget = counts();
        const fedSince = (from: ReturnType<typeof counts>) =>
          tally.narrowed > from.narrowed
            ? { loose: tally.loose > from.loose }
            : undefined;
        // An argument beside a function, such as `reduce`'s starting value,
        // can carry a guarded read's missing value on to the function.
        const passesOn = expr.args.some((arg) => arg.kind === ExprKind.Lambda);
        // `tsc` rejects a missing value its parameter or return type doesn't
        // take, which a fallback on the call can't fix.
        const taken = (value: Expr, culprit: Culprit | undefined) => {
          const param = checker.getContextualType(node(value));
          const takes = param === undefined || isNullableType(param);
          return nullable(value) && !takes ? rejected(culprit) : culprit;
        };
        const keepsItem =
          keepsUnknownAsItem(expr.method) &&
          checker.isArrayType(checker.getNonNullableType(typeOf(expr.target)));
        const culprits = [
          (expr.optional ? plain : checkedOperand)(expr.target),
        ];
        const items = fedSince(atTarget);
        const atArgs = counts();
        const values = expr.args.filter((arg) => arg.kind !== ExprKind.Lambda);
        for (const arg of values) {
          if (keepsItem) contained(() => item(arg));
          else {
            const culprit = passesOn
              ? isolated(() => held(() => plain(arg)), { keepsNarrowed: true })
              : plain(arg);
            culprits.push(taken(arg, culprit));
          }
        }
        // The index is never missing.
        const fed = (param: number) =>
          param === indexParam(expr.method) ? undefined : items;
        for (const arg of expr.args) {
          if (arg.kind !== ExprKind.Lambda) continue;
          if (isPredicateMethod(expr.method)) {
            inFunction({ lambda: arg, fed, run: () => decided(arg.body) });
          } else if (collectsEachResult(expr.method)) {
            contained(() =>
              inFunction({ lambda: arg, fed, run: () => plain(arg.body) }),
            );
          } else {
            // `reduce`'s accumulator starts as its start or, with none, its
            // first item, then gets the function's result back, so it's fed
            // what the function can give, even a value a guard decides.
            const first = values.length > 0 ? fedSince(atArgs) : items;
            const body = (accumulator: Fed | undefined) =>
              inFunction({
                lambda: arg,
                fed: (param) => (param === 0 ? accumulator : fed(param)),
                run: () => visit(arg.body),
              });
            const back = feedsResultBack(expr.method)
              ? gives(() => held(() => body(first)))
              : undefined;
            const accumulator =
              back === undefined
                ? first
                : { loose: (first?.loose ?? false) || back.loose };
            // Its result is carried on to the accumulator, as an item is.
            const run = () => body(accumulator);
            culprits.push(
              taken(arg.body, feedsResultBack(expr.method) ? held(run) : run()),
            );
          }
        }
        if (missingItemMatters(expr) && hasMissingItem(expr.target)) {
          const itemText = `an item of \`${text(expr.target)}\``;
          // `tsc` rejects `join` on a list with missing items (formula-lib.ts).
          culprits.push(expr.method === "join" ? rejected(itemText) : itemText);
        }
        return own(expr) ?? culprits.find((culprit) => culprit !== undefined);
      }
      case ExprKind.Lambda:
        inLambda(expr, () => plain(expr.body));
        return undefined;
      default:
        throw new Error(`unknown kind: ${expr satisfies never}`);
    }
  }

  function binary(
    expr: Extract<Expr, { kind: ExprKind.Binary }>,
  ): Culprit | undefined {
    const { left, right } = expr;
    const bothPlain = () => {
      const culprit = checkedOperand(left);
      return checkedOperand(right) ?? culprit;
    };
    const logical = (guard: { negated: boolean }) => {
      const saved = counts();
      const culprit = assumingKnown(readsGuardedBy(right, guard), () =>
        visit(left),
      );
      const after = assumingKnown(readsGuardedBy(left, guard), () =>
        visit(right),
      );
      // A `true` beside `||`, or a `false` beside `&&`, decides the result.
      const decisive = [left, right].some(
        (side) =>
          side.kind === ExprKind.Literal && side.value === !guard.negated,
      );
      if (!decisive) return after ?? culprit;
      restore(saved);
      return undefined;
    };
    switch (expr.op) {
      case BinaryOp.And:
        return logical({ negated: true });
      case BinaryOp.Or:
        return logical({ negated: false });
      case BinaryOp.Equal:
      case BinaryOp.NotEqual: {
        const culprit = visit(left);
        return visit(right) ?? culprit;
      }
      case BinaryOp.LessThan:
      case BinaryOp.GreaterThan:
      case BinaryOp.LessOrEqual:
      case BinaryOp.GreaterOrEqual:
        return bothPlain();
      case BinaryOp.Add:
        if (isString(left) || isString(right)) {
          shown(left);
          shown(right);
          return undefined;
        }
        return bothPlain();
      case BinaryOp.Subtract:
      case BinaryOp.Multiply:
      case BinaryOp.Divide:
      case BinaryOp.Modulo:
      case BinaryOp.Exponent:
        return bothPlain();
      case BinaryOp.Coalesce: {
        // A value reported undecided inside an operand, such as a ternary
        // test, still leaves the operand unknown at runtime, as a loose read
        // does. `tsc` narrows the right of `&&` and `||` by the left, which
        // the interpreter evaluates whatever its value, so a fallback after
        // any narrowed read stays allowed.
        const mayBeUnknown = (operand: Expr) => {
          const { undecided: reported, narrowed, loose } = counts();
          const culprit = visit(operand);
          const unknown =
            culprit !== undefined ||
            tally.undecided > reported ||
            tally.loose > loose;
          return {
            culprit,
            unknown,
            needsFallback:
              (unknown || tally.narrowed > narrowed) && !nullable(operand),
          };
        };
        const fallbackPart = <T>(run: () => T): T => {
          const outer = leftReads;
          leftReads = new Set([...outer, ...keysIn(left)]);
          try {
            return run();
          } finally {
            leftReads = outer;
          }
        };
        const saved = counts();
        // A left `tsc` calls nullable can still be proven known, as a literal
        // test's branch is.
        const { unknown: leftUnknown, needsFallback } = mayBeUnknown(left);
        if (needsFallback) fallback(left, right);
        if (!leftUnknown) {
          const guarded = tally.guarded > saved.guarded;
          const narrowedLeft = tally.narrowed > saved.narrowed;
          // After a left `tsc` calls nullable, `tsc` may require the fallback,
          // and the analysis doesn't tell where, so it reports none there.
          if (!needsFallback && !nullable(left)) {
            // `tsc` calls a fallback unreachable only after a left side that
            // can't be missing by its syntax.
            excuse(left, UNREACHABLE_FALLBACK);
            // In `a ?? b ?? c`, `tsc` says so at `b`.
            if (
              left.kind === ExprKind.Binary &&
              left.op === BinaryOp.Coalesce
            ) {
              excuse(left.right, NEVER_NULLISH);
            }
            report(right, guarded ? GUARDED_FALLBACK : NEEDLESS_FALLBACK);
          }
          restore(saved);
          if (!guarded && !narrowedLeft) {
            neverRuns(() => visit(right));
            return undefined;
          }
          // The fallback runs only when a guard decides the left, with its
          // result discarded, unless a held read's list, record or argument
          // carries it on. Discarded, only its calls' arguments need
          // fallbacks, and one that can be missing leaves the guard deciding
          // an enclosing `??`.
          const runRight = () => {
            const before = missingSoFar();
            return visit(right) !== undefined || missingSoFar() > before;
          };
          const missing = holdsRead(left)
            ? isolated(runRight)
            : decidedByGuard(runRight, { discards: true });
          if (missing && guarded) tally.guarded += 1;
          else if (missing && narrowedLeft) tally.narrowed += 1;
          return undefined;
        }
        // The `??` decides the left's unknowns, and the right's go on.
        restore(saved);
        const after = fallbackPart(() => mayBeUnknown(right));
        // An enclosing `??` is the fallback for this right operand.
        if (after.needsFallback) excuse(right, NEVER_NULLISH);
        return after.culprit;
      }
      default:
        throw new Error(`unknown binary op: ${expr.op satisfies never}`);
    }
  }

  return { diagnostics, excused, root: visit(tree) };
}
