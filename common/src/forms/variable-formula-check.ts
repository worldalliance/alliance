// TypeScript checks types against the restricted declarations in
// `formula-lib.ts` after `compileVariableExpression` rejects syntax the
// evaluator cannot run. Null checks stay off because every answer is optional.
// Implicit `any` stays allowed so a missing field produces one validation error
// instead of another error for every use.

import ts from "typescript";
import { R, type Result } from "../result";
import { FORMULA_LIB } from "./formula-lib";

const FORMULA_FILE = "/formula.ts";
const LIB_FILE = "/lib.formula.d.ts";
const RESULT_NAME = "__result";

const COMPILER_OPTIONS: ts.CompilerOptions = {
  lib: [LIB_FILE],
  target: ts.ScriptTarget.ES2020,
  strict: false,
  strictNullChecks: false,
  noImplicitAny: false,
  types: [],
  noResolve: true,
};

const LIB_SNAPSHOT = ts.ScriptSnapshot.fromString(FORMULA_LIB);

// Reuse one service so checks on each keystroke do not reparse the library.
const service = (() => {
  let source = "";
  let version = 0;

  const host: ts.LanguageServiceHost = {
    getScriptFileNames: () => [LIB_FILE, FORMULA_FILE],
    getScriptVersion: (fileName) =>
      fileName === FORMULA_FILE ? String(version) : "1",
    getScriptSnapshot: (fileName) =>
      fileName === FORMULA_FILE
        ? ts.ScriptSnapshot.fromString(source)
        : fileName === LIB_FILE
          ? LIB_SNAPSHOT
          : undefined,
    getCurrentDirectory: () => "/",
    getCompilationSettings: () => COMPILER_OPTIONS,
    getDefaultLibFileName: () => LIB_FILE,
    fileExists: (fileName) =>
      fileName === FORMULA_FILE || fileName === LIB_FILE,
    readFile: (fileName) =>
      fileName === FORMULA_FILE
        ? source
        : fileName === LIB_FILE
          ? FORMULA_LIB
          : undefined,
    getDirectories: () => [],
  };

  const language = ts.createLanguageService(host, ts.createDocumentRegistry());
  return (next: string) => {
    source = next;
    version += 1;
    return language;
  };
})();

function virtualSource(
  formula: string,
  inputTypes: ReadonlyMap<string, string>,
): string {
  const declarations = [...inputTypes]
    .map(([name, type]) => `declare const ${name}: ${type};`)
    .join("\n");
  // The formula sits on its own line so a trailing `//` comment cannot swallow
  // the closing bracket.
  return `${declarations}\nconst ${RESULT_NAME} = (\n${formula}\n);\n`;
}

const COMPILER_ADVICE = /\s*Do you need to change your target library\?.*$/s;

// These diagnostics suggest `bigint` or `enum`, which formulas do not support.
const MESSAGE_OVERRIDES: Readonly<Record<number, string>> = {
  2362: "The left of this operator has to be a number.",
  2363: "The right of this operator has to be a number.",
};

function readMessage(diagnostic: ts.Diagnostic): string {
  const override = MESSAGE_OVERRIDES[diagnostic.code];
  if (override !== undefined) return override;
  const text = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
  return text.replace(COMPILER_ADVICE, "");
}

const RENDERABLE_FLAGS =
  ts.TypeFlags.Any |
  ts.TypeFlags.Unknown |
  ts.TypeFlags.StringLike |
  ts.TypeFlags.NumberLike |
  ts.TypeFlags.BooleanLike |
  ts.TypeFlags.Undefined |
  ts.TypeFlags.Null |
  ts.TypeFlags.Never;

function unrenderableAdvice(checker: ts.TypeChecker, type: ts.Type): string {
  if (checker.isArrayType(type) || checker.isTupleType(type)) {
    return "Name a part or join it: input1.map(item => item.label).join(', '), or input1.length.";
  }
  if (type.getCallSignatures().length > 0) {
    return "An arrow function is something to pass to a list method, not something to show.";
  }
  return "Name a key: input1.label.";
}

function checkRenderable(
  checker: ts.TypeChecker,
  type: ts.Type,
): string | undefined {
  const parts = type.isUnion() ? type.types : [type];
  const unrenderable = parts.find((part) => !(part.flags & RENDERABLE_FLAGS));
  if (unrenderable === undefined) return undefined;
  return `A formula has to end on text, a number or a yes/no, and this one gives a ${checker.typeToString(unrenderable)}. ${unrenderableAdvice(checker, unrenderable)}`;
}

function resultDeclaration(
  source: ts.SourceFile,
): ts.VariableDeclaration | undefined {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const declaration = statement.declarationList.declarations[0];
    if (declaration.name.getText(source) === RESULT_NAME) return declaration;
  }
  return undefined;
}

type CheckedFormula = { checker: ts.TypeChecker; type: ts.Type };

function checkFormula(
  formula: string,
  inputTypes: ReadonlyMap<string, string>,
): Result<CheckedFormula, string> {
  const language = service(virtualSource(formula, inputTypes));

  const diagnostics = [
    ...language.getSyntacticDiagnostics(FORMULA_FILE),
    ...language.getSemanticDiagnostics(FORMULA_FILE),
  ].sort((left, right) => (left.start ?? 0) - (right.start ?? 0));
  if (diagnostics.length > 0) {
    return R.failure(readMessage(diagnostics[0]));
  }

  const program = language.getProgram();
  const source = program?.getSourceFile(FORMULA_FILE);
  const declaration = source && resultDeclaration(source);
  // Reachable only if TypeScript reported no error on a file it could not
  // parse into the one declaration this builds.
  if (program === undefined || declaration === undefined) {
    return R.failure("This formula could not be checked.");
  }

  const checker = program.getTypeChecker();
  return R.success({
    checker,
    type: checker.getTypeAtLocation(declaration.name),
  });
}

/** Returns the inferred type without checking whether it can render as text. */
export function variableFormulaType(
  formula: string,
  inputTypes: ReadonlyMap<string, string>,
): Result<string, string> {
  return R.map(checkFormula(formula, inputTypes), ({ checker, type }) =>
    checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation),
  );
}

export function checkVariableFormulaType(
  formula: string,
  inputTypes: ReadonlyMap<string, string>,
): Result<string, string> {
  const checked = checkFormula(formula, inputTypes);
  if (!checked.ok) return checked;

  const { checker, type } = checked.value;
  const unrenderable = checkRenderable(checker, type);
  return unrenderable === undefined
    ? R.success(
        checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation),
      )
    : R.failure(unrenderable);
}
