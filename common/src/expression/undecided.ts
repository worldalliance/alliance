/* alliance/max-lines 950 -- one recursive walk whose tallies, guard state, carried reads and reports every branch shares; codex's splits (flow helpers, operators, calls) each leave a propagation fix reading across them, behind interfaces into that state */
import ts from "typescript";
import { IS_MISSING, IS_MISSING_HINT, type Diagnostic } from "./catalog";
import {
  COMPARES_PRIMITIVES_ONLY,
  SHOWS_PRIMITIVES_ONLY,
  SORTS_PRIMITIVES_ONLY,
  collectsEachResult,
  feedsResultBack,
  indexParam,
  isItemLookup,
  isPredicateMethod,
  keepsUnknownAsItem,
  needsEveryItem,
} from "./evaluate-methods";
import { NEEDS_A_NUMBER, comparesMessage } from "./evaluate-operators";
import { BinaryOp, ExprKind, UnaryOp, children, type Expr } from "./tree";
import { guards, readKey, readsGuardedBy } from "./undecided-guards";
import {
  ALWAYS_FALSY,
  ALWAYS_TRUTHY,
  ARGUMENT_TYPE,
  BY_REFERENCE,
  GUARDED_FALLBACK,
  NEEDLESS_FALLBACK,
  NEEDS_YES_NO,
  NEVER_NULLISH,
  NO_OVERLAP,
  NULL_OPERAND,
  OPERATOR_TYPES,
  POSSIBLY_MISSING,
  UNREACHABLE_FALLBACK,
  textMessage,
  undecidedMessage,
  unstoppedMessage,
  type Culprit,
} from "./undecided-messages";
import {
  COMPARABLE,
  NUMBERS,
  ORDERABLE,
  TEXT,
  everyPart,
  isNullableType,
  isYesNoType,
  rejectsMissingInside,
  sourceQueries,
  type Span,
} from "./undecided-source";

/**
 * A `tsc` error, at the span `tsc` gives it, that the analysis needs gone or
 * reports better itself.
 */
export type Excused = Span & { code: number };

type Unstopped = { read: Expr; contained: boolean };

type Analysis = {
  diagnostics: Diagnostic[];
  excused: Excused[];
  /** Set when the whole result can be unknown or undecided. */
  root: Culprit | undefined;
  /**
   * Set when the result is an `&&` or `||` reported at its operands, or a
   * ternary or `??` with one on a side whose other side is one too or yes/no.
   */
  rootRejected: boolean;
};

/**
 * Finds every part of a converted expression that can be unknown or undecided
 * where `tsc`'s types say it can't be, which `tsc` misses because it types
 * `===`, `&&`, `||` and `!` as plain yes/no. Unknown values may flow only into
 * three-valued operators, `===`/`!==`, either side of `??`, a ternary branch,
 * `isMissing`, a function parameter that accepts a missing value, and the
 * result; a ternary test or list predicate needs a decided yes/no, and a text
 * part needs a value. It also reports operands the interpreter rejects: a
 * value that isn't yes/no where yes/no is needed, a list or record compared,
 * shown in text, sought or sorted without a function, `<`, `>`, `<=` or `>=`
 * on anything but two numbers or two pieces of text, and `-` on anything but
 * a number. It points a comparison or lookup with `null` at `isMissing`. It
 * excuses `tsc`'s TS2869 and TS2881 on a `??` whose left side can't be
 * missing, and reports that `??` itself when `reportNeedlessFallbacks` is set.
 */
export function analyze({
  tree,
  source,
  checker,
  file,
  offset,
  reportNeedlessFallbacks,
}: {
  tree: Expr;
  source: ReadonlyMap<Expr, ts.Expression>;
  checker: ts.TypeChecker;
  file: ts.SourceFile;
  /** Where the expression's text starts in `file`. */
  offset: number;
  reportNeedlessFallbacks: boolean;
}): Analysis {
  const diagnostics: Diagnostic[] = [];
  const excused: Excused[] = [];

  const {
    node,
    span,
    operandSpan,
    text,
    typeOf,
    every,
    nullable,
    declaredNullable,
    itemType,
    hasMissingItem,
    isString,
    isYesNo,
    reportedInside,
    restatedMismatches,
  } = sourceQueries({ source, checker, file, offset });
  const report = (expr: Expr, message: string) =>
    diagnostics.push({ message, ...span(expr) });
  const missingItemMatters = (expr: Extract<Expr, { kind: ExprKind.Method }>) =>
    isItemLookup(expr.method) || needsEveryItem(expr.method, expr.args.length);

  const yesNo = (expr: Expr) => {
    const ok = isYesNo(expr);
    if (!ok && !reportedInside(expr)) {
      report(expr, NEEDS_YES_NO);
      excused.push({ code: ALWAYS_TRUTHY, ...span(expr) });
      excused.push({ code: ALWAYS_FALSY, ...span(expr) });
    }
    return ok;
  };
  // Undecided reports, and reads that can be missing: `guarded` ones a guard
  // covered, which `tsc` may have narrowed, `narrowed` ones `tsc` narrowed by
  // anything but a guard, and `loose` ones, the narrowed reads that can leave
  // the value around them unknown, which those a held guard decides can't.
  // `unstopped` holds the reads whose missing value only a check beside `&&`
  // or `||` stops, though both sides run, each `contained` when a list, record
  // or function's value carries it.
  const noneUnstopped: readonly Unstopped[] = [];
  const tally = {
    undecided: 0,
    guarded: 0,
    narrowed: 0,
    loose: 0,
    unstopped: noneUnstopped,
  };
  const counts = () => ({ ...tally });
  const appendUnstopped = (entries: readonly Unstopped[]) => {
    tally.unstopped = [...tally.unstopped, ...entries];
  };
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
  // Undecided reports and guarded, narrowed, loose and unstopped reads inside
  // don't reach the value around it, except with `keepsNarrowed`, where
  // narrowed, loose and unstopped reads do, and any undecided report adds one
  // narrowed, loose read.
  const isolated = <T>(
    run: () => T,
    { keepsNarrowed = false }: { keepsNarrowed?: boolean } = {},
  ): T => {
    const saved = counts();
    const result = run();
    const undecidedItem = tally.undecided > saved.undecided ? 1 : 0;
    const kept = [tally.narrowed + undecidedItem, tally.loose + undecidedItem];
    const { unstopped } = tally;
    restore(saved);
    if (keepsNarrowed) {
      [tally.narrowed, tally.loose] = kept;
      tally.unstopped = unstopped;
    }
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
  // `isMissing` argument's value is discarded whole.
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
      const unstopped = tally.unstopped.slice(was.unstopped.length);
      if (loose || tally.narrowed > was.narrowed || unstopped.length > 0) {
        fed = { loose, unstopped: unstopped.map(({ read }) => read) };
      }
    });
    diagnostics.length = reports;
    excused.length = excuses;
    return fed;
  };
  const excuse = (expr: Expr, code: number) => {
    excused.push({ code, ...operandSpan(expr) });
  };
  const missingExcused = (expr: Expr) => {
    for (const code of POSSIBLY_MISSING) excused.push({ code, ...span(expr) });
  };
  // `tsc` leaves the right of `??` out of the result's type when it thinks the
  // left is never missing, so whether a required fallback fits is checked here.
  const fallback = (left: Expr, right: Expr) => {
    excuse(left, UNREACHABLE_FALLBACK);
    const expected = checker.getBaseTypeOfLiteralType(typeOf(left));
    // A fallback that can be missing passes its unknown on through the `??`.
    // A left narrowed to `never` is a contradiction `tsc` already reports, and
    // fixing a fallback's operands reported as not yes/no fixes its fit.
    if (
      (expected.flags & ts.TypeFlags.Never) === 0 &&
      !(isYesNoType(expected) && reportedInside(right)) &&
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
  // A rejected value gets no undecided report, whose `?? …` would leave it
  // wrong; one that can be unknown still leaves an enclosing `??` reachable.
  const rejected = (culprit: Culprit | undefined): undefined => {
    if (culprit !== undefined) tally.undecided += 1;
    return undefined;
  };
  const yesNoOperand = (expr: Expr, culprit: Culprit | undefined) =>
    reportedInside(expr) || isYesNo(expr) ? culprit : rejected(culprit);
  const decided = (expr: Expr) => {
    const yes = yesNo(expr);
    const culprit = visit(expr);
    if (culprit === undefined) return;
    if (yes) undecided(expr, culprit);
    else rejected(culprit);
  };
  // The interpreter makes the whole text unknown, so an enclosing `??` is
  // needed all the same. It rejects a list or record there, which `tsc` takes.
  const shown = (expr: Expr) => {
    if (!every(expr, COMPARABLE)) {
      report(expr, SHOWS_PRIMITIVES_ONLY);
      return rejected(visit(expr));
    }
    const culprit = visit(expr);
    if (culprit === undefined) return;
    tally.undecided += 1;
    if (!quiet) report(expr, textMessage(culprit));
  };
  // `tsc` already reports a value its destination doesn't take, so its error
  // stands alone.
  const fits = (expr: Expr, destination: ts.Type | undefined) =>
    destination === undefined ||
    checker.isTypeAssignableTo(typeOf(expr), destination);
  // An item whose destination, such as a function parameter, accepts a
  // missing value needs no fallback, though items inside it may still reject
  // one.
  const item = (expr: Expr) => {
    const destination = checker.getContextualType(node(expr));
    if (destination === undefined || !isNullableType(destination)) {
      if (fits(expr, destination)) plain(expr);
      else within(expr, () => plain(expr));
      return;
    }
    const { inside } = within(expr, () => visit(expr));
    appendUnstopped(inside);
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
    decidedInBranch,
    assumingKnown,
    inBranch,
    inLambda,
    held: holdGuards,
    branchesOnly,
  } = guards({ text });
  const holdsRead = (expr: Expr): boolean =>
    holds(expr) || children(expr).some(holdsRead);
  // Set inside a list item, record entry, `map` result, `reduce` function or
  // argument beside a method's function, up to the nearest value `within`
  // splits: a read here is carried inside that value rather than reaching it
  // whole.
  let carried = false;
  const held = <T>(run: () => T): T => {
    const saved = carried;
    carried = true;
    try {
      return holdGuards(run);
    } finally {
      carried = saved;
    }
  };
  const addUnstopped = (reads: readonly Expr[]) => {
    appendUnstopped(reads.map((read) => ({ read, contained: carried })));
  };
  // Splits the reads `run` adds into those a list, record or function's value
  // inside `value` carries and those that reach `value` whole, as all do when
  // it holds no items.
  const within = <T>(value: Expr, run: () => T) => {
    const { unstopped: before } = tally;
    const outer = carried;
    carried = false;
    const result = run();
    carried = outer;
    const added = tally.unstopped.slice(before.length);
    tally.unstopped = before;
    const holdsItems = !everyPart(typeOf(value), COMPARABLE);
    const inside = added.filter(({ contained }) => contained && holdsItems);
    const whole = added.filter((each) => !inside.includes(each));
    return { result, inside, whole };
  };
  // A function fails on a missing value inside a list or record, which a check
  // beside `&&` or `||` doesn't stop, since both sides run. One given whole
  // only makes the call unknown, carried on as the argument would be, unless
  // the parameter accepts a missing value: then the function decides, so
  // nothing inside reaches the call's value or a guard around it.
  const argument = (arg: Expr) => {
    const param = checker.getContextualType(node(arg));
    const takesMissing = param !== undefined && isNullableType(param);
    const passed = () => {
      const { inside, whole } = within(arg, () =>
        takesMissing ? visit(arg) : checkedOperand(arg),
      );
      const rejects =
        fits(arg, param) &&
        (param === undefined || rejectsMissingInside(checker, param));
      if (!dead && rejects) {
        for (const read of new Set(inside.map((each) => text(each.read)))) {
          report(arg, unstoppedMessage(read));
        }
      }
      return whole;
    };
    if (takesMissing) {
      loud(() => isolated(() => held(passed)));
      return;
    }
    const added = passed().map((each) => ({ ...each, contained: carried }));
    appendUnstopped(added);
  };
  type Fed = { loose: boolean; unstopped: readonly Expr[] };
  // Parameters fed a narrowed read, as a function's item is when its list
  // holds one and `reduce`'s accumulator is when its start, or with none its
  // list, or its function can give one.
  let fedParams: ReadonlyMap<string, Fed> = new Map();
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
        return each === undefined ? [] : [[name, each] as const];
      }),
    ]);
    try {
      return inLambda(lambda, run);
    } finally {
      fedParams = saved;
    }
  };
  // `tsc` narrows by an `isMissing` on the right of `??` as if it ran.
  const unrun = new Set<string>();
  const collectUnrun = (expr: Expr, { right }: { right: boolean }): void => {
    if (right && expr.kind === ExprKind.Call && expr.fn === IS_MISSING) {
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
  // `tsc` narrows the right of `&&` and `||` by the left, though both run.
  let logicalReads: ReadonlySet<string> = new Set();
  const reading = <T>(
    reads: { left?: Expr; logical?: Expr },
    run: () => T,
  ): T => {
    const saved = [leftReads, logicalReads];
    const add = (set: ReadonlySet<string>, side: Expr | undefined) =>
      side === undefined ? set : new Set([...set, ...keysIn(side)]);
    leftReads = add(leftReads, reads.left);
    logicalReads = add(logicalReads, reads.logical);
    try {
      return run();
    } finally {
      [leftReads, logicalReads] = saved;
    }
  };
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
      if (fed?.loose ?? true) tally.loose += 1;
      if (fed !== undefined) {
        // A parameter that holds items carries what its list's items held,
        // except a read a ternary test around it decides.
        const contained = carried || !everyPart(typeOf(expr), COMPARABLE);
        const added = fed.unstopped
          .filter((read) => !decidedInBranch(read))
          .map((read) => ({ read, contained }));
        appendUnstopped(added);
      } else if (logicalReads.has(key)) addUnstopped([expr]);
    }
    return undefined;
  };
  // A comparison with a `null` side is always unknown: the hint there replaces
  // any undecided report on it, and an enclosing `??` stays reachable.
  const compared = (sides: readonly Expr[]) => {
    let hinted = false;
    for (const side of sides) {
      if (side.kind === ExprKind.Literal && side.value === null) {
        report(side, IS_MISSING_HINT);
        excuse(side, NULL_OPERAND);
        hinted = true;
      }
    }
    if (hinted) tally.undecided += 1;
    return hinted;
  };

  // A held guard still decides the read's unknown, but the read can still be
  // missing where it goes, so it counts as narrowed rather than guarded. A
  // guard decides only whether the value is missing, not what its items carry.
  function visit(expr: Expr): Culprit | undefined {
    if (!covers(expr)) return visitParts(expr);
    let carriedInside = noneUnstopped;
    const missing = decidedByGuard(
      () => {
        const was = tally.undecided + tally.narrowed;
        const { result, inside } = within(expr, () => visitParts(expr));
        carriedInside = inside;
        return result !== undefined || tally.undecided + tally.narrowed > was;
      },
      { discards: false },
    );
    appendUnstopped(carriedInside);
    if (missing && holds(expr)) {
      tally.narrowed += 1;
      addUnstopped([expr]);
    } else if (missing) tally.guarded += 1;
    return undefined;
  }

  function visitParts(expr: Expr): Culprit | undefined {
    switch (expr.kind) {
      case ExprKind.Literal:
        return expr.value === null ? "" : undefined;
      case ExprKind.OnList:
        return undefined;
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
            yesNo(operand);
            return yesNoOperand(operand, visit(operand));
          case UnaryOp.Negate:
            if (every(operand, NUMBERS)) return checkedOperand(operand);
            report(operand, NEEDS_A_NUMBER);
            missingExcused(operand);
            return rejected(visit(operand));
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
      case ExprKind.Index: {
        // A plain value read out of a list or record reaches the read whole.
        const { inside, whole } = within(expr, () => {
          (expr.optional ? plain : checkedOperand)(expr.target);
          if (expr.kind === ExprKind.Index) checkedOperand(expr.index);
        });
        appendUnstopped([
          ...inside,
          ...whole.map((each) => ({ ...each, contained: carried })),
        ]);
        return own(expr);
      }
      case ExprKind.Call:
        if (expr.fn === IS_MISSING) {
          // A guard beside `&&` or `||` doesn't make a fallback inside
          // needless, since the fallback changes what `isMissing` sees; a
          // ternary test's does, since its branch runs only with the value.
          decidedByGuard(() => branchesOnly(() => expr.args.forEach(visit)), {
            discards: true,
          });
          return undefined;
        }
        received(() => expr.args.forEach(argument));
        return own(expr);
      case ExprKind.Method: {
        const atTarget = counts();
        const { unstopped: before } = atTarget;
        const fedSince = (from: ReturnType<typeof counts>) => {
          const reads = tally.unstopped
            .slice(from.unstopped.length)
            .filter(({ contained }) => contained)
            .map(({ read }) => read);
          return tally.narrowed > from.narrowed || reads.length > 0
            ? { loose: tally.loose > from.loose, unstopped: reads }
            : undefined;
        };
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
        // `map`'s result holds only what its function gives, and a result
        // that needs every item is missing whole where one is.
        const reached = tally.unstopped.slice(before.length);
        if (collectsEachResult(expr.method)) tally.unstopped = before;
        else if (needsEveryItem(expr.method, expr.args.length)) {
          tally.unstopped = before;
          addUnstopped(reached.map(({ read }) => read));
        }
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
                : {
                    loose: (first?.loose ?? false) || back.loose,
                    unstopped: [...(first?.unstopped ?? []), ...back.unstopped],
                  };
            // Its result is carried on to the accumulator, as an item is.
            const run = () => body(accumulator);
            culprits.push(
              taken(arg.body, feedsResultBack(expr.method) ? held(run) : run()),
            );
          }
        }
        const [sought] = expr.args;
        let hinted = false;
        let incomparable = false;
        if (isItemLookup(expr.method) && sought !== undefined) {
          hinted = compared([sought]);
          // On text, `tsc` says what the argument has to be.
          const comparable =
            everyPart(
              checker.getNonNullableType(typeOf(expr.target)),
              ts.TypeFlags.StringLike,
            ) ||
            sought.kind === ExprKind.Lambda ||
            every(sought, COMPARABLE);
          if (!comparable) report(sought, COMPARES_PRIMITIVES_ONLY);
          incomparable = !comparable;
          // `tsc` reports the same value as an argument its parameter rejects.
          if (hinted || !comparable) excuse(sought, ARGUMENT_TYPE);
        }
        if (expr.method === "sort" && expr.args.length === 0) {
          const type = itemType(expr.target);
          const sortable = type === undefined || everyPart(type, COMPARABLE);
          if (!sortable) report(expr.target, SORTS_PRIMITIVES_ONLY);
          incomparable ||= !sortable;
        }
        if (missingItemMatters(expr) && hasMissingItem(expr.target)) {
          const itemText = `an item of \`${text(expr.target)}\``;
          // `tsc` rejects `join` on a list with missing items (formula-lib.ts).
          culprits.push(expr.method === "join" ? rejected(itemText) : itemText);
        }
        if (hinted) return undefined;
        const culprit =
          own(expr) ?? culprits.find((each) => each !== undefined);
        return incomparable ? rejected(culprit) : culprit;
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
    // A fallback can't fix an operand of the wrong type.
    const comparison = (
      wrong: readonly Expr[],
      valid: (side: Expr) => Culprit | undefined,
    ) => {
      const side = (operand: Expr) =>
        (wrong.includes(operand) ? visit : valid)(operand);
      const culprit = side(left);
      const after = side(right) ?? culprit;
      return wrong.length > 0 ? rejected(after) : after;
    };
    const logical = (guard: { negated: boolean }) => {
      yesNo(left);
      yesNo(right);
      const saved = counts();
      const culprit = assumingKnown(readsGuardedBy(right, guard), () =>
        visit(left),
      );
      const after = assumingKnown(readsGuardedBy(left, guard), () =>
        reading({ logical: left }, () => visit(right)),
      );
      // A `true` beside `||`, or a `false` beside `&&`, decides the result.
      const decisive = [left, right].some(
        (side) =>
          side.kind === ExprKind.Literal && side.value === !guard.negated,
      );
      if (!decisive) {
        const result = after ?? culprit;
        return isYesNo(expr) ? result : rejected(result);
      }
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
        const incomparable = [left, right].filter(
          (side) => !every(side, COMPARABLE),
        );
        for (const side of incomparable) report(side, COMPARES_PRIMITIVES_ONLY);
        if (incomparable.length > 0) {
          excuse(expr, NO_OVERLAP);
          excuse(expr, BY_REFERENCE);
        }
        const hinted = compared([left, right]);
        const result = comparison(incomparable, visit);
        return hinted ? undefined : result;
      }
      case BinaryOp.LessThan:
      case BinaryOp.GreaterThan:
      case BinaryOp.LessOrEqual:
      case BinaryOp.GreaterOrEqual: {
        const hinted = compared([left, right]);
        const unordered = [left, right].filter(
          (side) => !every(side, ORDERABLE),
        );
        for (const side of unordered) report(side, comparesMessage(expr.op));
        // A side that can be a number or text, as `x ? 1 : "a"` can, passes
        // `tsc`, and so does a number beside text where `tsc` narrowed one
        // to missing, while the interpreter compares only two of a kind.
        const mixed =
          unordered.length === 0 &&
          ![NUMBERS, TEXT].some((kind) =>
            [left, right].every((side) => every(side, kind)),
          );
        if (mixed) report(expr, comparesMessage(expr.op));
        const wrong = mixed ? [left, right] : unordered;
        for (const side of wrong) missingExcused(side);
        if (wrong.length > 0) excuse(expr, OPERATOR_TYPES);
        if (hinted) for (const side of [left, right]) missingExcused(side);
        const result = comparison(wrong, hinted ? visit : checkedOperand);
        return hinted ? undefined : result;
      }
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
        const saved = counts();
        // A left `tsc` calls nullable can still be proven known, as a literal
        // test's branch is. The `??` stops a read reaching the left whole.
        const {
          result: { unknown: leftUnknown, needsFallback },
          inside: leftInside,
        } = within(left, () => mayBeUnknown(left));
        saved.unstopped = [...saved.unstopped, ...leftInside];
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
            if (reportNeedlessFallbacks) {
              report(right, guarded ? GUARDED_FALLBACK : NEEDLESS_FALLBACK);
            }
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
          // an enclosing `??`. Beside `&&` or `||` its value is used.
          let unstopped = tally.unstopped;
          const runRight = () => {
            const before = missingSoFar();
            const found = visit(right) !== undefined || missingSoFar() > before;
            unstopped = tally.unstopped;
            return found;
          };
          const missing = holdsRead(left)
            ? isolated(runRight)
            : decidedByGuard(runRight, { discards: true });
          tally.unstopped = unstopped;
          if (missing && guarded) tally.guarded += 1;
          else if (missing && narrowedLeft) tally.narrowed += 1;
          return undefined;
        }
        // The `??` decides the left's unknowns, and the right's go on.
        restore(saved);
        const after = reading({ left }, () => mayBeUnknown(right));
        // An enclosing `??` is the fallback for this right operand.
        if (after.needsFallback) excuse(right, NEVER_NULLISH);
        return after.culprit;
      }
      default:
        throw new Error(`unknown binary op: ${expr.op satisfies never}`);
    }
  }

  const root = visit(tree);
  excused.push(...restatedMismatches(tree));
  return {
    diagnostics,
    excused,
    root,
    rootRejected: reportedInside(tree) && !isYesNo(tree),
  };
}
