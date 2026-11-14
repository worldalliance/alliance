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
import { checkScope } from "./convert-scope";
import { dependencyOrder, reads } from "./dependencies";
import { parseExpression } from "./parse";
import { printExpression } from "./print";
import { ExprKind, children, type Expr } from "./tree";
import {
  analyze,
  undecidedMessage,
  type Culprit,
  type Excused,
} from "./undecided";
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

type Placed = {
  file: string;
  offset: number;
  text: string;
  named?: NamedExpression;
  excused: Excused[];
};

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
}: {
  source: string | Expr;
  scope: Scope;
  rule: ResultRule;
}): Result<CheckedExpression, Diagnostic[]> {
  const internal = [
    ...scope.catalog.inputs.map((input) => input.id),
    ...scope.catalog.functions.map((fn) => fn.name),
    ...scope.named.map((named) => named.name),
  ].find((name) => name.startsWith(INTERNAL_PREFIX));
  if (internal !== undefined) {
    throw new Error(
      `\`${internal}\` starts with \`${INTERNAL_PREFIX}\`, which the save check keeps for its own names.`,
    );
  }
  checkScope(scope);
  const nameOf = (id: string) =>
    scope.named.find((named) => named.id === id)?.name;
  // A deleted named expression prints as its id only in text that `missing`
  // below rejects, which nothing reads back.
  const names = { refName: (id: string) => nameOf(id) ?? id };
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

  const reached = reads(root, scope.named).named;
  const holders = [
    { tree: root, text, name: undefined },
    ...scope.named
      .filter((named) => reached.has(named.id))
      .map((named) => ({
        tree: named.tree,
        text: printExpression(named.tree, names),
        name: named.name,
      })),
  ];
  // Printed, a removed input would read whatever now has its name.
  const inputIds = new Set(scope.catalog.inputs.map((input) => input.id));
  const missing = holders.flatMap((holder) => {
    const direct = reads(holder.tree, []);
    const gone = [...direct.named].some((id) => nameOf(id) === undefined)
      ? "a named expression"
      : [...direct.inputs].some((id) => !inputIds.has(id))
        ? "an input"
        : undefined;
    if (gone === undefined) return [];
    return [
      {
        message: `This uses ${gone} that no longer exists.`,
        start: 0,
        end: holder.text.length,
        namedExpression: holder.name,
      },
    ];
  });
  if (missing.length > 0) return R.failure(sorted(missing));
  const hidden = holders.flatMap((holder) => {
    const message = scopeProblem(holder.tree, nameOf);
    if (message === undefined) return [];
    return [
      {
        message,
        start: 0,
        end: holder.text.length,
        namedExpression: holder.name,
      },
    ];
  });
  if (hidden.length > 0) return R.failure(sorted(hidden));
  const order = dependencyOrder([root], scope.named);
  if (!order.ok) {
    return whole(
      `These named expressions refer to each other in a loop: ${order.error.join(" → ")}.`,
    );
  }

  const world = new World(scope.catalog);
  const diagnostics: Diagnostic[] = [];
  // `tsc` repeats some of what the converter rejects, at the same span.
  const converterDiagnostics: Diagnostic[] = [];
  const placed: Placed[] = [];

  const place = (
    entry: Omit<Placed, "offset" | "excused">,
    { prefix, suffix = CLOSE }: { prefix: string; suffix?: string },
  ) => {
    world.write(entry.file, `${prefix}${entry.text}${suffix}`);
    const done = { ...entry, offset: prefix.length, excused: [] };
    placed.push(done);
    return done;
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

  for (const [index, named] of order.value.entries()) {
    const at = place(
      {
        file: `/named-${index}.ts`,
        text: printExpression(named.tree, names),
        named,
      },
      { prefix: `const ${named.name} = ${NAMED_WRAPPER}(\n` },
    );
    const result = analyzePlaced(at);
    if (result === undefined) continue;
    const unknown = result.analysis.root !== undefined;
    const type = result.program
      .getTypeChecker()
      .getTypeAtLocation(result.expression);
    if (isNullableType(type) !== unknown) {
      const wrapper = unknown ? UNDECIDED_WRAPPER : KNOWN_WRAPPER;
      const prefix = `const ${named.name} = ${wrapper}(\n`;
      world.write(at.file, `${prefix}${at.text}${CLOSE}`);
      at.offset = prefix.length;
    }
  }

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
  const checker = world.program().getTypeChecker();

  for (const at of placed) {
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
  }

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
