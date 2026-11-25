import ts from "typescript";
import { readableKey } from "./formula-renderable";

const COMPILER_ADVICE = /\s*Do you need to change your target library\?.*$/s;

// 2362 and 2363 suggest `bigint` or `enum`, which formulas do not support.
const MESSAGE_OVERRIDES: Readonly<Record<number, string>> = {
  2362: "The left of this operator has to be a number.",
  2363: "The right of this operator has to be a number.",
};

// `join` is the only library member whose `this` type can fail to match, so
// this can only be a join on a list of records or lists.
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

// A 2684 diagnostic spans the list `join` was called on.
function joinExample(
  diagnostic: ts.Diagnostic,
  checker: ts.TypeChecker | undefined,
): string {
  const { file, start, length } = diagnostic;
  if (!checker || !file || start === undefined || length === undefined) {
    return "";
  }
  const list = nodeSpanning(file, { start, end: start + length });
  if (list === undefined) return "";
  const element = checker.getTypeAtLocation(list).getNumberIndexType();
  const key = element && readableKey(checker, [element]);
  return key === undefined ? "" : `, like .map(item => item.${key}).join(', ')`;
}

/**
 * A `tsc` diagnostic over `FORMULA_LIB` worded for admins. `checker` must
 * come from the program the diagnostic's file is in.
 */
export function compilerMessage(
  diagnostic: ts.Diagnostic,
  checker: ts.TypeChecker | undefined,
): string {
  if (diagnostic.code === JOIN_THIS_MISMATCH) {
    return `join works on a list of text, numbers or yes/no. Name a part of each item first${joinExample(diagnostic, checker)}, or flatten a list of lists with .flat().`;
  }
  const override = MESSAGE_OVERRIDES[diagnostic.code];
  if (override !== undefined) return override;
  const text = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
  return text.replace(COMPILER_ADVICE, "");
}
