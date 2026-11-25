import ts from "typescript";
import { MATH_OBJECT_NAME } from "../forms/formula-allowlist";
import { IS_MISSING, IS_ON_LIST, type Scope } from "./catalog";
import { INTERNAL_PREFIX } from "./check-world";

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

// `tsc` can't declare these as globals: `eval` and `arguments` in strict
// mode, which the save check runs in, and `globalThis` in any mode.
const UNDECLARABLE: ReadonlySet<string> = new Set([
  "eval",
  "arguments",
  "globalThis",
]);

const LANGUAGE_NAMES: ReadonlySet<string> = new Set([
  MATH_OBJECT_NAME,
  IS_MISSING,
  IS_ON_LIST,
  "undefined",
]);

export enum NameRuleBreak {
  Unreadable = "unreadable",
  Internal = "internal",
  Undeclarable = "undeclarable",
  Taken = "taken",
}

/**
 * Why `name` can't name something in a scope whose other names are `taken`, or
 * `undefined` when it can. The language's own names are always taken.
 */
export function nameRuleBreak(
  name: string,
  taken: ReadonlySet<string>,
): NameRuleBreak | undefined {
  // An unreadable name would print as something else, such as `true`, or as
  // text that doesn't parse.
  if (!readsAsName(name)) return NameRuleBreak.Unreadable;
  if (name.startsWith(INTERNAL_PREFIX)) return NameRuleBreak.Internal;
  if (UNDECLARABLE.has(name)) return NameRuleBreak.Undeclarable;
  // Text can't tell two things with one name apart, so a parsed tree wouldn't
  // print back.
  if (taken.has(name) || LANGUAGE_NAMES.has(name)) return NameRuleBreak.Taken;
  return undefined;
}

const SCOPE_MESSAGES: Record<NameRuleBreak, string> = {
  [NameRuleBreak.Unreadable]: "doesn't read back as a name",
  [NameRuleBreak.Internal]: `starts with \`${INTERNAL_PREFIX}\`, which the save check keeps for its own names`,
  [NameRuleBreak.Undeclarable]: "can't be declared as a global",
  [NameRuleBreak.Taken]: "names two things in the scope",
};

export enum ScopeHolder {
  Function = "function",
  Input = "input",
  Named = "named",
}

/** Every name the scope holds, so each rule on them reads one list. */
export function scopeNames({
  catalog,
  named,
}: {
  catalog: Scope["catalog"];
  named: readonly { name: string }[];
}): { name: string; holder: ScopeHolder }[] {
  return [
    ...catalog.functions.map((fn) => ({
      name: fn.name,
      holder: ScopeHolder.Function,
    })),
    ...catalog.inputs.map((input) => ({
      name: input.id,
      holder: ScopeHolder.Input,
    })),
    ...named.map((each) => ({ name: each.name, holder: ScopeHolder.Named })),
  ];
}

export function checkScope(scope: Scope): void {
  const taken = new Set<string>();
  for (const { name } of scopeNames(scope)) {
    const broken = nameRuleBreak(name, taken);
    if (broken !== undefined) {
      throw new Error(`\`${name}\` ${SCOPE_MESSAGES[broken]}.`);
    }
    taken.add(name);
  }
  const lists = new Set(scope.catalog.lists.map((list) => list.name));
  if (lists.size < scope.catalog.lists.length) {
    throw new Error("Two lists in `catalog.lists` share a name.");
  }
}

function readsAsName(name: string): boolean {
  // `()` parses as a parenthesized empty identifier.
  if (name === "" || STRICT_RESERVED.has(name)) return false;
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
