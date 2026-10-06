import type { FormulaNode } from "@alliance/common/forms/visible-if-formula";
import { R, type Result } from "@alliance/common/result";

const CONDITION_NAME_REGEX = /^condition\d+$/i;

type Token = { type: "id" | "AND" | "OR" | "NOT" | "(" | ")"; value: string };

const KEYWORDS = new Map<string, Token["type"]>([
  ["and", "AND"],
  ["or", "OR"],
  ["not", "NOT"],
]);

function tokenize(input: string): Result<Token[], string> {
  const tokens: Token[] = [];
  let i = 0;
  const s = input.trim();
  while (i < s.length) {
    const rest = s.slice(i);
    const ws = rest.match(/^\s+/);
    if (ws) {
      i += ws[0].length;
      continue;
    }
    if (rest.startsWith("(") || rest.startsWith(")")) {
      tokens.push({ type: rest[0] === "(" ? "(" : ")", value: rest[0] });
      i += 1;
      continue;
    }
    const word = rest.match(/^[\p{L}\p{M}\p{N}_]+/u)?.[0];
    if (!word) {
      return R.failure(
        "Invalid formula syntax. Use condition names with AND, OR, NOT and parentheses.",
      );
    }
    const keyword = KEYWORDS.get(word.toLowerCase());
    if (keyword) {
      tokens.push({ type: keyword, value: keyword });
    } else {
      const name = isGeneratedConditionName(word) ? word.toLowerCase() : word;
      tokens.push({ type: "id", value: name });
    }
    i += word.length;
  }
  return R.success(tokens);
}

/**
 * Parse a visibility formula string into a FormulaNode.
 * Allowed: condition names, AND, OR, NOT, parentheses.
 * Precedence: NOT > AND > OR. Names are not checked against any condition list.
 * A name is a run of letters, marks, digits, and underscores other than AND/OR/NOT,
 * and `conditionN` reads in any case as lowercase; a saved name outside that
 * (`shown-2`, `or`, `Condition1`) doesn't survive serializing and reparsing.
 * @param text - e.g. "condition1 AND (c2 OR NOT condition3)"
 */
export function parseVisibilityFormula(
  text: string,
): Result<FormulaNode, string> {
  const tokenized = tokenize(text);
  if (!tokenized.ok) return tokenized;
  const tokens = tokenized.value;
  let pos = 0;
  function parseOr(): Result<FormulaNode, string> {
    const left = parseAnd();
    if (!left.ok) return left;
    if (pos < tokens.length && tokens[pos].type === "OR") {
      pos++;
      const right = parseOr();
      if (!right.ok) return right;
      return R.success({ op: "OR", left: left.value, right: right.value });
    }
    return left;
  }
  function parseAnd(): Result<FormulaNode, string> {
    const left = parseNot();
    if (!left.ok) return left;
    if (pos < tokens.length && tokens[pos].type === "AND") {
      pos++;
      const right = parseAnd();
      if (!right.ok) return right;
      return R.success({ op: "AND", left: left.value, right: right.value });
    }
    return left;
  }
  function parseNot(): Result<FormulaNode, string> {
    if (pos < tokens.length && tokens[pos].type === "NOT") {
      pos++;
      const inner = parseNot();
      if (!inner.ok) return inner;
      return R.success({ op: "NOT", operand: inner.value });
    }
    return parsePrimary();
  }
  function parsePrimary(): Result<FormulaNode, string> {
    if (pos >= tokens.length) {
      return R.failure("Unexpected end of formula.");
    }
    const token = tokens[pos];
    if (token.type === "(") {
      pos++;
      const inner = parseOr();
      if (!inner.ok) return inner;
      if (pos >= tokens.length || tokens[pos].type !== ")") {
        return R.failure("Missing closing parenthesis.");
      }
      pos++;
      return inner;
    }
    if (token.type === "id") {
      pos++;
      return R.success(token.value);
    }
    return R.failure("Expected a condition name or opening parenthesis.");
  }
  const result = parseOr();
  if (!result.ok) return result;
  if (pos < tokens.length) {
    return R.failure("Unexpected token after formula.");
  }
  return result;
}

/** Serialize a formula node back to display string (for editing). */
export function serializeVisibilityFormula(
  node: FormulaNode,
  leaf: (name: string) => string = (name) => name,
): string {
  const operand = (child: FormulaNode) =>
    typeof child === "string"
      ? leaf(child)
      : `(${serializeVisibilityFormula(child, leaf)})`;
  if (typeof node === "string") return leaf(node);
  if (node.op === "NOT") return `NOT ${operand(node.operand)}`;
  // The parser nests a chain of one operator to the right, so a
  // same-operator right child reads back unchanged without parentheses.
  const right =
    typeof node.right !== "string" && node.right.op === node.op
      ? serializeVisibilityFormula(node.right, leaf)
      : operand(node.right);
  return `${operand(node.left)} ${node.op} ${right}`;
}

/** Every condition name the formula references, in order, with repeats. */
export function formulaConditionNames(node: FormulaNode): string[] {
  if (typeof node === "string") return [node];
  if (node.op === "NOT") return formulaConditionNames(node.operand);
  return [
    ...formulaConditionNames(node.left),
    ...formulaConditionNames(node.right),
  ];
}

/** Default AND formula for n named conditions (condition1 … conditionN). */
export function defaultFormulaForConditionCount(n: number): string {
  if (n <= 0) return "";
  if (n === 1) return "condition1";
  return Array.from({ length: n }, (_, i) => `condition${i + 1}`).join(" AND ");
}

/** Condition name for index (0-based): condition1, condition2, ... */
export function conditionNameForIndex(index: number): string {
  return `condition${index + 1}`;
}

function isGeneratedConditionName(s: string): boolean {
  return CONDITION_NAME_REGEX.test(s);
}
