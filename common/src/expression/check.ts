import ts from "typescript";
import { compilerMessage } from "../forms/formula-messages";
import { unionParts } from "../forms/formula-renderable";
import { R, type Result } from "../result";
import {
  type Diagnostic,
  type NamedExpression,
  type Scope,
  type ValueType,
} from "./catalog";
import {
  INTERNAL_PREFIX,
  NAMED_WRAPPER,
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

export type ResultRule = {
  /** The result must fit this type; unset accepts any type. */
  type?: ValueType;
};

const METHOD_VALUE = "A method can't be used as a value. Call it with `(…)`.";

export type CheckedExpression = {
  tree: Expr;
  /** The text checked: the admin's own, or the tree printed. */
  text: string;
  /**
   * `tsc`'s type of the result as TypeScript text, for display, widened as a
   * named expression's is when the rule asks for no type. It names
   * `undefined` where a lookup can miss, which the language writes as `null`.
   */
  type: string;
};

const RESULT = `${INTERNAL_PREFIX}result`;

type Placed = {
  file: string;
  offset: number;
  text: string;
  named?: NamedExpression;
};

/**
 * The save check: `tsc` over declarations generated from the catalog, with the
 * expression's named expressions declared before it.
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

  const place = (entry: Omit<Placed, "offset">, prefix: string) => {
    world.write(entry.file, `${prefix}${entry.text}\n);`);
    const done = { ...entry, offset: prefix.length };
    placed.push(done);
    return done;
  };

  const convertPlaced = (at: Placed) => {
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
    return { ...converted.value, expression };
  };

  for (const [index, named] of order.value.entries()) {
    convertPlaced(
      place(
        {
          file: `/named-${index}.ts`,
          text: printExpression(named.tree, names),
          named,
        },
        `const ${named.name} = ${NAMED_WRAPPER}(\n`,
      ),
    );
  }

  const expected = rule.type && typeScriptType(rule.type, { asTarget: true });
  const rootAt = place(
    { file: "/root.ts", text },
    expected === undefined
      ? `const ${RESULT} = ${NAMED_WRAPPER}(\n`
      : `const ${RESULT}: ${expected} = (\n`,
  );
  const checked = convertPlaced(rootAt);
  const checker = world.program().getTypeChecker();

  for (const at of placed) {
    for (const diagnostic of world.diagnostics(at.file)) {
      const start = (diagnostic.start ?? 0) - at.offset;
      const end = start + (diagnostic.length ?? 0);
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

  if (checked === undefined || diagnostics.length > 0) {
    return R.failure(sorted(diagnostics));
  }
  // The wrapper around an untyped result widens it.
  const { parent } = checked.expression;
  const result = ts.isCallExpression(parent) ? parent : checked.expression;
  return R.success({
    tree: checked.tree,
    text,
    type: checker.typeToString(
      checker.getTypeAtLocation(result),
      undefined,
      ts.TypeFormatFlags.NoTruncation,
    ),
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
  const value = statement.declarationList.declarations[0]?.initializer;
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
