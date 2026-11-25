import ts from "typescript";
import { R, type Result } from "../result";
import { type Diagnostic, type Scope } from "./catalog";
import { TYPE_ARGUMENTS, convertExpression } from "./convert";
import { checkScope } from "./convert-scope";
import { printExpression } from "./print";
import { BinaryOp, type Expr } from "./tree";

const WRAP_PREFIX = "(\n";
const WRAP_SUFFIX = "\n)";

const PARSE_FILE = "/expression.ts";
const CLOSE_EXPECTED = "')' expected.";
const PARSE_OPTIONS: ts.CompilerOptions = {
  noLib: true,
  noResolve: true,
  types: [],
};

/** Parses admin text into a tree, with every problem located in `text`. */
export function parseExpression(
  text: string,
  scope: Scope,
): Result<Expr, Diagnostic[]> {
  checkScope(scope);
  const source = `${WRAP_PREFIX}${text}${WRAP_SUFFIX}`;
  const file = ts.createSourceFile(
    PARSE_FILE,
    source,
    ts.ScriptTarget.ES2020,
    true,
  );
  const shift = (diagnostic: Diagnostic): Diagnostic => ({
    ...diagnostic,
    start: clamp(diagnostic.start - WRAP_PREFIX.length, text.length),
    end: clamp(diagnostic.end - WRAP_PREFIX.length, text.length),
  });

  const wrapperClose =
    WRAP_PREFIX.length + text.length + WRAP_SUFFIX.indexOf(")");
  const notSingle = R.failure([
    { message: "Write a single expression.", start: 0, end: text.length },
  ]);
  const regexes = regexStarts(file);
  const close = unmatchedClose(text, regexes);
  if (close !== undefined) {
    return R.failure([
      {
        message: "This `)` has no matching `(`.",
        start: close,
        end: close + 1,
      },
    ]);
  }
  const found = comment(text, regexes);
  if (found !== undefined) return R.failure([found]);
  const syntax = syntaxDiagnostics(file);
  if (syntax.length > 0 && readsTypeArguments(text, regexes)) {
    return R.failure([{ message: TYPE_ARGUMENTS, start: 0, end: text.length }]);
  }
  if (syntax.length > 0) {
    // The wrapper's `)` turns text that is valid on its own, like `count;`,
    // into errors about a `(` the admin didn't type.
    const bare = ts.createSourceFile(
      PARSE_FILE,
      text,
      ts.ScriptTarget.ES2020,
      true,
    );
    if (syntaxDiagnostics(bare).length > 0) {
      // So does text with its own error, where the parser asks for the
      // wrapper's `(` to close or trips over its `)`.
      if (
        syntax.some(
          ({ message, start }) =>
            message === CLOSE_EXPECTED &&
            parenDepth({
              text,
              regexes,
              at: start - WRAP_PREFIX.length,
            }) === 0,
        )
      ) {
        return notSingle;
      }
      const own = syntax.filter(({ start }) => start !== wrapperClose);
      return R.failure((own.length > 0 ? own : syntax).map(shift));
    }
    const [only, ...others] = bare.statements;
    if (
      only !== undefined &&
      ts.isExpressionStatement(only) &&
      others.length === 0 &&
      only.getText(bare).endsWith(";")
    ) {
      const end = only.getEnd();
      return R.failure([{ message: "Remove the `;`.", start: end - 1, end }]);
    }
    return notSingle;
  }

  const [statement, ...rest] = file.statements;
  if (
    statement === undefined ||
    rest.length > 0 ||
    !ts.isExpressionStatement(statement) ||
    !ts.isParenthesizedExpression(statement.expression)
  ) {
    return notSingle;
  }
  const converted = convertExpression({
    node: statement.expression.expression,
    file,
    scope,
  });
  if (!converted.ok) return R.failure(converted.error.map(shift));
  const { tree } = converted.value;
  // Whether TypeScript reads a `<` and a later `>` as type arguments turns on
  // parentheses the printer doesn't keep, so the printed text is tried too.
  const printed = printExpression(tree, {
    refName: (id) => scope.named.find((named) => named.id === id)?.name,
    listName: (id) => scope.catalog.lists.find((list) => list.id === id)?.name,
  });
  const reparsed = ts.createSourceFile(
    PARSE_FILE,
    `${WRAP_PREFIX}${printed}${WRAP_SUFFIX}`,
    ts.ScriptTarget.ES2020,
    true,
  );
  if (syntaxDiagnostics(reparsed).length === 0) return R.success(tree);
  if (!JSON.stringify(tree).includes(`"op":"${BinaryOp.LessThan}"`)) {
    throw new Error(`The printed expression doesn't parse: ${printed}`);
  }
  return R.failure([
    {
      message: TYPE_ARGUMENTS,
      start: 0,
      end: text.length,
    },
  ]);
}

/** Where in the admin's text TypeScript's parser read a regular expression. */
function regexStarts(file: ts.SourceFile): Set<number> {
  const starts = new Set<number>();
  const visit = (node: ts.Node) => {
    if (ts.isRegularExpressionLiteral(node)) {
      starts.add(node.getStart(file) - WRAP_PREFIX.length);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return starts;
}

enum Opened {
  Brace = "brace",
  Template = "template",
}

const CLOSES_TEMPLATE: Record<Opened, boolean> = {
  [Opened.Brace]: false,
  [Opened.Template]: true,
};

/**
 * Each token in `text`, then the end of file. A `/` starts a regular
 * expression only where `regexes` says the parser read one.
 */
function* tokens(text: string, regexes: ReadonlySet<number>) {
  const scanner = ts.createScanner(ts.ScriptTarget.ES2020, true);
  scanner.setText(text);
  const opened: Opened[] = [];
  for (;;) {
    let token = scanner.scan();
    if (
      (token === ts.SyntaxKind.SlashToken ||
        token === ts.SyntaxKind.SlashEqualsToken) &&
      regexes.has(scanner.getTokenStart())
    ) {
      token = scanner.reScanSlashToken();
    }
    if (token === ts.SyntaxKind.OpenBraceToken) opened.push(Opened.Brace);
    if (token === ts.SyntaxKind.TemplateHead) opened.push(Opened.Template);
    const closed =
      token === ts.SyntaxKind.CloseBraceToken ? opened.pop() : undefined;
    if (closed !== undefined && CLOSES_TEMPLATE[closed]) {
      token = scanner.reScanTemplateToken(false);
      if (token === ts.SyntaxKind.TemplateMiddle) opened.push(Opened.Template);
    }
    yield {
      token,
      start: scanner.getTokenStart(),
      fullStart: scanner.getTokenFullStart(),
    };
    if (token === ts.SyntaxKind.EndOfFileToken) return;
  }
}

/** The first `)` in `text` with no `(` before it to close. */
function unmatchedClose(
  text: string,
  regexes: ReadonlySet<number>,
): number | undefined {
  let parens = 0;
  for (const { token, start } of tokens(text, regexes)) {
    if (token === ts.SyntaxKind.OpenParenToken) parens += 1;
    if (token === ts.SyntaxKind.CloseParenToken && parens-- === 0) {
      return start;
    }
  }
  return undefined;
}

/** How many `(` before `at` in `text` are still open there. */
function parenDepth({
  text,
  regexes,
  at,
}: {
  text: string;
  regexes: ReadonlySet<number>;
  at: number;
}): number {
  let depth = 0;
  for (const { token, start } of tokens(text, regexes)) {
    if (start >= at) break;
    if (token === ts.SyntaxKind.OpenParenToken) depth += 1;
    if (token === ts.SyntaxKind.CloseParenToken) depth -= 1;
  }
  return depth;
}

/**
 * Whether `text` parses once each `<` is an operator, so its syntax errors
 * come from TypeScript reading type arguments.
 */
function readsTypeArguments(
  text: string,
  regexes: ReadonlySet<number>,
): boolean {
  let swapped = text;
  let lessThan = false;
  let greaterAfter = false;
  for (const { token, start } of tokens(text, regexes)) {
    if (token === ts.SyntaxKind.GreaterThanToken && lessThan) {
      greaterAfter = true;
    }
    if (token === ts.SyntaxKind.LessThanToken) {
      lessThan = true;
      swapped = `${swapped.slice(0, start)}*${swapped.slice(start + 1)}`;
    }
  }
  if (!greaterAfter) return false;
  const file = ts.createSourceFile(
    PARSE_FILE,
    `${WRAP_PREFIX}${swapped}${WRAP_SUFFIX}`,
    ts.ScriptTarget.ES2020,
    true,
  );
  return syntaxDiagnostics(file).length === 0;
}

// The tree keeps no comments, so saving would drop them unseen.
function comment(
  text: string,
  regexes: ReadonlySet<number>,
): Diagnostic | undefined {
  for (const { fullStart } of tokens(text, regexes)) {
    const [found] = [
      ...(ts.getTrailingCommentRanges(text, fullStart) ?? []),
      ...(ts.getLeadingCommentRanges(text, fullStart) ?? []),
    ];
    if (found !== undefined) {
      return {
        message: "Expressions can't keep comments. Remove this one.",
        start: found.pos,
        end: found.end,
      };
    }
  }
  return undefined;
}

function syntaxDiagnostics(file: ts.SourceFile): Diagnostic[] {
  // `ts.createCompilerHost` reads `ts.sys`, which a browser bundle lacks.
  const host: ts.CompilerHost = {
    getSourceFile: (name) => (name === file.fileName ? file : undefined),
    getDefaultLibFileName: () => "",
    writeFile: () => {},
    getCurrentDirectory: () => "/",
    getCanonicalFileName: (name) => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
    fileExists: (name) => name === file.fileName,
    readFile: () => undefined,
  };
  const program = ts.createProgram([file.fileName], PARSE_OPTIONS, host);
  return program.getSyntacticDiagnostics(file).map((diagnostic) => ({
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, " "),
    start: diagnostic.start ?? 0,
    end: (diagnostic.start ?? 0) + (diagnostic.length ?? 0),
  }));
}

const clamp = (offset: number, length: number) =>
  Math.min(Math.max(offset, 0), length);
