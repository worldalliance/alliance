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

// 2362 and 2363 suggest `bigint` or `enum`, which formulas do not support.
const MESSAGE_OVERRIDES: Readonly<Record<number, string>> = {
  2362: "The left of this operator has to be a number.",
  2363: "The right of this operator has to be a number.",
};

// `join` is the only library member whose `this` type can fail to match, so
// this can only be a join on a list of records or lists, and its span is that
// list.
const JOIN_THIS_MISMATCH = 2684;

function nodeSpanning(
  source: ts.SourceFile,
  span: { start: number; end: number },
): ts.Node | undefined {
  const visit = (node: ts.Node): ts.Node | undefined =>
    node.getStart(source) === span.start && node.end === span.end
      ? node
      : ts.forEachChild(node, (child) =>
          child.getStart(source) <= span.start && span.end <= child.end
            ? visit(child)
            : undefined,
        );
  return visit(source);
}

function joinExample(
  program: ts.Program | undefined,
  diagnostic: ts.Diagnostic,
): string {
  const source = program?.getSourceFile(FORMULA_FILE);
  const { start, length } = diagnostic;
  if (!program || !source || start === undefined || length === undefined) {
    return "";
  }
  const list = nodeSpanning(source, { start, end: start + length });
  if (list === undefined) return "";
  const checker = program.getTypeChecker();
  const element = checker.getTypeAtLocation(list).getNumberIndexType();
  const key = element && readableKey(checker, [element]);
  return key === undefined ? "" : `, like .map(item => item.${key}).join(', ')`;
}

function readMessage(
  program: ts.Program | undefined,
  diagnostic: ts.Diagnostic,
): string {
  if (diagnostic.code === JOIN_THIS_MISMATCH) {
    return `join works on a list of text, numbers or yes/no. Name a part of each item first${joinExample(program, diagnostic)}, or flatten a list of lists with .flat().`;
  }
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

function unionParts(type: ts.Type): readonly ts.Type[] {
  return type.isUnion() ? type.types : [type];
}

function isRenderable(part: ts.Type): boolean {
  return Boolean(part.flags & RENDERABLE_FLAGS);
}

function unrenderablePart(type: ts.Type): ts.Type | undefined {
  return unionParts(type).find((part) => !isRenderable(part));
}

function canFollowDot(name: string): boolean {
  return (
    name.length > 0 &&
    [...name].every((char, index) =>
      (index === 0 ? ts.isIdentifierStart : ts.isIdentifierPart)(
        char.codePointAt(0) ?? 0,
        COMPILER_OPTIONS.target,
      ),
    )
  );
}

function readableKey(
  checker: ts.TypeChecker,
  types: readonly ts.Type[],
): string | undefined {
  const parts = types.flatMap(unionParts);
  const isRecord = (part: ts.Type) =>
    Boolean(part.flags & ts.TypeFlags.Object) && !checker.isArrayType(part);
  if (parts.length === 0 || !parts.every(isRecord)) return undefined;
  const readableKeys = (part: ts.Type) =>
    checker
      .getPropertiesOfType(part)
      .filter(
        (property) =>
          canFollowDot(property.name) &&
          unrenderablePart(checker.getTypeOfSymbol(property)) === undefined,
      )
      .map((property) => property.name);
  const [first, ...rest] = parts.map(readableKeys);
  const keys = first.filter((key) =>
    rest.every((other) => other.includes(key)),
  );
  return keys.includes("label") ? "label" : keys[0];
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
  if (diagnostics.length > 0) {
    return R.failure(readMessage(language.getProgram(), diagnostics[0]));
  }

  const program = language.getProgram();
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
