import ts from "typescript";
import { compilerMessage } from "../forms/formula-messages";
import { unionParts } from "../forms/formula-renderable";
import { R, type Result } from "../result";
import {
  TypeKind,
  type Diagnostic,
  type NamedExpression,
  type Scope,
  type ValueType,
} from "./catalog";
import {
  INTERNAL_PREFIX,
  KNOWN_WRAPPER,
  NAMED_WRAPPER,
  UNDECIDED_WRAPPER,
  World,
  typeScriptType,
  withoutListBrand,
} from "./check-world";
import { convertExpression } from "./convert";
import { checkScope, nameRuleBreak, scopeNames } from "./convert-scope";
import { dependencyOrder, reads } from "./dependencies";
import { parseExpression } from "./parse";
import { printExpression, type PrintNames } from "./print";
import { ExprKind, children, type Expr } from "./tree";
import { analyze, type Excused } from "./undecided";
import {
  NOT_ASSIGNABLE,
  undecidedMessage,
  type Culprit,
} from "./undecided-messages";
import { isNullableType, isYesNoType } from "./undecided-source";

export enum Undecided {
  /** The consumer handles an unknown result itself, as a split group's fallback does. */
  Allowed = "allowed",
  /** An unknown result needs an inline `??`, as visibility and required-if do. */
  NeedsFallback = "needsFallback",
}

const NEEDS_FALLBACK: Record<Undecided, boolean> = {
  [Undecided.Allowed]: false,
  [Undecided.NeedsFallback]: true,
};

export type ResultRule = {
  /**
   * The result, when it has a value, must fit this type; unset accepts any
   * type. Whether it may lack one is `undecided`'s, so the type isn't nullable.
   */
  type?: Exclude<ValueType, { kind: TypeKind.Nullable }>;
  undecided: Undecided;
};

const METHOD_VALUE = "A method can't be used as a value. Call it with `(…)`.";

export type CheckedExpression = {
  tree: Expr;
  /** The text checked: the admin's own, or the tree printed. */
  text: string;
  /**
   * `tsc`'s type of the result as TypeScript text, for display, widened as a
   * named expression's is when the rule asks for no type. It names
   * `undefined` where a lookup can miss, which the language writes as `null`,
   * and can leave out an unknown `mayBeUnknown` reports; it names no missing
   * value where `mayBeUnknown` is false.
   */
  type: string;
  /** Whether the result can be unknown or undecided. */
  mayBeUnknown: boolean;
};

const RESULT = `${INTERNAL_PREFIX}result`;
// `initializer` finds the expression by this layout.
const CLOSE = "\n);";
const YES_NO: Record<TypeKind, boolean> = {
  [TypeKind.String]: false,
  [TypeKind.Number]: false,
  [TypeKind.Boolean]: true,
  [TypeKind.Choice]: false,
  [TypeKind.List]: false,
  [TypeKind.Record]: false,
  [TypeKind.Nullable]: false,
};

type Placed = {
  file: string;
  offset: number;
  text: string;
  named?: NamedExpression;
  excused: Excused[];
};

/**
 * The names `checkExpression` prints a tree with, so a caller showing that
 * tree's diagnostics prints the text they are located in.
 */
export function printNames({
  scope,
  deletedNames,
}: {
  scope: Scope;
  deletedNames?: ReadonlyMap<string, string>;
}): PrintNames {
  // A deleted named expression prints only in text the check rejects, which
  // nothing reads back; a name the name rule rejects here would read as
  // something else.
  const held = scopeNames(scope).map(({ name }) => name);
  const deletedName = (id: string, params: ReadonlySet<string>) => {
    const name = deletedNames?.get(id);
    return name !== undefined &&
      nameRuleBreak(name, new Set([...held, ...params])) === undefined
      ? name
      : undefined;
  };
  return {
    refName: (id, params) =>
      scope.named.find((named) => named.id === id)?.name ??
      deletedName(id, params) ??
      id,
  };
}

/**
 * The save check: `tsc` over declarations generated from the catalog, with the
 * expression's named expressions declared before it, plus the analysis that
 * requires a fallback wherever a result can be undecided. A named expression
 * whose result can be undecided is declared as possibly `null`, so `tsc`
 * narrows a guarded reference to it.
 */
export function checkExpression({
  source,
  scope,
  rule,
  stored,
  deletedNames,
}: {
  source: string | Expr;
  scope: Scope;
  rule: ResultRule;
  /**
   * Expressions already stored, which a change elsewhere can leave with a
   * needless fallback that shouldn't block re-checking them: the root when
   * `root`, and the named expressions whose ids are in `named`.
   */
  stored?: { root: boolean; named: ReadonlySet<string> };
  /**
   * Old names of deleted named expressions, by id, so a reference to one reads
   * by its name wherever that name wouldn't read as something else.
   */
  deletedNames?: ReadonlyMap<string, string>;
}): Result<CheckedExpression, Diagnostic[]> {
  checkScope(scope);
  const nameOf = (id: string) =>
    scope.named.find((named) => named.id === id)?.name;
  const names = printNames({ scope, deletedNames });
  const parsed =
    typeof source === "string"
      ? parseExpression(source, scope)
      : R.success(source);
  if (!parsed.ok) return parsed;
  const root = parsed.value;
  const text =
    typeof source === "string" ? source : printExpression(source, names);
  const whole = (message: string) =>
    R.failure([{ message, start: 0, end: text.length }]);

  const order = dependencyOrder([root], scope.named);
  if (!order.ok) {
    return whole(
      `These named expressions refer to each other in a loop: ${order.error.join(" → ")}.`,
    );
  }
  // Printed, a removed input would read whatever now has its name.
  const inputIds = new Set(scope.catalog.inputs.map((input) => input.id));
  const untypable = (tree: Expr, printed: string): Diagnostic | undefined => {
    const direct = reads(tree, []);
    const gone = [...direct.named].some((id) => nameOf(id) === undefined)
      ? "a named expression"
      : [...direct.inputs].some((id) => !inputIds.has(id))
        ? "an input"
        : undefined;
    const message =
      gone === undefined
        ? scopeProblem(tree, nameOf)
        : `This uses ${gone} that no longer exists.`;
    return message === undefined
      ? undefined
      : { message, start: 0, end: printed.length };
  };

  const world = new World(scope.catalog);
  const diagnostics: Diagnostic[] = [];
  // `tsc` repeats some of what the converter rejects, at the same span.
  const converterDiagnostics: Diagnostic[] = [];

  const place = (
    entry: Omit<Placed, "offset" | "excused">,
    { prefix, suffix = CLOSE }: { prefix: string; suffix?: string },
  ): Placed => {
    world.write(entry.file, `${prefix}${entry.text}${suffix}`);
    return { ...entry, offset: prefix.length, excused: [] };
  };

  const analyzePlaced = (at: Placed) => {
    const program = world.program();
    const file = program.getSourceFile(at.file);
    const expression = file && initializer(file);
    if (file === undefined || expression === undefined) {
      throw new Error(
        at.named === undefined
          ? `The save check lost ${at.file}.`
          : `The save check couldn't read back \`${at.named.name}\`; a named expression's name has to be a free identifier.`,
      );
    }
    const converted = convertExpression({ node: expression, file, scope });
    if (!converted.ok) {
      const rejected = converted.error.map((d) => relative(d, at));
      diagnostics.push(...rejected);
      converterDiagnostics.push(...rejected);
      return undefined;
    }
    // The interpreter calls a method but can't read one as a value.
    const checker = program.getTypeChecker();
    for (const [expr, node] of converted.value.source) {
      const read =
        expr.kind === ExprKind.Member || expr.kind === ExprKind.Index;
      const parts = read ? unionParts(checker.getTypeAtLocation(node)) : [];
      if (parts.some((part) => part.getCallSignatures().length > 0)) {
        const span = { start: node.getStart(file), end: node.getEnd() };
        diagnostics.push(relative({ message: METHOD_VALUE, ...span }, at));
      }
    }
    const analysis = analyze({
      ...converted.value,
      checker,
      file,
      offset: at.offset,
      reportNeedlessFallbacks: !(at.named === undefined
        ? stored?.root
        : stored?.named.has(at.named.id)),
    });
    at.excused = analysis.excused;
    diagnostics.push(
      ...analysis.diagnostics.map((d) => ({
        ...d,
        namedExpression: at.named?.name,
      })),
    );
    return { ...converted.value, analysis, expression, program };
  };

  const report = (at: Placed, { rootRejected = false } = {}) => {
    const checker = world.program().getTypeChecker();
    for (const diagnostic of world.diagnostics(at.file)) {
      const start = (diagnostic.start ?? 0) - at.offset;
      const end = start + (diagnostic.length ?? 0);
      const excused = at.excused.find(
        (span) =>
          span.code === diagnostic.code &&
          span.start === start &&
          span.end === end,
      );
      if (excused !== undefined) continue;
      // A root `&&` or `||` that isn't yes/no where yes/no is asked for is
      // reported at its operands. Inside a ternary branch or before a fallback
      // that isn't yes/no, another branch can cause the mismatch.
      const resultMismatch = start < 0 && diagnostic.code === NOT_ASSIGNABLE;
      const yesNoAsked = rule.type !== undefined && YES_NO[rule.type.kind];
      if (resultMismatch && yesNoAsked && rootRejected) continue;
      const located =
        start < 0 ? { start: 0, end: at.text.length } : { start, end };
      const reported = converterDiagnostics.some(
        (other) =>
          other.namedExpression === at.named?.name &&
          other.start === located.start &&
          other.end === located.end,
      );
      if (reported) continue;
      const message = compilerMessage(withoutListBrand(diagnostic), checker);
      diagnostics.push({
        message,
        ...located,
        namedExpression: at.named?.name,
      });
    }
  };

  const typeNamed = (index: number, named: NamedExpression) => {
    const text = printExpression(named.tree, names);
    const problem = untypable(named.tree, text);
    if (problem !== undefined) {
      diagnostics.push({ ...problem, namedExpression: named.name });
      return;
    }
    const at = place(
      { file: `/named-${index}.ts`, text, named },
      { prefix: `const ${named.name} = ${NAMED_WRAPPER}(\n` },
    );
    const result = analyzePlaced(at);
    // The wrappers differ only in the declared type, so the rewrite changes no
    // diagnostic and reporting first spares a program build.
    report(at);
    if (result !== undefined) {
      const unknown = result.analysis.root !== undefined;
      const type = result.program
        .getTypeChecker()
        .getTypeAtLocation(result.expression);
      if (isNullableType(type) !== unknown) {
        const wrapper = unknown ? UNDECIDED_WRAPPER : KNOWN_WRAPPER;
        world.write(
          at.file,
          `const ${named.name} = ${wrapper}(\n${at.text}${CLOSE}`,
        );
      }
    }
  };

  // What a named expression's problem does to its readers, named or not,
  // changes once it is fixed, so a reader waits until what it reads passes.
  const broken = new Set<string>();
  for (const [index, named] of order.value.entries()) {
    const reached = reads(named.tree, scope.named).named;
    if ([...reached].some((id) => broken.has(id))) continue;
    const before = diagnostics.length;
    typeNamed(index, named);
    if (diagnostics.length > before) broken.add(named.id);
  }
  if (broken.size > 0) return R.failure(sorted(diagnostics));
  const problem = untypable(root, text);
  if (problem !== undefined) return R.failure([problem]);

  // `!` leaves the result's unknown to the analysis, so `tsc` checks only its
  // type and names no `null` in a mismatch.
  const rootAt = place(
    { file: "/root.ts", text },
    rule.type === undefined
      ? { prefix: `const ${RESULT} = ${NAMED_WRAPPER}(\n` }
      : {
          prefix: `const ${RESULT}: ${typeScriptType(rule.type, { asTarget: true })} = (\n`,
          suffix: "\n)!;",
        },
  );
  const checked = analyzePlaced(rootAt);
  report(rootAt, { rootRejected: checked?.analysis.rootRejected });
  const checker = world.program().getTypeChecker();

  if (checked === undefined) return R.failure(sorted(diagnostics));
  const culprit: Culprit | undefined = checked.analysis.root;
  // The wrapper around an untyped result widens it.
  const { parent } = checked.expression;
  const type = checker.getTypeAtLocation(
    ts.isCallExpression(parent) ? parent : checked.expression,
  );
  // A fallback can't fix a result of the wrong type, which `tsc` reports.
  const declared = ts.findAncestor(
    checked.expression,
    ts.isVariableDeclaration,
  );
  const fits =
    declared?.type === undefined ||
    checker.isTypeAssignableTo(
      checker.getNonNullableType(type),
      checker.getTypeAtLocation(declared.type),
    );
  if (culprit !== undefined && fits && NEEDS_FALLBACK[rule.undecided]) {
    diagnostics.push({
      message: undecidedMessage({ culprit, yesNo: isYesNoType(type) }),
      start: 0,
      end: text.length,
    });
  }
  if (diagnostics.length > 0) return R.failure(sorted(diagnostics));

  return R.success({
    tree: checked.tree,
    text,
    type: checker.typeToString(
      culprit === undefined ? checker.getNonNullableType(type) : type,
      undefined,
      ts.TypeFormatFlags.NoTruncation,
    ),
    mayBeUnknown: culprit !== undefined,
  });
}

// Text has no way to read an input, named expression or function a parameter
// hides, or a parameter outside its function, so a tree from elsewhere that
// does would be checked as reading something else.
function scopeProblem(
  tree: Expr,
  refName: (id: string) => string | undefined,
): string | undefined {
  const hidden = (read: string | undefined, params: ReadonlySet<string>) =>
    read !== undefined && params.has(read)
      ? `A function parameter here is also called \`${read}\`, so the text reads the parameter instead. Rename the parameter.`
      : undefined;
  const visit = (
    expr: Expr,
    params: ReadonlySet<string>,
  ): string | undefined => {
    switch (expr.kind) {
      case ExprKind.Input:
        return hidden(expr.id, params);
      case ExprKind.Ref:
        return hidden(refName(expr.id), params);
      case ExprKind.Param:
        return params.has(expr.name)
          ? undefined
          : `This reads \`${expr.name}\` outside the function that has it as a parameter.`;
      case ExprKind.Lambda:
        return visit(expr.body, new Set([...params, ...expr.params]));
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
      case ExprKind.Method: {
        const callee =
          expr.kind === ExprKind.Call ? expr.fn.replace(/\..*/, "") : undefined;
        const found = hidden(callee, params);
        if (found !== undefined) return found;
        for (const child of children(expr)) {
          const found = visit(child, params);
          if (found !== undefined) return found;
        }
        return undefined;
      }
      default:
        throw new Error(`unknown kind: ${expr satisfies never}`);
    }
  };
  return visit(tree, new Set());
}

function initializer(file: ts.SourceFile): ts.Expression | undefined {
  const [statement] = file.statements;
  if (statement === undefined || !ts.isVariableStatement(statement))
    return undefined;
  const declared = statement.declarationList.declarations[0]?.initializer;
  const value =
    declared !== undefined && ts.isNonNullExpression(declared)
      ? declared.expression
      : declared;
  if (value === undefined) return undefined;
  if (ts.isCallExpression(value)) return value.arguments[0];
  return ts.isParenthesizedExpression(value) ? value.expression : undefined;
}

function relative(diagnostic: Diagnostic, at: Placed): Diagnostic {
  return {
    ...diagnostic,
    start: diagnostic.start - at.offset,
    end: diagnostic.end - at.offset,
    namedExpression: at.named?.name,
  };
}

function sorted(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.sort(
    (left, right) =>
      (left.namedExpression ?? "").localeCompare(right.namedExpression ?? "") ||
      left.start - right.start,
  );
}
