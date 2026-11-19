import { escapeRegExp } from "es-toolkit";
import ts from "typescript";
import { FORMULA_LIB } from "../forms/formula-lib";
import { FORMULA_TARGET } from "../forms/formula-renderable";
import { IS_MISSING, TypeKind, type Catalog, type ValueType } from "./catalog";
import { BARE_KEY } from "./print";

const LIB_FILE = "/lib.expression.d.ts";
const DECLARATIONS_FILE = "/declarations.d.ts";

/**
 * TypeScript text for a value type. `asTarget` asks for the type a value is
 * checked against, a built-in function parameter's or the result's: there a
 * nullable type at any depth admits `undefined` as well, since a missing
 * lookup gives `null` at runtime, and a record admits no text, number, yes/no
 * or list, which a record type alone would where their fields fit, as the
 * interpreter doesn't.
 */
export function typeScriptType(
  type: ValueType,
  { asTarget = false }: { asTarget?: boolean } = {},
): string {
  switch (type.kind) {
    case TypeKind.String:
    case TypeKind.Number:
    case TypeKind.Boolean:
      return type.kind;
    case TypeKind.Choice:
      return type.options.length === 0
        ? "never"
        : type.options
            .map((option) => JSON.stringify(option.value))
            .join(" | ");
    case TypeKind.List:
      return `(${typeScriptType(type.item, { asTarget })})[]`;
    case TypeKind.Record: {
      const fields = Object.entries(type.fields).map(
        ([key, field]) =>
          `${BARE_KEY.test(key) ? key : JSON.stringify(key)}: ${typeScriptType(field, { asTarget })}`,
      );
      const record = `{ ${fields.join("; ")} }`;
      return asTarget
        ? `(${record} & object & { readonly [${LIST_BRAND}]?: never })`
        : record;
    }
    case TypeKind.Nullable:
      return `${typeScriptType(type.inner, { asTarget })} | null${asTarget ? " | undefined" : ""}`;
    default:
      throw new Error(`unknown type kind: ${type satisfies never}`);
  }
}

/** Starts every name the check declares for itself. */
export const INTERNAL_PREFIX = "__";
export const NAMED_WRAPPER = `${INTERNAL_PREFIX}named`;
export const UNDECIDED_WRAPPER = `${INTERNAL_PREFIX}undecided`;
export const KNOWN_WRAPPER = `${INTERNAL_PREFIX}known`;
// Every list has it and no record can, as record fields are text.
const LIST_BRAND = `${INTERNAL_PREFIX}list`;

const BRAND_ONLY = `{ readonly [${LIST_BRAND}]?: undefined; }`;
// In a union, `tsc` puts the branded record in parentheses, as it does a
// union a field's type holds.
const BRANDED_IN_UNION = new RegExp(
  `\\((\\{(?:[^()]|\\([^()]*\\))*\\}) & object & ${escapeRegExp(BRAND_ONLY)}\\)`,
  "g",
);

/**
 * `tsc`'s message without the brand a record target carries, which means
 * nothing to an admin; where the brand is what failed, it says so plainly.
 */
export function withoutListBrand(diagnostic: ts.Diagnostic): ts.Diagnostic {
  const rewrite = (
    chain: ts.DiagnosticMessageChain,
  ): ts.DiagnosticMessageChain => {
    if (chain.messageText.includes(`'${BRAND_ONLY}'`)) {
      return {
        ...chain,
        messageText: "A list isn't a record.",
        next: undefined,
      };
    }
    let unwrapped = chain.messageText;
    // Each pass unwraps the records nested one level deeper.
    for (let previous = ""; previous !== unwrapped; ) {
      previous = unwrapped;
      unwrapped = unwrapped.replace(BRANDED_IN_UNION, "$1");
    }
    const messageText = unwrapped
      .replaceAll(` & object & ${BRAND_ONLY}`, "")
      .replaceAll(`object & ${BRAND_ONLY}`, "object");
    // Without the brand, a line can repeat the one it elaborates.
    const next = chain.next
      ?.map(rewrite)
      .flatMap((line) =>
        line.messageText === messageText ? (line.next ?? []) : [line],
      );
    return { ...chain, messageText, next };
  };
  // Joined here, as `tsc`'s own flattening indents each line it joins.
  const lines = (chain: ts.DiagnosticMessageChain): string[] => [
    chain.messageText,
    ...(chain.next ?? []).flatMap(lines),
  ];
  const { messageText } = diagnostic;
  const chain =
    typeof messageText === "string"
      ? { messageText, category: diagnostic.category, code: diagnostic.code }
      : messageText;
  return { ...diagnostic, messageText: lines(rewrite(chain)).join(" ") };
}

const COMPILER_OPTIONS: ts.CompilerOptions = {
  lib: [LIB_FILE],
  target: FORMULA_TARGET,
  strict: true,
  noUncheckedIndexedAccess: true,
  types: [],
  noResolve: true,
  // A shortened type, `{ ...; }`, would hide the brand from withoutListBrand.
  noErrorTruncation: true,
};

const LIB_SNAPSHOT = ts.ScriptSnapshot.fromString(FORMULA_LIB);

/** The declarations `tsc` checks expressions against, generated from a catalog. */
function declarations(catalog: Catalog): string {
  return [
    `declare function ${IS_MISSING}(value: unknown): value is null | undefined;`,
    `declare const ${LIST_BRAND}: unique symbol;`,
    `interface Array<T> {`,
    `  readonly [${LIST_BRAND}]: true;`,
    // So `marks.filter(m => !isMissing(m))` has items that can't be missing,
    // while a predicate `tsc` infers from `k === "a"` keeps the items' type.
    `  filter(fn: (item: T, index: number, list: T[]) => item is T & {}): (T & {})[];`,
    `}`,
    // Widens a literal as `let` would, so `const region = "US"` is a string,
    // while a `const` keeps narrowing inside functions.
    `declare function ${NAMED_WRAPPER}<T>(value: T): T extends infer U ? U : never;`,
    `declare function ${UNDECIDED_WRAPPER}<T>(value: T): (T extends infer U ? U : never) | null;`,
    `declare function ${KNOWN_WRAPPER}<T>(value: T): (T extends infer U ? U : never) & {};`,
    ...catalog.inputs.map(
      (input) => `declare const ${input.id}: ${typeScriptType(input.type)};`,
    ),
    ...catalog.functions.map((fn) => {
      // A catalog parameter's name could shadow a name the declarations use.
      const params = fn.params.map(
        (param, index) =>
          `p${index}: ${typeScriptType(param.type, { asTarget: true })}`,
      );
      return `declare function ${fn.name}(${params.join(", ")}): ${typeScriptType(fn.returns)};`;
    }),
  ].join("\n");
}

/** Script files sharing one global scope, checked by one language service. */
export class World {
  private readonly files = new Map<string, { text: string; version: number }>();
  private readonly service: ts.LanguageService;

  constructor(catalog: Catalog) {
    const host: ts.LanguageServiceHost = {
      getScriptFileNames: () => [LIB_FILE, ...this.files.keys()],
      getScriptVersion: (name) => String(this.files.get(name)?.version ?? 0),
      getScriptSnapshot: (name) => {
        if (name === LIB_FILE) return LIB_SNAPSHOT;
        const file = this.files.get(name);
        return file && ts.ScriptSnapshot.fromString(file.text);
      },
      getCurrentDirectory: () => "/",
      getCompilationSettings: () => COMPILER_OPTIONS,
      getDefaultLibFileName: () => LIB_FILE,
      fileExists: (name) => name === LIB_FILE || this.files.has(name),
      readFile: (name) =>
        name === LIB_FILE ? FORMULA_LIB : this.files.get(name)?.text,
    };
    // A registry shared by worlds hands one world's syntax tree to another at
    // the same file name and version, and keeps every world's files.
    this.service = ts.createLanguageService(host, ts.createDocumentRegistry());
    this.write(DECLARATIONS_FILE, declarations(catalog));
    const problems = this.diagnostics(DECLARATIONS_FILE);
    if (problems.length > 0) {
      const text = problems
        .map((problem) =>
          ts.flattenDiagnosticMessageText(problem.messageText, " "),
        )
        .join("; ");
      throw new Error(`The expression catalog doesn't compile: ${text}`);
    }
  }

  write(name: string, text: string): void {
    const version = (this.files.get(name)?.version ?? 0) + 1;
    this.files.set(name, { text, version });
  }

  program(): ts.Program {
    const program = this.service.getProgram();
    if (program === undefined)
      throw new Error("The language service has no program.");
    return program;
  }

  diagnostics(name: string): ts.Diagnostic[] {
    return [
      ...this.service.getSyntacticDiagnostics(name),
      ...this.service.getSemanticDiagnostics(name),
    ];
  }
}
