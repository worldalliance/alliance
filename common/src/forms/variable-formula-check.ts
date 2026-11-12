// TypeScript checks types against the restricted declarations in
// `formula-lib.ts` after `compileVariableExpression` rejects syntax the
// evaluator cannot run. Null checks stay off because every answer is optional.
// Implicit `any` stays allowed so a missing field produces one validation error
// instead of another error for every use.

import ts from "typescript";
import { R, type Result } from "../result";
import { FORMULA_LIB } from "./formula-lib";
import { compilerMessage } from "./formula-messages";
import { optionsShapeMessage } from "./formula-options";
import {
  FORMULA_TARGET,
  isRenderable,
  readableKey,
  unionParts,
  unrenderablePart,
} from "./formula-renderable";
import { VARIABLE_INPUT_TYPE, VariableInputMode } from "./variables";

const FORMULA_FILE = "/formula.ts";
const LIB_FILE = "/lib.formula.d.ts";
const RESULT_NAME = "__result";
const OPTIONS_TYPE_NAME = "__Options";
const OPTIONS_TYPE = VARIABLE_INPUT_TYPE[VariableInputMode.Choices];

const COMPILER_OPTIONS: ts.CompilerOptions = {
  lib: [LIB_FILE],
  target: FORMULA_TARGET,
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
  return `${declarations}\ntype ${OPTIONS_TYPE_NAME} = ${OPTIONS_TYPE};\nconst ${RESULT_NAME} = (\n${formula}\n);\n`;
}

function unrenderableAdvice({
  checker,
  type,
  expression,
  unrenderable,
}: CheckedFormula & { unrenderable: ts.Type }): string {
  if (
    unrenderable.getSymbol()?.valueDeclaration?.kind ===
    ts.SyntaxKind.MethodSignature
  ) {
    return "Add () to call it.";
  }
  if (unrenderable.getCallSignatures().length > 0) {
    return "An arrow function is something to pass to a list method, not something to show.";
  }
  const mixed = unionParts(type).some(isRenderable);
  const targets = unionParts(type).filter((part) => !isRenderable(part));
  // Text added after `a || b` binds only to `b`.
  const endsOnOperator = !ts.isLeftHandSideExpression(expression);
  const endIt = mixed
    ? "In the part that gives it, add"
    : endsOnOperator
      ? "Wrap it in parentheses and end it with"
      : "End it with";
  const isList = (part: ts.Type) =>
    checker.isArrayType(part) || checker.isTupleType(part);
  if (targets.every(isList)) {
    const elements = targets.map((part) => part.getNumberIndexType());
    if (
      elements.every(
        (element) =>
          element !== undefined && unrenderablePart(element) === undefined,
      )
    ) {
      return `${endIt} .join(', ') or .length.`;
    }
    const key = elements.every((element) => element !== undefined)
      ? readableKey(checker, elements)
      : undefined;
    return key === undefined
      ? `${endIt} .length.`
      : `${endIt} .map(item => item.${key}).join(', ') or .length.`;
  }
  if (targets.some(isList)) {
    const recordKey = readableKey(
      checker,
      targets.filter((part) => !isList(part)),
    );
    const recordFix =
      recordKey === undefined ? "name a key in" : `.${recordKey} to`;
    return `Add .length to the part that gives a list, and ${recordFix} the part that gives a record.`;
  }
  const key = readableKey(checker, targets);
  return key === undefined ? "Name a key." : `${endIt} .${key}.`;
}

function unrenderableReason(checked: CheckedFormula): string | undefined {
  const { checker, type } = checked;
  const unrenderable =
    unionParts(type).find((part) => part.getCallSignatures().length > 0) ??
    unrenderablePart(type);
  if (unrenderable === undefined) return undefined;
  const described =
    unrenderable.getCallSignatures().length > 0
      ? "function"
      : checker.typeToString(unrenderable);
  return `gives a ${described}. ${unrenderableAdvice({ ...checked, unrenderable })}`;
}

function checkRenderable(checked: CheckedFormula): string | undefined {
  const reason = unrenderableReason(checked);
  return reason === undefined
    ? undefined
    : `A formula has to end on text, a number or a yes/no, and this one ${reason}`;
}

// TypeScript lets `+` join text with anything, and the evaluator would show a
// list or record as its JavaScript text.
function checkAddedToText({
  checker,
  expression,
}: CheckedFormula): string | undefined {
  const visit = (node: ts.Node): string | undefined => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.PlusToken
    ) {
      for (const operand of [node.left, node.right]) {
        const reason = unrenderableReason({
          checker,
          type: checker.getTypeAtLocation(operand),
          expression: operand,
        });
        if (reason !== undefined) {
          return `Only text, a number or a yes/no can be added to text, and \`${operand.getText()}\` ${reason}`;
        }
      }
    }
    return ts.forEachChild(node, visit);
  };
  return visit(expression);
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

type CheckedFormula = {
  checker: ts.TypeChecker;
  type: ts.Type;
  expression: ts.Expression;
};

function checkFormula(
  formula: string,
  inputTypes: ReadonlyMap<string, string>,
): Result<CheckedFormula, string> {
  const language = service(virtualSource(formula, inputTypes));

  const diagnostics = [
    ...language.getSyntacticDiagnostics(FORMULA_FILE),
    ...language.getSemanticDiagnostics(FORMULA_FILE),
  ].sort((left, right) => (left.start ?? 0) - (right.start ?? 0));
  const program = language.getProgram();
  const [first] = diagnostics;
  if (first !== undefined) {
    return R.failure(compilerMessage(first, program?.getTypeChecker()));
  }

  const source = program?.getSourceFile(FORMULA_FILE);
  const declaration = source && resultDeclaration(source);
  const wrapper = declaration?.initializer;
  // Reachable only for a formula `compileVariableExpression` rejects: one that
  // TypeScript parses without error, but not into the one parenthesized
  // declaration this builds.
  if (
    program === undefined ||
    declaration === undefined ||
    wrapper === undefined ||
    !ts.isParenthesizedExpression(wrapper)
  ) {
    return R.failure("This formula could not be checked.");
  }

  const checker = program.getTypeChecker();
  return R.success({
    checker,
    type: checker.getTypeAtLocation(declaration.name),
    expression: wrapper.expression,
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

export function checkOptionsFormulaType(
  formula: string,
  inputTypes: ReadonlyMap<string, string>,
): Result<string, string> {
  const checked = checkFormula(formula, inputTypes);
  if (!checked.ok) return checked;
  const { checker, type, expression } = checked.value;
  const described = checker.typeToString(
    type,
    undefined,
    ts.TypeFormatFlags.NoTruncation,
  );
  const options = optionsTypeAt(checker, expression);
  if (options === undefined || !checker.isTypeAssignableTo(type, options)) {
    return R.failure(optionsShapeMessage(described));
  }
  const addedToText = checkAddedToText(checked.value);
  return addedToText === undefined
    ? R.success(described)
    : R.failure(addedToText);
}

// The formula lib has no global to name the type by, so it is read off a
// declaration the virtual source carries for the purpose.
function optionsTypeAt(
  checker: ts.TypeChecker,
  expression: ts.Expression,
): ts.Type | undefined {
  const source = expression.getSourceFile();
  for (const statement of source.statements) {
    if (!ts.isTypeAliasDeclaration(statement)) continue;
    if (statement.name.text === OPTIONS_TYPE_NAME) {
      return checker.getTypeAtLocation(statement.type);
    }
  }
  return undefined;
}

export function checkVariableFormulaType(
  formula: string,
  inputTypes: ReadonlyMap<string, string>,
): Result<string, string> {
  const checked = checkFormula(formula, inputTypes);
  if (!checked.ok) return checked;

  const { checker, type } = checked.value;
  const unrenderable =
    checkRenderable(checked.value) ?? checkAddedToText(checked.value);
  return unrenderable === undefined
    ? R.success(
        checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation),
      )
    : R.failure(unrenderable);
}
