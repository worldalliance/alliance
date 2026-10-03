import type { FormulaNode } from "@alliance/common/forms/visible-if-formula";

const CONDITION_NAME_REGEX = /^condition\d+$/;

function tokenize(
  input: string,
): { type: "id" | "AND" | "OR" | "NOT" | "(" | ")"; value: string }[] {
  const tokens: {
    type: "id" | "AND" | "OR" | "NOT" | "(" | ")";
    value: string;
  }[] = [];
  let i = 0;
  const s = input.trim();
  while (i < s.length) {
    const rest = s.slice(i);
    const ws = rest.match(/^\s+/);
    if (ws) {
      i += ws[0].length;
      continue;
    }
    if (rest.startsWith("(")) {
      tokens.push({ type: "(", value: "(" });
      i += 1;
      continue;
    }
    if (rest.startsWith(")")) {
      tokens.push({ type: ")", value: ")" });
      i += 1;
      continue;
    }
    const idMatch = rest.match(/^(condition\d+)\b/i);
    if (idMatch) {
      tokens.push({ type: "id", value: idMatch[1].toLowerCase() });
      i += idMatch[1].length;
      continue;
    }
    if (rest.match(/^and\b/i)) {
      tokens.push({ type: "AND", value: "AND" });
      i += 3;
      continue;
    }
    if (rest.match(/^or\b/i)) {
      tokens.push({ type: "OR", value: "OR" });
      i += 2;
      continue;
    }
    if (rest.match(/^not\b/i)) {
      tokens.push({ type: "NOT", value: "NOT" });
      i += 3;
      continue;
    }
    return []; // invalid character
  }
  return tokens;
}

type ParseResult = { node: FormulaNode } | { error: string };

/**
 * Parse a visibility formula string into a FormulaNode.
 * Allowed: condition names (condition1, condition2, ...), AND, OR, NOT, parentheses.
 * Precedence: NOT > AND > OR.
 * @param text - e.g. "condition1 AND (condition2 OR NOT condition3)"
 * @param allowedNames - set of valid condition names (e.g. condition1, condition2)
 */
export function parseVisibilityFormula(
  text: string,
  allowedNames: Set<string>,
): ParseResult {
  const tokens = tokenize(text);
  if (tokens.length === 0 && text.trim().length > 0) {
    return {
      error:
        "Invalid formula syntax. Use condition1, condition2, ... with AND, OR, NOT and parentheses.",
    };
  }
  let pos = 0;
  function parseOr(): ParseResult {
    const leftResult = parseAnd();
    if ("error" in leftResult) return leftResult;
    if (pos >= tokens.length) return { node: leftResult.node };
    if (tokens[pos].type === "OR") {
      pos++;
      const rightResult = parseOr();
      if ("error" in rightResult) return rightResult;
      return {
        node: { op: "OR", left: leftResult.node, right: rightResult.node },
      };
    }
    return { node: leftResult.node };
  }
  function parseAnd(): ParseResult {
    const leftResult = parseNot();
    if ("error" in leftResult) return leftResult;
    if (pos >= tokens.length) return { node: leftResult.node };
    if (tokens[pos].type === "AND") {
      pos++;
      const rightResult = parseAnd();
      if ("error" in rightResult) return rightResult;
      return {
        node: { op: "AND", left: leftResult.node, right: rightResult.node },
      };
    }
    return { node: leftResult.node };
  }
  function parseNot(): ParseResult {
    if (pos < tokens.length && tokens[pos].type === "NOT") {
      pos++;
      const inner = parseNot();
      if ("error" in inner) return inner;
      return { node: { op: "NOT", operand: inner.node } };
    }
    return parsePrimary();
  }
  function parsePrimary(): ParseResult {
    if (pos >= tokens.length) {
      return { error: "Unexpected end of formula." };
    }
    if (tokens[pos].type === "(") {
      pos++;
      const inner = parseOr();
      if ("error" in inner) return inner;
      if (pos >= tokens.length || tokens[pos].type !== ")") {
        return { error: "Missing closing parenthesis." };
      }
      pos++;
      return { node: inner.node };
    }
    if (tokens[pos].type === "id") {
      const name = tokens[pos].value;
      pos++;
      if (!allowedNames.has(name)) {
        return {
          error: `Unknown condition "${name}". Use only condition names that exist in your list (e.g. condition1, condition2).`,
        };
      }
      return { node: name };
    }
    return { error: "Expected a condition name or opening parenthesis." };
  }
  const result = parseOr();
  if ("error" in result) return result;
  if (pos < tokens.length) {
    return { error: "Unexpected token after formula." };
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
  return `${operand(node.left)} ${node.op} ${operand(node.right)}`;
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

export function isConditionName(s: string): boolean {
  return CONDITION_NAME_REGEX.test(s);
}
