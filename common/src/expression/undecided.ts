import ts from "typescript";
import { IS_UNKNOWN, type Diagnostic } from "./catalog";
import {
  collectsEachResult,
  isItemLookup,
  isPredicateMethod,
  keepsUnknownAsItem,
  needsEveryItem,
} from "./evaluate-methods";
import { BinaryOp, ExprKind, UnaryOp, children, type Expr } from "./tree";
import { guards, readKey, readsGuardedBy } from "./undecided-guards";
import {
  isNullableType,
  isYesNoType,
  sourceQueries,
  type Span,
} from "./undecided-source";

/** What a message says a result can be unknown without, as "`count`" or "an item of `marks`"; "" for a literal `null`. */
export type Culprit = string;

/** `tsc` calls the left of `??` never nullish. */
const UNREACHABLE_FALLBACK = 2869;
/** `tsc` calls the right of a `??` inside another `??` never nullish. */
const NEVER_NULLISH = 2881;

/** A `tsc` error at an operand, parentheses skipped, that the analysis needs gone. */
export type Excused = Span & { code: number };

type Analysis = {
  diagnostics: Diagnostic[];
  excused: Excused[];
  /** Set when the whole result can be unknown or undecided. */
  root: Culprit | undefined;
};

export const undecidedMessage = ({
  culprit,
  yesNo,
}: {
  culprit: Culprit;
  yesNo: boolean;
}) => {
  const advice = yesNo
    ? "Add `?? false` or `?? true` to decide it then."
    : "Add `?? …` to choose a value then.";
  if (culprit === "") return `This can be undecided. ${advice}`;
  return `This is undecided when ${culprit} has no value. ${advice}`;
};

const textMessage = (culprit: Culprit) => {
  const advice = 'Add `?? "…"` to choose what they see instead.';
  if (culprit === "") return `Members would see no text here. ${advice}`;
  return `Members without a value for ${culprit} would see no text here. ${advice}`;
};

/**
 * Finds every part of a converted expression that can be unknown or undecided
 * where `tsc`'s types say it can't be, which `tsc` misses because it types
 * `===`, `&&`, `||` and `!` as plain yes/no. Unknown values may flow only into
 * three-valued operators, `===`/`!==`, either side of `??`, a ternary branch,
 * `isUnknown`, a function parameter that accepts a missing value, and the
 * result; a ternary test or list predicate needs a decided yes/no, and a text
 * part needs a value.
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
  // `tsc` rejects `join` on a list with missing items (formula-lib.ts).
  const missingItemMatters = (expr: Extract<Expr, { kind: ExprKind.Method }>) =>
    isItemLookup(expr.method) ||
    (expr.method !== "join" && needsEveryItem(expr.method, expr.args.length));

  let undecidedReports = 0;
  let quiet = false;
  let discarded = false;
  let dead = false;
  const undecided = (expr: Expr, culprit: Culprit) => {
    undecidedReports += 1;
    if (quiet) return;
    report(
      expr,
      undecidedMessage({ culprit, yesNo: isYesNoType(typeOf(expr)) }),
    );
  };
  const isolated = (run: () => void) => {
    const saved = undecidedReports;
    run();
    undecidedReports = saved;
  };
  // An unknown list item, record entry or `map` result leaves the list, record
  // or call known, so a guard on the read holding it doesn't decide it.
  const contained = (run: () => void) => {
    const saved = quiet;
    quiet = discarded || dead;
    isolated(run);
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
  // A guard decides an unknown that reaches the read it guards, and an
  // `isUnknown` argument's value is discarded whole.
  const decidedByGuard = (
    run: () => void,
    { discards }: { discards: boolean },
  ) => {
    const saved = { quiet, discarded };
    quiet = true;
    discarded ||= discards;
    isolated(run);
    ({ quiet, discarded } = saved);
  };
  // Code that never runs reports nothing, down to its calls' arguments.
  const neverRuns = (run: () => void) => {
    const saved = dead;
    dead = true;
    decidedByGuard(run, { discards: true });
    dead = saved;
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
    if (
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
    undecidedReports += 1;
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
    if (culprit !== undefined) undecidedReports += 1;
    return undefined;
  };
  // `tsc` rejects a nullable operand of arithmetic or `<` itself, which only
  // `?? …` on that operand fixes.
  const checkedOperand = (expr: Expr): Culprit | undefined => {
    const culprit = plain(expr);
    return nullable(expr) ? rejected(culprit) : culprit;
  };
  const { covers, assumingKnown, inLambda } = guards({ text });
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
    return nullable(expr) ||
      ((unrun.has(key) || leftReads.has(key)) &&
        declaredNullable(expr, { covered: covers }))
      ? `\`${text(expr)}\``
      : undefined;
  };

  function visit(expr: Expr): Culprit | undefined {
    if (!covers(expr)) return visitParts(expr);
    decidedByGuard(() => visitParts(expr), { discards: false });
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
            assumingKnown(readsGuardedBy(expr.test, { negated: true }), () =>
              visit(expr.consequent),
            ),
          { runs: taken !== false },
        );
        return (
          branch(
            () =>
              assumingKnown(readsGuardedBy(expr.test, { negated: false }), () =>
                visit(expr.alternate),
              ),
            { runs: taken !== true },
          ) ?? consequent
        );
      }
      case ExprKind.Member:
        plain(expr.target);
        return own(expr);
      case ExprKind.Index:
        plain(expr.target);
        plain(expr.index);
        return own(expr);
      case ExprKind.Call:
        if (expr.fn === IS_UNKNOWN) {
          decidedByGuard(() => expr.args.forEach(visit), { discards: true });
          return undefined;
        }
        // A parameter that accepts a missing value lets the function decide,
        // so a guard around the call decides nothing inside it.
        received(() => {
          for (const arg of expr.args) {
            const param = checker.getContextualType(node(arg));
            if (param !== undefined && isNullableType(param)) {
              contained(() => visit(arg));
            } else plain(arg);
          }
        });
        return own(expr);
      case ExprKind.Method: {
        // `tsc` rejects a missing value its parameter or return type doesn't take.
        const taken = (value: Expr, culprit: Culprit | undefined) => {
          const param = checker.getContextualType(node(value));
          const takes = param === undefined || isNullableType(param);
          return nullable(value) && !takes ? rejected(culprit) : culprit;
        };
        const target = plain(expr.target);
        // `tsc` rejects a call on a target that can be missing.
        const culprits = [nullable(expr.target) ? rejected(target) : target];
        const keepsItem =
          keepsUnknownAsItem(expr.method) &&
          checker.isArrayType(checker.getNonNullableType(typeOf(expr.target)));
        for (const arg of expr.args) {
          if (keepsItem) {
            contained(() => item(arg));
          } else if (arg.kind !== ExprKind.Lambda) {
            culprits.push(taken(arg, plain(arg)));
          } else if (isPredicateMethod(expr.method)) {
            inLambda(arg, () => decided(arg.body));
          } else if (collectsEachResult(expr.method)) {
            contained(() => inLambda(arg, () => plain(arg.body)));
          } else {
            const body = inLambda(arg, () => visit(arg.body));
            culprits.push(taken(arg.body, body));
          }
        }
        if (missingItemMatters(expr) && hasMissingItem(expr.target)) {
          culprits.push(`an item of \`${text(expr.target)}\``);
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
      return decisive ? undefined : (after ?? culprit);
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
        // test, still leaves the operand unknown at runtime.
        const mayBeUnknown = (operand: Expr) => {
          const reported = undecidedReports;
          const culprit = visit(operand);
          return {
            culprit,
            needsFallback:
              (culprit !== undefined || undecidedReports > reported) &&
              !nullable(operand),
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
        const reported = undecidedReports;
        const { needsFallback } = mayBeUnknown(left);
        if (needsFallback) fallback(left, right);
        // The `??` decides the left's unknowns, and the right's go on only
        // when it runs.
        undecidedReports = reported;
        const after = fallbackPart(() => mayBeUnknown(right));
        const runs = needsFallback || nullable(left);
        // An enclosing `??` is the fallback for this right operand.
        if (after.needsFallback && runs) excuse(right, NEVER_NULLISH);
        if (runs) return after.culprit;
        undecidedReports = reported;
        return undefined;
      }
      default:
        throw new Error(`unknown binary op: ${expr.op satisfies never}`);
    }
  }

  return { diagnostics, excused, root: visit(tree) };
}
