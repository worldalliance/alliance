import ts from "typescript";
import { MATH_OBJECT_NAME } from "../forms/formula-allowlist";
import { IS_UNKNOWN, type Scope } from "./catalog";

// The parser reads text as a sloppy-mode script, where these are names, but
// strict mode, which the save check's `tsc` runs in, reserves them. `await`
// is a name there too, yet `(await) ** 2` prints as `await ** 2`, which
// doesn't parse.
export const STRICT_RESERVED: ReadonlySet<string> = new Set([
  "await",
  "implements",
  "interface",
  "let",
  "package",
  "private",
  "protected",
  "public",
  "static",
  "yield",
]);

export function checkScope(scope: Scope): void {
  const names = [
    ...scope.catalog.functions.map((fn) => fn.name),
    ...scope.catalog.inputs.map((input) => input.id),
    ...scope.named.map((named) => named.name),
  ];
  const taken = new Set([MATH_OBJECT_NAME, IS_UNKNOWN, "undefined"]);
  for (const name of names) {
    if (!readsAsName(name)) {
      // It would print as something else, such as `true`, or as text that
      // doesn't parse.
      throw new Error(`\`${name}\` doesn't read back as a name.`);
    }
    if (taken.has(name)) {
      // Text can't tell the two apart, so a parsed tree wouldn't print back.
      throw new Error(`\`${name}\` names two things in the scope.`);
    }
    taken.add(name);
  }
}

function readsAsName(name: string): boolean {
  if (STRICT_RESERVED.has(name)) return false;
  const [statement] = ts.createSourceFile(
    "/name.ts",
    `(${name})`,
    ts.ScriptTarget.ES2020,
  ).statements;
  return (
    statement !== undefined &&
    ts.isExpressionStatement(statement) &&
    ts.isParenthesizedExpression(statement.expression) &&
    ts.isIdentifier(statement.expression.expression) &&
    statement.expression.expression.text === name
  );
}
